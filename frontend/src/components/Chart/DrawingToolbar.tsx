// components/Chart/DrawingToolbar.tsx
// TradingView-style vertical drawing toolbar for chart annotations

import React from 'react'
import clsx from 'clsx'
import type { DrawingTool } from '@/types'

interface Props {
  activeTool: DrawingTool
  onSelectTool: (tool: DrawingTool) => void
  onClear: () => void
  onUndo: () => void
  drawingCount: number
}

interface ToolItem {
  id: DrawingTool
  label: string
  tooltip: string
  icon: React.ReactNode
}

export default function DrawingToolbar({
  activeTool,
  onSelectTool,
  onClear,
  onUndo,
  drawingCount,
}: Props) {
  const tools: ToolItem[] = [
    {
      id: 'cursor',
      label: 'PTR',
      tooltip: 'Cursor / Pan (Normal Navigation)',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 3l7 18 3-7 7-3L3 3z" />
        </svg>
      ),
    },
    {
      id: 'trendline',
      label: 'LINE',
      tooltip: 'Trendline (Click & Drag)',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="4" y1="20" x2="20" y2="4" />
          <circle cx="4" cy="20" r="2" fill="currentColor" />
          <circle cx="20" cy="4" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'horizontal',
      label: 'HORIZ',
      tooltip: 'Horizontal S/R Line (Click price level)',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="2" y1="12" x2="22" y2="12" strokeDasharray="3 3" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
        </svg>
      ),
    },
    {
      id: 'fibonacci',
      label: 'FIB',
      tooltip: 'Fibonacci Retracement (0.236 - 0.618 Golden Pocket)',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="4" x2="21" y2="4" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="14" x2="21" y2="14" />
          <line x1="3" y1="20" x2="21" y2="20" />
        </svg>
      ),
    },
    {
      id: 'rectangle',
      label: 'BOX',
      tooltip: 'Rectangle / Order Block Zone',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="14" rx="1" />
        </svg>
      ),
    },
    {
      id: 'long_position',
      label: 'LONG',
      tooltip: 'Long Position R:R Box',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="8" fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" />
          <rect x="4" y="12" width="16" height="8" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="#ffffff" />
        </svg>
      ),
    },
    {
      id: 'short_position',
      label: 'SHRT',
      tooltip: 'Short Position R:R Box',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="8" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" />
          <rect x="4" y="12" width="16" height="8" fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="#ffffff" />
        </svg>
      ),
    },
    {
      id: 'measure',
      label: 'MEAS',
      tooltip: 'Measure Price Distance & % Return',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 17l10 5 10-5M2 12l10 5 10-5M2 7l10 5 10-5" />
        </svg>
      ),
    },
  ]

  return (
    <div className="w-10 bg-zinc-950 border-r border-zinc-900 flex flex-col items-center py-2 space-y-1 z-20 flex-shrink-0 select-none">
      {tools.map(tool => {
        const isActive = activeTool === tool.id
        return (
          <button
            key={tool.id}
            onClick={() => onSelectTool(tool.id)}
            title={tool.tooltip}
            className={clsx(
              'w-8 h-8 rounded flex flex-col items-center justify-center transition-all relative group',
              isActive
                ? 'bg-white text-black font-bold shadow-md'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            )}
          >
            {tool.icon}
            <span className="text-[8px] leading-none mt-0.5 font-mono">{tool.label}</span>
          </button>
        )
      })}

      <div className="w-6 h-px bg-zinc-800 my-1" />

      {/* Undo Button */}
      <button
        onClick={onUndo}
        disabled={drawingCount === 0}
        title="Undo last drawing"
        className={clsx(
          'w-8 h-8 rounded flex items-center justify-center transition-colors',
          drawingCount > 0
            ? 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            : 'text-zinc-700 cursor-not-allowed'
        )}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 14L4 9l5-5" />
          <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
        </svg>
      </button>

      {/* Clear All Button */}
      <button
        onClick={onClear}
        disabled={drawingCount === 0}
        title={`Clear all ${drawingCount} drawings`}
        className={clsx(
          'w-8 h-8 rounded flex items-center justify-center transition-colors relative',
          drawingCount > 0
            ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-900'
            : 'text-zinc-700 cursor-not-allowed'
        )}
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        {drawingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-zinc-700 text-white rounded-full text-[8px] flex items-center justify-center font-mono">
            {drawingCount}
          </span>
        )}
      </button>
    </div>
  )
}
