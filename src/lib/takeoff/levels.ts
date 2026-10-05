// Building levels (pavimentos): the project's floors, each sheet belongs to one.
// Typical floors: a level with `typical_of` repeats another level (its "master"); it has no
// sheets of its own, so quantities of the master's sheets count once per floor in the group.
import type { TakeoffItem } from './geometry'
import type { ElementRow, SourceRow } from './rows'

export type LevelRow = {
  id: string
  project_id: string
  name: string
  elevation_m: number
  /** Floor-to-floor height, metres. */
  height_m: number | null
  /** Slab thickness, metres (default wall height = floor-to-floor − slab). */
  slab_m: number | null
  /** Level this one repeats (typical floor), if any. */
  typical_of: string | null
  sort_order: number
  /** "Floor" location this level created in the Location Breakdown, if any. */
  location_id?: string | null
}

export const LEVEL_COLUMNS = 'id, project_id, name, elevation_m, height_m, slab_m, typical_of, sort_order, location_id'

const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))

/** Rows from the database (numerics may come as strings) to clean values. */
export function normalizeLevels(rows: Partial<LevelRow>[]): LevelRow[] {
  return rows.map(r => ({
    id: String(r.id),
    project_id: String(r.project_id),
    name: String(r.name ?? ''),
    elevation_m: num(r.elevation_m) ?? 0,
    height_m: num(r.height_m),
    slab_m: num(r.slab_m),
    typical_of: r.typical_of ?? null,
    sort_order: num(r.sort_order) ?? 0,
    location_id: r.location_id ?? null,
  }))
}

/** Bottom to top (elevation, then the stored order, then name). */
export function sortLevels(levels: LevelRow[]): LevelRow[] {
  return [...levels].sort((a, b) => a.elevation_m - b.elevation_m || a.sort_order - b.sort_order || a.name.localeCompare(b.name, undefined, { numeric: true }))
}

/** Default wall height on a level: floor-to-floor minus slab; null when the height isn't set. */
export function wallHeightOf(level: Pick<LevelRow, 'height_m' | 'slab_m'> | null | undefined): number | null {
  if (!level || !(Number(level.height_m) > 0)) return null
  const h = Number(level.height_m) - (Number(level.slab_m) || 0)
  return h > 0 ? Math.round(h * 1000) / 1000 : null
}

/** The level a typical floor repeats, following the link (a typical of a typical resolves to the root). */
export function masterOf(level: LevelRow, byId: Map<string, LevelRow>): LevelRow {
  let cur = level
  const seen = new Set<string>()
  while (cur.typical_of && byId.has(cur.typical_of) && !seen.has(cur.id)) {
    seen.add(cur.id)
    cur = byId.get(cur.typical_of)!
  }
  return cur
}

export type LevelGroup = {
  master: LevelRow
  /** Levels that repeat the master, bottom to top. */
  followers: LevelRow[]
  /** Floors the master's drawing stands for (1 + followers). */
  count: number
}

/** One entry per master level (typical groups together), top to bottom as shown in the tree. */
export function levelGroups(levels: LevelRow[]): LevelGroup[] {
  const byId = new Map(levels.map(l => [l.id, l]))
  const groups = new Map<string, LevelGroup>()
  for (const l of sortLevels(levels)) {
    const m = masterOf(l, byId)
    if (!groups.has(m.id)) groups.set(m.id, { master: m, followers: [], count: 1 })
    if (m.id !== l.id) {
      const g = groups.get(m.id)!
      g.followers.push(l)
      g.count += 1
    }
  }
  return [...groups.values()].sort((a, b) => b.master.elevation_m - a.master.elevation_m || b.master.sort_order - a.master.sort_order)
}

/** "Level 2" or "Level 2 – Level 9 (×8)". */
export function groupLabel(g: LevelGroup): string {
  if (!g.followers.length) return g.master.name
  const all = sortLevels([g.master, ...g.followers])
  return `${all[0].name} – ${all[all.length - 1].name} (×${g.count})`
}

/** Floors each master level stands for: level id → count (followers map to 0: they have no sheets). */
export function levelMultipliers(levels: LevelRow[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const g of levelGroups(levels)) {
    out.set(g.master.id, g.count)
    for (const f of g.followers) out.set(f.id, 0)
  }
  return out
}

/**
 * Elements with one copy per extra floor of a typical group, so totals (quantities, purchases)
 * count every floor. Copies keep their sheet (source_id) and get a suffixed id.
 */
export function withTypicalCopies(elements: ElementRow[], sources: Pick<SourceRow, 'id' | 'level_id'>[], levels: LevelRow[]): ElementRow[] {
  const mult = levelMultipliers(levels)
  const levelOfSource = new Map(sources.map(s => [s.id, s.level_id ?? null]))
  const out: ElementRow[] = []
  for (const e of elements) {
    out.push(e)
    const lv = levelOfSource.get(e.source_id)
    const n = lv ? mult.get(lv) ?? 1 : 1
    for (let k = 1; k < n; k++) out.push({ ...e, id: `${e.id}~${k}` })
  }
  return out
}

