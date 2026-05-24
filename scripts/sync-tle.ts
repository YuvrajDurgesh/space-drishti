/**
 * scripts/sync-tle.ts
 * Space Drishti — TLE Sync Engine (Fixed)
 *
 * Fix: OBJECT_TYPE_MAP now handles all actual Space-Track values:
 *   "PAYLOAD", "ROCKET BODY", "DEBRIS", "TBA", "UNKNOWN", "R/B", "DEB"
 * Previous version had "R/B" and "DEB" which Space-Track never sends.
 * Actual values are full words: "ROCKET BODY", "DEBRIS", etc.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
// import axios, { AxiosInstance } from "axios";
import axios from "axios";
import type { AxiosInstance } from "axios"; // 'type' keyword lagane se TS khush ho jayega
import * as https from "https";
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })


// ─── Types ────────────────────────────────────────────────────────────────────

interface SpaceTrackTLE {
  NORAD_CAT_ID: string;
  OBJECT_NAME: string;
  OBJECT_TYPE: string; // "PAYLOAD" | "ROCKET BODY" | "DEBRIS" | "TBA" | "UNKNOWN"
  CLASSIFICATION_TYPE: string;
  INTLDES: string;
  EPOCH: string;
  MEAN_MOTION: string;
  ECCENTRICITY: string;
  INCLINATION: string;
  RA_OF_ASC_NODE: string;
  ARG_OF_PERICENTER: string;
  MEAN_ANOMALY: string;
  EPHEMERIS_TYPE: string;
  ELEMENT_SET_NO: string;
  REV_AT_EPOCH: string;
  BSTAR: string;
  MEAN_MOTION_DOT: string;
  MEAN_MOTION_DDOT: string;
  TLE_LINE1: string;
  TLE_LINE2: string;
  LAUNCH_DATE: string | null;
  DECAY_DATE: string | null;
  RCS_SIZE: string;
  COUNTRY_CODE: string;
  SITE: string;
  CCSDS_OMM_VERS: string;
  COMMENT: string;
  ORIGINATOR: string;
  FILE: string;
  GP_ID: string;
  APOAPSIS: string;
  PERIAPSIS: string;
  PERIOD: string;
  SEMIMAJOR_AXIS: string;
}

interface SyncResult {
  fetched: number;
  upserted: number;
  failed: number;
  errors: string[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG = {
  SPACETRACK_BASE: "https://www.space-track.org",
  SPACETRACK_LOGIN: "/ajaxauth/login",
  SPACETRACK_QUERY:
    "/basicspacedata/query/class/gp/decay_date/null-val/orderby/norad_cat_id/format/json",
  BATCH_SIZE: 500,
  REQUEST_TIMEOUT: 60000,
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,
} as const;

// ─── FIXED: Object type map ───────────────────────────────────────────────────
// These are the ACTUAL strings Space-Track sends in OBJECT_TYPE field.
// Verified by looking at real API responses.

function mapObjectType(raw: string | null | undefined): string {
  if (!raw) return "UNKNOWN";

  // Normalize: uppercase, trim whitespace
  const s = raw.toUpperCase().trim();

  switch (s) {
    case "PAYLOAD":
      return "PAYLOAD";
    case "ROCKET BODY":
      return "ROCKET_BODY"; // ← Space-Track sends this, NOT "R/B"
    case "DEBRIS":
      return "DEBRIS"; // ← Space-Track sends this, NOT "DEB"
    case "TBA":
      return "UNKNOWN";
    case "UNKNOWN":
      return "UNKNOWN";
    // Legacy / edge cases just in case
    case "R/B":
      return "ROCKET_BODY";
    case "DEB":
      return "DEBRIS";
    default:
      // Log unmapped types so we can catch new ones in future
      console.warn(`[sync] Unmapped OBJECT_TYPE: "${raw}" — saving as UNKNOWN`);
      return "UNKNOWN";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  retries = CONFIG.MAX_RETRIES,
  delayMs = CONFIG.RETRY_DELAY_MS,
  label = "operation",
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[retry] ${label} attempt ${attempt}/${retries}: ${msg}`);
      if (attempt === retries) throw err;
      await sleep(delayMs * attempt);
    }
  }
  throw new Error(`${label}: unreachable`);
}

function parseISODate(val: string | null | undefined): string | null {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    chunks.push(arr.slice(i, i + size));
  return chunks;
}

// ─── Space-Track Client ───────────────────────────────────────────────────────

class SpaceTrackClient {
  private http: AxiosInstance;
  private cookie: string | null = null;

  constructor() {
    this.http = axios.create({
      baseURL: CONFIG.SPACETRACK_BASE,
      timeout: CONFIG.REQUEST_TIMEOUT,
      httpsAgent: new https.Agent({ keepAlive: true }),
      withCredentials: true,
    });
  }

  async login(): Promise<void> {
    const user = process.env.SPACETRACK_USER;
    const pass = process.env.SPACETRACK_PASS;
    if (!user || !pass)
      throw new Error("SPACETRACK_USER and SPACETRACK_PASS required");

    console.log("[space-track] Authenticating...");
    const resp = await this.http.post(
      CONFIG.SPACETRACK_LOGIN,
      `identity=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
    );

    const setCookie = resp.headers["set-cookie"];
    if (!setCookie?.length)
      throw new Error("Login failed — no session cookie. Check credentials.");
    this.cookie = setCookie.map((c: string) => c.split(";")[0]).join("; ");
    console.log("[space-track] Login successful");
  }

  async fetchAllTLEs(): Promise<SpaceTrackTLE[]> {
    if (!this.cookie) throw new Error("Not logged in");

    console.log("[space-track] Fetching full catalog (30-60s)...");
    const resp = await withRetry(
      () =>
        this.http.get<SpaceTrackTLE[]>(CONFIG.SPACETRACK_QUERY, {
          headers: { Cookie: this.cookie! },
          maxContentLength: 50 * 1024 * 1024,
        }),
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY_MS,
      "fetchAllTLEs",
    );

    if (!Array.isArray(resp.data))
      throw new Error(`Unexpected response: ${typeof resp.data}`);
    console.log(`[space-track] Fetched ${resp.data.length} objects`);
    return resp.data;
  }

  async logout(): Promise<void> {
    try {
      await this.http.get("/ajaxauth/logout", {
        headers: { Cookie: this.cookie ?? "" },
      });
    } catch {
      /* non-critical */
    }
    this.cookie = null;
  }
}

