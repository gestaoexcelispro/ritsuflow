// Proposal clause library (commercial_clauses): standard and company inclusions, exclusions and conditions.
export const CLAUSE_KINDS = ['inclusion', 'exclusion', 'condition'] as const
export type ClauseKind = (typeof CLAUSE_KINDS)[number]

export type ClauseRow = {
  id: string
  organization_id: string | null
  country_code: string | null
  kind: ClauseKind
  body: string
  sort_order: number
  is_active: boolean
}

export const CLAUSE_COLUMNS = 'id, organization_id, country_code, kind, body, sort_order, is_active'

/** Adds a clause as a new line of a proposal text box, unless that line is already there. */
export function appendClause(text: string, body: string): string {
  const clean = body.trim()
  if (!clean) return text
  const has = text.split(/\r?\n/).some(l => l.replace(/^\s*[-•*]\s*/, '').trim() === clean)
  if (has) return text
  return text.trim() ? `${text.replace(/\s+$/, '')}\n${clean}` : clean
}
