import type { TakeoffItem, Vec2 } from './geometry'

/** Selection box in sheet points (x0 ≤ x1, y0 ≤ y1). */
export type Box = { x0: number; y0: number; x1: number; y1: number }

const inBox = (p: Vec2, b: Box) => p[0] >= b.x0 && p[0] <= b.x1 && p[1] >= b.y0 && p[1] <= b.y1

/** Whether segment a→b touches the box (Liang–Barsky clipping). */
function segmentHitsBox(a: Vec2, b: Vec2, box: Box): boolean {
  if (inBox(a, box) || inBox(b, box)) return true
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const p = [-dx, dx, -dy, dy]
  const q = [a[0] - box.x0, box.x1 - a[0], a[1] - box.y0, box.y1 - a[1]]
  let t0 = 0
  let t1 = 1
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false
      continue
    }
    const r = q[i] / p[i]
    if (p[i] < 0) {
      if (r > t1) return false
      if (r > t0) t0 = r
    } else {
      if (r < t0) return false
      if (r < t1) t1 = r
    }
  }
  return true
}

function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/**
 * Ids of the elements a selection box picks, as in CAD:
 * - window (dragged left → right): only elements entirely inside the box;
 * - crossing (dragged right → left): also elements the box touches.
 */
export function boxSelect(items: TakeoffItem[], box: Box, crossing: boolean): string[] {
  const ids: string[] = []
  for (const item of items) {
    for (const shape of item.shapes) {
      if (!shape.id || !shape.pts.length) continue
      const pts = shape.pts
      if (!crossing) {
        if (pts.every(p => inBox(p, box))) ids.push(shape.id)
        continue
      }
      const closed = item.kind === 'area' && pts.length > 2
      let hit = pts.some(p => inBox(p, box))
      for (let i = 0; !hit && i < pts.length - 1; i++) hit = segmentHitsBox(pts[i], pts[i + 1], box)
      if (!hit && closed) hit = segmentHitsBox(pts[pts.length - 1], pts[0], box)
      // A small box drawn completely inside a slab/floor area still touches it.
      if (!hit && closed) hit = pointInPolygon([box.x0, box.y0], pts)
      if (hit) ids.push(shape.id)
    }
  }
  return ids
}
