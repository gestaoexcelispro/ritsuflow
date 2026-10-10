// Room detection on vector PDF linework: start from each room label printed on the
// sheet, flood-fill the free space around it (walls block), and turn the region into
// an outline. Door openings would let the fill leak into the next room, so gaps up to
// `gapM` are closed first (lines are thickened by gapM/2) and the region is grown back
// by the same amount afterwards. Pure TS, sheet points in, sheet points out.
import type { Vec2 } from '../geometry'
import { detectWalls, type VSeg } from './walls'
import { nameFromTexts, type SheetText } from '../zones'

export type RoomOptions = {
  ptPerM: number
  /** Grid cell size in metres (accuracy of the outline). */
  cellM?: number
  /** Openings narrower than this are treated as closed (doors). */
  gapM?: number
  /** Rooms smaller/larger than this are ignored. */
  minAreaM2?: number
  maxAreaM2?: number
  region?: { x0: number; y0: number; x1: number; y1: number } | null
  layers?: Set<string> | null
  /**
   * What limits a room. 'walls' (default): only wall linework (pairs of parallel faces,
   * heavy lines, window lines inside a wall), so grid axes, dimensions, furniture and
   * tag boxes don't cut rooms; falls back to every line when no walls are found.
   * 'all': every line on the allowed layers.
   */
  boundaries?: 'walls' | 'all'
  /** Also start a room in every enclosed empty space, not only at text labels (rooms from drawn walls). */
  autoSeeds?: boolean
}

export type DetectedRoom = { id: string; name: string; pts: Vec2[]; areaM2: number; seed: Vec2 }

const NUMERIC = /^[\s\d.,:;/×x+\-–()]*(m²|m2|m|cm|mm)?[\s\d.,]*$/i

/** Douglas–Peucker on an open polyline. */
function dp(pts: Vec2[], tol: number): Vec2[] {
  if (pts.length < 3) return pts
  const [x1, y1] = pts[0]
  const [x2, y2] = pts[pts.length - 1]
  const len = Math.hypot(x2 - x1, y2 - y1) || 1
  let best = 0
  let dmax = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((y2 - y1) * pts[i][0] - (x2 - x1) * pts[i][1] + x2 * y1 - y2 * x1) / len
    if (d > dmax) { dmax = d; best = i }
  }
  if (dmax <= tol) return [pts[0], pts[pts.length - 1]]
  const left = dp(pts.slice(0, best + 1), tol)
  return [...left.slice(0, -1), ...dp(pts.slice(best), tol)]
}

/** Douglas–Peucker on a closed ring: split at the point farthest from the first one. */
export function simplify(ring: Vec2[], tol: number): Vec2[] {
  if (ring.length < 4) return ring
  let far = 1
  let fd = -1
  for (let i = 1; i < ring.length; i++) {
    const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1])
    if (d > fd) { fd = d; far = i }
  }
  const a = dp(ring.slice(0, far + 1), tol)
  const b = dp([...ring.slice(far), ring[0]], tol)
  return [...a.slice(0, -1), ...b.slice(0, -1)]
}


type Line2 = { px: number; py: number; dx: number; dy: number }

/** Distance from a point to an infinite line through `a` with unit direction (dx, dy). */
const lineDist = (p: Vec2, l: Line2) => Math.abs((p[0] - l.px) * l.dy - (p[1] - l.py) * l.dx)

/**
 * Removes door notches: where the outline leaves a straight edge and comes back to the
 * same line within `maxSpan` (a door width), staying within `maxDepth` (a wall thickness).
 */
