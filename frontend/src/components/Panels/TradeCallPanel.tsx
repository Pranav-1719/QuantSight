// components/Panels/TradeCallPanel.tsx — Entry, SL, TP, R:R display + Journal Logging
// Features authentic TradingView Long/Short Position Box visualization

import { useState } from 'react'
import clsx from 'clsx'
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

  if (loading) {
    return (
      <div className="p-4 space-y-3 animate-pulse">
        <div className="h-28 bg-zinc-900 border border-zinc-800" />
        <div className="h-8 bg-zinc-900" />
      </div>
    )
  }

  if (!strategy) {
    return (
      <div className="panel h-full flex items-center justify-center p-4">
        <span className="text-xs text-text-muted font-mono">Awaiting signal…</span>
      </div>
    )
  }

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
    <div className="panel h-full flex flex-col overflow-hidden text-xs font-mono bg-black">
      <div className="p-2.5 border-b border-border flex items-center justify-between bg-zinc-950">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white uppercase tracking-wider">TradingView Position Box</span>
          <span className={clsx(
            'text-2xs font-bold px-1.5 py-0.2 border',
            isBuy ? 'border-white text-white' : isSell ? 'border-zinc-500 text-zinc-300' : 'border-zinc-800 text-zinc-600'
          )}>
            {isBuy ? 'LONG POSITION' : isSell ? 'SHORT POSITION' : 'NEUTRAL'}
          </span>
        </div>
        <span className="text-2xs text-zinc-400">R:R 1:{strategy.rr.toFixed(1)}</span>
      </div>

      <div className="p-3 space-y-3 overflow-y-auto flex-1">
        {/* ── TradingView Position Box Visual Widget ── */}
        <div className="border border-zinc-700 bg-black overflow-hidden font-mono text-2xs">
          {isBuy ? (
            // LONG POSITION BOX
            <div>
              {/* Target Green Area */}
              <div className="bg-emerald-950/40 border-b border-emerald-500/50 p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    TARGET (PROFIT) +{strategy.tp_pct.toFixed(2)}%
                  </div>
                  <div className="text-sm font-bold text-emerald-300 mt-0.5">
                    {strategy.tp.toFixed(5)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xs font-bold text-white bg-emerald-900/60 border border-emerald-500 px-1.5 py-0.5">
                    +{strategy.reward.toFixed(5)}
                  </div>
                  <div className="text-[9px] text-emerald-400 mt-0.5">R:R 1:{strategy.rr.toFixed(1)}</div>
                </div>
              </div>

              {/* Central Entry Line */}
              <div className="bg-zinc-900 border-y-2 border-white px-2.5 py-1.5 flex items-center justify-between">
                <div className="text-white font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>ENTRY LEVEL (OPEN)</span>
                </div>
                <div className="text-sm font-bold text-white font-mono">
                  {strategy.entry.toFixed(5)}
                </div>
              </div>

              {/* Stop Loss Red Area */}
              <div className="bg-red-950/40 border-t border-red-500/50 p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                    STOP LOSS (RISK) −{strategy.sl_pct.toFixed(2)}%
                  </div>
                  <div className="text-sm font-bold text-red-300 mt-0.5">
                    {strategy.sl.toFixed(5)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xs font-bold text-white bg-red-900/60 border border-red-500 px-1.5 py-0.5">
                    −{strategy.risk.toFixed(5)}
                  </div>
                  <div className="text-[9px] text-red-400 mt-0.5">1.5× ATR SL</div>
                </div>
              </div>
            </div>
          ) : isSell ? (
            // SHORT POSITION BOX
            <div>
              {/* Stop Loss Red Area (On Top for Short) */}
              <div className="bg-red-950/40 border-b border-red-500/50 p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-red-400 font-bold uppercase tracking-wider">
                    STOP LOSS (RISK) +{strategy.sl_pct.toFixed(2)}%
                  </div>
                  <div className="text-sm font-bold text-red-300 mt-0.5">
                    {strategy.sl.toFixed(5)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xs font-bold text-white bg-red-900/60 border border-red-500 px-1.5 py-0.5">
                    +{strategy.risk.toFixed(5)}
                  </div>
                  <div className="text-[9px] text-red-400 mt-0.5">1.5× ATR SL</div>
                </div>
              </div>

              {/* Central Entry Line */}
              <div className="bg-zinc-900 border-y-2 border-white px-2.5 py-1.5 flex items-center justify-between">
                <div className="text-white font-bold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                  <span>ENTRY LEVEL (OPEN)</span>
                </div>
                <div className="text-sm font-bold text-white font-mono">
                  {strategy.entry.toFixed(5)}
                </div>
              </div>

              {/* Target Green Area (Below Entry for Short) */}
              <div className="bg-emerald-950/40 border-t border-emerald-500/50 p-2.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
                    TARGET (PROFIT) −{strategy.tp_pct.toFixed(2)}%
                  </div>
                  <div className="text-sm font-bold text-emerald-300 mt-0.5">
                    {strategy.tp.toFixed(5)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xs font-bold text-white bg-emerald-900/60 border border-emerald-500 px-1.5 py-0.5">
                    −{strategy.reward.toFixed(5)}
                  </div>
                  <div className="text-[9px] text-emerald-400 mt-0.5">R:R 1:{strategy.rr.toFixed(1)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-zinc-500">
              No active position box — waiting for 50 EMA pullback &amp; StochRSI hook
            </div>
          )}
        </div>

        {/* Risk / Reward Metrics Row */}
        <div className="grid grid-cols-3 gap-2 text-center text-2xs p-2 bg-zinc-950 border border-border">
          <div>
            <div className="text-zinc-500">RISK (SL)</div>
            <div className="font-bold text-red-400 mt-0.5">{strategy.risk.toFixed(5)}</div>
          </div>
          <div>
            <div className="text-zinc-500">REWARD (TP)</div>
            <div className="font-bold text-emerald-400 mt-0.5">{strategy.reward.toFixed(5)}</div>
          </div>
          <div>
            <div className="text-zinc-500">R:R RATIO</div>
            <div className="font-bold text-white mt-0.5">1:{strategy.rr.toFixed(1)}</div>
          </div>
        </div>

        {/* Log to Journal CTA */}
        {hasTradeableCall && (
          <button
            onClick={handleLogToJournal}
            disabled={logging}
            className="w-full py-2 bg-white text-black font-bold text-xs uppercase tracking-wider border border-white hover:bg-zinc-200 transition-colors"
          >
            {logging ? 'RECORDING TO JOURNAL...' : `EXECUTE ${isBuy ? 'BUY LONG' : 'SELL SHORT'} → LOG TO JOURNAL`}
          </button>
        )}

        {loggedMsg && (
          <div className="text-2xs text-white border border-zinc-700 bg-zinc-950 p-2 text-center font-bold">
            {loggedMsg}
          </div>
        )}
      </div>
    </div>
  )
}
