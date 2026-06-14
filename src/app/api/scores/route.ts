import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('jury_users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'juror') {
    return NextResponse.json({ error: 'Only jurors can submit scores' }, { status: 403 })
  }

  const body = await req.json() as {
    nomination_id: string
    criteria_scores_json: Record<string, number>
    comment?: string
  }

  const { nomination_id, criteria_scores_json, comment } = body
  if (!nomination_id || !criteria_scores_json || typeof criteria_scores_json !== 'object') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify this juror is assigned to the nomination
  const { data: assignment } = await supabase
    .from('assignments')
    .select('id')
    .eq('nomination_id', nomination_id)
    .eq('juror_id', user.id)
    .maybeSingle()

  if (!assignment) {
    return NextResponse.json({ error: 'Not assigned to this nomination' }, { status: 403 })
  }

  // total_score = average (mean) of all criteria scores, on a 0–100 scale
  const criteriaValues = Object.values(criteria_scores_json)
  const total_score = criteriaValues.length > 0
    ? Math.round((criteriaValues.reduce((sum, v) => sum + (Number(v) || 0), 0) / criteriaValues.length) * 10) / 10
    : 0

  // Next version number (scores are append-only)
  const { data: lastScore } = await supabase
    .from('scores')
    .select('version')
    .eq('nomination_id', nomination_id)
    .eq('juror_id', user.id)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()

  const version = (lastScore?.version ?? 0) + 1

  const { error: insertError } = await supabase.from('scores').insert({
    juror_id: user.id,
    nomination_id,
    criteria_scores_json,
    total_score,
    comment: comment || null,
    version,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Mark assignment as scored (uses service role to bypass RLS — jurors have no UPDATE policy)
  const service = createServiceClient()
  await service
    .from('assignments')
    .update({ status: 'scored' })
    .eq('nomination_id', nomination_id)
    .eq('juror_id', user.id)

  return NextResponse.json({ ok: true, total_score, version })
}
