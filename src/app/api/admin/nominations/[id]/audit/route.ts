import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import type { LifecycleStatus } from '@/lib/status'

// Read-only, admin-gated derivation/audit payload for one nomination. The
// ScoreAuditPanel lazy-fetches this on drawer open (mirrors the review modal).
// Returns the full computed result plus every juror's version history, so the
// panel can show exactly how the final score was derived and how it evolved.

type Criterion = { key: string; label: string; min: number; max: number }
type ScoreVersion = {
  version: number
  total_score: number
  criteria_scores_json: Record<string, number> | null
  comment: string | null
  submitted_at: string
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const service = createServiceClient()

  const [rankingRes, divergenceRes, finalizedRes, assignmentsRes, scoresRes, jurorsRes] = await Promise.all([
    service.from('category_rankings').select('*').eq('nomination_id', id).maybeSingle(),
    service.from('score_divergence').select('divergence').eq('nomination_id', id).maybeSingle(),
    service.from('finalized_rankings').select('*').eq('nomination_id', id).maybeSingle(),
    service.from('assignments').select('juror_id').eq('nomination_id', id),
    service.from('scores')
      .select('juror_id, version, total_score, criteria_scores_json, comment, submitted_at')
      .eq('nomination_id', id)
      .order('version', { ascending: false }),
    service.from('jury_users').select('id, name'),
  ])

  const ranking = rankingRes.data as
    | {
        nomination_id: string
        display_id: string
        nominee_name: string
        company: string
        master_category: string
        category_key: string
        assigned_count: number
        scored_count: number
        final_score: number | null
        complete: boolean
        is_finalized: boolean
        lifecycle_status: LifecycleStatus
        rank: number | null
        tied: boolean
      }
    | null

  if (!ranking) return NextResponse.json({ error: 'Nomination not found' }, { status: 404 })

  const jurorMap = new Map((jurorsRes.data ?? []).map((j) => [j.id, j.name]))

  // All score versions, grouped per juror (version-desc).
  const versionsByJuror = new Map<string, ScoreVersion[]>()
  for (const s of scoresRes.data ?? []) {
    const list = versionsByJuror.get(s.juror_id) ?? []
    list.push({
      version: s.version,
      total_score: Number(s.total_score),
      criteria_scores_json: s.criteria_scores_json,
      comment: s.comment,
      submitted_at: s.submitted_at,
    })
    versionsByJuror.set(s.juror_id, list)
  }

  // Union of assigned jurors and any juror who has scored (covers the edge where
  // a score exists from a since-removed assignment).
  const jurorIds = new Set<string>([
    ...(assignmentsRes.data ?? []).map((a) => a.juror_id),
    ...versionsByJuror.keys(),
  ])

  const jurors = [...jurorIds]
    .map((jid) => {
      const history = versionsByJuror.get(jid) ?? []
      return {
        juror_id: jid,
        juror_name: jurorMap.get(jid) ?? 'Unknown',
        submitted: history.length > 0,
        latest: history[0] ?? null,
        history,
      }
    })
    .sort((a, b) => a.juror_name.localeCompare(b.juror_name))

  const { data: rubricRow } = await service
    .from('rubric_templates')
    .select('criteria_json')
    .eq('master_category', ranking.master_category)
    .maybeSingle()
  const rubric = (rubricRow?.criteria_json ?? []) as Criterion[]

  const finalized = finalizedRes.data as
    | { rank: number | null; final_score: number | null; finalized_by: string | null; finalized_at: string; juror_breakdown: unknown }
    | null

  return NextResponse.json({
    nomination: {
      id: ranking.nomination_id,
      display_id: ranking.display_id,
      nominee_name: ranking.nominee_name,
      company: ranking.company,
      master_category: ranking.master_category,
      category_key: ranking.category_key,
    },
    lifecycle_status: ranking.lifecycle_status,
    assigned_count: ranking.assigned_count,
    scored_count: ranking.scored_count,
    complete: ranking.complete,
    final_score: ranking.final_score != null ? Number(ranking.final_score) : null,
    rank: ranking.rank,
    tied: ranking.tied,
    divergence: divergenceRes.data ? Number(divergenceRes.data.divergence) : null,
    is_finalized: ranking.is_finalized,
    finalized: finalized
      ? {
          rank: finalized.rank,
          final_score: finalized.final_score != null ? Number(finalized.final_score) : null,
          finalized_at: finalized.finalized_at,
          finalized_by_name: finalized.finalized_by ? jurorMap.get(finalized.finalized_by) ?? null : null,
          juror_breakdown: finalized.juror_breakdown,
        }
      : null,
    rubric,
    jurors,
  })
}
