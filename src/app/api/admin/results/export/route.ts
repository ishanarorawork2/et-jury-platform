import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { fetchAll } from '@/lib/supabase/fetch-all'
import {
  assembleByCategory, sheetForCategory, rankingsSheet, scorecardSheets, sheetName,
  type ExportData, type SheetDef,
} from '@/lib/export/build'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  return profile?.role === 'admin'
}

async function loadExportData(): Promise<ExportData> {
  const service = createServiceClient()
  const [nominations, summaries, rankings, assignments, scores, jurors] = await Promise.all([
    fetchAll<ExportData['nominations'][number]>(
      service, 'nominations',
      'id, nomination_id, nominee_name, company, designation, email, mobile, master_category, category_key, raw_data_json'
    ),
    fetchAll<ExportData['summaries'][number]>(
      service, 'editorial_summary',
      'nomination_id, total_score, qualifies, summary, jury_notes, strategic_feedback, criteria_scores_json'
    ),
    // Pre-computed completion + rank, so the export matches the UI exactly.
    fetchAll<ExportData['rankings'][number]>(
      service, 'category_rankings',
      'nomination_id, category_key, master_category, complete, final_score, rank, tied'
    ),
    fetchAll<ExportData['assignments'][number]>(service, 'assignments', 'nomination_id, juror_id'),
    fetchAll<ExportData['scores'][number]>(service, 'latest_scores', 'nomination_id, juror_id, total_score, comment, version'),
    fetchAll<ExportData['jurors'][number]>(service, 'jury_users', 'id, name'),
  ])
  return { nominations, summaries, rankings, assignments, scores, jurors }
}

function workbook(sheets: SheetDef[]): Buffer {
  const wb = XLSX.utils.book_new()
  const used = new Set<string>()
  for (const s of sheets) {
    // De-dup sheet names (Excel requires uniqueness).
    let name = sheetName(s.name)
    let n = 2
    while (used.has(name.toLowerCase())) { name = sheetName(`${s.name} ${n++}`) }
    used.add(name.toLowerCase())
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([s.headers, ...s.aoa]), name)
  }
  if (sheets.length === 0) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['No data']]), 'Empty')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 })

  const params = new URL(req.url).searchParams
  const scope = params.get('scope') ?? 'all'
  const data = await loadExportData()

  let sheets: SheetDef[] = []
  let filename = 'et-jury-export.xlsx'

  if (scope === 'scorecard') {
    sheets = scorecardSheets(data)
    filename = 'et-jury-scorecard.xlsx'
  } else {
    const byCat = assembleByCategory(data)
    if (scope === 'category') {
      const key = params.get('key')
      if (!key) return new NextResponse('key required for scope=category', { status: 400 })
      sheets = [sheetForCategory(key, byCat.get(key) ?? [])]
      filename = `et-jury-${key}.xlsx`
    } else if (scope === 'master') {
      const master = params.get('master')
      if (!master) return new NextResponse('master required for scope=master', { status: 400 })
      const keys = [...byCat.entries()].filter(([, recs]) => recs[0]?.nom.master_category === master).map(([k]) => k)
      sheets = keys.sort().map((k) => sheetForCategory(k, byCat.get(k)!))
      filename = `et-jury-${master.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xlsx`
    } else {
      // scope === 'all'
      sheets = [...byCat.keys()].sort().map((k) => sheetForCategory(k, byCat.get(k)!))
      sheets.push(rankingsSheet(byCat))
      filename = 'et-jury-final-awards.xlsx'
    }
  }

  const buf = workbook(sheets)
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
