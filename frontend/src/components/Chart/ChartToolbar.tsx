// components/Chart/ChartToolbar.tsx — Chart engine + type + interval selector bar

import type { ChartType, Interval } from '@/types'
import { INTERVALS } from '@/types'
import clsx from 'clsx'

interface ChartToolbarProps {
  chartType:     ChartType
  interval:      Interval
  onChartType:   (t: ChartType) => void
  onInterval:    (i: Interval) => void
  isLoading?:    boolean
  chartEngine?:  'tradingview' | 'quantsight'
  onToggleEngine?: (engine: 'tradingview' | 'quantsight') => void
}

const CHART_TYPES: { label: string; value: ChartType; icon: string }[] = [
  { label: 'Candles',    value: 'candlestick',  icon: '▮▮' },
  { label: 'Heikin Ashi',value: 'heikin_ashi',  icon: '⬛' },
  { label: 'Line',       value: 'line',         icon: '╱╱' },
]

export default function ChartToolbar({
  chartType,
  interval,
  onChartType,
  onInterval,
  isLoading,
  chartEngine = 'tradingview',
  onToggleEngine,
}: ChartToolbarProps) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-black flex-shrink-0 text-sm font-mono select-none">
      {/* Chart Engine Switcher */}
      {onToggleEngine && (
        <div className="flex items-center gap-1.5 border-r border-border pr-3">
          <button
            onClick={() => onToggleEngine('tradingview')}
            className={clsx(
              'px-3 py-1.5 text-xs font-bold transition-all border flex items-center gap-1.5',
              chartEngine === 'tradingview'
                ? 'bg-white text-black border-white shadow-sm'
                : 'bg-black text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
            )}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>TRADINGVIEW ADVANCED</span>
          </button>

          <button
            onClick={() => onToggleEngine('quantsight')}
            className={clsx(
              'px-2.5 py-1.5 text-xs font-bold transition-all border flex items-center gap-1.5',
              chartEngine === 'quantsight'
                ? 'bg-white text-black border-white shadow-sm'
                : 'bg-black text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
            )}
          >
            <span>QUANTSIGHT OVERLAY</span>
          </button>
        </div>
      )}

      {/* Interval buttons */}
      <div className="flex items-center gap-1">
        {INTERVALS.map(iv => (
          <button
            key={iv.value}
            onClick={() => onInterval(iv.value)}
            className={clsx(
              'px-2.5 py-1 text-xs font-mono font-bold transition-colors border',
              interval === iv.value
                ? 'bg-zinc-800 text-white border-zinc-600'
                : 'bg-transparent text-zinc-500 border-transparent hover:text-white'
            )}
          >
            {iv.label}
          </button>
        ))}
      </div>

      {chartEngine === 'quantsight' && (
        <>
          <div className="w-px h-4 bg-border" />
          {/* Chart type buttons */}
          <div className="flex items-center gap-1">
            {CHART_TYPES.map(ct => (
              <button
                key={ct.value}
                onClick={() => onChartType(ct.value)}
                className={clsx(
                  'px-3 py-1 text-xs font-mono font-bold transition-colors border',
                  chartType === ct.value
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-zinc-500 border-transparent hover:text-white hover:border-border'
                )}
              >
                {ct.label}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Active Indicators Legend */}
      <div className="ml-auto flex items-center gap-3.5">
        {isLoading && (
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-xs text-zinc-400 font-mono font-bold">SYNCING</span>
          </div>
        )}

        {/* 50 EMA Legend in WHITE */}
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-1 bg-white rounded-sm" />
          <span className="text-xs text-white font-bold font-mono">50 EMA</span>
        </div>

        {/* Stochastic RSI Legend in White and Gray */}
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-1 bg-white rounded-sm" />
          <span className="w-2.5 h-1 bg-zinc-500 rounded-sm" />
          <span className="text-xs text-zinc-300 font-mono font-bold">STOCH RSI (W/G)</span>
        </div>
      </div>
    </div>
  )
}
