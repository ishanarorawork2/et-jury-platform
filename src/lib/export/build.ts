import { categoryLabel } from '@/lib/categories'

// ── Source row shapes (selected from the DB) ────────────────────────────────────

export type ExportNom = {
  id: string
  nomination_id: string
  nominee_name: string
  company: string
  designation: string | null
  email: string | null
  mobile: string | null
  company_size: string | null
  master_category: string
  category_key: string
  raw_data_json: Record<string, Record<string, string>>
}
export type ExportSummary = {
  nomination_id: string
  total_score: number | null
  qualifies: boolean | null
  summary: string | null
  jury_notes: string | null
  strategic_feedback: string | null
  criteria_scores_json: Record<string, number> | null
}
// Assignment shape no longer carries `status` — completion/scored state is read
// from the views, not the assignment flag.
export type ExportAssignment = { nomination_id: string; juror_id: string }
// Latest score per (nomination, juror), straight from the latest_scores view.
export type ExportScore = { nomination_id: string; juror_id: string; total_score: number; comment: string | null; version: number }
export type ExportJuror = { id: string; name: string }
// Pre-computed completion + ranking from the category_rankings view (uuid keyed).
export type ExportRanking = {
  nomination_id: string
  category_key: string
  master_category: string
  complete: boolean
  final_score: number | null
  rank: number | null
  tied: boolean
}

export type ExportData = {
  nominations: ExportNom[]
  summaries: ExportSummary[]
  rankings: ExportRanking[]
  assignments: ExportAssignment[]
  scores: ExportScore[]
  jurors: ExportJuror[]
}

// ── Assembled unified record (one per nomination) ───────────────────────────────

export type JurorResult = { name: string; total: number; comment: string | null }
export type Assembled = {
  nom: ExportNom
  summary: ExportSummary | null
  complete: boolean
  final_score: number | null
  rank: number | null
  tied: boolean
  jurorResults: JurorResult[]
}

export type SheetDef = { name: string; headers: string[]; aoa: (string | number)[][] }

// Build assembled records grouped by category_key (the award category).
// Completion, final score, rank and ties come pre-computed from the
// category_rankings view — this guarantees the export matches the UI exactly.
export function assembleByCategory(data: ExportData): Map<string, Assembled[]> {
  const jurorMap = new Map(data.jurors.map((j) => [j.id, j.name]))
  const summaryMap = new Map(data.summaries.map((s) => [s.nomination_id, s]))
  const rankingMap = new Map(data.rankings.map((r) => [r.nomination_id, r]))

  // Latest scores per nomination (one row per juror, straight from the view).
  const scoresByNom = new Map<string, ExportScore[]>()
  for (const s of data.scores) {
    if (!scoresByNom.has(s.nomination_id)) scoresByNom.set(s.nomination_id, [])
    scoresByNom.get(s.nomination_id)!.push(s)
  }

  const records: Assembled[] = data.nominations.map((nom) => {
    const ranking = rankingMap.get(nom.id)
    const jurorResults: JurorResult[] = (scoresByNom.get(nom.id) ?? [])
      .map((s) => ({ name: jurorMap.get(s.juror_id) ?? 'Unknown', total: Number(s.total_score), comment: s.comment }))
      .sort((a, b) => a.name.localeCompare(b.name))
    return {
      nom,
      summary: summaryMap.get(nom.id) ?? null,
      complete: ranking?.complete ?? false,
      final_score: ranking?.final_score ?? null,
      rank: ranking?.rank ?? null,
      tied: ranking?.tied ?? false,
      jurorResults,
    }
  })

  const byCat = new Map<string, Assembled[]>()
  for (const r of records) {
    if (!byCat.has(r.nom.category_key)) byCat.set(r.nom.category_key, [])
    byCat.get(r.nom.category_key)!.push(r)
  }

  // Order within each category: ranked (complete) rows first by rank, rest after.
  for (const recs of byCat.values()) {
    recs.sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? -1 : 1
      return (a.rank ?? 9999) - (b.rank ?? 9999)
    })
  }
  return byCat
}

// Find a value in the Basic section by a case-insensitive key pattern.
// (Field labels carry mojibake/variants, so match loosely rather than exact.)
function basicField(raw: Record<string, Record<string, string>>, pattern: RegExp): string {
  const basic = raw?.['Basic'] ?? {}
  for (const [k, v] of Object.entries(basic)) if (pattern.test(k)) return v ?? ''
  return ''
}

// Categories where the company-size bucket (e.g. "Large Enterprise") is captured.
const COMPANY_SIZE_CATEGORIES = new Set(['et_ciso', 'et_rising_star'])

