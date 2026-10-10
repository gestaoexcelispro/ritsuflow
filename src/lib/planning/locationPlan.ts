// Planning by location (PreCon Lookahead / Weekly plan) from the RitsuScope Tasks layer:
//   * how much of each work package is done in each location — the scope lines allocated where the work
//     is physically done (face / carrier rule, drawn task lines win), grouped by
//     project_scopes.organization_work_package_id;
//   * which predecessors each (location, work package) waits for — project_scope_dependencies, else the
//     default wall sequence — including the "carrier room" links of dividing walls;
//   * how much is already done — Weekly plan items tied to a location and a work package.
// The scope register and the Commercial estimate are not touched.
import type { createClient } from '@/lib/supabase/client'
import { allocateScopeStep, exteriorLocationOf, flowRankOf, loadTakeoffData, type AllocationRule, type ClaimedLine, type TakeoffData } from '../takeoff/scopeAllocation'
import { defaultPredecessors, type DepLink, type StepDep } from '../takeoff/stepPredecessors'
import type { Vec2 } from '../takeoff/geometry'

type Supabase = ReturnType<typeof createClient>

export type PlanScope = {
  id: string
  scope_code: string | null
  scope_name: string | null
  unit: string | null
  takeoff_layer_id: string | null
  takeoff_step?: string | null
  organization_work_package_id?: string | null
  allocation_rule?: AllocationRule | null
}
export type PlanLocation = { id: string; name: string; location_type: string | null; parent_id: string | null; sequence_number: number | null; environment_type?: string | null }
export type PlanDepRow = { scope_item_id: string; predecessor_scope_item_id: string; link: DepLink; lag_days: number | null }
export type PlanDrawing = { scope_item_id: string; location_id: string; source_id: string; points: Vec2[]; quantity: number | null }
export type PlanWorkPackage = { id: string; code: string; description: string | null; color?: string | null }
/** Progress already reported (Weekly plan items with a location and a work package). */
export type PlanProgress = { location_id: string | null; organization_work_package_id: string | null; unit: string | null; actual_quantity: number | null; planned_quantity?: number | null; execution_result?: string | null }

/** One (location × work package × unit) with its quantity from Tasks. */
export type LocationPackageRow = { locationId: string; wpId: string; unit: string; quantity: number; scopeIds: string[] }

export type LocationPlan = {
  /** scope line → location → quantity (only real locations; Exterior buckets without a location are dropped). */
  scopeQty: Map<string, Map<string, number>>
  /** scope line → room → the rooms that carry its walls. */
  carrierByScope: Map<string, Map<string, Set<string>>>
  rows: LocationPackageRow[]
  depsOf: (scopeId: string) => StepDep[]
  scopes: PlanScope[]
  locations: PlanLocation[]
}

const GROUP_TYPES = new Set(['building', 'floor', 'zone'])
export const isProductionLocation = (l: Pick<PlanLocation, 'location_type'>) => !GROUP_TYPES.has(String(l.location_type || ''))

/** Same unit written differently (m2 / m² / M2). */
export function normUnit(u: string | null | undefined): string {
  const s = String(u || '').trim().toLowerCase().replace(/\s+/g, '')
  if (/^(m²|m2|sqm|m\^2)$/.test(s)) return 'm²'
  if (/^(m|ml|lm|m\.l\.)$/.test(s)) return 'm'
  if (/^(un|und|unid|unidade|pc|pç|pcs|ea|each|unit|units)$/.test(s)) return 'un'
  return s
}

export function buildLocationPlan(input: { data: TakeoffData; scopes: PlanScope[]; locations: PlanLocation[]; deps: PlanDepRow[]; drawings: PlanDrawing[] }): LocationPlan {
  const { data, scopes, locations, deps, drawings } = input
  const production = new Set(locations.filter(isProductionLocation).map(l => l.id))
  const known = new Set(locations.map(l => l.id))
  const flowRank = flowRankOf(locations)
  const scopeQty = new Map<string, Map<string, number>>()
  const carrierByScope = new Map<string, Map<string, Set<string>>>()

  for (const sc of scopes) {
    if (!sc.takeoff_layer_id || !data.layers.some(l => l.id === sc.takeoff_layer_id)) continue
    const own = drawings.filter(d => d.scope_item_id === sc.id)
    // A location with drawn task lines uses their quantity; the automatic split skips them and the
    // wall stretches already drawn (same as Locations › Scope allocation).
    const drawn = new Map<string, number>()
    for (const d of own) drawn.set(d.location_id, (drawn.get(d.location_id) || 0) + Number(d.quantity || 0))
    const claimed: ClaimedLine[] = own.map(d => ({ source_id: d.source_id, points: d.points }))
    const r = allocateScopeStep(data, {
      layerIds: [sc.takeoff_layer_id], unit: sc.unit || 'm²', step: sc.takeoff_step, rule: sc.allocation_rule,
      productionLocationIds: new Set([...production].filter(id => !drawn.has(id))), claimed, flowRank,
      exteriorLocationOf: key => exteriorLocationOf(key, locations, data.levels),
    })
    const q = new Map<string, number>()
    for (const [id, v] of r.byLocation) if (known.has(id) && v > 0) q.set(id, v)
    for (const [id, v] of drawn) if (v > 0) q.set(id, v)
    scopeQty.set(sc.id, q)
    if (r.carrierOf) carrierByScope.set(sc.id, r.carrierOf)
  }

  const acc = new Map<string, LocationPackageRow>()
  for (const sc of scopes) {
    const wp = sc.organization_work_package_id
    const q = scopeQty.get(sc.id)
    if (!wp || !q) continue
    const unit = normUnit(sc.unit)
    for (const [loc, v] of q) {
      const key = `${loc}|${wp}|${unit}`
      const row = acc.get(key) || { locationId: loc, wpId: wp, unit, quantity: 0, scopeIds: [] }
      row.quantity += v
      if (!row.scopeIds.includes(sc.id)) row.scopeIds.push(sc.id)
      acc.set(key, row)
    }
  }
  const rank = (id: string) => flowRank.get(id) ?? 1e9
  const rows = [...acc.values()].sort((a, b) => rank(a.locationId) - rank(b.locationId) || a.wpId.localeCompare(b.wpId))

  const depsOf = (scopeId: string): StepDep[] => {
    const own = deps.filter(d => d.scope_item_id === scopeId)
    if (own.length) return own.map(d => ({ predecessorId: d.predecessor_scope_item_id, link: d.link, lagDays: Number(d.lag_days) || 0 }))
    const sc = scopes.find(s => s.id === scopeId)
    return sc ? defaultPredecessors(sc, scopes) : []
  }
  return { scopeQty, carrierByScope, rows, depsOf, scopes, locations }
}

