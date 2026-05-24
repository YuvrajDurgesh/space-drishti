/**
 * app/api/satellite/[norad_id]/route.ts
 * Space Drishti — Single Satellite Detail + Ephemeris
 *
 * GET /api/satellite/25544
 *   → Full metadata for ISS (NORAD ID 25544)
 *
 * GET /api/satellite/25544?at=2024-01-15T12:00:00Z
 *   → Metadata + ECI position at that specific time
 *
 * GET /api/satellite/25544?trail_minutes=90&trail_step_sec=60
 *   → Metadata + 90-minute orbital trail (90 points)
 *
 * Query params (all optional):
 *   at               = ISO 8601 timestamp (defaults to now)
 *   trail_minutes    = 0..200  (0 = no trail, default)
 *   trail_step_sec   = 10..300 (seconds between trail points, default 60)
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { supabase } from "@/lib/superbase";
import { propagate, generateTrail } from "@/lib/propagator";
import {
  ephemerisQuerySchema,
  type SatelliteDetail,
  type EphemerisResponse,
  type ApiError,
} from "@/lib/validators";

// ─── Route params type ────────────────────────────────────────────────────────

interface RouteParams {
  params: {
    norad_id: string;
  };
}

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
   context: { params: Promise<{ norad_id: string }> }
//   { params }: RouteParams,
): Promise<NextResponse> {
  try {
    const { norad_id } = await context.params; // 👈 IMPORTANT
    // 1. Parse + validate norad_id from path
    const noradId = parseInt(norad_id, 10);
    // console.log(`Received request for NORAD ID: ${noradId}`);
    if (isNaN(noradId) || noradId <= 0) {
        // console.warn(`Invalid NORAD ID: ${params.norad_id}`);
      return errorResponse(
        "norad_id must be a positive integer",
        "VALIDATION_ERROR",
        400,
      );
    }

    // 2. Parse + validate query params
    const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const ephemerisParams = ephemerisQuerySchema.parse(rawParams);

    // 3. Fetch full satellite detail from DB
    //    Join satellites + latest TLE in one query
    const { data: satRow, error: satError } = await supabase
      .from("latest_tle")
      .select(
        `
        norad_id, name, category, origin_country, is_active, object_type,
        tle_line1, tle_line2, epoch,
        inclination_deg, altitude_perigee_km, altitude_apogee_km, period_minutes,
        synced_at
      `,
      )
      .eq("norad_id", noradId)
      .single();

    if (satError || !satRow) {
      return errorResponse(
        `Satellite with NORAD ID ${noradId} not found`,
        "NOT_FOUND",
        404,
      );
    }

    // Fetch extended fields from satellites master table
    const { data: masterRow } = await supabase
      .from("satellites")
      .select(
        `
        international_id, launch_date, launch_site, decay_date, rcs_size
      `,
      )
      .eq("norad_id", noradId)
      .single();

    // Fetch extended TLE fields from tle_history
    const { data: tleRow } = await supabase
      .from("tle_history")
      .select(
        `
        bstar_drag, eccentricity, raan_deg, arg_perigee_deg,
        mean_anomaly_deg, mean_motion_rpm
      `,
      )
      .eq("norad_id", noradId)
      .order("epoch", { ascending: false })
      .limit(1)
      .single();

    if (
      !satRow.norad_id ||
      !satRow.name ||
      !satRow.category ||
      !satRow.tle_line1 ||
      !satRow.tle_line2 ||
      !satRow.epoch ||
      !satRow.is_active
    ) {
      return errorResponse("Incomplete satellite data", "DATA_ERROR", 500);
    }

    // 4. Build detail response
    const detail: SatelliteDetail = {
      norad_id: satRow.norad_id,
      name: satRow.name,
      category: satRow.category,
      origin_country: satRow.origin_country,
      is_active: satRow.is_active,
      object_type: satRow.object_type,
      tle_line1: satRow.tle_line1,
      tle_line2: satRow.tle_line2,
      epoch: satRow.epoch,
      altitude_perigee_km: satRow.altitude_perigee_km,
      altitude_apogee_km: satRow.altitude_apogee_km,
      period_minutes: satRow.period_minutes,
      inclination_deg: satRow.inclination_deg,
      // From master table
      international_id: masterRow?.international_id ?? null,
      launch_date: masterRow?.launch_date ?? null,
      launch_site: masterRow?.launch_site ?? null,
      decay_date: masterRow?.decay_date ?? null,
      rcs_size: masterRow?.rcs_size ?? null,
      // From TLE history
      bstar_drag: tleRow?.bstar_drag ?? null,
      eccentricity: tleRow?.eccentricity ?? null,
      raan_deg: tleRow?.raan_deg ?? null,
      arg_perigee_deg: tleRow?.arg_perigee_deg ?? null,
      mean_anomaly_deg: tleRow?.mean_anomaly_deg ?? null,
      mean_motion_rpm: tleRow?.mean_motion_rpm ?? null,
    };

    // 5. Compute ephemeris (position at requested time)
    const at = ephemerisParams.at ? new Date(ephemerisParams.at) : new Date();
    const tle = { line1: satRow.tle_line1, line2: satRow.tle_line2 };

    const posResult = propagate(tle, { at });
    if (!posResult.success) {
      return errorResponse(
        `Ephemeris computation failed: ${posResult.error}`,
        "PROPAGATION_ERROR",
        422, // Unprocessable — data is valid but computation failed (likely old TLE)
      );
    }

    // 6. Compute orbital trail if requested
    // let trail = [];
    let trail: any[] = []
    if (ephemerisParams.trail_minutes > 0) {
      trail = generateTrail(tle, {
        start: at,
        durationMinutes: ephemerisParams.trail_minutes,
        stepSeconds: ephemerisParams.trail_step_sec,
      });
    }

    // 7. Build ephemeris response
    const ephemeris: EphemerisResponse = {
      norad_id: noradId,
      name: satRow.name,
      at: {
        timestamp: at.toISOString(),
        eci: posResult.eci,
        velocity: posResult.velocity,
        geodetic: posResult.geodetic,
      },
      trail,
    };

    // 8. Return combined response
    const response = {
      satellite: detail,
      ephemeris,
    };

    // Cache for 30 seconds — ephemeris is time-sensitive
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=10",
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return errorResponse(
        "Invalid query parameters",
        "VALIDATION_ERROR",
        400,
        // err.issues,
        err.flatten().fieldErrors,
      );
    }
    console.error(`[/api/satellite/${(await context.params).norad_id}] Unexpected error:`, err);
    return errorResponse("Internal server error", "INTERNAL_ERROR", 500);
  }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function errorResponse(
  message: string,
  code: string,
  status: number,
  details?: unknown,
): NextResponse<ApiError> {
  return NextResponse.json({ error: message, code, details }, { status });
}

// ─── Route config ─────────────────────────────────────────────────────────────

export const runtime = "edge";
