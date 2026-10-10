// Click picking on the plan: what is drawn on top, and cycling through stacked areas.
import type { TakeoffItem, Vec2 } from './geometry'

const RANK: Record<string, number> = { area: 0, linear: 1, count: 2 }

function polyArea(pts: Vec2[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]
    s += x1 * y2 - x2 * y1
  }
  return Math.abs(s) / 2
}

function inside(p: Vec2, pts: Vec2[]): boolean {
  let hit = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}

/** Drawing order (later = on top): areas (largest first), then walls, then counts — so walls and points stay clickable over slabs, floors and ceilings. */
export function paintOrder<T extends Pick<TakeoffItem, 'kind' | 'shapes'>>(items: T[]): T[] {
  const size = (it: T) => (it.kind === 'area' ? it.shapes.reduce((s, sh) => s + polyArea(sh.pts), 0) : 0)
  return items
    .map((it, i) => ({ it, i, r: RANK[it.kind] ?? 1, a: size(it) }))
    .sort((x, y) => x.r - y.r || (x.r === 0 ? y.a - x.a : 0) || x.i - y.i)
    .map(x => x.it)
}

/** Area shape to select at a click: the topmost one; clicking again on the selected one moves to the one under it. */
export function areaAt(p: Vec2, items: Pick<TakeoffItem, 'kind' | 'shapes'>[], selectedId: string | null | undefined): string | null {
  const hits = paintOrder(items)
    .filter(it => it.kind === 'area')
    .flatMap(it => it.shapes.filter(sh => sh.id && sh.pts.length >= 3 && inside(p, sh.pts)).map(sh => sh.id!))
    .reverse()
  if (!hits.length) return null
  const i = selectedId ? hits.indexOf(selectedId) : -1
  return hits[(i + 1) % hits.length]
}
