/**
 * app/api/conjunction/route.ts
 * Space Drishti — Conjunction Analysis API (Fixed)
 *
 * Fix: Supabase latest_tle VIEW returns all fields as `T | null` because
 * views don't have NOT NULL constraints in the generated types.
 * We guard every nullable field before passing to analyseConjunction().
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabase } from '@/lib/superbase'
import { analyseConjunction } from '@/lib/science/conjunction'
import type { TLEPair } from '@/lib/science/conjunction'

const bodySchema = z.object({
  norad_id:    z.number().int().positive(),
  window_days: z.number().int().min(1).max(7).default(3),
})

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json()
    const params = bodySchema.parse(body)

    // 1. Fetch target satellite
    const { data: target, error: targetErr } = await supabase
      .from('latest_tle')
      .select('norad_id, name, tle_line1, tle_line2, altitude_perigee_km, altitude_apogee_km')
      .eq('norad_id', params.norad_id)
      .single()

    if (targetErr || !target) {
      return NextResponse.json(
        { error: 'Satellite not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    // Guard: view fields can be null per generated types
    if (!target.norad_id || !target.name || !target.tle_line1 || !target.tle_line2) {
      return NextResponse.json(
        { error: 'Satellite has incomplete TLE data', code: 'INCOMPLETE_DATA' },
        { status: 422 }
      )
    }

    // 2. Fetch catalog — objects within ±200 km of target altitude
    const altMin = (target.altitude_perigee_km ?? 0) - 200
    const altMax = (target.altitude_apogee_km  ?? 0) + 200

    const { data: catalog } = await supabase
      .from('latest_tle')
      .select('norad_id, name, tle_line1, tle_line2')
      .neq('norad_id', params.norad_id)
      .gte('altitude_perigee_km', Math.max(0, altMin))
      .lte('altitude_apogee_km', altMax)
      .limit(300)

    if (!catalog || catalog.length === 0) {
      return NextResponse.json({
        data:          [],
        target_name:   target.name,
        catalog_size:  0,
        total_found:   0,
        window_days:   params.window_days,
        target_norad:  params.norad_id,
      })
    }

    // 3. Build TLEPair for target — fields already null-checked above
    const targetPair: TLEPair = {
      norad_id: target.norad_id,          // number (not null after guard)
      name:     target.name,              // string (not null after guard)
      line1:    target.tle_line1,         // string (not null after guard)
      line2:    target.tle_line2,         // string (not null after guard)
    }

    // 4. Run conjunction analysis — skip catalog rows with missing TLE
    const results = []
    for (const obj of catalog) {
      // Skip any catalog entry that has null fields (view can return nulls)
      if (!obj.norad_id || !obj.name || !obj.tle_line1 || !obj.tle_line2) continue

      const other: TLEPair = {
        norad_id: obj.norad_id,    // number
        name:     obj.name,        // string
        line1:    obj.tle_line1,   // string
        line2:    obj.tle_line2,   // string
      }

      const result = analyseConjunction(targetPair, other, {
        window_days: params.window_days,
      })
      if (result) results.push(result)
    }

    results.sort((a, b) => a.miss_distance_km - b.miss_distance_km)

    // 5. Persist critical/warning events to DB
    const actionable = results.filter(r => r.severity !== 'NOMINAL')
    if (actionable.length > 0) {
      await supabase.from('conjunction_events').upsert(
        actionable.map(r => ({
          object1_norad_id:         r.object1_norad_id,
          object2_norad_id:         r.object2_norad_id,
          tca:                      r.tca.toISOString(),
          miss_distance_km:         r.miss_distance_km,
          relative_speed_km_s:      r.relative_speed_km_s,
          probability_of_collision: r.probability_of_collision,
          is_actionable:            r.severity === 'CRITICAL',
          source:                   'COMPUTED',
          computed_at:              r.computed_at.toISOString(),
        })),
        { onConflict: 'object1_norad_id,object2_norad_id,tca' }
      )
    }

    return NextResponse.json({
      target_name:  target.name,
      target_norad: params.norad_id,
      window_days:  params.window_days,
      catalog_size: catalog.length,
      total_found:  results.length,
      data: results.map(r => ({
        ...r,
        tca:         r.tca.toISOString(),
        computed_at: r.computed_at.toISOString(),
      })),
    })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request body', code: 'VALIDATION_ERROR', details: err.flatten() },
        { status: 400 }
      )
    }
    console.error('[/api/conjunction]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}