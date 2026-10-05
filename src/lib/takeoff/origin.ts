// Sheet origin and level: puts every PDF floor in one building coordinate system.
// A sheet point p becomes model metres: rotate (p − origin) by −angle, divide by the scale.
// Axes follow the sheet: x to the right, y down the sheet (the 3D view maps y to depth).
import type { TakeoffItem, Vec2 } from './geometry'
import { rowsToItems, type ElementRow, type LayerRow, type SourceRow } from './rows'
import { levelGroups, sheetLevel, type LevelRow } from './levels'

export type SheetOrigin = { x: number; y: number; angleDeg: number }

export function originOf(src: Pick<SourceRow, 'origin_x' | 'origin_y' | 'origin_angle_deg'>): SheetOrigin | null {
  if (src.origin_x == null || src.origin_y == null) return null
  return { x: Number(src.origin_x), y: Number(src.origin_y), angleDeg: Number(src.origin_angle_deg) || 0 }
}

/** Angle (degrees) of the line from a to b on the sheet. */
export function angleFromPoints(a: Vec2, b: Vec2): number {
  return (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI
}

/** Sheet point → model metres relative to the origin. */
export function sheetToModel(p: Vec2, o: SheetOrigin, ptPerM: number): Vec2 {
  const a = (-o.angleDeg * Math.PI) / 180
  const dx = p[0] - o.x
  const dy = p[1] - o.y
  return [(dx * Math.cos(a) - dy * Math.sin(a)) / ptPerM, (dx * Math.sin(a) + dy * Math.cos(a)) / ptPerM]
}

export type BuildingStorey = { page: number; name: string; elevation: number; sourceId: string; levelId?: string | null }

/**
 * Every calibrated PDF sheet with an origin, in building metres, one "page" per sheet,
 * with its level elevation. Sheets without an origin or scale are left out (listed in `missing`).
 */
export function pdfBuildingItems(layers: LayerRow[], elements: ElementRow[], sources: SourceRow[], levels: LevelRow[] = []): { items: TakeoffItem[]; storeys: BuildingStorey[]; missing: SourceRow[]; noOrigin: SourceRow[] } {
  const pdf = sources.filter(s => s.kind === 'pdf_page')
  // Every calibrated sheet is shown. Without an origin of its own, a sheet uses the origin of
  // another sheet on the same PDF page (same drawing, same points), else the page corner.
  const ok = pdf.filter(s => Number(s.scale_pt_per_m) > 0)
  const missing = pdf.filter(s => !ok.includes(s))
  const pageKey = (s: SourceRow) => `${s.file_path}#${s.page_number ?? 1}`
  const originOfPage = new Map<string, SheetOrigin>()
  for (const s of ok) { const o = originOf(s); if (o && !originOfPage.has(pageKey(s))) originOfPage.set(pageKey(s), o) }
  const effOrigin = (s: SourceRow): SheetOrigin => originOf(s) || originOfPage.get(pageKey(s)) || { x: 0, y: 0, angleDeg: 0 }
  const noOrigin = ok.filter(s => !originOf(s) && !originOfPage.has(pageKey(s)))
  const levelById = new Map(levels.map(l => [l.id, l]))
  // Typical floors: the master's sheets are drawn again at each repeating level's elevation.
  const followersOf = new Map(levelGroups(levels).map(g => [g.master.id, g.followers]))
  const pageOf = new Map<string, number>()
  const storeys: BuildingStorey[] = []
  const placements: { key: string; src: SourceRow; suffix: string }[] = []
  for (const s of ok) {
    const lv = sheetLevel(s, levelById)
    storeys.push({ page: storeys.length + 1, name: lv?.name || s.name, elevation: lv?.elevation ?? 0, sourceId: s.id, levelId: lv?.level?.id ?? null })
    pageOf.set(s.id, storeys.length)
    placements.push({ key: s.id, src: s, suffix: '' })
    for (const f of (s.level_id && followersOf.get(s.level_id)) || []) {
      const key = `${s.id}#${f.id}`
      storeys.push({ page: storeys.length + 1, name: f.name, elevation: f.elevation_m, sourceId: s.id, levelId: f.id })
      pageOf.set(key, storeys.length)
      placements.push({ key, src: s, suffix: `#${f.id}` })
    }
  }
  const bySource = new Map<string, ElementRow[]>()
  for (const e of elements) {
    const list = bySource.get(e.source_id)
    if (list) list.push(e)
    else bySource.set(e.source_id, [e])
  }
  const moved: ElementRow[] = []
  for (const pl of placements) {
    const o = effOrigin(pl.src)
    const k = Number(pl.src.scale_pt_per_m)
    for (const e of bySource.get(pl.src.id) || []) {
      moved.push({ ...e, id: e.id + pl.suffix, source_id: pl.key, points: e.points.map(p => sheetToModel(p, o, k)) })
    }
  }
  return { items: rowsToItems(layers, moved, pageOf), storeys, missing, noOrigin }
}

/** Model metres (relative to the origin) → sheet point. Inverse of `sheetToModel`. */
export function modelToSheet(m: Vec2, o: SheetOrigin, ptPerM: number): Vec2 {
  const a = (o.angleDeg * Math.PI) / 180
  const x = m[0] * ptPerM
  const y = m[1] * ptPerM
  return [o.x + x * Math.cos(a) - y * Math.sin(a), o.y + x * Math.sin(a) + y * Math.cos(a)]
}

/** A point drawn on one sheet, placed at the same building position on another sheet (both need an origin and a scale). */
export function transferPoint(p: Vec2, from: { origin: SheetOrigin; ptPerM: number }, to: { origin: SheetOrigin; ptPerM: number }): Vec2 {
  return modelToSheet(sheetToModel(p, from.origin, from.ptPerM), to.origin, to.ptPerM)
}