function removeNotches(ring: Vec2[], maxSpan: number, maxDepth: number, tol: number): Vec2[] {
  let pts = ring.slice()
  let changed = true
  while (changed && pts.length > 4) {
    changed = false
    const n = pts.length
    outer: for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n]
      const a = pts[i]
      const len = Math.hypot(a[0] - prev[0], a[1] - prev[1])
      if (len < 1e-9) continue
      const L: Line2 = { px: a[0], py: a[1], dx: (a[0] - prev[0]) / len, dy: (a[1] - prev[1]) / len }
      for (let m = 3; m <= 5 && m < n - 1; m++) {
        const b = pts[(i + m) % n]
        const after = pts[(i + m + 1) % n]
        if (lineDist(b, L) > tol || lineDist(after, L) > tol) continue
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > maxSpan) continue
        let ok = true
        for (let q = 1; q < m; q++) if (lineDist(pts[(i + q) % n], L) > maxDepth) { ok = false; break }
        if (!ok) continue
        const drop = new Set<number>()
        for (let q = 1; q < m; q++) drop.add((i + q) % n)
        pts = pts.filter((_, idx) => !drop.has(idx))
        changed = true
        break outer
      }
    }
  }
  return dropCollinear(pts, tol)
}

export function dropCollinear(pts: Vec2[], tol: number): Vec2[] {
  const out: Vec2[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[(i - 1 + pts.length) % pts.length], c = pts[i], q = pts[(i + 1) % pts.length]
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (len > 1e-9 && lineDist(c, { px: p[0], py: p[1], dx: (q[0] - p[0]) / len, dy: (q[1] - p[1]) / len }) <= tol) continue
    out.push(c)
  }
  return out
}

/** Moves each edge onto the nearest parallel drawing line (within `reach`), then re-intersects corners. */
export function snapEdges(ring: Vec2[], lines: VSeg[], reach: number): Vec2[] {
  const n = ring.length
  const edges: Line2[] = []
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n]
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    const e: Line2 = { px: a[0], py: a[1], dx: (b[0] - a[0]) / len, dy: (b[1] - a[1]) / len }
    const edgeLen = Math.hypot(b[0] - a[0], b[1] - a[1])
    // Group nearby parallel lines by offset and add up how much of the edge they cover.
    const cover = new Map<number, { off: number; len: number }>()
    for (const s of lines) {
      const sl = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])
      if (sl < 1e-9) continue
      const sx = (s.b[0] - s.a[0]) / sl, sy = (s.b[1] - s.a[1]) / sl
      if (Math.abs(sx * e.dy - sy * e.dx) > 0.035) continue // ~2°
      const off = (s.a[0] - e.px) * -e.dy + (s.a[1] - e.py) * e.dx
      if (Math.abs(off) > reach) continue
      const t0 = (s.a[0] - e.px) * e.dx + (s.a[1] - e.py) * e.dy
      const t1 = (s.b[0] - e.px) * e.dx + (s.b[1] - e.py) * e.dy
      const ov = Math.min(edgeLen, Math.max(t0, t1)) - Math.max(0, Math.min(t0, t1))
      if (ov <= 0) continue
      const key = Math.round(off * 2)
      const c = cover.get(key)
      if (c) c.len += ov
      else cover.set(key, { off, len: ov })
    }
    // Nearest line that covers at least half of the edge (door gaps break the inner face).
    let best: { off: number; d: number } | null = null
    for (const c of cover.values()) {
      if (c.len < edgeLen * 0.5) continue
      if (!best || Math.abs(c.off) < best.d) best = { off: c.off, d: Math.abs(c.off) }
    }
    if (best) { e.px += -e.dy * best.off; e.py += e.dx * best.off }
    edges.push(e)
  }
  const out: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const e1 = edges[(i - 1 + n) % n], e2 = edges[i]
    const cross = e1.dx * e2.dy - e1.dy * e2.dx
    if (Math.abs(cross) < 1e-6) { out.push([e2.px, e2.py]); continue }
    const t = ((e2.px - e1.px) * e2.dy - (e2.py - e1.py) * e2.dx) / cross
    out.push([e1.px + e1.dx * t, e1.py + e1.dy * t])
  }
  return out
}

