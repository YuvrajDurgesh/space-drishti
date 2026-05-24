/**
 * lib/science/passes.ts
 * Space Drishti — Satellite Pass Predictor (Fixed)
 *
 * Fix: satellite.js propagate() returns position/velocity as
 *   EciVec3<number> | boolean — TypeScript objects to `=== false`
 *   because it sees no overlap between EciVec3 and boolean after `!` check.
 *   Solution: cast result to `any` and check truthiness only.
 */

import * as satellite from 'satellite.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GroundStation {
  id:                string
  name:              string
  latitude_deg:      number
  longitude_deg:     number
  altitude_m:        number
  min_elevation_deg: number
}

export interface PassEvent {
  station_id:        string
  station_name:      string
  norad_id:          number
  satellite_name:    string
  aos:               Date
  tca:               Date
  los:               Date
  duration_sec:      number
  aos_azimuth_deg:   number
  max_elevation_deg: number
  los_azimuth_deg:   number
  min_range_km:      number
  is_sunlit:         boolean
}

export interface PassOptions {
  window_hours?:      number
  step_sec?:          number
  min_elevation_deg?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function degToRad(d: number) { return d * Math.PI / 180 }
function radToDeg(r: number) { return r * 180 / Math.PI }

/**
 * Safe propagation — casts to `any` to avoid the TypeScript
 * "EciVec3 and boolean have no overlap" error.
 * satellite.js sets position=false on propagation failure at runtime,
 * but the type definition doesn't fully express this narrowing.
 */
function propagateSafe(
  satrec: satellite.SatRec,
  date:   Date
): { pos: satellite.EciVec3<number>; vel: satellite.EciVec3<number> } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = satellite.propagate(satrec, date) as any
    if (!raw || !raw.position || !raw.velocity) return null

    const pos = raw.position as satellite.EciVec3<number>
    if (!isFinite(pos.x) || !isFinite(pos.y) || !isFinite(pos.z)) return null

    return {
      pos,
      vel: raw.velocity as satellite.EciVec3<number>,
    }
  } catch {
    return null
  }
}

