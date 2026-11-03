// App.tsx — QuantSight Professional Trading Terminal v2.2
// Minimalist Black & White Monochromatic Bloomberg Terminal
// Integrated Drawing Toolbar, Left Chart Canvas, Right Steps & Currency News Feed

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { IChartApi } from 'lightweight-charts'

import type { ChartType, Interval, SymbolConfig, DrawingTool, DrawingElement } from '@/types'
import { SYMBOLS, INTERVALS } from '@/types'
import { useOHLCV, useStrategy, useMTF, useNews, useLivePrice, useJournalStats } from '@/hooks/useData'

import Header from '@/components/Layout/Header'
import ChartToolbar from '@/components/Chart/ChartToolbar'
import DrawingToolbar from '@/components/Chart/DrawingToolbar'
import DrawingOverlay from '@/components/Chart/DrawingOverlay'
import MainChart from '@/components/Chart/MainChart'
import StochRSIChart from '@/components/Chart/StochRSIChart'
import SignalPanel from '@/components/Panels/SignalPanel'
import StepsPanel from '@/components/Panels/StepsPanel'
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

  // ── Drawing Toolbar State ──
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor')
  const [drawings, setDrawings] = useState<DrawingElement[]>([])

  // ── Right Sidebar Navigation ──
  // 'split' shows Steps on top and News on bottom
  const [activeTab, setActiveTab] = useState<'split' | 'steps' | 'news' | 'trade' | 'ai' | 'statarb' | 'mtf' | 'signal'>('split')

  // When interval changes, update period
  const handleInterval = (iv: Interval) => {
    setTimeframe(iv)
    const ivConfig = INTERVALS.find(i => i.value === iv)
    if (ivConfig) setPeriod(ivConfig.period)
  }

  // ── Drawing Handlers ──
  const handleAddDrawing = (el: DrawingElement) => {
    setDrawings(prev => [...prev, el])
  }

  const handleClearDrawings = () => {
    setDrawings([])
  }

  const handleUndoDrawing = () => {
    setDrawings(prev => prev.slice(0, -1))
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
    { key: 'split',   label: 'STEPS + NEWS' },
    { key: 'steps',   label: 'STEPS'        },
    { key: 'news',    label: 'NEWS'         },
    { key: 'trade',   label: 'TRADE'        },
    { key: 'ai',      label: 'AI EVAL'      },
    { key: 'statarb', label: 'STAT-ARB'     },
    { key: 'mtf',     label: 'MTF'          },
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
          {/* ─── LEFT: ONLY THE CHART + DRAWING TOOLBAR (flex-grow) ─── */}
          <div className="flex flex-col flex-1 min-w-0 border-r border-border bg-black">
            {/* Chart top toolbar (Timeframes, Candle styles, Refresh) */}
            <ChartToolbar
              chartType={chartType}
              interval={interval}
              onChartType={setChartType}
              onInterval={handleInterval}
              isLoading={isLoading}
            />

            {/* Main Chart Body: Drawing Toolbar on left + Chart Canvas */}
            <div className="flex-1 flex min-h-0 relative">
              {/* Vertical Drawing Toolbar */}
              <DrawingToolbar
                activeTool={activeTool}
                onSelectTool={setActiveTool}
                onClear={handleClearDrawings}
                onUndo={handleUndoDrawing}
                drawingCount={drawings.length}
              />

              {/* Chart Canvas & Overlay Container */}
              <div className="flex-1 relative min-h-0 bg-black overflow-hidden">
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

                {/* Main Candlestick / HA Chart */}
                <MainChart
                  candles={candles}
                  ema50={ema50}
                  chartType={chartType}
                  strategy={strategy}
                  livePrice={livePrice?.price ?? null}
                  onChartReady={setMainChart}
                />

                {/* Interactive Drawing Overlay (Trendline, Horizontal, Fib, Rect, Position) */}
                <DrawingOverlay
                  activeTool={activeTool}
                  drawings={drawings}
                  onAddDrawing={handleAddDrawing}
                  onToolUsed={() => {
                    // Optional: return to cursor after single action
                    if (activeTool === 'horizontal') setActiveTool('cursor')
                  }}
                />
              </div>
            </div>

            {/* Synchronized Stoch RSI sub-chart oscillator */}
            <div className="h-32 border-t border-border flex-shrink-0 bg-black flex">
              <div className="w-10 bg-zinc-950 border-r border-zinc-900 flex-shrink-0 flex items-center justify-center">
                <span className="text-[9px] text-zinc-600 -rotate-90 whitespace-nowrap font-bold tracking-widest">
                  STOCH RSI
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <StochRSIChart
                  data={stochrsi}
                  mainChart={mainChart}
                />
              </div>
            </div>
          </div>

          {/* ─── RIGHT SIDEBAR: STEPS & CURRENCY NEWS FEED (fixed width 380px) ─── */}
          <div className="w-96 flex-shrink-0 flex flex-col overflow-hidden bg-black border-l border-border">
            {/* Tab navigation */}
            <div className="flex border-b border-border flex-shrink-0 bg-zinc-950 overflow-x-auto scrollbar-none">
              {rightPanelTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 min-w-[70px] py-2 text-2xs font-mono font-bold uppercase tracking-wider transition-colors border-r last:border-r-0 border-border whitespace-nowrap px-1 text-center ${
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
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              {/* Mode 1: SPLIT (Steps on top 50%, News on bottom 50%) */}
              {activeTab === 'split' && (
                <div className="flex-1 flex flex-col min-h-0 divide-y divide-border">
                  <div className="h-1/2 min-h-0 overflow-hidden">
                    <StepsPanel
                      strategy={strategy}
                      mtf={mtf}
                      symbol={symbol.ticker}
                      currentPrice={livePrice?.price ?? null}
                      onLogSuccess={handleRefresh}
                    />
                  </div>
                  <div className="h-1/2 min-h-0 overflow-hidden">
                    <NewsPanel
                      news={news}
                      loading={newsQuery.isLoading}
                      currentSymbol={symbol.ticker}
                    />
                  </div>
                </div>
              )}

              {/* Mode 2: Full-Height STEPS */}
              {activeTab === 'steps' && (
                <div className="h-full overflow-hidden">
                  <StepsPanel
                    strategy={strategy}
                    mtf={mtf}
                    symbol={symbol.ticker}
                    currentPrice={livePrice?.price ?? null}
                    onLogSuccess={handleRefresh}
                  />
                </div>
              )}

              {/* Mode 3: Full-Height NEWS with Currency filters & Colors */}
              {activeTab === 'news' && (
                <div className="h-full overflow-hidden">
                  <NewsPanel
                    news={news}
                    loading={newsQuery.isLoading}
                    currentSymbol={symbol.ticker}
                  />
                </div>
              )}

              {/* Mode 4: Full-Height TRADE CALL */}
              {activeTab === 'trade' && (
                <div className="h-full overflow-y-auto">
                  <TradeCallPanel
                    strategy={strategy}
                    loading={strategyQuery.isLoading}
                    symbolName={symbol.ticker}
                    onLogSuccess={handleRefresh}
                  />
                </div>
              )}

              {/* Mode 5: Full-Height AI EVAL */}
              {activeTab === 'ai' && (
                <div className="h-full overflow-y-auto">
                  <AIConfirmationPanel
                    strategy={strategy}
                    loading={strategyQuery.isLoading}
                  />
                </div>
              )}

              {/* Mode 6: Full-Height STAT-ARB */}
              {activeTab === 'statarb' && (
                <div className="h-full overflow-y-auto">
                  <StatArbPanel
                    strategy={strategy}
                    category={symbol.category}
                    currentSymbol={symbol.ticker}
                    onLogSuccess={handleRefresh}
                  />
                </div>
              )}

              {/* Mode 7: Full-Height MTF MATRIX */}
              {activeTab === 'mtf' && (
                <div className="h-full overflow-y-auto">
                  <MultiTimeframePanel
                    mtf={mtf}
                    loading={mtfQuery.isLoading}
                  />
                </div>
              )}

              {/* Mode 8: Full-Height SIGNAL */}
              {activeTab === 'signal' && (
                <div className="h-full overflow-y-auto">
                  <SignalPanel
                    strategy={strategy}
                    loading={strategyQuery.isLoading}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