// One sheet for a single category — final result columns only.
export function sheetForCategory(categoryKey: string, records: Assembled[]): SheetDef {
  // Union of AI criterion keys across the sheet, preserving first-seen order.
  const critCols: string[] = []
  const critSeen = new Set<string>()
  for (const r of records) for (const k of Object.keys(r.summary?.criteria_scores_json ?? {})) {
    if (!critSeen.has(k)) { critSeen.add(k); critCols.push(k) }
  }

  const showCompanySize = COMPANY_SIZE_CATEGORIES.has(categoryKey)

  const headers = [
    'Master Category', 'Category', 'Nominee ID', 'Name', 'Company', 'Designation',
    'Email', 'Number',
    'Company Revenue', 'Company Size (Employee Count)',
    ...(showCompanySize ? ['Company Size'] : []),
    ...critCols.map((c) => `AI Score: ${c}`), 'AI Total Score',
    'Jury 1 Name', 'Jury 1 Score', 'Jury 2 Name', 'Jury 2 Score',
    'Jury 1 Comment', 'Jury 2 Comment',
    'Final Score', 'Rank',
  ]

  // Sort: complete (by rank) first, then incomplete.
  const ordered = [...records].sort((a, b) => {
    if (a.complete !== b.complete) return a.complete ? -1 : 1
    return (a.rank ?? 9999) - (b.rank ?? 9999)
  })

  const aoa = ordered.map((r) => {
    const j1 = r.jurorResults[0]
    const j2 = r.jurorResults[1]
    return [
      r.nom.master_category,
      categoryLabel(r.nom.category_key),
      r.nom.nomination_id,
      r.nom.nominee_name,
      r.nom.company,
      r.nom.designation ?? '',
      r.nom.email ?? '',
      r.nom.mobile ?? '',
      basicField(r.nom.raw_data_json, /revenue/i),
      basicField(r.nom.raw_data_json, /employee\s*size/i),
      ...(showCompanySize ? [r.nom.company_size && r.nom.company_size !== 'Not Defined' ? r.nom.company_size : ''] : []),
      ...critCols.map((c) => r.summary?.criteria_scores_json?.[c] ?? ''),
      r.summary?.total_score ?? '',
      j1?.name ?? '',
      j1 ? j1.total : '',
      j2?.name ?? '',
      j2 ? j2.total : '',
      j1?.comment ?? '',
      j2?.comment ?? '',
      r.final_score != null ? Number(r.final_score.toFixed(1)) : '',
      r.rank != null ? `${r.rank}${r.tied ? ' (tie)' : ''}` : '',
    ] as (string | number)[]
  })

  return { name: sheetName(categoryLabel(categoryKey)), headers, aoa }
}

// Cross-category final-awards ranking sheet.
export function rankingsSheet(byCat: Map<string, Assembled[]>): SheetDef {
  const headers = ['Master Category', 'Category', 'Rank', 'Nominee Name', 'Company', 'Final Average', 'Tie']
  const aoa: (string | number)[][] = []
  const cats = [...byCat.keys()].sort()
  for (const cat of cats) {
    const complete = byCat.get(cat)!.filter((r) => r.complete).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    for (const r of complete) {
      aoa.push([
        r.nom.master_category,
        categoryLabel(cat),
        r.rank ?? '',
        r.nom.nominee_name,
        r.nom.company,
        r.final_score != null ? Number(r.final_score.toFixed(1)) : '',
        r.tied ? 'Yes' : '',
      ])
    }
  }
  return { name: 'Rankings', headers, aoa }
}

// Juror-centric scorecard: one row per juror × assigned nomination + a summary sheet.
export function scorecardSheets(data: ExportData): SheetDef[] {
  const jurorMap = new Map(data.jurors.map((j) => [j.id, j.name]))
  const nomMap = new Map(data.nominations.map((n) => [n.id, n]))
  // latest_scores has one row per (nomination, juror); presence ⇒ submitted.
  const latest = new Map<string, ExportScore>()
  for (const s of data.scores) latest.set(`${s.nomination_id}:${s.juror_id}`, s)

  const detailHeaders = ['Jury Member', 'Nomination Id', 'Nominee', 'Category', 'Status', 'Score Given', 'Comments']
  const detail: (string | number)[][] = []
  const summaryCount = new Map<string, { assigned: number; submitted: number }>()

  for (const a of data.assignments) {
    const nom = nomMap.get(a.nomination_id)
    if (!nom) continue
    const jurorName = jurorMap.get(a.juror_id) ?? 'Unknown'
    const sc = latest.get(`${a.nomination_id}:${a.juror_id}`)
    const submitted = !!sc
    detail.push([
      jurorName,
      nom.nomination_id,
      nom.nominee_name,
      categoryLabel(nom.category_key),
      submitted ? 'Submitted' : 'Pending',
      submitted && sc ? sc.total_score : '',
      sc?.comment ?? '',
    ])
    const agg = summaryCount.get(jurorName) ?? { assigned: 0, submitted: 0 }
    agg.assigned++
    if (submitted) agg.submitted++
    summaryCount.set(jurorName, agg)
  }

  detail.sort((a, b) => String(a[0]).localeCompare(String(b[0])))

  const summaryHeaders = ['Jury Member', 'Assigned', 'Submitted', 'Pending']
  const summaryAoa = [...summaryCount.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, c]) => [name, c.assigned, c.submitted, c.assigned - c.submitted] as (string | number)[])

  return [
    { name: 'Summary', headers: summaryHeaders, aoa: summaryAoa },
    { name: 'Scorecard', headers: detailHeaders, aoa: detail },
  ]
}

// Excel sheet names: max 31 chars, no : \ / ? * [ ]
export function sheetName(label: string): string {
  return label.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31).trim() || 'Sheet'
}
