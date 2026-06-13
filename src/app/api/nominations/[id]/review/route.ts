import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// RLS-aware review payload for the full-page modal. Uses the anon (cookie) client so
// jurors only get nominations assigned to them; admins pass via the is_admin() policy.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: jurorUser } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  const role = jurorUser?.role ?? 'juror'

  const { data: nomination } = await supabase
    .from('nominations')
    .select('id, nomination_id, nominee_name, company, designation, master_category, category_key, raw_data_json')
    .eq('id', id)
    .maybeSingle()

  if (!nomination) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: summary } = await supabase
    .from('editorial_summary')
    .select('summary, jury_notes, strategic_feedback, criteria_scores_json')
    .eq('nomination_id', id)
    .maybeSingle()

  const { data: rubricRow } = await supabase
    .from('rubric_templates')
    .select('criteria_json')
    .eq('master_category', nomination.master_category)
    .maybeSingle()

  let existingScore = null
  if (role === 'juror') {
    const { data: score } = await supabase
      .from('scores')
      .select('criteria_scores_json, total_score, comment, version, submitted_at')
      .eq('nomination_id', id)
      .eq('juror_id', user.id)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle()
    existingScore = score ?? null
  }

  return NextResponse.json({
    nomination,
    summary: summary ?? null,
    rubric: rubricRow?.criteria_json ?? [],
    existingScore,
    role,
  })
}
