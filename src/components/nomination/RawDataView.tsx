const SECTION_ORDER = ['Basic', 'Round 1', 'Round 2']
const HIDDEN_SECTIONS = new Set(['Round 3'])

// Field keys containing any of these strings (case-insensitive) are hidden from jurors.
const HIDDEN_FIELD_PATTERNS = ['employee size', 'organisational revenue', 'organizational revenue']

function isHiddenField(key: string) {
  const lower = key.toLowerCase()
  return HIDDEN_FIELD_PATTERNS.some(p => lower.includes(p))
}

function orderedSections(rawData: Record<string, Record<string, string>>) {
  const keys = Object.keys(rawData).filter(k => !HIDDEN_SECTIONS.has(k))
  return [
    ...SECTION_ORDER.filter(k => keys.includes(k)),
    ...keys.filter(k => !SECTION_ORDER.includes(k)),
  ]
}

type Props = {
  rawData: Record<string, Record<string, string>>
  company?: string
}

export default function RawDataView({ rawData, company }: Props) {
  const sections = orderedSections(rawData)

  return (
    <div className="space-y-8">
      {sections.map(section => {
        const raw = Object.entries(rawData[section] ?? {}).filter(([q]) => !isHiddenField(q))
        // Prepend Organisation Name to the Basic section if provided.
        const entries: [string, string][] =
          section === 'Basic' && company
            ? [['Organisation Name', company], ...raw.filter(([q]) => q !== 'Organisation Name')]
            : raw
        if (!entries.length) return null
        return (
          <div key={section}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section}</h3>
            <dl className="card-surface divide-y divide-border">
              {entries.map(([q, a]) => (
                <div key={q} className="px-4 py-3 sm:grid sm:grid-cols-5 sm:gap-4">
                  <dt className="col-span-2 text-sm font-medium text-muted-foreground">{q}</dt>
                  <dd className="col-span-3 mt-1 whitespace-pre-wrap break-words text-sm text-foreground sm:mt-0">
                    {a || <em className="text-muted-foreground">—</em>}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
    </div>
  )
}
