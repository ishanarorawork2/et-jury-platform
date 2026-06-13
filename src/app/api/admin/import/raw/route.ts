import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { listRawSheets, parseRawFile } from '@/lib/import/parse'
import { loadCategoryMapping } from '@/lib/import/mapping'
import type { RawSheetSummary } from '@/lib/import/types'

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

// Step 1 of the import: raw nominations.
//   mode=parse  → return each sheet + auto-guessed category for the mapping table
//   mode=commit → upsert all rows to `nominations` using the admin-confirmed mapping
export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const mode = (formData.get('mode') as string) || 'parse'
  const rawFile = formData.get('raw') as File | null
  if (!rawFile) return NextResponse.json({ error: 'Raw nominations file is required' }, { status: 400 })

  const buffer = Buffer.from(await rawFile.arrayBuffer())
  const mapping = await loadCategoryMapping()

  try {
    if (mode === 'parse') {
      const sheets = listRawSheets(buffer)
      const summaries: RawSheetSummary[] = sheets.map((s) => {
        const guess = mapping.lookup(s.sheet_name)
        return {
          sheet_name: s.sheet_name,
          row_count: s.row_count,
          guessed_key: guess?.normalized_key ?? null,
          guessed_master: guess?.master_category ?? null,
        }
      })
      return NextResponse.json({
        mode: 'parse',
        sheets: summaries,
        total_rows: summaries.reduce((n, s) => n + s.row_count, 0),
        category_keys: mapping.keys.sort(),
        key_master: Object.fromEntries(mapping.keyToMaster),
      })
    }

    // mode === 'commit' — apply the confirmed sheet → category map.
    const rawMap = formData.get('sheet_map') as string | null
    if (!rawMap) return NextResponse.json({ error: 'sheet_map is required to commit' }, { status: 400 })

    let sheetMap: Record<string, string>
    try {
      sheetMap = JSON.parse(rawMap)
    } catch {
      return NextResponse.json({ error: 'sheet_map must be valid JSON' }, { status: 400 })
    }

    const rows = parseRawFile(buffer)
    const skippedSheets = new Set<string>()
    const nominationRows = rows
      .map((r) => {
        const key = sheetMap[r.sheet_name]
        if (!key) {
          skippedSheets.add(r.sheet_name)
          return null
        }
        const master = mapping.keyToMaster.get(key)
        if (!master) {
          skippedSheets.add(r.sheet_name)
          return null
        }
        return {
          nomination_id: r.nomination_id,
          category_key: key,
          master_category: master,
          nominee_name: r.nominee_name,
          designation: r.designation || null,
          company: r.company,
          email: r.email || null,
          mobile: r.mobile || null,
          raw_data_json: r.raw_data_json,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    const service = await createServiceClient()
    const errors: string[] = []
    let inserted = 0
    const perCategory: Record<string, number> = {}

    const BATCH = 200
    for (let i = 0; i < nominationRows.length; i += BATCH) {
      const batch = nominationRows.slice(i, i + BATCH)
      const { error } = await service.from('nominations').upsert(batch, { onConflict: 'nomination_id' })
      if (error) {
        errors.push(`batch ${i}: ${error.message}`)
        continue
      }
      inserted += batch.length
      for (const b of batch) perCategory[b.category_key] = (perCategory[b.category_key] ?? 0) + 1
    }

    return NextResponse.json({
      mode: 'commit',
      inserted,
      per_category: perCategory,
      skipped_sheets: [...skippedSheets],
      errors,
    })
  } catch (err) {
    console.error('[import/raw]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
