// components/Panels/MultiTimeframePanel.tsx
// Top-down MTF analysis: Daily → 4H → 1H → 15m (Minimalist B&W)

import clsx from 'clsx'
import type { MTFResult, TFResult } from '@/types'
import { stochStateLabel } from '@/utils/chartUtils'

interface Props { mtf: MTFResult | undefined; loading: boolean }

const TF_LABELS: { key: keyof Omit<MTFResult, 'overall'>; label: string; role: string }[] = [
  { key: 'daily', label: '1D',  role: 'Macro Trend'     },
  { key: 'h4',    label: '4H',  role: 'Trend Direction' },
  { key: 'h1',    label: '1H',  role: 'Confirm Entry'   },
  { key: 'm15',   label: '15m', role: 'Early Entry'     },
]

function TFRow({ label, role, tf }: { label: string; role: string; tf: TFResult | undefined }) {
  if (!tf) return null
  const stoch = stochStateLabel(tf.stoch_state ?? 'UNKNOWN')
  const isBull = tf.signal?.includes('BUY')
  const isBear = tf.signal?.includes('SELL')

  return (
    <div className="flex items-center gap-2 py-2 border-b border-border last:border-0 text-xs font-mono">
      {/* TF label */}
      <div className="w-8 flex-shrink-0">
        <div className="font-bold text-white">{label}</div>
        <div className="text-2xs text-zinc-500">{role}</div>
      </div>

      {/* Stoch bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5 text-2xs">
          <span className="text-zinc-300 font-bold">{stoch.label}</span>
          <span className="text-zinc-500">
            K {(tf.stoch_k ?? 0).toFixed(0)} / D {(tf.stoch_d ?? 0).toFixed(0)}
          </span>
        </div>
        <div className="h-1 bg-zinc-900 border border-zinc-800 overflow-hidden">
          <div
            className="h-full bg-white"
            style={{ width: `${Math.min(100, Math.max(0, tf.stoch_k ?? 0))}%` }}
          />
        </div>
      </div>

      {/* Signal badge */}
      <div className={clsx(
        'px-2 py-0.5 text-2xs font-bold border flex-shrink-0',
        isBull
          ? 'bg-white text-black border-white'
          : isBear
          ? 'bg-zinc-900 text-white border-zinc-700'
          : 'bg-transparent text-zinc-500 border-zinc-800'
      )}>
        {isBull ? 'BULL' : isBear ? 'BEAR' : 'WAIT'}
      </div>
    </div>
  )
}

export default function MultiTimeframePanel({ mtf, loading }: Props) {
  if (loading) return (
    <div className="panel h-full animate-pulse p-3 space-y-3">
      <div className="h-3 w-32 bg-zinc-800" />
      {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-zinc-900" />)}
    </div>
  )

  if (!mtf) return (
    <div className="panel h-full flex items-center justify-center p-4">
      <span className="text-xs text-text-muted font-mono">No MTF data</span>
    </div>
  )

  const overall = mtf.overall

  return (
    <div className="panel h-full flex flex-col overflow-hidden text-xs font-mono">
      <div className="panel-header flex items-center justify-between">
        <span>Multi-Timeframe Engine</span>
        <span className="text-2xs text-zinc-500">Top-Down Alignment</span>
      </div>

      {/* Overall bias */}
      <div className="p-3">
        <div className="p-2.5 bg-black border border-border flex items-center justify-between">
          <div>
            <div className="text-2xs text-text-muted uppercase">Macro Bias (1D + 4H)</div>
            <div className="text-sm font-bold text-white mt-0.5">
              {overall?.bias ?? '—'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xs text-text-muted uppercase">Permitted Calls</div>
            <div className="text-xs font-bold text-zinc-200 mt-0.5">
              {overall?.allowed_calls ?? '—'}
            </div>
          </div>
        </div>
      </div>

      {/* TF rows */}
      <div className="px-3 pb-3 flex-1 overflow-auto">
        {TF_LABELS.map(({ key, label, role }) => (
          <TFRow
            key={key}
            label={label}
            role={role}
            tf={mtf[key] as TFResult | undefined}
          />
        ))}
      </div>

      {/* Hierarchy Rule */}
      <div className="p-3 pt-0">
        <div className="text-2xs text-zinc-400 p-2 bg-black border border-border space-y-0.5">
          <div>▸ D + 4H define the structural trade bias</div>
          <div>▸ 1H confirms trend continuity</div>
          <div>▸ 15m determines tight entry near 50 EMA</div>
        </div>
      </div>
    </div>
  )
}
