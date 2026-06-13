import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { parseAuditedFile } from '@/lib/import/parse'
import { loadCategoryMapping } from '@/lib/import/mapping'
import { joinKeyFor } from '@/lib/import/join'

// Returns the admin user's id, or null if the caller is not an admin.
async function adminUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin' ? user.id : null
}

// Step 2 of the import: stage one or more audited files and auto-match each row to a
// stored raw nomination (normalized Nominee + Company + Category). Category and master
// category are auto-detected per sheet from category_mapping, so any subset of files
// (or future master categories) can be uploaded incrementally. Rows already carrying an
// editorial_summary are flagged 'duplicate' (excluded by default). A fresh upload
// replaces any previous unfinalized staging batch but keeps its history record.
export async function POST(req: NextRequest) {
  const adminId = await adminUserId()
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File)
  if (files.length === 0) {
    return NextResponse.json({ error: 'Select at least one audited file.' }, { status: 400 })
  }

  try {
    const buffers = await Promise.all(files.map((f) => f.arrayBuffer().then(Buffer.from)))
    const auditedRows = buffers.flatMap((buf) => parseAuditedFile(buf))

    const mapping = await loadCategoryMapping()
    const service = await createServiceClient()

    // Load stored raw nominations to match against.
    const { data: noms, error: nomErr } = await service
      .from('nominations')
      .select('id, nominee_name, company, category_key')
    if (nomErr) return NextResponse.json({ error: nomErr.message }, { status: 500 })

    // Nominations that already have an editorial summary — re-matches are duplicates.
    const { data: existing, error: exErr } = await service
      .from('editorial_summary')
      .select('nomination_id')
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 })
    const existingIds = new Set((existing ?? []).map((e) => e.nomination_id))

    // Build join index, enforcing 1:1 (a nomination can be claimed by one audited row).
    const rawIndex = new Map<string, string>() // joinKey → nomination uuid
    for (const n of noms ?? []) {
      rawIndex.set(joinKeyFor(n.nominee_name, n.company, n.category_key), n.id)
    }

    const batchId = crypto.randomUUID()
    const usedNomIds = new Set<string>()
    let matched = 0
    let duplicates = 0
    const categories = new Set<string>()
    const masters = new Set<string>()

    const stagingRows = auditedRows.map((a) => {
      const cat = mapping.lookup(a.sheet_name)
      const normalizedKey = cat?.normalized_key ?? ''
      const master = (normalizedKey && mapping.keyToMaster.get(normalizedKey)) || 'unknown'
      if (normalizedKey) categories.add(normalizedKey)
      masters.add(master)
      let matchedNominationId: string | null = null
      let status: 'matched' | 'unmatched' | 'duplicate' = 'unmatched'
      if (normalizedKey) {
        const id = rawIndex.get(joinKeyFor(a.nominee_name, a.company, normalizedKey))
        if (id && !usedNomIds.has(id)) {
          matchedNominationId = id
          usedNomIds.add(id)
          if (existingIds.has(id)) {
            status = 'duplicate'
            duplicates++
          } else {
            status = 'matched'
            matched++
          }
        }
      }
      return {
        batch_id: batchId,
        normalized_key: normalizedKey || 'unknown',
        master_category: master,
        nominee_name: a.nominee_name,
        company: a.company,
        designation: a.designation || null,
        total_score: a.total_score,
        qualifies: a.qualifies,
        summary: a.summary || null,
        jury_notes: a.jury_notes || null,
        strategic_feedback: a.strategic_feedback || null,
        criteria_scores_json: a.criteria_scores_json,
        match_status: status,
        matched_nomination_id: matchedNominationId,
      }
    })

    // Replace any previous staging batch, then insert the new one.
    await service.from('audited_staging').delete().neq('batch_id', batchId)

    const BATCH = 500
    for (let i = 0; i < stagingRows.length; i += BATCH) {
      const { error } = await service.from('audited_staging').insert(stagingRows.slice(i, i + BATCH))
      if (error) return NextResponse.json({ error: `staging insert: ${error.message}` }, { status: 500 })
    }

    const unmatched = auditedRows.length - matched - duplicates

    // Persist upload-batch history: discard any still-staged batches, record this one.
    await service.from('import_batches').update({ status: 'discarded' }).eq('status', 'staged')
    await service.from('import_batches').insert({
      id: batchId,
      uploaded_by: adminId,
      file_names: files.map((f) => f.name),
      master_categories: [...masters],
      categories: [...categories],
      matched_count: matched,
      duplicate_count: duplicates,
      unmatched_count: unmatched,
      status: 'staged',
    })

    return NextResponse.json({
      batch_id: batchId,
      total_audited: auditedRows.length,
      matched,
      duplicates,
      unmatched,
      total_nominations: noms?.length ?? 0,
      nominations_without_summary: (noms?.length ?? 0) - matched,
    })
  } catch (err) {
    console.error('[import/audited]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
