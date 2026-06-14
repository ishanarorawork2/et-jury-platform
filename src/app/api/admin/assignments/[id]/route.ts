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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const service = createServiceClient()
  const { error } = await service.from('assignments').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Reassign an existing assignment to a different juror (manual override).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { juror_id } = await req.json()
  if (!juror_id) {
    return NextResponse.json({ error: 'juror_id is required' }, { status: 400 })
  }

  const service = createServiceClient()

  const { data: current, error: fetchError } = await service
    .from('assignments')
    .select('id, nomination_id, juror_id')
    .eq('id', id)
    .single()

  if (fetchError || !current) {
    return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  }
  if (current.juror_id === juror_id) {
    return NextResponse.json(current) // no-op
  }
  // Scored state derives from the score's existence — a juror who has submitted a
  // score is locked (reassigning would orphan that score).
  const { data: existingScore } = await service
    .from('scores')
    .select('id')
    .eq('nomination_id', current.nomination_id)
    .eq('juror_id', current.juror_id)
    .limit(1)
    .maybeSingle()

  if (existingScore) {
    return NextResponse.json(
      { error: 'This juror has already scored — remove the assignment instead of reassigning' },
      { status: 409 }
    )
  }

  // The target juror must not already be assigned to this nomination.
  const { data: dup } = await service
    .from('assignments')
    .select('id')
    .eq('nomination_id', current.nomination_id)
    .eq('juror_id', juror_id)
    .maybeSingle()

  if (dup) {
    return NextResponse.json({ error: 'Juror is already assigned to this nomination' }, { status: 409 })
  }

  // Conflict check against the nomination's company.
  const { data: nomination } = await service
    .from('nominations')
    .select('company')
    .eq('id', current.nomination_id)
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
    .update({ juror_id, assigned_by: admin.id, status: 'pending' })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
