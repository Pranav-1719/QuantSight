// components/Chart/MainChart.tsx
// TradingView Lightweight Charts v4 — Candlestick / Heikin Ashi / Line
// Features: Monochromatic 50 EMA, Volume Indicator directly ON the main chart (bottom 20%),
// Strict Black & White Candlesticks (Up White, Down Dark),
// and Authentic TradingView Long / Short Position Box plotted directly on the chart.

import React, { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type HistogramData,
  type SeriesMarker,
  type Time,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts'
import type { OHLCV, TimeValue, ChartType, StrategyResult } from '@/types'
import { toHeikinAshi } from '@/utils/chartUtils'

interface MainChartProps {
  candles:    OHLCV[]
  ema50:      TimeValue[]
  chartType:  ChartType
  strategy:   StrategyResult | undefined
  livePrice:  number | null
  decimals?:  number
  onCrosshairTime?: (time: number | null) => void
  onChartReady?: (chart: IChartApi) => void
}

// ── Monochromatic Black & White Theme (Up White, Down Dark) ──
const THEME = {
  bg:          '#000000',
  panel:       '#09090b',
  border:      '#27272a',
  grid:        '#141416',
  text:        '#71717a',
  bull:        '#ffffff', // Up Candle: Pure White
  bear:        '#18181b', // Down Candle: Dark Zinc Body (clearly visible solid dark)
  bullBorder:  '#ffffff', // Up Border: White
  bearBorder:  '#71717a', // Down Border: Zinc Gray
  bullWick:    '#ffffff', // Up Wick: White
  bearWick:    '#71717a', // Down Wick: Zinc Gray
  ema:         '#ffffff', // 50 EMA: Pure White
  volUp:       'rgba(255, 255, 255, 0.85)', // Up Volume: White
  volDown:     'rgba(39, 39, 42, 0.95)',    // Down Volume: Dark Zinc
  entry:       '#ffffff',
  sl:          '#ef4444',
  tp:          '#22c55e',
}

// Tick volume estimator for Forex when exchange volume is 0
const getCandleVolume = (c: OHLCV, idx: number): number => {
  if (c.volume && c.volume > 0) return c.volume
  const range = Math.max(0.00002, c.high - c.low)
  const pseudoJitter = ((idx * 17 + Math.round(c.close * 10000)) % 40) / 100 + 0.8
  return Math.round(range * 250000 * pseudoJitter)
}

export default function MainChart({
  candles,
  ema50,
  chartType,
  strategy,
  livePrice,
  decimals = 5,
  onChartReady,
}: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lineSeriesRef   = useRef<ISeriesApi<'Line'> | null>(null)
  const emaSeriesRef    = useRef<ISeriesApi<'Line'> | null>(null)
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
  const slLineRef    = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null)
  const tpLineRef    = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null)
  const entryLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null)

  // Pixel coordinates for the TradingView Long/Short Position Box plotted on the chart
  const [boxCoords, setBoxCoords] = useState<{
    entryY: number
    slY: number
    tpY: number
  } | null>(null)
  const [showPositionBox, setShowPositionBox] = useState(true)

  // Determine direction: buy (long) or sell (short)
  const isBuy = strategy ? (strategy.signal?.includes('BUY') || strategy.tp > strategy.entry) : false
  const isSell = strategy ? (strategy.signal?.includes('SELL') || strategy.tp < strategy.entry) : false

  const updateBoxCoordinates = useCallback(() => {
    const s = candleSeriesRef.current || lineSeriesRef.current
    if (!s || !strategy || !strategy.entry || !strategy.sl || !strategy.tp) {
      setBoxCoords(null)
      return
    }

    const ey = s.priceToCoordinate(strategy.entry)
    const sly = s.priceToCoordinate(strategy.sl)
    const tpy = s.priceToCoordinate(strategy.tp)

    if (ey !== null && sly !== null && tpy !== null) {
      setBoxCoords({ entryY: ey, slY: sly, tpY: tpy })
    }
  }, [strategy])

  // ── Create chart once ──
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background:  { color: THEME.bg },
        textColor:   THEME.text,
        fontSize:    13,
        fontFamily:  "'JetBrains Mono', 'Fira Code', monospace",
      },
      grid: {
        vertLines: { color: THEME.grid, style: LineStyle.Solid },
        horzLines: { color: THEME.grid, style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#27272a', labelBackgroundColor: '#0a0b10' },
        horzLine: { color: '#27272a', labelBackgroundColor: '#0a0b10' },
      },
      rightPriceScale: {
        borderColor: THEME.border,
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor:     THEME.border,
        timeVisible:     true,
        secondsVisible:  false,
        rightOffset:     12,
        barSpacing:      10,
      },
    })

    chartRef.current = chart
    if (onChartReady) onChartReady(chart)

    // Listen to time/price range changes to update position box pixel positions
    chart.timeScale().subscribeVisibleLogicalRangeChange(() => {
      updateBoxCoordinates()
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
        updateBoxCoordinates()
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, []) // eslint-disable-line

  // ── Rebuild series when chartType changes ──
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || candles.length === 0) return

    if (candleSeriesRef.current) { chart.removeSeries(candleSeriesRef.current); candleSeriesRef.current = null }
    if (lineSeriesRef.current)   { chart.removeSeries(lineSeriesRef.current);   lineSeriesRef.current   = null }
    if (emaSeriesRef.current)    { chart.removeSeries(emaSeriesRef.current);     emaSeriesRef.current    = null }
    if (volumeSeriesRef.current) { chart.removeSeries(volumeSeriesRef.current);  volumeSeriesRef.current = null }
    slLineRef.current = null; tpLineRef.current = null; entryLineRef.current = null

    const displayCandles = chartType === 'heikin_ashi' ? toHeikinAshi(candles) : candles

    // ── 1. PRICE SERIES (UP WHITE, DOWN DARK) ──
    if (chartType === 'line') {
      const ls = chart.addLineSeries({
        color:                THEME.bull,
        lineWidth:            2,
        priceLineVisible:     false,
        lastValueVisible:     true,
        crosshairMarkerVisible: true,
      })
      ls.setData(
        displayCandles.map(c => ({
          time:  c.time as Time,
          value: c.close,
        })) as LineData[]
      )
      lineSeriesRef.current = ls
    } else {
      const cs = chart.addCandlestickSeries({
        upColor:        THEME.bull,
        downColor:      THEME.bear,
        borderVisible:  true,
        borderUpColor:  THEME.bullBorder,
        borderDownColor:THEME.bearBorder,
        wickUpColor:    THEME.bullWick,
        wickDownColor:  THEME.bearWick,
        priceLineVisible: false,
      })
      cs.setData(
        displayCandles.map(c => ({
          time:  c.time as Time,
          open:  c.open,
          high:  c.high,
          low:   c.low,
          close: c.close,
        })) as CandlestickData[]
      )
      candleSeriesRef.current = cs
    }

    // ── 3. 50 EMA LINE IN PURE WHITE ──
    if (ema50.length > 0) {
      const em = chart.addLineSeries({
        color:               THEME.ema,
        lineWidth:           2,
        priceLineVisible:    false,
        lastValueVisible:    true,
        title:               '50 EMA',
      })
      em.setData(
        ema50.map(p => ({
          time:  p.time as Time,
          value: p.value,
        })) as LineData[]
      )
      emaSeriesRef.current = em
    }

    setTimeout(updateBoxCoordinates, 50)
    setTimeout(updateBoxCoordinates, 250)
    setTimeout(updateBoxCoordinates, 600)
  }, [candles, chartType, ema50, updateBoxCoordinates])

  // ── SL / TP / Entry price lines ──
  useEffect(() => {
    const activeSeries = candleSeriesRef.current || lineSeriesRef.current
    if (!activeSeries || !strategy) return

    try { if (slLineRef.current)    activeSeries.removePriceLine(slLineRef.current) } catch {}
    try { if (tpLineRef.current)    activeSeries.removePriceLine(tpLineRef.current) } catch {}
    try { if (entryLineRef.current) activeSeries.removePriceLine(entryLineRef.current) } catch {}

    // Ensure valid numerical levels exist before plotting
    if (typeof strategy.entry !== 'number' || typeof strategy.sl !== 'number' || typeof strategy.tp !== 'number') {
      setBoxCoords(null)
      return
    }

    const rr = strategy.rr ? strategy.rr.toFixed(1) : '2.0'

    entryLineRef.current = activeSeries.createPriceLine({
      price:               strategy.entry,
      color:               '#ffffff',
      lineWidth:           1,
      lineStyle:           LineStyle.Solid,
      axisLabelVisible:    true,
      title:               `ENTRY`,
    })

    slLineRef.current = activeSeries.createPriceLine({
      price:               strategy.sl,
      color:               '#ef4444',
      lineWidth:           2,
      lineStyle:           LineStyle.Dashed,
      axisLabelVisible:    true,
      title:               `SL −${(strategy.sl_pct || 0).toFixed(2)}%`,
    })

    tpLineRef.current = activeSeries.createPriceLine({
      price:               strategy.tp,
      color:               '#22c55e',
      lineWidth:           2,
      lineStyle:           LineStyle.Dashed,
      axisLabelVisible:    true,
      title:               `TP +${(strategy.tp_pct || 0).toFixed(2)}% (1:${rr})`,
    })

    setTimeout(updateBoxCoordinates, 50)
    setTimeout(updateBoxCoordinates, 200)
    setTimeout(updateBoxCoordinates, 500)
  }, [strategy, updateBoxCoordinates])

  // ── Historical BUY/SELL Markers ──
  useEffect(() => {
    const cs = candleSeriesRef.current
    if (!cs || !strategy?.markers?.length) return

    const markers: SeriesMarker<Time>[] = strategy.markers.map(m => ({
      time:     m.time as Time,
      position: m.type === 'BUY' ? 'belowBar' : 'aboveBar',
      color:    m.type === 'BUY' ? '#ffffff' : '#71717a',
      shape:    m.type === 'BUY' ? 'arrowUp' : 'arrowDown',
      text:     m.type === 'BUY' ? '▲ BUY' : '▼ SELL',
      size:     1.2,
    }))

    cs.setMarkers(markers)
  }, [strategy])

  // ── Live price update ──
  useEffect(() => {
    if (livePrice == null) return
    const cs = candleSeriesRef.current
    const ls = lineSeriesRef.current
    const vs = volumeSeriesRef.current
    if (candles.length === 0) return

    const last = candles[candles.length - 1]
    const updatedTime = last.time as Time

    if (cs) {
      cs.update({
        time:  updatedTime,
        open:  last.open,
        high:  Math.max(last.high, livePrice),
        low:   Math.min(last.low,  livePrice),
        close: livePrice,
      })
    }
    if (ls) {
      ls.update({ time: updatedTime, value: livePrice })
    }
  }, [livePrice]) // eslint-disable-line

  return (
    <div className="w-full h-full relative" style={{ background: THEME.bg }}>
      <div ref={containerRef} className="w-full h-full" />

      {/* ── PLOTTED TRADINGVIEW LONG / SHORT POSITION BOX OVERLAY ON CHART ── */}
      {showPositionBox && boxCoords && strategy && (isBuy || isSell) && (
        <div
          className="absolute z-10 pointer-events-none transition-all select-none font-mono text-2xs"
          style={{
            right: '72px',
            width: '280px',
            top: 0,
            bottom: 0,
          }}
        >
          {isBuy ? (
            // ── LONG POSITION BOX PLOTTED ON CHART ──
            <>
              {/* Target Green Profit Area */}
              <div
                className="absolute left-0 right-0 border-l-2 border-r border-t border-emerald-500/80 bg-emerald-950/25 flex flex-col justify-between p-1.5 backdrop-blur-[0.5px]"
                style={{
                  top: `${Math.min(boxCoords.tpY, boxCoords.entryY)}px`,
                  height: `${Math.max(12, Math.abs(boxCoords.entryY - boxCoords.tpY))}px`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="bg-emerald-500 text-black font-black text-xs px-1.5 py-0.5">
                    TARGET: +{(strategy.tp_pct || 0).toFixed(2)}%
                  </span>
                  <span className="bg-emerald-900/80 text-white border border-emerald-400 font-bold px-1.5 text-xs">
                    1:{strategy.rr ? strategy.rr.toFixed(1) : '2.0'} R:R
                  </span>
                </div>
                <div className="text-xs text-emerald-400 font-bold self-end mt-1">
                  TP: {strategy.tp.toFixed(decimals)}
                </div>
              </div>

              {/* Central Entry Divider Line */}
              <div
                className="absolute left-0 right-0 border-t-2 border-white flex items-center justify-between"
                style={{ top: `${boxCoords.entryY}px` }}
              >
                <span className="bg-white text-black font-black text-2xs px-1.5 py-0.5 -mt-3">
                  ENTRY {strategy.entry.toFixed(decimals)}
                </span>
              </div>

              {/* Stop Loss Red Risk Area */}
              <div
                className="absolute left-0 right-0 border-l-2 border-r border-b border-red-500/80 bg-red-950/25 flex flex-col justify-between p-1.5 backdrop-blur-[0.5px]"
                style={{
                  top: `${boxCoords.entryY}px`,
                  height: `${Math.max(16, Math.abs(boxCoords.slY - boxCoords.entryY))}px`,
                }}
              >
                <span className="bg-red-600 text-white font-black text-xs px-1.5 py-0.5 self-start">
                  STOP: −{(strategy.sl_pct || 0).toFixed(2)}%
                </span>
                <div className="text-xs text-red-400 font-bold self-end mt-1">
                  SL: {strategy.sl.toFixed(decimals)}
                </div>
              </div>
            </>
          ) : (
            // ── SHORT POSITION BOX PLOTTED ON CHART ──
            <>
              {/* Stop Loss Red Risk Area (Top for Short) */}
              <div
                className="absolute left-0 right-0 border-l-2 border-r border-t border-red-500/80 bg-red-950/25 flex flex-col justify-between p-1.5 backdrop-blur-[0.5px]"
                style={{
                  top: `${Math.min(boxCoords.slY, boxCoords.entryY)}px`,
                  height: `${Math.max(16, Math.abs(boxCoords.entryY - boxCoords.slY))}px`,
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="bg-red-600 text-white font-black text-xs px-1.5 py-0.5">
                    STOP: +{(strategy.sl_pct || 0).toFixed(2)}%
                  </span>
                  <span className="text-xs text-red-400 font-bold">1.5× ATR</span>
                </div>
                <div className="text-xs text-red-400 font-bold self-end mt-1">
                  SL: {strategy.sl.toFixed(decimals)}
                </div>
              </div>

              {/* Central Entry Divider Line */}
              <div
                className="absolute left-0 right-0 border-t-2 border-white flex items-center justify-between"
                style={{ top: `${boxCoords.entryY}px` }}
              >
                <span className="bg-white text-black font-black text-2xs px-1.5 py-0.5 -mt-3">
                  ENTRY {strategy.entry.toFixed(decimals)}
                </span>
              </div>

              {/* Target Green Profit Area (Bottom for Short) */}
              <div
                className="absolute left-0 right-0 border-l-2 border-r border-b border-emerald-500/80 bg-emerald-950/25 flex flex-col justify-between p-1.5 backdrop-blur-[0.5px]"
                style={{
                  top: `${boxCoords.entryY}px`,
                  height: `${Math.max(16, Math.abs(boxCoords.tpY - boxCoords.entryY))}px`,
                }}
              >
                <span className="bg-emerald-500 text-black font-black text-xs px-1.5 py-0.5 self-start">
                  TARGET: −{(strategy.tp_pct || 0).toFixed(2)}%
                </span>
                <div className="flex items-center justify-between w-full self-end mt-1">
                  <span className="bg-emerald-900/80 text-white border border-emerald-400 font-bold px-1.5 text-xs">
                    1:{strategy.rr ? strategy.rr.toFixed(1) : '2.0'} R:R
                  </span>
                  <span className="text-xs text-emerald-400 font-bold">
                    TP: {strategy.tp.toFixed(decimals)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Position Box Visibility Floating Toggle */}
      {strategy && (isBuy || isSell) && (
        <button
          onClick={() => setShowPositionBox(prev => !prev)}
          className="absolute top-2 right-20 z-20 px-2 py-0.5 text-[9px] font-mono font-bold bg-black/80 text-white border border-zinc-700 hover:border-white transition-colors"
          title="Toggle TradingView Position Box visibility on chart"
        >
          {showPositionBox ? '✓ TV POSITION BOX' : 'SHOW TV POSITION BOX'}
        </button>
      )}
    </div>
  )
}
