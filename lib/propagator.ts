/**
 * lib/propagator.ts
 * Space Drishti — TLE Propagation Engine
 *
 * Wraps satellite.js to provide clean TypeScript functions for:
 *  - Single-point ECI position + velocity from a TLE
 *  - Geodetic (lat/lon/alt) from ECI
 *  - Orbital trail (N points over a time window)
 *
 * Used by:
 *  - /api/satellite/[norad_id]/route.ts  (ephemeris endpoint)
 *  - Frontend 3D engine (client-side import, same logic)
 *
 * Docs: https://github.com/shashwatak/satellite-js
 */

import * as satellite from 'satellite.js'
import type { EphemerisPoint } from './validators'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TLEPair {
  line1: string   // 69-char TLE line 1
  line2: string   // 69-char TLE line 2
}

export interface PropagationOptions {
  /** Timestamp to propagate to. Defaults to Date.now() */
  at?: Date
  /** If true, also compute geodetic (lat/lon/alt). Slightly more expensive. */
  geodetic?: boolean
}

export interface PropagationResult {
  success: true
  timestamp: Date
  eci: {
    x_km:  number
    y_km:  number
    z_km:  number
  }
  velocity: {
    vx_km_s: number
    vy_km_s: number
    vz_km_s: number
  }
  geodetic: {
    latitude_deg:  number
    longitude_deg: number
    altitude_km:   number
  }
}

export interface PropagationError {
  success: false
  error: string
}

export type PropagationOutcome = PropagationResult | PropagationError

// ─── Core propagator ─────────────────────────────────────────────────────────

/**
 * Propagate a TLE to get position and velocity at a given time.
 *
 * @param tle    - TLE line pair
 * @param opts   - options (time, geodetic flag)
 * @returns      PropagationResult on success, PropagationError on failure
 *
 * @example
 * const result = propagate({ line1: '...', line2: '...' }, { at: new Date() })
 * if (result.success) {
 *   console.log(result.eci.x_km, result.eci.y_km, result.eci.z_km)
 * }
 */
export function propagate(
  tle: TLEPair,
  opts: PropagationOptions = {}
): PropagationOutcome {
  const at = opts.at ?? new Date()

  // Parse TLE into satrec (satellite record)
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2)

  // satellite.js returns false on propagation errors (e.g. decayed orbit)
  const result = satellite.propagate(satrec, at)

  if (
    !result.position ||
    typeof result.position === 'boolean' ||
    !result.velocity ||
    typeof result.velocity === 'boolean'
  ) {
    return {
      success: false,
      error: `Propagation failed for TLE (satrec error: ${satrec.error}). ` +
             `Possible reasons: object has decayed, TLE is too old, or invalid TLE.`,
    }
  }

  const pos = result.position as satellite.EciVec3<number>
  const vel = result.velocity as satellite.EciVec3<number>

  // ECI → Geodetic (requires GMST — Greenwich Mean Sidereal Time)
  const gmst = satellite.gstime(at)
  const geo  = satellite.eciToGeodetic(pos, gmst)

  return {
    success: true,
    timestamp: at,
    eci: {
      x_km: pos.x,
      y_km: pos.y,
      z_km: pos.z,
    },
    velocity: {
      vx_km_s: vel.x,
      vy_km_s: vel.y,
      vz_km_s: vel.z,
    },
    geodetic: {
      latitude_deg:  satellite.degreesLat(geo.latitude),
      longitude_deg: satellite.degreesLong(geo.longitude),
      altitude_km:   geo.height,        // satellite.js returns km
    },
  }
}

// ─── Orbital trail generator ──────────────────────────────────────────────────

export interface TrailOptions {
  /** Start time for the trail. Defaults to Date.now() */
  start?: Date
  /** Total duration of the trail in minutes */
  durationMinutes?: number
  /** Interval between trail points in seconds */
  stepSeconds?: number
}

/**
 * Generate a sequence of positions for an orbital trail.
 * Used for "time scrubbing" in the 3D frontend.
 *
 * @example
 * const trail = generateTrail({ line1, line2 }, { durationMinutes: 90, stepSeconds: 60 })
 * // Returns ~90 points spaced 1 minute apart (one full orbit)
 */
export function generateTrail(
  tle: TLEPair,
  opts: TrailOptions = {}
): EphemerisPoint[] {
  const start       = opts.start ?? new Date()
  const duration    = (opts.durationMinutes ?? 90) * 60 * 1000  // ms
  const step        = (opts.stepSeconds ?? 60) * 1000            // ms

  const points: EphemerisPoint[] = []
  const satrec = satellite.twoline2satrec(tle.line1, tle.line2)

  for (let offset = 0; offset <= duration; offset += step) {
    const t = new Date(start.getTime() + offset)
    const result = satellite.propagate(satrec, t)

    if (
      !result.position || typeof result.position === 'boolean' ||
      !result.velocity  || typeof result.velocity === 'boolean'
    ) continue  // skip degenerate points (orbit crossing perigee edge cases)

    const pos  = result.position as satellite.EciVec3<number>
    const vel  = result.velocity as satellite.EciVec3<number>
    const gmst = satellite.gstime(t)
    const geo  = satellite.eciToGeodetic(pos, gmst)

    points.push({
      timestamp: t.toISOString(),
      eci: { x_km: pos.x, y_km: pos.y, z_km: pos.z },
      velocity: { vx_km_s: vel.x, vy_km_s: vel.y, vz_km_s: vel.z },
      geodetic: {
        latitude_deg:  satellite.degreesLat(geo.latitude),
        longitude_deg: satellite.degreesLong(geo.longitude),
        altitude_km:   geo.height,
      },
    })
  }

  return points
}

// ─── Bulk propagator (for frontend — propagate many satellites at once) ───────

/**
 * Propagate multiple TLEs to a single timestamp.
 * Returns an array parallel to the input — null entries where propagation failed.
 *
 * Used by the frontend InstancedMesh to update all 20k satellite positions
 * each animation frame.
 *
 * @param tles  - array of TLE pairs
 * @param at    - timestamp (defaults to now)
 * @returns     array of ECI positions (null where propagation failed)
 */
export function propagateBulk(
  tles: TLEPair[],
  at?: Date
): (PropagationResult | null)[] {
  const time = at ?? new Date()
  return tles.map(tle => {
    const result = propagate(tle, { at: time })
    return result.success ? result : null
  })
}

// ─── Orbital period helper ────────────────────────────────────────────────────

/**
 * Extract orbital period in minutes from TLE (no propagation needed).
 * Uses mean motion directly from the TLE.
 */
export function orbitalPeriodMinutes(tleLine2: string): number {
  // Mean motion is in field 8 of TLE line 2 (revolutions per day)
  const satrec = satellite.twoline2satrec(
    // We only have line 2 — create a dummy line 1
    '1 00000U 00000A   00001.00000000  .00000000  00000-0  00000-0 0  0001',
    tleLine2
  )
  const meanMotionRevPerDay = satrec.no * (1440 / (2 * Math.PI))  // rad/min → rev/day
  return 1440 / meanMotionRevPerDay
}