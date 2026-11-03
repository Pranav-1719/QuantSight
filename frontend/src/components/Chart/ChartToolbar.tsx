// components/Chart/ChartToolbar.tsx — Chart type + interval selector bar

import type { ChartType, Interval } from '@/types'
import { INTERVALS } from '@/types'
import clsx from 'clsx'

interface ChartToolbarProps {
  chartType:     ChartType
  interval:      Interval
  onChartType:   (t: ChartType) => void
  onInterval:    (i: Interval) => void
  isLoading?:    boolean
}

const CHART_TYPES: { label: string; value: ChartType; icon: string }[] = [
  { label: 'Candles',    value: 'candlestick',  icon: '▮▮' },
  { label: 'Heikin Ashi',value: 'heikin_ashi',  icon: '⬛' },
  { label: 'Line',       value: 'line',         icon: '╱╱' },
]

export default function ChartToolbar({ chartType, interval, onChartType, onInterval, isLoading }: ChartToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border" style={{ background: '#000000' }}>
      {/* Chart type buttons */}
      <div className="flex items-center gap-0.5">
        {CHART_TYPES.map(ct => (
          <button
            key={ct.value}
            onClick={() => onChartType(ct.value)}
            className={clsx(
              'px-2.5 py-1 text-2xs font-mono font-medium rounded-none transition-colors border',
              chartType === ct.value
                ? 'bg-white text-black border-white'
                : 'bg-transparent text-text-muted border-transparent hover:text-white hover:border-border'
            )}
          >
            {ct.label}
          </button>
        ))}
      </div>

      <div className="w-px h-4 bg-border" />

      {/* Interval buttons */}
      <div className="flex items-center gap-0.5">
        {INTERVALS.map(iv => (
          <button
            key={iv.value}
            onClick={() => onInterval(iv.value)}
            className={clsx(
              'px-2 py-1 text-2xs font-mono font-medium rounded-none transition-colors border',
              interval === iv.value
                ? 'bg-border text-white border-zinc-700'
                : 'bg-transparent text-text-muted border-transparent hover:text-white'
            )}
          >
            {iv.label}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-3">
        {isLoading && (
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-2xs text-text-muted font-mono">FETCHING</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-text-muted font-mono">EMA 50</span>
          <div className="w-4 h-px bg-zinc-400" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-text-muted font-mono">SL</span>
          <div className="w-4 h-px border-t border-dashed border-zinc-500" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-text-muted font-mono">TP</span>
          <div className="w-4 h-px border-t border-dashed border-white" />
        </div>
      </div>
    </div>
  )
}
