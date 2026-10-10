// Scope Allocation from RitsuScope: a scope activity (e.g. "Metal Stud Framing 70 mm", m²) is fed by
// one or more RitsuScope items (takeoff_layers.scope_activity_id); their quantities are split over the
// production locations drawn in RitsuScope (zones linked to locations).
//   * a wall is followed along its length; each stretch goes to the rooms it runs inside or along,
//     and a stretch shared by two rooms (a dividing wall) is split 50/50 — so the location totals
//     add up to the RitsuScope total, with no double counting;
//   * an area goes to the location its centre falls in; a count to the location it sits in;
//   * whatever is outside every production location is reported as "not allocated";
//   * wall stretches already drawn for a location in the task view ("claimed") are left out of the
//     automatic split, so a drawn location never gets them twice (reported as `claimed`).
import type { createClient } from '@/lib/supabase/client'
import { layerQuantities, polyLen, type TakeoffItem, type Vec2 } from './geometry'
import { fillLevelHeights, masterOf, wallHeightOf, type LevelRow } from './levels'
import { rowsToItems, type ElementRow, type LayerRow, type SourceRow } from './rows'
import { centroid, distToBoundary, pointInPolygon, type ZoneRow } from './zones'

type Supabase = ReturnType<typeof createClient>

export type Measure = 'wallArea' | 'area' | 'length' | 'count'

export type TakeoffData = {
  layers: (LayerRow & { scope_activity_id?: string | null })[]
  elements: ElementRow[]
  sources: SourceRow[]
  levels: LevelRow[]
  zones: ZoneRow[]
  /** Wall types in use (boards per side), for the face rule; optional. */
  wallTypes?: WallTypeBoards[]
  /** Carriers of dividing walls picked by the planner (project_wall_carriers); optional. */
  carriers?: { element_id: string; location_id: string }[]
}

const LAYER_COLUMNS = 'id, project_id, kind, name, system, color, thickness_m, height_m, elevation_m, deduct_openings, framing, is_visible, sort_order, recipe_id, wall_type_id, scope_activity_id'
const ELEMENT_COLUMNS = 'id, project_id, layer_id, source_id, points, height_override_m, z_rel_m, ifc_guid, root_guid, layer_guids, openings, faces'

/** Everything needed to measure a project's RitsuScope takeoff by location (PDF sheets only). */
export async function loadTakeoffData(supabase: Supabase, projectId: string): Promise<TakeoffData> {
  const [l, e, s, v, z] = await Promise.all([
    supabase.from('takeoff_layers').select(LAYER_COLUMNS).eq('project_id', projectId).order('sort_order'),
    supabase.from('takeoff_elements').select(ELEMENT_COLUMNS).eq('project_id', projectId),
    supabase.from('takeoff_sources').select('*').eq('project_id', projectId).eq('kind', 'pdf_page'),
    supabase.from('takeoff_levels').select('id, project_id, name, elevation_m, height_m, slab_m, typical_of, sort_order, location_id').eq('project_id', projectId),
    supabase.from('takeoff_zones').select('id, project_id, source_id, name, color, points, ceiling_height_m, location_id, is_visible, sort_order, zone_kind').eq('project_id', projectId).not('location_id', 'is', null),
  ])
  const err = l.error || e.error || s.error || v.error || z.error
  if (err) throw err
  // Optional: wall type boards (face rule) and the planner's carriers (table from 20261010_001).
  const wtIds = [...new Set((l.data || []).map((x: { wall_type_id?: string | null }) => x.wall_type_id).filter(Boolean))] as string[]
  const [wt, cr] = await Promise.all([
    wtIds.length ? supabase.from('takeoff_wall_types').select('id, boards').in('id', wtIds) : Promise.resolve({ data: [], error: null }),
    supabase.from('project_wall_carriers').select('element_id, location_id').eq('project_id', projectId),
  ])
  return {
    wallTypes: wt.error ? [] : ((wt.data || []) as WallTypeBoards[]),
    carriers: cr.error ? [] : ((cr.data || []) as { element_id: string; location_id: string }[]),
    layers: (l.data || []) as TakeoffData['layers'],
    elements: (e.data || []) as ElementRow[],
    sources: (s.data || []) as SourceRow[],
    levels: (v.data || []) as LevelRow[],
    zones: (z.data || []) as ZoneRow[],
  }
}

