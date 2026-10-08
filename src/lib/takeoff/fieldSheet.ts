// Field sheets (RitsuScope › Tarefas): helpers shared by the screen and the PDF.
// The planning layer gives every scope item its own colour and a label per line; a field sheet is the
// location (its zone + 1 m) cut out of the sheet, with the planning lines, a legend and a title block.
import type { Vec2 } from './geometry'
import type { Matrix } from './printMarkup'

/** Activity colours of the planning layer (kept apart from the usual takeoff colours). */
export const PLAN_PALETTE = ['#E11D48', '#2563EB', '#D97706', '#7C3AED', '#059669', '#DB2777', '#0891B2', '#65A30D', '#DC2626', '#4F46E5', '#CA8A04', '#0D9488']

/** Colour of a scope item in the planning layer: by its position in the (code-sorted) scope list. */
export function planColor(index: number): string {
  return PLAN_PALETTE[((index % PLAN_PALETTE.length) + PLAN_PALETTE.length) % PLAN_PALETTE.length]
}

/** Label of a planning line: "1.1 · 16,81 m²". */
export function planLabel(code: string | null | undefined, qty: string, unit: string | null | undefined): string {
  return [code, `${qty}${unit ? ` ${unit}` : ''}`].filter(Boolean).join(' · ')
}

/** Per-stretch tags for a polyline with the label on its longest stretch (the rest empty). */
export function tagsOnLongest(pts: Vec2[], label: string): string[] {
  if (pts.length < 2) return []
  let best = 0, bestLen = -1
  for (let i = 1; i < pts.length; i++) {
    const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (L > bestLen) { bestLen = L; best = i - 1 }
  }
  return pts.slice(1).map((_, i) => (i === best ? label : ''))
}

/** Stable short hash of what a sheet shows (to tell "changed since Rev N"). */
export function fingerprint(lines: { id: string; quantity: number | string | null; height_m?: number | string | null; points: Vec2[] }[]): string {
  const text = lines.slice().sort((a, b) => a.id.localeCompare(b.id))
    .map(l => `${l.id}:${Number(l.quantity || 0).toFixed(3)}:${l.height_m == null ? '' : Number(l.height_m).toFixed(3)}:${l.points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(';')}`)
    .join('|')
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0
  return `${lines.length}-${h.toString(36)}`
}

const apply = (m: Matrix, p: Vec2): Vec2 => [m[0] * p[0] + m[2] * p[1] + m[4], m[1] * p[0] + m[3] * p[1] + m[5]]

/** A viewport box (PDF points, y down) in the page's user space (y up): left, bottom, right, top. */
export function userBox(box: [number, number, number, number], toUser: Matrix): { left: number; bottom: number; right: number; top: number } {
  const c = [apply(toUser, [box[0], box[1]]), apply(toUser, [box[2], box[1]]), apply(toUser, [box[2], box[3]]), apply(toUser, [box[0], box[3]])]
  const xs = c.map(p => p[0]), ys = c.map(p => p[1])
  return { left: Math.min(...xs), bottom: Math.min(...ys), right: Math.max(...xs), top: Math.max(...ys) }
}

/** Fits a crop (user space) into a rectangle on the output page, centred: scale and point mapping. */
export function fitCrop(crop: { left: number; bottom: number; right: number; top: number }, area: { x: number; y: number; w: number; h: number }) {
  const cw = Math.max(1e-6, crop.right - crop.left), ch = Math.max(1e-6, crop.top - crop.bottom)
  const k = Math.min(area.w / cw, area.h / ch)
  const ox = area.x + (area.w - cw * k) / 2, oy = area.y + (area.h - ch * k) / 2
  return { k, x: ox, y: oy, w: cw * k, h: ch * k, map: (p: Vec2): Vec2 => [ox + (p[0] - crop.left) * k, oy + (p[1] - crop.bottom) * k] }
}

/** Printed scale of the cut-out (1:n), from the sheet's scale and the fit factor. */
export function printedRatio(ptPerM: number, k: number): number | null {
  if (!(ptPerM > 0) || !(k > 0)) return null
  return Math.round((72 / 25.4) * 1000 / (ptPerM * k))
}

/** Splits text into lines no wider than `max` (measured by `width`), at most `maxLines` (last one cut with …). */
export function wrapText(text: string, max: number, width: (s: string) => number, maxLines = 2): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (width(next) <= max || !cur) { cur = next; continue }
    lines.push(cur); cur = w
  }
  if (cur) lines.push(cur)
  if (lines.length <= maxLines) return lines
  const kept = lines.slice(0, maxLines)
  let last = kept[maxLines - 1]
  while (last.length > 1 && width(`${last}…`) > max) last = last.slice(0, -1)
  kept[maxLines - 1] = `${last}…`
  return kept
}
