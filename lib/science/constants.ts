/**
 * lib/science/constants.ts
 * Space Drishti — Physical & orbital constants
 * Single source of truth — imported by all science modules.
 */

export const EARTH_RADIUS_KM     = 6371.0        // mean Earth radius
export const GM_EARTH             = 398600.4418   // gravitational parameter km³/s²
export const J2                   = 1.08262668e-3 // second zonal harmonic (oblateness)
export const SECONDS_PER_DAY      = 86400
export const TWO_PI               = 2 * Math.PI

// Atmosphere model constants (exponential density model for decay estimates)
// Source: USSA 1976, simplified two-band fit
export const ATMO_BANDS = [
  // { baseAlt_km, scaleHeight_km, baseDensity_kg_m3 }
  { baseAlt: 100, scaleHeight: 6.0,  baseDensity: 5.60e-7  },
  { baseAlt: 200, scaleHeight: 11.8, baseDensity: 2.79e-10 },
  { baseAlt: 300, scaleHeight: 22.2, baseDensity: 1.92e-11 },
  { baseAlt: 400, scaleHeight: 34.6, baseDensity: 2.80e-12 },
  { baseAlt: 500, scaleHeight: 54.8, baseDensity: 5.22e-13 },
  { baseAlt: 600, scaleHeight: 89.5, baseDensity: 1.14e-13 },
] as const

// Warning thresholds
export const CONJUNCTION_WARN_KM  = 10    // alert if objects come within 10 km
export const CONJUNCTION_CRIT_KM  = 1     // critical if within 1 km
export const DECAY_WARN_ALT_KM    = 300   // flag objects below 300 km perigee