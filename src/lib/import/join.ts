import type {
  RawNomination,
  AuditedRow,
  MatchedRow,
  CategoryEntry,
  CategoryTally,
  ReconciliationReport,
} from './types'

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeStr(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // strip punctuation
    .replace(/\s+/g, ' ')
    .trim()
}

// Strip common legal-entity suffixes so "Acme Pvt Ltd" and "Acme" collapse to the
// same token set. Kept conservative (legal forms only) to avoid merging genuinely
// different companies.
const COMPANY_SUFFIXES =
  /\b(pvt|private|ltd|limited|llp|inc|incorporated|corp|corporation|co|company)\b/g

export function normalizeCompany(s: string): string {
  return normalizeStr(s).replace(COMPANY_SUFFIXES, ' ').replace(/\s+/g, ' ').trim()
}

// Canonical join key shared by raw nominations (from DB) and audited rows.
export function joinKeyFor(nomineeName: string, company: string, categoryKey: string): string {
  return `${normalizeStr(nomineeName)}|${normalizeCompany(company)}|${categoryKey}`
}

// Token-overlap similarity in [0,1] — used to rank candidate matches for an
// audited row that did not auto-match a raw nomination.
export function similarity(a: string, b: string): number {
  const ta = new Set(normalizeStr(a).split(' ').filter(Boolean))
  const tb = new Set(normalizeStr(b).split(' ').filter(Boolean))
  if (ta.size === 0 || tb.size === 0) return 0
  let inter = 0
  for (const t of ta) if (tb.has(t)) inter++
  return inter / Math.max(ta.size, tb.size)
}

function makeJoinKey(nomineeName: string, company: string, categoryKey: string): string {
  return joinKeyFor(nomineeName, company, categoryKey)
}

// ── Audited sheet name → normalized_key ───────────────────────────────────────
// The audited files use their own sheet names. Map them through category_mapping
// using a case-insensitive lookup on both the exact name and the lowercased name.

function lookupCategory(
  label: string,
  mapping: Map<string, CategoryEntry>,
): CategoryEntry | undefined {
  return mapping.get(label) ?? mapping.get(label.trim()) ?? mapping.get(label.trim().toLowerCase())
}

// ── Main join function ────────────────────────────────────────────────────────

export function joinData(
  rawRows: RawNomination[],
  auditedRows: AuditedRow[],
  categoryMapping: Map<string, CategoryEntry>,
): { matched: MatchedRow[]; report: ReconciliationReport } {

  // Build raw index: joinKey → rawRow
  // sheet_name on raw rows is already lowercased
  const rawByCategoryKey = new Map<string, RawNomination[]>()
  const rawIndex = new Map<string, RawNomination>()

  for (const row of rawRows) {
    const catEntry = lookupCategory(row.sheet_name, categoryMapping)
    if (!catEntry) continue // category not in mapping → skip silently (will appear in raw_only)
    const key = makeJoinKey(row.nominee_name, row.company, catEntry.normalized_key)
    rawIndex.set(key, row)

    const bucket = rawByCategoryKey.get(catEntry.normalized_key) ?? []
    bucket.push(row)
    rawByCategoryKey.set(catEntry.normalized_key, bucket)
  }

  // Match audited → raw
  const matched: MatchedRow[] = []
  const matchedRawKeys = new Set<string>()
  const auditedOnly: ReconciliationReport['audited_only'] = []

  // Tally: category_key → { raw, audited, matched }
  const tallyMap = new Map<string, CategoryTally>()

  const ensureTally = (key: string) => {
    if (!tallyMap.has(key)) tallyMap.set(key, { category_key: key, raw_count: 0, audited_count: 0, matched_count: 0 })
    return tallyMap.get(key)!
  }

  // Populate raw counts
  for (const [catKey, rows] of rawByCategoryKey) {
    ensureTally(catKey).raw_count = rows.length
  }

  for (const auditedRow of auditedRows) {
    const catEntry = lookupCategory(auditedRow.sheet_name, categoryMapping)
    if (!catEntry) {
      auditedOnly.push({
        nominee_name: auditedRow.nominee_name,
        company: auditedRow.company,
        sheet: auditedRow.sheet_name,
      })
      continue
    }

    const tally = ensureTally(catEntry.normalized_key)
    tally.audited_count++

    const key = makeJoinKey(auditedRow.nominee_name, auditedRow.company, catEntry.normalized_key)
    const rawRow = rawIndex.get(key)

    if (rawRow) {
      matched.push({
        raw: rawRow,
        audited: auditedRow,
        category_key: catEntry.normalized_key,
        master_category: catEntry.master_category,
      })
      matchedRawKeys.add(key)
      tally.matched_count++
    } else {
      auditedOnly.push({
        nominee_name: auditedRow.nominee_name,
        company: auditedRow.company,
        sheet: auditedRow.sheet_name,
      })
    }
  }

  // Raw-only: all raw rows whose join key was never matched
  const rawOnly: ReconciliationReport['raw_only'] = []
  for (const row of rawRows) {
    const catEntry = lookupCategory(row.sheet_name, categoryMapping)
    if (!catEntry) continue
    const key = makeJoinKey(row.nominee_name, row.company, catEntry.normalized_key)
    if (!matchedRawKeys.has(key)) {
      rawOnly.push({
        nomination_id: row.nomination_id,
        nominee_name: row.nominee_name,
        company: row.company,
        sheet: row.sheet_name,
      })
    }
  }

  const report: ReconciliationReport = {
    total_raw: rawRows.length,
    total_audited: auditedRows.length,
    total_matched: matched.length,
    by_category: [...tallyMap.values()].sort((a, b) =>
      a.category_key.localeCompare(b.category_key),
    ),
    audited_only: auditedOnly,
    raw_only: rawOnly,
  }

  return { matched, report }
}
