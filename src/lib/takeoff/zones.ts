// Zoning: named outlines (rooms, corridors…) drawn on a sheet, and what lies inside them.
// Geometry is in sheet points (y down); ptPerM converts to metres.
import { perimeter, polyArea, polyLen, type TakeoffItem, type Vec2 } from './geometry'

export type ZoneRow = {
  id: string
  project_id: string
  source_id: string
  name: string
  color: string
  points: Vec2[]
  ceiling_height_m: number | null
  location_id: string | null
  is_visible: boolean
  sort_order: number
  created_by?: string | null
}

export const ZONE_COLUMNS = 'id, project_id, source_id, name, color, points, ceiling_height_m, location_id, is_visible, sort_order, created_by'

/** Text placed on the sheet (from the PDF), in sheet points; `size` is the font height. */
export type SheetText = { str: string; x: number; y: number; size: number }

export function pointInPolygon(p: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))
}

/** Distance from a point to a closed polygon's boundary. */
export function distToBoundary(p: Vec2, poly: Vec2[]): number {
  let d = Infinity
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSegment(p, poly[i], poly[(i + 1) % poly.length]))
  return d
}

export function centroid(poly: Vec2[]): Vec2 {
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i]
    const [x1, y1] = poly[(i + 1) % poly.length]
    const f = x0 * y1 - x1 * y0
    a += f
    cx += (x0 + x1) * f
    cy += (y0 + y1) * f
  }
  if (Math.abs(a) < 1e-9) {
    const n = poly.length || 1
    return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n]
  }
  return [cx / (3 * a), cy / (3 * a)]
}

const NOT_A_NAME = /^[\s\d.,:;/×x+\-–()]*(m²|m2|m|cm|mm)?[\s\d.,]*$/i

/**
 * Suggests a zone name from the sheet text inside it: the first label that isn't a
 * number or a measurement, plus a short code/number printed right below or beside it
 * ("Room" + "1" → "Room 1").
 */
export function nameFromTexts(poly: Vec2[], texts: SheetText[]): string | null {
  const inside = texts
    .filter(t => t.str.trim() && pointInPolygon([t.x, t.y], poly))
    .sort((p, q) => p.y - q.y || p.x - q.x)
  const base = inside.find(t => !NOT_A_NAME.test(t.str.trim()))
  if (!base) return null
  let name = base.str.trim()
  const next = inside.find(t => t !== base && t.str.trim().length <= 4 && /^[\w.-]+$/.test(t.str.trim()) &&
    Math.abs(t.x - base.x) < base.size * 6 && t.y >= base.y - base.size * 0.2 && t.y - base.y <= base.size * 2.2)
  if (next && !name.endsWith(next.str.trim())) name = `${name} ${next.str.trim()}`
  return name
}

export type ZoneStats = { areaM2: number; perimeterM: number; heightM: number | null; volumeM3: number | null; wallAreaM2: number | null }

export function zoneStats(z: Pick<ZoneRow, 'points' | 'ceiling_height_m'>, ptPerM: number): ZoneStats {
  const k = ptPerM > 0 ? ptPerM : 1
  const areaM2 = polyArea(z.points) / (k * k)
  const perimeterM = perimeter(z.points) / k
  const h = z.ceiling_height_m && z.ceiling_height_m > 0 ? Number(z.ceiling_height_m) : null
  return { areaM2, perimeterM, heightM: h, volumeM3: h ? areaM2 * h : null, wallAreaM2: h ? perimeterM * h : null }
}

export type ZoneTakeoffLine = { key: string; name: string; color: string; kind: TakeoffItem['kind']; lengthM: number; areaM2: number; count: number }

/**
 * Takeoff quantities inside a zone (approximate): linear pieces count when they are inside
 * the zone or within `edgeM` of its outline (walls drawn on the room's edge), area shapes
 * when their centroid is inside, counts when the point is inside.
 */
export function takeoffInZone(poly: Vec2[], items: TakeoffItem[], ptPerM: number, edgeM = 0.2): ZoneTakeoffLine[] {
  const k = ptPerM > 0 ? ptPerM : 1
  const edge = edgeM * k
  const near = (p: Vec2) => pointInPolygon(p, poly) || distToBoundary(p, poly) <= edge
  const out: ZoneTakeoffLine[] = []
  for (const it of items) {
    let lengthM = 0
    let areaM2 = 0
    let count = 0
    for (const sh of it.shapes) {
      const pts = sh.pts
      if (it.kind === 'count') { if (pts[0] && pointInPolygon(pts[0], poly)) count++; continue }
      if (it.kind === 'area') { if (pts.length >= 3 && pointInPolygon(centroid(pts), poly)) areaM2 += polyArea(pts) / (k * k); continue }
      // Linear: walk each segment in short steps and keep the part near the zone.
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]
        const b = pts[i]
        const len = polyLen([a, b])
        const steps = Math.max(1, Math.ceil(len / (0.05 * k)))
        let kept = 0
        for (let s = 0; s < steps; s++) {
          const t = (s + 0.5) / steps
          if (near([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])) kept++
        }
        lengthM += (len * kept) / steps / k
      }
    }
    if (lengthM > 1e-6 || areaM2 > 1e-6 || count > 0) out.push({ key: it.key, name: it.name, color: it.color, kind: it.kind, lengthM, areaM2, count })
  }
  return out
}

/** Next default name: "Room 4" after Room 1–3 (or the localized word). */
export function nextZoneName(existing: string[], word: string): string {
  let n = 1
  const used = new Set(existing.map(s => s.trim().toLowerCase()))
  while (used.has(`${word} ${n}`.toLowerCase())) n++
  return `${word} ${n}`
}

/** Drawing scale 1:N from points per metre (paper in points, 72 pt = 25.4 mm). */
export function scaleRatio(ptPerM: number): number | null {
  if (!(ptPerM > 0)) return null
  return (72 / 25.4) * 1000 / ptPerM
}
