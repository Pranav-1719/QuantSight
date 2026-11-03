// components/Panels/StatArbPanel.tsx
// QuantConnect PcaStatArbitrageAlgorithm Implementation
// Demeaned Log-Prices, 3-Component PCA, statsmodels OLS Residual Z-Score Rebalancing

import { useState } from 'react'
import clsx from 'clsx'
import type { StrategyResult, StatArbTargetPosition } from '@/types'
import { useStatArbUniverse } from '@/hooks/useData'
import { createJournalTrade } from '@/api/client'

interface Props {
  strategy: StrategyResult | undefined
  category: string
  currentSymbol: string
  onLogSuccess?: () => void
}

const CATEGORY_MAP: Record<string, string> = {
  Forex: 'Forex',
  India: 'India_Top',
  Crypto: 'Crypto',
  Commodity: 'US_Top20',
}

export default function StatArbPanel({ strategy, category, currentSymbol, onLogSuccess }: Props) {
  const initialCat = CATEGORY_MAP[category] || 'US_Top20'
  const [activeCategory, setActiveCategory] = useState<string>(initialCat)
  const [logging, setLogging] = useState(false)
  const [loggedMsg, setLoggedMsg] = useState<string | null>(null)

  const { data: statarbData, isLoading, refetch } = useStatArbUniverse(activeCategory)
  const symbolData = strategy?.statarb?.symbol_data

  const handleLogTarget = async (target: StatArbTargetPosition) => {
    try {
      setLogging(true)
      const isBuy = target.action === 'BUY_LONG' || target.status === 'SIGNAL_BUY'
      const slDist = target.current_price * 0.025
      const sl = isBuy ? target.current_price - slDist : target.current_price + slDist
      const tp = target.fair_price || (isBuy ? target.current_price * 1.05 : target.current_price * 0.95)

      await createJournalTrade({
        symbol: target.symbol,
        direction: isBuy ? 'BUY' : 'SELL',
        entry_price: target.current_price,
        sl_price: Math.round(sl * 10000) / 10000,
        tp_price: Math.round(tp * 10000) / 10000,
        rr_ratio: 2.0,
        lot_size: 1.0,
        ai_verdict: 'PCA_STATARB_CONFIRMED',
        ai_confidence: 88.0,
        strategy_notes: `QuantConnect PCA Stat-Arb: Target Weight ${target.target_weight_pct || 0}%, Residual Z-Score ${target.z_score} (< -1.5). Reversion to factor fair value.`,
      })
      setLoggedMsg(`Logged ${target.symbol} (${target.target_weight_pct || 0}%) to Journal`)
      setTimeout(() => setLoggedMsg(null), 3500)
      if (onLogSuccess) onLogSuccess()
    } catch (e: any) {
      alert('Failed to log trade: ' + e.message)
    } finally {
      setLogging(false)
    }
  }

  const handleLogAllTargets = async () => {
    if (!statarbData?.portfolio_targets?.length) return
    try {
      setLogging(true)
      for (const t of statarbData.portfolio_targets) {
        const isBuy = t.action === 'BUY_LONG'
        const slDist = t.current_price * 0.025
        const sl = isBuy ? t.current_price - slDist : t.current_price + slDist
        await createJournalTrade({
          symbol: t.symbol,
          direction: isBuy ? 'BUY' : 'SELL',
          entry_price: t.current_price,
          sl_price: Math.round(sl * 10000) / 10000,
          tp_price: Math.round(t.fair_price * 10000) / 10000,
          rr_ratio: 2.0,
          lot_size: Math.max(0.1, Math.round((t.target_weight_pct / 100) * 10) / 10),
          ai_verdict: 'PCA_REBALANCE_BASKET',
          ai_confidence: 90.0,
          strategy_notes: `QC Stat-Arb Monthly Rebalance: Target Weight ${t.target_weight_pct}%, Z: ${t.z_score}.`,
        })
      }
      setLoggedMsg(`Logged all ${statarbData.portfolio_targets.length} rebalance targets to Journal`)
      setTimeout(() => setLoggedMsg(null), 4000)
      if (onLogSuccess) onLogSuccess()
    } catch (e: any) {
      alert('Failed to log targets: ' + e.message)
    } finally {
      setLogging(false)
    }
  }

  const targets = statarbData?.portfolio_targets || []
  const shortTargets = statarbData?.short_targets || []

  return (
    <div className="panel h-full flex flex-col overflow-hidden text-xs font-mono">
      {/* Header */}
      <div className="panel-header flex items-center justify-between">
        <span>QuantConnect PCA Stat-Arb</span>
        <span className="text-2xs text-zinc-500">Daniel Chen Strategy</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Strategy Specification Box */}
        <div className="border border-border p-2.5 bg-black space-y-1.5 text-2xs">
          <div className="flex items-center justify-between text-zinc-400">
            <span>ALGORITHM CONFIGURATION</span>
            <span className="text-white font-bold">MONTHLY REBALANCE</span>
          </div>
          <div className="grid grid-cols-3 gap-1 pt-1 text-center">
            <div className="border border-zinc-800 p-1 bg-zinc-950">
              <span className="text-zinc-500">LOOKBACK</span>
              <div className="font-bold text-white">60 Days</div>
            </div>
            <div className="border border-zinc-800 p-1 bg-zinc-950">
              <span className="text-zinc-500">FACTORS</span>
              <div className="font-bold text-white">3 PCA</div>
            </div>
            <div className="border border-zinc-800 p-1 bg-zinc-950">
              <span className="text-zinc-500">TRIGGER</span>
              <div className="font-bold text-white">Z &lt; -1.5</div>
            </div>
          </div>
          <div className="text-zinc-500 pt-0.5">
            Demeaned log-prices fitted via statsmodels OLS. Weights normalized to 95% equity exposure (5% cash buffer).
          </div>
        </div>

        {/* Category Switcher */}
        <div className="flex border border-border bg-black">
          {[
            { key: 'US_Top20', label: 'US Top 20' },
            { key: 'India_Top', label: 'NIFTY Top' },
            { key: 'Forex', label: 'Forex' },
            { key: 'Crypto', label: 'Crypto' },
          ].map(c => (
            <button
              key={c.key}
              onClick={() => setActiveCategory(c.key)}
              className={clsx(
                'flex-1 py-1.5 text-2xs uppercase tracking-wider font-bold transition-colors border-r last:border-r-0 border-border',
                activeCategory === c.key
                  ? 'bg-white text-black'
                  : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Triggered Portfolio Targets Box */}
        <div className="border border-border p-3 bg-zinc-950 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xs uppercase text-text-muted">
              Triggered Rebalance Targets (Z &lt; -1.5)
            </span>
            <span className={clsx(
              'px-1.5 py-0.2 text-2xs font-bold border',
              targets.length > 0 ? 'bg-white text-black border-white' : 'border-zinc-800 text-zinc-600'
            )}>
              {targets.length} SELECTED
            </span>
          </div>

          {isLoading ? (
            <div className="py-4 text-center text-zinc-500 animate-pulse text-2xs">
              Decomposing PCA factors &amp; running OLS regressions...
            </div>
          ) : targets.length === 0 ? (
            <div className="border border-zinc-800 p-3 text-center text-zinc-500 text-2xs">
              No asset currently below the -1.5σ entry threshold in this universe.
              <div className="text-zinc-600 mt-1">Holding 100% cash buffer until next divergence.</div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {targets.map((t: StatArbTargetPosition) => (
                <div
                  key={t.symbol}
                  className="border border-zinc-800 bg-black p-2 flex items-center justify-between text-2xs"
                >
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      <span>{t.symbol}</span>
                      <span className="text-2xs bg-white text-black px-1 font-bold">
                        {t.target_weight_pct}% WEIGHT
                      </span>
                    </div>
                    <div className="text-zinc-400 mt-0.5">
                      P: {t.current_price} → Fair: {t.fair_price} ({t.expected_return_pct > 0 ? `+${t.expected_return_pct}%` : `${t.expected_return_pct}%`})
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="font-bold text-white">Z = {t.z_score}</div>
                      <div className="text-zinc-500">R² {t.r2_fit}</div>
                    </div>
                    <button
                      onClick={() => handleLogTarget(t)}
                      disabled={logging}
                      className="px-2 py-1 bg-white text-black font-bold text-2xs border border-white hover:bg-zinc-200"
                    >
                      LOG
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={handleLogAllTargets}
                disabled={logging}
                className="w-full py-1.5 text-xs font-bold uppercase tracking-wider bg-white text-black border border-white hover:bg-zinc-200 transition-colors mt-2"
              >
                {logging ? 'RECORDING BASKET...' : 'EXECUTE REBALANCE → LOG ALL TO JOURNAL'}
              </button>
            </div>
          )}

          {loggedMsg && (
            <div className="text-2xs text-white bg-black border border-zinc-700 p-1.5 text-center font-bold">
              ✓ {loggedMsg}
            </div>
          )}
        </div>

        {/* Short Candidates (Overextended Z > +1.5) */}
        {shortTargets.length > 0 && (
          <div className="border border-border p-3 bg-black space-y-2">
            <div className="flex items-center justify-between text-2xs">
              <span className="text-zinc-400 uppercase">Short Candidates (Z &gt; +1.5)</span>
              <span className="text-zinc-400 border border-zinc-700 px-1">{shortTargets.length} EXTENDED</span>
            </div>
            <div className="space-y-1">
              {shortTargets.map((s: StatArbTargetPosition) => (
                <div key={s.symbol} className="border border-zinc-800 p-2 flex items-center justify-between text-2xs">
                  <div>
                    <div className="font-bold text-zinc-200">{s.symbol}</div>
                    <div className="text-zinc-500">Current {s.current_price} vs Fair {s.fair_price}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-zinc-300 font-bold">Z = +{s.z_score}</div>
                    <button
                      onClick={() => handleLogTarget({ ...s, status: 'SIGNAL_SHORT' })}
                      className="text-2xs text-zinc-400 border border-zinc-700 px-1.5 py-0.5 hover:text-white mt-0.5"
                    >
                      LOG SHORT
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Universe Cross-Sectional Ranking Table */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-2xs">
            <span className="text-text-muted uppercase">Universe Factor Rankings</span>
            {statarbData?.success && (
              <span className="text-zinc-500">
                PCA Var: {statarbData.total_variance_explained}% ({statarbData.factor_variance_ratios?.join('% / ')}%)
              </span>
            )}
          </div>

          {statarbData?.universe_rankings?.length ? (
            <div className="border border-border divide-y divide-zinc-900 bg-black max-h-56 overflow-y-auto">
              {statarbData.universe_rankings.map((r: any) => {
                const isBuy = r.status === 'SIGNAL_BUY'
                const isShort = r.status === 'SIGNAL_SHORT'
                return (
                  <div
                    key={r.symbol}
                    className="p-2 hover:bg-zinc-950 transition-colors flex items-center justify-between text-2xs"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span>{r.symbol}</span>
                        {isBuy && (
                          <span className="px-1 py-0.2 text-2xs bg-white text-black font-bold">
                            BUY
                          </span>
                        )}
                        {isShort && (
                          <span className="px-1 py-0.2 text-2xs border border-zinc-600 text-zinc-300 font-bold">
                            SHORT
                          </span>
                        )}
                      </div>
                      <div className="text-zinc-500">
                        P: {r.current_price} · Fair: {r.fair_price} ({r.deviation_pct > 0 ? `+${r.deviation_pct}%` : `${r.deviation_pct}%`})
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={clsx('font-bold', isBuy ? 'text-white' : isShort ? 'text-zinc-300' : 'text-zinc-600')}>
                        Z = {r.z_score > 0 ? `+${r.z_score}` : r.z_score}
                      </div>
                      <div className="text-zinc-500 text-2xs">
                        R² {r.r2_fit}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
