// Compares the elements stored for a project with a new IFC revision, by GlobalId.
// Split walls are compared at the level of their original wall (root GlobalId), so
// the sum of the pieces is compared with the wall in the new file.
// Positions are not compared: each import places the model on its own sheet, so only
// size-related values (length, height, area, openings) are meaningful across revisions.

import { polyArea, polyLen, type LayerKind, type TakeoffItem, type Vec2 } from './geometry'

export type RevisionStatus = 'added' | 'removed' | 'changed' | 'unchanged'

export type RevisionEntity = {
  guid: string
  kind: LayerKind
  name: string
  /** Linear: total length (m). Area: area (m²). Count: number of instances. */
  measure: number
  heightM: number | null
  openings: number
}

export type RevisionDiff = {
  guid: string
  kind: LayerKind
  status: RevisionStatus
  name: string
  before: RevisionEntity | null
  after: RevisionEntity | null
  changes: ('measure' | 'height' | 'openings')[]
}

export type StoredElementForRevision = {
  kind: LayerKind
  layerName: string
  layerHeightM: number | null
  points: Vec2[]
  heightOverrideM: number | null
  ifcGuid: string | null
  rootGuid: string | null
  openings: unknown[]
  ptPerM: number
}

function measureOf(kind: LayerKind, points: Vec2[], ptPerM: number) {
  if (kind === 'linear') return polyLen(points) / ptPerM
  if (kind === 'area') return polyArea(points) / (ptPerM * ptPerM)
  return 1
}

function add(map: Map<string, RevisionEntity>, guid: string, e: Omit<RevisionEntity, 'guid'>) {
  const cur = map.get(guid)
  if (!cur) { map.set(guid, { guid, ...e }); return }
  cur.measure += e.measure
  cur.openings += e.openings
  if (cur.heightM == null) cur.heightM = e.heightM
}

/** Groups stored elements by their original GlobalId. Elements drawn by hand (no GlobalId) are ignored. */
export function entitiesFromStored(elements: StoredElementForRevision[]): Map<string, RevisionEntity> {
  const out = new Map<string, RevisionEntity>()
  for (const el of elements) {
    const guid = el.rootGuid || el.ifcGuid
    if (!guid) continue
    add(out, guid, {
      kind: el.kind,
      name: el.layerName,
      measure: measureOf(el.kind, el.points, el.ptPerM),
      heightM: el.kind === 'linear' ? el.heightOverrideM ?? el.layerHeightM : null,
      openings: el.openings?.length || 0,
    })
  }
  return out
}

/** Entities of a freshly imported model (not stored). */
export function entitiesFromItems(items: TakeoffItem[], ptPerM: number): Map<string, RevisionEntity> {
  const out = new Map<string, RevisionEntity>()
  for (const it of items) {
    for (const sh of it.shapes) {
      const guid = sh.root || sh.guid
      if (!guid) continue
      add(out, guid, {
        kind: it.kind,
        name: it.name,
        measure: measureOf(it.kind, sh.pts, ptPerM),
        heightM: it.kind === 'linear' ? sh.h ?? it.height ?? null : null,
        openings: sh.openings?.length || 0,
      })
    }
  }
  return out
}

/** Tolerances: 1 cm for lengths and heights, 0.01 m² for areas. */
export function compareRevisions(before: Map<string, RevisionEntity>, after: Map<string, RevisionEntity>): RevisionDiff[] {
  const diffs: RevisionDiff[] = []
  const guids = new Set([...before.keys(), ...after.keys()])
  for (const guid of guids) {
    const b = before.get(guid) || null
    const a = after.get(guid) || null
    if (b && !a) { diffs.push({ guid, kind: b.kind, status: 'removed', name: b.name, before: b, after: null, changes: [] }); continue }
    if (!b && a) { diffs.push({ guid, kind: a.kind, status: 'added', name: a.name, before: null, after: a, changes: [] }); continue }
    const changes: RevisionDiff['changes'] = []
    const tol = a!.kind === 'area' ? 0.01 : 0.01
    if (Math.abs(a!.measure - b!.measure) > tol) changes.push('measure')
    if (a!.heightM != null && b!.heightM != null && Math.abs(a!.heightM - b!.heightM) > 0.01) changes.push('height')
    if (a!.openings !== b!.openings) changes.push('openings')
    diffs.push({ guid, kind: a!.kind, status: changes.length ? 'changed' : 'unchanged', name: a!.name, before: b, after: a, changes })
  }
  const order: Record<RevisionStatus, number> = { changed: 0, added: 1, removed: 2, unchanged: 3 }
  return diffs.sort((x, y) => order[x.status] - order[y.status] || x.name.localeCompare(y.name))
}

export function summarize(diffs: RevisionDiff[]) {
  const s = { added: 0, removed: 0, changed: 0, unchanged: 0 }
  for (const d of diffs) s[d.status]++
  return s
}
