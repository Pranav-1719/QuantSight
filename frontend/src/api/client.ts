// api/client.ts — Axios client + typed API calls

import axios from 'axios'
import type { OHLCVResponse, StrategyResult, MTFResult, NewsItem, LivePrice, JournalTrade, JournalStats, AdaptiveParams } from '@/types'

export const api = axios.create({
  baseURL: '/api',
  timeout: 30_000,
})

export async function fetchOHLCV(
  symbol: string,
  interval: string,
  period: string,
): Promise<OHLCVResponse> {
  const { data } = await api.get('/ohlcv', { params: { symbol, interval, period } })
  if (!data.success) throw new Error(data.error || 'Failed to fetch OHLCV')
  return data.data
}

export async function fetchStrategy(
  symbol: string,
  interval: string,
  period: string,
): Promise<StrategyResult> {
  const { data } = await api.get('/strategy', { params: { symbol, interval, period } })
  if (!data.success) throw new Error(data.error || 'Failed to fetch strategy')
  return data.data
}

export async function fetchMTF(symbol: string): Promise<MTFResult> {
  const { data } = await api.get('/mtf', { params: { symbol } })
  if (!data.success) throw new Error(data.error || 'Failed to fetch MTF')
  return data.data
}

export async function fetchNews(): Promise<NewsItem[]> {
  const { data } = await api.get('/news')
  return data.data || []
}

export async function fetchLivePrice(symbol: string): Promise<LivePrice> {
  const { data } = await api.get(`/price/${encodeURIComponent(symbol)}`)
  return data.data
}

export async function fetchJournalTrades(status?: string): Promise<JournalTrade[]> {
  const { data } = await api.get('/journal', { params: status && status !== 'ALL' ? { status } : {} })
  return data.data || []
}

export async function createJournalTrade(trade: Partial<JournalTrade>): Promise<JournalTrade> {
  const { data } = await api.post('/journal', trade)
  if (!data.success) throw new Error(data.error || 'Failed to create trade')
  return data.data
}

export async function updateJournalTrade(id: number, updates: Partial<JournalTrade>): Promise<JournalTrade> {
  const { data } = await api.put(`/journal/${id}`, updates)
  if (!data.success) throw new Error(data.error || 'Failed to update trade')
  return data.data
}

export async function deleteJournalTrade(id: number): Promise<boolean> {
  const { data } = await api.delete(`/journal/${id}`)
  return !!data.deleted
}

export async function fetchJournalStats(): Promise<JournalStats> {
  const { data } = await api.get('/journal/stats')
  return data.data
}

export async function fetchAdaptiveParams(): Promise<AdaptiveParams> {
  const { data } = await api.get('/ai/adaptive-params')
  return data.data
}

export async function fetchStatArbUniverse(category: string = 'India') {
  const { data } = await api.get('/statarb/universe', { params: { category } })
  return data
}