/** What to measure, from the activity's unit (m² → wall area or area, m → length, un → count). */
export function measureFor(unit: string | null | undefined, kind: LayerRow['kind']): Measure {
  const u = String(unit || '').trim().toLowerCase().replace(/\s+/g, '')
  if (/^(m²|m2|sqm|m\^2)$/.test(u)) return kind === 'linear' ? 'wallArea' : 'area'
  if (/^(m|ml|lm|m\.l\.)$/.test(u)) return 'length'
  if (/^(un|und|unid|unidade|pc|pç|pcs|ea|each|unit|units)$/.test(u)) return 'count'
  return kind === 'linear' ? 'wallArea' : kind === 'area' ? 'area' : 'count'
}

export type AllocationResult = {
  /** Quantity per production location. */
  byLocation: Map<string, number>
  /** Everything the chosen items measure (all sheets with a scale). */
  total: number
  /** The part outside every production location. */
  unallocated: number
  /** Sheets left out because they have no scale yet. */
  uncalibratedSheets: string[]
  /** The part of walls that runs along task lines already drawn (see `claimed` input). */
  claimed: number
  /**
   * Wall steps only: for each room (or Exterior) on the non-carrier side of a wall, the rooms that carry
   * those walls (where the framing and Side A are done). Feeds the "carrier room" predecessors.
   */
  carrierOf?: Map<string, Set<string>>
}

/** A task line already drawn for this scope item (any location): its sheet and polyline. */
export type ClaimedLine = { source_id: string; points: Vec2[] }

/** How close (m) a wall must run to a drawn task line to count as claimed by it. */
const CLAIM_M = 0.25

