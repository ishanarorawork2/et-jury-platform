import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Surfaces whose server render reflects a newly submitted score. Revalidated on
// every successful submit so admin screens go live without a manual refresh —
// the core staleness fix (no realtime layer exists; see plan Part C3).
function revalidateScoreSurfaces(nominationId: string) {
  revalidatePath('/admin/results')
  revalidatePath('/admin/progress')
  revalidatePath('/admin/nominations')
  revalidatePath('/dashboard')
  revalidatePath('/nominations/[id]', 'page')
  // The literal path too, in case the dynamic segment form misses a cached entry.
  revalidatePath(`/nominations/${nominationId}`)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as {
    nomination_id: string
    criteria_scores_json: Record<string, number>
    comment?: string
  }
  const { nomination_id, criteria_scores_json, comment } = body
  if (!nomination_id || !criteria_scores_json || typeof criteria_scores_json !== 'object') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Single atomic RPC on the user's own session: authz + rubric validation +
  // mean total + versioned append, all server-side. No service role, no
  // assignments.status dual-write — completion now derives from the score row.
  const submit = () =>
    supabase.rpc('submit_score', {
      p_nomination_id: nomination_id,
      p_criteria_scores: criteria_scores_json,
      p_comment: comment ?? null,
    })

  let { data, error } = await submit()

  // A concurrent double-submit collides on the UNIQUE(nom,juror,version) key.
  // Retry once — the version is recomputed inside the function, so the retry
  // lands the next version cleanly.
  if (error?.code === '23505') {
    ;({ data, error } = await submit())
  }

  if (error) {
    switch (error.code) {
      case '42501':
        return NextResponse.json({ error: 'Not assigned to this nomination' }, { status: 403 })
      case '23514':
        return NextResponse.json({ error: error.message || 'Invalid scores' }, { status: 400 })
      case '23505':
        return NextResponse.json({ error: 'Conflicting submission, please retry' }, { status: 409 })
      default:
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  // RPC returns the inserted `scores` row.
  const row = (Array.isArray(data) ? data[0] : data) as { total_score: number; version: number }

  revalidateScoreSurfaces(nomination_id)

  return NextResponse.json({ ok: true, total_score: row.total_score, version: row.version })
}
