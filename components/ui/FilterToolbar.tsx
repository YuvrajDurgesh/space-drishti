/**
 * components/ui/FilterToolbar.tsx
 * Space Drishti — Globe Filter Controls
 *
 * Floating toolbar at the bottom of the globe screen.
 * Controls: category filter, active-only toggle, search by name.
 * State is lifted to the page — toolbar just calls onChange.
 */

'use client'

import { useState } from 'react'

export interface FilterState {
  category: string    // '' = all, or 'PAYLOAD' | 'ROCKET_BODY' | 'DEBRIS' | 'UNKNOWN'
  activeOnly: boolean
  search: string
}

interface FilterToolbarProps {
  filters:   FilterState
  onChange:  (f: FilterState) => void
  totalCount: number
  loadedCount: number
}

const CATEGORIES = [
  { key: '',            label: 'All',          dot: 'bg-zinc-500' },
  { key: 'PAYLOAD',     label: 'Payloads',     dot: 'bg-cyan-400' },
  { key: 'ROCKET_BODY', label: 'Rocket Bodies', dot: 'bg-amber-400' },
  { key: 'DEBRIS',      label: 'Debris',       dot: 'bg-red-400' },
]

export function FilterToolbar({ filters, onChange, totalCount, loadedCount }: FilterToolbarProps) {
  const [searchOpen, setSearchOpen] = useState(false)

  function set(patch: Partial<FilterState>) {
    onChange({ ...filters, ...patch })
  }

  return (
    <div
      className="
        absolute bottom-6 left-1/2 -translate-x-1/2
        flex items-center gap-2
        px-3 py-2 rounded-2xl
        border border-white/10
        shadow-2xl shadow-black/50
      "
      style={{
        background: 'rgba(8,14,26,0.88)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Object count */}
      <span className="text-[10px] font-mono text-zinc-600 pr-1 border-r border-white/10 mr-1">
        {loadedCount.toLocaleString()} obj
      </span>

      {/* Category filters */}
      {CATEGORIES.map(cat => (
        <button
          key={cat.key}
          onClick={() => set({ category: cat.key })}
          className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono
            transition-all duration-150 border
            ${filters.category === cat.key
              ? 'bg-white/10 border-white/20 text-white'
              : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
            }
          `}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
          {cat.label}
        </button>
      ))}

      {/* Divider */}
      <div className="w-px h-4 bg-white/10 mx-1" />

      {/* Active only toggle */}
      <button
        onClick={() => set({ activeOnly: !filters.activeOnly })}
        className={`
          flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono
          transition-all duration-150 border
          ${filters.activeOnly
            ? 'bg-green-900/40 border-green-500/30 text-green-400'
            : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
          }
        `}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${filters.activeOnly ? 'bg-green-400 animate-pulse' : 'bg-zinc-600'}`} />
        Active
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-white/10 mx-1" />

      {/* Search */}
      {searchOpen ? (
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="text"
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            placeholder="Search name..."
            className="
              bg-transparent text-white text-xs font-mono
              placeholder-zinc-600 outline-none w-28
              border-b border-zinc-600 pb-0.5
            "
          />
          <button
            onClick={() => { set({ search: '' }); setSearchOpen(false) }}
            className="text-zinc-600 hover:text-zinc-400 ml-1 text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          onClick={() => setSearchOpen(true)}
          className="text-zinc-500 hover:text-zinc-300 px-1 py-1 text-xs font-mono transition-colors"
          title="Search by name"
        >
          ⌕
        </button>
      )}
    </div>
  )
}