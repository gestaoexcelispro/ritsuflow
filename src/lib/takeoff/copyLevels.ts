// Copy a sheet's takeoff to other levels: each target level gets its own, independent
// copy of the drawings (unlike a typical floor, which repeats one drawing).
// Targets: a level without sheets gets a new sheet on the same PDF page (same points);
// a level with its own sheet gets the drawings placed through both sheets' origins.
import type { Vec2 } from './geometry'
import { originOf, transferPoint } from './origin'
import type { ElementRow, SourceRow } from './rows'
import type { ZoneRow } from './zones'

export type CopyTargetStatus =
  | { kind: 'newSheet' }
  | { kind: 'sheet'; sheet: SourceRow }
  | { kind: 'blocked'; reason: 'typical' | 'noOrigin' | 'noScale' | 'same' }

/** How a level can receive a copy from `from`, given its sheets (pick the one with an origin). */
export function copyTarget(from: SourceRow, levelSheets: SourceRow[], isFollower: boolean): CopyTargetStatus {
  if (isFollower) return { kind: 'blocked', reason: 'typical' }
  const others = levelSheets.filter(s => s.id !== from.id && s.kind === 'pdf_page')
  if (!others.length) return levelSheets.some(s => s.id === from.id) ? { kind: 'blocked', reason: 'same' } : { kind: 'newSheet' }
  // A sheet showing the very same PDF page needs no origin: points are the same.
  const samePage = others.find(s => s.file_path === from.file_path && s.page_number === from.page_number)
  if (samePage) return { kind: 'sheet', sheet: samePage }
  const target = others.find(s => originOf(s) && Number(s.scale_pt_per_m) > 0) || others[0]
  if (!(Number(from.scale_pt_per_m) > 0) || !(Number(target.scale_pt_per_m) > 0)) return { kind: 'blocked', reason: 'noScale' }
  if (!originOf(from) || !originOf(target)) return { kind: 'blocked', reason: 'noOrigin' }
  return { kind: 'sheet', sheet: target }
}

/** Point mapping from one sheet to another: identity on the same PDF page, else through the origins. */
export function sheetMapper(from: SourceRow, to: SourceRow): (p: Vec2) => Vec2 {
  if (from.file_path === to.file_path && from.page_number === to.page_number) return p => [p[0], p[1]]
  const a = originOf(from)
  const b = originOf(to)
  const ka = Number(from.scale_pt_per_m)
  const kb = Number(to.scale_pt_per_m)
  if (!a || !b || !(ka > 0) || !(kb > 0)) throw new Error('both sheets need an origin and a scale')
  const r = (v: number) => Math.round(v * 1000) / 1000
  return p => {
    const q = transferPoint(p, { origin: a, ptPerM: ka }, { origin: b, ptPerM: kb })
    return [r(q[0]), r(q[1])]
  }
}

type NewElement = Omit<ElementRow, 'id'> & { location_id?: string | null }

/** Element rows to insert on the target sheet (openings are in metres along the wall, so they carry over). */
export function copiedElements(els: (ElementRow & { location_id?: string | null })[], targetSourceId: string, map: (p: Vec2) => Vec2): NewElement[] {
  return els.map(e => ({
    project_id: e.project_id,
    layer_id: e.layer_id,
    source_id: targetSourceId,
    points: e.points.map(map),
    height_override_m: e.height_override_m ?? null,
    z_rel_m: e.z_rel_m ?? 0,
    ifc_guid: null,
    root_guid: null,
    layer_guids: [],
    openings: (e.openings || []).map(o => ({ ...o, guid: null })),
    faces: e.faces || {},
    // The location belongs to the source floor; the copy starts without one.
    location_id: null,
  }))
}

/** Location outlines to insert on the target sheet (not linked to a project location: that one is the source floor's). */
export function copiedZones(zones: ZoneRow[], targetSourceId: string, map: (p: Vec2) => Vec2): Omit<ZoneRow, 'id' | 'created_by'>[] {
  return zones.map(z => ({
    project_id: z.project_id,
    source_id: targetSourceId,
    name: z.name,
    color: z.color,
    points: z.points.map(map),
    ceiling_height_m: z.ceiling_height_m,
    location_id: null,
    is_visible: z.is_visible,
    sort_order: z.sort_order,
  }))
}
