// Drawing a wall by one of its faces: the user picks two points on a face and then clicks
// the side the wall body goes. The stored element is the centreline (face offset by half
// the thickness), and its ends are joined to neighbouring walls so corners meet cleanly.
// Everything in sheet points.
import type { Vec2 } from './geometry'

/** +1 if `p` is to the left of a→b (sheet coordinates), −1 if to the right, 0 on the line. */
export function sideOf(a: Vec2, b: Vec2, p: Vec2): number {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
  return Math.sign(cross)
}

/** Centreline of a wall whose face is a→b and whose body lies on the side of `towards`. */
export function centrelineFromFace(a: Vec2, b: Vec2, towards: Vec2, thickness: number): [Vec2, Vec2] {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  if (len < 1e-9 || !(thickness > 0)) return [a, b]
  const s = sideOf(a, b, towards) || 1
  const nx = (-(b[1] - a[1]) / len) * s
  const ny = ((b[0] - a[0]) / len) * s
  const h = thickness / 2
  return [[a[0] + nx * h, a[1] + ny * h], [b[0] + nx * h, b[1] + ny * h]]
}

/** Outline of the wall body (both faces) for previews. */
export function wallBand(a: Vec2, b: Vec2, towards: Vec2, thickness: number): Vec2[] {
  const [c0, c1] = centrelineFromFace(a, b, towards, thickness)
  const ox = c0[0] - a[0], oy = c0[1] - a[1]
  return [a, b, [b[0] + 2 * ox, b[1] + 2 * oy], [a[0] + 2 * ox, a[1] + 2 * oy]]
}

export type NeighbourWall = { id: string; pts: Vec2[]; thickness: number }

function lineIntersection(p: Vec2, r: Vec2, q: Vec2, s: Vec2): { t: number; u: number } | null {
  const den = r[0] * s[1] - r[1] * s[0]
  if (Math.abs(den) < 1e-9) return null
  const qp: Vec2 = [q[0] - p[0], q[1] - p[1]]
  return { t: (qp[0] * s[1] - qp[1] * s[0]) / den, u: (qp[0] * r[1] - qp[1] * r[0]) / den }
}

/**
 * Joins the new centreline's ends to neighbouring wall centrelines:
 * - each end moves to where its line meets a neighbour (corner or T), if that point is
 *   within reach (about a wall thickness) of the end;
 * - at a corner (the meeting point is also near the neighbour's end), the neighbour's end
 *   moves there too, so neither wall overlaps the other.
 * Returns the adjusted centreline and the neighbour updates to save.
 */
export function joinToNeighbours(seg: [Vec2, Vec2], thickness: number, neighbours: NeighbourWall[]): { seg: [Vec2, Vec2]; updates: { id: string; pts: Vec2[] }[] } {
  const out: [Vec2, Vec2] = [[seg[0][0], seg[0][1]], [seg[1][0], seg[1][1]]]
  const updates = new Map<string, Vec2[]>()
  const dir: Vec2 = [seg[1][0] - seg[0][0], seg[1][1] - seg[0][1]]
  const len = Math.hypot(dir[0], dir[1])
  if (len < 1e-9) return { seg: out, updates: [] }

  for (const end of [0, 1] as const) {
    const e = seg[end]
    let best: { point: Vec2; dist: number; id: string; pts: Vec2[]; idx: number; moveNeighbourEnd: number | null } | null = null
    for (const nb of neighbours) {
      const pts = updates.get(nb.id) || nb.pts
      const reach = Math.max(thickness, nb.thickness) * 1.05 + 1
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i]
        const s: Vec2 = [b[0] - a[0], b[1] - a[1]]
        const segLen = Math.hypot(s[0], s[1])
        if (segLen < 1e-9) continue
        // Skip nearly parallel walls (no corner to make).
        if (Math.abs(dir[0] * s[1] - dir[1] * s[0]) / (len * segLen) < 0.2) continue
        const hit = lineIntersection(seg[0], dir, a, s)
        if (!hit) continue
        const point: Vec2 = [seg[0][0] + dir[0] * hit.t, seg[0][1] + dir[1] * hit.t]
        const d = Math.hypot(point[0] - e[0], point[1] - e[1])
        if (d > reach) continue
        // The meeting point must lie on the neighbour, or just past one of its ends.
        const uLen = hit.u * segLen
        if (uLen < -reach || uLen > segLen + reach) continue
        let moveNeighbourEnd: number | null = null
        if (i === 1 && uLen <= reach) moveNeighbourEnd = 0
        else if (i === pts.length - 1 && uLen >= segLen - reach) moveNeighbourEnd = pts.length - 1
        if (!best || d < best.dist) best = { point, dist: d, id: nb.id, pts, idx: i, moveNeighbourEnd }
      }
    }
    if (best) {
      out[end] = best.point
      if (best.moveNeighbourEnd != null) {
        const pts = best.pts.map(p => [p[0], p[1]] as Vec2)
        pts[best.moveNeighbourEnd] = [best.point[0], best.point[1]]
        updates.set(best.id, pts)
      }
    }
  }
  return { seg: out, updates: [...updates.entries()].map(([id, pts]) => ({ id, pts })) }
}
