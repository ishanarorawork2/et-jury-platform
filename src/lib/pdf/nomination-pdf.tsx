import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { categoryLabel } from '@/lib/categories'

export type NominationPDFData = {
  id: string
  nomination_id: string
  nominee_name: string
  company: string
  company_size: string | null
  designation: string | null
  master_category: string
  category_key: string
  raw_data_json: Record<string, Record<string, string>>
  editorial_summary: {
    summary: string | null
    jury_notes: string | null
    strategic_feedback: string | null
    criteria_scores_json: Record<string, number> | null
    total_score: number | null
  } | null
}

const SECTION_ORDER = ['Basic', 'Round 1', 'Round 2']
const HIDDEN_SECTIONS = new Set(['Round 3'])
const HIDDEN_FIELD_PATTERNS = [
  'employee size', 'organisational revenue', 'organizational revenue',
  'email', 'mobile', 'phone', 'contact no', 'contact number',
]
const COMPANY_SIZE_CATEGORIES = new Set(['et_ciso', 'et_rising_star'])

function isHiddenField(key: string): boolean {
  const lower = key.toLowerCase()
  return HIDDEN_FIELD_PATTERNS.some((p) => lower.includes(p))
}

function orderedSections(rawData: Record<string, Record<string, string>>): string[] {
  const keys = Object.keys(rawData).filter((k) => !HIDDEN_SECTIONS.has(k))
  return [
    ...SECTION_ORDER.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !SECTION_ORDER.includes(k)),
  ]
}

const RED = '#C41230'
const GRAY_900 = '#111827'
const GRAY_700 = '#374151'
const GRAY_500 = '#6B7280'
const GRAY_200 = '#E5E7EB'
const GRAY_100 = '#F9FAFB'

const s = StyleSheet.create({
  page: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    paddingHorizontal: 44,
    paddingTop: 44,
    paddingBottom: 52,
    color: GRAY_900,
    backgroundColor: '#ffffff',
  },
  // Running page header (fixed — repeats on overflow pages)
  runningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: RED,
  },
  runningHeaderLeft: { fontSize: 7, color: GRAY_500, letterSpacing: 0.4 },
  runningHeaderRight: { fontSize: 7, color: GRAY_500 },
  // Nomination header (first page only — not fixed)
  nomineeName: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: GRAY_900, marginBottom: 3 },
  nomineeCompany: { fontSize: 10, color: GRAY_700, marginBottom: 7 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  categoryBadge: {
    backgroundColor: '#FEF2F2',
    color: RED,
    borderWidth: 0.75,
    borderColor: '#FECACA',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
  },
  metaText: { fontSize: 8, color: GRAY_500 },
  divider: { borderTopWidth: 0.5, borderTopColor: GRAY_200, marginVertical: 14 },
  sectionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: GRAY_500,
    letterSpacing: 1,
    marginBottom: 8,
  },
  sectionNote: { fontSize: 7.5, color: GRAY_500, marginBottom: 10 },
  // AI scores box
  scoresBox: { backgroundColor: GRAY_100, borderRadius: 4, padding: 10, marginBottom: 10 },
  scoresRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#ffffff',
  },
  scorePillKey: { fontSize: 7.5, color: GRAY_500 },
  scorePillVal: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: GRAY_900 },
  scoreTotalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#ffffff',
    marginLeft: 'auto',
  },
  scoreTotalKey: { fontSize: 8, color: GRAY_500 },
  scoreTotalVal: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: GRAY_900 },
  // Text card (summary / jury notes / strengths)
  textCard: {
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
  },
  textCardLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: GRAY_500,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  textCardBody: { fontSize: 9, color: GRAY_700, lineHeight: 1.5 },
  emptyCard: {
    borderWidth: 0.5,
    borderColor: GRAY_200,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  emptyText: { fontSize: 8.5, color: GRAY_500 },
  // Form rows
  formSection: { marginBottom: 14 },
  formSectionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: GRAY_500,
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  formCard: { borderWidth: 0.5, borderColor: GRAY_200, borderRadius: 4, overflow: 'hidden' },
  formRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: GRAY_200 },
  formRowLast: { flexDirection: 'row' },
  formQ: {
    width: '36%',
    backgroundColor: GRAY_100,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRightWidth: 0.5,
    borderRightColor: GRAY_200,
  },
  formQText: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY_700 },
  formA: { width: '64%', paddingHorizontal: 8, paddingVertical: 5 },
  formAText: { fontSize: 8.5, color: GRAY_900, lineHeight: 1.4 },
  formAEmpty: { fontSize: 8, color: GRAY_500 },
  // Fixed footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7, color: GRAY_500 },
})

