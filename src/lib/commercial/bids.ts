// Commercial bids: a bid is a projects row with stage = 'bid' plus its commercial_bids record.
import type { createClient } from '@/lib/supabase/client'
import type { PricingLine } from './pricing'

type Supabase = ReturnType<typeof createClient>

export const BID_STATUSES = ['draft', 'submitted', 'won', 'lost', 'no_bid'] as const
export type BidStatus = (typeof BID_STATUSES)[number]
export const OPEN_STATUSES: BidStatus[] = ['draft', 'submitted']

/** Why a bid was lost or declined (commercial_bids.outcome_reason). */
export const OUTCOME_REASONS = ['price', 'scope', 'deadline', 'relationship', 'competitor', 'technical', 'capacity', 'cancelled', 'other'] as const
export type OutcomeReason = (typeof OUTCOME_REASONS)[number]

/** Kind of work, for win rate by type (commercial_bids.project_type). */
export const PROJECT_TYPES = ['residential', 'commercial', 'industrial', 'institutional', 'infrastructure', 'renovation', 'other'] as const
export type ProjectType = (typeof PROJECT_TYPES)[number]

export type BidProject = {
  id: string
  name: string
  client_name: string | null
  country_code: string | null
  currency_code: string | null
  stage: 'bid' | 'contract'
  organization_id: string
}

export type BidRow = {
  project_id: string
  bid_number: string
  status: BidStatus
  due_at: string | null
  submitted_at: string | null
  decided_at: string | null
  outcome_note: string | null
  outcome_reason: OutcomeReason | null
  pricing_template_id: string | null
  project_type: ProjectType | null
  created_at: string
  projects: BidProject | null
}

export const BID_COLUMNS = 'project_id, bid_number, status, due_at, submitted_at, decided_at, outcome_note, outcome_reason, pricing_template_id, project_type, created_at, projects(id, name, client_name, country_code, currency_code, stage, organization_id)'

export type EstimateSummary = { id: string; project_id: string; revision: number; name: string; status: 'draft' | 'issued'; price_total: number; direct_total: number; currency_code: string; is_baseline: boolean }

export const ESTIMATE_SUMMARY_COLUMNS = 'id, project_id, revision, name, status, price_total, direct_total, currency_code, is_baseline'

/** The latest revision of each bid. */
export function latestByProject(rows: EstimateSummary[]): Map<string, EstimateSummary> {
  const map = new Map<string, EstimateSummary>()
  for (const r of rows) {
    const cur = map.get(r.project_id)
    if (!cur || r.revision > cur.revision) map.set(r.project_id, r)
  }
  return map
}

export type NewBid = {
  organizationId: string
  userId: string
  name: string
  client: string
  country: string
  currency: string
  dueDate: string
  projectType: ProjectType | null
  templateId: string | null
  templateLines: PricingLine[]
}

/**
 * Creates the projects row (stage 'bid'), its bid record and revision 0 of the estimate with a copy
 * of the template's lines. If a later step fails, the project is removed so nothing is left half made.
 */
export async function createBid(supabase: Supabase, b: NewBid): Promise<{ projectId: string } | { error: string }> {
  const project = await supabase.from('projects').insert({
    organization_id: b.organizationId, created_by: b.userId, name: b.name.trim(), client_name: b.client.trim() || null,
    country_code: b.country, currency_code: b.currency, stage: 'bid', status: 'planning',
  }).select('id').single()
  if (project.error) return { error: project.error.message }
  const projectId = project.data.id as string

  const bid = await supabase.from('commercial_bids').insert({
    project_id: projectId,
    due_at: b.dueDate ? new Date(`${b.dueDate}T18:00:00`).toISOString() : null,
    pricing_template_id: b.templateId,
    project_type: b.projectType,
  })
  const estimate = bid.error ? null : await supabase.from('commercial_estimates').insert({
    project_id: projectId, revision: 0, name: 'Rev 0', currency_code: b.currency, pricing_lines: b.templateLines,
  })
  const failure = bid.error || estimate?.error
  if (failure) {
    await supabase.from('projects').delete().eq('id', projectId)
    return { error: failure.message }
  }
  return { projectId }
}

/** Status change with its dates: submitted sets submitted_at; won / lost / no bid set decided_at. */
export function statusPatch(status: BidStatus, note?: string | null, reason?: OutcomeReason | null) {
  const now = new Date().toISOString()
  if (status === 'submitted') return { status, submitted_at: now, decided_at: null, outcome_reason: null }
  if (status === 'draft') return { status, submitted_at: null, decided_at: null, outcome_note: null, outcome_reason: null }
  return { status, decided_at: now, outcome_note: note ?? null, outcome_reason: status === 'won' ? null : reason ?? null }
}
