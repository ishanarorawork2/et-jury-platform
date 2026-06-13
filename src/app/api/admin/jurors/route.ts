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

export async function GET() {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = await createServiceClient()
  const { data, error } = await service
    .from('jury_users')
    .select('id, name, email, role')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, email, password } = await req.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'name, email, and password are required' }, { status: 400 })
  }

  const service = await createServiceClient()

  const { data: authData, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: 'juror' },
  })
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  // A DB trigger (handle_new_user) already inserts the jury_users row on auth
  // user creation. Upsert here so we set the correct name/role idempotently
  // whether or not that trigger is present, instead of a plain insert that
  // would collide on the primary key.
  const { error: dbError } = await service
    .from('jury_users')
    .upsert({
      id: authData.user.id,
      name,
      email,
      role: 'juror',
    }, { onConflict: 'id' })

  if (dbError) {
    await service.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ id: authData.user.id, name, email, role: 'juror' }, { status: 201 })
}
