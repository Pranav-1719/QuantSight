// components/Panels/NewsPanel.tsx
// Live Multi-Source RSS News Feed with Currency Classification & Vivid Impact Colors

import React, { useState } from 'react'
import clsx from 'clsx'
import type { NewsItem } from '@/types'

interface Props {
  news: NewsItem[] | undefined
  loading: boolean
  currentSymbol?: string
}

const CURRENCIES = [
  { id: 'ALL', label: 'ALL NEWS' },
  { id: 'USD', label: 'USD NEWS' },
  { id: 'JPY', label: 'JPY NEWS' },
  { id: 'EUR', label: 'EUR NEWS' },
  { id: 'GBP', label: 'GBP NEWS' },
  { id: 'INR', label: 'INR NEWS' },
  { id: 'BTC', label: 'BTC / CRYPTO' },
  { id: 'COMMODITY', label: 'COMMODITIES' },
] as const

export default function NewsPanel({ news, loading, currentSymbol }: Props) {
  const [currFilter, setCurrFilter] = useState<string>('ALL')
  const [impactFilter, setImpactFilter] = useState<'ALL' | 'HIGH' | 'MED' | 'LOW'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Derive active symbol currencies (e.g. USDJPY=X -> USD, JPY)
  const activeCurrencies: string[] = []
  if (currentSymbol) {
    if (currentSymbol.includes('USD')) activeCurrencies.push('USD')
    if (currentSymbol.includes('JPY')) activeCurrencies.push('JPY')
    if (currentSymbol.includes('EUR')) activeCurrencies.push('EUR')
    if (currentSymbol.includes('GBP')) activeCurrencies.push('GBP')
    if (currentSymbol.includes('INR') || currentSymbol.endsWith('.NS')) activeCurrencies.push('INR')
    if (currentSymbol.includes('BTC')) activeCurrencies.push('BTC')
  }

  const items = news ?? []

  // Filtering by currency, impact, and search query
  const filtered = items.filter(item => {
    // 1. Impact filter
    if (impactFilter !== 'ALL' && item.impact !== impactFilter) {
      return false
    }

    // 2. Currency filter
    if (currFilter !== 'ALL') {
      const matchPrimary = item.currency === currFilter
      const matchAll = item.currencies?.includes(currFilter)
      const matchText = `${item.title} ${item.desc}`.toLowerCase().includes(currFilter.toLowerCase())
      if (!matchPrimary && !matchAll && !matchText) {
        return false
      }
    }

    // 3. Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const inTitle = item.title.toLowerCase().includes(q)
      const inDesc = item.desc?.toLowerCase().includes(q)
      const inSource = item.source?.toLowerCase().includes(q)
      if (!inTitle && !inDesc && !inSource) return false
    }

    return true
  })

  // Impact color styling helper
  const getImpactBadge = (impact: 'HIGH' | 'MED' | 'LOW') => {
    switch (impact) {
      case 'HIGH':
        return {
          badge: 'bg-red-500/20 text-red-400 border-red-500',
          dot: 'bg-red-500 animate-pulse',
          border: 'border-l-red-500',
          label: 'HIGH IMPACT',
        }
      case 'MED':
        return {
          badge: 'bg-amber-500/20 text-amber-400 border-amber-500',
          dot: 'bg-amber-400',
          border: 'border-l-amber-500',
          label: 'MED IMPACT',
        }
      case 'LOW':
      default:
        return {
          badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/50',
          dot: 'bg-emerald-400',
          border: 'border-l-emerald-600',
          label: 'LOW IMPACT',
        }
    }
  }

  return (
    <div className="panel h-full flex flex-col overflow-hidden text-xs font-mono bg-black">
      {/* Top Header */}
      <div className="p-2.5 border-b border-border bg-zinc-950 flex flex-col gap-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold uppercase tracking-wider text-white">Live News Feed</span>
            <span className="text-2xs bg-red-950 text-red-400 border border-red-800 px-1 font-bold animate-pulse">
              LIVE
            </span>
          </div>

          {/* Impact Quick Filters */}
          <div className="flex items-center gap-1">
            {(['ALL', 'HIGH', 'MED', 'LOW'] as const).map(imp => {
              const active = impactFilter === imp
              let color = 'border-zinc-800 text-zinc-500 hover:text-white'
              if (active) {
                if (imp === 'HIGH') color = 'bg-red-600 text-white border-red-500 font-bold'
                else if (imp === 'MED') color = 'bg-amber-600 text-white border-amber-500 font-bold'
                else if (imp === 'LOW') color = 'bg-emerald-600 text-white border-emerald-500 font-bold'
                else color = 'bg-white text-black border-white font-bold'
              }
              return (
                <button
                  key={imp}
                  onClick={() => setImpactFilter(imp)}
                  className={clsx('px-1.5 py-0.5 text-[9px] border transition-colors', color)}
                >
                  {imp}
                </button>
              )
            })}
          </div>
        </div>

        {/* Currency Filter Tabs Bar (USD, JPY, EUR, etc.) */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
          {CURRENCIES.map(c => {
            const isSelected = currFilter === c.id
            const isPairRelated = activeCurrencies.includes(c.id)
            return (
              <button
                key={c.id}
                onClick={() => setCurrFilter(c.id)}
                className={clsx(
                  'px-2 py-1 text-2xs font-bold whitespace-nowrap border transition-all flex items-center gap-1',
                  isSelected
                    ? 'bg-white text-black border-white'
                    : isPairRelated
                    ? 'bg-zinc-900 text-amber-300 border-amber-500/50 hover:bg-zinc-800'
                    : 'bg-black text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-600'
                )}
              >
                {c.label}
                {isPairRelated && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                )}
              </button>
            )
          })}
        </div>

        {/* Search input */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search news (e.g. Fed, CPI, BoJ, Rate)..."
            className="w-full bg-black border border-zinc-800 text-white text-2xs px-2.5 py-1 focus:outline-none focus:border-white transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1 text-zinc-500 hover:text-white text-2xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* News Headlines List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900 bg-black">
        {loading ? (
          <div className="p-3 space-y-2 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-zinc-950 border border-zinc-900" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-600 text-2xs p-4 text-center">
            <div>NO HEADLINES MATCHING CURRENT FILTER</div>
            <button
              onClick={() => {
                setCurrFilter('ALL')
                setImpactFilter('ALL')
                setSearchQuery('')
              }}
              className="mt-2 text-white border border-zinc-700 px-2 py-0.5 hover:bg-zinc-900"
            >
              RESET FILTERS
            </button>
          </div>
        ) : (
          filtered.map((item, idx) => {
            const impactStyle = getImpactBadge(item.impact)
            const currencyPill = item.currency || item.tag || 'GLOBAL'
            return (
              <div
                key={idx}
                className={clsx(
                  'p-3 hover:bg-zinc-950/80 transition-colors border-l-4',
                  impactStyle.border
                )}
              >
                {/* Top Meta: Source, Currency Tag, Time, Impact Badge */}
                <div className="flex items-center justify-between gap-2 mb-1.5 text-2xs">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Currency Tag */}
                    <span className="px-1.5 py-0.2 bg-zinc-800 text-white font-bold border border-zinc-700 text-[9px]">
                      {currencyPill}
                    </span>

                    {/* Source */}
                    <span className="text-zinc-400 font-bold">{item.source}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-zinc-500">{item.time}</span>
                  </div>

                  {/* Impact Badge with Color */}
                  <div
                    className={clsx(
                      'flex items-center gap-1 px-1.5 py-0.5 border text-[9px] font-bold flex-shrink-0',
                      impactStyle.badge
                    )}
                  >
                    <span className={clsx('w-1.5 h-1.5 rounded-full', impactStyle.dot)} />
                    <span>{impactStyle.label}</span>
                  </div>
                </div>

                {/* News Title */}
                <div className="text-xs font-semibold text-zinc-100 leading-snug hover:text-white">
                  {item.title}
                </div>

                {/* News Description */}
                {item.desc && (
                  <div className="text-2xs text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                    {item.desc}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
