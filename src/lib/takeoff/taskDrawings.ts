// Task view: lines drawn in RitsuScope that show where one scope item is built in one location
// (table location_task_drawings). Points are PDF points of the sheet, like takeoff elements.
// A line is measured like a takeoff wall: length × wall height (m²) less the openings of the
// takeoff walls it runs along, or its length (m), or one per line (count).
import { dist, polyLen, type ElementOpening, type LayerKind, type Vec2 } from './geometry'
import { measureFor } from './scopeAllocation'

export type TaskDrawingRow = {
  id: string
  project_id: string
  scope_item_id: string
  location_id: string
  source_id: string
  points: Vec2[]
  height_m: number | null
  quantity: number
  unit: string | null
  /** T<scope code>-<nn>, e.g. T1.1-01 (never reused). */
  tag?: string | null
}

/** A takeoff wall as the task view sees it: its polyline (points) and openings (metres along it). */
export type WallRef = { pts: Vec2[]; openings?: ElementOpening[]; kind?: LayerKind; /** Wall thickness in metres, when known. */ thickness?: number }

/** Width of a task line's band on the drawing (m): it sits against the wall face on the chosen side. */
export const TASK_BAND_M = 0.1

export type Box = [number, number, number, number] // minX, minY, maxX, maxY (PDF points)

/** How close (m) a task line must run to a wall or opening to count as "along" it. */
export const ALONG_M = 0.25

/** The room's outline grown by `marginM` metres on every side: what the task view frames. */
export function frameOf(outline: Vec2[], ptPerM: number, marginM = 1): Box | null {
  if (!outline.length) return null
  const xs = outline.map((p) => p[0]), ys = outline.map((p) => p[1])
  const m = marginM * (ptPerM > 0 ? ptPerM : 0)
  return [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m]
}

/** Segment a→b clipped to a box (Liang–Barsky); null when it misses the box. */
export function clipSegment(a: Vec2, b: Vec2, box: Box): [Vec2, Vec2] | null {
  let t0 = 0, t1 = 1
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const edges: [number, number][] = [[-dx, a[0] - box[0]], [dx, box[2] - a[0]], [-dy, a[1] - box[1]], [dy, box[3] - a[1]]]
  for (const [p, q] of edges) {
    if (p === 0) { if (q < 0) return null; continue }
    const r = q / p
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r } else { if (r < t0) return null; if (r < t1) t1 = r }
  }
  if (t1 - t0 <= 1e-9) return null
  return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]]
}

/** Distance from p to segment a→b. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const L2 = dx * dx + dy * dy
  if (!L2) return dist(p, a)
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2))
  return dist(p, [a[0] + t * dx, a[1] + t * dy])
}

export function distToPolyline(p: Vec2, pts: Vec2[]): number {
  let best = Infinity
  for (let i = 1; i < pts.length; i++) best = Math.min(best, distToSegment(p, pts[i - 1], pts[i]))
  return best
}

/** Point at `along` (same units as the points) from the start of a polyline. */
export function pointAlong(pts: Vec2[], along: number): Vec2 | null {
  let left = along
  for (let i = 1; i < pts.length; i++) {
    const L = dist(pts[i - 1], pts[i])
    if (left <= L || i === pts.length - 1) {
      const t = L ? Math.max(0, Math.min(1, left / L)) : 0
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t]
    }
    left -= L
  }
  return pts[0] || null
}

/**
 * "Take a wall": the straight stretch of a takeoff wall nearest to p (within 0.4 m), limited to the room.
 * The room outline is drawn to the wall faces, so the stretch may run up to 0.3 m outside it across the
 * wall, but only 0.08 m past the room's ends along it (so it never reaches into the next room).
 */
export function takeWallAt(p: Vec2, walls: WallRef[], room: Box, ptPerM: number): [Vec2, Vec2] | null {
  const r = takeWallStretch(p, walls, room, ptPerM)
  return r ? [r.a, r.b] : null
}

