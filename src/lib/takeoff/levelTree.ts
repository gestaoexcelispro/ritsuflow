// The item list grouped by level: each level group (a level or a typical-floor group) with
// its sheets and the items drawn on them, with that level's quantities.
import { layerQuantities, type Quantities, type TakeoffItem } from './geometry'
import { fillLevelHeights, levelGroups, masterOf, wallHeightOf, type LevelRow } from './levels'
import { rowsToItems, type ElementRow, type LayerRow, type SourceRow } from './rows'

/** Id of the group for sheets without a (valid) level. */
export const NO_LEVEL = ''

export type LevelBranch = {
  /** Master level id, or NO_LEVEL. */
  id: string
  master: LevelRow | null
  /** Floors in the group (1 + typical followers). */
  count: number
  /** Master and followers. */
  levelIds: string[]
  sheets: SourceRow[]
}

/** Group id of a level: its master's id (NO_LEVEL when unknown). */
export function branchOfLevel(levelId: string | null | undefined, levels: LevelRow[]): string {
  if (!levelId) return NO_LEVEL
  const byId = new Map<string, LevelRow>(levels.map(l => [l.id, l] as [string, LevelRow]))
  const l = byId.get(levelId)
  return l ? masterOf(l, byId).id : NO_LEVEL
}

/** Groups top to bottom, then "no level" (only when it has sheets). A sheet put on a follower counts under its master. */
export function levelBranches(levels: LevelRow[], sources: SourceRow[]): LevelBranch[] {
  const sheetsOf = new Map<string, SourceRow[]>()
  for (const s of sources) {
    const b = branchOfLevel(s.level_id, levels)
    sheetsOf.set(b, [...(sheetsOf.get(b) || []), s])
  }
  const list: LevelBranch[] = levelGroups(levels).map(g => ({
    id: g.master.id,
    master: g.master,
    count: g.count,
    levelIds: [g.master.id, ...g.followers.map(f => f.id)],
    sheets: sheetsOf.get(g.master.id) || [],
  }))
  const loose = sheetsOf.get(NO_LEVEL) || []
  if (loose.length) list.push({ id: NO_LEVEL, master: null, count: 1, levelIds: [], sheets: loose })
  return list
}

export type BranchItem = {
  key: string
  item: TakeoffItem
  /** Summed over the group's calibrated sheets (one floor); null when none is calibrated. */
  q: Quantities | null
}

const add = (a: Quantities, b: Quantities): Quantities => ({
  len: a.len + b.len,
  area: a.area + b.area,
  per: a.per + b.per,
  n: a.n + b.n,
  wall: a.wall + b.wall,
  open: a.open + b.open,
  nOpen: a.nOpen + b.nOpen,
  net: a.net == null && b.net == null ? undefined : (a.net ?? 0) + (b.net ?? 0),
})

/** Items drawn on the group's sheets (in layer order), each sheet measured at its own scale and wall height. */
export function branchItems(branch: LevelBranch, layers: LayerRow[], elements: ElementRow[]): BranchItem[] {
  const h = wallHeightOf(branch.master)
  const out = new Map<string, BranchItem>()
  for (const s of branch.sheets) {
    const raw = rowsToItems(layers, elements, new Map([[s.id, 1]]))
    const items = h ? fillLevelHeights(raw, () => h) : raw
    const scale = Number(s.scale_pt_per_m) || 0
    for (const it of items) {
      if (!it.shapes.length) continue
      const q = scale > 0 ? layerQuantities(it, scale) : null
      const prev = out.get(it.key)
      if (!prev) out.set(it.key, { key: it.key, item: it, q })
      else out.set(it.key, { ...prev, item: { ...prev.item, shapes: [...prev.item.shapes, ...it.shapes] }, q: prev.q && q ? add(prev.q, q) : prev.q || q })
    }
  }
  const order = new Map(layers.map((l, i) => [l.id, i]))
  return [...out.values()].sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0))
}

/** Keeps only shapes whose storey (page) is not on a hidden group. */
export function withoutHiddenStoreys<T extends { shapes: { page: number }[] }>(items: T[], storeys: { page: number; levelId?: string | null }[], hidden: Set<string>, levels: LevelRow[]): T[] {
  if (!hidden.size) return items
  const hiddenPages = new Set(storeys.filter(st => hidden.has(branchOfLevel(st.levelId, levels))).map(st => st.page))
  if (!hiddenPages.size) return items
  return items.map(it => ({ ...it, shapes: it.shapes.filter(sh => !hiddenPages.has(sh.page)) })).filter(it => it.shapes.length > 0)
}
