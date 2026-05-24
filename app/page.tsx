/**
 * app/page.tsx
 * Space Drishti — Main Dashboard Page
 *
 * Wires together:
 *  - Data fetching from /api/satellites (with filters)
 *  - GlobeScene (3D visualization)
 *  - FilterToolbar (category, search controls)
 *  - Stats overlay (object counts by category)
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import { FilterToolbar, type FilterState } from '@/components/ui/FilterToolbar'
import type { SatelliteSummary, PaginatedResponse } from '@/lib/validators'

// ─── Dynamic import — R3F / Three.js must not SSR ────────────────────────────
const GlobeScene = dynamic(
  () => import('@/components/globe/GlobeScene').then(m => m.GlobeScene),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#010409]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-cyan-400/50 border-t-cyan-400 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-600 text-xs font-mono tracking-[0.2em] uppercase">
            Initializing renderer
          </p>
        </div>
      </div>
    ),
  }
)

// ─── Stats overlay ────────────────────────────────────────────────────────────

interface StatsOverlayProps {
  satellites: SatelliteSummary[]
  syncedAt:   string | null
}

function StatsOverlay({ satellites, syncedAt }: StatsOverlayProps) {
  const counts = {
    PAYLOAD:      satellites.filter(s => s.category === 'PAYLOAD').length,
    ROCKET_BODY:  satellites.filter(s => s.category === 'ROCKET_BODY').length,
    DEBRIS:       satellites.filter(s => s.category === 'DEBRIS').length,
  }

  return (
    <div
      className="absolute top-4 left-4 rounded-xl p-3 border border-white/10 space-y-1 min-w-[140px]"
      style={{
        background: 'rgba(8,14,26,0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Logo / title */}
      <div className="flex items-center gap-2 mb-2.5 pb-2.5 border-b border-white/10">
        <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
        <span className="text-white text-xs font-mono font-medium tracking-wider">
          SPACE DRISHTI
        </span>
      </div>

      {/* Category counts */}
      {[
        { label: 'Payloads',      count: counts.PAYLOAD,     dot: 'bg-cyan-400' },
        { label: 'Rocket bodies', count: counts.ROCKET_BODY, dot: 'bg-amber-400' },
        { label: 'Debris',        count: counts.DEBRIS,      dot: 'bg-red-400' },
      ].map(({ label, count, dot }) => (
        <div key={label} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${dot} flex-shrink-0`} />
            <span className="text-[10px] text-zinc-500 font-mono">{label}</span>
          </div>
          <span className="text-[10px] text-zinc-300 font-mono tabular-nums">
            {count.toLocaleString()}
          </span>
        </div>
      ))}

      {/* Sync timestamp */}
      {syncedAt && (
        <p className="text-[9px] text-zinc-700 font-mono pt-2 border-t border-white/5 mt-1">
          Synced {new Date(syncedAt).toLocaleDateString('en-IN', {
            day: '2-digit', month: 'short',
          })}
        </p>
      )}
    </div>
  )
}

// ─── Data fetching hook ───────────────────────────────────────────────────────

const PAGE_SIZE = 500   // fetch in chunks of 500

function useSatellites(filters: FilterState) {
  const [satellites, setSatellites] = useState<SatelliteSummary[]>([])
  const [isLoading,  setIsLoading]  = useState(true)
  const [syncedAt,   setSyncedAt]   = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchAll = useCallback(async () => {
    // Cancel any in-flight request
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const signal = abortRef.current.signal

    setIsLoading(true)
    setSatellites([])

    try {
      // Build query string
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: '1' })
      if (filters.category)  params.set('category', filters.category)
      if (filters.activeOnly) params.set('active', 'true')
      if (filters.search)    params.set('search', filters.search)

      // Fetch first page
      const res  = await fetch(`/api/satellites?${params}`, { signal })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const data: PaginatedResponse<SatelliteSummary> = await res.json()

      setSyncedAt(data.synced_at)
      setSatellites(data.data)
      setIsLoading(false)

      // If there are more pages, fetch them progressively
      // This allows the 3D scene to start rendering with the first 500
      // while the rest load in the background
      if (data.pagination.has_more) {
        const total = data.pagination.total
        const pages = Math.ceil(total / PAGE_SIZE)

        for (let page = 2; page <= pages; page++) {
          if (signal.aborted) break
          params.set('page', String(page))
          const pageRes  = await fetch(`/api/satellites?${params}`, { signal })
          if (!pageRes.ok) break
          const pageData: PaginatedResponse<SatelliteSummary> = await pageRes.json()
          setSatellites(prev => [...prev, ...pageData.data])
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      console.error('[useSatellites] fetch failed:', err)
      setIsLoading(false)
    }
  }, [filters.category, filters.activeOnly, filters.search])

  useEffect(() => {
    // Debounce search input — don't refetch on every keystroke
    const delay = filters.search ? 400 : 0
    const timer = setTimeout(fetchAll, delay)
    return () => clearTimeout(timer)
  }, [fetchAll, filters.search])

  return { satellites, isLoading, syncedAt }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [filters, setFilters] = useState<FilterState>({
    category:   '',
    activeOnly: false,
    search:     '',
  })

  const { satellites, isLoading, syncedAt } = useSatellites(filters)

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#010409] relative">
      {/* 3D Globe — full screen */}
      <GlobeScene satellites={satellites} isLoading={isLoading} />

      {/* Stats panel — top left */}
      {!isLoading && (
        <StatsOverlay satellites={satellites} syncedAt={syncedAt} />
      )}

      {/* Filter toolbar — bottom center */}
      <FilterToolbar
        filters={filters}
        onChange={setFilters}
        totalCount={34000}
        loadedCount={satellites.length}
      />
    </main>
  )
}