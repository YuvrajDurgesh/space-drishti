/**
 * app/api/passes/[norad_id]/route.ts
 * Space Drishti — Pass Prediction API (Fixed)
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/superbase'
import {
  predictPasses,
  predictPassesAllISRO,
  ISRO_STATIONS,
} from '@/lib/science/passes'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ norad_id: string }> }
) {
  const { norad_id: norad_id_str } = await context.params
  const noradId = parseInt(norad_id_str, 10)

  if (isNaN(noradId) || noradId <= 0) {
    return NextResponse.json(
      { error: 'norad_id must be a positive integer', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const stationId   = req.nextUrl.searchParams.get('station')
  const windowHours = Math.min(
    Math.max(1, parseInt(req.nextUrl.searchParams.get('hours') ?? '24', 10)),
    72
  )

  // Fetch TLE from latest_tle view
  const { data, error } = await supabase
    .from('latest_tle')
    .select('norad_id, name, tle_line1, tle_line2')
    .eq('norad_id', noradId)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Satellite not found', code: 'NOT_FOUND' },
      { status: 404 }
    )
  }

  // Guard all nullable view fields
  if (
    data.norad_id  == null ||
    data.name      == null ||
    data.tle_line1 == null ||
    data.tle_line2 == null
  ) {
    return NextResponse.json(
      { error: 'Satellite has incomplete TLE data', code: 'INCOMPLETE_DATA' },
      { status: 422 }
    )
  }

  const satelliteNoradId = data.norad_id   // number
  const name             = data.name       // string
  const tle_line1        = data.tle_line1  // string
  const tle_line2        = data.tle_line2  // string

  // Validate station if provided
  if (stationId) {
    const station = ISRO_STATIONS.find(s => s.id === stationId)
    if (!station) {
      return NextResponse.json(
        {
          error:              `Unknown station: ${stationId}`,
          code:               'NOT_FOUND',
          available_stations: ISRO_STATIONS.map(s => ({ id: s.id, name: s.name })),
        },
        { status: 404 }
      )
    }

    const passes = predictPasses(
      satelliteNoradId, name, tle_line1, tle_line2,
      station,
      { window_hours: windowHours }
    )

    return NextResponse.json(
      {
        norad_id:     satelliteNoradId,
        satellite:    name,
        window_hours: windowHours,
        station:      stationId,
        total_passes: passes.length,
        data: passes.map(p => ({
          ...p,
          aos: p.aos.toISOString(),
          tca: p.tca.toISOString(),
          los: p.los.toISOString(),
        })),
        stations: ISRO_STATIONS.map(s => ({ id: s.id, name: s.name })),
      },
      {
        headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
      }
    )
  }

  // No station specified — predict for ALL ISRO stations
  const passes = predictPassesAllISRO(
    satelliteNoradId, name, tle_line1, tle_line2,
    { window_hours: windowHours }
  )

  return NextResponse.json(
    {
      norad_id:     satelliteNoradId,
      satellite:    name,
      window_hours: windowHours,
      station:      'ALL_ISRO',
      total_passes: passes.length,
      data: passes.map(p => ({
        ...p,
        aos: p.aos.toISOString(),
        tca: p.tca.toISOString(),
        los: p.los.toISOString(),
      })),
      stations: ISRO_STATIONS.map(s => ({ id: s.id, name: s.name })),
    },
    {
      headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60' },
    }
  )
  
}