// Doors, openings and windows read from the PDF linework and placed on the walls already
// in the takeoff. Detection reuses wall detection (it knows where a wall runs through an
// opening and whether glass lines sit in it); each opening is then matched to the drawn
// wall it lies on, measured along that wall. Pure TS, sheet points in.
import type { ElementOpening, Vec2 } from '../geometry'
import { OPENING_PRESETS, validateOpening } from '../openings'
import { detectWalls, type VSeg } from './walls'

export type OpeningFound = { kind: 'door' | 'void' | 'window'; a: Vec2; b: Vec2; widthM: number }

/**
 * Openings in the walls of the drawing. A gap a wall runs through is a door when a swing
 * (curved linework) is drawn next to it, otherwise an unfilled opening ('void'); glass
 * lines make it a window.
 */
export function findOpenings(segs: VSeg[], opts: { ptPerM: number; layers?: Set<string> | null; region?: { x0: number; y0: number; x1: number; y1: number } | null }): OpeningFound[] {
  const k = opts.ptPerM
  if (!(k > 0)) return []
  const walls = detectWalls(segs, { ptPerM: k, minThickM: 0.05, maxThickM: 0.35, minLenM: 0.3, layers: opts.layers ?? null, keepUnlayered: true, region: opts.region ?? null, bridgeOpeningsM: 1.6 })
  const out: OpeningFound[] = []
  for (const w of walls) {
    const [p, q] = w.pts
    const len = Math.hypot(q[0] - p[0], q[1] - p[1])
    if (!(len > 0)) continue
    const ux = (q[0] - p[0]) / len, uy = (q[1] - p[1]) / len
    for (const o of w.openings) {
      const t0 = (o.offM - o.widthM / 2) * k, t1 = (o.offM + o.widthM / 2) * k
      const a: Vec2 = [p[0] + ux * t0, p[1] + uy * t0]
      const b: Vec2 = [p[0] + ux * t1, p[1] + uy * t1]
      let kind: OpeningFound['kind'] = o.kind
      if (kind === 'door') {
        // Swing arcs are drawn as short slanted pieces within a door width of the opening.
        const reach = o.widthM * k + w.thicknessM * k
        let slanted = 0
        for (const s of segs) {
          const sl = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1])
          if (sl < 1e-6 || sl > 0.6 * k) continue
          const cos = Math.abs(((s.b[0] - s.a[0]) * ux + (s.b[1] - s.a[1]) * uy) / sl)
          if (cos > 0.996 || cos < 0.087) continue // parallel or perpendicular to the wall (±5°)
          const inside = (pt: Vec2) => {
            const along = (pt[0] - p[0]) * ux + (pt[1] - p[1]) * uy
            const across = Math.abs((pt[0] - p[0]) * -uy + (pt[1] - p[1]) * ux)
            return along >= t0 - reach * 0.2 && along <= t1 + reach * 0.2 && across <= reach
          }
          if (inside(s.a) && inside(s.b)) slanted++
          if (slanted >= 3) break
        }
        if (slanted < 3) kind = 'void'
      }
      out.push({ kind, a, b, widthM: o.widthM })
    }
  }
  return out
}

export type WallForOpenings = { id: string; pts: Vec2[]; thicknessM?: number | null; heightM?: number | null; openings: ElementOpening[] }

export type PlannedOpening = { key: string; elementId: string; kind: 'door' | 'void' | 'window'; a: Vec2; b: Vec2; opening: ElementOpening }

/**
 * Puts each found opening on the drawn wall it lies on (parallel, within the wall's
 * thickness plus 15 cm). Height and sill start from the usual presets, trimmed to the
 * wall height. Openings overlapping one already on the wall are skipped.
 */
export function placeOpenings(found: OpeningFound[], walls: WallForOpenings[], ptPerM: number): { planned: PlannedOpening[]; unplaced: number } {
  const k = ptPerM
  const planned: PlannedOpening[] = []
  let unplaced = 0
  const added = new Map<string, ElementOpening[]>()
  found.forEach((f, n) => {
    const m: Vec2 = [(f.a[0] + f.b[0]) / 2, (f.a[1] + f.b[1]) / 2]
    const fl = Math.hypot(f.b[0] - f.a[0], f.b[1] - f.a[1]) || 1
    const fx = (f.b[0] - f.a[0]) / fl, fy = (f.b[1] - f.a[1]) / fl
    let best: { wall: WallForOpenings; off: number; d: number; lenM: number } | null = null
    for (const w of walls) {
      const reach = Math.max(0.05, (w.thicknessM || 0) / 2) * k + 0.15 * k
      let before = 0
      let total = 0
      for (let i = 1; i < w.pts.length; i++) total += Math.hypot(w.pts[i][0] - w.pts[i - 1][0], w.pts[i][1] - w.pts[i - 1][1])
      for (let i = 1; i < w.pts.length; i++) {
        const p = w.pts[i - 1], q = w.pts[i]
        const sl = Math.hypot(q[0] - p[0], q[1] - p[1])
        if (sl < 1e-9) continue
        const ux = (q[0] - p[0]) / sl, uy = (q[1] - p[1]) / sl
        if (Math.abs(ux * fy - uy * fx) <= 0.087) {
          const t = (m[0] - p[0]) * ux + (m[1] - p[1]) * uy
          const d = Math.abs((m[0] - p[0]) * -uy + (m[1] - p[1]) * ux)
          if (t >= 0 && t <= sl && d <= reach && (!best || d < best.d)) best = { wall: w, off: (before + t) / k, d, lenM: total / k }
        }
        before += sl
      }
    }
    if (!best) { unplaced++; return }
    const { wall, lenM } = best
    // Keep it inside the wall (an opening at a wall end may poke out by a few cm).
    let x0 = best.off - f.widthM / 2
    let x1 = best.off + f.widthM / 2
    x0 = Math.max(0, x0)
    x1 = Math.min(lenM, x1)
    if (x1 - x0 < 0.3) { unplaced++; return }
    const preset = OPENING_PRESETS[f.kind]
    const H = wall.heightM && wall.heightM > 0 ? wall.heightM : null
    let sill = preset.sill
    let h = preset.h
    if (H) {
      if (sill + h > H) sill = Math.max(0, Math.min(sill, H - h))
      h = Math.min(h, H - sill)
    }
    const r3 = (v: number) => Math.round(v * 1000) / 1000
    const opening: ElementOpening = { kind: f.kind, off: r3((x0 + x1) / 2), w: r3(x1 - x0), h: r3(h), sill: r3(sill), guid: null }
    const others = [...wall.openings, ...(added.get(wall.id) || [])]
    if (validateOpening(opening, lenM, H ?? 1e6, others)) { unplaced++; return }
    added.set(wall.id, [...(added.get(wall.id) || []), opening])
    const ux = (f.b[0] - f.a[0]) / fl, uy = (f.b[1] - f.a[1]) / fl
    const half = (opening.w * k) / 2
    planned.push({ key: `o${n}`, elementId: wall.id, kind: f.kind, a: [m[0] - ux * half, m[1] - uy * half], b: [m[0] + ux * half, m[1] + uy * half], opening })
  })
  return { planned, unplaced }
}
