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
  return {
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