// ─── Data Transformers ────────────────────────────────────────────────────────

function toSatelliteRow(obj: SpaceTrackTLE) {
  const category = mapObjectType(obj.OBJECT_TYPE);

  return {
    norad_id: parseInt(obj.NORAD_CAT_ID, 10),
    name: obj.OBJECT_NAME.trim(),
    international_id: obj.INTLDES?.trim() || null,
    category, // ← now correctly mapped
    origin_country: obj.COUNTRY_CODE?.trim() || null,
    launch_date: parseISODate(obj.LAUNCH_DATE)?.split("T")[0] ?? null,
    launch_site: obj.SITE?.trim() || null,
    decay_date: parseISODate(obj.DECAY_DATE)?.split("T")[0] ?? null,
    object_type: obj.OBJECT_TYPE?.trim() || null, // keep raw value for debugging
    rcs_size: obj.RCS_SIZE?.trim() || null,
    is_active: category === "PAYLOAD" && !obj.DECAY_DATE,
    updated_at: new Date().toISOString(),
  };
}

function toTLEHistoryRow(obj: SpaceTrackTLE) {
  return {
    norad_id: parseInt(obj.NORAD_CAT_ID, 10),
    tle_line1: obj.TLE_LINE1,
    tle_line2: obj.TLE_LINE2,
    epoch: parseISODate(obj.EPOCH) ?? new Date().toISOString(),
    inclination_deg: parseFloat(obj.INCLINATION) || null,
    raan_deg: parseFloat(obj.RA_OF_ASC_NODE) || null,
    eccentricity: parseFloat(obj.ECCENTRICITY) || null,
    arg_perigee_deg: parseFloat(obj.ARG_OF_PERICENTER) || null,
    mean_anomaly_deg: parseFloat(obj.MEAN_ANOMALY) || null,
    mean_motion_rpm: parseFloat(obj.MEAN_MOTION) || null,
    bstar_drag: parseFloat(obj.BSTAR) || null,
    rev_number: parseInt(obj.REV_AT_EPOCH, 10) || null,
    source: "SPACETRACK",
    synced_at: new Date().toISOString(),
  };
}

// ─── Supabase Upserter ────────────────────────────────────────────────────────

async function upsertBatch(
  supabase: SupabaseClient,
  table: string,
  rows: object[],
  conflictOn: string,
): Promise<{ upserted: number; errors: string[] }> {
  const errors: string[] = [];
  let upserted = 0;

  const batches = chunkArray(rows, CONFIG.BATCH_SIZE);
  for (let i = 0; i < batches.length; i++) {
    process.stdout.write(
      `\r  [${table}] batch ${i + 1}/${batches.length} (${upserted} done)...`,
    );

    // Naya Fixed Code
    const { error, count } = await withRetry(
      async () => {
        // Function ko async banayein
        const result = await supabase // Explicitly await karein
          .from(table)
          .upsert(batches[i], { onConflict: conflictOn, count: "exact" })
          .select();
        return result;
      },
      CONFIG.MAX_RETRIES,
      CONFIG.RETRY_DELAY_MS,
      `${table} batch ${i + 1}`,
    );

    // const { error, count } = await withRetry(
    //   () => supabase
    //     .from(table)
    //     .upsert(batches[i], { onConflict: conflictOn, count: 'exact' })
    //     .select(),
    //   CONFIG.MAX_RETRIES, CONFIG.RETRY_DELAY_MS, `${table} batch ${i + 1}`
    // )

    if (error) {
      errors.push(`Batch ${i + 1}: ${error.message}`);
      console.error(`\n  [error] ${error.message}`);
    } else {
      upserted += count ?? batches[i].length;
    }
  }

  process.stdout.write("\n");
  return { upserted, errors };
}

