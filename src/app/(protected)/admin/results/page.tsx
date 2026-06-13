import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PageHeader } from '@/components/ui/page-header'
import ResultsBrowser, { type ResultRow } from '@/components/admin/ResultsBrowser'

type JurorScore = { juror_id: string; juror_name: string; total_score: number }

function buildResults(
  nominations: { id: string; nomination_id: string; nominee_name: string; company: string; master_category: string; category_key: string }[],
  assignments: { nomination_id: string; juror_id: string; status: string }[],
  scores: { nomination_id: string; juror_id: string; total_score: number; version: number }[],
  jurors: { id: string; name: string }[],
): Record<string, ResultRow[]> {
  const jurorMap = new Map(jurors.map(j => [j.id, j.name]))

  const latestScoreMap = new Map<string, number>()
  for (const s of scores) {
    const key = `${s.nomination_id}:${s.juror_id}`
    if (!latestScoreMap.has(key)) latestScoreMap.set(key, s.total_score)
  }

  const assignmentsByNom = new Map<string, typeof assignments>()
  for (const a of assignments) {
    if (!assignmentsByNom.has(a.nomination_id)) assignmentsByNom.set(a.nomination_id, [])
    assignmentsByNom.get(a.nomination_id)!.push(a)
  }

  const rows: ResultRow[] = nominations.map(n => {
    const nomAssignments = assignmentsByNom.get(n.id) ?? []
    const scoredAssignments = nomAssignments.filter(a => a.status === 'scored')
    const complete = scoredAssignments.length >= 2

    const jurorScores: JurorScore[] = scoredAssignments.map(a => ({
      juror_id: a.juror_id,
      juror_name: jurorMap.get(a.juror_id) ?? 'Unknown',
      total_score: latestScoreMap.get(`${n.id}:${a.juror_id}`) ?? 0,
    }))

    const final_score = complete
      ? jurorScores.reduce((sum, s) => sum + s.total_score, 0) / 2
      : null

    return {
      id: n.id,
      nomination_id: n.nomination_id,
      nominee_name: n.nominee_name,
      company: n.company,
      master_category: n.master_category,
      category_key: n.category_key,
      complete,
      final_score,
      juror_scores: jurorScores,
      rank: null,
      tied: false,
    }
  })

  const categories = [...new Set(rows.map(r => r.master_category))].sort()
  const result: Record<string, ResultRow[]> = {}

  for (const cat of categories) {
    const catRows = rows.filter(r => r.master_category === cat)
    const complete = catRows
      .filter(r => r.complete)
      .sort((a, b) => (b.final_score ?? 0) - (a.final_score ?? 0))
    const incomplete = catRows.filter(r => !r.complete)

    let rankVar = 1
    for (let i = 0; i < complete.length; i++) {
      if (i > 0 && complete[i].final_score === complete[i - 1].final_score) {
        complete[i].rank = complete[i - 1].rank
        complete[i].tied = true
        complete[i - 1].tied = true
      } else {
        complete[i].rank = rankVar
      }
      rankVar = i + 2
    }

    result[cat] = [...complete, ...incomplete]
  }

  return result
}

export default async function AdminResultsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const service = await createServiceClient()

  const [{ data: nominations }, { data: assignments }, { data: scores }, { data: jurors }] = await Promise.all([
    service.from('nominations').select('id, nomination_id, nominee_name, company, master_category, category_key').order('nominee_name'),
    service.from('assignments').select('nomination_id, juror_id, status'),
    service.from('scores').select('nomination_id, juror_id, total_score, version').order('version', { ascending: false }),
    service.from('jury_users').select('id, name').eq('role', 'juror'),
  ])

  const categoryResults = buildResults(
    nominations ?? [],
    assignments ?? [],
    scores ?? [],
    jurors ?? [],
  )

  const allRows = Object.values(categoryResults).flat()
  const totalComplete = allRows.filter(r => r.complete).length
  const totalTied = allRows.filter(r => r.tied).length

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Results & Rankings"
        description={
          <>
            {totalComplete} complete · {allRows.length - totalComplete} incomplete
            {totalTied > 0 && <span className="ml-2 text-amber-600">{totalTied} tied nominations</span>}
          </>
        }
        actions={
          <div className="flex gap-2">
            <a
              href="/api/admin/results/export?scope=scorecard"
              className="inline-flex h-8 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              Jury Scorecard
            </a>
            <a
              href="/api/admin/results/export?scope=all"
              className="inline-flex h-8 items-center rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:opacity-90"
            >
              Final Awards (.xlsx)
            </a>
          </div>
        }
      />

      <ResultsBrowser categoryResults={categoryResults} />
    </div>
  )
}
