/**
 * components/ui/SatelliteHUD.tsx
 * Space Drishti — Glassmorphism Satellite HUD
 *
 * Shown on the right side when a satellite is clicked.
 * Displays: name, NORAD ID, category, origin, orbital parameters,
 * and live ECI position (polled from /api/satellite/[id] every 5s).
 *
 * Design: Dark glassmorphism — translucent dark panel, cyan accents,
 * monospaced data readouts, subtle scanline texture.
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import type { SatelliteSummary } from '@/lib/validators'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveTelemetry {
  latitude_deg:  number
  longitude_deg: number
  altitude_km:   number
  speed_km_s:    number
  timestamp:     string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(n: number | null | undefined, decimals = 2, unit = ''): string {
  if (n == null) return '—'
  return `${n.toFixed(decimals)}${unit}`
}

function categoryBadgeColor(category: string): string {
  switch (category) {
    case 'PAYLOAD':     return 'bg-cyan-900/60 text-cyan-300 border-cyan-500/30'
    case 'ROCKET_BODY': return 'bg-amber-900/60 text-amber-300 border-amber-500/30'
    case 'DEBRIS':      return 'bg-red-900/60   text-red-300   border-red-500/30'
    default:            return 'bg-zinc-800/60  text-zinc-400  border-zinc-600/30'
  }
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    PAYLOAD:      'Payload',
    ROCKET_BODY:  'Rocket Body',
    DEBRIS:       'Debris',
    UNKNOWN:      'Unknown',
  }
  return map[cat] ?? cat
}

// ─── Telemetry row ────────────────────────────────────────────────────────────

function TelemetryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline py-1.5 border-b border-white/5">
      <span className="text-xs text-zinc-500 uppercase tracking-wider font-mono">
        {label}
      </span>
      <span className="text-sm text-cyan-300 font-mono tabular-nums">
        {value}
      </span>
    </div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-1">
      <div className="w-1 h-3 bg-cyan-400 rounded-full" />
      <span className="text-[10px] text-zinc-500 uppercase tracking-[0.15em] font-mono">
        {title}
      </span>
    </div>
  )
}

// ─── Main HUD component ───────────────────────────────────────────────────────

interface SatelliteHUDProps {
  satellite: SatelliteSummary
  onClose:   () => void
}

export function SatelliteHUD({ satellite, onClose }: SatelliteHUDProps) {
  const [telemetry, setTelemetry] = useState<LiveTelemetry | null>(null)
  const [isLive,    setIsLive]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  // Fetch live position every 5 seconds
  const fetchTelemetry = useCallback(async () => {
    try {
      const res  = await fetch(`/api/satellite/${satellite.norad_id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()

      const { geodetic, velocity } = data.ephemeris.at
      const speed = Math.sqrt(
        velocity.vx_km_s ** 2 +
        velocity.vy_km_s ** 2 +
        velocity.vz_km_s ** 2
      )

      setTelemetry({
        latitude_deg:  geodetic.latitude_deg,
        longitude_deg: geodetic.longitude_deg,
        altitude_km:   geodetic.altitude_km,
        speed_km_s:    speed,
        timestamp:     data.ephemeris.at.timestamp,
      })
      setIsLive(true)
      setError(null)
    } catch (err) {
      setError('Live feed unavailable')
      setIsLive(false)
    }
  }, [satellite.norad_id])

  useEffect(() => {
    fetchTelemetry()
    const interval = setInterval(fetchTelemetry, 5000)
    return () => clearInterval(interval)
  }, [fetchTelemetry])

  return (
    <div
      className="
        absolute top-4 right-4 w-72
        rounded-xl overflow-hidden
        border border-white/10
        shadow-2xl shadow-black/60
        animate-in slide-in-from-right-8 duration-300
      "
      style={{
        background: 'linear-gradient(135deg, rgba(10,18,30,0.95) 0%, rgba(6,12,24,0.92) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      {/* Scanline texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,1) 2px, rgba(255,255,255,1) 3px)',
        }}
      />

      {/* Header */}
      <div className="relative flex items-start justify-between p-4 pb-3 border-b border-white/10">
        <div className="flex-1 min-w-0">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <div
              className={`
                w-1.5 h-1.5 rounded-full
                ${isLive ? 'bg-cyan-400 animate-pulse' : 'bg-zinc-600'}
              `}
            />
            <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
              {isLive ? 'Live telemetry' : 'Cached'}
            </span>
          </div>

          {/* Satellite name */}
          <h2 className="text-white font-mono text-sm font-medium leading-tight truncate">
            {satellite.name}
          </h2>

          {/* NORAD ID */}
          <p className="text-zinc-500 font-mono text-xs mt-0.5">
            NORAD #{satellite.norad_id}
            {satellite.origin_country && (
              <span className="ml-2 text-zinc-600">· {satellite.origin_country}</span>
            )}
          </p>
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="
            ml-3 mt-0.5 w-6 h-6 flex items-center justify-center
            rounded-md text-zinc-600 hover:text-white hover:bg-white/10
            transition-colors duration-150 flex-shrink-0
          "
          aria-label="Close HUD"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="relative p-4 pt-2 space-y-0.5">
        {/* Category badge */}
        <div className="flex items-center gap-2 mb-3 mt-1">
          <span
            className={`
              text-[10px] font-mono px-2 py-0.5 rounded border
              tracking-wider uppercase ${categoryBadgeColor(satellite.category)}
            `}
          >
            {categoryLabel(satellite.category)}
          </span>
          {satellite.is_active && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-green-900/40 text-green-400 border-green-500/30 tracking-wider uppercase">
              Active
            </span>
          )}
        </div>

        {/* Orbital parameters */}
        <Section title="Orbital parameters" />
        <TelemetryRow
          label="Perigee"
          value={formatNum(satellite.altitude_perigee_km, 0, ' km')}
        />
        <TelemetryRow
          label="Apogee"
          value={formatNum(satellite.altitude_apogee_km, 0, ' km')}
        />
        <TelemetryRow
          label="Inclination"
          value={formatNum(satellite.inclination_deg, 2, '°')}
        />
        <TelemetryRow
          label="Period"
          value={formatNum(satellite.period_minutes, 1, ' min')}
        />

        {/* Live position */}
        <Section title="Live position" />
        {error ? (
          <p className="text-xs text-red-400/70 font-mono py-2">{error}</p>
        ) : telemetry ? (
          <>
            <TelemetryRow
              label="Latitude"
              value={formatNum(telemetry.latitude_deg, 4, '°')}
            />
            <TelemetryRow
              label="Longitude"
              value={formatNum(telemetry.longitude_deg, 4, '°')}
            />
            <TelemetryRow
              label="Altitude"
              value={formatNum(telemetry.altitude_km, 1, ' km')}
            />
            <TelemetryRow
              label="Speed"
              value={formatNum(telemetry.speed_km_s, 3, ' km/s')}
            />
          </>
        ) : (
          <div className="flex items-center gap-2 py-3">
            <div className="w-3 h-3 border border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-zinc-600 font-mono">Computing position…</span>
          </div>
        )}

        {/* TLE epoch */}
        <Section title="Data" />
        <TelemetryRow
          label="TLE epoch"
          value={satellite.epoch
            ? new Date(satellite.epoch).toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: '2-digit',
              })
            : '—'
          }
        />

        {/* Footer timestamp */}
        {telemetry && (
          <p className="text-[9px] text-zinc-700 font-mono mt-3 text-right">
            Updated {new Date(telemetry.timestamp).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  )
}