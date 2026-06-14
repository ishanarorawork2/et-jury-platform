import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { similarity } from '@/lib/import/join'
import type { CandidateNomination } from '@/lib/import/types'

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

async function counts(service: Awaited<ReturnType<typeof createServiceClient>>, batchId: string) {
  const { data } = await service
    .from('audited_staging')
    .select('match_status')
    .eq('batch_id', batchId)
  const c = { matched: 0, unmatched: 0, skipped: 0, duplicate: 0, total: 0 }
  for (const r of data ?? []) {
    c.total++
    if (r.match_status === 'matched') c.matched++
    else if (r.match_status === 'skipped') c.skipped++
    else if (r.match_status === 'duplicate') c.duplicate++
    else c.unmatched++
  }
  return c
}

// Which of the given nomination ids already have a juror score — replacing their
// editorial summary is locked once scoring has started.
async function lockedNominationIds(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  nominationIds: string[],
): Promise<Set<string>> {
  const ids = nominationIds.filter(Boolean)
  if (ids.length === 0) return new Set()
  const { data } = await service.from('scores').select('nomination_id').in('nomination_id', ids)
  return new Set((data ?? []).map((r) => r.nomination_id))
}

// GET ?batch_id=… → unmatched staged rows (each with ranked candidate nominations),
// duplicate rows (each flagged locked if scoring has started), and counts.
export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const batchId = new URL(req.url).searchParams.get('batch_id')
  if (!batchId) return NextResponse.json({ error: 'batch_id required' }, { status: 400 })

  const service = createServiceClient()

  const { data: unmatched, error } = await service
    .from('audited_staging')
    .select('id, normalized_key, master_category, nominee_name, company, designation, total_score, qualifies, match_status, matched_nomination_id')
    .eq('batch_id', batchId)
    .eq('match_status', 'unmatched')
    .order('nominee_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Nomination ids already claimed in this batch — exclude from candidate lists.
  const { data: claimed } = await service
    .from('audited_staging')
    .select('matched_nomination_id')
    .eq('batch_id', batchId)
    .not('matched_nomination_id', 'is', null)
  const claimedIds = new Set((claimed ?? []).map((r) => r.matched_nomination_id))

  // Candidate pool: nominations grouped by category.
  type NomRow = { id: string; nomination_id: string; nominee_name: string; company: string; category_key: string }
  const categories = [...new Set((unmatched ?? []).map((r) => r.normalized_key))]
  let noms: NomRow[] = []
  if (categories.length) {
    const { data } = await service
      .from('nominations')
      .select('id, nomination_id, nominee_name, company, category_key')
      .in('category_key', categories)
    noms = (data ?? []) as NomRow[]
  }

  const byCat = new Map<string, NomRow[]>()
  for (const n of noms) {
    if (!byCat.has(n.category_key)) byCat.set(n.category_key, [])
    byCat.get(n.category_key)!.push(n)
  }

  const rows = (unmatched ?? []).map((r) => {
    const pool = (byCat.get(r.normalized_key) ?? []).filter((n) => !claimedIds.has(n.id))
    const candidates: CandidateNomination[] = pool
      .map((n) => ({
        id: n.id,
        nomination_id: n.nomination_id,
        nominee_name: n.nominee_name,
        company: n.company,
        score: similarity(r.nominee_name, n.nominee_name) + similarity(r.company, n.company),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
    return { ...r, candidates }
  })

  // Duplicate rows — already-imported summaries that would be overwritten.
  const { data: dupRows } = await service
    .from('audited_staging')
    .select('id, normalized_key, master_category, nominee_name, company, total_score, matched_nomination_id')
    .eq('batch_id', batchId)
    .eq('match_status', 'duplicate')
    .order('nominee_name')
  const locked = await lockedNominationIds(
    service,
    (dupRows ?? []).map((r) => r.matched_nomination_id).filter((id): id is string => !!id),
  )
  const duplicates = (dupRows ?? []).map((r) => ({
    ...r,
    locked: r.matched_nomination_id ? locked.has(r.matched_nomination_id) : false,
  }))

  return NextResponse.json({ rows, duplicates, counts: await counts(service, batchId) })
}

// PATCH → resolve a staged row, or replace duplicates.
//   match     : assign an unmatched row to a nomination (1:1 enforced)
//   skip      : exclude a row from the import
//   unmatch   : reset a row to unmatched
//   replace   : commit a duplicate row, overwriting the existing summary (blocked if scored)
//   replace_all : same as replace for every unlocked duplicate in the batch
//   match_all : match each supplied {id, nomination_id} at once, skipping 1:1 collisions
//   skip_all  : exclude every still-unmatched row in the batch
export async function PATCH(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    id?: string
    action: 'match' | 'skip' | 'unmatch' | 'replace' | 'replace_all' | 'match_all' | 'skip_all'
    nomination_id?: string
    matches?: { id: string; nomination_id: string }[]
    batch_id: string
  }
  const { id, action, nomination_id, batch_id } = body
  if (!action || !batch_id) {
    return NextResponse.json({ error: 'action and batch_id are required' }, { status: 400 })
  }

  const service = createServiceClient()

  if (action === 'skip_all') {
    const { data: skipped, error } = await service
      .from('audited_staging')
      .update({ match_status: 'skipped', matched_nomination_id: null })
      .eq('batch_id', batch_id)
      .eq('match_status', 'unmatched')
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({
      ok: true,
      skipped_ids: (skipped ?? []).map((r) => r.id),
      counts: await counts(service, batch_id),
    })
  }

  if (action === 'match_all') {
    const requested = (body.matches ?? []).filter((m) => m.id && m.nomination_id)
    if (requested.length === 0) {
      return NextResponse.json({ error: 'matches array is required' }, { status: 400 })
    }
    // Nominations already claimed by matched/duplicate rows in this batch are off-limits.
    const { data: claimedRows } = await service
      .from('audited_staging')
      .select('matched_nomination_id')
      .eq('batch_id', batch_id)
      .not('matched_nomination_id', 'is', null)
    const used = new Set((claimedRows ?? []).map((r) => r.matched_nomination_id as string))

    const matchedIds: string[] = []
    for (const m of requested) {
      if (used.has(m.nomination_id)) continue // first writer wins; collisions stay unmatched
      const { error } = await service
        .from('audited_staging')
        .update({ match_status: 'matched', matched_nomination_id: m.nomination_id })
        .eq('id', m.id)
        .eq('batch_id', batch_id)
        .eq('match_status', 'unmatched')
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      used.add(m.nomination_id)
      matchedIds.push(m.id)
    }
    return NextResponse.json({
      ok: true,
      matched_ids: matchedIds,
      skipped_collisions: requested.length - matchedIds.length,
      counts: await counts(service, batch_id),
    })
  }

  if (action === 'replace_all') {
    const { data: dups } = await service
      .from('audited_staging')
      .select('id, matched_nomination_id, nominee_name')
      .eq('batch_id', batch_id)
      .eq('match_status', 'duplicate')
      .not('matched_nomination_id', 'is', null)
    const locked = await lockedNominationIds(
      service,
      (dups ?? []).map((d) => d.matched_nomination_id).filter((x): x is string => !!x),
    )
    const replaceable = (dups ?? []).filter((d) => !locked.has(d.matched_nomination_id!))
    if (replaceable.length) {
      const { error } = await service
        .from('audited_staging')
        .update({ match_status: 'matched' })
        .in('id', replaceable.map((d) => d.id))
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({
      ok: true,
      replaced: replaceable.length,
      locked_skipped: (dups ?? []).length - replaceable.length,
      counts: await counts(service, batch_id),
    })
  }

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  if (action === 'match') {
    if (!nomination_id) return NextResponse.json({ error: 'nomination_id required to match' }, { status: 400 })
    // Enforce 1:1 — reject if another staged row already claims this nomination.
    const { data: clash } = await service
      .from('audited_staging')
      .select('id')
      .eq('batch_id', batch_id)
      .eq('matched_nomination_id', nomination_id)
      .neq('id', id)
      .maybeSingle()
    if (clash) {
      return NextResponse.json({ error: 'That nomination is already matched to another audited row' }, { status: 409 })
    }
    const { error } = await service
      .from('audited_staging')
      .update({ match_status: 'matched', matched_nomination_id: nomination_id })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === 'replace') {
    // Promote a duplicate row to matched so finalize overwrites the existing summary.
    const { data: row } = await service
      .from('audited_staging')
      .select('matched_nomination_id, nominee_name')
      .eq('id', id)
      .maybeSingle()
    if (!row?.matched_nomination_id) {
      return NextResponse.json({ error: 'Row has no matched nomination to replace' }, { status: 400 })
    }
    const locked = await lockedNominationIds(service, [row.matched_nomination_id])
    if (locked.size > 0) {
      return NextResponse.json(
        { error: `Cannot replace — ${row.nominee_name} has already been scored by a juror.` },
        { status: 409 },
      )
    }
    const { error } = await service
      .from('audited_staging')
      .update({ match_status: 'matched' })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else if (action === 'skip') {
    const { error } = await service
      .from('audited_staging')
      .update({ match_status: 'skipped', matched_nomination_id: null })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await service
      .from('audited_staging')
      .update({ match_status: 'unmatched', matched_nomination_id: null })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, counts: await counts(service, batch_id) })
}
