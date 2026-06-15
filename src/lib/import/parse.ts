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

// Try multiple column name aliases; return the first non-empty value
function pickCell(row: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = cleanCell(row[key])
    if (v) return v
  }
  return ''
}

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
export const CRITERIA_KEYS = [
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
        summary: pickCell(row, 'Summary / Answer', 'Refined Summary'),
        jury_notes: pickCell(row, 'Jury Notes', 'Refined Jury Notes'),
        strategic_feedback: pickCell(row, 'Strategic Feedback', 'Strengths & Achievement Points'),
        criteria_scores_json: extractCriteriaScores(row),
      })
    }
  }

  return results
}

// ── Combined CSV (raw + AI scores in one file) ────────────────────────────────

// Columns in the combined CSV that are meta / not Q&A payload.
const COMBINED_EXTRA_META = new Set([
  'Basic Added Date', 'Basic Status',
  'Category',
  'Master_Score: People', 'Master_Score: Process', 'Master_Score: Technology',
  'Master_Total Score', 'Master_Qualifies',
  'Master_Summary / Answer', 'Master_Jury Notes', 'Master_Strategic Feedback',
  'Refined Summary', 'Refined Jury Notes', 'Strengths & Achievement Points',
])

function buildCombinedRawDataJson(
  row: Record<string, unknown>,
  headers: string[],
): RawDataJson {
  const result: RawDataJson = {}
  for (const header of headers) {
    if (META_COLS.has(header)) continue
    if (COMBINED_EXTRA_META.has(header)) continue
    if (/^Master[_\s]/i.test(header)) continue
    const classified = classifyHeader(header)
    if (!classified) continue
    const { group, question } = classified
    const value = cleanCell(row[header])
    if (!value) continue
    if (!result[group]) result[group] = {}
    if (!result[group][question]) result[group][question] = value
  }
  return result
}

export interface CombinedRow {
  nomination_id: string
  nominee_name: string
  designation: string
  company: string
  email: string
  mobile: string
  /** Raw value of "Master Category Name" — resolved to normalized_key in the route. */
  category_label: string
  raw_data_json: RawDataJson
  total_score: number
  qualifies: boolean
  summary: string
  jury_notes: string
  strategic_feedback: string
  criteria_scores_json: Record<string, number> | null
}

export function parseCombinedCsv(buffer: Buffer): CombinedRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: false, raw: false })
  const results: CombinedRow[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: false,
    })
    if (rows.length === 0) continue
    const headers = Object.keys(rows[0])

    for (const row of rows) {
      const nominationId = cleanId(row['Nomination Id'])
      if (!nominationId) continue

      const firstName = cleanCell(row['First Name'])
      const lastName = cleanCell(row['Last Name'])
      const nomineeName = [firstName, lastName].filter(Boolean).join(' ')
      if (!nomineeName) continue

      const rawScore = row['Master_Total Score']
      const totalScore =
        rawScore !== null && rawScore !== undefined && rawScore !== ''
          ? parseFloat(String(rawScore))
          : 0

      const qualifiesRaw = cleanCell(row['Master_Qualifies']).toUpperCase()

      const criteriaScores: Record<string, number> = {}
      let hasCriteria = false
      for (const key of CRITERIA_KEYS) {
        const col = 'Master_Score: ' + key
        const val = row[col]
        if (val !== null && val !== undefined && val !== '') {
          const n = parseFloat(String(val))
          if (!isNaN(n)) {
            criteriaScores[key] = n
            hasCriteria = true
          }
        }
      }

      results.push({
        nomination_id: nominationId,
        nominee_name: nomineeName,
        designation: cleanCell(row['Designation']),
        company: cleanCell(row['Company']),
        email: cleanCell(row['Email']),
        mobile: cleanCell(row['Mobile']),
        // Prefer the specific "Category" column (e.g. "ET CISO of the Year") over the
        // coarser "Master Category Name" — the former maps directly to category_mapping.raw_label.
        category_label: cleanCell(row['Category']) || cleanCell(row['Master Category Name']),
        raw_data_json: buildCombinedRawDataJson(row, headers),
        total_score: isNaN(totalScore) ? 0 : totalScore,
        qualifies: qualifiesRaw === 'YES',
        summary: pickCell(row, 'Master_Summary / Answer', 'Refined Summary'),
        jury_notes: pickCell(row, 'Master_Jury Notes', 'Refined Jury Notes'),
        strategic_feedback: pickCell(row, 'Master_Strategic Feedback', 'Strengths & Achievement Points'),
        criteria_scores_json: hasCriteria ? criteriaScores : null,
      })
    }
  }

  return results
}
