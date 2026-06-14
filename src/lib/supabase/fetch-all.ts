import type { SupabaseClient } from '@supabase/supabase-js'

// PostgREST caps a single select at 1000 rows by default. Tables/views like
// assignments, nominations and latest_scores can exceed that, so page through
// with .range() and concatenate — otherwise aggregates are silently truncated.
export async function fetchAll<T>(
  client: SupabaseClient,
  table: string,
  columns: string,
  pageSize = 1000
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    rows.push(...(data as T[]))
    if (data.length < pageSize) break
  }
  return rows
}
