// hooks/useData.ts — Data fetching hooks with React Query

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  fetchOHLCV,
  fetchStrategy,
  fetchMTF,
  fetchNews,
  fetchJournalTrades,
  fetchJournalStats,
  fetchAdaptiveParams,
  fetchStatArbUniverse,
} from '@/api/client'
import type {
  LivePrice,
  OHLCVResponse,
  StrategyResult,
  MTFResult,
  NewsItem,
  JournalTrade,
  JournalStats,
  AdaptiveParams,
  StatArbUniverseResponse,
} from '@/types'

// ── Journal Trades ──
export function useJournalTrades(status?: string) {
  return useQuery<JournalTrade[]>({
    queryKey: ['journal', status],
    queryFn: () => fetchJournalTrades(status),
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}

// ── Journal Stats ──
export function useJournalStats() {
  return useQuery<JournalStats>({
    queryKey: ['journalStats'],
    queryFn: fetchJournalStats,
    staleTime: 10_000,
    refetchInterval: 15_000,
  })
}

// ── Adaptive AI Parameters ──
export function useAdaptiveParams() {
  return useQuery<AdaptiveParams>({
    queryKey: ['adaptiveParams'],
    queryFn: fetchAdaptiveParams,
    staleTime: 15_000,
    refetchInterval: 20_000,
  })
}

// ── PCA Statistical Arbitrage Universe ──
export function useStatArbUniverse(category: string) {
  return useQuery<StatArbUniverseResponse>({
    queryKey: ['statarb', category],
    queryFn: () => fetchStatArbUniverse(category),
    staleTime: 60_000,
    refetchInterval: 60_000,
  })
}

// ── OHLCV + Indicators ──
export function useOHLCV(symbol: string, interval: string, period: string) {
  return useQuery<OHLCVResponse>({
    queryKey:  ['ohlcv', symbol, interval, period],
    queryFn:   () => fetchOHLCV(symbol, interval, period),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: !!symbol,
  })
}

// ── Strategy signal ──
export function useStrategy(symbol: string, interval: string, period: string) {
  return useQuery<StrategyResult>({
    queryKey:  ['strategy', symbol, interval, period],
    queryFn:   () => fetchStrategy(symbol, interval, period),
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: !!symbol,
  })
}

// ── Multi-timeframe ──
export function useMTF(symbol: string) {
  return useQuery<MTFResult>({
    queryKey:  ['mtf', symbol],
    queryFn:   () => fetchMTF(symbol),
    staleTime: 120_000,
    refetchInterval: 120_000,
    enabled: !!symbol,
  })
}

// ── News ──
export function useNews() {
  return useQuery<NewsItem[]>({
    queryKey:  ['news'],
    queryFn:   fetchNews,
    staleTime: 300_000,
    refetchInterval: 300_000,
  })
}

// ── Live Price via WebSocket ──
export function useLivePrice(symbol: string): LivePrice | null {
  const [price, setPrice] = useState<LivePrice | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!symbol) return
    setPrice(null)

    const connect = () => {
      const encoded = encodeURIComponent(symbol)
      const ws = new WebSocket(`ws://localhost:8000/ws/price/${encoded}`)
      wsRef.current = ws

      ws.onmessage = (evt) => {
        try {
          const data: LivePrice = JSON.parse(evt.data)
          setPrice(data)
        } catch {}
      }

      ws.onclose = () => {
        reconnectRef.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [symbol])

  return price
}
