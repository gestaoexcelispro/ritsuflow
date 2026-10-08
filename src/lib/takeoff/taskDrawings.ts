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
  /** +1 / -1: the side of points[0]→points[1] the band lies on (points are then the face); null = centred. */
  side?: number | null
  /** Label (callout) centre on the sheet, moved by the user; null = placed automatically. */
  label_at?: Vec2 | null
}

/** Planning style of an activity (project_scopes.plan_style). */
export type PlanStyle = { thickness_m?: number; transparency?: number; color?: string }
export const PLAN_STYLE_DEFAULT = { thickness_m: 0.1, transparency: 0 }
/** The style with defaults and limits applied: thickness 0.005–0.5 m (5–500 mm), transparency 0–0.9. */
export function planStyleOf(style: PlanStyle | null | undefined): { thickness_m: number; transparency: number; color?: string } {
  const th = Number(style?.thickness_m)
  const tr = Number(style?.transparency)
  return {
    thickness_m: Number.isFinite(th) && th > 0 ? Math.min(0.5, Math.max(0.005, th)) : PLAN_STYLE_DEFAULT.thickness_m,
    transparency: Number.isFinite(tr) ? Math.min(0.9, Math.max(0, tr)) : PLAN_STYLE_DEFAULT.transparency,
    color: typeof style?.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(style.color) ? style.color : undefined,
  }
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
 * A task line placed against a face, like a wall drawn by its face. The third click (`towards`) gives
 * the side. When a→b is a wall centreline (taken wall), the face is that wall's face on that side (half
 * its thickness away); otherwise a→b is the face itself. Stored: the face and the side (+1 / -1).
 */
export function faceFor(a: Vec2, b: Vec2, towards: Vec2, ptPerM: number, wallThicknessM = 0): { face: [Vec2, Vec2]; side: 1 | -1 } {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  const cross = (b[0] - a[0]) * (towards[1] - a[1]) - (b[1] - a[1]) * (towards[0] - a[0])
  const side = (Math.sign(cross) || 1) as 1 | -1
  if (len < 1e-9 || !(ptPerM > 0) || !(wallThicknessM > 0)) return { face: [a, b], side }
  const nx = (-(b[1] - a[1]) / len) * side, ny = ((b[0] - a[0]) / len) * side
  const off = (wallThicknessM / 2) * ptPerM
  return { face: [[a[0] + nx * off, a[1] + ny * off], [b[0] + nx * off, b[1] + ny * off]], side }
}

/** Centreline of the band (bandM wide) that lies against a face on `side`; the line itself when side is null. */
export function bandCentre(pts: Vec2[], side: number | null | undefined, bandM: number, ptPerM: number): Vec2[] {
  if (!side || pts.length < 2 || !(ptPerM > 0)) return pts
  const out: Vec2[] = []
  for (let i = 0; i < pts.length; i++) {
    // Normal of the segment(s) at this vertex (averaged at inner vertices).
    const seg = (j: number): Vec2 | null => { const p = pts[j], q = pts[j + 1]; if (!p || !q) return null; const L = Math.hypot(q[0] - p[0], q[1] - p[1]); return L > 1e-9 ? [-(q[1] - p[1]) / L, (q[0] - p[0]) / L] : null }
    const n1 = seg(i - 1), n2 = seg(i)
    const n = n1 && n2 ? [(n1[0] + n2[0]) / 2, (n1[1] + n2[1]) / 2] : (n1 || n2 || [0, 0])
    const off = (bandM / 2) * ptPerM * Math.sign(side)
    out.push([pts[i][0] + n[0] * off, pts[i][1] + n[1] * off])
  }
  return out
}

/** Kept for older callers: the band's centreline, as before (face + side → centre). */
export function projectTaskLine(a: Vec2, b: Vec2, towards: Vec2, ptPerM: number, wallThicknessM = 0, bandM = TASK_BAND_M): [Vec2, Vec2] {
  const { face, side } = faceFor(a, b, towards, ptPerM, wallThicknessM)
  const c = bandCentre(face, side, bandM, ptPerM)
  return [c[0], c[1]]
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

/**
 * Two task lines lie on the same wall face: parallel, the same side, the faces within 5 cm of each other and
 * overlapping along the wall (used to stack activities that share a face in the 3D view).
 */
export function sameFace(a: Pick<TaskDrawingRow, 'points' | 'side'>, b: Pick<TaskDrawingRow, 'points' | 'side'>, ptPerM: number): boolean {
  if (a.points.length < 2 || b.points.length < 2) return false
  const [a0, a1] = [a.points[0], a.points[a.points.length - 1]]
  const [b0, b1] = [b.points[0], b.points[b.points.length - 1]]
  const La = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), Lb = Math.hypot(b1[0] - b0[0], b1[1] - b0[1])
  if (La < 1e-6 || Lb < 1e-6) return false
  const u: Vec2 = [(a1[0] - a0[0]) / La, (a1[1] - a0[1]) / La]
  const v: Vec2 = [(b1[0] - b0[0]) / Lb, (b1[1] - b0[1]) / Lb]
  const cross = u[0] * v[1] - u[1] * v[0]
  if (Math.abs(cross) > 0.05) return false
  // Normals of the band side, in sheet terms (b drawn the other way flips its side).
  const dir = u[0] * v[0] + u[1] * v[1] > 0 ? 1 : -1
  const sa = Math.sign(a.side || 0), sb = Math.sign(b.side || 0) * dir
  if (sa && sb && sa !== sb) return false
  const off = Math.abs((b0[0] - a0[0]) * u[1] - (b0[1] - a0[1]) * u[0])
  if (off > 0.05 * ptPerM) return false
  const t0 = (b0[0] - a0[0]) * u[0] + (b0[1] - a0[1]) * u[1]
  const t1 = (b1[0] - a0[0]) * u[0] + (b1[1] - a0[1]) * u[1]
  return Math.min(La, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1)) > 0.01 * ptPerM
}
