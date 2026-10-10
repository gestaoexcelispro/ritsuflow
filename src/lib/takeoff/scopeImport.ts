// Projects › Scope ← RitsuScope import.
// Each RitsuScope item (takeoff layer) becomes one scope in the register:
//   * a wall built from a library wall type gets one item per labor step, in installation order:
//     framing → board side A → joints side A → insulation (if the type has it) → board side B → joints side B
//     (a side with no boards, e.g. a shaft or furring wall, gets no board/joint items);
//     every step is measured as the net wall area of one face (openings deducted), in m²;
//   * any other item (no wall type, areas, counts) gets a single item with its own measure.
// Quantities come from the same engine as the Location Breakdown (allocateFromTakeoff), so the
// register, the locations and RitsuScope all show the same totals.
// Imported lines remember (takeoff_layer_id, takeoff_step): importing again updates their quantity
// and keeps everything else the user changed (description, unit price, status, notes).
import type { createClient } from '@/lib/supabase/client'
import { allocateFromTakeoff, loadTakeoffData, type TakeoffData } from './scopeAllocation'
import { WALL_TYPE_COLUMNS, type WallTypeRow } from './wallTypes'

type Supabase = ReturnType<typeof createClient>

export type StepKey = 'framing' | 'board_a' | 'joints_a' | 'insulation' | 'board_b' | 'joints_b' | 'measure'

/** Line names, already translated by the caller ({stud}, {count}, {product} are filled in here). */
export type StepLabels = Record<Exclude<StepKey, 'measure'>, string>

export type ScopeRowLite = {
  id: string
  item_type: string
  parent_scope_id: string | null
  scope_code: string | null
  scope_name: string
  quantity: number | null
  unit: string | null
  takeoff_layer_id?: string | null
  takeoff_step?: string | null
}

export type PlannedItem = {
  step: StepKey
  name: string
  unit: string
  quantity: number
  /** create = new line; update = linked line whose quantity changed; same = nothing to do. */
  action: 'create' | 'update' | 'same'
  existingId?: string
  previousQuantity?: number | null
}

export type PlannedScope = {
  layerId: string
  name: string
  action: 'create' | 'existing'
  existingId?: string
  existingCode?: string | null
  items: PlannedItem[]
}

export type ImportPlan = {
  scopes: PlannedScope[]
  /** RitsuScope items with nothing measurable yet (no shapes, or only on sheets without a scale). */
  empty: string[]
  /** Sheets left out because they have no scale yet. */
  uncalibratedSheets: string[]
  /** Linked lines whose step no longer exists in RitsuScope (kept; the user decides). */
  stale: ScopeRowLite[]
  /** Lines imported from RitsuScope whose item was deleted (redrawn takeoff): they no longer follow the drawing. */
  orphans: ScopeRowLite[]
  counts: { create: number; update: number; same: number }
}

const round2 = (v: number) => Math.round(v * 100) / 100
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m))

type StepSpec = { step: StepKey; name: string; unit: string; measureUnit: string }

/** The labor steps of a wall type, in installation order. */
export function wallSteps(wt: Pick<WallTypeRow, 'framing' | 'boards' | 'materials'>, labels: StepLabels): StepSpec[] {
  const boards = Array.isArray(wt.boards) ? wt.boards : []
  const side = (s: 'A' | 'B') => boards.filter((b) => b && b.side === s && Number(b.count) > 0)
  const boardName = (key: 'board_a' | 'board_b', list: WallTypeRow['boards']) => {
    const count = list.reduce((n, b) => n + Number(b.count || 0), 0)
    const products = [...new Set(list.map((b) => b.product).filter(Boolean))].join(' + ')
    return fill(labels[key], { count, product: products || '—' })
  }
  const stud = String((wt.framing as Record<string, unknown> | null)?.studName || '').trim()
  const steps: StepSpec[] = [{ step: 'framing', name: fill(labels.framing, { stud: stud || '—' }), unit: 'm²', measureUnit: 'm²' }]
  const a = side('A'), b = side('B')
  if (a.length) steps.push({ step: 'board_a', name: boardName('board_a', a), unit: 'm²', measureUnit: 'm²' }, { step: 'joints_a', name: labels.joints_a, unit: 'm²', measureUnit: 'm²' })
  if (wt.materials?.insulation) steps.push({ step: 'insulation', name: labels.insulation, unit: 'm²', measureUnit: 'm²' })
  if (b.length) steps.push({ step: 'board_b', name: boardName('board_b', b), unit: 'm²', measureUnit: 'm²' }, { step: 'joints_b', name: labels.joints_b, unit: 'm²', measureUnit: 'm²' })
  return steps
}

/** The single line of an item without a wall type. */
function measureStep(kind: string, height: number | null, name: string): StepSpec {
  if (kind === 'linear') return height && height > 0 ? { step: 'measure', name, unit: 'm²', measureUnit: 'm²' } : { step: 'measure', name, unit: 'm', measureUnit: 'm' }
  if (kind === 'area') return { step: 'measure', name, unit: 'm²', measureUnit: 'm²' }
  return { step: 'measure', name, unit: 'unit', measureUnit: 'un' }
}

