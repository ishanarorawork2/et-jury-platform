import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import NominationReview, { type ReviewData, type Criterion } from '@/components/nomination/NominationReview'

type Params = Promise<{ id: string }>

export default async function NominationDetailPage({ params }: { params: Params }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: jurorUser } = await supabase
    .from('jury_users')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = jurorUser?.role ?? 'juror'
  const backHref = role === 'admin' ? '/admin/nominations' : '/dashboard'

  const { data: nomination } = await supabase
    .from('nominations')
    .select('id, nomination_id, nominee_name, company, company_size, designation, master_category, category_key, raw_data_json')
    .eq('id', id)
    .single()

  if (!nomination) notFound()

  const { data: summary } = await supabase
    .from('editorial_summary')
    .select('summary, jury_notes, strategic_feedback, criteria_scores_json')
    .eq('nomination_id', id)
    .maybeSingle()

  // Rubric for this nomination's master category (readable by all authenticated users)
  const { data: rubricRow } = await supabase
    .from('rubric_templates')
    .select('criteria_json')
    .eq('master_category', nomination.master_category)
    .maybeSingle()

  // Latest score by this juror for this nomination (jurors only — admins don't score)
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

  const data: ReviewData = {
    nomination: nomination as ReviewData['nomination'],
    summary: summary ?? null,
    rubric: (rubricRow?.criteria_json ?? []) as Criterion[],
    existingScore,
    role,
  }

  return (
    <div className="mx-auto max-w-[80rem]">
      <Link
        href={backHref}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back
      </Link>
      <NominationReview data={data} layout="page" />
    </div>
  )
}