/** Distance from p to segment a→b, measured only alongside it (Infinity past either end). */
function sideDist(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const L2 = dx * dx + dy * dy
  if (!L2) return Infinity
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2
  if (t < 0 || t > 1) return Infinity
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

const EDGE_M = 0.2

export function allocateFromTakeoff(data: TakeoffData, input: { layerIds: string[]; unit: string; productionLocationIds: Set<string>; claimed?: ClaimedLine[] }): AllocationResult {
  const byLocation = new Map<string, number>()
  const add = (id: string, v: number) => byLocation.set(id, (byLocation.get(id) || 0) + v)
  let total = 0
  let unallocated = 0
  let claimedTotal = 0
  const uncalibratedSheets: string[] = []
  const layers = data.layers.filter(l => input.layerIds.includes(l.id))
  const levelById = new Map(data.levels.map(l => [l.id, l] as [string, LevelRow]))

  for (const sheet of data.sources) {
    const hasElements = data.elements.some(e => e.source_id === sheet.id && input.layerIds.includes(e.layer_id))
    if (!hasElements) continue
    const k = Number(sheet.scale_pt_per_m) || 0
    if (!(k > 0)) { uncalibratedSheets.push(sheet.name); continue }
    const level = sheet.level_id ? levelById.get(sheet.level_id) : undefined
    const h = level ? wallHeightOf(masterOf(level, levelById)) : null
    const raw = rowsToItems(layers, data.elements, new Map([[sheet.id, 1]]))
    const items: TakeoffItem[] = h ? fillLevelHeights(raw, () => h) : raw
    const zones = data.zones.filter(z => z.source_id === sheet.id && z.location_id && input.productionLocationIds.has(z.location_id) && z.points.length >= 3)
    const edge = EDGE_M * k
    const zonesNear = (p: Vec2) => zones.filter(z => pointInPolygon(p, z.points) || distToBoundary(p, z.points) <= edge)
    const zonesIn = (p: Vec2) => zones.filter(z => pointInPolygon(p, z.points))
    const claimLines = (input.claimed || []).filter(c => c.source_id === sheet.id && c.points.length >= 2)
    const claimTol = CLAIM_M * k
    const isClaimed = (p: Vec2) => claimLines.some(c => { for (let i = 1; i < c.points.length; i++) if (sideDist(p, c.points[i - 1], c.points[i]) <= claimTol) return true; return false })

    for (const item of items) {
      const measure = measureFor(input.unit, item.kind)
      for (const shape of item.shapes) {
        const q = layerQuantities({ ...item, shapes: [shape] }, k)
        if (!q) continue
        if (item.kind === 'linear') {
          const value = measure === 'length' ? q.len : measure === 'count' ? 1 : (q.net ?? q.wall)
          if (!(value > 0)) continue
          total += value
          // Follow the wall in short steps; each step is shared by the zones it runs in or along.
          const share = new Map<string, number>()
          let walked = 0
          let lost = 0
          let taken = 0
          for (let i = 1; i < shape.pts.length; i++) {
            const a = shape.pts[i - 1]
            const b = shape.pts[i]
            const len = polyLen([a, b])
            const steps = Math.max(1, Math.ceil(len / (0.05 * k)))
            for (let s = 0; s < steps; s++) {
              const t = (s + 0.5) / steps
              const w = len / steps
              walked += w
              const pt: Vec2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
              if (claimLines.length && isClaimed(pt)) { taken += w; continue }
              const near = zonesNear(pt)
              if (!near.length) { lost += w; continue }
              for (const z of near) share.set(z.location_id!, (share.get(z.location_id!) || 0) + w / near.length)
            }
          }
          if (!(walked > 0)) { unallocated += value; continue }
          for (const [id, w] of share) add(id, value * (w / walked))
          unallocated += value * (lost / walked)
          claimedTotal += value * (taken / walked)
        } else if (item.kind === 'area') {
          const value = measure === 'length' ? q.per : measure === 'count' ? 1 : q.area
          if (!(value > 0)) continue
          total += value
          const inside = zonesIn(centroid(shape.pts))
          if (!inside.length) { unallocated += value; continue }
          for (const z of inside) add(z.location_id!, value / inside.length)
        } else {
          total += 1
          const inside = shape.pts[0] ? zonesIn(shape.pts[0]) : []
          if (!inside.length) { unallocated += 1; continue }
          for (const z of inside) add(z.location_id!, 1 / inside.length)
        }
      }
    }
  }
  return { byLocation, total, unallocated, uncalibratedSheets, claimed: claimedTotal }
}

// ---------------------------------------------------------------------------------------------------
// Planning layer: each wall step goes to the location where the work is physically done.
//   * framing (and the whole wall, rule 'carrier') → the room that carries the wall: the first in the
//     location flow (locations.sequence_number), unless the planner picked another one for that wall;
//   * board / joints (rule 'face') → 100% to the room each face looks into — never split 50/50.
//     Side A is the carrier's face, Side B the neighbour's; when a wall type has different boards on its
//     two sides (moisture-resistant, cement board…) the product follows the drawing (face A = left of the
//     drawing direction) so the right board stays on the right side;
//   * insulation goes with Side B (installed from the open face, before Side B closes the wall);
//   * an exterior wall's outside face goes to that level's "Exterior" location (EXTERIOR key);
//   * areas and counts keep the position rule ('position'); 'manual' = no automatic split.
// The scope register and the estimate are not touched: only how a step is spread over locations.

export type WallStep = 'framing' | 'board_a' | 'joints_a' | 'insulation' | 'board_b' | 'joints_b'
export type AllocationRule = 'face' | 'carrier' | 'position' | 'manual'
export const ALLOCATION_RULES: AllocationRule[] = ['face', 'carrier', 'position', 'manual']
const WALL_STEPS = new Set<string>(['framing', 'board_a', 'joints_a', 'insulation', 'board_b', 'joints_b'])

/** Rule a scope step uses when the planner has not chosen one. */
export function defaultRuleFor(step: string | null | undefined): AllocationRule {
  if (step === 'framing') return 'carrier'
  if (step && WALL_STEPS.has(step)) return 'face'
  return 'position'
}

/** Key of a level's exterior bucket in `byLocation` (until mapped to a real location). */
export const EXTERIOR = 'exterior:'
export const exteriorKeyOf = (sheet: Pick<SourceRow, 'id' | 'level_id'>) => `${EXTERIOR}${sheet.level_id || sheet.id}`

/** Board build-up per side, to tell symmetric wall types (same boards both sides) from asymmetric ones. */
export type WallTypeBoards = { id: string; boards?: { side?: string; product?: string; count?: number }[] | null }
export function isSymmetric(wt: WallTypeBoards | null | undefined): boolean {
  if (!wt || !Array.isArray(wt.boards)) return true
  const sig = (s: 'A' | 'B') => wt.boards!.filter(b => b && b.side === s && Number(b.count) > 0).map(b => `${String(b.product || '').trim().toLowerCase()}×${Number(b.count)}`).sort().join('|')
  return sig('A') === sig('B')
}

export type StepInput = {
  layerIds: string[]
  unit: string
  /** project_scopes.takeoff_step of the line. */
  step?: string | null
  /** Planner's choice; default from the step. */
  rule?: AllocationRule | null
  productionLocationIds: Set<string>
  claimed?: ClaimedLine[]
  /** Order of the location flow (lower first); carriers of dividing walls default to the lower. */
  flowRank: Map<string, number>
  /** Carrier picked by the planner for a wall (element id → location id). */
  carriers?: Map<string, string>
  /** Wall types of the layers (boards), for the symmetric / asymmetric rule. */
  wallTypes?: Map<string, WallTypeBoards>
  /** Exterior bucket → real location id, when it already exists. */
  exteriorLocationOf?: (key: string) => string | null
}

/** The allocation of one scope step, by its rule (see above). */
export function allocateScopeStep(data: TakeoffData, input: StepInput): AllocationResult {
  const rule = input.rule || defaultRuleFor(input.step)
  const base = { layerIds: input.layerIds, unit: input.unit, productionLocationIds: input.productionLocationIds, claimed: input.claimed }
  if (rule === 'manual') {
    const r = allocateFromTakeoff(data, base)
    return { ...r, byLocation: new Map(), unallocated: r.total - r.claimed }
  }
  if (rule === 'position' || !data.layers.some(l => input.layerIds.includes(l.id) && l.kind === 'linear')) return allocateFromTakeoff(data, base)

  // Areas and counts in the same feed keep their position split.
  const others = data.layers.filter(l => input.layerIds.includes(l.id) && l.kind !== 'linear').map(l => l.id)
  const out: AllocationResult = others.length
    ? allocateFromTakeoff(data, { ...base, layerIds: others })
    : { byLocation: new Map(), total: 0, unallocated: 0, uncalibratedSheets: [], claimed: 0 }
  const carrierOf = new Map<string, Set<string>>()
  out.carrierOf = carrierOf
  const add = (id: string, v: number) => { const key = id.startsWith(EXTERIOR) ? input.exteriorLocationOf?.(id) || id : id; out.byLocation.set(key, (out.byLocation.get(key) || 0) + v) }
  const walls = data.layers.filter(l => input.layerIds.includes(l.id) && l.kind === 'linear')
  const levelById = new Map(data.levels.map(l => [l.id, l] as [string, LevelRow]))
  const rankOf = (id: string) => input.flowRank.get(id) ?? 1e9
  const wallTypes = input.wallTypes || new Map((data.wallTypes || []).map(w => [w.id, w] as [string, WallTypeBoards]))
  const carriers = input.carriers || new Map((data.carriers || []).map(c => [c.element_id, c.location_id] as [string, string]))
  const step = input.step || ''
  const onA = step === 'board_a' || step === 'joints_a'
  const onB = step === 'board_b' || step === 'joints_b'

  for (const sheet of data.sources) {
    if (!data.elements.some(e => e.source_id === sheet.id && walls.some(w => w.id === e.layer_id))) continue
    const k = Number(sheet.scale_pt_per_m) || 0
    if (!(k > 0)) { if (!out.uncalibratedSheets.includes(sheet.name)) out.uncalibratedSheets.push(sheet.name); continue }
    const level = sheet.level_id ? levelById.get(sheet.level_id) : undefined
    const h = level ? wallHeightOf(masterOf(level, levelById)) : null
    const raw = rowsToItems(walls, data.elements, new Map([[sheet.id, 1]]))
    const items: TakeoffItem[] = h ? fillLevelHeights(raw, () => h) : raw
    const zones = data.zones.filter(z => z.source_id === sheet.id && z.location_id && input.productionLocationIds.has(z.location_id) && z.points.length >= 3)
    const zoneAt = (p: Vec2) => zones.find(z => pointInPolygon(p, z.points))?.location_id || null
    const claimLines = (input.claimed || []).filter(c => c.source_id === sheet.id && c.points.length >= 2)
    const claimTol = CLAIM_M * k
    const isClaimed = (p: Vec2) => claimLines.some(c => { for (let i = 1; i < c.points.length; i++) if (sideDist(p, c.points[i - 1], c.points[i]) <= claimTol) return true; return false })
    const exterior = exteriorKeyOf(sheet)

    for (const item of items) {
      const layer = walls.find(w => w.id === item.key)
      const symmetric = isSymmetric(layer?.wall_type_id ? wallTypes.get(layer.wall_type_id) : null)
      const measure = measureFor(input.unit, item.kind)
      const probe = ((item.thickness && item.thickness > 0 ? item.thickness : 0.1) / 2 + 0.3) * k
      for (const shape of item.shapes) {
        const q = layerQuantities({ ...item, shapes: [shape] }, k)
        if (!q) continue
        const value = measure === 'length' ? q.len : measure === 'count' ? 1 : (q.net ?? q.wall)
        if (!(value > 0)) continue
        out.total += value
        const override = shape.id ? carriers.get(shape.id) : undefined
        let walked = 0
        const parts: { loc: string | null; w: number; claimed: boolean }[] = []
        for (let i = 1; i < shape.pts.length; i++) {
          const a = shape.pts[i - 1], b = shape.pts[i]
          const len = polyLen([a, b])
          if (len < 1e-9) continue
          const u: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
          const n: Vec2 = [-u[1], u[0]] // face A side
          const steps = Math.max(1, Math.ceil(len / (0.05 * k)))
          for (let s = 0; s < steps; s++) {
            const t = (s + 0.5) / steps
            const w = len / steps
            walked += w
            const p: Vec2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
            if (claimLines.length && isClaimed(p)) { parts.push({ loc: null, w, claimed: true }); continue }
            const zA = zoneAt([p[0] + n[0] * probe, p[1] + n[1] * probe])
            const zB = zoneAt([p[0] - n[0] * probe, p[1] - n[1] * probe])
            if (!zA && !zB) { parts.push({ loc: null, w, claimed: false }); continue }
            // The room on each face (an exterior face goes to the level's Exterior bucket).
            const faceA = zA || exterior
            const faceB = zB || exterior
            // Carrier: the planner's pick for this wall when it is one of its rooms, else the first in the flow.
            let carrier: string
            if (zA && zB) carrier = override && (override === zA || override === zB) ? override : (rankOf(zA) < rankOf(zB) || (rankOf(zA) === rankOf(zB) && zA <= zB) ? zA : zB)
            else carrier = (zA || zB)!
            const other = carrier === faceA ? faceB : faceA
            if (other !== carrier) { const key = other.startsWith(EXTERIOR) ? input.exteriorLocationOf?.(other) || other : other; const set = carrierOf.get(key) || new Set<string>(); set.add(carrier); carrierOf.set(key, set) }
            let loc: string
            if (rule === 'carrier' || step === 'framing') loc = carrier
            else if (step === 'insulation') loc = other
            else if (onA) loc = symmetric ? carrier : faceA
            else if (onB) loc = symmetric ? other : faceB
            else loc = carrier
            parts.push({ loc, w, claimed: false })
          }
        }
        if (!(walked > 0)) { out.unallocated += value; continue }
        for (const pt of parts) {
          const v = value * (pt.w / walked)
          if (pt.claimed) out.claimed += v
          else if (!pt.loc) out.unallocated += v
          else add(pt.loc, v)
        }
      }
    }
  }
  return out
}

/** Location flow order: sequence_number, then name (the carrier of a dividing wall is the first). */
export function flowRankOf(locations: { id: string; name?: string | null; sequence_number?: number | null }[]): Map<string, number> {
  const sorted = [...locations].sort((a, b) => (Number(a.sequence_number) || 0) - (Number(b.sequence_number) || 0) || String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true }))
  return new Map(sorted.map((l, i) => [l.id, i]))
}

/**
 * The real location of an Exterior bucket: a location marked environment_type 'exterior' under the
 * level's floor location (takeoff_levels.location_id), or with no parent when the level has none.
 */
export function exteriorLocationOf(key: string, locations: { id: string; parent_id?: string | null; environment_type?: string | null }[], levels: { id: string; location_id?: string | null }[]): string | null {
  if (!key.startsWith(EXTERIOR)) return null
  const level = levels.find(l => l.id === key.slice(EXTERIOR.length))
  const parent = level?.location_id || null
  return locations.find(l => l.environment_type === 'exterior' && (l.parent_id || null) === parent)?.id || null
}
