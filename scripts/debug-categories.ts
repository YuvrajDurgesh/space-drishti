/**
 * scripts/debug-categories.ts
 * Run: npx ts-node scripts/debug-categories.ts
 *
 * Checks:
 * 1. What categories exist in satellites table
 * 2. What raw object_type values Space-Track sent
 * 3. Sample TLE rows to verify data quality
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

async function main() {
  console.log('\n═══════════════════════════════════════')
  console.log(' Space Drishti — Category Debug')
  console.log('═══════════════════════════════════════\n')

  // 1. Count by category in satellites table
  console.log('1. satellites table — count by category:')
  const { data: catData } = await supabase
    .from('satellites')
    .select('category')
  
  if (catData) {
    const counts: Record<string, number> = {}
    catData.forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1 })
    console.table(counts)
  }

  // 2. Count by object_type (raw Space-Track value)
  console.log('\n2. satellites table — count by object_type (raw):')
  const { data: typeData } = await supabase
    .from('satellites')
    .select('object_type')

  if (typeData) {
    const counts: Record<string, number> = {}
    typeData.forEach(r => { counts[r.object_type ?? 'null'] = (counts[r.object_type ?? 'null'] || 0) + 1 })
    console.table(counts)
  }

  // 3. Sample 5 non-payload rows
  console.log('\n3. Sample non-PAYLOAD rows from satellites:')
  const { data: sample } = await supabase
    .from('satellites')
    .select('norad_id, name, category, object_type')
    .neq('category', 'PAYLOAD')
    .limit(10)
  console.table(sample)

  // 4. Check latest_tle view
  console.log('\n4. latest_tle view — count by category:')
  const { data: viewData } = await supabase
    .from('latest_tle')
    .select('category')

  if (viewData) {
    const counts: Record<string, number> = {}
    viewData.forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1 })
    console.table(counts)
  }

  // 5. Sample from latest_tle view for non-payloads
  console.log('\n5. Sample non-PAYLOAD rows from latest_tle view:')
  const { data: viewSample } = await supabase
    .from('latest_tle')
    .select('norad_id, name, category, object_type, tle_line1')
    .neq('category', 'PAYLOAD')
    .limit(5)
  console.table(viewSample)

  // 6. Check if TLE lines look valid
  console.log('\n6. TLE line length check (should be 69 chars each):')
  const { data: tleSample } = await supabase
    .from('tle_history')
    .select('norad_id, tle_line1, tle_line2')
    .limit(3)
  
  tleSample?.forEach(row => {
    console.log(`NORAD ${row.norad_id}: line1=${row.tle_line1?.length} chars, line2=${row.tle_line2?.length} chars`)
  })

  console.log('\n═══════════════════════════════════════')
  console.log(' Done')
  console.log('═══════════════════════════════════════\n')
}

main().catch(console.error)