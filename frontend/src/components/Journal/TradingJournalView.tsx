// components/Journal/TradingJournalView.tsx
// Minimalist Black & White Trading Journal
// Performance Tracking, Persistent Trade Logs, and AI Strategy Adaptation Feedback

import { useState } from 'react'
import clsx from 'clsx'
import { useJournalTrades, useJournalStats, useAdaptiveParams } from '@/hooks/useData'
import { createJournalTrade, updateJournalTrade, deleteJournalTrade } from '@/api/client'
import type { JournalTrade } from '@/types'

export default function TradingJournalView() {
  const [filter, setFilter] = useState<string>('ALL')
  const [showAddModal, setShowAddModal] = useState(false)
  const [closingTrade, setClosingTrade] = useState<JournalTrade | null>(null)
  const [exitPriceInput, setExitPriceInput] = useState<string>('')

  // Form states for adding manual trade
  const [newSymbol, setNewSymbol] = useState('EURUSD=X')
  const [newDirection, setNewDirection] = useState<'BUY' | 'SELL'>('BUY')
  const [newEntry, setNewEntry] = useState('')
  const [newSL, setNewSL] = useState('')
  const [newTP, setNewTP] = useState('')
  const [newLots, setNewLots] = useState('1.0')
  const [newNotes, setNewNotes] = useState('')

  const { data: trades, refetch: refetchTrades, isLoading } = useJournalTrades(filter)
  const { data: stats, refetch: refetchStats } = useJournalStats()
  const { data: adaptive, refetch: refetchAdaptive } = useAdaptiveParams()

  const refreshAll = () => {
    refetchTrades()
    refetchStats()
    refetchAdaptive()
  }

  const handleCreateTrade = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEntry || !newSL || !newTP) {
      alert('Please fill in entry, SL, and TP prices.')
      return
    }

    const entry = parseFloat(newEntry)
    const sl = parseFloat(newSL)
    const tp = parseFloat(newTP)
    const risk = Math.abs(entry - sl)
    const reward = Math.abs(tp - entry)
    const rr = risk > 0 ? reward / risk : 2.0

    try {
      await createJournalTrade({
        symbol: newSymbol.trim().toUpperCase(),
        direction: newDirection,
        entry_price: entry,
        sl_price: sl,
        tp_price: tp,
        rr_ratio: Math.round(rr * 100) / 100,
        lot_size: parseFloat(newLots) || 1.0,
        strategy_notes: newNotes,
        ai_verdict: 'MANUAL_ENTRY',
      })
      setShowAddModal(false)
      setNewEntry('')
      setNewSL('')
      setNewTP('')
      setNewNotes('')
      refreshAll()
    } catch (err: any) {
      alert('Failed to log trade: ' + err.message)
    }
  }

  const handleCloseTrade = async () => {
    if (!closingTrade || !exitPriceInput) return
    const exit = parseFloat(exitPriceInput)
    if (isNaN(exit)) return

    try {
      await updateJournalTrade(closingTrade.id, {
        exit_price: exit,
      })
      setClosingTrade(null)
      setExitPriceInput('')
      refreshAll()
    } catch (err: any) {
      alert('Failed to close trade: ' + err.message)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(`Delete trade #${id} from journal?`)) return
    try {
      await deleteJournalTrade(id)
      refreshAll()
    } catch (err: any) {
      alert('Failed to delete trade: ' + err.message)
    }
  }

  return (
    <div className="flex flex-col h-full bg-black text-white font-mono overflow-hidden">
      {/* ── Top Performance & AI Adaptation Strip ── */}
      <div className="border-b border-border p-4 bg-zinc-950 grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Net P&L */}
        <div className="border border-border p-3 bg-black">
          <div className="text-2xs text-text-muted uppercase">Net Realized P&amp;L</div>
          <div className="text-xl font-bold tracking-tight text-white mt-1">
            {stats ? (stats.total_pnl >= 0 ? `+$${stats.total_pnl.toFixed(2)}` : `-$${Math.abs(stats.total_pnl).toFixed(2)}`) : '—'}
          </div>
          <div className="text-2xs text-zinc-500 mt-0.5">
            Profit Factor: {stats?.profit_factor ?? 0}
          </div>
        </div>

        {/* Win Rate */}
        <div className="border border-border p-3 bg-black">
          <div className="text-2xs text-text-muted uppercase">Win Rate</div>
          <div className="text-xl font-bold tracking-tight text-white mt-1">
            {stats ? `${stats.win_rate}%` : '—'}
          </div>
          <div className="text-2xs text-zinc-500 mt-0.5">
            {stats?.win_count ?? 0} Won / {stats?.loss_count ?? 0} Lost
          </div>
        </div>

        {/* Total Trades */}
        <div className="border border-border p-3 bg-black">
          <div className="text-2xs text-text-muted uppercase">Trades Executed</div>
          <div className="text-xl font-bold tracking-tight text-white mt-1">
            {stats?.total_trades ?? 0}
          </div>
          <div className="text-2xs text-zinc-500 mt-0.5">
            {stats?.open_trades ?? 0} Open / {stats?.closed_trades ?? 0} Closed
          </div>
        </div>

        {/* Current Streak */}
        <div className="border border-border p-3 bg-black">
          <div className="text-2xs text-text-muted uppercase">Current Streak</div>
          <div className="text-xl font-bold tracking-tight text-white mt-1">
            {stats?.current_streak ? `${stats.current_streak} ${stats.streak_type}` : 'None'}
          </div>
          <div className="text-2xs text-zinc-500 mt-0.5">
            Avg R:R: 1:{stats?.avg_rr ?? 2.0}
          </div>
        </div>

        {/* Active AI Adaptation Mode */}
        <div className="border border-border p-3 bg-black col-span-2 md:col-span-1">
          <div className="text-2xs text-text-muted uppercase">AI Strategy Mode</div>
          <div className="text-sm font-bold tracking-wider text-white mt-1 px-1.5 py-0.5 border border-zinc-700 inline-block">
            {adaptive?.mode ?? 'CALIBRATING'}
          </div>
          <div className="text-2xs text-zinc-400 mt-1 truncate" title={adaptive?.description}>
            {adaptive?.description ?? 'Learning from trade outcomes...'}
          </div>
        </div>
      </div>

      {/* ── Action & Filter Bar ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-black">
        <div className="flex items-center gap-1">
          {(['ALL', 'OPEN', 'WON', 'LOST'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-3 py-1 text-xs font-mono border transition-colors',
                filter === f
                  ? 'bg-white text-black border-white font-bold'
                  : 'bg-transparent text-text-muted border-transparent hover:text-white hover:border-zinc-800'
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1 text-xs font-bold uppercase tracking-wider bg-white text-black border border-white hover:bg-zinc-200 transition-colors"
          >
            + LOG TRADE
          </button>
          <button
            onClick={refreshAll}
            className="px-2.5 py-1 text-xs text-text-muted border border-border hover:text-white transition-colors"
          >
            ↺
          </button>
        </div>
      </div>

      {/* ── Trades Table ── */}
      <div className="flex-1 overflow-auto p-4">
        {isLoading ? (
          <div className="text-center py-12 text-zinc-500 animate-pulse">
            Loading Trading Journal...
          </div>
        ) : !trades || trades.length === 0 ? (
          <div className="border border-dashed border-zinc-800 p-12 text-center text-zinc-500">
            No trades recorded in this filter.
            <div className="text-2xs text-zinc-600 mt-2">
              Log trades manually or click &ldquo;LOG TO JOURNAL&rdquo; from any active signal.
            </div>
          </div>
        ) : (
          <div className="border border-border overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-zinc-950 text-text-muted text-2xs uppercase">
                  <th className="p-2.5">ID</th>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Symbol</th>
                  <th className="p-2.5">Side</th>
                  <th className="p-2.5 text-right">Entry</th>
                  <th className="p-2.5 text-right">SL</th>
                  <th className="p-2.5 text-right">TP</th>
                  <th className="p-2.5 text-right">Exit</th>
                  <th className="p-2.5 text-right">P&amp;L</th>
                  <th className="p-2.5 text-center">R:R</th>
                  <th className="p-2.5 text-center">Status</th>
                  <th className="p-2.5">AI Verdict</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-black">
                {trades.map(t => {
                  const dateStr = new Date(t.created_at * 1000).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })
                  return (
                    <tr key={t.id} className="hover:bg-zinc-950 transition-colors">
                      <td className="p-2.5 text-zinc-500 font-mono">#{t.id}</td>
                      <td className="p-2.5 text-zinc-400 text-2xs whitespace-nowrap">{dateStr}</td>
                      <td className="p-2.5 font-bold text-white">{t.symbol}</td>
                      <td className="p-2.5">
                        <span className={clsx(
                          'px-1.5 py-0.5 text-2xs font-bold border',
                          t.direction === 'BUY'
                            ? 'bg-white text-black border-white'
                            : 'bg-zinc-900 text-white border-zinc-700'
                        )}>
                          {t.direction}
                        </span>
                      </td>
                      <td className="p-2.5 text-right font-mono">{t.entry_price.toFixed(4)}</td>
                      <td className="p-2.5 text-right font-mono text-zinc-400">{t.sl_price.toFixed(4)}</td>
                      <td className="p-2.5 text-right font-mono text-white">{t.tp_price.toFixed(4)}</td>
                      <td className="p-2.5 text-right font-mono text-zinc-300">
                        {t.exit_price != null ? t.exit_price.toFixed(4) : '—'}
                      </td>
                      <td className={clsx(
                        'p-2.5 text-right font-bold font-mono',
                        t.pnl > 0 ? 'text-white' : t.pnl < 0 ? 'text-zinc-500' : 'text-zinc-400'
                      )}>
                        {t.status === 'OPEN' ? 'OPEN' : (t.pnl >= 0 ? `+$${t.pnl.toFixed(2)}` : `-$${Math.abs(t.pnl).toFixed(2)}`)}
                      </td>
                      <td className="p-2.5 text-center text-zinc-400 font-mono">
                        1:{t.rr_ratio.toFixed(1)}
                      </td>
                      <td className="p-2.5 text-center">
                        <span className={clsx(
                          'px-1.5 py-0.5 text-2xs border font-semibold',
                          t.status === 'WON'
                            ? 'border-white text-white'
                            : t.status === 'LOST'
                            ? 'border-zinc-700 text-zinc-500'
                            : 'border-zinc-500 text-zinc-300'
                        )}>
                          {t.status}
                        </span>
                      </td>
                      <td className="p-2.5 text-2xs text-zinc-400">
                        {t.ai_verdict ? (
                          <span className="border border-zinc-800 px-1 py-0.5 text-zinc-300">
                            {t.ai_verdict}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="p-2.5 text-right whitespace-nowrap">
                        {t.status === 'OPEN' && (
                          <button
                            onClick={() => {
                              setClosingTrade(t)
                              setExitPriceInput(t.entry_price.toString())
                            }}
                            className="px-2 py-0.5 text-2xs bg-white text-black border border-white font-bold mr-1.5 hover:bg-zinc-200"
                          >
                            CLOSE
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="px-1.5 py-0.5 text-2xs text-zinc-600 border border-zinc-800 hover:text-white hover:border-zinc-600"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Close Trade Modal ── */}
      {closingTrade && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="border border-zinc-700 bg-zinc-950 p-5 max-w-sm w-full space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-sm">Close Trade #{closingTrade.id}</span>
              <button onClick={() => setClosingTrade(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="text-xs text-zinc-400 space-y-1">
              <div>Symbol: <span className="text-white font-bold">{closingTrade.symbol}</span> ({closingTrade.direction})</div>
              <div>Entry Price: <span className="text-white">{closingTrade.entry_price}</span></div>
            </div>

            <div>
              <label className="text-2xs text-text-muted uppercase block mb-1">Exit Price</label>
              <input
                type="number"
                step="any"
                value={exitPriceInput}
                onChange={e => setExitPriceInput(e.target.value)}
                className="w-full bg-black border border-border px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-white"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setClosingTrade(null)}
                className="px-3 py-1.5 text-xs border border-border text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseTrade}
                className="px-4 py-1.5 text-xs font-bold uppercase bg-white text-black border border-white hover:bg-zinc-200"
              >
                Confirm Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Manual Trade Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCreateTrade}
            className="border border-zinc-700 bg-zinc-950 p-5 max-w-md w-full space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border pb-2">
              <span className="font-bold text-sm">Log Trade to Journal</span>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-2xs text-text-muted uppercase block mb-1">Symbol</label>
                <input
                  type="text"
                  value={newSymbol}
                  onChange={e => setNewSymbol(e.target.value)}
                  className="w-full bg-black border border-border px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-white"
                  placeholder="e.g. EURUSD=X"
                  required
                />
              </div>

              <div>
                <label className="text-2xs text-text-muted uppercase block mb-1">Side</label>
                <div className="flex border border-border">
                  <button
                    type="button"
                    onClick={() => setNewDirection('BUY')}
                    className={clsx(
                      'flex-1 py-1.5 text-xs font-bold transition-colors',
                      newDirection === 'BUY' ? 'bg-white text-black' : 'text-zinc-500'
                    )}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDirection('SELL')}
                    className={clsx(
                      'flex-1 py-1.5 text-xs font-bold transition-colors',
                      newDirection === 'SELL' ? 'bg-white text-black' : 'text-zinc-500'
                    )}
                  >
                    SELL
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-2xs text-text-muted uppercase block mb-1">Entry Price</label>
                <input
                  type="number"
                  step="any"
                  value={newEntry}
                  onChange={e => setNewEntry(e.target.value)}
                  className="w-full bg-black border border-border px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-white"
                  placeholder="1.0850"
                  required
                />
              </div>

              <div>
                <label className="text-2xs text-text-muted uppercase block mb-1">Stop Loss</label>
                <input
                  type="number"
                  step="any"
                  value={newSL}
                  onChange={e => setNewSL(e.target.value)}
                  className="w-full bg-black border border-border px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-white"
                  placeholder="1.0800"
                  required
                />
              </div>

              <div>
                <label className="text-2xs text-text-muted uppercase block mb-1">Take Profit</label>
                <input
                  type="number"
                  step="any"
                  value={newTP}
                  onChange={e => setNewTP(e.target.value)}
                  className="w-full bg-black border border-border px-2.5 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-white"
                  placeholder="1.0950"
                  required
                />
              </div>
            </div>

            <div>
              <label className="text-2xs text-text-muted uppercase block mb-1">Lot / Position Size</label>
              <input
                type="number"
                step="any"
                value={newLots}
                onChange={e => setNewLots(e.target.value)}
                className="w-full bg-black border border-border px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-white"
              />
            </div>

            <div>
              <label className="text-2xs text-text-muted uppercase block mb-1">Strategy Notes</label>
              <textarea
                value={newNotes}
                onChange={e => setNewNotes(e.target.value)}
                rows={2}
                className="w-full bg-black border border-border px-3 py-1.5 text-white text-xs font-mono focus:outline-none focus:border-white"
                placeholder="EMA50 support bounce, StochRSI oversold < 20..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-3 py-1.5 text-xs border border-border text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold uppercase bg-white text-black border border-white hover:bg-zinc-200"
              >
                Save Trade
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
