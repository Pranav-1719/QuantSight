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
  candleUpColor?: string
  candleDownColor?: string
  onChangeCandleColors?: (up: string, down: string) => void
}

const CANDLE_PRESETS = [
  { name: 'B&W (WHITE & DARK)',   up: '#ffffff', down: '#000000' },
  { name: 'CLASSIC GREEN & RED', up: '#22c55e', down: '#ef4444' },
  { name: 'CYAN & MAGENTA',      up: '#06b6d4', down: '#ec4899' },
  { name: 'AMBER & PURPLE',      up: '#f59e0b', down: '#8b5cf6' },
]

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
  candleUpColor = '#ffffff',
  candleDownColor = '#000000',
  onChangeCandleColors,
}: ChartToolbarProps) {
  const [stochMenuOpen, setStochMenuOpen] = useState(false)
  const [candleMenuOpen, setCandleMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const candleMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setStochMenuOpen(false)
      }
      if (candleMenuRef.current && !candleMenuRef.current.contains(e.target as Node)) {
        setCandleMenuOpen(false)
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

        {/* ── CUSTOMIZABLE CANDLESTICK COLORS PILL & DROPDOWN ── */}
        <div ref={candleMenuRef} className="relative">
          <button
            onClick={() => setCandleMenuOpen(prev => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-950 border border-zinc-800 hover:border-zinc-500 transition-colors cursor-pointer"
            title="Click to customize Candlestick (Up / Down) colors"
          >
            <span
              className="w-2.5 h-3 border border-zinc-500 rounded-xs"
              style={{ backgroundColor: candleUpColor }}
              title={`Up Candle: ${candleUpColor}`}
            />
            <span
              className="w-2.5 h-3 border border-zinc-500 rounded-xs"
              style={{ backgroundColor: candleDownColor }}
              title={`Down Candle: ${candleDownColor}`}
            />
            <span className="text-xs font-bold font-mono text-white">CANDLE COLOR</span>
            <span className="text-2xs text-zinc-500">{candleMenuOpen ? '▲' : '▼'}</span>
          </button>

          {/* Candle Color Customizer Popover Menu */}
          {candleMenuOpen && (
            <div className="absolute right-0 top-9 w-64 p-3 bg-black border-2 border-zinc-700 shadow-2xl z-50 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-800">
                <span className="font-bold text-white uppercase text-xs">CANDLESTICK COLOURS</span>
                <button
                  onClick={() => setCandleMenuOpen(false)}
                  className="text-zinc-500 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Quick Presets */}
              <div>
                <div className="text-2xs text-zinc-400 uppercase font-bold mb-1.5">Presets:</div>
                <div className="grid grid-cols-1 gap-1.5">
                  {CANDLE_PRESETS.map(p => {
                    const isSelected =
                      candleUpColor.toLowerCase() === p.up.toLowerCase() &&
                      candleDownColor.toLowerCase() === p.down.toLowerCase()
                    return (
                      <button
                        key={p.name}
                        onClick={() => {
                          if (onChangeCandleColors) onChangeCandleColors(p.up, p.down)
                        }}
                        className={clsx(
                          'px-2.5 py-1 text-2xs font-bold border flex items-center justify-between transition-colors',
                          isSelected
                            ? 'border-white bg-zinc-900 text-white'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-3 border border-zinc-600 rounded-xs" style={{ backgroundColor: p.up }} />
                          <span className="w-2.5 h-3 border border-zinc-600 rounded-xs" style={{ backgroundColor: p.down }} />
                          <span>{p.name}</span>
                        </div>
                        {isSelected && <span className="text-emerald-400 text-2xs">ACTIVE</span>}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Individual Pickers */}
              <div className="pt-2 border-t border-zinc-800 space-y-2">
                <div className="text-2xs text-zinc-400 uppercase font-bold">Custom Hex Colors:</div>

                {/* Up Candle (Bullish) */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white font-bold">Up Candle (Bull):</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={candleUpColor}
                      onChange={e => {
                        if (onChangeCandleColors) onChangeCandleColors(e.target.value, candleDownColor)
                      }}
                      className="w-7 h-6 cursor-pointer bg-transparent border border-zinc-700"
                    />
                    <span className="text-2xs text-zinc-400 font-mono">{candleUpColor.toUpperCase()}</span>
                  </div>
                </div>

                {/* Down Candle (Bearish) */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-300 font-bold">Down Candle (Bear):</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={candleDownColor}
                      onChange={e => {
                        if (onChangeCandleColors) onChangeCandleColors(candleUpColor, e.target.value)
                      }}
                      className="w-7 h-6 cursor-pointer bg-transparent border border-zinc-700"
                    />
                    <span className="text-2xs text-zinc-400 font-mono">{candleDownColor.toUpperCase()}</span>
                  </div>
                </div>
              </div>

              {/* Reset to Default Button */}
              <button
                onClick={() => {
                  if (onChangeCandleColors) onChangeCandleColors('#ffffff', '#000000')
                }}
                className="w-full py-1 text-2xs font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-colors"
              >
                ↺ RESET TO DEFAULT B&amp;W
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
