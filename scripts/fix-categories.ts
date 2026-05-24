/**
 * scripts/fix-categories.ts
 * ONE-TIME migration — fixes wrong category values already in DB
 *
 * Problem: sync-tle.ts had wrong OBJECT_TYPE_MAP so all non-payload
 * objects got saved as UNKNOWN instead of ROCKET_BODY / DEBRIS.
 *
 * This script reads object_type (raw Space-Track value, correctly saved)
 * and re-derives the correct category, then updates satellites table.
 *
 * Run ONCE: npx ts-node scripts/fix-categories.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

function mapObjectType(raw: string | null | undefined): string {
  if (!raw) return 'UNKNOWN'
  const s = raw.toUpperCase().trim()
  switch (s) {
    case 'PAYLOAD':      return 'PAYLOAD'
    case 'ROCKET BODY':  return 'ROCKET_BODY'
    case 'DEBRIS':       return 'DEBRIS'
    case 'TBA':          return 'UNKNOWN'
    case 'UNKNOWN':      return 'UNKNOWN'
    case 'R/B':          return 'ROCKET_BODY'
    case 'DEB':          return 'DEBRIS'
    default:             return 'UNKNOWN'
  }
}

async function main() {
  console.log('\n═══════════════════════════════════════')
  console.log(' Space Drishti — Fix Categories Migration')
  console.log('═══════════════════════════════════════\n')

  // 1. Fetch all rows that have wrong category
  //    (anything saved as UNKNOWN that has a known object_type)
  console.log('Fetching all satellites with object_type...')

  let allRows: { norad_id: number; object_type: string | null; category: string }[] = []
  let page = 0
  const PAGE = 1000

  while (true) {
    const { data, error } = await supabase
      .from('satellites')
      .select('norad_id, object_type, category')
      .range(page * PAGE, (page + 1) * PAGE - 1)

    if (error) { console.error('Fetch error:', error); break }
    if (!data || data.length === 0) break
    allRows = allRows.concat(data)
    page++
    process.stdout.write(`\r  Fetched ${allRows.length} rows...`)
    if (data.length < PAGE) break
  }

  console.log(`\nTotal rows fetched: ${allRows.length}`)

  // 2. Find rows where category needs updating
  const toUpdate = allRows
    .map(row => ({
      norad_id:        row.norad_id,
      current_category: row.category,
      correct_category: mapObjectType(row.object_type),
      object_type:     row.object_type,
    }))
    .filter(row => row.current_category !== row.correct_category)

  console.log(`\nRows needing category fix: ${toUpdate.length}`)

  if (toUpdate.length === 0) {
    console.log('Nothing to fix! All categories are already correct.')
    return
  }

  // Show breakdown of what will change
  const breakdown: Record<string, number> = {}
  toUpdate.forEach(r => {
    const key = `${r.current_category} → ${r.correct_category}`
    breakdown[key] = (breakdown[key] || 0) + 1
  })
  console.log('\nChanges breakdown:')
  console.table(breakdown)

  // 3. Update in batches of 500
  console.log('\nApplying fixes...')
  const BATCH = 500
  let updated = 0
  let failed  = 0

  for (let i = 0; i < toUpdate.length; i += BATCH) {
    const batch = toUpdate.slice(i, i + BATCH)

    // Group by target category for efficient bulk update
    const byCategory: Record<string, number[]> = {}
    batch.forEach(r => {
      if (!byCategory[r.correct_category]) byCategory[r.correct_category] = []
      byCategory[r.correct_category].push(r.norad_id)
    })

    for (const [category, noradIds] of Object.entries(byCategory)) {
      const { error, count } = await supabase
        .from('satellites')
        .update({
          category,
          // Also fix is_active: only PAYLOADs can be active
          is_active: category === 'PAYLOAD' ? true : false,
        })
        .in('norad_id', noradIds)
        .select()

      if (error) {
        console.error(`\nError updating ${category}:`, error.message)
        failed += noradIds.length
      } else {
        updated += count ?? noradIds.length
      }
    }

    process.stdout.write(`\r  Updated ${updated} / ${toUpdate.length}...`)
  }

  console.log(`\n\n✓ Done! Updated: ${updated}, Failed: ${failed}`)

  // 4. Verify final state
  console.log('\nFinal category distribution in satellites table:')
  const { data: finalData } = await supabase
    .from('satellites')
    .select('category')

  if (finalData) {
    const counts: Record<string, number> = {}
    finalData.forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1 })
    console.table(counts)
  }

  console.log('\n═══════════════════════════════════════')
  console.log(' Migration complete!')
  console.log(' Next: run sync-tle.ts again to get fresh data with correct categories')
  console.log('═══════════════════════════════════════\n')
}

main().catch(console.error)