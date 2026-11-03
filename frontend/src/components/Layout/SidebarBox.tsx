// components/Layout/SidebarBox.tsx
// Swappable, resizable, and uncropped container box for right sidebar panels

import React, { useState, useRef } from 'react'
import clsx from 'clsx'

interface Props {
  id: string
  title: string
  badge?: string
  badgeColor?: string
  height: number
  onHeightChange: (id: string, newHeight: number) => void
  onMoveUp: () => void
  onMoveDown: () => void
  isFirst: boolean
  isLast: boolean
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, id: string) => void
  children: React.ReactNode
  defaultAutoFit?: boolean
}

export default function SidebarBox({
  id,
  title,
  badge,
  badgeColor = 'border-zinc-700 text-zinc-300',
  height,
  onHeightChange,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
  onDragStart,
  onDragOver,
  onDrop,
  children,
  defaultAutoFit = true,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)
  const [autoFit, setAutoFit] = useState(defaultAutoFit)
  const isResizing = useRef(false)
  const startY = useRef(0)
  const startHeight = useRef(height)

  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault()
    setAutoFit(false)
    isResizing.current = true
    startY.current = e.clientY
    startHeight.current = height

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return
      const deltaY = moveEvent.clientY - startY.current
      const newH = Math.max(160, Math.min(1000, startHeight.current + deltaY))
      onHeightChange(id, newH)
    }

    const handleMouseUp = () => {
      isResizing.current = false
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  return (
    <div
      draggable={true}
      onDragStart={e => onDragStart(e, id)}
      onDragOver={onDragOver}
      onDrop={e => onDrop(e, id)}
      className="border border-zinc-800 bg-black flex flex-col flex-shrink-0 transition-shadow select-none group"
    >
      {/* ── Box Header Bar ── */}
      <div className="px-3 py-2 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs font-mono">
        {/* Left: Drag grip & Title */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="cursor-grab text-zinc-500 hover:text-white font-bold text-sm" title="Drag to reorder">
            ⠿
          </span>
          <span className="font-bold text-white uppercase tracking-wider truncate text-xs">
            {title}
          </span>
          {badge && (
            <span className={clsx('px-2 py-0.5 text-2xs font-bold border', badgeColor)}>
              {badge}
            </span>
          )}
        </div>

        {/* Right: Auto-Fit Toggle, Swap buttons (▲ / ▼), Collapse toggle */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Auto-Fit / Uncrop Button */}
          <button
            onClick={() => setAutoFit(prev => !prev)}
            className={clsx(
              'px-2 py-0.5 border text-2xs font-bold transition-colors',
              autoFit
                ? 'bg-white text-black border-white'
                : 'bg-black text-zinc-400 border-zinc-800 hover:text-white'
            )}
            title={autoFit ? 'Showing all components (uncropped)' : 'Fixed height scroll mode'}
          >
            {autoFit ? 'FIT ALL' : 'SCROLL'}
          </button>

          {/* Move Up */}
          <button
            onClick={e => {
              e.stopPropagation()
              onMoveUp()
            }}
            disabled={isFirst}
            className={clsx(
              'w-5 h-5 flex items-center justify-center border text-2xs font-bold transition-colors',
              isFirst
                ? 'border-zinc-900 text-zinc-800 cursor-not-allowed'
                : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
            )}
            title="Move box up (Swap)"
          >
            ▲
          </button>

          {/* Move Down */}
          <button
            onClick={e => {
              e.stopPropagation()
              onMoveDown()
            }}
            disabled={isLast}
            className={clsx(
              'w-5 h-5 flex items-center justify-center border text-2xs font-bold transition-colors',
              isLast
                ? 'border-zinc-900 text-zinc-800 cursor-not-allowed'
                : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
            )}
            title="Move box down (Swap)"
          >
            ▼
          </button>

          {/* Collapse / Expand */}
          <button
            onClick={() => setCollapsed(prev => !prev)}
            className="w-5 h-5 flex items-center justify-center border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600 text-xs font-bold"
            title={collapsed ? 'Expand box' : 'Minimize box'}
          >
            {collapsed ? '+' : '—'}
          </button>
        </div>
      </div>

      {/* ── Box Content (Uncropped & Fully Visible) ── */}
      {!collapsed && (
        <div
          style={{
            height: autoFit ? 'auto' : `${height}px`,
            minHeight: autoFit ? 'auto' : `${height}px`,
          }}
          className={clsx(
            'flex-1 bg-black relative',
            autoFit ? 'overflow-visible' : 'overflow-y-auto scrollbar-thin'
          )}
        >
          {children}
        </div>
      )}

      {/* ── Vertical Resizer Drag Handle Bar ── */}
      {!collapsed && (
        <div
          onMouseDown={handleMouseDownResize}
          className="h-2 bg-zinc-950 hover:bg-zinc-800 border-t border-zinc-900 cursor-row-resize flex items-center justify-center transition-colors group-hover:border-zinc-700"
          title="Drag up/down to adjust box height"
        >
          <div className="w-8 h-0.5 bg-zinc-700 rounded-full" />
        </div>
      )}
    </div>
  )
}
