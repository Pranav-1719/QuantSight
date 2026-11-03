// utils/chartUtils.ts — Heikin Ashi, formatters, chart helpers

import type { OHLCV } from '@/types'

// ── Heikin Ashi ──
export function toHeikinAshi(candles: OHLCV[]): OHLCV[] {
  const ha: OHLCV[] = []
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i]
    const haClose = (c.open + c.high + c.low + c.close) / 4
    const haOpen =
      i === 0
        ? (c.open + c.close) / 2
        : (ha[i - 1].open + ha[i - 1].close) / 2
    const haHigh = Math.max(c.high, haOpen, haClose)
    const haLow  = Math.min(c.low,  haOpen, haClose)
    ha.push({ time: c.time, open: haOpen, high: haHigh, low: haLow, close: haClose })
  }
  return ha
}

// ── Price Formatters ──
export function fmtPrice(price: number, decimals = 5): string {
  return price.toFixed(decimals)
}

export function fmtPct(pct: number): string {
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(3)}%`
}

export function fmtChange(change: number, decimals = 5): string {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(decimals)}`
}

// ── Signal color (Monochrome B&W) ──
export function signalColor(signal: string): string {
  if (signal.includes('BUY'))       return '#ffffff'
  if (signal.includes('SELL'))      return '#a1a1aa'
  if (signal.includes('BREAKOUT'))  return '#e4e4e7'
  if (signal.includes('TOP_UP'))    return '#ffffff'
  return '#71717a'
}

export function stochColor(k: number): string {
  if (k <= 20) return '#ffffff'  // oversold → white
  if (k >= 80) return '#a1a1aa'  // overbought → gray
  return '#71717a'
}

// ── Time formatters ──
export function tsToDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function tsToDateTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  })
}

// ── Number helpers ──
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

// ── Trend bias helpers ──
export function biasColor(bias: string): string {
  if (bias === 'BULLISH') return '#ffffff'
  if (bias === 'BEARISH') return '#a1a1aa'
  return '#71717a'
}

export function stochStateLabel(state: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    OVERSOLD:   { label: 'OVERSOLD',   color: '#ffffff' },
    OVERBOUGHT: { label: 'OVERBOUGHT', color: '#a1a1aa' },
    MIDDLE:     { label: 'MIDDLE',     color: '#71717a' },
    NEUTRAL:    { label: 'NEUTRAL',    color: '#71717a' },
  }
  return map[state] ?? { label: state, color: '#71717a' }
}
