// App.tsx — QuantSight Professional Trading Terminal v2.1
// Minimalist Black & White Monochromatic Bloomberg Terminal
// Integrated AI Decision Confirmation, Self-Adapting Strategy, Trading Journal & PCA Stat-Arb

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { IChartApi } from 'lightweight-charts'

import type { ChartType, Interval, SymbolConfig } from '@/types'
import { SYMBOLS, INTERVALS } from '@/types'
import { useOHLCV, useStrategy, useMTF, useNews, useLivePrice, useJournalStats } from '@/hooks/useData'

import Header from '@/components/Layout/Header'
import ChartToolbar from '@/components/Chart/ChartToolbar'
import MainChart from '@/components/Chart/MainChart'
import StochRSIChart from '@/components/Chart/StochRSIChart'
import SignalPanel from '@/components/Panels/SignalPanel'
import TradeCallPanel from '@/components/Panels/TradeCallPanel'
import AIConfirmationPanel from '@/components/Panels/AIConfirmationPanel'
import StatArbPanel from '@/components/Panels/StatArbPanel'
import MultiTimeframePanel from '@/components/Panels/MultiTimeframePanel'
import NewsPanel from '@/components/Panels/NewsPanel'
import TradingJournalView from '@/components/Journal/TradingJournalView'

// ── Default symbol & interval ──
const DEFAULT_SYMBOL = SYMBOLS.find(s => s.ticker === 'EURUSD=X')!
const DEFAULT_INTERVAL = INTERVALS.find(i => i.value === '15m')!

