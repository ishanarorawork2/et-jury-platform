import { NextResponse } from 'next/server'
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

  const [{ data: jurors }, { data: assignments }, { data: nominations }] = await Promise.all([
    service.from('jury_users').select('id, name').eq('role', 'juror').order('name'),
    service.from('assignments').select('id, juror_id, nomination_id, status'),
    service.from('nominations').select('id, master_category'),
  ])

  // Per-juror stats
  const jurorStats = (jurors ?? []).map(j => {
    const ja = (assignments ?? []).filter(a => a.juror_id === j.id)
    const scored = ja.filter(a => a.status === 'scored').length
    return { id: j.id, name: j.name, assigned: ja.length, scored, pending: ja.length - scored }
  })

  // Per-category stats
  const categories = [...new Set((nominations ?? []).map(n => n.master_category))].sort()
  const categoryStats = categories.map(cat => {
    const catNomIds = new Set(
      (nominations ?? []).filter(n => n.master_category === cat).map(n => n.id)
    )
    const catAssignments = (assignments ?? []).filter(a => catNomIds.has(a.nomination_id))

    const byNom = new Map<string, typeof catAssignments>()
    for (const a of catAssignments) {
      if (!byNom.has(a.nomination_id)) byNom.set(a.nomination_id, [])
      byNom.get(a.nomination_id)!.push(a)
    }

    let fullyAssigned = 0
    let complete = 0
    for (const aList of byNom.values()) {
      if (aList.length >= 2) {
        fullyAssigned++
        if (aList.every(a => a.status === 'scored')) complete++
      }
    }

    return {
      category: cat,
      total: catNomIds.size,
      fullyAssigned,
      complete,
      pending: fullyAssigned - complete,
      unassigned: catNomIds.size - fullyAssigned,
    }
  })

  return NextResponse.json({ jurorStats, categoryStats })
}
