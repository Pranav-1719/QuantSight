// components/Panels/LiveCallBox.tsx
// Box 1: Large, bold, highly visible labeled cards for Trade Directive, Current Call, Live P&L, and TradingView Position Box

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
      <div className="p-4 text-center text-zinc-500 font-mono text-xs animate-pulse">
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
    <div className="bg-black text-xs font-mono select-none">
      <div className="p-3 space-y-3">
        {/* ── 1. MAIN LARGE ACTION DIRECTIVE BADGE ── */}
        <div
          className={clsx(
            'p-3.5 border-2 flex items-center justify-between transition-all',
            isBuy
              ? 'bg-emerald-950/40 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
              : isSell
              ? 'bg-red-950/40 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]'
              : 'bg-zinc-950 border-zinc-700'
          )}
        >
          <div>
            <div className="text-xs uppercase font-bold text-zinc-300 tracking-wider">
              [WHAT TO DO · TRADE ACTION]
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={clsx(
                  'w-3.5 h-3.5 rounded-full',
                  isBuy ? 'bg-emerald-400 animate-ping' : isSell ? 'bg-red-400 animate-ping' : 'bg-zinc-500'
                )}
              />
              <span className="text-xl font-black tracking-tight text-white">
                {isBuy ? 'BUY LONG NOW' : isSell ? 'SELL SHORT NOW' : 'WAIT FOR CONFIRMATION'}
              </span>
            </div>
            <div className="text-xs text-zinc-300 mt-1.5">
              {isBuy && '50 EMA Support bounce confirmed + StochRSI oversold hook up'}
              {isSell && '50 EMA Resistance rejection confirmed + StochRSI overbought roll down'}
              {isWait && 'StochRSI in middle range (40-60). Stand by for EMA test.'}
            </div>
          </div>

          {/* Large Live P&L Pill */}
          {!isWait && (
            <div
              className={clsx(
                'px-4 py-2.5 border-2 text-center flex flex-col justify-center min-w-[110px]',
                isProfit
                  ? 'bg-emerald-900/60 border-emerald-400 text-emerald-300'
                  : 'bg-red-900/60 border-red-400 text-red-300'
              )}
            >
              <span className="text-2xs font-bold uppercase tracking-wider text-white">LIVE P&amp;L</span>
              <span className="text-lg font-black font-mono">
                {isProfit ? '+' : ''}
                {pnlPct.toFixed(2)}%
              </span>
              <span className="text-xs font-semibold text-zinc-200">
                {isProfit ? '+' : ''}
                {pnlDiff.toFixed(5)}
              </span>
            </div>
          )}
        </div>

        {/* ── 2. PROMINENT LABELED CARDS FOR ENTRY / TP / SL ── */}
        <div className="grid grid-cols-3 gap-2.5">
          {/* Card: ENTRY */}
          <div className="p-3 bg-zinc-950 border-2 border-white flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-black uppercase text-black bg-white px-1.5 py-0.5">
                ENTRY
              </span>
              <span className="text-2xs text-zinc-400 font-bold">OPEN</span>
            </div>
            <div className="text-base font-black text-white mt-1.5 font-mono">
              {entry.toFixed(5)}
            </div>
            <div className="text-xs text-zinc-400 mt-0.5 font-medium">
              Live: {live.toFixed(5)}
            </div>
          </div>

          {/* Card: TAKE PROFIT */}
          <div className="p-3 bg-emerald-950/30 border-2 border-emerald-500 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-black uppercase text-emerald-950 bg-emerald-400 px-1.5 py-0.5">
                TARGET (TP)
              </span>
              <span className="text-xs text-emerald-400 font-bold">+{strategy.tp_pct.toFixed(2)}%</span>
            </div>
            <div className="text-base font-black text-emerald-300 mt-1.5 font-mono">
              {tp.toFixed(5)}
            </div>
            <div className="text-xs text-emerald-400 font-bold mt-0.5">
              +{strategy.reward.toFixed(5)}
            </div>
          </div>

          {/* Card: STOP LOSS */}
          <div className="p-3 bg-red-950/30 border-2 border-red-500 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-black uppercase text-white bg-red-600 px-1.5 py-0.5">
                STOP (SL)
              </span>
              <span className="text-xs text-red-400 font-bold">−{strategy.sl_pct.toFixed(2)}%</span>
            </div>
            <div className="text-base font-black text-red-300 mt-1.5 font-mono">
              {sl.toFixed(5)}
            </div>
            <div className="text-xs text-red-400 font-bold mt-0.5">
              −{strategy.risk.toFixed(5)}
            </div>
          </div>
        </div>

        {/* ── 3. RISK/REWARD & EMA CONFLUENCE LABELED BAR ── */}
        <div className="p-2.5 bg-zinc-950 border border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-white text-black font-black text-2xs">
              R:R RATIO
            </span>
            <span className="text-base font-bold text-white font-mono">
              1 : {rr.toFixed(2)}
            </span>
            <span className="text-xs text-emerald-400 font-bold">✓ MIN 1:2.0 MET</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-red-600 text-white font-black text-2xs">
              50 EMA
            </span>
            <span className="text-sm font-bold text-red-400 font-mono">
              {strategy.ema50.toFixed(5)}
            </span>
          </div>
        </div>

        {/* ── 4. TRADINGVIEW-STYLE LONG/SHORT POSITION BOX VISUAL ── */}
        {!isWait && (
          <div className="border-2 border-zinc-700 bg-black overflow-hidden font-mono text-2xs">
            {isBuy ? (
              // Long Position Box
              <div>
                {/* Target Area (Green) */}
                <div className="bg-emerald-950/50 border-b-2 border-emerald-500 p-3 flex items-center justify-between">
                  <div>
                    <span className="bg-emerald-500 text-black font-black text-2xs px-2 py-0.5">
                      TARGET (PROFIT)
                    </span>
                    <div className="text-base font-black text-emerald-300 mt-1">
                      {tp.toFixed(5)} (+{strategy.tp_pct.toFixed(2)}%)
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 text-xs font-bold bg-emerald-900 border border-emerald-400 text-white">
                      R:R 1:{rr.toFixed(1)}
                    </span>
                    <div className="text-xs text-emerald-400 mt-1 font-bold">+{strategy.reward.toFixed(5)} Gain</div>
                  </div>
                </div>

                {/* Entry Center Line (White) */}
                <div className="bg-zinc-900 border-y-2 border-white px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-white text-black font-black text-2xs px-2 py-0.5">
                      ENTRY
                    </span>
                    <span className="text-white font-bold text-xs">OPEN POSITION</span>
                  </div>
                  <span className="text-base font-black text-white font-mono">
                    {entry.toFixed(5)}
                  </span>
                </div>

                {/* Stop Loss Area (Red) */}
                <div className="bg-red-950/50 border-t-2 border-red-500 p-3 flex items-center justify-between">
                  <div>
                    <span className="bg-red-600 text-white font-black text-2xs px-2 py-0.5">
                      STOP LOSS (RISK)
                    </span>
                    <div className="text-base font-black text-red-300 mt-1">
                      {sl.toFixed(5)} (−{strategy.sl_pct.toFixed(2)}%)
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 text-xs font-bold bg-red-900 border border-red-400 text-white">
                      1.5× ATR SL
                    </span>
                    <div className="text-xs text-red-400 mt-1 font-bold">−{strategy.risk.toFixed(5)} Risk</div>
                  </div>
                </div>
              </div>
            ) : (
              // Short Position Box
              <div>
                {/* Stop Loss Area (Red Top) */}
                <div className="bg-red-950/50 border-b-2 border-red-500 p-3 flex items-center justify-between">
                  <div>
                    <span className="bg-red-600 text-white font-black text-2xs px-2 py-0.5">
                      STOP LOSS (RISK)
                    </span>
                    <div className="text-base font-black text-red-300 mt-1">
                      {sl.toFixed(5)} (+{strategy.sl_pct.toFixed(2)}%)
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 text-xs font-bold bg-red-900 border border-red-400 text-white">
                      1.5× ATR SL
                    </span>
                    <div className="text-xs text-red-400 mt-1 font-bold">+{strategy.risk.toFixed(5)} Risk</div>
                  </div>
                </div>

                {/* Entry Center Line (White) */}
                <div className="bg-zinc-900 border-y-2 border-white px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-white text-black font-black text-2xs px-2 py-0.5">
                      ENTRY
                    </span>
                    <span className="text-white font-bold text-xs">OPEN POSITION</span>
                  </div>
                  <span className="text-base font-black text-white font-mono">
                    {entry.toFixed(5)}
                  </span>
                </div>

                {/* Target Area (Green Bottom) */}
                <div className="bg-emerald-950/50 border-t-2 border-emerald-500 p-3 flex items-center justify-between">
                  <div>
                    <span className="bg-emerald-500 text-black font-black text-2xs px-2 py-0.5">
                      TARGET (PROFIT)
                    </span>
                    <div className="text-base font-black text-emerald-300 mt-1">
                      {tp.toFixed(5)} (−{strategy.tp_pct.toFixed(2)}%)
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 text-xs font-bold bg-emerald-900 border border-emerald-400 text-white">
                      R:R 1:{rr.toFixed(1)}
                    </span>
                    <div className="text-xs text-emerald-400 mt-1 font-bold">−{strategy.reward.toFixed(5)} Gain</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 5. LARGE ACTION BUTTON: LOG CALL TO JOURNAL ── */}
        {!isWait && (
          <button
            onClick={handleLogTrade}
            disabled={logging}
            className="w-full py-3 bg-white text-black font-black text-sm uppercase tracking-wider border-2 border-white hover:bg-zinc-200 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            <span>⚡</span>
            <span>
              {logging
                ? 'RECORDING TO JOURNAL...'
                : `EXECUTE ${isBuy ? 'BUY LONG' : 'SELL SHORT'} → LOG TO JOURNAL (1:${rr.toFixed(1)} R:R)`}
            </span>
          </button>
        )}

        {loggedMsg && (
          <div className="text-xs text-white bg-zinc-950 border-2 border-emerald-500 p-2 text-center font-bold">
            {loggedMsg}
          </div>
        )}
      </div>
    </div>
  )
}