function NominationPage({ nom }: { nom: NominationPDFData }) {
  const es = nom.editorial_summary
  const sections = orderedSections(nom.raw_data_json)
  const showCompanySize = COMPANY_SIZE_CATEGORIES.has(nom.category_key)

  const criteriaRows = es?.criteria_scores_json
    ? Object.entries(es.criteria_scores_json).filter(([, v]) => v != null && !isNaN(v))
    : []
  const hasEditorialContent = !!(es?.summary || es?.jury_notes || es?.strategic_feedback || criteriaRows.length > 0)

  return (
    <Page size="A4" style={s.page}>
      {/* Running header — fixed so it repeats on overflow pages */}
      <View style={s.runningHeader} fixed>
        <Text style={s.runningHeaderLeft}>ET ENTERPRISE SECURITY AWARDS 2026 — JURY EVALUATION</Text>
        <Text style={s.runningHeaderRight}>{categoryLabel(nom.category_key)}</Text>
      </View>

      {/* Nominee identity */}
      <Text style={s.nomineeName}>{nom.nominee_name}</Text>
      <Text style={s.nomineeCompany}>
        {nom.company}{nom.designation ? ` · ${nom.designation}` : ''}
      </Text>
      <View style={s.metaRow}>
        <Text style={s.categoryBadge}>{nom.master_category}</Text>
        <Text style={s.metaText}>{categoryLabel(nom.category_key)} · #{nom.nomination_id}</Text>
      </View>

      <View style={s.divider} />

      {/* ── JURY NOTES ── */}
      <Text style={s.sectionLabel}>JURY NOTES</Text>
      <Text style={s.sectionNote}>
        AI-generated editorial summary — reference only; juror evaluation is the sole basis for scoring.
      </Text>

      {criteriaRows.length > 0 && (
        <View style={s.scoresBox}>
          <View style={s.scoresRow}>
            {criteriaRows.map(([key, val]) => (
              <View key={key} style={s.scorePill}>
                <Text style={s.scorePillKey}>{key}</Text>
                <Text style={s.scorePillVal}>{String(val)}</Text>
              </View>
            ))}
            {es?.total_score != null && !isNaN(es.total_score) && (
              <View style={s.scoreTotalPill}>
                <Text style={s.scoreTotalKey}>Total</Text>
                <Text style={s.scoreTotalVal}>{String(es.total_score)}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {[
        { label: 'SUMMARY', value: es?.summary },
        { label: 'JURY NOTES', value: es?.jury_notes },
        { label: 'STRENGTHS & WEAKNESS', value: es?.strategic_feedback },
      ]
        .filter(({ value }) => value)
        .map(({ label, value }) => (
          <View key={label} style={s.textCard}>
            <Text style={s.textCardLabel}>{label}</Text>
            <Text style={s.textCardBody}>{value ?? ''}</Text>
          </View>
        ))}

      {!hasEditorialContent && (
        <View style={s.emptyCard}>
          <Text style={s.emptyText}>No editorial summary available for this nomination.</Text>
        </View>
      )}

      <View style={s.divider} />

      {/* ── NOMINATION FORM ── */}
      <Text style={s.sectionLabel}>NOMINATION FORM</Text>

      {sections.map((section) => {
        const raw = Object.entries(nom.raw_data_json[section] ?? {}).filter(([q]) => !isHiddenField(q))
        let entries: [string, string][] =
          section === 'Basic' && nom.company
            ? [['Organisation Name', nom.company], ...raw.filter(([q]) => q !== 'Organisation Name')]
            : raw
        if (section === 'Basic' && showCompanySize && nom.company_size && nom.company_size !== 'Not Defined') {
          entries = [...entries, ['Company Size', nom.company_size]]
        }
        if (!entries.length) return null
        return (
          <View key={section} style={s.formSection}>
            <Text style={s.formSectionLabel}>{section.toUpperCase()}</Text>
            <View style={s.formCard}>
              {entries.map(([q, a], idx) => {
                const isLast = idx === entries.length - 1
                return (
                  <View key={q} style={isLast ? s.formRowLast : s.formRow}>
                    <View style={s.formQ}>
                      <Text style={s.formQText}>{q}</Text>
                    </View>
                    <View style={s.formA}>
                      {a ? (
                        <Text style={s.formAText}>{a}</Text>
                      ) : (
                        <Text style={s.formAEmpty}>—</Text>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          </View>
        )
      })}

      {/* Fixed footer */}
      <View style={s.footer} fixed>
        <Text style={s.footerText}>Confidential — ET Enterprise Security Awards 2026</Text>
        <Text
          style={s.footerText}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </Page>
  )
}

export function NominationPDFDocument({ nominations }: { nominations: NominationPDFData[] }) {
  return (
    <Document
      title="ET Security Awards 2026 — Jury Nominations"
      author="ET Enterprise Security Awards"
      subject="Jury Evaluation Package"
    >
      {nominations.map((nom) => (
        <NominationPage key={nom.id} nom={nom} />
      ))}
    </Document>
  )
}
