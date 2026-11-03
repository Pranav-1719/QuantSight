// components/Panels/TradeCallPanel.tsx — Entry, SL, TP, R:R display + Journal Logging

import { useState } from 'react'
import type { StrategyResult } from '@/types'
import { createJournalTrade } from '@/api/client'

interface Props {
  strategy: StrategyResult | undefined
  loading: boolean
  symbolName?: string
  onLogSuccess?: () => void
}

export default function TradeCallPanel({ strategy, loading, symbolName = 'ACTIVE_SYMBOL', onLogSuccess }: Props) {
  const [logging, setLogging] = useState(false)
  const [loggedMsg, setLoggedMsg] = useState<string | null>(null)

  if (loading) return <Skeleton />
  if (!strategy) return (
    <div className="panel h-full flex items-center justify-center p-4">
      <span className="text-xs text-text-muted font-mono">Awaiting signal…</span>
    </div>
  )

  const isBuy = strategy.signal.includes('BUY')
  const isSell = strategy.signal.includes('SELL')
  const hasTradeableCall = isBuy || isSell

  const handleLogToJournal = async () => {
    try {
      setLogging(true)
      await createJournalTrade({
        symbol: symbolName,
        direction: isBuy ? 'BUY' : isSell ? 'SELL' : 'BUY',
        entry_price: strategy.entry,
        sl_price: strategy.sl,
        tp_price: strategy.tp,
        rr_ratio: strategy.rr,
        lot_size: 1.0,
        ai_verdict: strategy.ai_confirmation?.verdict || 'CONFIRMED',
        ai_confidence: strategy.ai_confirmation?.confidence || 75.0,
        strategy_notes: `Signal: ${strategy.signal}. EMA: ${strategy.ema50}. StochK: ${strategy.stoch_k}. Pattern: ${strategy.ha_pattern.pattern}`,
      })
      setLoggedMsg('✓ Logged to Journal')
      setTimeout(() => setLoggedMsg(null), 3000)
      if (onLogSuccess) onLogSuccess()
    } catch (e: any) {
      alert('Failed to log trade: ' + e.message)
    } finally {
      setLogging(false)
    }
  }

  return (
    <div className="panel h-full flex flex-col overflow-hidden text-xs font-mono">
      <div className="panel-header flex items-center justify-between">
        <span>Trade Execution Call</span>
        <span className="text-2xs text-zinc-500">Min 1:2 R:R</span>
      </div>

      {/* Price levels */}
      <div className="p-3 space-y-2">
        {/* Entry */}
        <div className="flex items-center justify-between py-1 border-b border-border">
          <span className="metric-label">ENTRY LEVEL</span>
          <span className="font-mono text-sm font-bold text-white">
            {strategy.entry.toFixed(5)}
          </span>
        </div>

        {/* SL */}
        <div className="flex items-center justify-between py-1 border-b border-border">
          <div>
            <span className="metric-label">STOP LOSS</span>
            <span className="ml-2 text-2xs font-mono text-zinc-400">−{strategy.sl_pct.toFixed(2)}%</span>
          </div>
          <span className="font-mono text-sm font-semibold text-zinc-300">
            {strategy.sl.toFixed(5)}
          </span>
        </div>

        {/* TP */}
        <div className="flex items-center justify-between py-1 border-b border-border">
          <div>
            <span className="metric-label">TAKE PROFIT</span>
            <span className="ml-2 text-2xs font-mono text-white">+{strategy.tp_pct.toFixed(2)}%</span>
          </div>
          <span className="font-mono text-sm font-bold text-white">
            {strategy.tp.toFixed(5)}
          </span>
        </div>

        {/* Risk / Reward breakdown */}
        <div className="grid grid-cols-2 gap-2 pt-1 text-2xs">
          <div className="border border-border p-1.5 bg-black">
            <span className="text-zinc-500">RISK</span>
            <div className="font-bold text-zinc-300">{strategy.risk.toFixed(5)}</div>
          </div>
          <div className="border border-border p-1.5 bg-black">
            <span className="text-zinc-500">REWARD</span>
            <div className="font-bold text-white">{strategy.reward.toFixed(5)}</div>
          </div>
        </div>

        {/* R:R Ratio Badge */}
        <div className="flex items-center justify-between p-2.5 bg-black border border-border">
          <span className="text-2xs uppercase tracking-widest text-zinc-400">Risk : Reward</span>
          <span className="font-mono text-lg font-bold text-white">
            1 : {strategy.rr.toFixed(1)}
          </span>
        </div>

        {/* Log to Journal Button */}
        {hasTradeableCall && (
          <button
            onClick={handleLogToJournal}
            disabled={logging}
            className="w-full py-2 bg-white text-black font-bold uppercase tracking-wider text-xs border border-white hover:bg-zinc-200 transition-colors mt-2"
          >
            {logging ? 'RECORDING...' : 'LOG TO TRADING JOURNAL'}
          </button>
        )}

        {loggedMsg && (
          <div className="text-2xs text-white bg-zinc-900 border border-zinc-700 p-1.5 text-center font-bold">
            {loggedMsg}
          </div>
        )}
      </div>

      {/* ATR info */}
      <div className="px-3 pb-2 text-2xs text-zinc-500 flex justify-between border-t border-border pt-2">
        <span>ATR VOLATILITY (14)</span>
        <span className="text-zinc-300 font-mono">{strategy.atr.toFixed(5)}</span>
      </div>

      {/* Setup reasons */}
      {strategy.setup.length > 0 && (
        <div className="px-3 pb-3 flex-1 overflow-auto space-y-1">
          <div className="text-2xs text-text-muted uppercase tracking-wider mb-1">
            Confluence Checklist
          </div>
          {strategy.setup.map((s, i) => (
            <div key={i} className="text-2xs text-zinc-400 font-mono leading-relaxed border-b border-zinc-800/50 pb-1">
              {s}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Skeleton() {
  return (
    <div className="panel h-full flex flex-col gap-2 p-3 animate-pulse">
      <div className="h-3 w-20 bg-border" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-7 bg-zinc-900" />
      ))}
    </div>
  )
}
