// Rooms enclosed by the walls drawn in the takeoff (not the PDF linework): each wall
// centreline becomes its two faces (± half the thickness, stretched at the ends so corners
// and T-junctions close), and the room finder runs on those faces. Doors are data on the
// wall, so the wall line stays continuous and rooms come out closed.
import type { Vec2 } from '../geometry'
import type { SheetText } from '../zones'
import { detectRooms, dropCollinear, simplify, snapEdges, traceOutline, type DetectedRoom } from './rooms'
import type { VSeg } from './walls'

export type DrawnWall = { pts: Vec2[]; thicknessM: number | null }

export function wallFaces(walls: DrawnWall[], ptPerM: number): VSeg[] {
  const segs: VSeg[] = []
  for (const w of walls) {
    const half = (Math.max(w.thicknessM ?? 0.1, 0.02) * ptPerM) / 2
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const a = w.pts[i], b = w.pts[i + 1]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 1e-6) continue
      const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len
      const nx = -uy * half, ny = ux * half
      const ea: Vec2 = [a[0] - ux * half, a[1] - uy * half]
      const eb: Vec2 = [b[0] + ux * half, b[1] + uy * half]
      segs.push({ a: [ea[0] + nx, ea[1] + ny], b: [eb[0] + nx, eb[1] + ny], layer: 'walls' })
      segs.push({ a: [ea[0] - nx, ea[1] - ny], b: [eb[0] - nx, eb[1] - ny], layer: 'walls' })
    }
  }
  return segs
}

export function roomsFromWalls(walls: DrawnWall[], ptPerM: number, texts: SheetText[] = []): DetectedRoom[] {
  if (!(ptPerM > 0) || !walls.length) return []
  return detectRooms(wallFaces(walls, ptPerM), texts, { ptPerM, boundaries: 'all', gapM: 0.3, minAreaM2: 1, maxAreaM2: 5000, autoSeeds: true })
}

/**
 * Outer outline of the building (outer face of the outer walls), for a slab-on-grade (radier):
 * the drawn walls are painted on a grid at their real thickness, the outside is flood-filled
 * from the border, and the rest (rooms + walls) is traced. Null when nothing closes.
 */
export function footprintFromWalls(walls: DrawnWall[], ptPerM: number, cellM = 0.05): Vec2[] | null {
  if (!(ptPerM > 0) || !walls.length) return null
  const cell = cellM * ptPerM
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, tMax = 0
  for (const w of walls) {
    tMax = Math.max(tMax, (w.thicknessM ?? 0.1) * ptPerM)
    for (const p of w.pts) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]) }
  }
  const pad = tMax + cell * 3
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad
  const W = Math.ceil((x1 - x0) / cell), H = Math.ceil((y1 - y0) / cell)
  if (W < 3 || H < 3 || W * H > 8_000_000) return null
  const wall = new Uint8Array(W * H)
  for (const w of walls) {
    const half = (Math.max(w.thicknessM ?? 0.1, 0.02) * ptPerM) / 2 + cell * 0.5
    for (let i = 0; i + 1 < w.pts.length; i++) {
      const a = w.pts[i], b = w.pts[i + 1]
      const len = Math.hypot(b[0] - a[0], b[1] - a[1])
      if (len < 1e-6) continue
      const ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len
      const gx0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - half - x0) / cell)), gx1 = Math.min(W - 1, Math.ceil((Math.max(a[0], b[0]) + half - x0) / cell))
      const gy0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - half - y0) / cell)), gy1 = Math.min(H - 1, Math.ceil((Math.max(a[1], b[1]) + half - y0) / cell))
      for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
        const px = x0 + (gx + 0.5) * cell - a[0], py = y0 + (gy + 0.5) * cell - a[1]
        const along = px * ux + py * uy
        if (along < -half || along > len + half) continue
        if (Math.abs(px * -uy + py * ux) <= half) wall[gy * W + gx] = 1
      }
    }
  }
  // Outside: flood from the border through free cells.
  const outside = new Uint8Array(W * H)
  const stack: number[] = []
  const push = (i: number) => { if (!outside[i] && !wall[i]) { outside[i] = 1; stack.push(i) } }
  for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x) }
  for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1) }
  while (stack.length) {
    const c = stack.pop()!
    const x = c % W
    if (x > 0) push(c - 1)
    if (x < W - 1) push(c + 1)
    if (c >= W) push(c - W)
    if (c < W * (H - 1)) push(c + W)
  }
  const mask = new Uint8Array(W * H)
  let inner = 0
  for (let i = 0; i < W * H; i++) if (!outside[i]) { mask[i] = 1; if (!wall[i]) inner++ }
  if (!inner) return null // walls alone, nothing enclosed
  const ring = traceOutline(mask, W, H)
  if (ring.length < 4) return null
  const rough = dropCollinear(simplify(ring.map(([gx, gy]) => [x0 + gx * cell, y0 + gy * cell] as Vec2), cell * 1.2), cell * 0.5)
  // The grid is accurate to a cell: put each edge back on the real outer face of its wall.
  const pts = dropCollinear(snapEdges(rough, wallFaces(walls, ptPerM), cell * 1.5), 0.5)
  return pts.length >= 3 ? pts : null
}
