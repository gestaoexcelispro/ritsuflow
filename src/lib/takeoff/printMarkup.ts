// Print/export plan: turns the takeoff drawn on a sheet into vector marks in the PDF page's
// own coordinates, plus legend rows. Pure (no PDF library), so it can be tested.
// Sheet points are pdf.js viewport points at scale 1 (y down); the PDF page uses its user
// space (y up, origin at the MediaBox corner, possibly rotated). The viewport transform maps
// user space → sheet; we apply its inverse.
import { dist, layerQuantities, perimeter, polyArea, shapeHeight, type ElementOpening, type TakeoffItem, type Vec2 } from './geometry'
import { openingMarks } from './openingMarks'
import { mepExtra } from './mep'
import { structExtra } from './struct'
import { centroid } from './zones'
import { planOpacity } from './planOpacity'

export type Matrix = [number, number, number, number, number, number]

export function invert(m: Matrix): Matrix {
  const [a, b, c, d, e, f] = m
  const det = a * d - b * c
  if (Math.abs(det) < 1e-12) throw new Error('Singular page transform')
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]
}

export function apply(m: Matrix, p: Vec2): Vec2 {
  return [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  const n = parseInt(full, 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export type Mark =
  | { type: 'polyline'; pts: Vec2[]; color: [number, number, number]; width: number; opacity: number }
  | { type: 'polygon'; pts: Vec2[]; color: [number, number, number]; fillOpacity: number; borderWidth: number }
  | { type: 'dot'; at: Vec2; color: [number, number, number]; radius: number; opacity?: number }
  | { type: 'label'; at: Vec2; lines: string[]; size: number }
  /** A door/window/opening: a band along the wall (a→b) and an icon badge at its centre. */
  | { type: 'opening'; kind: ElementOpening['kind']; a: Vec2; b: Vec2; at: Vec2; width: number; color: [number, number, number] }
  /** Tag of a wall stretch (DW01-03), in a small box at the middle of the stretch. */
  | { type: 'tag'; at: Vec2; text: string; color: [number, number, number] }

export type LegendRow = { color: [number, number, number]; name: string; kind: TakeoffItem['kind']; main: string; sub: string; /** What `sub` is, when it is a plain measure. */ detail?: 'length' | 'perimeter' }

export type ZoneLike = { name: string; color: string; points: Vec2[]; is_visible?: boolean }

/** Marks in PDF user space for the items and zones of one sheet. */
export function buildMarks(items: TakeoffItem[], zones: ZoneLike[], toUser: Matrix, ptPerM: number, fmt: (v: number) => string): Mark[] {
  const marks: Mark[] = []
  const u = (pts: Vec2[]) => pts.map(p => apply(toUser, p))
  // Zones first (underneath), with their name and area at the centre.
  for (const z of zones) {
    if (z.is_visible === false || z.points.length < 3) continue
    marks.push({ type: 'polygon', pts: u(z.points), color: hexToRgb(z.color), fillOpacity: 0.22, borderWidth: 0.8 })
    let cx = 0, cy = 0
    for (const p of z.points) { cx += p[0]; cy += p[1] }
    const c: Vec2 = [cx / z.points.length, cy / z.points.length]
    const lines = [z.name]
    if (ptPerM > 0) lines.push(`${fmt(polyArea(z.points) / (ptPerM * ptPerM))} m²`)
    marks.push({ type: 'label', at: apply(toUser, c), lines, size: 7 })
  }
  for (const it of items) {
    const color = hexToRgb(it.color)
    for (const sh of it.shapes) {
      if (it.kind === 'area' && sh.pts.length >= 3) marks.push({ type: 'polygon', pts: u(sh.pts), color, fillOpacity: planOpacity(it, 'print'), borderWidth: 1 })
      else if (it.kind === 'linear' && sh.pts.length >= 2) {
        // Real wall thickness when known (at least 1.5 pt so thin walls stay visible).
        const w = it.thickness && it.thickness > 0 && ptPerM > 0 ? Math.max(1.5, it.thickness * ptPerM) : 3
        marks.push({ type: 'polyline', pts: u(sh.pts), color, width: w, opacity: planOpacity(it, 'print') })
      } else if (it.kind === 'count' && sh.pts[0]) marks.push({ type: 'dot', at: apply(toUser, sh.pts[0]), color, radius: 3.5, opacity: planOpacity(it, 'print') })
    }
  }
  // Openings last, so their badges sit on top of everything.
  for (const it of items) {
    if (it.kind !== 'linear') continue
    const w = it.thickness && it.thickness > 0 && ptPerM > 0 ? Math.max(1.5, it.thickness * ptPerM) : 3
    for (const sh of it.shapes) {
      for (const m of openingMarks(sh.pts, sh.openings, ptPerM)) {
        const c: Vec2 = [(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2]
        marks.push({ type: 'opening', kind: m.kind, a: apply(toUser, m.a), b: apply(toUser, m.b), at: apply(toUser, c), width: w, color: OPENING_COLORS[m.kind === 'door' || m.kind === 'window' ? m.kind : 'void'] })
      }
    }
  }
  // Door, window and opening tags, beside each opening's badge.
  for (const it of items) {
    if (it.kind !== 'linear') continue
    for (const sh of it.shapes) {
      if (!sh.openingTags?.length) continue
      for (const m of openingMarks(sh.pts, sh.openings, ptPerM)) {
        const tag = sh.openingTags[m.index]
        if (!tag) continue
        const c: Vec2 = [(m.a[0] + m.b[0]) / 2 + m.n[0] * 13, (m.a[1] + m.b[1]) / 2 + m.n[1] * 13]
        marks.push({ type: 'tag', at: apply(toUser, c), text: tag, color: OPENING_COLORS[m.kind === 'door' || m.kind === 'window' ? m.kind : 'void'] })
      }
    }
  }
  // Tags on top: middle of each wall stretch long enough on paper to hold its box, centre of each area,
  // beside each counted point.
  for (const it of items) {
    const color = hexToRgb(it.color)
    for (const sh of it.shapes) {
      if (!sh.tags?.length || !sh.pts.length) continue
      if (it.kind === 'linear') {
        sh.tags.forEach((text, i) => {
          if (!sh.pts[i + 1]) return
          const a = apply(toUser, sh.pts[i])
          const b = apply(toUser, sh.pts[i + 1])
          if (!text || Math.hypot(b[0] - a[0], b[1] - a[1]) < text.length * 3 + 10) return
          marks.push({ type: 'tag', at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], text, color })
        })
      } else if (it.kind === 'area' && sh.pts.length >= 3 && sh.tags[0]) {
        marks.push({ type: 'tag', at: apply(toUser, centroid(sh.pts)), text: sh.tags[0], color })
      } else if (it.kind === 'count' && sh.tags[0]) {
        const p = apply(toUser, sh.pts[0])
        marks.push({ type: 'tag', at: [p[0] + sh.tags[0].length * 1.5 + 6, p[1] + 6], text: sh.tags[0], color })
      }
    }
  }
  return marks
}

/** Same colours as on screen: doors amber, windows blue, plain openings grey. */
export const OPENING_COLORS: Record<'door' | 'window' | 'void', [number, number, number]> = {
  door: hexToRgb('#B45309'),
  window: hexToRgb('#0284C7'),
  void: hexToRgb('#64748B'),
}

export type OpeningRow = { kind: ElementOpening['kind']; wall: string; color: [number, number, number]; count: number; w: number; h: number; sill: number; areaM2: number }

/** Doors, windows and openings grouped by type, wall item and size, largest count first. */
export function openingRows(items: TakeoffItem[]): OpeningRow[] {
  const map = new Map<string, OpeningRow>()
  for (const it of items) {
    if (it.kind !== 'linear') continue
    for (const sh of it.shapes) for (const o of sh.openings || []) {
      // Grouped by the size as printed (2 decimals): 0,889 and 0,890 m are the same door on paper.
      const key = [o.kind, it.key, o.w.toFixed(2), o.h.toFixed(2), o.sill.toFixed(2)].join('|')
      const row = map.get(key)
      if (row) { row.count++; row.areaM2 += o.w * o.h }
      else map.set(key, { kind: o.kind, wall: it.name, color: OPENING_COLORS[o.kind === 'door' || o.kind === 'window' ? o.kind : 'void'], count: 1, w: o.w, h: o.h, sill: o.sill, areaM2: o.w * o.h })
    }
  }
  const order = { door: 0, void: 1, other: 1, window: 2 } as const
  return [...map.values()].sort((p, q) => order[p.kind] - order[q.kind] || q.count - p.count || p.wall.localeCompare(q.wall))
}

/** One legend row per item that has something drawn on this sheet. */
export function legendRows(items: TakeoffItem[], ptPerM: number, fmt: (v: number) => string, unitLabel: string, formworkLabel = 'formwork'): LegendRow[] {
  const rows: LegendRow[] = []
  for (const it of items) {
    if (!it.shapes.length) continue
    const q = ptPerM > 0 ? layerQuantities(it, ptPerM) : null
    let main = '—'
    let sub = ''
    let detail: LegendRow['detail']
    // Walls lead with their area (net of openings), length below; lines without a height keep metres.
    if (q && it.kind === 'linear') {
      if (!it.struct && q.net != null && q.net > 0) { main = `${fmt(q.net)} m²`; sub = `${fmt(q.len)} m`; detail = 'length' } else { main = `${fmt(q.len)} m`; sub = '' }
    }
    else if (q && it.kind === 'area') { main = `${fmt(q.area)} m²`; sub = `${fmt(q.per)} m`; detail = 'perimeter' }
    else if (q) { main = `${q.n} ${unitLabel}`; sub = blockingText(it, q.n, fmt) }
    if (q && it.struct) { sub = structText(it, q, fmt, formworkLabel) || sub; detail = undefined }
    rows.push({ color: hexToRgb(it.color), name: it.name, kind: it.kind, main, sub, detail })
  }
  return rows
}

export function zoneRows(zones: ZoneLike[], ptPerM: number, fmt: (v: number) => string): { color: [number, number, number]; name: string; area: string; perimeter: string }[] {
  return zones
    .filter(z => z.points.length >= 3)
    .map(z => ({
      color: hexToRgb(z.color),
      name: z.name,
      area: ptPerM > 0 ? `${fmt(polyArea(z.points) / (ptPerM * ptPerM))} m²` : '—',
      perimeter: ptPerM > 0 ? `${fmt(perimeter(z.points) / ptPerM)} m` : '—',
    }))
}

/** Standard PDF fonts only cover WinAnsi; replace anything else so drawing text never fails. */
export function winAnsi(text: string): string {
  const extra = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'.split(''))
  return [...text].map(ch => {
    const c = ch.charCodeAt(0)
    if ((c >= 32 && c <= 126) || (c >= 160 && c <= 255) || extra.has(ch)) return ch
    if (ch === ' ' || ch === '\t') return ' '
    return '?'
  }).join('')
}

/** A sheet in a whole-project print: its items, scale and how many floors it stands for (typical floors). */
export type PrintSheetQty = { items: TakeoffItem[]; ptPerM: number; multiplier: number }

/** Project totals: each item summed over every sheet (at that sheet's scale) × the sheet's floor count. */
export function projectTotals(sheets: PrintSheetQty[], fmt: (v: number) => string, unitLabel: string, formworkLabel = 'formwork'): LegendRow[] {
  const acc = new Map<string, { it: TakeoffItem; len: number; net: number; hasNet: boolean; area: number; per: number; n: number; measured: boolean }>()
  for (const s of sheets) {
    const k = Math.max(1, s.multiplier || 1)
    for (const it of s.items) {
      if (!it.shapes.length) continue
      const row = acc.get(it.key) || { it, len: 0, net: 0, hasNet: false, area: 0, per: 0, n: 0, measured: false }
      const q = s.ptPerM > 0 ? layerQuantities(it, s.ptPerM) : null
      if (q) {
        row.measured = true
        row.len += q.len * k
        row.area += q.area * k
        row.per += q.per * k
        row.n += q.n * k
        if (q.net != null) { row.net += q.net * k; row.hasNet = true }
      }
      acc.set(it.key, row)
    }
  }
  return [...acc.values()].map(r => {
    let main = '—'
    let sub = ''
    let detail: LegendRow['detail']
    if (r.measured && r.it.kind === 'linear') {
      if (!r.it.struct && r.hasNet && r.net > 0) { main = `${fmt(r.net)} m²`; sub = `${fmt(r.len)} m`; detail = 'length' } else { main = `${fmt(r.len)} m`; sub = '' }
    }
    else if (r.measured && r.it.kind === 'area') { main = `${fmt(r.area)} m²`; sub = `${fmt(r.per)} m`; detail = 'perimeter' }
    else if (r.measured) { main = `${r.n} ${unitLabel}`; sub = blockingText(r.it, r.n, fmt) }
    if (r.measured && r.it.struct) { sub = structText(r.it, r, fmt, formworkLabel) || sub; detail = undefined }
    return { color: hexToRgb(r.it.color), name: r.it.name, kind: r.it.kind, main, sub, detail }
  })
}

/** Openings over the whole project: same type, size and wall merged, counts × the sheet's floor count. */
export function projectOpeningRows(sheets: Pick<PrintSheetQty, 'items' | 'multiplier'>[]): OpeningRow[] {
  const map = new Map<string, OpeningRow>()
  for (const s of sheets) {
    const k = Math.max(1, s.multiplier || 1)
    for (const r of openingRows(s.items)) {
      const key = [r.kind, r.wall, r.w.toFixed(2), r.h.toFixed(2), r.sill.toFixed(2)].join('|')
      const prev = map.get(key)
      if (prev) { prev.count += r.count * k; prev.areaM2 += r.areaM2 * k }
      else map.set(key, { ...r, count: r.count * k, areaM2: r.areaM2 * k })
    }
  }
  const order = { door: 0, void: 1, other: 1, window: 2 } as const
  return [...map.values()].sort((p, q) => order[p.kind] - order[q.kind] || q.count - p.count || p.wall.localeCompare(q.wall))
}

/** Reinforcements: metres along the wall and m² of backing, next to the unit count. */
function blockingText(it: TakeoffItem, n: number, fmt: (v: number) => string): string {
  const e = mepExtra(it, n)
  return e ? `${fmt(e.lengthM)} m · ${fmt(e.areaM2)} m²` : ''
}

/** Structure: concrete m³ and formwork m², from what was measured (count, length, area, perimeter). */
export function structText(it: TakeoffItem, q: { n: number; len: number; area: number; per: number }, fmt: (v: number) => string, formworkLabel: string): string {
  const e = structExtra(it, q)
  if (!e) return ''
  return e.formworkM2 > 0 ? `${fmt(e.concreteM3)} m³ · ${fmt(e.formworkM2)} m² ${formworkLabel}` : `${fmt(e.concreteM3)} m³`
}

/** One row per tag (wall stretch, area, counted point), sorted by tag, for the report's tag table. */
export function tagTableRows(items: TakeoffItem[], ptPerM: number, fmt: (v: number) => string, unitLabel: string): { color: [number, number, number]; tag: string; name: string; main: string; sub: string; detail?: 'length' | 'perimeter' | 'height' | 'sill' }[] {
  const rows: ReturnType<typeof tagTableRows> = []
  const k2 = ptPerM * ptPerM
  for (const it of items) for (const sh of it.shapes) (sh.tags || []).forEach((tag, i) => {
    if (!tag) return
    const color = hexToRgb(it.color)
    if (it.kind === 'linear') {
      const len = ptPerM > 0 && sh.pts[i + 1] ? dist(sh.pts[i], sh.pts[i + 1]) / ptPerM : 0
      const h = shapeHeight(it, sh)
      rows.push(h && !it.struct
        ? { color, tag, name: it.name, main: `${fmt(len * h)} m²`, sub: `${fmt(len)} m`, detail: 'length' }
        : { color, tag, name: it.name, main: `${fmt(len)} m`, sub: '' })
    } else if (it.kind === 'area') {
      rows.push(ptPerM > 0 && sh.pts.length >= 3
        ? { color, tag, name: it.name, main: `${fmt(polyArea(sh.pts) / k2)} m²`, sub: `${fmt(perimeter(sh.pts) / ptPerM)} m`, detail: 'perimeter' }
        : { color, tag, name: it.name, main: '—', sub: '' })
    } else rows.push({ color, tag, name: it.name, main: `1 ${unitLabel}`, sub: '' })
  })
  // Doors, windows and openings: size and sill, on the wall they sit in.
  for (const it of items) if (it.kind === 'linear') for (const sh of it.shapes) (sh.openingTags || []).forEach((tag, i) => {
    const o = sh.openings?.[i]
    if (!tag || !o) return
    const kind = o.kind === 'door' || o.kind === 'window' ? o.kind : 'void'
    rows.push({ color: OPENING_COLORS[kind], tag, name: it.name, main: `${fmt(o.w)} × ${fmt(o.h)} m`, sub: o.sill > 0 ? `${fmt(o.sill)} m` : '', detail: o.sill > 0 ? 'sill' : undefined })
  })
  return rows.sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }))
}
