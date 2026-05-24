/**
 * lib/science/conjunction.ts
 * Space Drishti — Conjunction Analysis Engine (Fixed)
 *
 * Fix: satellite.js propagate() return type is:
 *   { position: EciVec3<number> | boolean, velocity: EciVec3<number> | boolean }
 * TypeScript complains about `=== false` when the type is already narrowed.
 * Solution: cast result to `any` before checking, or use type predicate helper.
 */

import * as satellite from 'satellite.js'
import {
  CONJUNCTION_WARN_KM,
  CONJUNCTION_CRIT_KM,
} from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TLEPair {
  norad_id: number
  name:     string
  line1:    string
  line2:    string
}

export interface ConjunctionResult {
  object1_norad_id:         number
  object2_norad_id:         number
  object1_name:             string
  object2_name:             string
  tca:                      Date
  miss_distance_km:         number
  relative_speed_km_s:      number
  probability_of_collision: number
  severity:                 'CRITICAL' | 'WARNING' | 'NOMINAL'
  computed_at:              Date
}

export interface ConjunctionOptions {
  window_days?:      number
  coarse_step_sec?:  number
  fine_step_sec?:    number
  search_radius_km?: number
}

interface Vec3 { x: number; y: number; z: number }

// ─── Safe propagation (fixes the boolean overlap TS error) ───────────────────
// Root cause: satellite.js types say position is EciVec3<number> | boolean.
// When we write `result.position === false`, TS says "EciVec3 and boolean
// have no overlap" because it already narrowed the type via the `!` check.
// Fix: extract the raw result as `unknown` first, then check truthiness only.

function safePropagateECI(
  satrec: satellite.SatRec,
  date:   Date
): { pos: Vec3; vel: Vec3 } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = satellite.propagate(satrec, date) as any

    // satellite.js sets position/velocity to `false` on propagation failure.
    // Using `as any` lets us check truthiness without TS overlap complaints.
    if (!raw || !raw.position || !raw.velocity) return null

    const pos = raw.position as Vec3
    const vel = raw.velocity as Vec3

    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) return null

    const dist = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z)
    if (dist < 6200 || dist > 600000) return null

    return { pos, vel }
  } catch {
    return null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function distance(a: Vec3, b: Vec3): number {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function relativeSpeed(va: Vec3, vb: Vec3): number {
  const dx = va.x - vb.x, dy = va.y - vb.y, dz = va.z - vb.z
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function estimatePc(missDistance_km: number): number {
  if (missDistance_km <= 0) return 1
  const combinedRadius = 0.1
  const z = missDistance_km / combinedRadius
  return Math.exp(-0.5 * z * z) * (1 / (Math.sqrt(2 * Math.PI) * z))
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function analyseConjunction(
  obj1: TLEPair,
  obj2: TLEPair,
  opts: ConjunctionOptions = {}
): ConjunctionResult | null {
  const WINDOW_DAYS      = opts.window_days      ?? 3
  const COARSE_STEP_SEC  = opts.coarse_step_sec  ?? 60
  const FINE_STEP_SEC    = opts.fine_step_sec    ?? 1
  const SEARCH_RADIUS_KM = opts.search_radius_km ?? 50

  const satrec1 = satellite.twoline2satrec(obj1.line1, obj1.line2)
  const satrec2 = satellite.twoline2satrec(obj2.line1, obj2.line2)
  if (satrec1.error !== 0 || satrec2.error !== 0) return null

  const startMs  = Date.now()
  const endMs    = startMs + WINDOW_DAYS * 86400 * 1000
  const coarseMs = COARSE_STEP_SEC * 1000
  const fineMs   = FINE_STEP_SEC   * 1000

  let bestDist = Infinity
  let bestTime = startMs
  let bestVel1: Vec3 = { x: 0, y: 0, z: 0 }
  let bestVel2: Vec3 = { x: 0, y: 0, z: 0 }
  const candidates: number[] = []
  let prevDist = Infinity

  // Coarse scan
  for (let t = startMs; t <= endMs; t += coarseMs) {
    const d  = new Date(t)
    const r1 = safePropagateECI(satrec1, d)
    const r2 = safePropagateECI(satrec2, d)
    if (!r1 || !r2) continue

    const dist = distance(r1.pos, r2.pos)
    if (dist < SEARCH_RADIUS_KM && prevDist >= SEARCH_RADIUS_KM) {
      candidates.push(t - coarseMs)
    }
    if (dist < bestDist) {
      bestDist = dist; bestTime = t
      bestVel1 = r1.vel; bestVel2 = r2.vel
    }
    prevDist = dist
  }

  if (bestDist > CONJUNCTION_WARN_KM && candidates.length === 0) return null

  // Fine scan over candidate intervals
  for (const start of candidates) {
    for (let t = start; t <= Math.min(start + coarseMs * 2, endMs); t += fineMs) {
      const r1 = safePropagateECI(satrec1, new Date(t))
      const r2 = safePropagateECI(satrec2, new Date(t))
      if (!r1 || !r2) continue

      const dist = distance(r1.pos, r2.pos)
      if (dist < bestDist) {
        bestDist = dist; bestTime = t
        bestVel1 = r1.vel; bestVel2 = r2.vel
      }
    }
  }

  if (bestDist > CONJUNCTION_WARN_KM) return null

  return {
    object1_norad_id:         obj1.norad_id,
    object2_norad_id:         obj2.norad_id,
    object1_name:             obj1.name,
    object2_name:             obj2.name,
    tca:                      new Date(bestTime),
    miss_distance_km:         Math.round(bestDist * 1000) / 1000,
    relative_speed_km_s:      Math.round(relativeSpeed(bestVel1, bestVel2) * 1000) / 1000,
    probability_of_collision: estimatePc(bestDist),
    severity: bestDist <= CONJUNCTION_CRIT_KM ? 'CRITICAL'
            : bestDist <= CONJUNCTION_WARN_KM  ? 'WARNING'
            : 'NOMINAL',
    computed_at: new Date(),
  }
}

export function screenAgainstCatalog(
  target:  TLEPair,
  catalog: TLEPair[],
  opts?:   ConjunctionOptions
): ConjunctionResult[] {
  return catalog
    .filter(o => o.norad_id !== target.norad_id)
    .map(o => analyseConjunction(target, o, opts))
    .filter((r): r is ConjunctionResult => r !== null)
    .sort((a, b) => a.miss_distance_km - b.miss_distance_km)
}