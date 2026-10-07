// Builds a printable PDF of the whole project: each original sheet (vector, untouched) with the
// takeoff drawn on top and a title strip, a 3D page, and tables per level with project totals.
// pdf-lib is loaded from a CDN at runtime (no package install needed), like three.js in View3D.
import { buildMarks, invert, legendRows, openingRows, projectOpeningRows, projectTotals, tagTableRows, winAnsi, zoneRows, type Matrix, type ZoneLike } from '@/lib/takeoff/printMarkup'
import { projectMaterialGroups, type MaterialGroup, type MaterialKind, type MaterialRow } from '@/lib/takeoff/materialList'
import { ICON_PATHS } from './icons'
import type { TakeoffItem } from '@/lib/takeoff/geometry'

const PDFLIB_URLS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
  'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js',
]

/* eslint-disable @typescript-eslint/no-explicit-any */
function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`) as HTMLScriptElement | null
    if (existing?.dataset.loaded === '1') { resolve(); return }
    const el = existing || document.createElement('script')
    el.addEventListener('load', () => { el.dataset.loaded = '1'; resolve() }, { once: true })
    el.addEventListener('error', () => reject(new Error(`Could not load ${src}`)), { once: true })
    if (!existing) {
      el.src = src
      el.async = true
      el.dataset.src = src
      document.head.appendChild(el)
    }
  })
}

export async function loadPdfLib(): Promise<any> {
  const w = window as any
  if (w.PDFLib) return w.PDFLib
  let last: unknown = null
  for (const url of PDFLIB_URLS) {
    try {
      await loadScript(url)
      if (w.PDFLib) return w.PDFLib
    } catch (e) { last = e }
  }
  throw last instanceof Error ? last : new Error('pdf-lib could not be loaded')
}

export type PrintLabels = {
  title: string
  subtitle: string
  items: string
  locations: string
  colItem: string
  colKind: string
  colQty: string
  colExtra: string
  colArea: string
  colPerimeter: string
  kind: Record<TakeoffItem['kind'], string>
  unit: string
  footer: string
  /** Doors, windows and openings table. */
  openings: string
  colWall: string
  colOpenArea: string
  openingKind: Record<'door' | 'window' | 'void' | 'other', string>
  /** Word after the formwork m² of structural items. */
  formwork: string
  /** Heading of the 3D page. */
  view3d: string
  /** Heading of the project totals. */
  totals: string
  /** Note under the totals (typical floors counted). */
  totalsNote: string
  /** Materials table: heading, columns and the name of each kind of material. */
  materials: string
  colMaterial: string
  colPacks: string
  materialKind: Record<MaterialKind, string>
  /** Tag table (one row per wall stretch, area or point). */
  tags: string
  colTag: string
  /** Words in front of the second figure: "Length 23,72 m", "Perimeter 42,44 m". */
  detail: Record<'length' | 'perimeter' | 'height' | 'sill', string>
}

/** One sheet of the project in the print, with what is drawn on it. */
export type PrintSheet = {
  url: string
  pageNumber: number
  items: TakeoffItem[]
  zones: ZoneLike[]
  ptPerM: number
  /** Floors this sheet stands for (typical floors); quantities in the totals are multiplied by it. */
  multiplier: number
  /** Title strip on the sheet page. */
  title: string
  subtitle: string
  /** Section heading in the tables ("Térreo · PRJ-01"). */
  heading: string
  /** White wash over the source drawing before the takeoff is drawn (0…0.8). */
  backgroundFade?: number
  /** Materials of this sheet, one group per item / type (framing layout, recipes, ceiling / floor build-ups). */
  materialGroups?: MaterialGroup[]
}

const svgPath = (pts: [number, number][], close: boolean) =>
  pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(3)},${(-p[1]).toFixed(3)}`).join(' ') + (close ? ' Z' : '')

/**
 * The whole project in one PDF: every sheet with the takeoff drawn on it (in level order),
 * a 3D page, then the quantity tables per level and the project totals.
 */