/** Share done (0…1) of a work package in a location, by unit; no work there = 1. */
export function progressIndex(plan: LocationPlan, progress: PlanProgress[]): (locationId: string, wpId: string) => number {
  const done = new Map<string, number>()
  for (const p of progress) {
    if (!p.location_id || !p.organization_work_package_id) continue
    const qty = p.actual_quantity != null ? Number(p.actual_quantity) : p.execution_result === 'completed' ? Number(p.planned_quantity || 0) : 0
    if (!(qty > 0)) continue
    const key = `${p.location_id}|${p.organization_work_package_id}|${normUnit(p.unit)}`
    done.set(key, (done.get(key) || 0) + qty)
  }
  return (locationId, wpId) => {
    const rows = plan.rows.filter(r => r.locationId === locationId && r.wpId === wpId && r.quantity > 1e-6)
    if (!rows.length) return 1
    return Math.min(...rows.map(r => Math.min(1, (done.get(`${locationId}|${wpId}|${r.unit}`) || 0) / r.quantity)))
  }
}

/** Done enough to release the successors (rounding of drawn openings leaves tiny gaps). */
export const DONE_AT = 0.995

export type Wait = { locationId: string; wpId: string; done: number }
/**
 * Koskela "Predecessor" for one work package in one location: the other packages it waits for, in the
 * same location or in the rooms that carry its walls, that are not done yet. Steps of the same package
 * (e.g. Side A and Side B boards both under BRD) are the crew's own sequence and are not checked here.
 */
export function waitsFor(plan: LocationPlan, wpId: string, locationId: string, doneOf: (locationId: string, wpId: string) => number): Wait[] {
  const waits = new Map<string, Wait>()
  for (const sc of plan.scopes) {
    if (sc.organization_work_package_id !== wpId || !(plan.scopeQty.get(sc.id)?.get(locationId)! > 0)) continue
    for (const d of plan.depsOf(sc.id)) {
      const pred = plan.scopes.find(s => s.id === d.predecessorId)
      const P = pred?.organization_work_package_id
      if (!pred || !P || P === wpId) continue
      const carriers = d.link === 'carrier_location' ? plan.carrierByScope.get(sc.id)?.get(locationId) : undefined
      const where = carriers && carriers.size ? [...carriers] : [locationId]
      for (const m of where) {
        const done = doneOf(m, P)
        if (done < DONE_AT) waits.set(`${m}|${P}`, { locationId: m, wpId: P, done })
      }
    }
  }
  return [...waits.values()]
}

/** Everything the planning pages need, loaded and computed for one project (null when Tasks has no data). */
export async function loadLocationPlan(supabase: Supabase, projectId: string): Promise<LocationPlan | null> {
  const [sc, lc, dp, td] = await Promise.all([
    supabase.from('project_scopes').select('id, scope_code, scope_name, unit, takeoff_layer_id, takeoff_step, organization_work_package_id, allocation_rule').eq('project_id', projectId).eq('item_type', 'item'),
    supabase.from('locations').select('id, name, location_type, parent_id, sequence_number, environment_type').eq('project_id', projectId),
    supabase.from('project_scope_dependencies').select('scope_item_id, predecessor_scope_item_id, link, lag_days').eq('project_id', projectId),
    supabase.from('location_task_drawings').select('scope_item_id, location_id, source_id, points, quantity').eq('project_id', projectId),
  ])
  if (sc.error || lc.error) return null
  const scopes = (sc.data || []) as PlanScope[]
  if (!scopes.some(s => s.organization_work_package_id && s.takeoff_layer_id)) return null
  const data = await loadTakeoffData(supabase, projectId)
  return buildLocationPlan({
    data, scopes, locations: (lc.data || []) as PlanLocation[],
    deps: dp.error ? [] : ((dp.data || []) as PlanDepRow[]),
    drawings: td.error ? [] : ((td.data || []) as PlanDrawing[]),
  })
}

/** "Floor 1 › Room 7" from the location tree. */
export function locationPath(locations: PlanLocation[], id: string): string {
  const parts: string[] = []
  let cur = locations.find(l => l.id === id)
  let guard = 0
  while (cur && guard++ < 10) { parts.unshift(cur.name); cur = cur.parent_id ? locations.find(l => l.id === cur!.parent_id) : undefined }
  return parts.join(' › ')
}
