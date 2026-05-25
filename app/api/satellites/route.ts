/**
 * app/api/satellites/route.ts
 * Space Drishti — Satellite List Endpoint
 *
 * GET /api/satellites
 *
 * Query params (all optional):
 *   page      = 1              (pagination)
 *   limit     = 200            (max 500)
 *   category  = PAYLOAD | ROCKET_BODY | DEBRIS | UNKNOWN
 *   origin    = IND            (ISO 3-letter country code)
 *   active    = true | false
 *   search    = "starlink"     (name search, case-insensitive)
 *
 * Response:
 *   PaginatedResponse<SatelliteSummary>
 *
 * Caching strategy:
 *   - Edge cache: 5 minutes (CDN)
 *   - Stale-while-revalidate: 60 seconds
 *   - TLE data changes at most every 6-12 hours, so 5min cache is safe
 */

import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { supabase } from '@/lib/superbase'
import {
  satelliteListQuerySchema,
  type SatelliteSummary,
  type PaginatedResponse,
  type ApiError,
  type LatestTLERow,
} from '@/lib/validators'

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Parse + validate query params
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries())
    const params    = satelliteListQuerySchema.parse(rawParams)

    // 2. Build Supabase query on the latest_tle view
    //    (This view already does DISTINCT ON norad_id ORDER BY epoch DESC)
    let query = supabase
      .from('latest_tle')
      .select('*', { count: 'exact' })

    // Apply filters
    if (params.category) {
      query = query.eq('category', params.category)
    }
    if (params.origin) {
      query = query.eq('origin_country', params.origin)
    }
    if (params.active !== undefined) {
      query = query.eq('is_active', params.active)
    }
    if (params.search) {
      // Case-insensitive substring match on name
      query = query.ilike('name', `%${params.search}%`)
    }

    // Pagination
    const offset = (params.page - 1) * params.limit
    query = query
      .order('norad_id', { ascending: true })
      .range(offset, offset + params.limit - 1)

    // 3. Execute
    const { data, error, count } = await query

    if (error) {
      console.error('[/api/satellites] Supabase error:', error)
      return errorResponse('Database query failed', 'INTERNAL_ERROR', 500)
    }

    if (!data) {
      return errorResponse('No data returned', 'INTERNAL_ERROR', 500)
    }

    // 4. Shape the response — only send fields the frontend needs
    const rows = data as LatestTLERow[]
    const satellites: SatelliteSummary[] = rows.map(row => ({
      norad_id:            row.norad_id,
      name:                row.name,
      category:            row.category,
      origin_country:      row.origin_country,
      is_active:           row.is_active,
      object_type:         row.object_type,
      tle_line1:           row.tle_line1,
      tle_line2:           row.tle_line2,
      epoch:               row.epoch,
      altitude_perigee_km: row.altitude_perigee_km,
      altitude_apogee_km:  row.altitude_apogee_km,
      period_minutes:      row.period_minutes,
      inclination_deg:     row.inclination_deg,
    }))

    const total   = count ?? satellites.length
    const hasMore = offset + satellites.length < total

    // 5. Also return the latest sync timestamp (useful for the UI to show "data as of X")
    const { data: syncData } = await supabase
      .from('sync_logs')
      .select('finished_at')
      .eq('status', 'SUCCESS')
      .order('finished_at', { ascending: false })
      .limit(1)
      .single()

    const response: PaginatedResponse<SatelliteSummary> = {
      data:       satellites,
      pagination: {
        page:     params.page,
        limit:    params.limit,
        total,
        has_more: hasMore,
      },
      synced_at: syncData?.finished_at ?? null,
    }

    // 6. Return with cache headers
    //    - s-maxage=300       → CDN edge caches for 5 min
    //    - stale-while-revalidate=60 → serve stale while fetching fresh in background
    //    - public             → safe to cache (no user-specific data)
    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
        'X-Total-Count':  String(total),
        'X-Page':         String(params.page),
      },
    })

  } catch (err) {
    // Zod validation error
    if (err instanceof ZodError) {
      return errorResponse(
        'Invalid query parameters',
        'VALIDATION_ERROR',
        400,
        err.flatten().fieldErrors
      )
    }
    // Unexpected error
    console.error('[/api/satellites] Unexpected error:', err)
    return errorResponse('Internal server error', 'INTERNAL_ERROR', 500)
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function errorResponse(
  message:  string,
  code:     string,
  status:   number,
  details?: unknown
): NextResponse<ApiError> {
  return NextResponse.json({ error: message, code, details }, { status })
}

// ─── Route config ─────────────────────────────────────────────────────────────

export const runtime = 'edge'   // Run on Vercel Edge Network — fastest cold starts, global CDN

// Revalidate every 5 minutes when using Next.js App Router fetch caching
export const revalidate = 300