/** Shortest distance between two segments (0 when they cross). */
function segDist(a1: Vec2, b1: Vec2, a2: Vec2, b2: Vec2): number {
  const cross = (o: Vec2, p: Vec2, q: Vec2) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0])
  const d1 = cross(a1, b1, a2), d2 = cross(a1, b1, b2), d3 = cross(a2, b2, a1), d4 = cross(a2, b2, b1)
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0
  const pt = (p: Vec2, a: Vec2, b: Vec2) => {
    const vx = b[0] - a[0], vy = b[1] - a[1]
    const l2 = vx * vx + vy * vy
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / l2)) : 0
    return Math.hypot(p[0] - a[0] - vx * t, p[1] - a[1] - vy * t)
  }
  return Math.min(pt(a1, a2, b2), pt(b1, a2, b2), pt(a2, a1, b1), pt(b2, a1, b1))
}

export type RoomBarriers = {
  /** Linework that blocks the fill (wall bands drawn solid, plus heavy and window lines). */
  block: VSeg[]
  /** Lines room edges may snap to (wall faces, heavy and window lines). */
  snap: VSeg[]
  wallCount: number
}

/**
 * Wall-only limits for room detection. Single thin lines (grid axes, dimension lines,
 * furniture, tag boxes, door swings) are left out, so they no longer cut rooms.
 * Returns null when the drawing has no recognisable walls.
 */
