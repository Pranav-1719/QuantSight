// components/Panels/SignalPanel.tsx — Minimalist Monochromatic Signal + StochRSI Reading

import clsx from 'clsx'
import type { StrategyResult } from '@/types'
import { stochStateLabel } from '@/utils/chartUtils'

interface Props { strategy: StrategyResult | undefined; loading: boolean }

export default function SignalPanel({ strategy, loading }: Props) {
  if (loading) return <Skeleton />

  if (!strategy) return (
    <div className="panel h-full flex items-center justify-center p-4">
      <span className="text-xs text-text-muted font-mono">No signal data</span>
    </div>
  )

  const sig = strategy.signal
  const display = strategy.signal_display
  const ha = strategy.ha_pattern
  const stoch = stochStateLabel(strategy.stoch_state)

  const isBuy = sig.includes('BUY')
  const isSell = sig.includes('SELL')

  return (
    <div className="panel h-full flex flex-col overflow-hidden text-xs font-mono">
      <div className="panel-header flex items-center justify-between">
        <span>Strategy Engine</span>
        <span className="text-2xs text-zinc-500">50 EMA + StochRSI</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Main signal badge */}
        <div className="p-3 bg-black border border-border flex items-center justify-between">
          <div>
            <div className={clsx(
              'font-mono font-bold text-xl tracking-widest inline-block px-2 py-0.5 border',
              isBuy
                ? 'bg-white text-black border-white'
                : isSell
                ? 'bg-zinc-900 text-white border-zinc-600'
                : 'bg-transparent text-zinc-400 border-zinc-800'
            )}>
              {display.label}
            </div>
            <div className="text-2xs text-text-muted mt-1 font-mono">Active Strategy Directive</div>
          </div>

          <div className="text-right">
            <div className="text-2xs font-mono font-bold px-1.5 py-0.5 border border-zinc-700 bg-zinc-950 text-white">
              {stoch.label}
            </div>
            <div className="text-2xs text-zinc-500 mt-1">Stoch Zone</div>
          </div>
        </div>

        {/* StochRSI reading */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-black border border-border p-2.5">
            <div className="metric-label mb-1">STOCHRSI %K</div>
            <div className="font-mono text-lg font-bold text-white">
              {strategy.stoch_k.toFixed(1)}
            </div>
            <div className="mt-1 h-1 bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${Math.min(100, Math.max(0, strategy.stoch_k))}%` }}
              />
            </div>
          </div>

          <div className="bg-black border border-border p-2.5">
            <div className="metric-label mb-1">STOCHRSI %D</div>
            <div className="font-mono text-lg font-bold text-zinc-400">
              {strategy.stoch_d.toFixed(1)}
            </div>
            <div className="mt-1 h-1 bg-zinc-900 border border-zinc-800 overflow-hidden">
              <div
                className="h-full bg-zinc-500 transition-all"
                style={{ width: `${Math.min(100, Math.max(0, strategy.stoch_d))}%` }}
              />
            </div>
          </div>
        </div>

        {/* EMA proximity */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-black border border-border p-2.5">
            <div className="metric-label mb-1">50 EMA LEVEL</div>
            <div className="metric-value text-white font-mono">{strategy.ema50.toFixed(5)}</div>
          </div>
          <div className="bg-black border border-border p-2.5">
            <div className="metric-label mb-1">PRICE VS EMA</div>
            <div className="metric-value text-white font-mono">
              {strategy.price_above_ema ? '↑ ABOVE' : '↓ BELOW'}
            </div>
          </div>
        </div>

        {/* Near EMA indicator */}
        <div className="bg-black border border-border p-2.5 flex items-center justify-between">
          <span className="metric-label">EMA Support / Resistance Test</span>
          <span className={clsx('text-xs font-mono font-bold', strategy.near_ema ? 'text-white' : 'text-zinc-600')}>
            {strategy.near_ema ? '● IN SUPPORT ZONE' : '○ EXTENDED'}
          </span>
        </div>

        {/* HA Pattern */}
        <div className="border border-border p-2.5 bg-black">
          <div className="metric-label mb-1">Heikin Ashi Confirmation Pattern</div>
          <div className="text-xs font-mono text-zinc-200">
            {ha.pattern}
          </div>
        </div>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="panel h-full flex flex-col gap-3 p-3 animate-pulse">
      <div className="h-3 w-24 bg-border" />
      <div className="h-16 bg-zinc-900" />
      <div className="h-10 bg-zinc-900" />
      <div className="h-10 bg-zinc-900" />
    </div>
  )
}
