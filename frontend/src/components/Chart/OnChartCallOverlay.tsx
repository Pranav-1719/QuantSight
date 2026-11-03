// components/Chart/OnChartCallOverlay.tsx
// Pure On-Chart Horizontal Lines for Take-Profit (TP), Entry, and Stop-Loss (SL)
// Renders clean, high-contrast price lines spanning across the chart canvas

import { useState } from 'react'
import clsx from 'clsx'
import type { StrategyResult, SymbolConfig } from '@/types'

interface Props {
  strategy: StrategyResult | undefined
  symbol: SymbolConfig
  currentPrice: number | null
  decimals?: number
  onLogSuccess?: () => void
}

export default function OnChartCallOverlay({
  strategy,
  symbol,
  currentPrice,
  decimals = 5,
}: Props) {
  const [showLines, setShowLines] = useState(true)

  if (!strategy || !showLines) {
    return (
      <div className="absolute top-2 right-14 z-20 pointer-events-auto">
        <button
          onClick={() => setShowLines(true)}
          className="px-2 py-0.5 text-2xs font-mono font-bold bg-black/80 text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-500 backdrop-blur-sm transition-colors"
          title="Show SL / TP / Entry lines on chart"
        >
          SHOW SL/TP LINES
        </button>
      </div>
    )
  }

  const isBuy = strategy.signal.includes('BUY')
  const isSell = strategy.signal.includes('SELL')
  const isWait = !isBuy && !isSell

  // If there is no active trade call, keep chart clean
  if (isWait) {
    return null
  }

  const entry = strategy.entry || currentPrice || 0
  const sl = strategy.sl || (isBuy ? entry * 0.98 : entry * 1.02)
  const tp = strategy.tp || (isBuy ? entry * 1.04 : entry * 0.96)
  const rr = strategy.rr || 2.0
  const tpPct = strategy.tp_pct ? Math.abs(strategy.tp_pct).toFixed(2) : '0.00'
  const slPct = strategy.sl_pct ? Math.abs(strategy.sl_pct).toFixed(2) : '0.00'

  // Proportional vertical positioning (BUY: TP top, Entry middle, SL bottom. SELL: SL top, Entry middle, TP bottom)
  const topLevel = isBuy
    ? {
        type: 'TP' as const,
        price: tp,
        label: `TP ${tp.toFixed(decimals)} (+${tpPct}%)`,
        tag: `TARGET (1:${rr.toFixed(1)} R:R)`,
        color: 'emerald',
      }
    : {
        type: 'SL' as const,
        price: sl,
        label: `SL ${sl.toFixed(decimals)} (+${slPct}%)`,
        tag: 'STOP LOSS (1.5× ATR)',
        color: 'red',
      }

  const bottomLevel = isBuy
    ? {
        type: 'SL' as const,
        price: sl,
        label: `SL ${sl.toFixed(decimals)} (−${slPct}%)`,
        tag: 'STOP LOSS (1.5× ATR)',
        color: 'red',
      }
    : {
        type: 'TP' as const,
        price: tp,
        label: `TP ${tp.toFixed(decimals)} (−${tpPct}%)`,
        tag: `TARGET (1:${rr.toFixed(1)} R:R)`,
        color: 'emerald',
      }

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden font-mono select-none">
      {/* Discrete Toggle Button (Top Right corner) */}
      <div className="absolute top-2 right-14 pointer-events-auto">
        <button
          onClick={() => setShowLines(false)}
          className="px-2 py-0.5 text-3xs font-bold text-zinc-500 hover:text-white bg-black/60 border border-zinc-800 hover:border-zinc-600 transition-colors"
          title="Hide SL / TP / Entry lines"
        >
          HIDE LINES ✕
        </button>
      </div>

      {/* ─── 1. TOP LINE (TP for Buy, SL for Sell) ─── */}
      <div
        className="absolute left-0 right-0 flex items-center px-2"
        style={{ top: '24%' }}
      >
        {topLevel.type === 'TP' ? (
          <>
            {/* Left Label */}
            <span className="flex-shrink-0 bg-emerald-500 text-black font-black text-xs px-2 py-0.5 shadow-md">
              ▲ {topLevel.label}
            </span>
            {/* Dashed Line */}
            <div className="flex-1 border-t-2 border-dashed border-emerald-500/90 mx-2" />
            {/* Right Tag */}
            <span className="flex-shrink-0 bg-emerald-950 text-emerald-300 border border-emerald-500 text-2xs font-bold px-2 py-0.5 shadow-md">
              {topLevel.tag}
            </span>
          </>
        ) : (
          <>
            {/* Left Label */}
            <span className="flex-shrink-0 bg-red-600 text-white font-black text-xs px-2 py-0.5 shadow-md">
              ▼ {topLevel.label}
            </span>
            {/* Dashed Line */}
            <div className="flex-1 border-t-2 border-dashed border-red-500/90 mx-2" />
            {/* Right Tag */}
            <span className="flex-shrink-0 bg-red-950 text-red-300 border border-red-500 text-2xs font-bold px-2 py-0.5 shadow-md">
              {topLevel.tag}
            </span>
          </>
        )}
      </div>

      {/* ─── 2. ENTRY LINE (Solid White) ─── */}
      <div
        className="absolute left-0 right-0 flex items-center px-2"
        style={{ top: '48%' }}
      >
        {/* Left Label */}
        <span className="flex-shrink-0 bg-white text-black font-black text-xs px-2 py-0.5 shadow-md flex items-center gap-1.5">
          <span>●</span>
          <span>ENTRY {entry.toFixed(decimals)}</span>
          <span className="bg-black text-white px-1 text-3xs font-bold uppercase">
            {isBuy ? 'BUY CALL' : 'SELL CALL'}
          </span>
        </span>

        {/* Solid White Line */}
        <div className="flex-1 border-t-2 border-solid border-white mx-2" />

        {/* Right Tag */}
        <span className="flex-shrink-0 bg-zinc-900 text-white border border-white text-2xs font-bold px-2 py-0.5 shadow-md">
          {symbol.label} · {isBuy ? 'LONG' : 'SHORT'}
        </span>
      </div>

      {/* ─── 3. BOTTOM LINE (SL for Buy, TP for Sell) ─── */}
      <div
        className="absolute left-0 right-0 flex items-center px-2"
        style={{ top: '72%' }}
      >
        {bottomLevel.type === 'SL' ? (
          <>
            {/* Left Label */}
            <span className="flex-shrink-0 bg-red-600 text-white font-black text-xs px-2 py-0.5 shadow-md">
              ▼ {bottomLevel.label}
            </span>
            {/* Dashed Line */}
            <div className="flex-1 border-t-2 border-dashed border-red-500/90 mx-2" />
            {/* Right Tag */}
            <span className="flex-shrink-0 bg-red-950 text-red-300 border border-red-500 text-2xs font-bold px-2 py-0.5 shadow-md">
              {bottomLevel.tag}
            </span>
          </>
        ) : (
          <>
            {/* Left Label */}
            <span className="flex-shrink-0 bg-emerald-500 text-black font-black text-xs px-2 py-0.5 shadow-md">
              ▲ {bottomLevel.label}
            </span>
            {/* Dashed Line */}
            <div className="flex-1 border-t-2 border-dashed border-emerald-500/90 mx-2" />
            {/* Right Tag */}
            <span className="flex-shrink-0 bg-emerald-950 text-emerald-300 border border-emerald-500 text-2xs font-bold px-2 py-0.5 shadow-md">
              {bottomLevel.tag}
            </span>
          </>
        )}
      </div>
    </div>
  )
}
