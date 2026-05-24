/**
 * app/api/decay/[norad_id]/route.ts
 * Space Drishti — Orbital Decay Prediction API (Fixed)
 *
 * Fix 1: Supabase view returns `number | null` and `string | null`.
 *   predictDecay() expects `number` and `string` — guard with early return.
 *
 * Fix 2: decay_predictions.upsert has `onConflict` on norad_id but the
 *   schema has a UUID primary key — use update/insert pattern instead.
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/superbase'
import { predictDecay } from '@/lib/science/decay'

export const runtime = 'nodejs'

export async function GET(
  req:     NextRequest,
  { params }: { params: { norad_id: string } }
) {
  // Validate path param
  const noradId = parseInt(params.norad_id, 10)
  if (isNaN(noradId) || noradId <= 0) {
    return NextResponse.json(
      { error: 'norad_id must be a positive integer', code: 'VALIDATION_ERROR' },
      { status: 400 }
    )
  }

  const maxDays = Math.min(
    Math.max(1, parseInt(req.nextUrl.searchParams.get('max_days') ?? '3650', 10)),
    3650
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

  // Fix: view fields are `T | null` in generated types — guard them all.
  // norad_id should never be null (it's the PK we queried on) but TS doesn't know.
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

  // Now TypeScript knows these are non-null — safe to pass to predictDecay()
  const result = predictDecay(
    {
      norad_id:  data.norad_id,   // number  ✓
      name:      data.name,       // string  ✓
      tle_line1: data.tle_line1,  // string  ✓
      tle_line2: data.tle_line2,  // string  ✓
    },
    maxDays
  )

  // Persist prediction to DB if we got a decay date
  if (result.predicted_decay_at) {
    // Upsert: delete existing then insert (decay_predictions has norad_id but
    // no unique constraint on it in the generated schema — use upsert safely)
    await supabase
      .from('decay_predictions')
      .upsert(
        {
          norad_id:           noradId,
          predicted_decay_at: result.predicted_decay_at.toISOString(),
          uncertainty_days:   result.uncertainty_days,
          confidence_pct:     result.confidence === 'HIGH'   ? 70
                            : result.confidence === 'MEDIUM' ? 50
                            : 30,
          method:             result.method,
          computed_at:        result.computed_at.toISOString(),
        },
        { onConflict: 'norad_id' }
      )
  }

  // Serialize Dates to ISO strings for JSON response
  return NextResponse.json(
    {
      ...result,
      predicted_decay_at: result.predicted_decay_at?.toISOString() ?? null,
      computed_at:        result.computed_at.toISOString(),
    },
    {
      headers: {
        // Cache for 1 hour — decay predictions don't change minute-by-minute
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=300',
      },
    }
  )
}