// components/Chart/StochRSIChart.tsx
// Stochastic RSI oscillator sub-chart — synced with MainChart

import { useEffect, useRef } from 'react'
import {
  createChart,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
  LineStyle,
  CrosshairMode,
} from 'lightweight-charts'
import type { StochPoint } from '@/types'

interface StochRSIChartProps {
  data:         StochPoint[]
  mainChart?:   IChartApi | null   // for time-scale sync
  onCrosshairTime?: (time: number | null) => void
}

const THEME = {
  bg:      '#000000',
  grid:    '#141416',
  border:  '#27272a',
  text:    '#71717a',
  k:       '#ffffff',    // %K line — pure white
  d:       '#ef4444',    // %D line — vivid red
  ob:      'rgba(255, 255, 255, 0.02)',
  os:      'rgba(255, 255, 255, 0.02)',
  ob_line: '#3f3f46',
  os_line: '#3f3f46',
}

export default function StochRSIChart({ data, mainChart, onCrosshairTime }: StochRSIChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const kSeriesRef   = useRef<ISeriesApi<'Line'> | null>(null)
  const dSeriesRef   = useRef<ISeriesApi<'Line'> | null>(null)

  // ── Create chart ──
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: THEME.bg },
        textColor:  THEME.text,
        fontSize:   10,
        fontFamily: "'JetBrains Mono', monospace",
      },
      grid: {
        vertLines: { color: THEME.grid },
        horzLines: { color: THEME.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#252738', labelBackgroundColor: '#0a0b10' },
        horzLine: { color: '#252738', labelBackgroundColor: '#0a0b10' },
      },
      rightPriceScale: {
        borderColor:   THEME.border,
        scaleMargins:  { top: 0.05, bottom: 0.05 },
        autoScale:     true,
      },
      timeScale: {
        borderColor:    THEME.border,
        visible:        false,  // hide time axis — shared with main chart
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale:  { mouseWheel: true, pinch: true },
    })

    chartRef.current = chart

    // %K series
    const kSeries = chart.addLineSeries({
      color:               THEME.k,
      lineWidth:           1,
      priceLineVisible:    false,
      lastValueVisible:    true,
      title:               'K',
    })
    kSeriesRef.current = kSeries

    // %D series
    const dSeries = chart.addLineSeries({
      color:               THEME.d,
      lineWidth:           1,
      lineStyle:           LineStyle.Dashed,
      priceLineVisible:    false,
      lastValueVisible:    true,
      title:               'D',
    })
    dSeriesRef.current = dSeries

    // Overbought line (80)
    kSeries.createPriceLine({ price: 80, color: THEME.ob_line, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: '80' })
    // Middle line (50)
    kSeries.createPriceLine({ price: 50, color: '#252738',     lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false, title: '' })
    // Oversold line (20)
    kSeries.createPriceLine({ price: 20, color: THEME.os_line, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: '20' })

    // Crosshair event
    if (onCrosshairTime) {
      chart.subscribeCrosshairMove((param) => {
        onCrosshairTime(param.time ? (param.time as number) : null)
      })
    }

    // Resize
    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
    }
  }, []) // eslint-disable-line

  // ── Set data ──
  useEffect(() => {
    if (!kSeriesRef.current || !dSeriesRef.current || !data.length) return
    const kData: LineData[] = data.map(p => ({ time: p.time as Time, value: p.k }))
    const dData: LineData[] = data.map(p => ({ time: p.time as Time, value: p.d }))
    kSeriesRef.current.setData(kData)
    dSeriesRef.current.setData(dData)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  // ── Sync scroll/zoom with main chart ──
  useEffect(() => {
    if (!mainChart || !chartRef.current) return

    const stochChart = chartRef.current

    // Sync scroll from main → stoch
    const unsub1 = mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) stochChart.timeScale().setVisibleLogicalRange(range)
    })

    // Sync scroll from stoch → main
    const unsub2 = stochChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) mainChart.timeScale().setVisibleLogicalRange(range)
    })

    return () => {
      try { mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(unsub1 as any) } catch {}
      try { stochChart.timeScale().unsubscribeVisibleLogicalRangeChange(unsub2 as any) } catch {}
    }
  }, [mainChart])

  return (
    <div className="w-full h-full relative">
      {/* Labels */}
      <div className="absolute top-1 left-2 z-10 flex items-center gap-3 pointer-events-none">
        <span className="text-2xs font-mono" style={{ color: THEME.text }}>STOCH RSI</span>
        <span className="text-2xs font-mono" style={{ color: THEME.k }}>%K</span>
        <span className="text-2xs font-mono" style={{ color: THEME.d }}>%D</span>
        <span className="text-2xs font-mono" style={{ color: THEME.ob_line.replace('30','aa') }}>OB 80</span>
        <span className="text-2xs font-mono" style={{ color: THEME.os_line.replace('30','aa') }}>OS 20</span>
      </div>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
