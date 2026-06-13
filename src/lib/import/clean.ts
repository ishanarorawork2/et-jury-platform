// HTML entities → characters
const HTML_ENTITIES: [RegExp, string][] = [
  [/&nbsp;/g, ' '],
  [/&ndash;/g, '–'],
  [/&mdash;/g, '—'],
  [/&rsquo;/g, '’'],
  [/&lsquo;/g, '‘'],
  [/&rdquo;/g, '”'],
  [/&ldquo;/g, '“'],
  [/&amp;/g, '&'],
  [/&lt;/g, '<'],
  [/&gt;/g, '>'],
  [/&quot;/g, '"'],
  [/&#39;/g, "'"],
  [/&#160;/g, ' '],
]

// Mojibake: UTF-8 bytes decoded as Latin-1
const MOJIBAKE: [RegExp, string][] = [
  [/â‚¹/g, '₹'],
  [/â€™/g, '’'],
  [/â€˜/g, '‘'],
  [/â€œ/g, '“'],
  [/â€/g, '”'],
  [/â€"/g, '–'],
  [/â€"/g, '—'],
  [/â€¦/g, '…'],
  [/Â·/g, '·'],
  [/Â/g, ''],
]

export function cleanCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  let s = String(value).trim()

  // SheetJS sometimes returns "########" for date cells it can't render
  if (s === '########') return ''

  // Float IDs: 148849.0 → "148849"
  if (/^\d+\.0$/.test(s)) s = s.slice(0, -2)

  for (const [re, replacement] of MOJIBAKE) {
    s = s.replace(re, replacement)
  }
  for (const [re, replacement] of HTML_ENTITIES) {
    s = s.replace(re, replacement)
  }

  // Collapse whitespace
  return s.replace(/\s+/g, ' ').trim()
}

// Float Nomination Id → clean integer string
export function cleanId(value: unknown): string {
  if (value === null || value === undefined) return ''
  const n = Number(value)
  if (!isNaN(n) && isFinite(n)) return String(Math.round(n))
  return cleanCell(value)
}
