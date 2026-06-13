import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  if (!category) return NextResponse.json({ error: 'category query param required' }, { status: 400 })

  const service = await createServiceClient()
  // `editorial_summary!inner` restricts to nominations that have a matched summary —
  // only those are eligible for jury assignment.
  const { data, error } = await service
    .from('nominations')
    .select(`
      id, nomination_id, nominee_name, company, master_category, category_key,
      editorial_summary!inner ( id ),
      assignments ( id, juror_id, status, jury_users!juror_id ( id, name ) )
    `)
    .eq('master_category', category)
    .order('nominee_name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { nomination_id, juror_id } = await req.json()
  if (!nomination_id || !juror_id) {
    return NextResponse.json({ error: 'nomination_id and juror_id are required' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { count } = await service
    .from('assignments')
    .select('*', { count: 'exact', head: true })
    .eq('nomination_id', nomination_id)

  if ((count ?? 0) >= 2) {
    return NextResponse.json({ error: 'This nomination already has 2 jurors assigned' }, { status: 409 })
  }

  const { data: existing } = await service
    .from('assignments')
    .select('id')
    .eq('nomination_id', nomination_id)
    .eq('juror_id', juror_id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Juror is already assigned to this nomination' }, { status: 409 })
  }

  // Conflict check: reject if juror has a declared conflict with this nomination's company
  const { data: nomination } = await service
    .from('nominations')
    .select('company')
    .eq('id', nomination_id)
    .single()

  if (nomination) {
    const { data: conflict } = await service
      .from('conflicts')
      .select('id')
      .eq('juror_id', juror_id)
      .ilike('company', nomination.company)
      .maybeSingle()

    if (conflict) {
      return NextResponse.json({ error: 'Juror has a declared conflict with this company' }, { status: 409 })
    }
  }

  const { data, error } = await service
    .from('assignments')
    .insert({ nomination_id, juror_id, assigned_by: admin.id, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