// ─── Main Sync ────────────────────────────────────────────────────────────────

async function syncTLEs(): Promise<SyncResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const result: SyncResult = { fetched: 0, upserted: 0, failed: 0, errors: [] };

  const { data: logData } = await supabase
    .from("sync_logs")
    .insert({
      sync_type: "FULL",
      triggered_by: process.env.GITHUB_ACTIONS ? "GITHUB_ACTION" : "MANUAL",
      status: "RUNNING",
    })
    .select("id")
    .single();
  const logId = logData?.id ?? null;

  try {
    const client = new SpaceTrackClient();
    await client.login();
    const rawTLEs = await client.fetchAllTLEs();
    await client.logout();

    result.fetched = rawTLEs.length;

    // Log category distribution from Space-Track (for debugging)
    const typeDist: Record<string, number> = {};
    rawTLEs.forEach((r) => {
      const k = r.OBJECT_TYPE ?? "null";
      typeDist[k] = (typeDist[k] || 0) + 1;
    });
    console.log("\n[sync] Space-Track OBJECT_TYPE distribution:");
    console.table(typeDist);

    // Filter: skip objects with invalid TLE lines
    const validTLEs = rawTLEs.filter(
      (obj) => obj.TLE_LINE1?.length === 69 && obj.TLE_LINE2?.length === 69,
    );
    console.log(`[sync] Valid TLEs: ${validTLEs.length} / ${rawTLEs.length}`);

    // Log mapped category distribution
    const mappedDist: Record<string, number> = {};
    validTLEs.forEach((r) => {
      const cat = mapObjectType(r.OBJECT_TYPE);
      mappedDist[cat] = (mappedDist[cat] || 0) + 1;
    });
    console.log("[sync] Mapped category distribution:");
    console.table(mappedDist);

    // Upsert satellites
    console.log(`\n[sync] Upserting ${validTLEs.length} satellites...`);
    const satRows = validTLEs.map(toSatelliteRow);
    const satResult = await upsertBatch(
      supabase,
      "satellites",
      satRows,
      "norad_id",
    );
    result.upserted += satResult.upserted;
    result.errors.push(...satResult.errors);

    // Upsert TLE history (only new epochs)
    console.log("\n[sync] Checking epochs for deduplication...");
    const { data: latestEpochs } = await supabase
      .from("latest_tle")
      .select("norad_id, epoch");

    const epochMap = new Map<number, Date>(
      (latestEpochs ?? []).map((r) => [r.norad_id, new Date(r.epoch)]),
    );

    const newTLERows = validTLEs.map(toTLEHistoryRow).filter((row) => {
      const stored = epochMap.get(row.norad_id);
      return !stored || new Date(row.epoch) > stored;
    });

    console.log(
      `[sync] New TLEs: ${newTLERows.length} (${validTLEs.length - newTLERows.length} unchanged)`,
    );

    if (newTLERows.length > 0) {
      const tleResult = await upsertBatch(
        supabase,
        "tle_history",
        newTLERows,
        "norad_id,epoch",
      );
      result.upserted += tleResult.upserted;
      result.errors.push(...tleResult.errors);
    }

    result.failed = result.errors.length;

    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          finished_at: new Date().toISOString(),
          objects_fetched: result.fetched,
          objects_upserted: result.upserted,
          objects_failed: result.failed,
          status: result.failed > 0 ? "PARTIAL" : "SUCCESS",
          error_message: result.errors.slice(0, 5).join(" | ") || null,
        })
        .eq("id", logId);
    }

    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (logId) {
      await supabase
        .from("sync_logs")
        .update({
          finished_at: new Date().toISOString(),
          status: "FAILED",
          error_message: msg.slice(0, 500),
        })
        .eq("id", logId);
    }
    throw err;
  }
}

// ─── Entry Point ──────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════");
  console.log(" Space Drishti — TLE Sync Engine");
  console.log(`  Started: ${new Date().toISOString()}`);
  console.log("═══════════════════════════════════════\n");

  const t = Date.now();
  try {
    const result = await syncTLEs();
    const elapsed = ((Date.now() - t) / 1000).toFixed(1);
    console.log("\n═══════════════════════════════════════");
    console.log(` Sync complete in ${elapsed}s`);
    console.log(`  Fetched:  ${result.fetched.toLocaleString()}`);
    console.log(`  Upserted: ${result.upserted.toLocaleString()}`);
    console.log(`  Failed:   ${result.failed}`);
    if (result.errors.length)
      console.log(
        `  Errors:   ${result.errors.slice(0, 3).join("\n            ")}`,
      );
    console.log("═══════════════════════════════════════");
    process.exit(0);
  } catch (err) {
    console.error("[FATAL]", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