export function wallBarriers(lines: VSeg[], k: number, region: RoomOptions['region'], cell: number, doorM = 1.0): RoomBarriers | null {
  const m3 = 3 * k
  const box = region
    ? { x0: Math.min(region.x0, region.x1) - m3, y0: Math.min(region.y0, region.y1) - m3, x1: Math.max(region.x0, region.x1) + m3, y1: Math.max(region.y0, region.y1) + m3 }
    : null
  const found = detectWalls(lines, { ptPerM: k, region: box, minThickM: 0.05, maxThickM: 0.35, minLenM: 0.3 })
  type W = { a: Vec2; b: Vec2; dx: number; dy: number; len: number; th: number }
  const pieces: W[] = found.map(w => {
    const [a, b] = w.pts
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1
    return { a, b, dx: (b[0] - a[0]) / len, dy: (b[1] - a[1]) / len, len, th: w.thicknessM * k }
  })
  // Door leaves are drawn as thin rectangles (about 4–6 cm by a door width): not walls.
  const isLeaf = (w: W) => w.th <= 0.065 * k && w.len <= 1.3 * k
  const leaves = pieces.filter(isLeaf)
  const all = pieces.filter(w => !isLeaf(w))
  // Walls form one connected network. Small clusters that touch nothing else are tag
  // boxes, furniture or a grid axis passing a table — not walls.
  const comp = all.map((_, i) => i)
  const find = (i: number): number => (comp[i] === i ? i : (comp[i] = find(comp[i])))
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    if (segDist(all[i].a, all[i].b, all[j].a, all[j].b) <= (all[i].th + all[j].th) / 2 + 0.15 * k) comp[find(i)] = find(j)
  }
  const size = new Map<number, number>()
  all.forEach((w, i) => size.set(find(i), (size.get(find(i)) || 0) + w.len))
  const largest = Math.max(0, ...size.values())
  const walls = all.filter((_, i) => { const s = size.get(find(i)) || 0; return s >= 3 * k && s >= 0.15 * largest })
  if (walls.length < 2) return null

  const block: VSeg[] = []
  const snap: VSeg[] = []
  for (const w of walls) {
    const nx = -w.dy, ny = w.dx
    const at = (off: number): VSeg => ({ a: [w.a[0] + nx * off, w.a[1] + ny * off], b: [w.b[0] + nx * off, w.b[1] + ny * off] })
    // Solid band: parallel strokes across the thickness, closer than a grid cell.
    const step = Math.max(0.1, Math.min(cell * 0.5, w.th / 2))
    for (let off = -w.th / 2; off < w.th / 2; off += step) block.push(at(off))
    block.push(at(w.th / 2))
    snap.push(at(-w.th / 2), at(w.th / 2))
  }

  // Length-weighted median stroke width: lines clearly heavier than it are cut lines (walls, columns).
  const widths = lines.filter(s => s.width != null && Number.isFinite(s.width)).map(s => ({ w: s.width as number, l: Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]) }))
  widths.sort((p, q) => p.w - q.w)
  const total = widths.reduce((s, x) => s + x.l, 0)
  let median = 0
  for (let acc = 0, i = 0; i < widths.length; i++) { acc += widths[i].l; if (acc >= total / 2) { median = widths[i].w; break } }
  const heavyMin = Math.max(0.6, median * 1.8)

  for (const s of lines) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])
    if (len < 1e-9) continue
    const onLeaf = leaves.some(w => segDist(s.a, s.a, w.a, w.b) <= w.th / 2 + 0.02 * k && segDist(s.b, s.b, w.a, w.b) <= w.th / 2 + 0.02 * k)
    if (onLeaf) continue
    if ((s.width ?? 0) >= heavyMin && len >= 0.2 * k) { block.push(s); snap.push(s); continue }
    // Window (and glass) lines: parallel to a wall, inside its band, within 3 m of its ends.
    if (len > m3) continue
    const sx = (s.b[0] - s.a[0]) / len, sy = (s.b[1] - s.a[1]) / len
    for (const w of walls) {
      if (Math.abs(sx * w.dy - sy * w.dx) > 0.035) continue
      const off = (p: Vec2) => Math.abs((p[0] - w.a[0]) * -w.dy + (p[1] - w.a[1]) * w.dx)
      const along = (p: Vec2) => (p[0] - w.a[0]) * w.dx + (p[1] - w.a[1]) * w.dy
      const band = w.th / 2 + 0.03 * k
      if (off(s.a) > band || off(s.b) > band) continue
      const t0 = Math.min(along(s.a), along(s.b)), t1 = Math.max(along(s.a), along(s.b))
      if (t0 < -m3 || t1 > w.len + m3) continue
      block.push(s)
      snap.push(s)
      break
    }
  }
  /** True when point p (an end of wall w) runs into another wall crossing w's line. */
  const endsInto = (p: Vec2, w: (typeof walls)[number]) => walls.some(o => {
    if (o === w || Math.abs(w.dx * o.dy - w.dy * o.dx) < 0.5) return false
    return segDist(p, p, o.a, o.b) <= o.th / 2 + 0.05 * k
  })
  // Door openings: two pieces of the same wall line with a gap up to `doorM` get a band
  // across the gap, so the room stops at the wall line instead of bulging into the door.
  for (let i = 0; i < walls.length; i++) for (let j = 0; j < walls.length; j++) {
    if (i === j) continue
    const w = walls[i], o = walls[j]
    if (Math.abs(w.dx * o.dy - w.dy * o.dx) > 0.035) continue
    if ((o.a[0] - w.a[0]) * w.dx + (o.a[1] - w.a[1]) * w.dy < 0 && (o.b[0] - w.a[0]) * w.dx + (o.b[1] - w.a[1]) * w.dy < 0) continue
    const off = (p: Vec2) => (p[0] - w.a[0]) * -w.dy + (p[1] - w.a[1]) * w.dx
    const along = (p: Vec2) => (p[0] - w.a[0]) * w.dx + (p[1] - w.a[1]) * w.dy
    if (Math.abs(off(o.a)) > Math.max(w.th, o.th) / 2 || Math.abs(off(o.b)) > Math.max(w.th, o.th) / 2) continue
    // o must start after w ends (each gap is bridged once, from the piece before it).
    const os = Math.min(along(o.a), along(o.b))
    const gap = os - w.len
    if (gap <= 0.02 * k || gap > Math.max(doorM, 1.6) * k) continue
    // A corridor crossing looks the same, but there both pieces run into a cross wall
    // (T-junctions); door jambs are free ends.
    if (gap > doorM * k && endsInto(w.b, w) && endsInto(along(o.a) < along(o.b) ? o.a : o.b, o)) continue
    const th = Math.min(w.th, o.th)
    const nx = -w.dy, ny = w.dx
    const p0: Vec2 = [w.b[0], w.b[1]]
    const p1: Vec2 = [w.a[0] + w.dx * os, w.a[1] + w.dy * os]
    const step = Math.max(0.1, Math.min(cell * 0.5, th / 2))
    for (let d = -th / 2; d <= th / 2 + 1e-9; d += step) block.push({ a: [p0[0] + nx * d, p0[1] + ny * d], b: [p1[0] + nx * d, p1[1] + ny * d] })
    snap.push({ a: [p0[0] - nx * th / 2, p0[1] - ny * th / 2], b: [p1[0] - nx * th / 2, p1[1] - ny * th / 2] }, { a: [p0[0] + nx * th / 2, p0[1] + ny * th / 2], b: [p1[0] + nx * th / 2, p1[1] + ny * th / 2] })
  }
  return { block, snap, wallCount: walls.length }
}

