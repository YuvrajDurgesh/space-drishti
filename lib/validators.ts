/**
 * lib/validators.ts
 * Space Drishti — Zod schemas + TypeScript types
 *
 * Single source of truth for:
 *  - API query parameter validation
 *  - Response shape types (what the API returns to the frontend)
 *  - Internal DB row types (what we get from Supabase)
 */

import { z } from 'zod'

// ─── API Query Parameter Schemas ──────────────────────────────────────────────

export const satelliteListQuerySchema = z.object({
  // Pagination
  page:     z.coerce.number().int().min(1).default(1),
  limit:    z.coerce.number().int().min(1).max(500).default(200),

  // Filters
  category: z.enum(['PAYLOAD', 'ROCKET_BODY', 'DEBRIS', 'UNKNOWN']).optional(),
  origin:   z.string().length(3).toUpperCase().optional(),   // ISO alpha-3, e.g. "IND"
  active:   z.enum(['true', 'false']).transform(v => v === 'true').optional(),

  // Bounding box filter for visible viewport (used by 3D frontend to fetch only visible region)
  // Not applied server-side right now — placeholder for future spatial query
  // lat_min, lat_max, etc.

  // Search by name
  search:   z.string().max(100).optional(),
}).strict()

export type SatelliteListQuery = z.infer<typeof satelliteListQuerySchema>

// Single satellite detail query
export const satelliteDetailQuerySchema = z.object({
  norad_id: z.coerce.number().int().positive(),
}).strict()

// Ephemeris query — get satellite position at a given time
export const ephemerisQuerySchema = z.object({
  // ISO 8601 timestamp — defaults to "now"
  at: z.string().datetime({ message: 'at must be a valid ISO 8601 timestamp' }).optional(),
  // How many minutes ahead to propagate (for orbit trail)
  trail_minutes: z.coerce.number().int().min(0).max(200).default(0),
  trail_step_sec: z.coerce.number().int().min(10).max(300).default(60),
})//.strict()

export type EphemerisQuery = z.infer<typeof ephemerisQuerySchema>

// ─── Response Types (what the API returns) ───────────────────────────────────

/** Minimal satellite record — used in the list endpoint for 3D rendering */
export interface SatelliteSummary {
  norad_id:            number
  name:                string
  category:            string
  origin_country:      string | null
  is_active:           boolean
  object_type:         string | null
  tle_line1:           string
  tle_line2:           string
  epoch:               string         // ISO 8601
  altitude_perigee_km: number | null
  altitude_apogee_km:  number | null
  period_minutes:      number | null
  inclination_deg:     number | null
}

/** Full satellite record — used in the detail endpoint */
export interface SatelliteDetail extends SatelliteSummary {
  international_id:    string | null
  launch_date:         string | null
  launch_site:         string | null
  decay_date:          string | null
  rcs_size:            string | null
  bstar_drag:          number | null
  eccentricity:        number | null
  raan_deg:            number | null
  arg_perigee_deg:     number | null
  mean_anomaly_deg:    number | null
  mean_motion_rpm:     number | null
}

/** ECI position/velocity at a given timestamp */
export interface EphemerisPoint {
  timestamp:   string   // ISO 8601
  eci: {
    x_km: number        // ECI X coordinate
    y_km: number        // ECI Y coordinate
    z_km: number        // ECI Z coordinate
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

/** Ephemeris response — single point + optional trail */
export interface EphemerisResponse {
  norad_id:   number
  name:       string
  at:         EphemerisPoint       // position at requested time
  trail:      EphemerisPoint[]     // orbital trail points
}

/** Paginated list response wrapper */
export interface PaginatedResponse<T> {
  data:       T[]
  pagination: {
    page:       number
    limit:      number
    total:      number
    has_more:   boolean
  }
  synced_at:  string | null   // timestamp of last TLE sync
  cache_age_seconds?: number
}

/** Standard API error response */
export interface ApiError {
  error:   string
  code:    string    // machine-readable: "VALIDATION_ERROR" | "NOT_FOUND" | "INTERNAL_ERROR"
  details?: unknown  // Zod issues, etc.
}

// ─── DB Row Types (from Supabase latest_tle view) ────────────────────────────

export interface LatestTLERow {
  norad_id:            number
  name:                string
  category:            string
  origin_country:      string | null
  is_active:           boolean
  object_type:         string | null
  tle_line1:           string
  tle_line2:           string
  epoch:               string
  inclination_deg:     number | null
  altitude_perigee_km: number | null
  altitude_apogee_km:  number | null
  period_minutes:      number | null
  synced_at:           string
}