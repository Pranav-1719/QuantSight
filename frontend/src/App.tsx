// App.tsx — QuantSight Professional Trading Terminal v2.5
// Left Side: Actual TradingView Advanced Chart (B&W Candles, White 50 EMA, White/Gray StochRSI, Full Tools)
// Right Sidebar: Swappable & Adjustable Stacked Boxes with Uncropped Components & Horizontally Scrollable Navbar:
//  1. [call] What To Do (Large Labeled Directives, Current Call, Live P&L, TV Position Box)
//  2. [news] Macro News & Economic Calendar (CPI, FOMC, NFP with Actual, Predicted, Previous)
//  3. [steps] Strategy Steps Checklist (Status Badges)
//  4. [others] AI Eval & Stat-Arb Confluence

import { useState, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { IChartApi } from 'lightweight-charts'

import type { ChartType, Interval, SymbolConfig, DrawingTool, DrawingElement } from '@/types'
import { SYMBOLS, INTERVALS } from '@/types'
import { useOHLCV, useStrategy, useMTF, useNews, useLivePrice, useJournalStats } from '@/hooks/useData'

import Header from '@/components/Layout/Header'
import SidebarBox from '@/components/Layout/SidebarBox'
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

  // ── Chart Engine: Actual TradingView Advanced Chart vs QuantSight Overlay ──
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

  // ── Right Sidebar Resizable Width ──
  const [sidebarWidth, setSidebarWidth] = useState<number>(460)
  const isResizingSidebar = useRef(false)
  const startSidebarX = useRef(0)
  const startSidebarWidth = useRef(460)

  // ── Right Sidebar Swappable Boxes & Heights ──
  const [boxOrder, setBoxOrder] = useState<string[]>(['call', 'news', 'steps', 'others'])
  const [boxHeights, setBoxHeights] = useState<Record<string, number>>({
    call: 320,
    news: 360,
    steps: 320,
    others: 360,
  })

  // ── Right Sidebar Tab Focus ──
  const [activeTab, setActiveTab] = useState<'stacked' | 'call' | 'news' | 'steps' | 'ai' | 'statarb' | 'mtf'>('stacked')

  // ── Interval Handler ──
  const handleInterval = (iv: Interval) => {
    setTimeframe(iv)
    const ivConfig = INTERVALS.find(i => i.value === iv)
    if (ivConfig) setPeriod(ivConfig.period)
  }

  // ── Swapping & Reordering Handlers ──
  const swapBoxes = (index1: number, index2: number) => {
    if (index1 < 0 || index1 >= boxOrder.length || index2 < 0 || index2 >= boxOrder.length) return
    const newOrder = [...boxOrder]
    const temp = newOrder[index1]
    newOrder[index1] = newOrder[index2]
    newOrder[index2] = temp
    setBoxOrder(newOrder)
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    if (!draggedId || draggedId === targetId) return
    const fromIdx = boxOrder.indexOf(draggedId)
    const toIdx = boxOrder.indexOf(targetId)
    if (fromIdx !== -1 && toIdx !== -1) {
      const newOrder = [...boxOrder]
      newOrder.splice(fromIdx, 1)
      newOrder.splice(toIdx, 0, draggedId)
      setBoxOrder(newOrder)
    }
  }

  const handleHeightChange = (id: string, newH: number) => {
    setBoxHeights(prev => ({ ...prev, [id]: newH }))
  }

  // ── Sidebar Horizontal Width Resizing ──
  const handleMouseDownSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault()
    isResizingSidebar.current = true
    startSidebarX.current = e.clientX
    startSidebarWidth.current = sidebarWidth

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizingSidebar.current) return
      const deltaX = startSidebarX.current - moveEvent.clientX
      const newW = Math.max(360, Math.min(800, startSidebarWidth.current + deltaX))
      setSidebarWidth(newW)
    }

    const handleMouseUp = () => {
      isResizingSidebar.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
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
    { key: 'stacked', label: 'SWAPPABLE BOXES' },
    { key: 'call',    label: 'CALL & PNL'      },
    { key: 'news',    label: 'MACRO NEWS'      },
    { key: 'steps',   label: 'STEPS'           },
    { key: 'ai',      label: 'AI EVAL'         },
    { key: 'statarb', label: 'STAT-ARB'        },
    { key: 'mtf',     label: 'MTF'             },
  ] as const

  // ── Render Individual Swappable Box Contents (All components uncropped) ──
  const renderBoxContent = (id: string) => {
    switch (id) {
      case 'call':
        return (
          <LiveCallBox
            strategy={strategy}
            symbol={symbol.ticker}
            currentPrice={livePrice?.price ?? null}
            onLogSuccess={handleRefresh}
          />
        )
      case 'news':
        return (
          <div className="w-full">
            <NewsPanel
              news={news}
              loading={newsQuery.isLoading}
              currentSymbol={symbol.ticker}
            />
          </div>
        )
      case 'steps':
        return (
          <div className="w-full">
            <StepsPanel
              strategy={strategy}
              mtf={mtf}
              symbol={symbol.ticker}
              currentPrice={livePrice?.price ?? null}
              onLogSuccess={handleRefresh}
            />
          </div>
        )
      case 'others':
        return (
          <div className="p-3 space-y-3 bg-black">
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
        )
      default:
        return null
    }
  }

  const getBoxConfig = (id: string) => {
    switch (id) {
      case 'call':
        return {
          title: '1. What To Do · Current Call & PnL',
          badge: strategy?.signal || 'WAIT',
          badgeColor: strategy?.signal?.includes('BUY')
            ? 'bg-emerald-950 text-emerald-400 border-emerald-500'
            : strategy?.signal?.includes('SELL')
            ? 'bg-red-950 text-red-400 border-red-500'
            : 'border-zinc-700 text-zinc-400',
        }
      case 'news':
        return {
          title: '2. Macro Calendar (CPI · FOMC · NFP)',
          badge: 'ACTUAL / PREDICTED',
          badgeColor: 'border-white text-white',
        }
      case 'steps':
        return {
          title: '3. Strategy Steps Checklist',
          badge: '50 EMA + STOCH',
          badgeColor: 'border-zinc-700 text-zinc-300',
        }
      case 'others':
        return {
          title: '4. AI Confluence & Stat-Arb',
          badge: `${strategy?.ai_confirmation?.confidence ?? 80}% CONF`,
          badgeColor: 'border-zinc-700 text-zinc-300',
        }
      default:
        return { title: id, badge: undefined, badgeColor: undefined }
    }
  }

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
              <div className="flex-1 min-h-0 relative bg-black">
                <TradingViewAdvancedChart
                  symbolTicker={symbol.ticker}
                  interval={interval}
                />
              </div>
            ) : (
              // ── CUSTOM QUANTSIGHT STRATEGY ENGINE WITH PLOTTED POSITION BOX ──
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
                      decimals={symbol.decimals}
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

          {/* ─── RESIZABLE SPLIT GRIP (Between Left Chart and Right Sidebar) ─── */}
          <div
            onMouseDown={handleMouseDownSidebarResize}
            className="w-1.5 bg-zinc-950 hover:bg-white cursor-col-resize flex-shrink-0 transition-colors z-30"
            title="Drag left/right to resize sidebar width"
          />

          {/* ─── RIGHT SIDEBAR: SWAPPABLE & ADJUSTABLE BOXES ─── */}
          <div
            style={{ width: `${sidebarWidth}px` }}
            className="flex-shrink-0 flex flex-col overflow-hidden bg-black border-l border-border"
          >
            {/* ── Scrollable Sidebar Navbar ── */}
            <div className="flex items-center border-b border-border flex-shrink-0 bg-zinc-950 overflow-x-auto scrollbar-thin select-none">
              <div className="flex flex-nowrap items-center min-w-max">
                {rightPanelTabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3.5 py-2.5 text-xs font-mono font-bold uppercase tracking-wider transition-colors border-r border-border whitespace-nowrap text-center ${
                      activeTab === tab.key
                        ? 'bg-white text-black'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}

                {/* Reset Box Layout Icon Button */}
                {activeTab === 'stacked' && (
                  <button
                    onClick={() => setBoxOrder(['call', 'news', 'steps', 'others'])}
                    className="px-3.5 py-2.5 text-zinc-400 hover:text-white border-r border-border text-xs whitespace-nowrap font-bold"
                    title="Reset boxes to default order"
                  >
                    ↺ RESET ORDER
                  </button>
                )}
              </div>
            </div>

            {/* Sidebar Body */}
            <div className="flex-1 overflow-hidden min-h-0 flex flex-col">
              {/* ── MODE 1: SWAPPABLE & ADJUSTABLE STACKED BOXES (All Components Fully Visible) ── */}
              {activeTab === 'stacked' && (
                <div className="flex-1 overflow-y-auto space-y-3 p-2.5 bg-black scrollbar-thin">
                  {boxOrder.map((boxId, idx) => {
                    const cfg = getBoxConfig(boxId)
                    return (
                      <SidebarBox
                        key={boxId}
                        id={boxId}
                        title={cfg.title}
                        badge={cfg.badge}
                        badgeColor={cfg.badgeColor}
                        height={boxHeights[boxId] || 320}
                        onHeightChange={handleHeightChange}
                        onMoveUp={() => swapBoxes(idx, idx - 1)}
                        onMoveDown={() => swapBoxes(idx, idx + 1)}
                        isFirst={idx === 0}
                        isLast={idx === boxOrder.length - 1}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        defaultAutoFit={true}
                      >
                        {renderBoxContent(boxId)}
                      </SidebarBox>
                    )
                  })}
                </div>
              )}

              {/* ── MODE 2: Full-Height CALL & PNL ── */}
              {activeTab === 'call' && (
                <div className="h-full overflow-y-auto p-2.5 space-y-3">
                  <LiveCallBox
                    strategy={strategy}
                    symbol={symbol.ticker}
                    currentPrice={livePrice?.price ?? null}
                    onLogSuccess={handleRefresh}
                  />
                  <div>
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
