// components/Panels/AIConfirmationPanel.tsx
// AI Decision Confirmation & Performance-Adaptive Strategy Tuning Panel

import clsx from 'clsx'
import type { StrategyResult } from '@/types'

interface Props {
  strategy: StrategyResult | undefined
  loading: boolean
}

export default function AIConfirmationPanel({ strategy, loading }: Props) {
  if (loading) return <Skeleton />

  if (!strategy || !strategy.ai_confirmation) {
    return (
      <div className="panel h-full flex items-center justify-center p-4">
        <span className="text-xs text-text-muted font-mono">Awaiting AI Evaluation…</span>
      </div>
    )
  }

  const ai = strategy.ai_confirmation
  const adaptive = strategy.adaptive_params

  const verdictStyles: Record<string, string> = {
    CONFIRMED: 'bg-white text-black border-white',
    CAUTION:   'bg-zinc-900 text-white border-zinc-500',
    VETOED:    'bg-black text-zinc-400 border-zinc-700 line-through',
    WAIT:      'bg-transparent text-zinc-500 border-zinc-800',
  }

  return (
    <div className="panel h-full flex flex-col overflow-hidden text-xs font-mono">
      <div className="panel-header flex items-center justify-between">
        <span>AI Decision Engine</span>
        <span className="text-2xs text-zinc-500">Self-Adapting</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Verdict & Confidence */}
        <div className="border border-border p-3 bg-black">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-text-muted uppercase">Verdict</span>
            <span className={clsx(
              'px-2 py-0.5 text-xs font-bold tracking-wider border',
              verdictStyles[ai.verdict] || verdictStyles.WAIT
            )}>
              {ai.verdict}
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-2xs text-text-muted uppercase">Confidence</span>
            <span className="text-xl font-bold text-white">{ai.confidence}%</span>
          </div>

          {/* Minimalist B&W Confidence Bar */}
          <div className="mt-1.5 h-1 bg-zinc-900 border border-zinc-800 w-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300"
              style={{ width: `${ai.confidence}%` }}
            />
          </div>

          <div className="mt-3 text-2xs text-zinc-300 border-t border-zinc-800 pt-2 leading-relaxed">
            {ai.action}
          </div>
        </div>

        {/* Adaptive Mode Status */}
        <div className="border border-border p-3 bg-zinc-950">
          <div className="flex items-center justify-between">
            <span className="text-2xs text-text-muted uppercase">Adaptive Mode</span>
            <span className="text-2xs font-bold text-white px-1.5 py-0.5 border border-zinc-700">
              {ai.adaptive_mode}
            </span>
          </div>

          <div className="mt-2 text-2xs text-zinc-400 leading-relaxed">
            {ai.journal_feedback}
          </div>

          {/* Active Adaptive Limits */}
          <div className="mt-3 grid grid-cols-3 gap-1.5 pt-2 border-t border-zinc-800/80 text-center">
            <div className="bg-black p-1.5 border border-zinc-800">
              <div className="text-2xs text-zinc-500">OVERSOLD</div>
              <div className="text-xs font-bold text-white">
                &lt;{ai.adaptive_thresholds.stoch_oversold}
              </div>
            </div>
            <div className="bg-black p-1.5 border border-zinc-800">
              <div className="text-2xs text-zinc-500">OVERBOUGHT</div>
              <div className="text-xs font-bold text-white">
                &gt;{ai.adaptive_thresholds.stoch_overbought}
              </div>
            </div>
            <div className="bg-black p-1.5 border border-zinc-800">
              <div className="text-2xs text-zinc-500">MIN R:R</div>
              <div className="text-xs font-bold text-white">
                1:{ai.adaptive_thresholds.min_rr.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* Position Sizing Advice */}
        <div className="border border-border p-2.5 bg-black flex items-center justify-between">
          <span className="text-2xs text-text-muted uppercase">Sizing Allocation</span>
          <span className="text-xs font-semibold text-white">{ai.sizing_advice}</span>
        </div>

        {/* AI Reasons Checklist */}
        {ai.reasons && ai.reasons.length > 0 && (
          <div className="border border-border p-3 bg-zinc-950 space-y-1.5">
            <div className="text-2xs text-text-muted uppercase tracking-wider mb-1">
              AI Confluence Points
            </div>
            {ai.reasons.map((r, i) => (
              <div key={i} className="text-2xs text-zinc-300 flex items-start gap-1.5 leading-snug">
                <span className="text-white font-bold">[+]</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        )}

        {/* AI Warnings Checklist */}
        {ai.warnings && ai.warnings.length > 0 && (
          <div className="border border-border p-3 bg-black space-y-1.5">
            <div className="text-2xs text-zinc-400 uppercase tracking-wider mb-1">
              Risk Warnings / Veto Factors
            </div>
            {ai.warnings.map((w, i) => (
              <div key={i} className="text-2xs text-zinc-400 flex items-start gap-1.5 leading-snug">
                <span className="text-zinc-200 font-bold">[!]</span>
                <span>{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="panel h-full p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-zinc-800 w-28" />
      <div className="h-24 bg-zinc-900" />
      <div className="h-20 bg-zinc-900" />
      <div className="h-28 bg-zinc-900" />
    </div>
  )
}