export default function App() {
  const qc = useQueryClient()

  // ── Top Level View Navigation: Terminal vs Journal ──
  const [view, setView] = useState<'terminal' | 'journal'>('terminal')

  // ── Terminal State ──
  const [symbol, setSymbol] = useState<SymbolConfig>(DEFAULT_SYMBOL)
  const [interval, setTimeframe] = useState<Interval>(DEFAULT_INTERVAL.value)
  const [period, setPeriod] = useState<string>(DEFAULT_INTERVAL.period)
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [mainChart, setMainChart] = useState<IChartApi | null>(null)
  const [activeTab, setActiveTab] = useState<'signal' | 'ai' | 'trade' | 'statarb' | 'mtf' | 'steps'>('signal')

  // When interval changes, update period
  const handleInterval = (iv: Interval) => {
    setTimeframe(iv)
    const ivConfig = INTERVALS.find(i => i.value === iv)
    if (ivConfig) setPeriod(ivConfig.period)
  }

  // ── Data hooks ──
  const ohlcvQuery = useOHLCV(symbol.ticker, interval, period)
  const strategyQuery = useStrategy(symbol.ticker, interval, period)
  const mtfQuery = useMTF(symbol.ticker)
  const newsQuery = useNews()
  const livePrice = useLivePrice(symbol.ticker)
  const journalStatsQuery = useJournalStats()

  const isLoading = ohlcvQuery.isLoading || strategyQuery.isLoading

  // ── Refresh ──
  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['ohlcv', symbol.ticker] })
    qc.invalidateQueries({ queryKey: ['strategy', symbol.ticker] })
    qc.invalidateQueries({ queryKey: ['mtf', symbol.ticker] })
    qc.invalidateQueries({ queryKey: ['news'] })
    qc.invalidateQueries({ queryKey: ['journalStats'] })
    qc.invalidateQueries({ queryKey: ['journal'] })
    qc.invalidateQueries({ queryKey: ['statarb'] })
  }, [qc, symbol])

  const candles = ohlcvQuery.data?.candles ?? []
  const ema50 = ohlcvQuery.data?.ema50 ?? []
  const stochrsi = ohlcvQuery.data?.stochrsi ?? []
  const strategy = strategyQuery.data
  const mtf = mtfQuery.data
  const news = newsQuery.data
  const openTradesCount = journalStatsQuery.data?.open_trades ?? 0

  const rightPanelTabs = [
    { key: 'signal',  label: 'Signal'   },
    { key: 'ai',      label: 'AI Eval'  },
    { key: 'trade',   label: 'Trade'    },
    { key: 'statarb', label: 'Stat-Arb' },
    { key: 'mtf',     label: 'MTF'      },
    { key: 'steps',   label: 'Logic'    },
  ] as const

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-black text-white font-mono">
      {/* ── TOP HEADER ── */}
      <Header
        symbol={symbol}
        livePrice={livePrice}
        interval={interval}
        onSymbol={setSymbol}
        onInterval={handleInterval}
        onRefresh={handleRefresh}
        isLoading={isLoading}
        decimals={symbol.decimals}
        view={view}
        onView={setView}
        openTradesCount={openTradesCount}
      />

      {/* ── CONDITIONAL VIEW ROUTING ── */}
      {view === 'journal' ? (
        <div className="flex-1 overflow-hidden min-h-0">
          <TradingJournalView />
        </div>
      ) : (
        /* ── TERMINAL VIEW ── */
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* ─── LEFT: CHART AREA (flex-grow) ─── */}
          <div className="flex flex-col flex-1 min-w-0 border-r border-border">
            {/* Chart toolbar */}
            <ChartToolbar
              chartType={chartType}
              interval={interval}
              onChartType={setChartType}
              onInterval={handleInterval}
              isLoading={isLoading}
            />

            {/* Main price chart */}
            <div className="flex-1 relative min-h-0 bg-black">
              {candles.length === 0 && !isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/80">
                  <div className="text-center">
                    <div className="text-zinc-400 font-mono text-sm mb-1">NO DATA AVAILABLE</div>
                    <div className="text-2xs text-zinc-600 font-mono">Select symbol or click Refresh</div>
                  </div>
                </div>
              )}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/50 pointer-events-none">
                  <div className="flex items-center gap-2 text-zinc-400 text-xs">
                    <div className="w-2.5 h-2.5 bg-white animate-ping" />
                    <span>FETCHING MARKET TICKS...</span>
                  </div>
                </div>
              )}
              <MainChart
                candles={candles}
                ema50={ema50}
                chartType={chartType}
                strategy={strategy}
                livePrice={livePrice?.price ?? null}
                onChartReady={setMainChart}
              />
            </div>

            {/* Stoch RSI sub-chart */}
            <div className="h-32 border-t border-border flex-shrink-0 bg-black">
              <StochRSIChart
                data={stochrsi}
                mainChart={mainChart}
              />
            </div>

            {/* ── Bottom: Trade Steps / News ── */}
            <div className="h-44 border-t border-border flex flex-shrink-0 min-h-0 bg-black">
              {/* Execution Steps panel */}
              <div className="flex-1 min-w-0 border-r border-border flex flex-col overflow-hidden">
                <div className="panel-header flex items-center justify-between">
                  <span>Execution Steps &amp; Adaptive Checklist</span>
                  <span className="text-2xs text-zinc-500">{strategy?.adaptive_params?.mode ?? 'BALANCED'}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 text-2xs">
                  {strategy?.steps ? strategy.steps.map((step, i) => (
                    <div key={i} className="text-zinc-300 font-mono leading-relaxed flex items-start gap-1">
                      <span className="text-zinc-600 font-bold">›</span>
                      <span>{step}</span>
                    </div>
                  )) : (
                    <div className="text-zinc-600 font-mono">No steps — awaiting signal</div>
                  )}
                </div>
              </div>

              {/* News panel */}
              <div className="w-80 flex-shrink-0 overflow-hidden">
                <NewsPanel news={news} loading={newsQuery.isLoading} />
              </div>
            </div>
          </div>

          {/* ─── RIGHT: PANEL TABS (fixed width 310px) ─── */}
          <div className="w-80 flex-shrink-0 flex flex-col overflow-hidden bg-black border-l border-border">
            {/* Tab navigation */}
            <div className="flex border-b border-border flex-shrink-0 bg-zinc-950">
              {rightPanelTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 py-2 text-2xs font-mono font-bold uppercase tracking-wider transition-colors border-r last:border-r-0 border-border ${
                    activeTab === tab.key
                      ? 'bg-white text-black'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Active panel content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {activeTab === 'signal' && (
                <div className="h-full overflow-y-auto">
                  <SignalPanel strategy={strategy} loading={strategyQuery.isLoading} />
                </div>
              )}
              {activeTab === 'ai' && (
                <div className="h-full overflow-y-auto">
                  <AIConfirmationPanel strategy={strategy} loading={strategyQuery.isLoading} />
                </div>
              )}
              {activeTab === 'trade' && (
                <div className="h-full overflow-y-auto">
                  <TradeCallPanel
                    strategy={strategy}
                    loading={strategyQuery.isLoading}
                    symbolName={symbol.label}
                    onLogSuccess={() => {
                      qc.invalidateQueries({ queryKey: ['journal'] })
                      qc.invalidateQueries({ queryKey: ['journalStats'] })
                      qc.invalidateQueries({ queryKey: ['adaptiveParams'] })
                    }}
                  />
                </div>
              )}
              {activeTab === 'statarb' && (
                <div className="h-full overflow-y-auto">
                  <StatArbPanel
                    strategy={strategy}
                    category={symbol.category}
                    currentSymbol={symbol.ticker}
                    onLogSuccess={() => {
                      qc.invalidateQueries({ queryKey: ['journal'] })
                      qc.invalidateQueries({ queryKey: ['journalStats'] })
                      qc.invalidateQueries({ queryKey: ['adaptiveParams'] })
                    }}
                  />
                </div>
              )}
              {activeTab === 'mtf' && (
                <div className="h-full overflow-y-auto">
                  <MultiTimeframePanel mtf={mtf} loading={mtfQuery.isLoading} />
                </div>
              )}
              {activeTab === 'steps' && (
                <div className="h-full overflow-y-auto panel text-xs font-mono">
                  <div className="panel-header">Strategy Logic</div>
                  <div className="p-3 space-y-2">
                    {strategy?.setup?.length ? strategy.setup.map((r, i) => (
                      <div key={i} className="text-2xs text-zinc-300 leading-relaxed border-b border-zinc-800 pb-1.5">
                        {r}
                      </div>
                    )) : (
                      <div className="text-2xs text-zinc-600 font-mono">No active setup — WAIT state</div>
                    )}

                    {strategy?.ha_pattern && (
                      <div className="mt-3 border border-border p-2 bg-black">
                        <div className="metric-label mb-1">Heikin Ashi Pattern</div>
                        <div className="text-xs font-mono text-white">
                          {strategy.ha_pattern.pattern}
                        </div>
                      </div>
                    )}

                    {/* Minimalist Strategy Rules */}
                    <div className="mt-3 pt-2 border-t border-border space-y-1">
                      <div className="text-2xs text-text-muted uppercase tracking-wider mb-1.5">
                        Core Strategy Mandates
                      </div>
                      {[
                        '50 EMA Support/Resistance Pullback',
                        'StochRSI Oversold/Overbought Exhaustion',
                        'Wait if StochRSI in Middle Zone (40–60)',
                        'Range-Bound Breakout in Extreme Zones',
                        'Top-Up on Double Crosses or Mid Crossing',
                        'Top-Down Alignment: 1D + 4H Trend, 1H Confirm, 15m Early Entry',
                        'PCA Statistical Arbitrage Mean Reversion Confluence',
                      ].map((r, i) => (
                        <div key={i} className="text-2xs text-zinc-400 flex items-start gap-1">
                          <span className="text-zinc-600">▸</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom status bar */}
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-t border-border bg-black text-2xs text-zinc-500">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 ${ohlcvQuery.isSuccess ? 'bg-white' : 'bg-zinc-700'}`} />
                <span>{ohlcvQuery.isSuccess ? 'STREAM CONNECTED' : 'CONNECTING...'}</span>
              </div>
              <span>{new Date().toLocaleTimeString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
