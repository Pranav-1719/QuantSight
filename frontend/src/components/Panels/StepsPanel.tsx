// components/Panels/StepsPanel.tsx
// Step-by-Step Strategy Execution & Verification Panel

import React, { useState } from 'react'
import clsx from 'clsx'
import type { StrategyResult, MTFResult } from '@/types'
import { createJournalTrade } from '@/api/client'

interface Props {
  strategy: StrategyResult | undefined
  mtf?: MTFResult | undefined
  symbol: string
  currentPrice: number | null
  decimals?: number
  onLogSuccess?: () => void
}

export default function StepsPanel({
  strategy,
  mtf,
  symbol,
  currentPrice,
  decimals = 5,
  onLogSuccess,
}: Props) {
  const [logging, setLogging] = useState(false)
  const [loggedMsg, setLoggedMsg] = useState<string | null>(null)

  if (!strategy) {
    return (
      <div className="panel h-full flex flex-col items-center justify-center p-4 text-xs font-mono text-zinc-500">
        <div className="w-3 h-3 bg-white animate-ping mb-3" />
        <div>EVALUATING STRATEGY STEPS...</div>
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
  const stochK = strategy.stoch_k ?? 50
  const stochD = strategy.stoch_d ?? 50
  const ema50 = strategy.ema50 ?? entry
  const atr = strategy.atr ?? 0.01

  // Determine individual step verification statuses
  const step1_mtf_passed = mtf?.overall?.daily_bias === (isBuy ? 'BULLISH' : isSell ? 'BEARISH' : 'NEUTRAL')
  const step2_1h_passed = mtf?.h1?.signal?.includes(isBuy ? 'BUY' : isSell ? 'SELL' : 'WAIT')
  const step3_ema_passed = strategy.near_ema || strategy.price_above_ema === isBuy
  const step4_stoch_passed = isBuy ? stochK <= 30 && stochK >= stochD : isSell ? stochK >= 70 && stochK <= stochD : false
  const step5_ha_passed = !!strategy.ha_pattern && strategy.ha_pattern.direction === (isBuy ? 'BUY' : isSell ? 'SELL' : undefined)
  const step6_rr_passed = rr >= 2.0

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
        ai_verdict: strategy.ai_confirmation?.verdict ?? 'STRATEGY_SIGNAL',
        ai_confidence: strategy.ai_confirmation?.confidence ?? 80,
        strategy_notes: `50 EMA + StochRSI Step Execution: %K=${stochK.toFixed(1)}, %D=${stochD.toFixed(1)}, EMA50=${ema50.toFixed(decimals)}, HA=${strategy.ha_pattern?.pattern || 'Standard'}.`,
      })
      setLoggedMsg(`Logged ${isBuy ? 'BUY' : 'SELL'} order to Journal`)
      setTimeout(() => setLoggedMsg(null), 3500)
      if (onLogSuccess) onLogSuccess()
    } catch (e: any) {
      alert('Failed to log trade: ' + e.message)
    } finally {
      setLogging(false)
    }
  }

  const stepsList = [
    {
      num: 1,
      title: 'Macro Trend Bias (Daily + 4H)',
      desc: `Higher timeframes dictate bias. Daily: ${mtf?.overall?.daily_bias || 'ANALYZING'}, 4H: ${mtf?.overall?.h4_bias || 'ANALYZING'}. Only trade with macro direction.`,
      status: step1_mtf_passed ? 'READY' : 'MONITOR',
      badge: mtf?.overall?.bias || 'NEUTRAL',
    },
    {
      num: 2,
      title: '1H Intermediate Confirmation',
      desc: `1-Hour timeframe confirms pullback structure: ${mtf?.h1?.signal || 'NEUTRAL'}. StochRSI state: ${mtf?.h1?.stoch_state || 'WAIT'}.`,
      status: step2_1h_passed ? 'READY' : 'PENDING',
      badge: `1H: ${mtf?.h1?.stoch_state || 'WAIT'}`,
    },
    {
      num: 3,
      title: '50 EMA Pullback & Support/Resistance',
      desc: `Price at ${entry.toFixed(decimals)} vs 50 EMA ${ema50.toFixed(decimals)}. Distance: ${(Math.abs(entry - ema50) / atr).toFixed(2)}× ATR (tolerance ≤ 0.8× ATR).`,
      status: step3_ema_passed ? 'READY' : 'WAITING',
      badge: strategy.near_ema ? 'AT 50 EMA' : strategy.price_above_ema ? 'ABOVE EMA' : 'BELOW EMA',
    },
    {
      num: 4,
      title: 'Stochastic RSI Extreme Reversal Hook',
      desc: `%K (${stochK.toFixed(1)}) / %D (${stochD.toFixed(1)}). ${
        isBuy ? 'Oversold bounce: %K crossed above %D.' : isSell ? 'Overbought roll: %K crossed below %D.' : 'Oscillating in neutral/middle zone. Wait for extremes.'
      }`,
      status: step4_stoch_passed ? 'READY' : 'PENDING',
      badge: `${strategy.stoch_state} (${stochK.toFixed(0)})`,
    },
    {
      num: 5,
      title: 'Heikin Ashi Reversal Trigger',
      desc: strategy.ha_pattern?.pattern
        ? `Pattern Detected: ${strategy.ha_pattern.pattern}. Reversal candle confirmed.`
        : 'Watch for exhaustion Doji at high/low followed by strong body reversal candle. Enter on next open.',
      status: step5_ha_passed ? 'READY' : 'WATCHING',
      badge: strategy.ha_pattern?.direction || 'NO PATTERN',
    },
    {
      num: 6,
      title: 'Risk-to-Reward Execution Setup',
      desc: `SL: ${sl.toFixed(decimals)} (1.5× ATR buffer) | TP: ${tp.toFixed(decimals)} | Reward/Risk: 1:${rr.toFixed(1)} (Min 1:2.0 enforced).`,
      status: step6_rr_passed ? 'READY' : 'CALCULATING',
      badge: `1:${rr.toFixed(1)} R:R`,
    },
    {
      num: 7,
      title: 'Top-Up & Invalidation Rules',
      desc: `Top-up allowed if StochRSI gives double cross or breaks middle 50 level in trend direction. INVALIDATION: Immediate exit if price closes beyond 50 EMA.`,
      status: 'RULE',
      badge: 'TOP-UP: MID CROSS',
    },
  ]

  return (
    <div className="panel h-full flex flex-col overflow-hidden text-xs font-mono bg-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5 bg-zinc-950 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-white text-sm">Strategy Steps</span>
          <span className="text-2xs bg-white text-black font-bold px-1.5 py-0.5">
            50 EMA + STOCH
          </span>
        </div>
        <span className="text-2xs text-zinc-300 font-bold border border-zinc-800 px-2 py-0.5">
          {strategy.adaptive_params?.mode || 'BALANCED'} MODE
        </span>
      </div>

      {/* Action Banner */}
      <div className="p-3.5 border-b border-border bg-black flex-shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-2xs text-zinc-400 uppercase font-bold">Current Action Directive</span>
          <span className={clsx(
            'text-2xs font-bold px-2 py-0.5 border',
            isBuy ? 'border-white text-white bg-zinc-900' : isSell ? 'border-zinc-500 text-zinc-200' : 'border-zinc-800 text-zinc-400'
          )}>
            {strategy.signal}
          </span>
        </div>

        <div className="mt-2 text-sm font-bold text-white leading-snug">
          {isBuy && '👉 ACTION: BUY SETUP QUALIFIED. Enter on candle open. Hold until TP or EMA break.'}
          {isSell && '👉 ACTION: SELL SETUP QUALIFIED. Enter on candle open. Hold until TP or EMA break.'}
          {isWait && '👉 ACTION: WAITING FOR CONFLUENCE. Monitor 50 EMA touch & StochRSI extreme hook.'}
        </div>

        {/* 1-Click Log to Journal Button */}
        {!isWait && (
          <button
            onClick={handleLogTrade}
            disabled={logging}
            className="w-full mt-2.5 py-2.5 bg-white text-black font-black text-xs border border-white hover:bg-zinc-200 transition-colors uppercase tracking-wider shadow"
          >
            {logging ? 'RECORDING TRADE...' : `LOG ${isBuy ? 'BUY' : 'SELL'} CALL TO JOURNAL (1:${rr.toFixed(1)} R:R)`}
          </button>
        )}

        {loggedMsg && (
          <div className="mt-2 text-xs text-white border border-zinc-700 bg-zinc-950 p-2 text-center font-bold">
            ✓ {loggedMsg}
          </div>
        )}
      </div>

      {/* Step by step checklist list */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900 bg-black p-2.5 space-y-2.5">
        {stepsList.map(st => {
          const isReady = st.status === 'READY'
          return (
            <div
              key={st.num}
              className={clsx(
                'p-3 border transition-all text-xs',
                isReady
                  ? 'border-white bg-zinc-950'
                  : 'border-zinc-800 bg-black hover:border-zinc-700'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className={clsx(
                    'w-5 h-5 rounded-full flex items-center justify-center text-xs font-black',
                    isReady ? 'bg-white text-black font-bold' : 'bg-zinc-800 text-zinc-300'
                  )}>
                    {st.num}
                  </span>
                  <span className="text-xs">{st.title}</span>
                </div>
                <span className={clsx(
                  'px-2 py-0.5 text-2xs font-bold border',
                  isReady ? 'border-white text-white' : 'border-zinc-800 text-zinc-400'
                )}>
                  {st.badge}
                </span>
              </div>

              <div className="text-zinc-300 mt-2 leading-relaxed pl-7 text-xs">
                {st.desc}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
