// components/Panels/LiveCallBox.tsx
// Box 1: What to do (Buy/Sell directive), Current Call, Live PnL, and TradingView Position Box

import React, { useState } from 'react'
import clsx from 'clsx'
import type { StrategyResult } from '@/types'
import { createJournalTrade } from '@/api/client'

interface Props {
  strategy: StrategyResult | undefined
  symbol: string
  currentPrice: number | null
  onLogSuccess?: () => void
}

export default function LiveCallBox({
  strategy,
  symbol,
  currentPrice,
  onLogSuccess,
}: Props) {
  const [logging, setLogging] = useState(false)
  const [loggedMsg, setLoggedMsg] = useState<string | null>(null)

  if (!strategy) {
    return (
      <div className="p-3 text-center text-zinc-500 font-mono text-2xs animate-pulse">
        Awaiting live signal evaluation...
      </div>
    )
  }

  const isBuy = strategy.signal.includes('BUY')
  const isSell = strategy.signal.includes('SELL')
  const isWait = !isBuy && !isSell

  const entry = strategy.entry || currentPrice || 0
  const sl = strategy.sl || (isBuy ? entry * 0.98 : entry * 1.02)
  const tp = strategy.tp || (isBuy ? entry * 1.04 : entry * 0.96)
  const rr = strategy.rr || 2.0
  const live = currentPrice || entry

  // Live PnL calculation
  let pnlPct = 0
  let pnlDiff = 0
  if (isBuy && entry > 0) {
    pnlDiff = live - entry
    pnlPct = (pnlDiff / entry) * 100
  } else if (isSell && entry > 0) {
    pnlDiff = entry - live
    pnlPct = (pnlDiff / entry) * 100
  }
  const isProfit = pnlPct >= 0

  const handleLogTrade = async () => {
    try {
      setLogging(true)
      await createJournalTrade({
        symbol,
        direction: isBuy ? 'BUY' : 'SELL',
        entry_price: entry,
        sl_price: sl,
        tp_price: tp,
        rr_ratio: rr,
        lot_size: 1.0,
        ai_verdict: strategy.ai_confirmation?.verdict || 'CONFIRMED_SIGNAL',
        ai_confidence: strategy.ai_confirmation?.confidence || 80,
        strategy_notes: `Current Call Execution: ${isBuy ? 'BUY' : 'SELL'} @ ${entry.toFixed(5)} | SL: ${sl.toFixed(5)} | TP: ${tp.toFixed(5)} | R:R 1:${rr.toFixed(1)} | EMA: ${strategy.ema50.toFixed(4)}`,
      })
      setLoggedMsg(`✓ Logged ${isBuy ? 'BUY' : 'SELL'} Call to Journal`)
      setTimeout(() => setLoggedMsg(null), 3000)
      if (onLogSuccess) onLogSuccess()
    } catch (e: any) {
      alert('Failed to log trade: ' + e.message)
    } finally {
      setLogging(false)
    }
  }

  return (
    <div className="bg-black border border-zinc-800 text-xs font-mono">
      {/* Box Header */}
      <div className="px-3 py-1.5 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white uppercase tracking-wider text-2xs">
            1. What To Do · Current Call
          </span>
          <span
            className={clsx(
              'px-1.5 py-0.2 text-[9px] font-bold border',
              isBuy
                ? 'bg-emerald-950 text-emerald-400 border-emerald-500 animate-pulse'
                : isSell
                ? 'bg-red-950 text-red-400 border-red-500 animate-pulse'
                : 'bg-zinc-900 text-zinc-400 border-zinc-700'
            )}
          >
            {isBuy ? '▲ BUY CALL' : isSell ? '▼ SELL CALL' : '⏳ WAIT / MONITOR'}
          </span>
        </div>

        {/* Live PnL Badge */}
        {!isWait && (
          <div
            className={clsx(
              'px-2 py-0.5 text-2xs font-bold border flex items-center gap-1',
              isProfit
                ? 'bg-emerald-950 text-emerald-300 border-emerald-500'
                : 'bg-red-950 text-red-300 border-red-500'
            )}
          >
            <span>LIVE P&amp;L:</span>
            <span>
              {isProfit ? '+' : ''}
              {pnlPct.toFixed(2)}% ({isProfit ? '+' : ''}
              {pnlDiff.toFixed(5)})
            </span>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2.5">
        {/* Directive: What To Do */}
        <div className="bg-zinc-950 p-2 border border-zinc-900 text-2xs leading-relaxed">
          <div className="text-zinc-500 uppercase font-bold text-[9px] mb-0.5">DIRECTIVE INSTRUCTION:</div>
          <div className="text-zinc-200 font-medium">
            {isBuy &&
              `ACTION: TAKE BUY CALL. Price bounced off 50 EMA (${strategy.ema50.toFixed(4)}) with StochRSI oversold hook. Target: ${tp.toFixed(5)} (+${strategy.tp_pct.toFixed(2)}%). Stop: ${sl.toFixed(5)}.`}
            {isSell &&
              `ACTION: TAKE SELL CALL. Price rejected 50 EMA (${strategy.ema50.toFixed(4)}) with StochRSI overbought hook. Target: ${tp.toFixed(5)} (-${strategy.tp_pct.toFixed(2)}%). Stop: ${sl.toFixed(5)}.`}
            {isWait &&
              `ACTION: STAND BY. StochRSI in middle neutral zone (${strategy.stoch_k.toFixed(1)}). Wait for 50 EMA test and hook.`}
          </div>
        </div>

        {/* TradingView-Style Long / Short Position Box */}
        {!isWait && (
          <div className="border border-zinc-700 bg-black overflow-hidden text-2xs">
            {isBuy ? (
              // Long Position Box
              <div>
                {/* Target Zone */}
                <div className="bg-emerald-950/40 border-b border-emerald-500/50 p-2 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] text-emerald-400 font-bold uppercase">
                      TARGET (TP) +{strategy.tp_pct.toFixed(2)}%
                    </div>
                    <div className="text-sm font-bold text-emerald-300 font-mono">
                      {tp.toFixed(5)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xs font-bold bg-emerald-900/60 text-white border border-emerald-500 px-1.5 py-0.5">
                      R:R 1:{rr.toFixed(1)}
                    </span>
                    <div className="text-[8px] text-emerald-400 mt-0.5">+{strategy.reward.toFixed(5)}</div>
                  </div>
                </div>

                {/* Entry Level */}
                <div className="bg-zinc-900 border-y-2 border-white px-2 py-1 flex items-center justify-between">
                  <span className="text-white font-bold text-[10px]">ENTRY LEVEL (OPEN)</span>
                  <span className="text-xs font-bold text-white font-mono">{entry.toFixed(5)}</span>
                </div>

                {/* Stop Loss Zone */}
                <div className="bg-red-950/40 border-t border-red-500/50 p-2 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] text-red-400 font-bold uppercase">
                      STOP LOSS (SL) −{strategy.sl_pct.toFixed(2)}%
                    </div>
                    <div className="text-sm font-bold text-red-300 font-mono">
                      {sl.toFixed(5)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xs font-bold bg-red-900/60 text-white border border-red-500 px-1.5 py-0.5">
                      −{strategy.risk.toFixed(5)}
                    </span>
                    <div className="text-[8px] text-red-400 mt-0.5">1.5× ATR</div>
                  </div>
                </div>
              </div>
            ) : (
              // Short Position Box
              <div>
                {/* Stop Loss Zone (Top) */}
                <div className="bg-red-950/40 border-b border-red-500/50 p-2 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] text-red-400 font-bold uppercase">
                      STOP LOSS (SL) +{strategy.sl_pct.toFixed(2)}%
                    </div>
                    <div className="text-sm font-bold text-red-300 font-mono">
                      {sl.toFixed(5)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xs font-bold bg-red-900/60 text-white border border-red-500 px-1.5 py-0.5">
                      +{strategy.risk.toFixed(5)}
                    </span>
                    <div className="text-[8px] text-red-400 mt-0.5">1.5× ATR</div>
                  </div>
                </div>

                {/* Entry Level */}
                <div className="bg-zinc-900 border-y-2 border-white px-2 py-1 flex items-center justify-between">
                  <span className="text-white font-bold text-[10px]">ENTRY LEVEL (OPEN)</span>
                  <span className="text-xs font-bold text-white font-mono">{entry.toFixed(5)}</span>
                </div>

                {/* Target Zone (Bottom) */}
                <div className="bg-emerald-950/40 border-t border-emerald-500/50 p-2 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] text-emerald-400 font-bold uppercase">
                      TARGET (TP) −{strategy.tp_pct.toFixed(2)}%
                    </div>
                    <div className="text-sm font-bold text-emerald-300 font-mono">
                      {tp.toFixed(5)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-2xs font-bold bg-emerald-900/60 text-white border border-emerald-500 px-1.5 py-0.5">
                      R:R 1:{rr.toFixed(1)}
                    </span>
                    <div className="text-[8px] text-emerald-400 mt-0.5">−{strategy.reward.toFixed(5)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 1-Click Log Button */}
        {!isWait && (
          <button
            onClick={handleLogTrade}
            disabled={logging}
            className="w-full py-1.5 bg-white text-black font-bold text-2xs uppercase tracking-wider border border-white hover:bg-zinc-200 transition-colors"
          >
            {logging ? 'SAVING TO JOURNAL...' : `EXECUTE ${isBuy ? 'BUY' : 'SELL'} → LOG TO JOURNAL (1:${rr.toFixed(1)} R:R)`}
          </button>
        )}

        {loggedMsg && (
          <div className="text-2xs text-white bg-zinc-950 border border-zinc-700 p-1.5 text-center font-bold">
            {loggedMsg}
          </div>
        )}
      </div>
    </div>
  )
}
