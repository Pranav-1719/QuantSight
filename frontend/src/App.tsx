// App.tsx — QuantSight Professional Trading Terminal v2.3
// Left Side: Actual TradingView Advanced Chart (B&W Candles, Red 50 EMA, White/Red StochRSI, Full Tools)
// Right Sidebar: Separate Scrollable Stacked Sections:
//  1. What To Do (Buy/Sell Directive, Current Call, Live P&L, TV Position Box)
//  2. Macro News (CPI, FOMC, NFP, etc. with Actual, Predicted, Previous)
//  3. Strategy Steps Checklist (Status Badges)
//  4. Others (AI Eval, Stat-Arb, MTF)

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { IChartApi } from 'lightweight-charts'

import type { ChartType, Interval, SymbolConfig, DrawingTool, DrawingElement } from '@/types'
import { SYMBOLS, INTERVALS } from '@/types'
import { useOHLCV, useStrategy, useMTF, useNews, useLivePrice, useJournalStats } from '@/hooks/useData'

import Header from '@/components/Layout/Header'
import ChartToolbar from '@/components/Chart/ChartToolbar'
import TradingViewAdvancedChart from '@/components/Chart/TradingViewAdvancedChart'
import DrawingToolbar from '@/components/Chart/DrawingToolbar'
import DrawingOverlay from '@/components/Chart/DrawingOverlay'
import MainChart from '@/components/Chart/MainChart'
import StochRSIChart from '@/components/Chart/StochRSIChart'
import LiveCallBox from '@/components/Panels/LiveCallBox'
import StepsPanel from '@/components/Panels/StepsPanel'
import NewsPanel from '@/components/Panels/NewsPanel'
import TradeCallPanel from '@/components/Panels/TradeCallPanel'
import AIConfirmationPanel from '@/components/Panels/AIConfirmationPanel'
import StatArbPanel from '@/components/Panels/StatArbPanel'
import MultiTimeframePanel from '@/components/Panels/MultiTimeframePanel'
import TradingJournalView from '@/components/Journal/TradingJournalView'

// ── Default symbol & interval ──
const DEFAULT_SYMBOL = SYMBOLS.find(s => s.ticker === 'EURUSD=X')!
const DEFAULT_INTERVAL = INTERVALS.find(i => i.value === '15m')!

