// components/Chart/DrawingOverlay.tsx
// Interactive SVG overlay for TradingView chart drawings

import React, { useState, useRef } from 'react'
import type { DrawingTool, DrawingElement } from '@/types'

interface Props {
  activeTool: DrawingTool
  drawings: DrawingElement[]
  onAddDrawing: (element: DrawingElement) => void
  onToolUsed?: () => void
}

export default function DrawingOverlay({
  activeTool,
  drawings,
  onAddDrawing,
  onToolUsed,
}: Props) {
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const getCoordinates = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return { x: 0, y: 0 }
    const rect = svgRef.current.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (activeTool === 'cursor') return
    const pt = getCoordinates(e)

    if (activeTool === 'horizontal') {
      // Single click drops horizontal line
      const newEl: DrawingElement = {
        id: `h_${Date.now()}`,
        type: 'horizontal',
        points: [{ x: 0, y: pt.y }, { x: 2000, y: pt.y }],
        color: '#ffffff',
      }
      onAddDrawing(newEl)
      if (onToolUsed) onToolUsed()
      return
    }

    setIsDrawing(true)
    setCurrentPoints([pt, pt])
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDrawing || activeTool === 'cursor') return
    const pt = getCoordinates(e)
    setCurrentPoints(prev => [prev[0], pt])
  }

  const handleMouseUp = () => {
    if (!isDrawing || activeTool === 'cursor') return
    setIsDrawing(false)

    if (currentPoints.length >= 2) {
      const p1 = currentPoints[0]
      const p2 = currentPoints[1]
      // Minimum distance threshold to prevent accidental clicks
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      if (dist > 8) {
        const newEl: DrawingElement = {
          id: `${activeTool}_${Date.now()}`,
          type: activeTool,
          points: [p1, p2],
          color: activeTool === 'fibonacci' ? '#f59e0b' : '#ffffff',
        }
        onAddDrawing(newEl)
        if (onToolUsed) onToolUsed()
      }
    }
    setCurrentPoints([])
  }

  const renderElement = (el: DrawingElement, isPreview = false) => {
    const [p1, p2] = el.points
    if (!p1 || !p2) return null

    switch (el.type) {
      case 'trendline':
        return (
          <g key={el.id} className="transition-opacity">
            <line
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke="#ffffff"
              strokeWidth={isPreview ? 1.5 : 2}
              strokeDasharray={isPreview ? '4 4' : undefined}
            />
            <circle cx={p1.x} cy={p1.y} r={3} fill="#ffffff" />
            <circle cx={p2.x} cy={p2.y} r={3} fill="#ffffff" />
          </g>
        )

      case 'horizontal':
        return (
          <g key={el.id}>
            <line
              x1={0}
              y1={p1.y}
              x2="100%"
              y2={p1.y}
              stroke="#ffffff"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <rect x={10} y={p1.y - 10} width={60} height={18} fill="#000000" stroke="#ffffff" strokeWidth={1} />
            <text x={15} y={p1.y + 3} fill="#ffffff" fontSize="10" fontFamily="monospace">
              S/R LEVEL
            </text>
          </g>
        )

      case 'rectangle': {
        const x = Math.min(p1.x, p2.x)
        const y = Math.min(p1.y, p2.y)
        const width = Math.abs(p2.x - p1.x)
        const height = Math.abs(p2.y - p1.y)
        return (
          <g key={el.id}>
            <rect
              x={x}
              y={y}
              width={width}
              height={height}
              fill="rgba(255, 255, 255, 0.08)"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
            <text x={x + 6} y={y + 14} fill="#a1a1aa" fontSize="10" fontFamily="monospace">
              ORDER BLOCK ZONE
            </text>
          </g>
        )
      }

      case 'fibonacci': {
        const topY = Math.min(p1.y, p2.y)
        const bottomY = Math.max(p1.y, p2.y)
        const height = bottomY - topY
        const levels = [
          { ratio: 0.0, label: '0.0 (High)', color: '#ffffff' },
          { ratio: 0.236, label: '0.236', color: '#a1a1aa' },
          { ratio: 0.382, label: '0.382', color: '#eab308' },
          { ratio: 0.5, label: '0.50 (Equilibrium)', color: '#3b82f6' },
          { ratio: 0.618, label: '0.618 (Golden Pocket)', color: '#22c55e' },
          { ratio: 0.786, label: '0.786', color: '#a855f7' },
          { ratio: 1.0, label: '1.0 (Low)', color: '#ffffff' },
        ]

        return (
          <g key={el.id}>
            {levels.map((lvl, idx) => {
              const y = topY + height * lvl.ratio
              return (
                <g key={idx}>
                  <line
                    x1={Math.min(p1.x, p2.x)}
                    y1={y}
                    x2={Math.max(p1.x, p2.x) + 120}
                    y2={y}
                    stroke={lvl.color}
                    strokeWidth={lvl.ratio === 0.618 ? 2 : 1}
                    strokeDasharray={lvl.ratio === 0.618 ? undefined : '3 3'}
                  />
                  <text
                    x={Math.max(p1.x, p2.x) + 8}
                    y={y - 3}
                    fill={lvl.color}
                    fontSize="9"
                    fontFamily="monospace"
                    fontWeight={lvl.ratio === 0.618 ? 'bold' : 'normal'}
                  >
                    {lvl.label}
                  </text>
                </g>
              )
            })}
          </g>
        )
      }

      case 'long_position': {
        const x = Math.min(p1.x, p2.x)
        const width = Math.max(80, Math.abs(p2.x - p1.x))
        const entryY = p1.y
        const targetY = Math.min(p1.y, p2.y)
        const slY = entryY + (entryY - targetY) * 0.5
        const tpHeight = Math.abs(entryY - targetY)
        const slHeight = Math.abs(slY - entryY)

        return (
          <g key={el.id}>
            {/* TP Target Box */}
            <rect
              x={x}
              y={targetY}
              width={width}
              height={tpHeight}
              fill="rgba(34, 197, 94, 0.15)"
              stroke="#22c55e"
              strokeWidth={1.5}
            />
            {/* SL Stop Box */}
            <rect
              x={x}
              y={entryY}
              width={width}
              height={slHeight}
              fill="rgba(239, 68, 68, 0.15)"
              stroke="#ef4444"
              strokeWidth={1.5}
            />
            {/* Entry Line */}
            <line x1={x} y1={entryY} x2={x + width} y2={entryY} stroke="#ffffff" strokeWidth={2} />
            <text x={x + 6} y={targetY + 14} fill="#22c55e" fontSize="10" fontFamily="monospace" fontWeight="bold">
              TARGET (TP) +2.0R
            </text>
            <text x={x + 6} y={entryY - 4} fill="#ffffff" fontSize="9" fontFamily="monospace">
              ENTRY LEVEL
            </text>
            <text x={x + 6} y={slY - 4} fill="#ef4444" fontSize="10" fontFamily="monospace" fontWeight="bold">
              STOP LOSS (SL)
            </text>
          </g>
        )
      }

      case 'short_position': {
        const x = Math.min(p1.x, p2.x)
        const width = Math.max(80, Math.abs(p2.x - p1.x))
        const entryY = p1.y
        const targetY = Math.max(p1.y, p2.y)
        const slY = entryY - (targetY - entryY) * 0.5
        const tpHeight = Math.abs(targetY - entryY)
        const slHeight = Math.abs(entryY - slY)

        return (
          <g key={el.id}>
            {/* SL Stop Box */}
            <rect
              x={x}
              y={slY}
              width={width}
              height={slHeight}
              fill="rgba(239, 68, 68, 0.15)"
              stroke="#ef4444"
              strokeWidth={1.5}
            />
            {/* TP Target Box */}
            <rect
              x={x}
              y={entryY}
              width={width}
              height={tpHeight}
              fill="rgba(34, 197, 94, 0.15)"
              stroke="#22c55e"
              strokeWidth={1.5}
            />
            {/* Entry Line */}
            <line x1={x} y1={entryY} x2={x + width} y2={entryY} stroke="#ffffff" strokeWidth={2} />
            <text x={x + 6} y={slY + 14} fill="#ef4444" fontSize="10" fontFamily="monospace" fontWeight="bold">
              STOP LOSS (SL)
            </text>
            <text x={x + 6} y={entryY + 12} fill="#ffffff" fontSize="9" fontFamily="monospace">
              ENTRY LEVEL
            </text>
            <text x={x + 6} y={targetY - 6} fill="#22c55e" fontSize="10" fontFamily="monospace" fontWeight="bold">
              TARGET (TP) +2.0R
            </text>
          </g>
        )
      }

      case 'measure': {
        const dx = p2.x - p1.x
        const dy = p2.y - p1.y
        const dist = Math.round(Math.hypot(dx, dy))
        return (
          <g key={el.id}>
            <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#38bdf8" strokeWidth={2} strokeDasharray="3 3" />
            <circle cx={p1.x} cy={p1.y} r={3} fill="#38bdf8" />
            <circle cx={p2.x} cy={p2.y} r={3} fill="#38bdf8" />
            <rect
              x={p2.x + 8}
              y={p2.y - 12}
              width={110}
              height={22}
              fill="#000000"
              stroke="#38bdf8"
              strokeWidth={1}
            />
            <text x={p2.x + 14} y={p2.y + 3} fill="#38bdf8" fontSize="10" fontFamily="monospace">
              Δ {dist}px | RANGE
            </text>
          </g>
        )
      }

      default:
        return null
    }
  }

  return (
    <svg
      ref={svgRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className={`absolute inset-0 w-full h-full z-10 ${
        activeTool === 'cursor' ? 'pointer-events-none' : 'pointer-events-auto cursor-crosshair'
      }`}
    >
      {/* Existing Drawings */}
      {drawings.map(d => renderElement(d))}

      {/* Live Drawing Preview */}
      {isDrawing &&
        currentPoints.length === 2 &&
        renderElement(
          {
            id: 'preview',
            type: activeTool,
            points: currentPoints,
          },
          true
        )}
    </svg>
  )
}