export function detectRooms(segs: VSeg[], texts: SheetText[], opts: RoomOptions): DetectedRoom[] {
  const k = opts.ptPerM
  if (!(k > 0)) return []
  const cell = (opts.cellM ?? 0.05) * k
  const gapCells = Math.max(1, Math.round(((opts.gapM ?? 1.0) / 2) * k / cell))
  const minA = opts.minAreaM2 ?? 1
  const maxA = opts.maxAreaM2 ?? 400
  const r = opts.region
  const layered = segs.filter(s => !opts.layers || (s.layer && opts.layers.has(s.layer)))
  if (!layered.length) return []
  const limits = opts.boundaries === 'all' ? null : wallBarriers(layered, k, r, cell, opts.gapM ?? 1.0)
  const lines = limits ? limits.block : layered
  const snapLines = limits ? limits.snap : layered

  // Grid over the lines' extent (or the chosen box), with a margin.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  if (r) { x0 = Math.min(r.x0, r.x1); x1 = Math.max(r.x0, r.x1); y0 = Math.min(r.y0, r.y1); y1 = Math.max(r.y0, r.y1) }
  else for (const s of lines) { x0 = Math.min(x0, s.a[0], s.b[0]); x1 = Math.max(x1, s.a[0], s.b[0]); y0 = Math.min(y0, s.a[1], s.b[1]); y1 = Math.max(y1, s.a[1], s.b[1]) }
  x0 -= cell * 2; y0 -= cell * 2; x1 += cell * 2; y1 += cell * 2
  const W = Math.ceil((x1 - x0) / cell)
  const H = Math.ceil((y1 - y0) / cell)
  if (W <= 2 || H <= 2 || W * H > 6_000_000) return []
  const idx = (x: number, y: number) => y * W + x

  // 1. Rasterise lines (thin), then distance to the nearest line (chamfer 3-4).
  const wall = new Uint8Array(W * H)
  for (const s of lines) {
    const ax = (s.a[0] - x0) / cell, ay = (s.a[1] - y0) / cell, bx = (s.b[0] - x0) / cell, by = (s.b[1] - y0) / cell
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) * 2))
    for (let i = 0; i <= n; i++) {
      const x = Math.floor(ax + ((bx - ax) * i) / n)
      const y = Math.floor(ay + ((by - ay) * i) / n)
      if (x >= 0 && y >= 0 && x < W && y < H) wall[idx(x, y)] = 1
    }
  }
  const INF = 1 << 28
  const dist = new Int32Array(W * H)
  for (let i = 0; i < W * H; i++) dist[i] = wall[i] ? 0 : INF
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let d = dist[idx(x, y)]
    if (x > 0) d = Math.min(d, dist[idx(x - 1, y)] + 3)
    if (y > 0) d = Math.min(d, dist[idx(x, y - 1)] + 3)
    if (x > 0 && y > 0) d = Math.min(d, dist[idx(x - 1, y - 1)] + 4)
    if (x < W - 1 && y > 0) d = Math.min(d, dist[idx(x + 1, y - 1)] + 4)
    dist[idx(x, y)] = d
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    let d = dist[idx(x, y)]
    if (x < W - 1) d = Math.min(d, dist[idx(x + 1, y)] + 3)
    if (y < H - 1) d = Math.min(d, dist[idx(x, y + 1)] + 3)
    if (x < W - 1 && y < H - 1) d = Math.min(d, dist[idx(x + 1, y + 1)] + 4)
    if (x > 0 && y < H - 1) d = Math.min(d, dist[idx(x - 1, y + 1)] + 4)
    dist[idx(x, y)] = d
  }
  const blocked = (i: number) => dist[i] <= gapCells * 3

  // 2. Seeds: label texts inside the grid that aren't numbers/measurements.
  const OPEN = -2
  const owner = new Int32Array(W * H).fill(-1)
  const rooms: DetectedRoom[] = []
  const seeds: { x: number; y: number }[] = texts.filter(tx => tx.str.trim() && !NUMERIC.test(tx.str.trim()))
  if (opts.autoSeeds) {
    // A candidate every few cells in the free space; ones already inside a found room (or the
    // open outside) are skipped by the owner check below.
    const step = Math.max(2, gapCells)
    for (let gy = 1; gy < H - 1; gy += step) for (let gx = 1; gx < W - 1; gx += step) {
      if (!blocked(idx(gx, gy))) seeds.push({ x: x0 + (gx + 0.5) * cell, y: y0 + (gy + 0.5) * cell })
    }
  }
  for (const tx of seeds) {
    let sx = Math.floor((tx.x - x0) / cell)
    let sy = Math.floor((tx.y - y0) / cell)
    if (sx < 1 || sy < 1 || sx >= W - 1 || sy >= H - 1) continue
    if (r && !(tx.x >= Math.min(r.x0, r.x1) && tx.x <= Math.max(r.x0, r.x1) && tx.y >= Math.min(r.y0, r.y1) && tx.y <= Math.max(r.y0, r.y1))) continue
    // Labels sometimes sit on a hatch line: look for the nearest free cell (up to ~gap).
    if (blocked(idx(sx, sy))) {
      let found = false
      for (let rad = 1; rad <= gapCells * 2 && !found; rad++) {
        for (let dy = -rad; dy <= rad && !found; dy++) for (let dx = -rad; dx <= rad && !found; dx++) {
          const nx = sx + dx, ny = sy + dy
          if (nx > 0 && ny > 0 && nx < W - 1 && ny < H - 1 && !blocked(idx(nx, ny))) { sx = nx; sy = ny; found = true }
        }
      }
      if (!found) continue
    }
    if (owner[idx(sx, sy)] !== -1) continue // same room as an earlier label (or open space)

    // 3. Flood fill the free space.
    const id = rooms.length
    const stack = [idx(sx, sy)]
    const cells: number[] = []
    owner[idx(sx, sy)] = id
    let leaked = false
    while (stack.length) {
      const c = stack.pop()!
      cells.push(c)
      const x = c % W, y = (c - x) / W
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { leaked = true; break }
      for (const n of [c - 1, c + 1, c - W, c + W]) {
        if (owner[n] === OPEN) { leaked = true; break }
        if (owner[n] === -1 && !blocked(n)) { owner[n] = id; stack.push(n) }
      }
      if (leaked) break
      if (cells.length * (cell / k) ** 2 > maxA * 1.5) { leaked = true; break }
    }
    if (leaked) {
      // Everything this fill reached is open space: later fills that touch it leak too
      // (instead of being clipped by a half-finished fill).
      for (const c of cells) owner[c] = OPEN
      for (const c of stack) owner[c] = OPEN
      rooms.push({ id: `r${id}`, name: '', pts: [], areaM2: 0, seed: [tx.x, tx.y] })
      continue
    }

    // 4. Grow back by the closing radius (square growth keeps corners square; never onto a line).
    const mask = new Uint8Array(W * H)
    for (const c of cells) mask[c] = 1
    let frontier = cells
    for (let step = 0; step < gapCells; step++) {
      const next: number[] = []
      for (const c of frontier) {
        for (const n of [c - 1, c + 1, c - W, c + W, c - W - 1, c - W + 1, c + W - 1, c + W + 1]) {
          if (!mask[n] && !wall[n] && n > W && n < W * (H - 1)) { mask[n] = 1; next.push(n) }
        }
      }
      frontier = next
    }

    // 5. Outline: walk the outer boundary of the mask (cell edges), then simplify.
    const ring = traceOutline(mask, W, H)
    if (ring.length < 4) { rooms.push({ id: `r${id}`, name: '', pts: [], areaM2: 0, seed: [tx.x, tx.y] }); continue }
    let pts: Vec2[] = simplify(ring.map(([gx, gy]) => [x0 + gx * cell, y0 + gy * cell] as Vec2), cell * 1.2)
    pts = removeNotches(pts, (opts.gapM ?? 1.0) * k * 1.3, 0.45 * k, cell * 0.8)
    pts = dropCollinear(snapEdges(pts, snapLines, cell * 2.5), 0.5)
    let a = 0
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1] }
    const areaM2 = Math.abs(a) / 2 / (k * k)
    rooms.push({ id: `r${id}`, name: '', pts, areaM2, seed: [tx.x, tx.y] })
  }

  return rooms
    .filter(rm => rm.pts.length >= 3 && rm.areaM2 >= minA && rm.areaM2 <= maxA)
    .map(rm => ({ ...rm, name: nameFromTexts(rm.pts, texts) || '' }))
}