/** Works out what an import would create or update, without writing anything. */
export function planImport(data: TakeoffData, wallTypes: Map<string, Pick<WallTypeRow, 'framing' | 'boards' | 'materials'>>, existing: ScopeRowLite[], labels: StepLabels): ImportPlan {
  const linked = new Map<string, ScopeRowLite>()
  for (const r of existing) if (r.takeoff_layer_id && r.takeoff_step) linked.set(`${r.takeoff_layer_id}|${r.takeoff_step}`, r)
  const used = new Set<string>()
  const uncalibrated = new Set<string>()
  const empty: string[] = []
  const scopes: PlannedScope[] = []
  const counts = { create: 0, update: 0, same: 0 }

  for (const layer of data.layers) {
    const wt = layer.wall_type_id ? wallTypes.get(layer.wall_type_id) : undefined
    const steps = layer.kind === 'linear' && wt ? wallSteps(wt, labels) : [measureStep(layer.kind, layer.height_m, layer.name)]
    const totals = new Map<string, number>()
    for (const u of new Set(steps.map((s) => s.measureUnit))) {
      const r = allocateFromTakeoff(data, { layerIds: [layer.id], unit: u, productionLocationIds: new Set() })
      r.uncalibratedSheets.forEach((s) => uncalibrated.add(s))
      totals.set(u, round2(r.total))
    }
    if (![...totals.values()].some((v) => v > 0)) { empty.push(layer.name); continue }

    const scopeRow = linked.get(`${layer.id}|scope`)
    if (scopeRow) used.add(scopeRow.id)
    const items: PlannedItem[] = steps.map((s) => {
      const quantity = totals.get(s.measureUnit) || 0
      const row = linked.get(`${layer.id}|${s.step}`)
      if (!row) { counts.create++; return { step: s.step, name: s.name, unit: s.unit, quantity, action: 'create' } }
      used.add(row.id)
      const changed = Math.abs(Number(row.quantity ?? 0) - quantity) > 0.005
      counts[changed ? 'update' : 'same']++
      return { step: s.step, name: row.scope_name, unit: row.unit || s.unit, quantity, action: changed ? 'update' : 'same', existingId: row.id, previousQuantity: row.quantity }
    })
    if (!scopeRow) counts.create++
    scopes.push({ layerId: layer.id, name: scopeRow?.scope_name || layer.name, action: scopeRow ? 'existing' : 'create', existingId: scopeRow?.id, existingCode: scopeRow?.scope_code, items })
  }

  const stale = existing.filter((r) => r.takeoff_layer_id && r.takeoff_step && !used.has(r.id) && data.layers.some((l) => l.id === r.takeoff_layer_id))
  const orphans = existing.filter((r) => !r.takeoff_layer_id && !!r.takeoff_step)
  return { scopes, empty, uncalibratedSheets: [...uncalibrated], stale, orphans, counts }
}

/** Loads the takeoff and the wall types it uses. */
export async function loadImportSource(supabase: Supabase, projectId: string): Promise<{ data: TakeoffData; wallTypes: Map<string, WallTypeRow> }> {
  const data = await loadTakeoffData(supabase, projectId)
  const ids = [...new Set(data.layers.map((l) => l.wall_type_id).filter(Boolean))] as string[]
  if (!ids.length) return { data, wallTypes: new Map() }
  const { data: rows, error } = await supabase.from('takeoff_wall_types').select(WALL_TYPE_COLUMNS).in('id', ids)
  if (error) throw error
  return { data, wallTypes: new Map(((rows || []) as unknown as WallTypeRow[]).map((w) => [w.id, w])) }
}

/** Writes a plan: new scopes first (so items have a parent), then new items, then quantity updates. */
export async function applyImport(supabase: Supabase, input: { projectId: string; userId: string; plan: ImportPlan; existing: ScopeRowLite[] }): Promise<{ created: number; updated: number }> {
  const { projectId, userId, plan, existing } = input
  let topCount = existing.filter((r) => !r.parent_scope_id).length
  const kidsOf = (id: string) => existing.filter((r) => r.parent_scope_id === id).length
  let created = 0, updated = 0

  for (const s of plan.scopes) {
    let parentId = s.existingId
    let parentCode = s.existingCode || ''
    if (s.action === 'create') {
      topCount += 1
      const { data, error } = await supabase.from('project_scopes').insert({
        project_id: projectId, item_type: 'scope', parent_scope_id: null, scope_code: String(topCount), scope_name: s.name,
        description: '', exclusions: '', unit: 'm²', quantity: null, unit_price: 0, quantity_source: 'ritsuscope', status: 'defined', notes: '',
        takeoff_layer_id: s.layerId, takeoff_step: 'scope', created_by: userId,
      }).select('id, scope_code').single()
      if (error) throw error
      parentId = data.id; parentCode = data.scope_code || String(topCount); created++
    }
    let n = parentId && s.action === 'existing' ? kidsOf(parentId) : 0
    const fresh = s.items.filter((i) => i.action === 'create').map((i) => ({
      project_id: projectId, item_type: 'item', parent_scope_id: parentId, scope_code: `${parentCode}.${++n}`, scope_name: i.name,
      description: '', exclusions: '', unit: i.unit, quantity: i.quantity, unit_price: 0, quantity_source: 'ritsuscope', status: 'defined', notes: '',
      takeoff_layer_id: s.layerId, takeoff_step: i.step, created_by: userId,
    }))
    if (fresh.length) {
      const { error } = await supabase.from('project_scopes').insert(fresh)
      if (error) throw error
      created += fresh.length
    }
    for (const i of s.items.filter((x) => x.action === 'update' && x.existingId)) {
      const { error } = await supabase.from('project_scopes').update({ quantity: i.quantity, quantity_source: 'ritsuscope' }).eq('id', i.existingId!)
      if (error) throw error
      updated++
    }
  }
  return { created, updated }
}
