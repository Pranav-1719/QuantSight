// components/Chart/MainChart.tsx
// TradingView Lightweight Charts v4 — Candlestick / Heikin Ashi / Line
// Features: 50 EMA line, SL/TP price lines, BUY/SELL entry markers, live price update

import { useEffect, useRef, useCallback } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type SeriesMarker,
  type Time,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts'
import type { OHLCV, TimeValue, ChartMarker, ChartType, StrategyResult } from '@/types'
import { toHeikinAshi } from '@/utils/chartUtils'

interface MainChartProps {
  candles:    OHLCV[]
  ema50:      TimeValue[]
  chartType:  ChartType
  strategy:   StrategyResult | undefined
  livePrice:  number | null
  onCrosshairTime?: (time: number | null) => void
  onChartReady?: (chart: IChartApi) => void
}

// ── Design tokens (Minimalist Black & White / Monochromatic Terminal) ──
const THEME = {
  bg:          '#000000',
  panel:       '#09090b',
  border:      '#27272a',
  grid:        '#141416',
  text:        '#71717a',
  bull:        '#ffffff',
  bear:        '#000000',
  bullBorder:  '#ffffff',
  bearBorder:  '#71717a',
  bullWick:    '#ffffff',
  bearWick:    '#71717a',
  ema:         '#e4e4e7',
  entry:       '#a1a1aa',
  sl:          '#71717a',
  tp:          '#ffffff',
}

