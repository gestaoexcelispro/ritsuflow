// Ceiling and floor estimates are computed in metric; types for imperial countries (US) set
// `imperial: true` and get their lines in ft, sf, lb and yd³. Counts and packaging units stay as they are.
export type MatLine = { mat: string; unit: string; qty: number }

const TO_IMPERIAL: Record<string, { unit: string; k: number }> = {
  m: { unit: 'ft', k: 3.28084 },
  'm²': { unit: 'sf', k: 10.7639 },
  kg: { unit: 'lb', k: 2.20462 },
  'm³': { unit: 'yd³', k: 1.30795 },
  un: { unit: 'ea', k: 1 },
}

export function toImperial(lines: MatLine[]): MatLine[] {
  return lines.map(l => {
    const c = TO_IMPERIAL[l.unit]
    return c ? { ...l, unit: c.unit, qty: l.qty * c.k } : l
  })
}
