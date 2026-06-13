import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// Returns the admin user's id, or null if the caller is not an admin.
async function adminUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user.id : null
}

const SUMMARY_FIELDS = ['total_score', 'qualifies', 'summary', 'jury_notes', 'strategic_feedback', 'criteria_scores_json'] as const

// Commit a staged batch to editorial_summary. Blocked while any row is still
// 'unmatched' (matched or skipped/duplicate only). Replacements of an existing
// summary are audited; replacements of an already-scored nomination are dropped
// (defense in depth — the reconcile UI already blocks them). Clears the batch and
// finalizes the batch history record on success.
export async function POST(req: NextRequest) {
  const adminId = await adminUserId()
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { batch_id } = await req.json() as { batch_id: string }
  if (!batch_id) return NextResponse.json({ error: 'batch_id required' }, { status: 400 })

  const service = await createServiceClient()

  const { count: unmatchedCount } = await service
    .from('audited_staging')
    .select('*', { count: 'exact', head: true })
    .eq('batch_id', batch_id)
    .eq('match_status', 'unmatched')

  if ((unmatchedCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `Cannot finalize — ${unmatchedCount} audited rows are still unmatched. Resolve or skip them first.` },
      { status: 409 },
    )
  }

  const { data: matchedRows, error: loadErr } = await service
    .from('audited_staging')
    .select('matched_nomination_id, total_score, qualifies, summary, jury_notes, strategic_feedback, criteria_scores_json')
    .eq('batch_id', batch_id)
    .eq('match_status', 'matched')
    .not('matched_nomination_id', 'is', null)
  if (loadErr) return NextResponse.json({ error: loadErr.message }, { status: 500 })

  const rows = matchedRows ?? []
  const nominationIds = rows.map((r) => r.matched_nomination_id as string)

  // Existing summaries among the committing ids → these commits are replacements.
  const { data: existing } = await service
    .from('editorial_summary')
    .select('nomination_id, total_score, qualifies, summary, jury_notes, strategic_feedback, criteria_scores_json')
    .in('nomination_id', nominationIds.length ? nominationIds : ['00000000-0000-0000-0000-000000000000'])
  const existingById = new Map((existing ?? []).map((e) => [e.nomination_id, e]))

  // A replacement is locked once the nomination has been scored — drop those.
  const { data: scored } = await service
    .from('scores')
    .select('nomination_id')
    .in('nomination_id', nominationIds.length ? nominationIds : ['00000000-0000-0000-0000-000000000000'])
  const scoredIds = new Set((scored ?? []).map((s) => s.nomination_id))

  const summaryRows: Array<Record<string, unknown>> = []
  const auditRows: Array<Record<string, unknown>> = []
  let lockedDropped = 0

  for (const r of rows) {
    const nomId = r.matched_nomination_id as string
    const prev = existingById.get(nomId)
    const isReplacement = !!prev
    if (isReplacement && scoredIds.has(nomId)) {
      lockedDropped++
      continue // never overwrite a scored nomination's summary
    }
    const newSummary = Object.fromEntries(SUMMARY_FIELDS.map((f) => [f, r[f]]))
    summaryRows.push({ nomination_id: nomId, ...newSummary })
    if (isReplacement) {
      auditRows.push({
        nomination_id: nomId,
        batch_id,
        previous_summary: Object.fromEntries(SUMMARY_FIELDS.map((f) => [f, prev[f as keyof typeof prev]])),
        new_summary: newSummary,
        replaced_by: adminId,
      })
    }
  }

  const errors: string[] = []
  let committed = 0
  const BATCH = 200
  for (let i = 0; i < summaryRows.length; i += BATCH) {
    const batch = summaryRows.slice(i, i + BATCH)
    const { error } = await service.from('editorial_summary').upsert(batch, { onConflict: 'nomination_id' })
    if (error) errors.push(`batch ${i}: ${error.message}`)
    else committed += batch.length
  }

  if (errors.length === 0) {
    if (auditRows.length) {
      const { error: auditErr } = await service.from('editorial_summary_audit').insert(auditRows)
      if (auditErr) errors.push(`audit: ${auditErr.message}`)
    }
    await service.from('import_batches').update({
      status: 'finalized',
      finalized_at: new Date().toISOString(),
      imported_count: committed,
      error_count: errors.length,
    }).eq('id', batch_id)
    await service.from('audited_staging').delete().eq('batch_id', batch_id)
  }

  return NextResponse.json({ committed, locked_dropped: lockedDropped, errors })
}
