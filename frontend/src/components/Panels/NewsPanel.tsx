// components/Panels/NewsPanel.tsx — Live news feed with impact filtering (Minimalist B&W)

import { useState } from 'react'
import clsx from 'clsx'
import type { NewsItem } from '@/types'

interface Props { news: NewsItem[] | undefined; loading: boolean }

export default function NewsPanel({ news, loading }: Props) {
  const [filter, setFilter] = useState<'ALL' | 'HIGH' | 'MED'>('ALL')

  const filtered = (news ?? []).filter(n =>
    filter === 'ALL' ? true : n.impact === filter
  )

  return (
    <div className="panel h-full flex flex-col overflow-hidden text-xs font-mono">
      {/* Header + filter tabs */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5 bg-black">
        <span className="text-2xs font-bold uppercase tracking-widest text-text-muted">
          Market News Feed
        </span>
        <div className="flex items-center gap-1">
          {(['ALL', 'HIGH', 'MED'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={clsx(
                'px-2 py-0.5 text-2xs border transition-colors',
                filter === f
                  ? 'bg-white text-black border-white font-bold'
                  : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-white'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* News list */}
      <div className="flex-1 overflow-y-auto divide-y divide-border bg-black">
        {loading ? (
          <div className="p-3 space-y-2 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 bg-zinc-900" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4">
            <span className="text-xs text-text-muted">No news headlines</span>
          </div>
        ) : (
          filtered.map((item, i) => (
            <div
              key={i}
              className="px-3 py-2 hover:bg-zinc-950 transition-colors cursor-default"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-white leading-snug line-clamp-2">
                    {item.title}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-2xs text-zinc-500">
                    <span className="border border-zinc-800 px-1 py-0.2 text-zinc-400">
                      {item.tag}
                    </span>
                    <span>{item.source}</span>
                    <span className="ml-auto">{item.time}</span>
                  </div>
                </div>

                <div className={clsx(
                  'text-2xs font-bold px-1 py-0.5 border flex-shrink-0',
                  item.impact === 'HIGH'
                    ? 'border-white text-white'
                    : item.impact === 'MED'
                    ? 'border-zinc-700 text-zinc-400'
                    : 'border-zinc-800 text-zinc-600'
                )}>
                  {item.impact}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
