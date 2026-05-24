/**
 * lib/science/decay.ts
 * Space Drishti — Orbital Decay Predictor
 *
 * Method: Semi-analytical using BSTAR drag term from TLE.
 *
 * Physics:
 *  - Drag force ∝ atmospheric density × velocity² × Cd × A/m
 *  - BSTAR = (½ × Cd × A/m × ρ₀) in units of 1/Earth-radii
 *  - Each orbit, semi-major axis decreases by Δa ≈ -2π × BSTAR × ρ/ρ₀ × a²
 *  - We numerically integrate this decay forward in time until perigee < 80 km
 *
 * Accuracy:
 *  - ±30% for objects below 400 km with well-known BSTAR
 *  - Much less accurate above 600 km (atmospheric density very uncertain)
 *  - Solar activity (F10.7 index) not modelled — adds significant uncertainty
 *
 * Not suitable for operational re-entry prediction — use USSTRATCOM CDMs.
 * Educational / research use only.
 */

import * as satellite from 'satellite.js'
import {
  EARTH_RADIUS_KM,
  GM_EARTH,
  ATMO_BANDS,
  SECONDS_PER_DAY,
  TWO_PI,
} from './constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DecayInput {
  norad_id:   number
  name:       string
  tle_line1:  string
  tle_line2:  string
}

export interface DecayResult {
  norad_id:            number
  name:                string
  // Current state
  perigee_km:          number
  apogee_km:           number
  period_min:          number
  bstar:               number
  // Prediction
  predicted_decay_at:  Date | null   // null = not decaying in foreseeable future
  days_until_decay:    number | null
  uncertainty_days:    number | null // ±window
  // History trail (one point per day for sparkline chart)
  altitude_trail:      { day: number; perigee_km: number; apogee_km: number }[]
  // Meta
  method:              'BSTAR_NUMERICAL'
  confidence:          'HIGH' | 'MEDIUM' | 'LOW'
  computed_at:         Date
  warning?:            string
}

// ─── Atmosphere model ─────────────────────────────────────────────────────────

/**
 * Exponential atmospheric density at a given altitude (kg/m³).
 * Uses a simple multi-band model fit to USSA 1976.
 */
function atmosphericDensity(alt_km: number): number {
  if (alt_km < 100) return 1e-3   // below Karman line — irrelevant but non-zero
  if (alt_km > 2000) return 1e-25 // effectively zero above 2000 km

  let band = ATMO_BANDS[ATMO_BANDS.length - 1]
  for (let i = ATMO_BANDS.length - 1; i >= 0; i--) {
    if (alt_km >= ATMO_BANDS[i].baseAlt) { band = ATMO_BANDS[i]; break }
  }
  return band.baseDensity * Math.exp(-(alt_km - band.baseAlt) / band.scaleHeight)
}

// ─── Orbital mechanics helpers ─────────────────────────────────────────────────

/** Semi-major axis from mean motion (rev/day) → km */
function smaFromMeanMotion(meanMotion_revperday: number): number {
  const n = meanMotion_revperday * TWO_PI / SECONDS_PER_DAY  // rad/s
  return Math.cbrt(GM_EARTH / (n * n))
}

/** Orbital period in seconds from semi-major axis */
function periodFromSMA(sma_km: number): number {
  return TWO_PI * Math.sqrt(sma_km ** 3 / GM_EARTH)
}

/** Altitude above Earth surface */
function toAlt(radius_km: number): number {
  return radius_km - EARTH_RADIUS_KM
}

// ─── Main decay predictor ─────────────────────────────────────────────────────

/**
 * Predict orbital decay for a single object using its TLE BSTAR.
 *
 * @param input  - satellite TLE pair
 * @param maxDays - how many days to simulate (default 3650 = 10 years)
 * @returns      DecayResult with predicted re-entry date
 *
 * @example
 * const result = predictDecay({ norad_id: 25544, name: 'ISS', tle_line1, tle_line2 })
 * console.log(`ISS decays in ${result.days_until_decay} days`)
 */