/** Outer boundary of the filled cells as grid-corner coordinates (Moore-style edge walk). */
export function traceOutline(mask: Uint8Array, W: number, H: number): [number, number][] {
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x] === 1
  // Start at the top-most, left-most filled cell; its top-left corner is on the outer boundary.
  let sx = -1, sy = -1
  for (let y = 0; y < H && sx < 0; y++) for (let x = 0; x < W; x++) if (on(x, y)) { sx = x; sy = y; break }
  if (sx < 0) return []
  // Walk corners keeping the filled cells on the right. Directions: 0 right, 1 down, 2 left, 3 up.
  const dx = [1, 0, -1, 0], dy = [0, 1, 0, -1]
  let x = sx, y = sy, d = 0
  const out: [number, number][] = []
  const limit = W * H * 4
  for (let n = 0; n < limit; n++) {
    out.push([x, y])
    // Cells around corner (x,y): TL(x-1,y-1) TR(x,y-1) BL(x-1,y) BR(x,y).
    // Try turning right, straight, left, back (relative to d), moving along cell edges.
    for (const turn of [1, 0, 3, 2]) {
      const nd = (d + turn) % 4
      // Moving along an edge in direction nd from corner (x,y): the filled cell must be on the right side.
      const cellRight = nd === 0 ? on(x, y) : nd === 1 ? on(x - 1, y) : nd === 2 ? on(x - 1, y - 1) : on(x, y - 1)
      const cellLeft = nd === 0 ? on(x, y - 1) : nd === 1 ? on(x, y) : nd === 2 ? on(x - 1, y) : on(x - 1, y - 1)
      if (cellRight && !cellLeft) { d = nd; x += dx[nd]; y += dy[nd]; break }
    }
    if (x === sx && y === sy) break
  }
  // Drop collinear corners.
  const res: [number, number][] = []
  for (let i = 0; i < out.length; i++) {
    const p = out[(i - 1 + out.length) % out.length], c = out[i], q = out[(i + 1) % out.length]
    if ((p[0] === c[0] && c[0] === q[0]) || (p[1] === c[1] && c[1] === q[1])) continue
    res.push(c)
  }
  return res
}