/** Like takeWallAt, with the wall's thickness (m) so the task line can sit against the chosen face. */
export function takeWallStretch(p: Vec2, walls: WallRef[], room: Box, ptPerM: number): { a: Vec2; b: Vec2; thicknessM: number } | null {
  const k = ptPerM > 0 ? ptPerM : 1
  let best: { a: Vec2; b: Vec2; d: number; t: number } | null = null
  for (const w of walls) {
    if (w.kind && w.kind !== 'linear') continue
    for (let i = 1; i < w.pts.length; i++) {
      const d = distToSegment(p, w.pts[i - 1], w.pts[i])
      if (d <= 0.4 * k && (!best || d < best.d)) best = { a: w.pts[i - 1], b: w.pts[i], d, t: w.thickness && w.thickness > 0 ? w.thickness : 0 }
    }
  }
  if (!best) return null
  const horizontal = Math.abs(best.b[0] - best.a[0]) >= Math.abs(best.b[1] - best.a[1])
  const along = 0.08 * k, across = 0.3 * k
  const mx = horizontal ? along : across, my = horizontal ? across : along
  const seg = clipSegment(best.a, best.b, [room[0] - mx, room[1] - my, room[2] + mx, room[3] + my])
  return seg ? { a: seg[0], b: seg[1], thicknessM: best.t } : null
}

/**
 * A task line projected to one side, like a wall drawn by its face: the band (TASK_BAND_M wide) lies on
 * the side of `towards`, against the line a→b. When a→b is a wall centreline (taken wall), the band
 * starts at that wall's face (half its thickness away). Returns the band's centreline.
 */
export function projectTaskLine(a: Vec2, b: Vec2, towards: Vec2, ptPerM: number, wallThicknessM = 0): [Vec2, Vec2] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (len < 1e-9 || !(ptPerM > 0)) return [a, b]
  const cross = (b[0] - a[0]) * (towards[1] - a[1]) - (b[1] - a[1]) * (towards[0] - a[0])
  const s = Math.sign(cross) || 1
  const nx = (-(b[1] - a[1]) / len) * s, ny = ((b[0] - a[0]) / len) * s
  const off = (Math.max(0, wallThicknessM) / 2 + TASK_BAND_M / 2) * ptPerM
  return [[a[0] + nx * off, a[1] + ny * off], [b[0] + nx * off, b[1] + ny * off]]
}

/** Next tag for a scope item: T<code>-<nn>, one more than the highest used (gaps are never filled). */
export function nextTaskTag(code: string | null | undefined, used: (string | null | undefined)[]): string {
  const prefix = `T${(code || '').trim() || 'X'}-`
  let max = 0
  for (const tag of used) {
    if (!tag || !tag.startsWith(prefix)) continue
    const n = Number(tag.slice(prefix.length))
    if (Number.isFinite(n) && n > max) max = n
  }
  return `${prefix}${String(max + 1).padStart(2, '0')}`
}

export type TaskMeasure = { length: number; gross: number; openings: number; quantity: number; measure: 'wallArea' | 'length' | 'count' }

/**
 * Measures task lines for a scope item's unit. m² = length × height less the openings of takeoff
 * walls whose centre lies on a task line (each opening once); m = length; anything else = one per line.
 */
export function measureTaskLines(lines: Vec2[][], opts: { ptPerM: number; heightM: number | null; unit: string | null | undefined; walls?: WallRef[] }): TaskMeasure {
  const { ptPerM, heightM, unit, walls = [] } = opts
  const measure = measureFor(unit, 'linear') === 'wallArea' ? 'wallArea' : measureFor(unit, 'linear') === 'length' ? 'length' : 'count'
  const drawn = lines.filter((l) => l.length >= 2)
  if (!(ptPerM > 0)) return { length: 0, gross: 0, openings: 0, quantity: measure === 'count' ? drawn.length : 0, measure }
  const length = drawn.reduce((s, l) => s + polyLen(l) / ptPerM, 0)
  if (measure === 'count') return { length, gross: drawn.length, openings: 0, quantity: drawn.length, measure }
  if (measure === 'length') return { length, gross: length, openings: 0, quantity: length, measure }
  const H = heightM && heightM > 0 ? heightM : 0
  const gross = length * H
  let openings = 0
  const tol = ALONG_M * ptPerM
  for (const w of walls) {
    if (w.kind && w.kind !== 'linear') continue
    for (const o of w.openings || []) {
      const c = pointAlong(w.pts, o.off * ptPerM)
      if (!c || !drawn.some((l) => distToPolyline(c, l) <= tol)) continue
      openings += o.w * Math.max(0, Math.min(o.h, H - (o.sill || 0)))
    }
  }
  const quantity = Math.max(0, gross - openings)
  return { length, gross, openings, quantity, measure }
}

/** Sum of drawn quantities by `${scope_item_id}:${location_id}`. */
export function drawnTotals(rows: Pick<TaskDrawingRow, 'scope_item_id' | 'location_id' | 'quantity'>[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of rows) m.set(`${r.scope_item_id}:${r.location_id}`, (m.get(`${r.scope_item_id}:${r.location_id}`) || 0) + Number(r.quantity || 0))
  return m
}
