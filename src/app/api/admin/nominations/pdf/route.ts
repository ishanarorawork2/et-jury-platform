import { NextResponse } from 'next/server'
import { renderToBuffer, type DocumentProps } from '@react-pdf/renderer'
import React from 'react'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { NominationPDFDocument, type NominationPDFData } from '@/lib/pdf/nomination-pdf'
import { categoryLabel } from '@/lib/categories'

const SELECT = 'id, nomination_id, nominee_name, company, company_size, designation, master_category, category_key, raw_data_json'

type NomRow = {
  id: string
  nomination_id: string
  nominee_name: string
  company: string
  company_size: string | null
  designation: string | null
  master_category: string
  category_key: string
  raw_data_json: Record<string, Record<string, string>>
}

// GET /api/admin/nominations/pdf?category=<key>   — all nominations in a sub-category
// GET /api/admin/nominations/pdf?master=<name>    — all nominations in a master category
export async function GET(req: Request) {
  const url = new URL(req.url)
  const categoryKey = url.searchParams.get('category')
  const masterCategory = url.searchParams.get('master')

  if (!categoryKey && !masterCategory) {
    return NextResponse.json({ error: 'Provide ?category=<key> or ?master=<name>' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: jurorUser } = await supabase.from('jury_users').select('role').eq('id', user.id).single()
  if (jurorUser?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  let query = service.from('nominations').select(SELECT).order('nominee_name').limit(2000)
  if (categoryKey) {
    query = query.eq('category_key', categoryKey)
  } else {
    query = query.eq('master_category', masterCategory!)
  }

  const { data: nominations, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!nominations?.length) {
    return NextResponse.json({ error: 'No nominations found for this filter' }, { status: 404 })
  }

  const nomIds = (nominations as NomRow[]).map((n) => n.id)

  const { data: summaryRows } = await service
    .from('editorial_summary')
    .select('nomination_id, summary, jury_notes, strategic_feedback, criteria_scores_json, total_score')
    .in('nomination_id', nomIds)

  const summaryMap = new Map(
    (summaryRows ?? []).map((s) => [s.nomination_id as string, s])
  )

  const pdfData: NominationPDFData[] = (nominations as NomRow[]).map((n) => ({
    ...n,
    editorial_summary: summaryMap.get(n.id) ?? null,
  }))

  const buffer = await renderToBuffer(
    React.createElement(NominationPDFDocument, { nominations: pdfData }) as React.ReactElement<DocumentProps>
  )

  const label = categoryKey ? categoryLabel(categoryKey) : (masterCategory ?? 'nominations')
  const safeLabel = label.replace(/[^a-zA-Z0-9]+/g, '-')
  const filename = `ET-Awards-2026-${safeLabel}-${pdfData.length}-nominations.pdf`

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