export default function MainChart({
  candles, ema50, chartType, strategy, livePrice, onCrosshairTime, onChartReady,
}: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const lineSeriesRef   = useRef<ISeriesApi<'Line'> | null>(null)
  const emaSeriesRef    = useRef<ISeriesApi<'Line'> | null>(null)
  const slLineRef    = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null)
  const tpLineRef    = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null)
  const entryLineRef = useRef<ReturnType<ISeriesApi<'Candlestick'>['createPriceLine']> | null>(null)

  // ── Create chart once ──
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background:  { color: THEME.bg },
        textColor:   THEME.text,
        fontSize:    11,
        fontFamily:  "'JetBrains Mono', 'Fira Code', monospace",
      },
      grid: {
        vertLines: { color: THEME.grid, style: LineStyle.Solid },
        horzLines: { color: THEME.grid, style: LineStyle.Solid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#252738', labelBackgroundColor: '#0a0b10' },
        horzLine: { color: '#252738', labelBackgroundColor: '#0a0b10' },
      },
      rightPriceScale: {
        borderColor: THEME.border,
        scaleMargins: { top: 0.06, bottom: 0.12 },
      },
      timeScale: {
        borderColor:     THEME.border,
        timeVisible:     true,
        secondsVisible:  false,
        rightOffset:     8,
        barSpacing:      10,
      },
      handleScroll:  { mouseWheel: true, pressedMouseMove: true },
      handleScale:   { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    })

    chartRef.current = chart

    if (onChartReady) onChartReady(chart)

    // Crosshair callback
    if (onCrosshairTime) {
      chart.subscribeCrosshairMove((param) => {
        onCrosshairTime(param.time ? (param.time as number) : null)
      })
    }

    // Responsive resize
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleSeriesRef.current = null
      lineSeriesRef.current   = null
      emaSeriesRef.current    = null
    }
  }, []) // eslint-disable-line

  // ── Rebuild series when chartType changes ──
  useEffect(() => {
    const chart = chartRef.current
    if (!chart || candles.length === 0) return

    // Remove existing series
    if (candleSeriesRef.current) { chart.removeSeries(candleSeriesRef.current); candleSeriesRef.current = null }
    if (lineSeriesRef.current)   { chart.removeSeries(lineSeriesRef.current);   lineSeriesRef.current   = null }
    if (emaSeriesRef.current)    { chart.removeSeries(emaSeriesRef.current);     emaSeriesRef.current    = null }
    slLineRef.current = null; tpLineRef.current = null; entryLineRef.current = null

    const displayCandles = chartType === 'heikin_ashi' ? toHeikinAshi(candles) : candles

    if (chartType === 'line') {
      // Line chart from close prices
      const ls = chart.addLineSeries({
        color:                THEME.bull,
        lineWidth:            2,
        priceLineVisible:     false,
        lastValueVisible:     true,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
      })
      ls.setData(
        displayCandles.map(c => ({ time: c.time as Time, value: c.close })) as LineData[]
      )
      lineSeriesRef.current = ls

    } else {
      // Candlestick / Heikin Ashi
      const cs = chart.addCandlestickSeries({
        upColor:        THEME.bull,
        downColor:      THEME.bear,
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

    // EMA 50 line
    if (ema50.length > 0) {
      const em = chart.addLineSeries({
        color:               THEME.ema,
        lineWidth:           1,
        lineStyle:           LineStyle.Solid,
        priceLineVisible:    false,
        lastValueVisible:    false,
        crosshairMarkerVisible: false,
        title: 'EMA 50',
      })
      em.setData(ema50.map(p => ({ time: p.time as Time, value: p.value })) as LineData[])
      emaSeriesRef.current = em
    }

    chart.timeScale().fitContent()

  }, [candles, ema50, chartType]) // eslint-disable-line

  // ── SL / TP / Entry price lines ──
  useEffect(() => {
    const activeSeries = candleSeriesRef.current || lineSeriesRef.current
    if (!activeSeries || !strategy) return

    // Remove old lines
    try { if (slLineRef.current)    activeSeries.removePriceLine(slLineRef.current) } catch {}
    try { if (tpLineRef.current)    activeSeries.removePriceLine(tpLineRef.current) } catch {}
    try { if (entryLineRef.current) activeSeries.removePriceLine(entryLineRef.current) } catch {}

    if (!['BUY','SELL','BUY_WATCH','SELL_WATCH'].some(s => strategy.signal.includes(s))) return

    const rr = strategy.rr.toFixed(1)

    entryLineRef.current = activeSeries.createPriceLine({
      price:               strategy.entry,
      color:               THEME.entry,
      lineWidth:           1,
      lineStyle:           LineStyle.Dashed,
      axisLabelVisible:    true,
      title:               `ENTRY`,
    })

    slLineRef.current = activeSeries.createPriceLine({
      price:               strategy.sl,
      color:               THEME.sl,
      lineWidth:           2,
      lineStyle:           LineStyle.Dashed,
      axisLabelVisible:    true,
      title:               `SL  −${strategy.sl_pct.toFixed(2)}%`,
    })

    tpLineRef.current = activeSeries.createPriceLine({
      price:               strategy.tp,
      color:               THEME.tp,
      lineWidth:           2,
      lineStyle:           LineStyle.Dashed,
      axisLabelVisible:    true,
      title:               `TP  +${strategy.tp_pct.toFixed(2)}%  1:${rr}`,
    })

  }, [strategy]) // eslint-disable-line

  // ── Entry / Exit markers ──
  useEffect(() => {
    const cs = candleSeriesRef.current
    if (!cs || !strategy?.markers?.length) return

    const markers: SeriesMarker<Time>[] = strategy.markers.map(m => ({
      time:     m.time as Time,
      position: m.type === 'BUY' ? 'belowBar' : 'aboveBar',
      color:    m.type === 'BUY' ? THEME.bull : THEME.bear,
      shape:    m.type === 'BUY' ? 'arrowUp' : 'arrowDown',
      text:     m.type === 'BUY' ? '▲' : '▼',
      size:     1.5,
    }))

    cs.setMarkers(markers)
  }, [strategy])

  // ── Live price update (last candle) ──
  useEffect(() => {
    if (livePrice == null) return
    const cs = candleSeriesRef.current
    const ls = lineSeriesRef.current
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
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ background: THEME.bg }}
    />
  )
}