export async function buildProjectPdf(opts: {
  sheets: PrintSheet[]
  /** PNG of the 3D view; the 3D page is skipped when null. */
  image3d: Uint8Array | null
  title: string
  subtitle: string
  fmt: (v: number) => string
  labels: PrintLabels
  /** Company logo (PNG) placed on every page; skipped if it can't be loaded. */
  logoUrl?: string
}): Promise<Blob> {
  const { sheets, image3d, title, subtitle, fmt, labels, logoUrl } = opts
  const urls = [...new Set(sheets.map(s => s.url))]
  const [PDFLib, logoBytes, ...files] = await Promise.all([
    loadPdfLib(),
    logoUrl ? fetch(logoUrl).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null) : Promise.resolve(null),
    ...urls.map(u => fetch(u).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer() })),
  ])
  const bytesOf = new Map<string, ArrayBuffer>(urls.map((u, i) => [u, files[i] as ArrayBuffer]))
  const { PDFDocument, StandardFonts, rgb, LineCapStyle } = PDFLib

  const pdfjs = await import('pdfjs-dist-v5')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }

  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)
  const color = (c: [number, number, number]) => rgb(c[0], c[1], c[2])
  const ink = rgb(0.09, 0.2, 0.25)
  const grey = rgb(0.42, 0.5, 0.54)
  const teal = rgb(0.05, 0.5, 0.47)
  let logo: any = null
  if (logoBytes) { try { logo = await out.embedPng(logoBytes) } catch { logo = null } }
  const logoSize = (h: number) => (logo ? { width: (logo.width / logo.height) * h, height: h } : { width: 0, height: 0 })

  // ---- Sheet pages, each with its takeoff and a title strip.
  const sources = new Map<string, any>()
  for (const sheet of sheets) {
    const bytes = bytesOf.get(sheet.url)!
    const task = pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) })
    let toUser: Matrix
    try {
      const doc = await task.promise
      const page = await doc.getPage(sheet.pageNumber)
      toUser = invert(page.getViewport({ scale: 1 }).transform as Matrix)
    } finally {
      await task.destroy()
    }
    if (!sources.has(sheet.url)) sources.set(sheet.url, await PDFDocument.load(bytes, { ignoreEncryption: true }))
    const [pg] = await out.copyPages(sources.get(sheet.url), [sheet.pageNumber - 1])
    out.addPage(pg)
    // Faded background: a white wash over the drawing (it stays vector), so the takeoff colours read true.
    if (sheet.backgroundFade && sheet.backgroundFade > 0) {
      const mb = pg.getMediaBox()
      pg.drawRectangle({ x: mb.x, y: mb.y, width: mb.width, height: mb.height, color: rgb(1, 1, 1), opacity: Math.min(0.8, sheet.backgroundFade) })
    }

    const mb0 = pg.getMediaBox()
    const tagScale = Math.min(3, Math.max(1, Math.max(mb0.width, mb0.height) / 1190))
    for (const m of buildMarks(sheet.items, sheet.zones, toUser, sheet.ptPerM, fmt)) {
      if (m.type === 'polygon') {
        pg.drawSvgPath(svgPath(m.pts, true), { x: 0, y: 0, color: color(m.color), opacity: m.fillOpacity, borderColor: color(m.color), borderWidth: m.borderWidth, borderOpacity: 0.9 })
      } else if (m.type === 'polyline') {
        pg.drawSvgPath(svgPath(m.pts, false), { x: 0, y: 0, borderColor: color(m.color), borderWidth: m.width, borderOpacity: m.opacity, borderLineCap: LineCapStyle.Round })
      } else if (m.type === 'opening') {
        pg.drawLine({ start: { x: m.a[0], y: m.a[1] }, end: { x: m.b[0], y: m.b[1] }, thickness: m.width, color: color(m.color), opacity: 0.85 })
        const r = 6.5
        pg.drawCircle({ x: m.at[0], y: m.at[1], size: r, color: rgb(1, 1, 1), borderColor: color(m.color), borderWidth: 0.8 })
        const icon = ICON_PATHS[m.kind === 'door' ? 'door' : m.kind === 'window' ? 'window' : 'opening']
        const sc = 0.3
        pg.drawSvgPath(icon, { x: m.at[0] - 12 * sc, y: m.at[1] + 12 * sc, scale: sc, borderColor: color(m.color), borderWidth: 2.4, borderLineCap: LineCapStyle.Round })
      } else if (m.type === 'tag') {
        // Tags grow with the sheet (A4/A3 = 5 pt, A1 ≈ 10 pt) so they read like the drawing's own text.
        const text = winAnsi(m.text)
        const size = 5 * tagScale
        const w = bold.widthOfTextAtSize(text, size) + 4 * tagScale
        pg.drawRectangle({ x: m.at[0] - w / 2, y: m.at[1] - 3.6 * tagScale, width: w, height: 7.2 * tagScale, color: rgb(1, 1, 1), opacity: 0.92, borderColor: color(m.color), borderWidth: 0.5 * tagScale })
        pg.drawText(text, { x: m.at[0] - w / 2 + 2 * tagScale, y: m.at[1] - 1.8 * tagScale, size, font: bold, color: ink })
      } else if (m.type === 'dot') {
        pg.drawCircle({ x: m.at[0], y: m.at[1], size: m.radius, color: color(m.color), opacity: m.opacity ?? 1, borderColor: rgb(1, 1, 1), borderWidth: 0.8, borderOpacity: m.opacity ?? 1 })
      } else {
        m.lines.forEach((line, i) => {
          const text = winAnsi(line)
          const f = i === 0 ? bold : font
          const w = f.widthOfTextAtSize(text, m.size)
          pg.drawText(text, { x: m.at[0] - w / 2, y: m.at[1] - i * (m.size + 2), size: m.size, font: f, color: ink })
        })
      }
    }

    const box = pg.getMediaBox()
    const strip = [winAnsi(sheet.title), winAnsi(sheet.subtitle)]
    const lg = logoSize(22)
    const textX = box.x + 22 + (logo ? lg.width + 8 : 0)
    const sw = (textX - box.x - 14) + Math.max(bold.widthOfTextAtSize(strip[0], 8), font.widthOfTextAtSize(strip[1], 7)) + 8
    pg.drawRectangle({ x: box.x + 14, y: box.y + 14, width: sw, height: 30, color: rgb(1, 1, 1), opacity: 0.95, borderColor: rgb(0.06, 0.62, 0.57), borderWidth: 0.8 })
    if (logo) pg.drawImage(logo, { x: box.x + 20, y: box.y + 18, width: lg.width, height: lg.height })
    pg.drawText(strip[0], { x: textX, y: box.y + 32, size: 8, font: bold, color: ink })
    pg.drawText(strip[1], { x: textX, y: box.y + 21, size: 7, font, color: rgb(0.3, 0.4, 0.44) })
  }

  // ---- A4 landscape pages: 3D view and tables.
  const W = 842, H = 595, M = 36
  const header = (p: any) => {
    if (!logo) return
    const l = logoSize(30)
    p.drawImage(logo, { x: W - M - l.width, y: H - M - l.height + 10, width: l.width, height: l.height })
  }
  const firstOwn = out.getPageCount()

  if (image3d) {
    let img: any = null
    try { img = await out.embedPng(image3d) } catch { img = null }
    if (img) {
      const p = out.addPage([W, H])
      header(p)
      p.drawText(winAnsi(title), { x: M, y: H - M, size: 14, font: bold, color: ink })
      p.drawText(winAnsi(labels.view3d).toUpperCase(), { x: M, y: H - M - 20, size: 9, font: bold, color: teal })
      const boxW = W - 2 * M, boxH = H - 2 * M - 46
      const k = Math.min(boxW / img.width, boxH / img.height)
      const w = img.width * k, h = img.height * k
      p.drawImage(img, { x: M + (boxW - w) / 2, y: M + (boxH - h) / 2, width: w, height: h })
      p.drawRectangle({ x: M, y: M, width: boxW, height: boxH, borderColor: rgb(0.85, 0.89, 0.9), borderWidth: 0.6 })
    }
  }

  let page = out.addPage([W, H])
  header(page)
  let y = H - M
  const newPage = () => { page = out.addPage([W, H]); header(page); y = H - M - 30 }
  const need = (h: number) => { if (y - h < M) newPage() }
  page.drawText(winAnsi(title), { x: M, y, size: 14, font: bold, color: ink }); y -= 16
  page.drawText(winAnsi(subtitle), { x: M, y, size: 9, font, color: grey }); y -= 24

  const table = (heading: string, allCols: { label: string; x: number }[], allRows: { swatch: [number, number, number]; cells: string[] }[]) => {
    if (!allRows.length) return
    // Columns with nothing in them are left out (e.g. Packages when nothing comes in packages).
    const keep = allCols.map((_, i) => i === 0 || allRows.some(r => (r.cells[i] || '').trim() !== ''))
    const cols = allCols.filter((_, i) => keep[i])
    const rows = allRows.map(r => ({ ...r, cells: r.cells.filter((_, i) => keep[i]) }))
    need(40)
    page.drawText(winAnsi(heading).toUpperCase(), { x: M, y, size: 8.5, font: bold, color: ink }); y -= 14
    cols.forEach(c => page.drawText(winAnsi(c.label), { x: c.x, y, size: 8, font: bold, color: grey }))
    y -= 6
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.85, 0.89, 0.9) })
    y -= 12
    for (const r of rows) {
      need(16)
      page.drawRectangle({ x: M, y: y - 1, width: 9, height: 9, color: color(r.swatch) })
      r.cells.forEach((cell, i) => page.drawText(winAnsi(cell).slice(0, 80), { x: cols[i].x, y, size: 8.5, font: i === 0 ? bold : font, color: ink }))
      y -= 15
    }
    y -= 10
  }
  const section = (text: string) => {
    need(70)
    page.drawRectangle({ x: M, y: y - 5, width: W - 2 * M, height: 18, color: rgb(0.9, 0.96, 0.95) })
    page.drawText(winAnsi(text), { x: M + 6, y, size: 10, font: bold, color: teal })
    y -= 24
  }
  const itemCols = [{ label: labels.colItem, x: M + 16 }, { label: labels.colKind, x: M + 420 }, { label: labels.colQty, x: M + 530 }, { label: labels.colExtra, x: M + 640 }]
  const openCols = [{ label: labels.colItem, x: M + 16 }, { label: labels.colWall, x: M + 300 }, { label: labels.colQty, x: M + 530 }, { label: labels.colOpenArea, x: M + 640 }]
  const openCells = (r: ReturnType<typeof openingRows>[number]) => ({
    swatch: r.color,
    cells: [`${labels.openingKind[r.kind]} ${fmt(r.w)} × ${fmt(r.h)} m${r.sill > 0 ? ` · ${fmt(r.sill)} m` : ''}`, r.wall, `${r.count} ${labels.unit}`, `${fmt(r.areaM2)} m²`],
  })

  const matCols = [{ label: labels.colMaterial, x: M + 16 }, { label: labels.colKind, x: M + 420 }, { label: labels.colQty, x: M + 530 }, { label: labels.colPacks, x: M + 640 }]
  const matCells = (r: MaterialRow) => ({
    cells: [r.mat, labels.materialKind[r.kind], `${Number.isInteger(r.qty) ? String(r.qty) : fmt(r.qty)} ${r.unit}`, r.packs == null ? '' : `${r.packs}${r.packName ? ` ${r.packName}` : ''}`],
  })

  const withDetail = (r: { sub: string; detail?: 'length' | 'perimeter' | 'height' | 'sill' }) => (r.detail && r.sub ? `${labels.detail[r.detail]} ${r.sub}` : r.sub)
  const tagCols = [{ label: labels.colTag, x: M + 16 }, { label: labels.colItem, x: M + 110 }, { label: labels.colQty, x: M + 530 }, { label: labels.colExtra, x: M + 640 }]
  /** Materials under one heading per type (its colour and name), project or sheet. */
  const materialsTable = (groups: MaterialGroup[]) => {
    const list = groups.filter(g => g.rows.length)
    if (!list.length) return
    const anyPacks = list.some(g => g.rows.some(r => r.packs != null))
    const cols = matCols.filter((_, i) => i < 3 || anyPacks)
    need(56)
    page.drawText(winAnsi(labels.materials).toUpperCase(), { x: M, y, size: 8.5, font: bold, color: ink }); y -= 14
    cols.forEach(c => page.drawText(winAnsi(c.label), { x: c.x, y, size: 8, font: bold, color: grey }))
    y -= 6
    page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.85, 0.89, 0.9) })
    y -= 14
    for (const g of list) {
      need(34)
      page.drawRectangle({ x: M, y: y - 1, width: 9, height: 9, color: color(g.color) })
      page.drawText(winAnsi(g.name).slice(0, 110), { x: M + 16, y, size: 8.5, font: bold, color: ink })
      y -= 15
      for (const r of g.rows) {
        need(15)
        const cells = matCells(r).cells
        cells.forEach((cell, i) => { if (i < cols.length) page.drawText(winAnsi(cell).slice(0, i === 0 ? 75 : 40), { x: i === 0 ? cols[0].x + 12 : cols[i].x, y, size: 8, font, color: ink }) })
        y -= 13
      }
      y -= 4
    }
    y -= 8
  }

  for (const sheet of sheets) {
    section(sheet.heading)
    table(labels.items, itemCols, legendRows(sheet.items, sheet.ptPerM, fmt, labels.unit, labels.formwork).map(r => ({ swatch: r.color, cells: [r.name, labels.kind[r.kind], r.main, withDetail(r)] })))
    table(labels.openings, openCols, openingRows(sheet.items).map(openCells))
    materialsTable(sheet.materialGroups || [])
    table(labels.tags, tagCols, tagTableRows(sheet.items, sheet.ptPerM, fmt, labels.unit).map(r => ({ swatch: r.color, cells: [r.tag, r.name, r.main, withDetail(r)] })))
    table(labels.locations,
      [{ label: labels.colItem, x: M + 16 }, { label: labels.colArea, x: M + 420 }, { label: labels.colPerimeter, x: M + 530 }],
      zoneRows(sheet.zones, sheet.ptPerM, fmt).map(z => ({ swatch: z.color, cells: [z.name, z.area, z.perimeter] })))
  }

  // Project totals (typical floors counted once per floor) when there is more than one floor.
  const floors = sheets.reduce((n, s) => n + Math.max(1, s.multiplier || 1), 0)
  const totals = projectTotals(sheets, fmt, labels.unit, labels.formwork)
  if (floors > 1 && totals.length) {
    section(labels.totals)
    page.drawText(winAnsi(labels.totalsNote), { x: M, y, size: 8, font, color: grey }); y -= 16
    table(labels.items, itemCols, totals.map(r => ({ swatch: r.color, cells: [r.name, labels.kind[r.kind], r.main, withDetail(r)] })))
    table(labels.openings, openCols, projectOpeningRows(sheets).map(openCells))
    materialsTable(projectMaterialGroups(sheets.map(s => ({ groups: s.materialGroups || [], multiplier: s.multiplier }))))
  }

  for (let i = firstOwn; i < out.getPageCount(); i++) out.getPage(i).drawText(winAnsi(labels.footer), { x: M, y: M - 14, size: 7, font, color: grey })

  const saved: Uint8Array = await out.save()
  return new Blob([saved as BlobPart], { type: 'application/pdf' })
}
/* eslint-enable @typescript-eslint/no-explicit-any */
