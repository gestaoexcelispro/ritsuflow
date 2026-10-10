// Proposal content kept on each estimate revision (commercial_estimates.proposal).
export type Proposal = {
  scope: string
  inclusions: string
  exclusions: string
  validityDays: number | null
  paymentTerms: string
  notes: string
  /** Show the item table (planilha orçamentária) in the PDF; otherwise a lump-sum proposal. */
  showItems: boolean
  /** Show the price build-up (BDI / markup lines) in the PDF. */
  showBuildUp: boolean
  /** Storage paths of PDFs appended to the proposal (RitsuScope exports, uploaded files). Null = never chosen. */
  attachments: string[] | null
}

export const EMPTY_PROPOSAL: Proposal = {
  scope: '', inclusions: '', exclusions: '', validityDays: 30, paymentTerms: '', notes: '', showItems: true, showBuildUp: false, attachments: null,
}

export function readProposal(raw: Record<string, unknown> | null | undefined): Proposal {
  const r = raw || {}
  const str = (k: string) => (typeof r[k] === 'string' ? (r[k] as string) : '')
  const bool = (k: string, d: boolean) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : d)
  const days = typeof r.validityDays === 'number' && Number.isFinite(r.validityDays) ? r.validityDays : EMPTY_PROPOSAL.validityDays
  return {
    scope: str('scope'), inclusions: str('inclusions'), exclusions: str('exclusions'), validityDays: days,
    paymentTerms: str('paymentTerms'), notes: str('notes'),
    showItems: bool('showItems', EMPTY_PROPOSAL.showItems), showBuildUp: bool('showBuildUp', EMPTY_PROPOSAL.showBuildUp),
    attachments: Array.isArray(r.attachments) ? (r.attachments as unknown[]).filter((x): x is string => typeof x === 'string') : null,
  }
}

/** One entry per non-empty line ("- " and "• " bullets are stripped). */
export function lines(text: string): string[] {
  return text.split(/\r?\n/).map(l => l.replace(/^\s*[-•*]\s*/, '').trim()).filter(Boolean)
}

/**
 * Selling unit price of an item: its direct unit cost × (price ÷ direct cost). Add-ons are spread
 * evenly over the items, which is how a planilha orçamentária shows "preço unitário com BDI".
 */
export function sellingFactor(directTotal: number, priceTotal: number): number {
  return directTotal > 0 ? priceTotal / directTotal : 1
}
