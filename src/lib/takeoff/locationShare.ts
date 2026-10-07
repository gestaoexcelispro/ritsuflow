// Share of each takeoff item that falls in each location (zone), so quantities and materials can be
// reported per location. Walls: by length, a stretch on the edge between two rooms split between them;
// areas (floors, ceilings): by the part of each area inside each room, weighted by area; points: whole,
// where they sit. Whatever falls in no location goes to NONE.
import { polyArea, polyLen, type TakeoffItem, type Vec2 } from './geometry'
import { distToBoundary, pointInPolygon } from './zones'

export const NONE = '__none__'
export type ZoneLike = { id: string; points: Vec2[] }

type Acc = Map<string, number>
const add = (m: Acc, id: string, v: number) => m.set(id, (m.get(id) || 0) + v)

/** Fraction of one area shape inside each zone, by sampling it on a grid (≈ 120 × 120 at most). */
function areaShare(pts: Vec2[], zones: ZoneLike[], minStep: number): Acc {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]) }
  const step = Math.max((x1 - x0) / 120, (y1 - y0) / 120, minStep)
  const part: Acc = new Map()
  let n = 0
  for (let x = x0 + step / 2; x < x1; x += step) for (let y = y0 + step / 2; y < y1; y += step) {
    if (!pointInPolygon([x, y], pts)) continue
    n++
    const z = zones.find(z => pointInPolygon([x, y], z.points))
    add(part, z ? z.id : NONE, 1)
  }
  if (!n) return new Map([[NONE, 1]])
  for (const [id, c] of part) part.set(id, c / n)
  return part
}

/** item key → (zone id or NONE → fraction of the item, 0…1, summing to 1). */
export function itemShareByZone(items: TakeoffItem[], zones: ZoneLike[], ptPerM: number, edgeM = 0.25): Map<string, Map<string, number>> {
  const k = ptPerM > 0 ? ptPerM : 1
  const zs = zones.filter(z => z.points.length >= 3)
  const out = new Map<string, Map<string, number>>()
  for (const it of items) {
    const acc: Acc = new Map()
    let total = 0
    for (const sh of it.shapes) {
      const pts = sh.pts
      if (it.kind === 'count') {
        if (!pts[0]) continue
        const z = zs.find(z => pointInPolygon(pts[0], z.points))
        add(acc, z ? z.id : NONE, 1)
        total += 1
      } else if (it.kind === 'area') {
        if (pts.length < 3) continue
        const w = polyArea(pts)
        for (const [id, f] of areaShare(pts, zs, 0.05 * k)) add(acc, id, f * w)
        total += w
      } else {
        // Walls: walk each stretch; a sample on the edge of two rooms (within edgeM) is split between them.
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i]
          const len = polyLen([a, b])
          const steps = Math.max(1, Math.ceil(len / (0.05 * k)))
          const piece = len / steps
          for (let s = 0; s < steps; s++) {
            const t = (s + 0.5) / steps
            const p: Vec2 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
            const near = zs.filter(z => pointInPolygon(p, z.points) || distToBoundary(p, z.points) <= edgeM * k)
            if (!near.length) add(acc, NONE, piece)
            else for (const z of near) add(acc, z.id, piece / near.length)
            total += piece
          }
        }
      }
    }
    if (!(total > 0)) continue
    const m = new Map<string, number>()
    for (const [id, v] of acc) if (v > 0) m.set(id, v / total)
    out.set(it.key, m)
  }
  return out
}
