// components/Chart/ChartToolbar.tsx — Chart engine + type + interval selector bar

import { useState, useRef, useEffect } from 'react'
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
  stochKColor?:  string
  stochDColor?:  string
  onChangeStochColors?: (k: string, d: string) => void
}

const STOCH_PRESETS = [
  { name: 'WHITE & GRAY', k: '#ffffff', d: '#a1a1aa' },
  { name: 'WHITE & RED',  k: '#ffffff', d: '#ef4444' },
  { name: 'CYAN & AMBER', k: '#38bdf8', d: '#facc15' },
  { name: 'GREEN & PURPLE', k: '#4ade80', d: '#c084fc' },
]

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
  stochKColor = '#ffffff',
  stochDColor = '#a1a1aa',
  onChangeStochColors,
}: ChartToolbarProps) {
  const [stochMenuOpen, setStochMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setStochMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-black flex-shrink-0 text-sm font-mono select-none relative">
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

      {/* Active Indicators Legend & Stochastic Color Customizer */}
      <div className="ml-auto flex items-center gap-3.5 relative">
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

        {/* Customizable Stochastic Indicator Pill & Dropdown */}
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setStochMenuOpen(prev => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-950 border border-zinc-800 hover:border-zinc-500 transition-colors cursor-pointer"
            title="Click to customize Stochastic indicator colors"
          >
            <span className="w-2.5 h-1.5 rounded-xs" style={{ backgroundColor: stochKColor }} />
            <span className="w-2.5 h-1.5 rounded-xs" style={{ backgroundColor: stochDColor }} />
            <span className="text-xs font-bold font-mono text-white">STOCH COLOR</span>
            <span className="text-2xs text-zinc-500">{stochMenuOpen ? '▲' : '▼'}</span>
          </button>

          {/* Color Customizer Popover Menu */}
          {stochMenuOpen && (
            <div className="absolute right-0 top-9 w-64 p-3 bg-black border-2 border-zinc-700 shadow-2xl z-50 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                <span className="font-bold text-white uppercase text-xs">CUSTOMIZE STOCHASTIC</span>
                <button
                  onClick={() => setStochMenuOpen(false)}
                  className="text-zinc-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Quick Presets */}
              <div>
                <div className="text-2xs text-zinc-400 uppercase font-bold mb-1.5">Presets:</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {STOCH_PRESETS.map(p => (
                    <button
                      key={p.name}
                      onClick={() => {
                        if (onChangeStochColors) onChangeStochColors(p.k, p.d)
                      }}
                      className={clsx(
                        'px-2 py-1 text-2xs font-bold border flex items-center gap-1.5 transition-colors',
                        stochKColor.toLowerCase() === p.k.toLowerCase() && stochDColor.toLowerCase() === p.d.toLowerCase()
                          ? 'border-white bg-zinc-900 text-white'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                      )}
                    >
                      <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: p.k }} />
                      <span className="w-2 h-2 rounded-xs" style={{ backgroundColor: p.d }} />
                      <span className="truncate">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual Pickers */}
              <div className="pt-2 border-t border-zinc-800 space-y-2">
                <div className="text-2xs text-zinc-400 uppercase font-bold">Custom Hex Colors:</div>
                
                {/* %K Picker */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white font-bold">%K Line Color:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={stochKColor}
                      onChange={e => {
                        if (onChangeStochColors) onChangeStochColors(e.target.value, stochDColor)
                      }}
                      className="w-7 h-6 cursor-pointer bg-transparent border border-zinc-700"
                    />
                    <span className="text-2xs text-zinc-400 font-mono">{stochKColor.toUpperCase()}</span>
                  </div>
                </div>

                {/* %D Picker */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-bold">%D Line Color:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={stochDColor}
                      onChange={e => {
                        if (onChangeStochColors) onChangeStochColors(stochKColor, e.target.value)
                      }}
                      className="w-7 h-6 cursor-pointer bg-transparent border border-zinc-700"
                    />
                    <span className="text-2xs text-zinc-400 font-mono">{stochDColor.toUpperCase()}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