export function predictDecay(
  input: DecayInput,
  maxDays = 3650
): DecayResult {
  const satrec = satellite.twoline2satrec(input.tle_line1, input.tle_line2)

  // Extract orbital elements from satrec
  const meanMotion_radpermin = satrec.no          // rad/min
  const meanMotion_revperday = meanMotion_radpermin * (1440 / TWO_PI)
  const eccentricity         = satrec.ecco
  const bstar                = satrec.bstar        // 1/earth-radii
  const bstar_km             = bstar / EARTH_RADIUS_KM  // convert to 1/km

  const sma_km       = smaFromMeanMotion(meanMotion_revperday)
  const perigee_km   = toAlt(sma_km * (1 - eccentricity))
  const apogee_km    = toAlt(sma_km * (1 + eccentricity))
  const period_min   = periodFromSMA(sma_km) / 60

  const now = Date.now()
  const computed_at = new Date(now)

  // If BSTAR is zero or negative, no drag → no meaningful decay prediction
  if (bstar <= 0 || perigee_km > 2000) {
    return {
      norad_id: input.norad_id, name: input.name,
      perigee_km, apogee_km, period_min, bstar,
      predicted_decay_at: null, days_until_decay: null, uncertainty_days: null,
      altitude_trail: [],
      method: 'BSTAR_NUMERICAL',
      confidence: 'LOW',
      computed_at,
      warning: perigee_km > 2000
        ? 'Object above 2000 km — atmospheric drag negligible'
        : 'BSTAR is zero or negative — no drag data available',
    }
  }

  // ── Numerical integration (Euler method, 1 orbit per step) ───────────────
  // State: semi-major axis (km), eccentricity (treated as constant)
  // At each orbit, compute drag-induced Δa

  let a     = sma_km
  let e     = eccentricity
  let t_day = 0
  const DECAY_ALT_KM = 80   // re-entry threshold

  const trail: { day: number; perigee_km: number; apogee_km: number }[] = []
  let lastTrailDay = -1
  const TRAIL_INTERVAL_DAYS = Math.max(1, Math.floor(maxDays / 365))

  while (t_day < maxDays) {
    const perigee = toAlt(a * (1 - e))
    const apogee  = toAlt(a * (1 + e))

    // Record trail point daily (or at interval)
    const trailDay = Math.floor(t_day)
    if (trailDay > lastTrailDay && trailDay % TRAIL_INTERVAL_DAYS === 0) {
      trail.push({ day: trailDay, perigee_km: Math.round(perigee), apogee_km: Math.round(apogee) })
      lastTrailDay = trailDay
    }

    // Decay condition
    if (perigee <= DECAY_ALT_KM) break

    // Orbital period (seconds) at current SMA
    const T = periodFromSMA(a)

    // Mean altitude for density: use geometric mean of perigee and apogee
    const mean_alt = (perigee + apogee) / 2

    // Atmospheric density at mean altitude
    const rho = atmosphericDensity(mean_alt)

    // Drag-induced semi-major axis decay per orbit (Hill & Mishne simplified):
    // Δa = -2π × B* × ρ/ρ_ref × a² × (1 + 3e²/2)
    // where ρ_ref = 1 (normalised via BSTAR encoding)
    // Here we approximate and use a direct formulation:
    // da/dt = -2 × BSTAR_km × ρ × v × a   (energy method)
    const v_km_s = Math.sqrt(GM_EARTH / a)   // mean circular velocity
    const da_per_orbit = -TWO_PI * bstar_km * rho * 1e9 * v_km_s * a
    // Note: rho is in kg/m³, need km-consistent units → ×1e9 converts kg/m³→kg/km³

    // Advance by one orbit
    a += da_per_orbit
    t_day += T / SECONDS_PER_DAY

    // Eccentricity slowly circularises due to lower perigee drag (simplified)
    if (e > 0.001) e *= 0.9999

    if (a < EARTH_RADIUS_KM) break  // numerical runaway guard
  }

  const decays      = t_day < maxDays
  const decayDate   = decays ? new Date(now + t_day * SECONDS_PER_DAY * 1000) : null
  const uncertainty = decays ? Math.max(1, t_day * 0.3) : null  // ±30%

  // Confidence rating
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW'
  if (perigee_km < 300 && bstar > 1e-5)  confidence = 'HIGH'
  else if (perigee_km < 500 && bstar > 1e-6) confidence = 'MEDIUM'

  return {
    norad_id:           input.norad_id,
    name:               input.name,
    perigee_km:         Math.round(perigee_km),
    apogee_km:          Math.round(apogee_km),
    period_min:         Math.round(period_min * 10) / 10,
    bstar,
    predicted_decay_at: decayDate,
    days_until_decay:   decays ? Math.round(t_day) : null,
    uncertainty_days:   uncertainty ? Math.round(uncertainty) : null,
    altitude_trail:     trail,
    method:             'BSTAR_NUMERICAL',
    confidence,
    computed_at,
    warning: !decays
      ? `No re-entry predicted within ${maxDays} days`
      : undefined,
  }
}