/** How many floors a sheet stands for (1 when it has no level or isn't typical). */
export function sheetMultiplier(source: Pick<SourceRow, 'level_id'>, levels: LevelRow[]): number {
  if (!source.level_id) return 1
  return levelMultipliers(levels).get(source.level_id) || 1
}

/** Level name and elevation of a sheet: its level row, else the old per-sheet fields. */
export function sheetLevel(source: Pick<SourceRow, 'level_id' | 'level_name' | 'level_elevation_m'>, byId: Map<string, LevelRow>): { name: string; elevation: number; level: LevelRow | null } | null {
  const l = source.level_id ? byId.get(source.level_id) : undefined
  if (l) return { name: l.name, elevation: l.elevation_m, level: l }
  if (source.level_name || source.level_elevation_m != null) return { name: source.level_name || '', elevation: Number(source.level_elevation_m) || 0, level: null }
  return null
}

export type GenerateLevelsInput = {
  /** Storeys including the ground floor (a 10-storey building = 10). */
  storeys: number
  groundElevation: number
  heightM: number
  slabM: number | null
  roof: boolean
  names: { ground: string; level: (n: number) => string; roof: string }
}

/** New level rows (without ids) for a building: ground, levels 1…n−1 and optionally the roof. */
export function generateLevels(input: GenerateLevelsInput): Omit<LevelRow, 'id' | 'project_id' | 'typical_of'>[] {
  const n = Math.max(1, Math.min(200, Math.floor(input.storeys)))
  const h = input.heightM
  const r = (v: number) => Math.round(v * 1000) / 1000
  const out: Omit<LevelRow, 'id' | 'project_id' | 'typical_of'>[] = []
  for (let i = 0; i < n; i++) {
    out.push({ name: i === 0 ? input.names.ground : input.names.level(i), elevation_m: r(input.groundElevation + i * h), height_m: h, slab_m: input.slabM, sort_order: i * 10 })
  }
  if (input.roof) out.push({ name: input.names.roof, elevation_m: r(input.groundElevation + n * h), height_m: null, slab_m: input.slabM, sort_order: n * 10 })
  return out
}

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()

/** Level number written in a name: "PAV. 3", "3º PAVIMENTO", "LEVEL 3", "PAVIMENTO TIPO 3" → 3. */
function levelNumber(s: string): number | null {
  const t = plain(s)
  const m =
    t.match(/\b(?:PAV(?:IMENTO)?|NIVEL|LEVEL|ANDAR|FLOOR|L)\.?\s*(?:TIPO\s*)?(\d{1,3})\b/) ||
    t.match(/\b(\d{1,3})\s*(?:O|º|°|ª)?\s*(?:PAV(?:IMENTO)?|ANDAR|FLOOR|LEVEL)\b/)
  return m ? Number(m[1]) : null
}

const GROUND = /\b(TERREO|GROUND|PAVIMENTO TERREO)\b/
const ROOF = /\b(COBERTURA|ROOF|TELHADO|ATICO)\b/

/** Best level for a sheet from its name (null when nothing matches clearly). */
export function matchLevelByName(sheetName: string, levels: LevelRow[]): string | null {
  const s = plain(sheetName)
  for (const l of levels) {
    const ln = plain(l.name).trim()
    if (ln.length >= 3 && new RegExp(`(^|[^A-Z0-9])${ln.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Z0-9])`).test(s)) return l.id
  }
  if (GROUND.test(s)) return levels.find(l => GROUND.test(plain(l.name)))?.id ?? null
  if (ROOF.test(s)) return levels.find(l => ROOF.test(plain(l.name)))?.id ?? null
  const n = levelNumber(sheetName)
  if (n == null) return null
  const hits = levels.filter(l => levelNumber(l.name) === n)
  return hits.length === 1 ? hits[0].id : null
}

/**
 * Walls of items without their own height take the level's wall height (floor to floor − slab).
 * `heightOfPage` gives that height for a shape's page (null: leave the shape as it is).
 */
export function fillLevelHeights(items: TakeoffItem[], heightOfPage: (page: number) => number | null): TakeoffItem[] {
  return items.map(it => {
    if (it.kind !== 'linear' || (it.height || 0) > 0) return it
    let changed = false
    const shapes = it.shapes.map(sh => {
      if (sh.h != null) return sh
      const h = heightOfPage(sh.page)
      if (h == null) return sh
      changed = true
      return { ...sh, h }
    })
    return changed ? { ...it, shapes } : it
  })
}
