import { createServiceClient } from '@/lib/supabase/server'
import { normalizeStr } from './join'

export interface CategoryEntryResolved {
  normalized_key: string
  master_category: string
}

export interface CategoryMapping {
  // Resolve a raw sheet / award-category label to its canonical key + master category.
  lookup: (label: string) => CategoryEntryResolved | null
  // normalized_key → master_category (one entry per canonical category).
  keyToMaster: Map<string, string>
  // All canonical category keys.
  keys: string[]
}

// Loads category_mapping once and returns case-insensitive lookup helpers.
// Used by both the raw and audited import phases.
export async function loadCategoryMapping(): Promise<CategoryMapping> {
  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('category_mapping')
    .select('raw_label, normalized_key, master_category')

  if (error || !data) throw new Error('Failed to load category_mapping: ' + error?.message)

  const byLabel = new Map<string, CategoryEntryResolved>()
  const keyToMaster = new Map<string, string>()
  for (const row of data) {
    const entry: CategoryEntryResolved = {
      normalized_key: row.normalized_key,
      master_category: row.master_category,
    }
    byLabel.set(row.raw_label, entry)
    byLabel.set(row.raw_label.toLowerCase(), entry)
    byLabel.set(normalizeStr(row.raw_label), entry)
    keyToMaster.set(row.normalized_key, row.master_category)
  }

  const lookup = (label: string): CategoryEntryResolved | null =>
    byLabel.get(label) ??
    byLabel.get(label.trim()) ??
    byLabel.get(label.trim().toLowerCase()) ??
    byLabel.get(normalizeStr(label)) ??
    null

  return { lookup, keyToMaster, keys: [...keyToMaster.keys()] }
}
