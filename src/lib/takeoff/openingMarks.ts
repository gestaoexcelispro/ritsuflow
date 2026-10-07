// Where to draw each opening of a wall on the sheet: its two ends on the wall's
// centreline, the wall direction there and the normal. Openings are stored as a centre
// distance (m) from the wall's first point plus a width, so this walks the polyline.
import type { ElementOpening, Vec2 } from './geometry'

export type OpeningMark = { kind: ElementOpening['kind']; a: Vec2; b: Vec2; u: Vec2; n: Vec2; widthPt: number; /** Index in the wall's openings (for its tag). */ index: number }

/** Point and direction at `d` sheet points along a polyline (clamped to its ends). */
export function pointAlong(pts: Vec2[], d: number): { p: Vec2; u: Vec2 } | null {
  let left = Math.max(0, d)
  let last: { p: Vec2; u: Vec2 } | null = null
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (len < 1e-9) continue
    const u: Vec2 = [(b[0] - a[0]) / len, (b[1] - a[1]) / len]
    if (left <= len) return { p: [a[0] + u[0] * left, a[1] + u[1] * left], u }
    left -= len
    last = { p: b, u }
  }
  return last
}

export function openingMarks(pts: Vec2[], openings: ElementOpening[] | undefined, ptPerM: number): OpeningMark[] {
  if (!openings?.length || !(ptPerM > 0) || pts.length < 2) return []
  const out: OpeningMark[] = []
  for (const [index, o] of openings.entries()) {
    const c = pointAlong(pts, o.off * ptPerM)
    if (!c) continue
    const half = (o.w * ptPerM) / 2
    const u = c.u
    out.push({
      kind: o.kind,
      a: [c.p[0] - u[0] * half, c.p[1] - u[1] * half],
      b: [c.p[0] + u[0] * half, c.p[1] + u[1] * half],
      u,
      n: [-u[1], u[0]],
      widthPt: half * 2,
      index,
    })
  }
  return out
}

/** Nearest point of a polyline to `p`: distance along it from the first point and how far `p` is. */
export function projectOnPolyline(pts: Vec2[], p: Vec2): { along: number; dist: number } | null {
  let best: { along: number; dist: number } | null = null
  let before = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i]
    const vx = b[0] - a[0], vy = b[1] - a[1]
    const len = Math.hypot(vx, vy)
    if (len < 1e-9) continue
    const t = Math.max(0, Math.min(len, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / len))
    const q: Vec2 = [a[0] + (vx / len) * t, a[1] + (vy / len) * t]
    const d = Math.hypot(p[0] - q[0], p[1] - q[1])
    if (!best || d < best.dist) best = { along: before + t, dist: d }
    before += len
  }
  return best
}

/**
 * Centre (m from the wall start) for an opening of width `w` placed where the user clicked:
 * the clicked point projected on the wall, kept inside the wall so the whole width fits.
 */
export function openingCentreAt(pts: Vec2[], click: Vec2, w: number, ptPerM: number): number | null {
  const pr = projectOnPolyline(pts, click)
  if (!pr || !(ptPerM > 0)) return null
  let L = 0
  for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  const lenM = L / ptPerM
  if (w > lenM) return null
  return Math.min(lenM - w / 2, Math.max(w / 2, pr.along / ptPerM))
}
