/**
 * lib/supabase.ts
 * Space Drishti — Typed Supabase client
 *
 * Two clients:
 *  - supabase         → anon key  (public reads in API routes / client components)
 *  - supabaseAdmin    → service role key (writes, used only in server-side scripts)
 *
 * Both are singletons — created once and reused across the process lifetime.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'   // generated types (see note below)

// ─── Env validation (fail fast at startup, not mid-request) ──────────────────

function requireEnv(key: string): string {
  const val = process.env[key]
  if (!val) {
    throw new Error(
      `[supabase] Missing required environment variable: ${key}\n` +
      `Make sure it is set in .env.local (local dev) or Vercel env settings (prod).`
    )
  }
  return val
}

const SUPABASE_URL          = requireEnv('NEXT_PUBLIC_SUPABASE_URL')
const SUPABASE_ANON_KEY     = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
// Service role key is NOT exposed to the client — only available server-side
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY  // optional, only needed for admin ops

// ─── Singleton pattern ────────────────────────────────────────────────────────

let _supabase: SupabaseClient<Database> | null = null
let _supabaseAdmin: SupabaseClient<Database> | null = null

/**
 * Public read-only client.
 * Safe to use in Server Components, API Routes, and (with NEXT_PUBLIC_ vars) Client Components.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    _supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,  // server-side: no browser storage
        autoRefreshToken: false,
      },
    })
  }
  return _supabase
}

/**
 * Admin client with service role key — bypasses RLS.
 * ONLY use server-side (API routes, sync scripts, GitHub Actions).
 * NEVER import this in Client Components.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!SUPABASE_SERVICE_KEY) {
    throw new Error(
      '[supabase] SUPABASE_SERVICE_ROLE_KEY is not set. ' +
      'Admin operations (writes) require the service role key.'
    )
  }
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return _supabaseAdmin
}

// ─── Convenience re-export (most code just needs the public client) ───────────
export const supabase = getSupabase()

// ─── NOTE: Type generation ────────────────────────────────────────────────────
// Generate @/types/database.ts from your Supabase project with:
//   npx supabase gen types typescript --project-id <your-project-id> > types/database.ts
//
// If you haven't done this yet, replace `Database` with `any` temporarily:
//   import { createClient, SupabaseClient } from '@supabase/supabase-js'
//   export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)