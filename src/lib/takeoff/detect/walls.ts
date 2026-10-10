// Wall detection on vector PDF linework.
// A wall in a plan is usually drawn as two parallel lines (its faces). We look for
// pairs of parallel lines whose distance is a plausible wall thickness and whose
// extents overlap, turn each pair into a centreline with that thickness, join pieces
// on the same line, and extend ends into corners and T-junctions.
// Everything is in sheet points (PDF points, y down); ptPerM converts to metres.
import type { Vec2 } from '../geometry'

export type VSeg = { a: Vec2; b: Vec2; layer?: string | null; width?: number }

export type DetectOptions = {
  ptPerM: number
  minThickM?: number
  maxThickM?: number
  minLenM?: number
  angleTolDeg?: number
  /** Only segments whose midpoint is inside this box (sheet points). */
  region?: { x0: number; y0: number; x1: number; y1: number } | null
  /** Only segments on these CAD layers (null = all). Segments without a layer pass when `keepUnlayered`. */
  layers?: Set<string> | null
  keepUnlayered?: boolean
  /**
   * Continue a wall through door and window openings up to this width (m), so it isn't
   * cut into pieces; door leaves (thin short rectangles) are dropped. 0 = keep the cuts.
   * A gap where both sides run into a cross wall (a corridor crossing) is never bridged.
   */
  bridgeOpeningsM?: number
}

/** An opening found in a detected wall: centre measured from the wall's first point. */
export type DetectedOpening = { kind: 'door' | 'window'; offM: number; widthM: number }

export type DetectedWall = { id: string; pts: [Vec2, Vec2]; thicknessM: number; lengthM: number; layer: string | null; openings: DetectedOpening[] }

type Line = { th: number; dx: number; dy: number; c: number; t0: number; t1: number; layer: string | null }
type Cand = { th: number; dx: number; dy: number; c: number; t0: number; t1: number; thick: number; i: number; j: number; sideI: number; sideJ: number; layer: string | null }

const DEG = Math.PI / 180

/** Layer names that are almost never walls (dimensions, text, hatches, title blocks…), PT and EN. */
const NON_WALL_LAYER = /(cota|dim|text|texto|anot|annot|hach|hatch|title|t[íi]tulo|margem|margin|border|carimbo|grid|eixo|axis|furn|mobili|equip|pontilh|dash|symbol|s[íi]mbolo|tag|nota|note|viewport|defpoints)/i

export function defaultLayerExcluded(name: string): boolean {
  return NON_WALL_LAYER.test(name)
}