/** Cylindrical shadow model — true if satellite is in sunlight */
function isSunlit(pos: satellite.EciVec3<number>, date: Date): boolean {
  const dayOfYear = (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000
  const lambda    = degToRad(280.46 + 0.9856474 * dayOfYear)
  const D         = 149597870  // km

  const sunX = D * Math.cos(lambda)
  const sunY = D * Math.sin(lambda)

  const dot      = pos.x * sunX + pos.y * sunY  // Z components cancel (sunZ ≈ 0)
  const sunMag   = Math.sqrt(sunX * sunX + sunY * sunY)
  const perpDist = Math.sqrt(
    pos.x * pos.x + pos.y * pos.y + pos.z * pos.z -
    Math.pow(dot / sunMag, 2)
  )
  return !(dot < 0 && perpDist < 6371)
}

// ─── ISRO ground stations ─────────────────────────────────────────────────────

export const ISRO_STATIONS: GroundStation[] = [
  { id: 'ISTRAC-BLR', name: 'ISTRAC Bangalore',          latitude_deg: 12.9716,  longitude_deg: 77.5946,  altitude_m: 920, min_elevation_deg: 5 },
  { id: 'ISTRAC-LKO', name: 'ISTRAC Lucknow',            latitude_deg: 26.8467,  longitude_deg: 80.9462,  altitude_m: 120, min_elevation_deg: 5 },
  { id: 'ISTRAC-MUS', name: 'ISTRAC Mauritius',          latitude_deg: -20.1609, longitude_deg: 57.4989,  altitude_m: 60,  min_elevation_deg: 5 },
  { id: 'ISTRAC-PBL', name: 'ISTRAC Port Blair',         latitude_deg: 11.6234,  longitude_deg: 92.7265,  altitude_m: 30,  min_elevation_deg: 5 },
  { id: 'ISTRAC-TVM', name: 'ISTRAC Thiruvananthapuram', latitude_deg: 8.5241,   longitude_deg: 76.9366,  altitude_m: 30,  min_elevation_deg: 5 },
]

// ─── Main predictor ───────────────────────────────────────────────────────────

export function predictPasses(
  norad_id:       number,
  satellite_name: string,
  tle_line1:      string,
  tle_line2:      string,
  station:        GroundStation,
  opts:           PassOptions = {}
): PassEvent[] {
  const WINDOW_HOURS = opts.window_hours      ?? 24
  const STEP_SEC     = opts.step_sec          ?? 10
  const MIN_EL       = opts.min_elevation_deg ?? station.min_elevation_deg

  const satrec = satellite.twoline2satrec(tle_line1, tle_line2)
  if (satrec.error !== 0) return []

  const observerGd: satellite.GeodeticLocation = {
    latitude:  degToRad(station.latitude_deg),
    longitude: degToRad(station.longitude_deg),
    height:    station.altitude_m / 1000,
  }

  const startMs = Date.now()
  const endMs   = startMs + WINDOW_HOURS * 3600 * 1000
  const stepMs  = STEP_SEC * 1000

  const passes: PassEvent[] = []
  let inPass    = false
  let passAOS:  Date | null = null
  let passAOSAz = 0
  let passTCA:  Date | null = null
  let maxEl     = -Infinity
  let maxElAz   = 0
  let minRange  = Infinity
  let passSunlit = false
  let prevLosAz  = 0

  for (let t = startMs; t <= endMs + stepMs; t += stepMs) {
    const date = new Date(t)
    const r    = propagateSafe(satrec, date)
    if (!r) continue

    const gmst       = satellite.gstime(date)
    const lookAngles = satellite.ecfToLookAngles(
      observerGd,
      satellite.eciToEcf(r.pos, gmst)
    )

    const elDeg   = radToDeg(lookAngles.elevation)
    const azDeg   = ((radToDeg(lookAngles.azimuth) % 360) + 360) % 360
    const rangekm = lookAngles.rangeSat

    if (!inPass && elDeg >= MIN_EL) {
      inPass     = true
      passAOS    = date
      passAOSAz  = azDeg
      maxEl      = elDeg
      maxElAz    = azDeg
      passTCA    = date
      minRange   = rangekm
      passSunlit = isSunlit(r.pos, date)

    } else if (inPass && elDeg >= MIN_EL) {
      if (elDeg > maxEl) { maxEl = elDeg; maxElAz = azDeg; passTCA = date }
      if (rangekm < minRange) minRange = rangekm
      prevLosAz = azDeg

    } else if (inPass && elDeg < MIN_EL) {
      inPass = false
      if (passAOS && passTCA) {
        const losDate  = new Date(t - stepMs)
        const duration = (losDate.getTime() - passAOS.getTime()) / 1000
        passes.push({
          station_id:        station.id,
          station_name:      station.name,
          norad_id,
          satellite_name,
          aos:               passAOS,
          tca:               passTCA,
          los:               losDate,
          duration_sec:      Math.round(duration),
          aos_azimuth_deg:   Math.round(passAOSAz * 10) / 10,
          max_elevation_deg: Math.round(maxEl     * 10) / 10,
          los_azimuth_deg:   Math.round(prevLosAz * 10) / 10,
          min_range_km:      Math.round(minRange),
          is_sunlit:         passSunlit,
        })
      }
      maxEl = -Infinity; minRange = Infinity
    }
  }

  return passes.sort((a, b) => a.aos.getTime() - b.aos.getTime())
}

export function predictPassesAllISRO(
  norad_id:       number,
  satellite_name: string,
  tle_line1:      string,
  tle_line2:      string,
  opts?:          PassOptions
): PassEvent[] {
  return ISRO_STATIONS
    .flatMap(s => predictPasses(norad_id, satellite_name, tle_line1, tle_line2, s, opts))
    .sort((a, b) => a.aos.getTime() - b.aos.getTime())
}