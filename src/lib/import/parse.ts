import * as XLSX from 'xlsx'
import { cleanCell, cleanId } from './clean'
import type { RawNomination, RawDataJson, AuditedRow } from './types'

// Columns that are meta / not part of the Q&A payload
const META_COLS = new Set([
  'Nomination Id', 'User Id', 'Status', 'Added Date', 'Nomination Status',
  'Email', 'First Name', 'Last Name', 'Mobile', 'Designation', 'Company',
  'Master Category Name', 'Category Name', 'Agency',
  'National Payment Id', 'National Payment Status', 'National Payment Date',
])

// Map a header to { group, question } for raw_data_json grouping
function classifyHeader(header: string): { group: string; question: string } | null {
  // Round -1 is used in some sheets as the first round
  const r1 = /^Round\s+-?1\s+/i
  const r2 = /^Round\s+2\s+/i
  const r3 = /^Round\s+3\s+/i
  const basic = /^Basic\s+Nomination\s+Form\s+/i

  if (r1.test(header)) return { group: 'Round 1', question: header.replace(r1, '').trim() }
  if (r2.test(header)) return { group: 'Round 2', question: header.replace(r2, '').trim() }
  if (r3.test(header)) return { group: 'Round 3', question: header.replace(r3, '').trim() }
  if (basic.test(header)) return { group: 'Basic', question: header.replace(basic, '').trim() }
  return null
}

function buildRawDataJson(
  row: Record<string, unknown>,
  headers: string[],
): RawDataJson {
  const result: RawDataJson = {}
  for (const header of headers) {
    if (META_COLS.has(header)) continue
    const classified = classifyHeader(header)
    if (!classified) continue
    const { group, question } = classified
    const value = cleanCell(row[header])
    if (!value) continue
    if (!result[group]) result[group] = {}
    // First non-empty value wins (handles duplicate headers like "Please Specify_1")
    if (!result[group][question]) result[group][question] = value
  }
  return result
}

// ── Raw nominations file ──────────────────────────────────────────────────────

// List every sheet in the raw workbook with its data-row count (rows that carry a
// Nomination Id). Drives the editable sheet → category mapping table in the admin UI.
export function listRawSheets(buffer: Buffer): { sheet_name: string; row_count: number }[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const out: { sheet_name: string; row_count: number }[] = []
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], {
      defval: null,
      raw: false,
    })
    const count = rows.filter((r) => cleanId(r['Nomination Id'])).length
    out.push({ sheet_name: sheetName.trim().toLowerCase(), row_count: count })
  }
  return out
}

export function parseRawFile(buffer: Buffer): RawNomination[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const results: RawNomination[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    // header:1 gives us the raw header row as the key; defval ensures missing cells are null
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: false,    // always stringify — avoids date objects
    })
    if (rows.length === 0) continue

    // Collect all headers from the first row's keys
    const headers = Object.keys(rows[0])

    for (const row of rows) {
      const nominationId = cleanId(row['Nomination Id'])
      if (!nominationId) continue

      const firstName = cleanCell(row['First Name'])
      const lastName = cleanCell(row['Last Name'])
      const nomineeName = [firstName, lastName].filter(Boolean).join(' ')

      results.push({
        sheet_name: sheetName.trim().toLowerCase(),
        nomination_id: nominationId,
        nominee_name: nomineeName,
        designation: cleanCell(row['Designation']),
        company: cleanCell(row['Company']),
        email: cleanCell(row['Email']),
        mobile: cleanCell(row['Mobile']),
        raw_data_json: buildRawDataJson(row, headers),
      })
    }
  }

  return results
}

// ── Audited list files ────────────────────────────────────────────────────────

const CRITERIA_PREFIX = 'Score: '
const CRITERIA_KEYS = [
  'People', 'Process', 'Technology', 'Community Impact', 'Legacy',
  'Major Initiative', 'Commitment & Structure', 'Domain Criticality',
  'Maturity', 'Frameworks & Standards / Compliance', 'Governance / Ownership',
  'Execution & Impact', 'Innovation & Differentiation', 'Strategic Vision',
]

function extractCriteriaScores(
  row: Record<string, unknown>,
): Record<string, number> | null {
  const scores: Record<string, number> = {}
  let found = false
  for (const key of CRITERIA_KEYS) {
    const col = CRITERIA_PREFIX + key
    const val = row[col]
    if (val !== null && val !== undefined && val !== '') {
      const n = parseFloat(String(val))
      if (!isNaN(n)) {
        scores[key] = n
        found = true
      }
    }
  }
  return found ? scores : null
}

// Master category is derived per-sheet from category_mapping by the import route,
// so it is left blank here.
export function parseAuditedFile(buffer: Buffer): AuditedRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const results: AuditedRow[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: false,
    })

    for (const row of rows) {
      const nomineeName = cleanCell(row['Nominee Name'])
      if (!nomineeName) continue

      // Some rows are placeholder / AI Judge rows — skip
      if (nomineeName.toLowerCase().includes('ai judge') ||
          nomineeName.toLowerCase().includes('et judge')) continue

      const rawScore = row['Total Score']
      const totalScore = rawScore !== null ? parseFloat(String(rawScore)) : 0

      const qualifiesRaw = cleanCell(row['Qualifies']).toUpperCase()
      const qualifies = qualifiesRaw === 'YES'

      results.push({
        sheet_name: sheetName.trim(),
        master_category: '',
        nominee_name: nomineeName,
        designation: cleanCell(row['Designation']),
        company: cleanCell(row['Company']),
        total_score: isNaN(totalScore) ? 0 : totalScore,
        qualifies,
        summary: cleanCell(row['Summary / Answer']),
        jury_notes: cleanCell(row['Jury Notes']),
        strategic_feedback: cleanCell(row['Strategic Feedback']),
        criteria_scores_json: extractCriteriaScores(row),
      })
    }
  }

  return results
}
