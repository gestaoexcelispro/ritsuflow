// Reads vector linework from a pdf.js page, with the CAD layer (optional content group)
// each line belongs to. Coordinates are viewport points at scale 1 (y down), the same
// space the takeoff overlay uses.
// Based on the snapping extractor in diario-de-obras/pdfSnapEngine.ts (pdf.js 5 packed paths).
import type { Vec2 } from '../geometry'
import type { VSeg } from './walls'

type Matrix = [number, number, number, number, number, number]
const I: Matrix = [1, 0, 0, 1, 0, 0]
const mul = (a: Matrix, b: Matrix): Matrix => [
  a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
]
const apply = (m: Matrix, x: number, y: number): Vec2 => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
const matrixFrom = (v: unknown): Matrix | null => {
  const a = Array.from((v as ArrayLike<number>) || []).map(Number)
  return a.length >= 6 && a.slice(0, 6).every(Number.isFinite) ? (a.slice(0, 6) as Matrix) : null
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function extractPdfVectors(pdf: any, page: any, pdfjs: any, viewportMatrix: number[]): Promise<VSeg[]> {
  const OPS = pdfjs.OPS
  const list = await page.getOperatorList()

  // Optional content group id -> layer name (best effort; older files have none).
  const groupName = new Map<string, string>()
  try {
    const config = await pdf.getOptionalContentConfig()
    if (config && typeof config[Symbol.iterator] === 'function') {
      for (const [id, group] of config as Iterable<[string, { name?: string }]>) if (group?.name) groupName.set(String(id), String(group.name))
    }
  } catch { /* no layers */ }

  const base = (viewportMatrix?.length === 6 ? Array.from(viewportMatrix) : I) as Matrix
  let ctm: Matrix = [...base]
  const stack: { ctm: Matrix; lw: number }[] = []
  let lw = 1
  const layerStack: (string | null)[] = []
  const out: VSeg[] = []
  const scaleOf = (m: Matrix) => Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1

  const add = (a: Vec2 | null, b: Vec2 | null) => {
    if (!a || !b || !Number.isFinite(a[0] + a[1] + b[0] + b[1])) return
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) <= 0.01) return
    out.push({ a: [a[0], a[1]], b: [b[0], b[1]], layer: layerStack.length ? layerStack[layerStack.length - 1] : null, width: lw * scaleOf(ctm) })
  }
  // Curves are flattened coarsely; walls are straight, so they rarely matter.
  const curve = (p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2) => {
    let prev = p0
    for (let i = 1; i <= 8; i++) {
      const t = i / 8
      const u = 1 - t
      const n: Vec2 = [
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
      ]
      add(prev, n)
      prev = n
    }
    return p3
  }
  const decodePacked = (packed: ArrayLike<number>) => {
    const path = Array.from(packed || []).map(Number)
    let i = 0
    let cur: Vec2 | null = null
    let start: Vec2 | null = null
    while (i < path.length) {
      const op = path[i++]
      if (op === 0) { if (i + 1 >= path.length) break; cur = apply(ctm, path[i++], path[i++]); start = cur; continue }
      if (op === 1) { if (i + 1 >= path.length) break; const n = apply(ctm, path[i++], path[i++]); add(cur, n); cur = n; continue }
      if (op === 2) {
        if (i + 5 >= path.length) break
        const c1 = apply(ctm, path[i++], path[i++]); const c2 = apply(ctm, path[i++], path[i++]); const end = apply(ctm, path[i++], path[i++])
        cur = cur ? curve(cur, c1, c2, end) : end
        continue
      }
      if (op === 3) { add(cur, start); cur = start; continue }
      break
    }
  }
  const decodeLegacy = (pathOps: ArrayLike<number>, coordsRaw: ArrayLike<number>) => {
    const ops = Array.from(pathOps || [])
    const c = Array.from(coordsRaw || []).map(Number)
    let k = 0
    let cur: Vec2 | null = null
    let start: Vec2 | null = null
    for (const op of ops) {
      if (op === OPS.moveTo) { cur = apply(ctm, c[k++], c[k++]); start = cur; continue }
      if (op === OPS.lineTo) { const n = apply(ctm, c[k++], c[k++]); add(cur, n); cur = n; continue }
      if (op === OPS.rectangle) {
        const x = c[k++]; const y = c[k++]; const w = c[k++]; const h = c[k++]
        const p1 = apply(ctm, x, y); const p2 = apply(ctm, x + w, y); const p3 = apply(ctm, x + w, y + h); const p4 = apply(ctm, x, y + h)
        add(p1, p2); add(p2, p3); add(p3, p4); add(p4, p1); cur = p1; start = p1
        continue
      }
      if (op === OPS.closePath) { add(cur, start); cur = start; continue }
      if (op === OPS.curveTo) { const c1 = apply(ctm, c[k++], c[k++]); const c2 = apply(ctm, c[k++], c[k++]); const end = apply(ctm, c[k++], c[k++]); cur = cur ? curve(cur, c1, c2, end) : end; continue }
      if (op === OPS.curveTo2 || op === OPS.curveTo3) { k += 4; continue }
    }
  }

  for (let i = 0; i < list.fnArray.length; i++) {
    const fn = list.fnArray[i]
    const args = list.argsArray[i]
    if (fn === OPS.save) { stack.push({ ctm: [...ctm], lw }); continue }
    if (fn === OPS.restore) { const s = stack.pop(); ctm = s?.ctm || [...base]; lw = s?.lw ?? 1; continue }
    if (fn === OPS.transform) { const m = matrixFrom(args); if (m) ctm = mul(ctm, m); continue }
    if (fn === OPS.setLineWidth) { const w = Number(args?.[0]); if (Number.isFinite(w)) lw = w; continue }
    if (fn === OPS.setGState) {
      for (const entry of (args?.[0] || []) as [string, unknown][]) if (entry?.[0] === 'LW' && Number.isFinite(Number(entry[1]))) lw = Number(entry[1])
      continue
    }
    if (fn === OPS.paintFormXObjectBegin) { stack.push({ ctm: [...ctm], lw }); const m = matrixFrom(args?.[0]); if (m) ctm = mul(ctm, m); continue }
    if (fn === OPS.paintFormXObjectEnd) { const s = stack.pop(); ctm = s?.ctm || [...base]; lw = s?.lw ?? lw; continue }
    if (fn === OPS.beginGroup) { stack.push({ ctm: [...ctm], lw }); const m = matrixFrom(args?.[0]?.matrix); if (m) ctm = mul(ctm, m); continue }
    if (fn === OPS.endGroup) { const s = stack.pop(); ctm = s?.ctm || [...base]; lw = s?.lw ?? lw; continue }
    if (fn === OPS.beginMarkedContentProps) {
      const tag = args?.[0]
      const props = args?.[1]
      let name: string | null = layerStack.length ? layerStack[layerStack.length - 1] : null
      if (tag === 'OC' && props) {
        const id = props.id ?? props.ids?.[0]
        if (id != null) name = groupName.get(String(id)) ?? String(id)
      }
      layerStack.push(name)
      continue
    }
    if (fn === OPS.beginMarkedContent) { layerStack.push(layerStack.length ? layerStack[layerStack.length - 1] : null); continue }
    if (fn === OPS.endMarkedContent) { layerStack.pop(); continue }
    if (fn !== OPS.constructPath || !args) continue
    const data = args[1]
    const packed = Array.isArray(data) ? data[0] : null
    if (typeof args[0] === 'number' && packed && typeof packed.length === 'number') decodePacked(packed)
    else decodeLegacy(args[0], args[1])
  }

  // Drop exact duplicates (CAD often draws the same line twice).
  const seen = new Set<string>()
  return out.filter(s => {
    const a = `${s.a[0].toFixed(2)},${s.a[1].toFixed(2)}`
    const b = `${s.b[0].toFixed(2)},${s.b[1].toFixed(2)}`
    const key = (a < b ? `${a}|${b}` : `${b}|${a}`) + `|${s.layer ?? ''}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */
