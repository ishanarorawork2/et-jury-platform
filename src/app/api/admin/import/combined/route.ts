import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseCombinedCsv } from '@/lib/import/parse'
import { loadCategoryMapping } from '@/lib/import/mapping'

async function requireAdminId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user.id : null
}

// POST /api/admin/import/combined
//   mode=parse  → validate file and return a per-category preview
//   mode=commit → upsert nominations + editorial_summaries in one shot
//
// The combined CSV has both raw Q&A answers and AI audit scores on every row,
// keyed by Nomination Id (string). No staging or fuzzy-join needed.
export async function POST(req: NextRequest) {
  const adminId = await requireAdminId()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const mode = (formData.get('mode') as string) || 'parse'
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided.' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())

  try {
    const rows = parseCombinedCsv(buffer)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid rows found. Check the file has a "Nomination Id" column.' }, { status: 400 })
    }

    const mapping = await loadCategoryMapping()

    // Resolve category_label → normalized_key + master_category for every row.
    type Resolved = {
      normalized_key: string
      master_category: string
    }
    const resolved = rows.map((r) => {
      const cat = mapping.lookup(r.category_label)
      return cat
        ? { normalized_key: cat.normalized_key, master_category: cat.master_category } satisfies Resolved
        : null
    })

    const skipped = rows.filter((_, i) => resolved[i] === null)
    const valid = rows.filter((_, i) => resolved[i] !== null)
    const validResolved = resolved.filter((r): r is Resolved => r !== null)

    if (mode === 'parse') {
      // Build per-category breakdown.
      const byCategory = new Map<string, { master_category: string; count: number; scored: number }>()
      for (let i = 0; i < valid.length; i++) {
        const r = valid[i]
        const res = validResolved[i]
        const key = res.normalized_key
        if (!byCategory.has(key)) {
          byCategory.set(key, { master_category: res.master_category, count: 0, scored: 0 })
        }
        const entry = byCategory.get(key)!
        entry.count++
        if (r.total_score > 0) entry.scored++
      }

      return NextResponse.json({
        total: rows.length,
        valid: valid.length,
        skipped: skipped.length,
        skipped_labels: [...new Set(skipped.map((r) => r.category_label))],
        by_category: [...byCategory.entries()].map(([key, v]) => ({ key, ...v })),
      })
    }

    // mode === 'commit'
    const service = createServiceClient()

    // 1. Upsert nominations.
    const nominationRows = valid.map((r, i) => ({
      nomination_id: r.nomination_id,
      category_key: validResolved[i].normalized_key,
      master_category: validResolved[i].master_category,
      nominee_name: r.nominee_name,
      designation: r.designation || null,
      company: r.company,
      email: r.email || null,
      mobile: r.mobile || null,
      raw_data_json: r.raw_data_json,
    }))

    let nominationsInserted = 0
    const BATCH = 200
    const errors: string[] = []

    for (let i = 0; i < nominationRows.length; i += BATCH) {
      const batch = nominationRows.slice(i, i + BATCH)
      const { error } = await service
        .from('nominations')
        .upsert(batch, { onConflict: 'nomination_id' })
      if (error) {
        errors.push(`nominations batch ${i}: ${error.message}`)
        continue
      }
      nominationsInserted += batch.length
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join('; ') }, { status: 500 })
    }

    // 2. Fetch UUIDs by nomination_id string so we can write editorial_summary.
    const nomIds = valid.map((r) => r.nomination_id)
    const { data: stored, error: fetchErr } = await service
      .from('nominations')
      .select('id, nomination_id')
      .in('nomination_id', nomIds)
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const uuidByNomId = new Map((stored ?? []).map((n) => [n.nomination_id, n.id as string]))

    // 3. Guard: don't overwrite summaries where scoring has started.
    const uuids = [...uuidByNomId.values()]
    const { data: scored } = await service
      .from('scores')
      .select('nomination_id')
      .in('nomination_id', uuids.length ? uuids : ['00000000-0000-0000-0000-000000000000'])
    const scoredIds = new Set((scored ?? []).map((s) => s.nomination_id as string))

    // 4. Build and upsert editorial_summary rows.
    const summaryRows = valid
      .map((r, i) => {
        const uuid = uuidByNomId.get(r.nomination_id)
        if (!uuid) return null
        if (scoredIds.has(uuid)) return null // locked — scoring has started
        return {
          nomination_id: uuid,
          total_score: r.total_score,
          qualifies: r.qualifies,
          summary: r.summary || null,
          jury_notes: r.jury_notes || null,
          strategic_feedback: r.strategic_feedback || null,
          criteria_scores_json: r.criteria_scores_json,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const lockedDropped = valid.length - summaryRows.length - (valid.length - uuids.length)
    let summariesInserted = 0

    for (let i = 0; i < summaryRows.length; i += BATCH) {
      const batch = summaryRows.slice(i, i + BATCH)
      const { error } = await service
        .from('editorial_summary')
        .upsert(batch, { onConflict: 'nomination_id' })
      if (error) {
        errors.push(`editorial_summary batch ${i}: ${error.message}`)
        continue
      }
      summariesInserted += batch.length
    }

    return NextResponse.json({
      nominations_inserted: nominationsInserted,
      summaries_inserted: summariesInserted,
      locked_dropped: lockedDropped,
      skipped: skipped.length,
      skipped_labels: [...new Set(skipped.map((r) => r.category_label))],
      errors,
    })
  } catch (err) {
    console.error('[import/combined]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
