// components/Layout/Header.tsx — Minimalist Black & White Bloomberg Terminal Header

import { useState } from 'react'
import clsx from 'clsx'
import type { LivePrice, SymbolConfig, Interval } from '@/types'
import { SYMBOLS, INTERVALS } from '@/types'
import { fmtPrice, fmtChange, fmtPct } from '@/utils/chartUtils'

interface HeaderProps {
  symbol: SymbolConfig
  livePrice: LivePrice | null
  interval: Interval
  onSymbol: (s: SymbolConfig) => void
  onInterval: (i: Interval) => void
  onRefresh: () => void
  isLoading?: boolean
  decimals?: number
  view: 'terminal' | 'journal'
  onView: (v: 'terminal' | 'journal') => void
  openTradesCount?: number
}

const CATEGORIES = ['Forex', 'India', 'Commodity', 'Crypto']

export default function Header({
  symbol,
  livePrice,
  interval,
  onSymbol,
  onInterval,
  onRefresh,
  isLoading,
  decimals = 5,
  view,
  onView,
  openTradesCount = 0,
}: HeaderProps) {
  const [open, setOpen] = useState(false)
  const [cat, setCat] = useState<string>('Forex')

  const price = livePrice?.price ?? 0
  const change = livePrice?.change ?? 0
  const changePct = livePrice?.change_pct ?? 0
  const isUp = change >= 0

  return (
    <div
      className="flex items-center gap-0 h-11 border-b border-border flex-shrink-0 relative z-50 bg-black font-mono text-sm select-none"
    >
      {/* Brand */}
      <div className="flex items-center gap-2 px-3.5 h-full border-r border-border">
        <div className="w-2.5 h-2.5 bg-white" />
        <span className="font-black text-sm tracking-widest text-white">QUANTSIGHT</span>
        <span className="text-2xs text-zinc-400 hidden sm:inline font-bold">v2.5</span>
      </div>

      {/* Navigation: Terminal / Journal */}
      <div className="flex items-center h-full border-r border-border">
        <button
          onClick={() => onView('terminal')}
          className={clsx(
            'px-4 h-full text-xs font-bold uppercase tracking-wider transition-colors border-r border-border',
            view === 'terminal'
              ? 'bg-white text-black'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-950'
          )}
        >
          TERMINAL
        </button>
        <button
          onClick={() => onView('journal')}
          className={clsx(
            'px-4 h-full text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-2',
            view === 'journal'
              ? 'bg-white text-black'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-950'
          )}
        >
          <span>JOURNAL</span>
          {openTradesCount > 0 && (
            <span className={clsx(
              'px-1.5 py-0.2 text-2xs font-bold',
              view === 'journal' ? 'bg-black text-white' : 'bg-zinc-800 text-white'
            )}>
              {openTradesCount}
            </span>
          )}
        </button>
      </div>

      {/* Symbol selector */}
      <div className="relative h-full">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-3 px-3.5 h-full border-r border-border hover:bg-zinc-950 transition-colors"
        >
          <div>
            <div className="font-black text-white text-sm">{symbol.label}</div>
            <div className="text-2xs text-zinc-400 text-left font-bold">{symbol.category}</div>
          </div>
          <span className="text-zinc-400 text-xs font-bold">{open ? '▲' : '▼'}</span>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-10 left-0 w-72 shadow-2xl z-50 bg-black border border-border">
            {/* Category tabs */}
            <div className="flex border-b border-border bg-zinc-950">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCat(c)}
                  className={clsx(
                    'flex-1 py-1.5 text-2xs uppercase tracking-wider transition-colors',
                    cat === c ? 'bg-white text-black font-bold' : 'text-zinc-400 hover:text-white'
                  )}
                >
                  {c}
                </button>
              ))}
            </div>

            {/* Symbol list */}
            <div className="max-h-64 overflow-y-auto divide-y divide-zinc-900">
              {SYMBOLS.filter(s => s.category === cat).map(s => (
                <button
                  key={s.ticker}
                  onClick={() => { onSymbol(s); setOpen(false) }}
                  className={clsx(
                    'w-full text-left px-3.5 py-2 flex items-center justify-between hover:bg-zinc-900 transition-colors',
                    symbol.ticker === s.ticker && 'bg-zinc-900 text-white font-bold'
                  )}
                >
                  <span className="text-white text-xs">{s.label}</span>
                  <span className="text-2xs text-zinc-500">{s.ticker}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Live price quote */}
      <div className="flex items-center gap-3 px-3.5 h-full border-r border-border">
        <div>
          <div className="font-black text-base text-white tracking-wider">
            {price > 0 ? fmtPrice(price, decimals) : '—'}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-bold">
            <span>{change !== 0 ? fmtChange(change, decimals) : '0.00'}</span>
            <span>({changePct !== 0 ? fmtPct(changePct) : '0.00%'})</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-white animate-pulse" />
          <span className="text-2xs text-zinc-400 font-bold">LIVE</span>
        </div>
      </div>

      {/* Interval quick select (Terminal mode only) */}
      {view === 'terminal' && (
        <div className="hidden md:flex items-center h-full border-r border-border px-2 gap-1">
          {INTERVALS.map(iv => (
            <button
              key={iv.value}
              onClick={() => onInterval(iv.value)}
              className={clsx(
                'px-2.5 py-1 text-xs font-bold transition-colors',
                interval === iv.value
                  ? 'bg-white text-black'
                  : 'text-zinc-400 hover:text-white'
              )}
            >
              {iv.label}
            </button>
          ))}
        </div>
      )}

      {/* Right actions */}
      <div className="ml-auto flex items-center h-full px-3 gap-2">
        {isLoading && (
          <div className="flex items-center gap-1 text-2xs text-zinc-500">
            <div className="w-1.5 h-1.5 bg-white animate-ping" />
            <span>SYNCING</span>
          </div>
        )}
        <button
          onClick={onRefresh}
          className="px-2.5 py-1 text-2xs border border-border text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
        >
          ↺ REFRESH
        </button>
        <div className="text-2xs text-zinc-600 hidden lg:block">
          {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {open && <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />}
    </div>
  )
}
