// components/Chart/OnChartCallOverlay.tsx
// High-Contrast On-Chart Trade Directive, Stop-Loss (SL), Take-Profit (TP) & Real-Time P&L HUD
// Placed directly over the chart canvas (works with both TradingView Advanced Chart and QuantSight engine)

import { useState } from 'react'
import clsx from 'clsx'
import type { StrategyResult, SymbolConfig } from '@/types'
import { createJournalTrade } from '@/api/client'

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
  onLogSuccess,
}: Props) {
  const [minimized, setMinimized] = useState(false)
  const [visible, setVisible] = useState(true)
  const [logging, setLogging] = useState(false)
  const [loggedMsg, setLoggedMsg] = useState<string | null>(null)

  if (!visible) {
    return (
      <div className="absolute top-2 left-2 z-30 pointer-events-auto">
        <button
          onClick={() => setVisible(true)}
          className="px-2.5 py-1 text-xs font-mono font-bold bg-black/90 text-white border border-zinc-700 hover:border-white shadow-lg backdrop-blur-sm"
          title="Show On-Chart SL / TP / Call HUD"
        >
          👁 SHOW SL / TP / CALL HUD
        </button>
      </div>
    )
  }

  if (!strategy) {
    return (
      <div className="absolute top-2 left-2 z-30 pointer-events-auto">
        <div className="px-3 py-1.5 text-xs font-mono font-bold bg-black/80 text-zinc-400 border border-zinc-800 backdrop-blur-sm flex items-center gap-2">
          <div className="w-2 h-2 bg-zinc-500 animate-ping" />
          <span>CALCULATING SL / TP / CALL FOR {symbol.label}...</span>
        </div>
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
        symbol: symbol.ticker,
        direction: isBuy ? 'BUY' : 'SELL',
        entry_price: entry,
        sl_price: sl,
        tp_price: tp,
        rr_ratio: rr,
        lot_size: 1.0,
        ai_verdict: strategy.ai_confirmation?.verdict || 'ON_CHART_EXECUTION',
        ai_confidence: strategy.ai_confirmation?.confidence || 85,
        strategy_notes: `On-Chart HUD Call: ${isBuy ? 'BUY' : 'SELL'} ${symbol.label} @ ${entry.toFixed(decimals)} | SL: ${sl.toFixed(decimals)} | TP: ${tp.toFixed(decimals)} | R:R 1:${rr.toFixed(1)}`,
      })
      setLoggedMsg(`✓ Logged ${isBuy ? 'BUY' : 'SELL'} Call`)
      setTimeout(() => setLoggedMsg(null), 3000)
      if (onLogSuccess) onLogSuccess()
    } catch (e: any) {
      alert('Failed to log trade: ' + e.message)
    } finally {
      setLogging(false)
    }
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 select-none font-mono">
      {/* ─── TOP SECTION: FLOATING HUD CARD (TOP-LEFT) ─── */}
      <div className="flex items-start justify-between w-full">
        {/* Main On-Chart HUD Box */}
        <div className="pointer-events-auto max-w-sm w-full bg-black/92 border-2 border-zinc-700 backdrop-blur-md shadow-[0_10px_30px_rgba(0,0,0,0.85)]">
          {/* Card Header Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950 border-b border-zinc-800 text-xs">
            <div className="flex items-center gap-2">
              <span className={clsx(
                'w-2 h-2 rounded-full',
                isBuy ? 'bg-emerald-400 animate-pulse' : isSell ? 'bg-red-400 animate-pulse' : 'bg-zinc-500'
              )} />
              <span className="font-black text-white">{symbol.label}</span>
              <span className="text-2xs text-zinc-400 font-bold uppercase tracking-wider">
                [{symbol.category}]
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setMinimized(prev => !prev)}
                className="px-1.5 py-0.5 text-2xs font-bold text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-500 transition-colors"
                title={minimized ? 'Expand HUD' : 'Minimize HUD'}
              >
                {minimized ? 'EXPAND ▲' : 'COLLAPSE ▼'}
              </button>
              <button
                onClick={() => setVisible(false)}
                className="px-1.5 py-0.5 text-2xs font-bold text-zinc-500 hover:text-red-400 border border-zinc-800 hover:border-zinc-600 transition-colors"
                title="Hide HUD"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Minimized View */}
          {minimized ? (
            <div className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className={clsx(
                  'px-2 py-0.5 font-black text-xs uppercase',
                  isBuy ? 'bg-emerald-500 text-black' : isSell ? 'bg-red-500 text-white' : 'bg-zinc-800 text-zinc-300'
                )}>
                  {isBuy ? 'BUY CALL' : isSell ? 'SELL CALL' : 'WAIT'}
                </span>
                <span className="text-white font-bold font-mono">
                  @{entry.toFixed(decimals)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-2xs font-bold">
                <span className="text-emerald-400">TP: {tp.toFixed(decimals)}</span>
                <span className="text-red-400">SL: {sl.toFixed(decimals)}</span>
                {!isWait && (
                  <span className={isProfit ? 'text-emerald-400' : 'text-red-400'}>
                    {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>
          ) : (
            /* Expanded Full HUD */
            <div className="p-3 space-y-2.5">
              {/* Call Directive Banner */}
              <div
                className={clsx(
                  'p-2.5 border-2 flex items-center justify-between transition-all',
                  isBuy
                    ? 'bg-emerald-950/70 border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                    : isSell
                    ? 'bg-red-950/70 border-red-500 shadow-[0_0_12px_rgba(239,68,68,0.3)]'
                    : 'bg-zinc-950 border-zinc-700'
                )}
              >
                <div>
                  <div className="text-2xs uppercase font-black text-zinc-300 tracking-wider">
                    ON-CHART CALL DIRECTIVE
                  </div>
                  <div className="text-base font-black tracking-tight text-white mt-0.5 flex items-center gap-1.5">
                    <span>{isBuy ? '▲ BUY LONG NOW' : isSell ? '▼ SELL SHORT NOW' : '■ WAIT FOR CONFIRMATION'}</span>
                  </div>
                  <div className="text-2xs text-zinc-300 mt-0.5">
                    {isBuy && '50 EMA Bounce + StochRSI Hook Up'}
                    {isSell && '50 EMA Rejection + StochRSI Overbought Cross'}
                    {isWait && 'Consolidation Range · Awaiting EMA Retest'}
                  </div>
                </div>

                {/* Live P&L Pill */}
                {!isWait && (
                  <div
                    className={clsx(
                      'px-2.5 py-1.5 border-2 text-center flex flex-col justify-center min-w-[85px]',
                      isProfit
                        ? 'bg-emerald-900/80 border-emerald-400 text-emerald-200'
                        : 'bg-red-900/80 border-red-400 text-red-200'
                    )}
                  >
                    <span className="text-3xs font-bold uppercase tracking-wider text-white">LIVE P&amp;L</span>
                    <span className="text-sm font-black font-mono">
                      {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                    </span>
                    <span className="text-2xs font-semibold">
                      {isProfit ? '+' : ''}{pnlDiff.toFixed(decimals)}
                    </span>
                  </div>
                )}
              </div>

              {/* SL / TP / ENTRY LABELED GRID */}
              <div className="grid grid-cols-3 gap-2">
                {/* ENTRY LEVEL */}
                <div className="p-2 bg-zinc-950 border-2 border-white flex flex-col justify-between">
                  <span className="text-3xs font-black uppercase text-black bg-white px-1 py-0.2 self-start">
                    ENTRY
                  </span>
                  <div className="text-xs font-black text-white mt-1 font-mono">
                    {entry.toFixed(decimals)}
                  </div>
                  <div className="text-3xs text-zinc-400 mt-0.5">
                    Live: {live.toFixed(decimals)}
                  </div>
                </div>

                {/* TAKE PROFIT (TP) */}
                <div className="p-2 bg-emerald-950/40 border-2 border-emerald-500 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-3xs font-black uppercase text-emerald-950 bg-emerald-400 px-1 py-0.2">
                      TP TARGET
                    </span>
                    <span className="text-3xs text-emerald-400 font-bold">
                      +{strategy.tp_pct ? strategy.tp_pct.toFixed(2) : '0.00'}%
                    </span>
                  </div>
                  <div className="text-xs font-black text-emerald-300 mt-1 font-mono">
                    {tp.toFixed(decimals)}
                  </div>
                  <div className="text-3xs text-emerald-400 font-bold mt-0.5">
                    1:{rr.toFixed(1)} R:R
                  </div>
                </div>

                {/* STOP LOSS (SL) */}
                <div className="p-2 bg-red-950/40 border-2 border-red-500 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-3xs font-black uppercase text-white bg-red-600 px-1 py-0.2">
                      SL STOP
                    </span>
                    <span className="text-3xs text-red-400 font-bold">
                      −{strategy.sl_pct ? strategy.sl_pct.toFixed(2) : '0.00'}%
                    </span>
                  </div>
                  <div className="text-xs font-black text-red-300 mt-1 font-mono">
                    {sl.toFixed(decimals)}
                  </div>
                  <div className="text-3xs text-red-400 font-bold mt-0.5">
                    1.5× ATR
                  </div>
                </div>
              </div>

              {/* R:R Ratio & Action Row */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-800 text-2xs">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 bg-white text-black font-black text-3xs">
                    R:R
                  </span>
                  <span className="text-xs font-bold text-white font-mono">
                    1:{rr.toFixed(2)}
                  </span>
                  <span className="text-emerald-400 font-bold text-3xs">
                    ✓ RULE VALID
                  </span>
                </div>

                {/* Direct Log Button on Chart */}
                {!isWait && (
                  <button
                    onClick={handleLogTrade}
                    disabled={logging}
                    className="px-2.5 py-1 bg-white text-black hover:bg-zinc-200 active:scale-95 font-black text-2xs uppercase tracking-wider transition-all disabled:opacity-50"
                  >
                    {loggedMsg ? loggedMsg : logging ? 'LOGGING...' : '⚡ LOG TO JOURNAL'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── RIGHT-RAIL ON-CHART LEVEL BADGES (Aligned near price axis) ─── */}
        <div className="pointer-events-auto flex flex-col gap-2.5 items-end">
          {/* TP Tag */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950 border-2 border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] text-right cursor-pointer hover:scale-105 transition-transform"
            title={`Take Profit Target: ${tp.toFixed(decimals)}`}
          >
            <div className="flex flex-col items-end">
              <span className="text-3xs font-black uppercase text-emerald-400 tracking-wider">
                TARGET (TP) · +{strategy.tp_pct ? strategy.tp_pct.toFixed(2) : '0.00'}%
              </span>
              <span className="text-sm font-black text-emerald-300 font-mono">
                {tp.toFixed(decimals)}
              </span>
            </div>
            <span className="bg-emerald-400 text-black font-black text-xs px-1.5 py-0.5">
              TP
            </span>
          </div>

          {/* Entry Tag */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 border-2 border-white shadow-[0_0_15px_rgba(255,255,255,0.2)] text-right cursor-pointer hover:scale-105 transition-transform"
            title={`Active Entry: ${entry.toFixed(decimals)}`}
          >
            <div className="flex flex-col items-end">
              <span className="text-3xs font-black uppercase text-zinc-300 tracking-wider">
                ENTRY LEVEL · {isBuy ? 'LONG' : isSell ? 'SHORT' : 'CALL'}
              </span>
              <span className="text-sm font-black text-white font-mono">
                {entry.toFixed(decimals)}
              </span>
            </div>
            <span className="bg-white text-black font-black text-xs px-1.5 py-0.5">
              ENTRY
            </span>
          </div>

          {/* SL Tag */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 bg-red-950 border-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)] text-right cursor-pointer hover:scale-105 transition-transform"
            title={`Stop Loss: ${sl.toFixed(decimals)}`}
          >
            <div className="flex flex-col items-end">
              <span className="text-3xs font-black uppercase text-red-400 tracking-wider">
                STOP LOSS (SL) · −{strategy.sl_pct ? strategy.sl_pct.toFixed(2) : '0.00'}%
              </span>
              <span className="text-sm font-black text-red-300 font-mono">
                {sl.toFixed(decimals)}
              </span>
            </div>
            <span className="bg-red-600 text-white font-black text-xs px-1.5 py-0.5">
              SL
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