/** Segment count per CAD layer, most used first. */
export function layerStats(segs: VSeg[]): { name: string; count: number }[] {
  const m = new Map<string, number>()
  for (const s of segs) if (s.layer) m.set(s.layer, (m.get(s.layer) || 0) + 1)
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function toLine(s: VSeg, angleTol: number): Line | null {
  const vx = s.b[0] - s.a[0]
  const vy = s.b[1] - s.a[1]
  if (Math.hypot(vx, vy) < 1e-6) return null
  let th = Math.atan2(vy, vx)
  if (th < 0) th += Math.PI
  if (th >= Math.PI - angleTol) th -= Math.PI // near-horizontal lines share one bucket
  const dx = Math.cos(th)
  const dy = Math.sin(th)
  const c = -dy * s.a[0] + dx * s.a[1]
  const ta = dx * s.a[0] + dy * s.a[1]
  const tb = dx * s.b[0] + dy * s.b[1]
  return { th, dx, dy, c, t0: Math.min(ta, tb), t1: Math.max(ta, tb), layer: s.layer ?? null }
}

const pointOf = (dx: number, dy: number, c: number, t: number): Vec2 => [dx * t - dy * c, dy * t + dx * c]

/** Joins collinear pieces of the same line (CAD splits lines at every crossing). */
function mergeCollinear(lines: Line[], angleTol: number, offTol: number, gapTol: number): Line[] {
  const sorted = [...lines].sort((p, q) => p.th - q.th || p.c - q.c || p.t0 - q.t0)
  const out: Line[] = []
  for (const l of sorted) {
    let merged = false
    for (let k = out.length - 1; k >= 0 && k >= out.length - 30; k--) {
      const o = out[k]
      if (Math.abs(o.th - l.th) > angleTol) break
      if (Math.abs(o.c - l.c) <= offTol && l.t0 <= o.t1 + gapTol && l.t1 >= o.t0 - gapTol) {
        o.t0 = Math.min(o.t0, l.t0)
        o.t1 = Math.max(o.t1, l.t1)
        merged = true
        break
      }
    }
    if (!merged) out.push({ ...l })
  }
  return out
}

export function detectWalls(segs: VSeg[], opts: DetectOptions): DetectedWall[] {
  const k = opts.ptPerM
  if (!(k > 0)) return []
  const minT = (opts.minThickM ?? 0.05) * k
  const maxT = (opts.maxThickM ?? 0.35) * k
  const minLen = (opts.minLenM ?? 0.3) * k
  const tol = (opts.angleTolDeg ?? 1) * DEG
  const r = opts.region
  const inRegion = (p: Vec2) => !r || (p[0] >= Math.min(r.x0, r.x1) && p[0] <= Math.max(r.x0, r.x1) && p[1] >= Math.min(r.y0, r.y1) && p[1] <= Math.max(r.y0, r.y1))

  // 1. Filter and normalise.
  const raw: Line[] = []
  for (const s of segs) {
    if (opts.layers) {
      if (s.layer ? !opts.layers.has(s.layer) : !opts.keepUnlayered) continue
    }
    if (!inRegion([(s.a[0] + s.b[0]) / 2, (s.a[1] + s.b[1]) / 2])) continue
    const l = toLine(s, tol)
    if (l) raw.push(l)
  }
  const lines = mergeCollinear(raw, tol, 0.3, 0.6).filter(l => l.t1 - l.t0 >= minLen * 0.5)

  // 2. Pairs of parallel lines at a wall-like distance with overlapping extents.
  const order = lines.map((_, i) => i).sort((a, b) => lines[a].th - lines[b].th)
  const cands: Cand[] = []
  const pairWith = (i: number, j: number) => {
    const A = lines[i]
    const B = lines[j]
    let dth = Math.abs(A.th - B.th)
    dth = Math.min(dth, Math.PI - dth)
    if (dth > tol) return
    // Express B in A's frame.
    const cB = -A.dy * (A.dx * B.t0 - B.dy * B.c) + A.dx * (B.dy * B.t0 + B.dx * B.c)
    const gap = Math.abs(cB - A.c)
    if (gap < minT || gap > maxT) return
    const tb0 = A.dx * (B.dx * B.t0 - B.dy * B.c) + A.dy * (B.dy * B.t0 + B.dx * B.c)
    const tb1 = A.dx * (B.dx * B.t1 - B.dy * B.c) + A.dy * (B.dy * B.t1 + B.dx * B.c)
    const t0 = Math.max(A.t0, Math.min(tb0, tb1))
    const t1 = Math.min(A.t1, Math.max(tb0, tb1))
    if (t1 - t0 < minLen) return
    // Which side of each line its partner is on, in that line's own frame.
    const sideI = Math.sign(cB - A.c)
    const sideJ = A.dx * B.dx + A.dy * B.dy > 0 ? -sideI : sideI
    cands.push({ th: A.th, dx: A.dx, dy: A.dy, c: (A.c + cB) / 2, t0, t1, thick: gap, i, j, sideI, sideJ, layer: A.layer || B.layer })
  }
  for (let a = 0; a < order.length; a++) {
    for (let b = a + 1; b < order.length; b++) {
      if (lines[order[b]].th - lines[order[a]].th > tol) break
      pairWith(order[a], order[b])
    }
  }
  // Wrap-around: lines near 0 and near π are parallel too.
  for (let a = 0; a < order.length && lines[order[a]].th < tol; a++) {
    for (let b = order.length - 1; b > a && lines[order[b]].th > Math.PI - 2 * tol; b--) pairWith(order[a], order[b])
  }

  // 3. Drop repetitive patterns (stairs, hatching): a line with partners on both sides at the same spacing.
  const partners = new Map<number, { side: number; gap: number }[]>()
  const note = (idx: number, side: number, gap: number) => {
    const list = partners.get(idx)
    if (list) list.push({ side, gap })
    else partners.set(idx, [{ side, gap }])
  }
  for (const cnd of cands) {
    note(cnd.i, cnd.sideI, cnd.thick)
    note(cnd.j, cnd.sideJ, cnd.thick)
  }
  const periodic = (idx: number) => {
    const p = partners.get(idx) || []
    return p.some(x => p.some(y => x.side !== y.side && Math.abs(x.gap - y.gap) <= 0.1 * Math.max(x.gap, y.gap)))
  }
  const kept = cands.filter(cnd => !periodic(cnd.i) && !periodic(cnd.j))

  // 4. Narrowest first; skip candidates that mostly overlap an accepted one.
  kept.sort((p, q) => p.thick - q.thick || (q.t1 - q.t0) - (p.t1 - p.t0))
  const chosen: Cand[] = []
  for (const cnd of kept) {
    const clash = chosen.some(o => {
      let dth = Math.abs(o.th - cnd.th)
      dth = Math.min(dth, Math.PI - dth)
      if (dth > tol) return false
      const bandsOverlap = Math.abs(o.c - cnd.c) < (o.thick + cnd.thick) / 2 - 0.5
      if (!bandsOverlap) return false
      // Only skip a candidate that an accepted one already covers for most of ITS length:
      // a short window (glass line inside the wall) must not hide the whole wall around it.
      const ov = Math.min(o.t1, cnd.t1) - Math.max(o.t0, cnd.t0)
      return ov > 0.5 * (cnd.t1 - cnd.t0)
    })
    if (!clash) chosen.push(cnd)
  }
  /** Openings found along the way, in line coordinates; attached to the final walls at the end. */
  type Found = { kind: 'door' | 'window'; dx: number; dy: number; c: number; t0: number; t1: number }
  const found: Found[] = []
  // A wider wall that runs over narrower pieces inside its band (windows drawn with
  // glass lines) replaces them.
  for (let a = chosen.length - 1; a >= 0; a--) {
    const n = chosen[a]
    const host = chosen.some(o => {
      if (o === n || o.thick <= n.thick) return false
      let dth = Math.abs(o.th - n.th)
      dth = Math.min(dth, Math.PI - dth)
      if (dth > tol) return false
      if (Math.abs(o.c - n.c) + n.thick / 2 > o.thick / 2 + 1) return false
      return Math.min(o.t1, n.t1) - Math.max(o.t0, n.t0) >= 0.9 * (n.t1 - n.t0)
    })
    if (host) { chosen.splice(a, 1); found.push({ kind: 'window', dx: n.dx, dy: n.dy, c: n.c, t0: n.t0, t1: n.t1 }) }
  }

  // 5. Join collinear pieces of the same wall (gaps where other walls cross, up to a wall thickness).
  chosen.sort((p, q) => p.th - q.th || p.c - q.c || p.t0 - q.t0)
  const walls: Cand[] = []
  for (const cnd of chosen) {
    const prev = walls.find(o => {
      let dth = Math.abs(o.th - cnd.th)
      dth = Math.min(dth, Math.PI - dth)
      return dth <= tol &&
        Math.abs(o.c - cnd.c) <= Math.max(1, 0.25 * Math.min(o.thick, cnd.thick)) &&
        Math.abs(o.thick - cnd.thick) <= Math.max(0.01 * k, 0.2 * Math.min(o.thick, cnd.thick)) &&
        cnd.t0 <= o.t1 + maxT + 2 && cnd.t1 >= o.t0 - maxT - 2
    })
    if (prev) {
      const len0 = prev.t1 - prev.t0
      const len1 = cnd.t1 - cnd.t0
      prev.c = (prev.c * len0 + cnd.c * len1) / (len0 + len1)
      prev.thick = (prev.thick * len0 + cnd.thick * len1) / (len0 + len1)
      prev.t0 = Math.min(prev.t0, cnd.t0)
      prev.t1 = Math.max(prev.t1, cnd.t1)
    } else walls.push({ ...cnd })
  }

  // 6. Extend ends into corners and T-junctions (faces stop at the other wall's face).
  for (const w of walls) {
    for (const end of [0, 1] as const) {
      const tEnd = end === 0 ? w.t0 : w.t1
      const outward = end === 0 ? -1 : 1
      let best: number | null = null
      for (const o of walls) {
        if (o === w) continue
        const cross = w.dx * o.dy - w.dy * o.dx
        if (Math.abs(cross) < Math.sin(30 * DEG)) continue
        // Intersection of the two centrelines, as a parameter along w.
        const pw = pointOf(w.dx, w.dy, w.c, tEnd)
        const po = pointOf(o.dx, o.dy, o.c, o.t0)
        const s = ((po[0] - pw[0]) * o.dy - (po[1] - pw[1]) * o.dx) / cross
        const reach = s * outward
        if (reach < -o.thick * 0.75 || reach > o.thick * 0.75 + 2) continue
        const hit: Vec2 = [pw[0] + w.dx * s, pw[1] + w.dy * s]
        const to = o.dx * hit[0] + o.dy * hit[1]
        if (to < o.t0 - w.thick || to > o.t1 + w.thick) continue
        if (best == null || Math.abs(s) < Math.abs(best)) best = s
      }
      if (best != null) {
        if (end === 0) w.t0 += best
        else w.t1 += best
      }
    }
  }

  // 7. Doors and windows: one wall through the opening instead of two pieces.
  const bridge = (opts.bridgeOpeningsM ?? 1.6) * k
  let result = walls
  if (bridge > 0) {
    const isLeaf = (w: Cand) => w.thick <= 0.065 * k && w.t1 - w.t0 <= 1.3 * k
    const solid = walls.filter(w => !isLeaf(w))
    const distToWall = (p: Vec2, o: Cand) => {
      const t = Math.max(o.t0, Math.min(o.t1, o.dx * p[0] + o.dy * p[1]))
      const q = pointOf(o.dx, o.dy, o.c, t)
      return Math.hypot(p[0] - q[0], p[1] - q[1])
    }
    /** An end of `w` that runs into a wall crossing it (T-junction or corner). */
    const endsInto = (p: Vec2, w: Cand) => solid.some(o => o !== w && Math.abs(w.dx * o.dy - w.dy * o.dx) >= 0.5 && distToWall(p, o) <= o.thick / 2 + 0.05 * k)
    const sameLine = (o: Cand, w: Cand) => {
      let dth = Math.abs(o.th - w.th)
      dth = Math.min(dth, Math.PI - dth)
      return dth <= tol &&
        Math.abs(o.c - w.c) <= Math.max(1, 0.25 * Math.min(o.thick, w.thick)) &&
        Math.abs(o.thick - w.thick) <= Math.max(0.01 * k, 0.2 * Math.min(o.thick, w.thick))
    }
    const sorted = [...solid].sort((p, q) => p.th - q.th || p.c - q.c || p.t0 - q.t0)
    const merged: Cand[] = []
    for (const w of sorted) {
      // Pieces can arrive in either order along the line (angles of ±0 sort apart), so
      // check the gap on whichever side w lies.
      const prev = merged.find(o => {
        if (!sameLine(o, w)) return false
        const after = w.t0 >= o.t0
        const gap = after ? w.t0 - o.t1 : o.t0 - w.t1
        if (gap > bridge) return false
        if (gap <= 0.02 * k) return true
        const [left, right] = after ? [o, w] : [w, o]
        return !(endsInto(pointOf(left.dx, left.dy, left.c, left.t1), left) && endsInto(pointOf(right.dx, right.dy, right.c, right.t0), right))
      })
      if (prev) {
        const after = w.t0 >= prev.t0
        const g0 = after ? prev.t1 : w.t1
        const g1 = after ? w.t0 : prev.t0
        if (g1 - g0 > 0.02 * k) {
          // Lines along the wall inside the gap (glass, sill) make it a window; otherwise a door.
          const c = (prev.c + w.c) / 2
          const band = Math.max(prev.thick, w.thick) / 2 + 1
          const glazed = lines.some(l => {
            let dth = Math.abs(l.th - w.th)
            dth = Math.min(dth, Math.PI - dth)
            if (dth > tol || Math.abs(l.c - c) > band) return false
            return Math.min(l.t1, g1) - Math.max(l.t0, g0) >= 0.5 * (g1 - g0)
          })
          found.push({ kind: glazed ? 'window' : 'door', dx: w.dx, dy: w.dy, c, t0: g0, t1: g1 })
        }
        const len0 = prev.t1 - prev.t0
        const len1 = w.t1 - w.t0
        prev.thick = (prev.thick * len0 + w.thick * len1) / (len0 + len1)
        prev.t0 = Math.min(prev.t0, w.t0)
        prev.t1 = Math.max(prev.t1, w.t1)
      } else merged.push({ ...w })
    }
    // Narrower pieces left inside a wall's band after joining are windows in it.
    result = merged.filter(n => {
      const host = merged.find(o => {
        if (o === n || o.thick <= n.thick) return false
        let dth = Math.abs(o.th - n.th)
        dth = Math.min(dth, Math.PI - dth)
        if (dth > tol || Math.abs(o.c - n.c) + n.thick / 2 > o.thick / 2 + 1) return false
        return Math.min(o.t1, n.t1) - Math.max(o.t0, n.t0) >= 0.9 * (n.t1 - n.t0)
      })
      if (host) found.push({ kind: 'window', dx: n.dx, dy: n.dy, c: n.c, t0: n.t0, t1: n.t1 })
      return !host
    })
  }

  /** Openings that fall inside a final wall, as centre/width along it (windows win over doors). */
  const openingsOf = (w: Cand): DetectedOpening[] => {
    const ranges: { kind: 'door' | 'window'; t0: number; t1: number }[] = []
    for (const f of found) {
      if (Math.abs(w.dx * f.dy - w.dy * f.dx) > Math.sin(tol)) continue
      const mid = pointOf(f.dx, f.dy, f.c, (f.t0 + f.t1) / 2)
      if (Math.abs(-w.dy * mid[0] + w.dx * mid[1] - w.c) > w.thick / 2 + 1) continue
      const a = pointOf(f.dx, f.dy, f.c, f.t0), b = pointOf(f.dx, f.dy, f.c, f.t1)
      const ta = w.dx * a[0] + w.dy * a[1], tb = w.dx * b[0] + w.dy * b[1]
      const t0 = Math.max(w.t0, Math.min(ta, tb)), t1 = Math.min(w.t1, Math.max(ta, tb))
      if (t1 - t0 < 0.3 * k) continue
      // A thinner piece running along most of a room is a lining or another wall type, not a window.
      if (f.kind === 'window' && t1 - t0 > 3 * k) continue
      ranges.push({ kind: f.kind, t0, t1 })
    }
    ranges.sort((p, q) => p.t0 - q.t0)
    const out: { kind: 'door' | 'window'; t0: number; t1: number }[] = []
    for (const r of ranges) {
      const last = out[out.length - 1]
      if (last && r.t0 <= last.t1 + 0.02 * k) {
        last.t1 = Math.max(last.t1, r.t1)
        if (r.kind === 'window') last.kind = 'window'
      } else out.push({ ...r })
    }
    return out.map(r => ({ kind: r.kind, offM: ((r.t0 + r.t1) / 2 - w.t0) / k, widthM: (r.t1 - r.t0) / k }))
  }

  return result
    .filter(w => w.t1 - w.t0 >= minLen)
    .map((w, n) => ({
      id: `w${n}`,
      pts: [pointOf(w.dx, w.dy, w.c, w.t0), pointOf(w.dx, w.dy, w.c, w.t1)] as [Vec2, Vec2],
      thicknessM: w.thick / k,
      lengthM: (w.t1 - w.t0) / k,
      layer: w.layer,
      openings: openingsOf(w),
    }))
}

/** Groups walls by thickness (rounded to `stepM`), thickest first. */
export function groupByThickness(walls: DetectedWall[], stepM = 0.005): { thicknessM: number; walls: DetectedWall[]; lengthM: number }[] {
  const m = new Map<number, DetectedWall[]>()
  for (const w of walls) {
    const key = Math.round(w.thicknessM / stepM) * stepM
    const k = Math.round(key * 1e6) / 1e6
    ;(m.get(k) || m.set(k, []).get(k)!).push(w)
  }
  return [...m.entries()]
    .map(([thicknessM, ws]) => ({ thicknessM, walls: ws, lengthM: ws.reduce((s, w) => s + w.lengthM, 0) }))
    .sort((a, b) => b.lengthM - a.lengthM)
}
