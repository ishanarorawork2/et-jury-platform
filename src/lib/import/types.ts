export interface RawNomination {
  sheet_name: string
  nomination_id: string
  nominee_name: string
  designation: string
  company: string
  email: string
  mobile: string
  raw_data_json: RawDataJson
}

// { "Round 1": { "Question label": "Answer" }, "Round 2": {...}, ... }
export type RawDataJson = Record<string, Record<string, string>>

export interface AuditedRow {
  sheet_name: string
  master_category: string
  nominee_name: string
  designation: string
  company: string
  total_score: number
  qualifies: boolean
  summary: string
  jury_notes: string
  strategic_feedback: string
  criteria_scores_json: Record<string, number> | null
}

export interface MatchedRow {
  raw: RawNomination
  audited: AuditedRow
  category_key: string
  master_category: string
}

export interface CategoryEntry {
  normalized_key: string
  master_category: string
}

// Per-category tallies for the reconciliation report
export interface CategoryTally {
  category_key: string
  raw_count: number
  audited_count: number
  matched_count: number
}

export interface ReconciliationReport {
  total_raw: number
  total_audited: number
  total_matched: number
  by_category: CategoryTally[]
  audited_only: Array<{ nominee_name: string; company: string; sheet: string }>
  raw_only: Array<{ nomination_id: string; nominee_name: string; company: string; sheet: string }>
}

// ── Two-phase import (raw-first / audited-second) ──────────────────────────────

// One row of the editable sheet → category mapping table (Step 1).
export interface RawSheetSummary {
  sheet_name: string
  row_count: number
  guessed_key: string | null    // normalized_key auto-guessed via category_mapping
  guessed_master: string | null
}

// A staged audited row pending reconciliation (Step 2).
export interface StagedAuditedRow {
  id: string
  normalized_key: string
  master_category: string
  nominee_name: string
  company: string
  designation: string | null
  total_score: number | null
  qualifies: boolean | null
  summary: string | null
  jury_notes: string | null
  strategic_feedback: string | null
  match_status: 'matched' | 'unmatched' | 'skipped' | 'duplicate'
  matched_nomination_id: string | null
}

// Upload-batch history row (one per stage upload, persisted across finalize).
export interface ImportBatch {
  id: string
  created_at: string
  uploaded_by: string | null
  uploaded_by_name: string | null
  file_names: string[]
  master_categories: string[]
  categories: string[]
  matched_count: number
  duplicate_count: number
  unmatched_count: number
  imported_count: number
  error_count: number
  status: 'staged' | 'finalized' | 'discarded'
  finalized_at: string | null
}

// Per-master-category editorial-summary coverage for the import dashboard.
export interface CoverageSummary {
  by_master: Array<{ master_category: string; total: number; with_summary: number }>
  total: number
  with_summary: number
  pending: number
}

// A candidate raw nomination offered for a manually-resolved audited row.
export interface CandidateNomination {
  id: string
  nomination_id: string
  nominee_name: string
  company: string
  score: number
}

export interface ImportPreview {
  report: ReconciliationReport
  sample_matched: Array<{
    nomination_id: string
    nominee_name: string
    company: string
    category_key: string
    total_score: number
    qualifies: boolean
  }>
}
