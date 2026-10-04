// Splitting a wall (polyline) at a distance, ported from the prototype's splitShape().
import { dist, polyLen, type ElementOpening, type TakeoffShape, type Vec2 } from './geometry'

/** Point at distance d (sheet units) along a polyline, and the segment index it falls on. */
export function pointAt(pts: Vec2[], d: number): { i: number; P: Vec2 } {
  let acc = 0
  for (let i = 1; i < pts.length; i++) {
    const L = dist(pts[i - 1], pts[i])
    if (acc + L >= d - 1e-9 || i === pts.length - 1) {
      const t = L ? Math.max(0, Math.min(1, (d - acc) / L)) : 0
      return { i, P: [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t] }
    }
    acc += L
  }
  return { i: 1, P: [pts[0][0], pts[0][1]] }
}

export type SplitResult = {
  a: Pick<TakeoffShape, 'pts' | 'openings' | 'root'>
  b: Pick<TakeoffShape, 'pts' | 'openings' | 'root'>
  /** True when the cut passes through an opening; it stays on the side of its centre. */
  crossesOpening: boolean
}

/**
 * Splits a wall at `distanceM` metres from its start. Openings go to the piece that
 * holds their centre; offsets on the second piece are shifted. Both pieces keep the
 * original GlobalId as `root` so later IFC revisions can still be matched.
 * Returns null when the distance is not strictly inside the wall (1 cm margin).
 */
export function splitWall(shape: Pick<TakeoffShape, 'pts' | 'openings' | 'root' | 'guid'>, distanceM: number, ptPerM: number): SplitResult | null {
  const L = polyLen(shape.pts) / ptPerM
  if (!(distanceM > 0.01 && distanceM < L - 0.01)) return null
  const { i, P } = pointAt(shape.pts, distanceM * ptPerM)
  const A: Vec2[] = [...shape.pts.slice(0, i), P]
  const B: Vec2[] = [P, ...shape.pts.slice(i)]
  const ops: ElementOpening[] = shape.openings || []
  const crossesOpening = ops.some(o => o.off - o.w / 2 < distanceM - 1e-6 && o.off + o.w / 2 > distanceM + 1e-6)
  const root = shape.root || shape.guid || null
  return {
    a: { pts: A, openings: ops.filter(o => o.off < distanceM).map(o => ({ ...o })), root },
    b: { pts: B, openings: ops.filter(o => o.off >= distanceM).map(o => ({ ...o, off: o.off - distanceM })), root },
    crossesOpening,
  }
}