export default function App() {
  const qc = useQueryClient()

  // ── Top Level View Navigation: Terminal vs Journal ──
  const [view, setView] = useState<'terminal' | 'journal'>('terminal')

  // ── Chart Engine: Actual TradingView vs Custom QuantSight Overlay ──
  const [chartEngine, setChartEngine] = useState<'tradingview' | 'quantsight'>('tradingview')

  // ── Terminal State ──
  const [symbol, setSymbol] = useState<SymbolConfig>(DEFAULT_SYMBOL)
  const [interval, setTimeframe] = useState<Interval>(DEFAULT_INTERVAL.value)
  const [period, setPeriod] = useState<string>(DEFAULT_INTERVAL.period)
  const [chartType, setChartType] = useState<ChartType>('candlestick')
  const [mainChart, setMainChart] = useState<IChartApi | null>(null)

  // ── Drawing Toolbar State (for Custom Engine) ──
  const [activeTool, setActiveTool] = useState<DrawingTool>('cursor')
  const [drawings, setDrawings] = useState<DrawingElement[]>([])

  // ── Right Sidebar Navigation (Stacked All Boxes vs Focus View) ──
  const [activeTab, setActiveTab] = useState<'stacked' | 'call' | 'news' | 'steps' | 'ai' | 'statarb' | 'mtf'>('stacked')

  // When interval changes, update period
  const handleInterval = (iv: Interval) => {
    setTimeframe(iv)
    const ivConfig = INTERVALS.find(i => i.value === iv)
    if (ivConfig) setPeriod(ivConfig.period)
  }

  // ── Drawing Handlers ──
  const handleAddDrawing = (el: DrawingElement) => setDrawings(prev => [...prev, el])
  const handleClearDrawings = () => setDrawings([])
  const handleUndoDrawing = () => setDrawings(prev => prev.slice(0, -1))

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
    { key: 'stacked', label: 'STACKED (ALL)' },
    { key: 'call',    label: 'CALL & PNL'    },
    { key: 'news',    label: 'MACRO NEWS'    },
    { key: 'steps',   label: 'STEPS'         },
    { key: 'ai',      label: 'AI EVAL'       },
    { key: 'statarb', label: 'STAT-ARB'      },
    { key: 'mtf',     label: 'MTF'           },
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
          {/* ─── LEFT: ONLY THE CHART (flex-grow) ─── */}
          <div className="flex flex-col flex-1 min-w-0 border-r border-border bg-black">
            {/* Chart Top Toolbar */}
            <ChartToolbar
              chartType={chartType}
              interval={interval}
              onChartType={setChartType}
              onInterval={handleInterval}
              isLoading={isLoading}
              chartEngine={chartEngine}
              onToggleEngine={setChartEngine}
            />

            {/* Main Chart Area */}
            {chartEngine === 'tradingview' ? (
              // ── ACTUAL OFFICIAL TRADINGVIEW ADVANCED REAL-TIME CHART ──
              // (All TradingView tools, drawing toolbar, B&W candles, Red 50 EMA, White/Red StochRSI)
              <div className="flex-1 min-h-0 relative bg-black">
                <TradingViewAdvancedChart
                  symbolTicker={symbol.ticker}
                  interval={interval}
                />
              </div>
            ) : (
              // ── CUSTOM QUANTSIGHT STRATEGY ENGINE (WITH OVERLAY) ──
              <div className="flex-1 flex flex-col min-h-0 relative">
                <div className="flex-1 flex min-h-0 relative">
                  <DrawingToolbar
                    activeTool={activeTool}
                    onSelectTool={setActiveTool}
                    onClear={handleClearDrawings}
                    onUndo={handleUndoDrawing}
                    drawingCount={drawings.length}
                  />

                  <div className="flex-1 relative min-h-0 bg-black overflow-hidden">
                    <MainChart
                      candles={candles}
                      ema50={ema50}
                      chartType={chartType}
                      strategy={strategy}
                      livePrice={livePrice?.price ?? null}
                      onChartReady={setMainChart}
                    />

                    <DrawingOverlay
                      activeTool={activeTool}
                      drawings={drawings}
                      onAddDrawing={handleAddDrawing}
                      onToolUsed={() => {
                        if (activeTool === 'horizontal') setActiveTool('cursor')
                      }}
                    />
                  </div>
                </div>

                <div className="h-32 border-t border-border flex-shrink-0 bg-black flex">
                  <div className="w-10 bg-zinc-950 border-r border-zinc-900 flex-shrink-0 flex items-center justify-center">
                    <span className="text-[9px] text-zinc-600 -rotate-90 whitespace-nowrap font-bold tracking-widest">
                      STOCH RSI
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <StochRSIChart data={stochrsi} mainChart={mainChart} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT SIDEBAR: STACKED SEPARATE SCROLL BOXES (w-96 to w-[430px]) ─── */}
          <div className="w-[430px] flex-shrink-0 flex flex-col overflow-hidden bg-black border-l border-border">
            {/* Right Sidebar Navigation Tabs */}
            <div className="flex border-b border-border flex-shrink-0 bg-zinc-950 overflow-x-auto scrollbar-none">
              {rightPanelTabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 min-w-[65px] py-2 text-2xs font-mono font-bold uppercase tracking-wider transition-colors border-r last:border-r-0 border-border whitespace-nowrap px-1 text-center ${
                    activeTab === tab.key
                      ? 'bg-white text-black'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              {/* ── MODE 1: STACKED WITH SEPARATE SCROLLS (Default) ── */}
              {activeTab === 'stacked' && (
                <div className="flex-1 overflow-y-auto divide-y divide-zinc-800 space-y-2 p-2 bg-black scrollbar-thin">
                  {/* 1st Box: What To Do, Current Call, Live P&L, TV Position Box */}
                  <div className="flex-shrink-0">
                    <LiveCallBox
                      strategy={strategy}
                      symbol={symbol.ticker}
                      currentPrice={livePrice?.price ?? null}
                      onLogSuccess={handleRefresh}
                    />
                  </div>

                  {/* 2nd Box: Macro News & Economic Calendar (CPI, FOMC, NFP, etc.) with own scroll */}
                  <div className="pt-2">
                    <div className="text-2xs font-bold text-zinc-400 uppercase tracking-wider px-1 pb-1 flex items-center justify-between">
                      <span>2. Macroeconomic Calendar (CPI · FOMC · NFP)</span>
                      <span className="text-[9px] text-zinc-600">SEPARATE SCROLL</span>
                    </div>
                    <div className="h-64 border border-zinc-800 overflow-hidden">
                      <NewsPanel
                        news={news}
                        loading={newsQuery.isLoading}
                        currentSymbol={symbol.ticker}
                      />
                    </div>
                  </div>

                  {/* 3rd Box: Strategy Steps Checklist with own scroll */}
                  <div className="pt-2">
                    <div className="text-2xs font-bold text-zinc-400 uppercase tracking-wider px-1 pb-1 flex items-center justify-between">
                      <span>3. Strategy Execution Steps Checklist</span>
                      <span className="text-[9px] text-zinc-600">SEPARATE SCROLL</span>
                    </div>
                    <div className="h-60 border border-zinc-800 overflow-hidden">
                      <StepsPanel
                        strategy={strategy}
                        mtf={mtf}
                        symbol={symbol.ticker}
                        currentPrice={livePrice?.price ?? null}
                        onLogSuccess={handleRefresh}
                      />
                    </div>
                  </div>

                  {/* 4th Box: Others (AI Confirmation & QuantConnect Stat-Arb) */}
                  <div className="pt-2">
                    <div className="text-2xs font-bold text-zinc-400 uppercase tracking-wider px-1 pb-1">
                      4. AI Confluence &amp; QuantConnect Stat-Arb
                    </div>
                    <div className="space-y-2">
                      <div className="border border-zinc-800">
                        <AIConfirmationPanel
                          strategy={strategy}
                          loading={strategyQuery.isLoading}
                        />
                      </div>
                      <div className="border border-zinc-800">
                        <StatArbPanel
                          strategy={strategy}
                          category={symbol.category}
                          currentSymbol={symbol.ticker}
                          onLogSuccess={handleRefresh}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ── MODE 2: Full-Height CALL & PNL ── */}
              {activeTab === 'call' && (
                <div className="h-full overflow-y-auto p-2">
                  <LiveCallBox
                    strategy={strategy}
                    symbol={symbol.ticker}
                    currentPrice={livePrice?.price ?? null}
                    onLogSuccess={handleRefresh}
                  />
                  <div className="mt-2">
                    <TradeCallPanel
                      strategy={strategy}
                      loading={strategyQuery.isLoading}
                      symbolName={symbol.ticker}
                      onLogSuccess={handleRefresh}
                    />
                  </div>
                </div>
              )}

              {/* ── MODE 3: Full-Height MACRO NEWS ── */}
              {activeTab === 'news' && (
                <div className="h-full overflow-hidden">
                  <NewsPanel
                    news={news}
                    loading={newsQuery.isLoading}
                    currentSymbol={symbol.ticker}
                  />
                </div>
              )}

              {/* ── MODE 4: Full-Height STEPS ── */}
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

              {/* ── MODE 5: Full-Height AI EVAL ── */}
              {activeTab === 'ai' && (
                <div className="h-full overflow-y-auto">
                  <AIConfirmationPanel
                    strategy={strategy}
                    loading={strategyQuery.isLoading}
                  />
                </div>
              )}

              {/* ── MODE 6: Full-Height STAT-ARB ── */}
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

              {/* ── MODE 7: Full-Height MTF MATRIX ── */}
              {activeTab === 'mtf' && (
                <div className="h-full overflow-y-auto">
                  <MultiTimeframePanel
                    mtf={mtf}
                    loading={mtfQuery.isLoading}
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
