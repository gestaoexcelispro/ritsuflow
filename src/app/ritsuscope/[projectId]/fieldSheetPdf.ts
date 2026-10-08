// Field sheet PDF (RitsuScope › Tarefas): one A4 landscape page for one location.
// Left: the location (its zone + 1 m) cut out of the original sheet, still vector, with the estimate
// takeoff faint and the planning lines in their activity colours and labels. Right: title block with
// the location, the activities and quantities, the revision, and the location's FieldOp QR code.
import { buildMarks, invert, winAnsi, type Matrix } from '@/lib/takeoff/printMarkup'
import type { TakeoffItem, Vec2 } from '@/lib/takeoff/geometry'
import { TASK_TAG_PT, fitCrop, printedRatio, tagBox, userBox, wrapText } from '@/lib/takeoff/fieldSheet'
import { hexToRgb } from '@/lib/takeoff/printMarkup'
import { loadPdfLib } from './printPdf'
import { ICON_PATHS } from './icons'
import { layoutLabels } from '@/lib/takeoff/labelLayout'
import { studGaps, type FieldElevation, type WallCard } from '@/lib/takeoff/fieldSheetData'

/** One row of the task table, already formatted. */
export type FieldTaskCells = { color: string; tag: string; activity: string; wall: string; face: string; length: string; height: string; openings: string; qty: string }

/** Labels of pages 2, 3 and 5. */
export type FieldPagesText = {
  view3dTitle: string
  tasksTitle: string
  taskCols: [string, string, string, string, string, string, string, string]
  wallsTitle: string
  faceA: string
  faceB: string
  elevationsTitle: string
  elevationsNote: string
  studs: (n: number) => string
  sequenceTitle: string
  seqCols: [string, string, string, string, string]
  logTitle: string
  logCols: [string, string, string, string, string, string]
  historyTitle: string
  histCols: [string, string, string]
  pageOf: (n: number, total: number) => string
}

/** A material line: what to take (whole bars / sheets / packs) and the exact quantity. */
export type FieldMaterialRow = { mat: string; whole: string; exact: string }

export type FieldSheetRow = { color: string; code: string; name: string; qty: string; detail?: string }

export type FieldSheetInput = {
  url: string
  pageNumber: number
  ptPerM: number
  /** Viewport box (PDF points, y down) to cut out (the zone + margin, or a drawn area); null = the whole sheet. */
  frame: [number, number, number, number] | null
  paper?: 'A4' | 'A3'
  /** What goes in the title block (all on by default). */
  show?: { table?: boolean; detail?: boolean; qr?: boolean }
  /** Extra header fields, printed when filled. */
  info?: { responsible?: string; crew?: string; dates?: string; notes?: string }
  /** Materials page: per activity (colour, title, rows) and the location summary; skipped when null. */
  materials?: { groups: { color: string; title: string; rows: FieldMaterialRow[] }[]; summary: FieldMaterialRow[] | null } | null
  /** Page 2: the location in 3D (PNG) and the task table. */
  view3d?: Uint8Array | null
  tasks?: FieldTaskCells[] | null
  /** Page 3: wall type cards and the framing elevation of each wall stretch. */
  walls?: { card: WallCard; spec: [string, string][] }[] | null
  elevations?: FieldElevation[] | null
  /** Page 5: order of work with hold points, the production log and the revision history. */
  sequence?: { color: string | null; title: string; check: string; hold?: boolean }[] | null
  log?: { color: string; tag: string; activity: string }[] | null
  history?: { rev: string; date: string; by: string; current?: boolean }[] | null
  pages?: FieldPagesText
  /** Estimate takeoff (faint) and planning lines (with tags), on this sheet. */
  items: TakeoffItem[]
  zone: { name: string; pts: Vec2[] }
  backgroundFade?: number
  rows: FieldSheetRow[]
  /** Absolute URL of the location's FieldOp scan page (QR); skipped when null. */
  qrUrl: string | null
  logoUrl?: string
  text: {
    kicker: string // "FICHA DE CAMPO"
    location: string
    path: string // project · level · sheet
    scope: string // "Todas as atividades" / "Atividade 1.1"
    revision: string // "REV 0"
    issued: string // "Emitida em 08/10/2026 por Eduardo"
    responsible?: string // "Responsável"
    crew?: string // "Equipe"
    dates?: string // "Prazo"
    notes?: string // "Observações"
    responsible?: string // "Responsável"
    crew?: string // "Equipe"
    dates?: string // "Prazo"
    notes?: string // "Observações"
    activities: string
    qrCaption: string
    scale: string // "Escala aprox. 1:{ratio} · local + 1 m" with {ratio}
    footer: string
    draft?: string // "PRÉVIA · NÃO EMITIDA" watermark when previewing
    materialsTitle?: string
    materialsSummary?: string
    colMaterial?: string
    colTake?: string
    colExact?: string
    materialsNote?: string
  }
  fmt: (v: number) => string
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function qrPath(value: string): Promise<{ d: string; size: number } | null> {
  try {
    const [{ createElement }, { renderToStaticMarkup }, { QRCodeSVG }] = await Promise.all([import('react'), import('react-dom/server'), import('qrcode.react')])
    const svg = renderToStaticMarkup(createElement(QRCodeSVG, { value, size: 256, level: 'M', marginSize: 0 }))
    const vb = /viewBox="0 0 (\d+) (\d+)"/.exec(svg)
    const paths = [...svg.matchAll(/<path[^>]*?fill="([^"]+)"[^>]*?d="([^"]+)"|<path[^>]*?d="([^"]+)"[^>]*?fill="([^"]+)"/g)]
      .map(m => ({ fill: (m[1] || m[4] || '').toLowerCase(), d: m[2] || m[3] || '' }))
    const fg = paths.find(p => p.fill !== '#ffffff' && p.fill !== 'white' && p.d)
    if (!vb || !fg) return null
    return { d: fg.d, size: Number(vb[1]) }
  } catch { return null }
}

export async function buildFieldSheetPdf(input: FieldSheetInput): Promise<Blob> {
  const { url, pageNumber, ptPerM, items, zone, backgroundFade = 0, rows, logoUrl, text, fmt, paper = 'A4', info = {} } = input
  const show = { table: true, detail: true, qr: true, ...(input.show || {}) }
  const qrUrl = show.qr ? input.qrUrl : null
  const [PDFLib, srcBytes, logoBytes, qr] = await Promise.all([
    loadPdfLib(),
    fetch(url).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.arrayBuffer() }),
    logoUrl ? fetch(logoUrl).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null) : Promise.resolve(null),
    qrUrl ? qrPath(qrUrl) : Promise.resolve(null),
  ])
  const { PDFDocument, StandardFonts, rgb, LineCapStyle, pushGraphicsState, popGraphicsState, rectangle, clip, endPath, degrees } = PDFLib

  // Page transform (viewport → user space), from pdf.js like the project print.
  const pdfjs = await import('pdfjs-dist-v5')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  let toUser: Matrix
  let frame: [number, number, number, number]
  {
    const task = pdfjs.getDocument({ data: new Uint8Array(srcBytes.slice(0)) })
    try {
      const doc = await task.promise
      const page = await doc.getPage(pageNumber)
      const vp = page.getViewport({ scale: 1 })
      toUser = invert(vp.transform as Matrix)
      frame = input.frame || [0, 0, vp.width, vp.height]
    } finally { await task.destroy() }
  }

  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const bold = await out.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.09, 0.2, 0.25), grey = rgb(0.4, 0.48, 0.52), teal = rgb(0.06, 0.62, 0.57), line = rgb(0.83, 0.88, 0.89)
  const col = (hex: string | [number, number, number]) => { const c = typeof hex === 'string' ? hexToRgb(hex) : hex; return rgb(c[0], c[1], c[2]) }
  const [W, H] = paper === 'A3' ? [1191, 842] : [842, 595]
  const M = paper === 'A3' ? 28 : 22
  const page = out.addPage([W, H])

  // ---- Map: the location cut out of the original sheet (vector), clipped to its frame.
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true })
  const crop = userBox(frame, toUser)
  const COL = paper === 'A3' ? 300 : 246
  const area = { x: M, y: M + 16, w: W - 2 * M - COL - 14, h: H - 2 * M - 16 }
  const fit = fitCrop(crop, area)
  const embedded = await out.embedPage(src.getPage(pageNumber - 1), crop)
  page.drawRectangle({ x: area.x, y: area.y, width: area.w, height: area.h, color: rgb(1, 1, 1) })
  page.pushOperators(pushGraphicsState(), rectangle(area.x, area.y, area.w, area.h), clip(), endPath())
  page.drawPage(embedded, { x: fit.x, y: fit.y, width: fit.w, height: fit.h })
  if (backgroundFade > 0) page.drawRectangle({ x: area.x, y: area.y, width: area.w, height: area.h, color: rgb(1, 1, 1), opacity: Math.min(0.8, backgroundFade) })

  const k = fit.k
  const P = (p: Vec2) => fit.map(p)
  const pathOf = (pts: Vec2[], close: boolean) => pts.map((p, i) => { const q = P(p); return `${i ? 'L' : 'M'}${q[0].toFixed(2)},${(-q[1]).toFixed(2)}` }).join(' ') + (close ? ' Z' : '')
  // The location's outline (dashed) under everything else.
  const zUser = zone.pts.map(p => [toUser[0] * p[0] + toUser[2] * p[1] + toUser[4], toUser[1] * p[0] + toUser[3] * p[1] + toUser[5]] as Vec2)
  if (zUser.length >= 3) page.drawSvgPath(pathOf(zUser, true), { x: 0, y: 0, color: rgb(0.05, 0.65, 0.91), opacity: 0.06, borderColor: rgb(0.05, 0.65, 0.91), borderWidth: 1, borderDashArray: [5, 3] })

  const tagScale = 1.15
  const marks = buildMarks(items, [], toUser, ptPerM, fmt)
  for (const m of marks) {
    if (m.type === 'polygon') page.drawSvgPath(pathOf(m.pts, true), { x: 0, y: 0, color: col(m.color), opacity: m.fillOpacity, borderColor: col(m.color), borderWidth: m.borderWidth, borderOpacity: 0.6 })
    else if (m.type === 'polyline') page.drawSvgPath(pathOf(m.pts, false), { x: 0, y: 0, borderColor: col(m.color), borderWidth: Math.max(0.6, m.width * k), borderOpacity: m.opacity, borderLineCap: m.flat ? LineCapStyle.Butt : LineCapStyle.Round })
    else if (m.type === 'opening') {
      const a = P(m.a), b = P(m.b), at = P(m.at)
      page.drawLine({ start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, thickness: Math.max(0.8, m.width * k), color: col(m.color), opacity: 0.85 })
      page.drawCircle({ x: at[0], y: at[1], size: 6, color: rgb(1, 1, 1), borderColor: col(m.color), borderWidth: 0.8 })
      const icon = ICON_PATHS[m.kind === 'door' ? 'door' : m.kind === 'window' ? 'window' : 'opening']
      page.drawSvgPath(icon, { x: at[0] - 3.6, y: at[1] + 3.6, scale: 0.3, borderColor: col(m.color), borderWidth: 2.4, borderLineCap: LineCapStyle.Round })
    } else if (m.type === 'tag') {
      const at = P(m.at)
      const t = winAnsi(m.text)
      const size = 6.5 * tagScale
      const w = bold.widthOfTextAtSize(t, size) + 6
      page.drawRectangle({ x: at[0] - w / 2, y: at[1] - 5, width: w, height: 10.5, color: rgb(1, 1, 1), opacity: 0.95, borderColor: col(m.color), borderWidth: 0.9 })
      page.drawText(t, { x: at[0] - w / 2 + 3, y: at[1] - 2.4, size, font: bold, color: col(m.color) })
    } else if (m.type === 'dot') {
      const at = P(m.at)
      page.drawCircle({ x: at[0], y: at[1], size: Math.max(2, m.radius * Math.min(2, k)), color: col(m.color), opacity: m.opacity ?? 1 })
    }
  }
  // Callout tags of the planning lines: labels apart from the lines (no overlaps), each with a leader to its line.
  // Placed in the map's own space (y down from its top edge); a label the user moved on screen stays there.
  {
    // Same paper height as on screen (2.5 mm at the sheet's scale), times the map's enlargement; never below 4 pt.
    const size = Math.max(4, TASK_TAG_PT * k), h = tagBox(1, size).h
    const calls = marks.filter((m): m is Extract<typeof m, { type: 'callout' }> => m.type === 'callout').map(m => {
      const t = winAnsi(m.text)
      const a = P(m.anchor)
      const f = m.fixed ? P(m.fixed) : null
      return { m, t, id: m.id, x: a[0] - area.x, y: area.y + area.h - a[1], w: bold.widthOfTextAtSize(t, size) + size * 1.2, h, fixed: f ? [f[0] - area.x, area.y + area.h - f[1]] as [number, number] : null }
    })
    const back = (x: number, yd: number) => ({ x: area.x + x, y: area.y + area.h - yd })
    for (const l of layoutLabels(calls, area.w, area.h, Math.max(0.3, h / 15))) {
      const c = calls.find(x => x.id === l.id)!
      const color = col(c.m.color)
      const an = back(l.x, l.y), le = back(l.lx, l.ly), bc = back(l.bx, l.by)
      page.drawLine({ start: an, end: le, thickness: 0.7, color })
      page.drawCircle({ x: an.x, y: an.y, size: 1.6, color, borderColor: rgb(1, 1, 1), borderWidth: 0.4 })
      page.drawRectangle({ x: bc.x - c.w / 2, y: bc.y - h / 2, width: c.w, height: h, color: rgb(1, 1, 1), opacity: 0.97, borderColor: color, borderWidth: 0.9 })
      page.drawText(c.t, { x: bc.x - bold.widthOfTextAtSize(c.t, size) / 2, y: bc.y - size * 0.36, size, font: bold, color })
    }
  }
  page.pushOperators(popGraphicsState())
  page.drawRectangle({ x: area.x, y: area.y, width: area.w, height: area.h, borderColor: line, borderWidth: 0.8 })
  const ratio = printedRatio(ptPerM, k)
  page.drawText(winAnsi(text.scale.replace('{ratio}', ratio ? String(ratio) : '—')), { x: area.x, y: M + 4, size: 7.5, font, color: grey })

  // ---- Title block (right column).
  const X = area.x + area.w + 14, CW = W - M - X
  let y = H - M
  let logo: any = null
  if (logoBytes) { try { logo = await out.embedPng(logoBytes) } catch { logo = null } }
  if (logo) { const h = 24, w = (logo.width / logo.height) * h; page.drawImage(logo, { x: X, y: y - h, width: w, height: h }); y -= h + 10 }
  page.drawText(winAnsi(text.kicker), { x: X, y: y - 8, size: 8, font: bold, color: teal }); y -= 26
  for (const l of wrapText(winAnsi(text.location), CW, s => bold.widthOfTextAtSize(s, 17), 2)) { page.drawText(l, { x: X, y, size: 17, font: bold, color: ink }); y -= 20 }
  for (const l of wrapText(winAnsi(text.path), CW, s => font.widthOfTextAtSize(s, 8), 2)) { page.drawText(l, { x: X, y, size: 8, font, color: grey }); y -= 11 }
  y -= 4
  page.drawText(winAnsi(text.scope), { x: X, y, size: 9, font: bold, color: ink }); y -= 16
  const infoLines: [string | undefined, string | undefined][] = [[text.responsible, info.responsible], [text.crew, info.crew], [text.dates, info.dates]]
  for (const [label, value] of infoLines) {
    if (!value || !value.trim()) continue
    const l = winAnsi(`${label || ''}: `), v = winAnsi(value.trim())
    page.drawText(l, { x: X, y, size: 8, font: bold, color: grey })
    const lw = bold.widthOfTextAtSize(l, 8)
    wrapText(v, CW - lw, s2 => font.widthOfTextAtSize(s2, 8), 2).forEach((ln, i) => page.drawText(ln, { x: X + (i ? 0 : lw), y: y - i * 10, size: 8, font, color: ink }))
    y -= v.length && font.widthOfTextAtSize(v, 8) > CW - lw ? 22 : 12
  }
  y -= 2

  // Revision box.
  page.drawRectangle({ x: X, y: y - 34, width: CW, height: 38, color: rgb(0.94, 0.98, 0.97), borderColor: teal, borderWidth: 0.8 })
  const revText = winAnsi(text.revision)
  const revW = bold.widthOfTextAtSize(revText, 15)
  page.drawText(revText, { x: X + 8, y: y - 17, size: 15, font: bold, color: teal })
  // The issue line sits after the revision stamp, however long it is ("REV 12", "PRÉVIA", "PREVIEW").
  const ix = X + 8 + revW + 10
  const issued = wrapText(winAnsi(text.issued), X + CW - 6 - ix, s => font.widthOfTextAtSize(s, 7), 2)
  issued.forEach((l, i) => page.drawText(l, { x: ix, y: y - 12 - i * 9, size: 7, font, color: grey }))
  y -= 50

  // Activities and quantities.
  const qrSize = qr ? 92 : 0
  const notes = (info.notes || '').trim()
  const noteLines = notes ? wrapText(winAnsi(notes), CW - 8, s2 => font.widthOfTextAtSize(s2, 7.5), 6) : []
  const notesH = noteLines.length ? 18 + noteLines.length * 10 : 0
  const bottomLimit = M + (qr ? qrSize + 26 : 10) + notesH
  if (show.table) {
  page.drawText(winAnsi(text.activities).toUpperCase(), { x: X, y, size: 7.5, font: bold, color: grey }); y -= 6
  page.drawLine({ start: { x: X, y }, end: { x: X + CW, y }, thickness: 0.5, color: line }); y -= 12
  for (const r0 of rows) {
    const r = show.detail ? r0 : { ...r0, detail: undefined }
    const qty = winAnsi(r.qty)
    const qw = bold.widthOfTextAtSize(qty, 8.5)
    const nameLines = wrapText(winAnsi(`${r.code} ${r.name}`.trim()), CW - qw - 22, s => font.widthOfTextAtSize(s, 7.8), 2)
    const need = nameLines.length * 10 + (r.detail ? 9 : 0) + 6
    if (y - need < bottomLimit) break
    page.drawRectangle({ x: X, y: y - 1, width: 9, height: 7, color: col(r.color) })
    nameLines.forEach((l, i) => page.drawText(l, { x: X + 14, y: y - i * 10, size: 7.8, font, color: ink }))
    page.drawText(qty, { x: X + CW - qw, y, size: 8.5, font: bold, color: col(r.color) })
    y -= nameLines.length * 10
    if (r.detail) {
      for (const dl of wrapText(winAnsi(r.detail), CW - 14, s2 => font.widthOfTextAtSize(s2, 6.8), 2)) { page.drawText(dl, { x: X + 14, y, size: 6.8, font, color: grey }); y -= 9 }
    }
    y -= 5
  }
  }

  // Notes (above the QR code).
  if (noteLines.length) {
    const top = M + (qr ? qrSize + 26 : 10) + notesH
    page.drawText(winAnsi(text.notes || '').toUpperCase(), { x: X, y: top - 8, size: 7.5, font: bold, color: grey })
    page.drawRectangle({ x: X, y: top - notesH, width: CW, height: notesH - 12, color: rgb(0.98, 0.99, 0.99), borderColor: line, borderWidth: 0.6 })
    noteLines.forEach((l, i) => page.drawText(l, { x: X + 4, y: top - 22 - i * 10, size: 7.5, font, color: ink }))
  }

  // FieldOp QR code of the location.
  if (qr) {
    const s = qrSize / qr.size
    const qx = X, qy = M + 18 + qrSize
    page.drawRectangle({ x: qx - 4, y: M + 14, width: qrSize + 8, height: qrSize + 8, color: rgb(1, 1, 1), borderColor: line, borderWidth: 0.6 })
    page.drawSvgPath(qr.d, { x: qx, y: qy, scale: s, color: rgb(0, 0, 0) })
    for (const [i, l] of wrapText(winAnsi(text.qrCaption), CW - qrSize - 14, s2 => font.widthOfTextAtSize(s2, 7.5), 4).entries()) {
      page.drawText(l, { x: qx + qrSize + 12, y: qy - 10 - i * 10, size: 7.5, font, color: grey })
    }
  }
  page.drawText(winAnsi(text.footer), { x: X, y: M + 2, size: 6.5, font, color: grey })

  // Preview watermark.
  if (text.draft) {
    const t = winAnsi(text.draft)
    page.drawText(t, { x: area.x + 60, y: area.y + 40, size: 40, font: bold, color: rgb(0.86, 0.15, 0.27), opacity: 0.12, rotate: degrees(28) })
  }
  // ---- Shared look of the pages after the plan: logo, title, location · revision, footer.
  const subtitle = winAnsi(`${text.location} · ${text.revision} · ${text.issued}`)
  const pageHead = (pg: any, title: string) => {
    if (logo) { const h = 20, w = (logo.width / logo.height) * h; pg.drawImage(logo, { x: W - M - w, y: H - M - h + 4, width: w, height: h }) }
    pg.drawText(winAnsi(title), { x: M, y: H - M - 10, size: 14, font: bold, color: ink })
    pg.drawText(subtitle.slice(0, 160), { x: M, y: H - M - 24, size: 7.5, font, color: grey })
    pg.drawText(winAnsi(text.footer), { x: M, y: M - 10, size: 6.5, font, color: grey })
    return H - M - 40
  }
  const PT = input.pages
  /** Flowing writer: a cursor that starts new pages (same title) when the space runs out. */
  const flow = (title: string) => {
    const st = { p: out.addPage([W, H]) as any, y: 0 }
    st.y = pageHead(st.p, title)
    const need = (h: number) => { if (st.y - h < M + 6) { st.p = out.addPage([W, H]); st.y = pageHead(st.p, title) } }
    return { st, need }
  }
  /** A table with fixed column widths (fractions of the width); returns after the last row. */
  const drawTable = (f: ReturnType<typeof flow>, cols: { label: string; w: number; align?: 'right' }[], rows: { cells: string[]; color?: string | null; fill?: [number, number, number] | null; bold?: boolean }[], opts: { rowH?: number; size?: number; x?: number; width?: number } = {}) => {
    const x0 = opts.x ?? M, TW = opts.width ?? W - 2 * M, rowH = opts.rowH ?? 14, size = opts.size ?? 7.8
    const xs: number[] = []
    let acc = x0
    for (const c of cols) { xs.push(acc); acc += c.w * TW }
    const header = () => {
      f.need(rowH + 6)
      f.st.p.drawRectangle({ x: x0, y: f.st.y - rowH + 4, width: TW, height: rowH, color: rgb(0.93, 0.96, 0.96) })
      cols.forEach((c, i) => {
        const tx = winAnsi(c.label)
        const tw = bold.widthOfTextAtSize(tx, 7)
        f.st.p.drawText(tx, { x: c.align === 'right' ? xs[i] + c.w * TW - tw - 4 : xs[i] + 4, y: f.st.y - rowH / 2 + 1.5, size: 7, font: bold, color: grey })
      })
      f.st.y -= rowH
    }
    header()
    for (const r of rows) {
      if (f.st.y - rowH < M + 6) { f.need(rowH * 3); header() }
      if (r.fill) f.st.p.drawRectangle({ x: x0, y: f.st.y - rowH + 4, width: TW, height: rowH, color: rgb(r.fill[0], r.fill[1], r.fill[2]) })
      cols.forEach((c, i) => {
        let tx = winAnsi(r.cells[i] || '')
        const maxW = c.w * TW - 8 - (i === 0 && r.color ? 12 : 0)
        const fnt = r.bold || (i === 0 && r.color) ? bold : font
        while (tx.length > 1 && fnt.widthOfTextAtSize(tx, size) > maxW) tx = tx.slice(0, -2) + '…'
        const tw = fnt.widthOfTextAtSize(tx, size)
        let tx0 = c.align === 'right' ? xs[i] + c.w * TW - tw - 4 : xs[i] + 4
        if (i === 0 && r.color) { f.st.p.drawRectangle({ x: xs[i] + 4, y: f.st.y - rowH / 2 - 1, width: 8, height: 6, color: col(r.color) }); tx0 += 12 }
        f.st.p.drawText(tx, { x: tx0, y: f.st.y - rowH / 2 + 1.5, size, font: fnt, color: i === 0 && r.color ? col(r.color) : ink })
      })
      f.st.p.drawLine({ start: { x: x0, y: f.st.y - rowH + 4 }, end: { x: x0 + TW, y: f.st.y - rowH + 4 }, thickness: 0.4, color: line })
      f.st.y -= rowH
    }
    f.st.y -= 10
  }

  // ---- Page 2: the location in 3D and the task table.
  if (PT && (input.view3d || input.tasks?.length)) {
    const f = flow(PT.view3dTitle)
    if (input.view3d) {
      try {
        const img = await out.embedPng(input.view3d)
        const boxW = W - 2 * M, boxH = input.tasks?.length ? Math.min(H * 0.5, f.st.y - M - 80) : f.st.y - M - 10
        const s = Math.min(boxW / img.width, boxH / img.height)
        const iw = img.width * s, ih = img.height * s
        f.st.p.drawRectangle({ x: M, y: f.st.y - boxH, width: boxW, height: boxH, color: rgb(1, 1, 1), borderColor: line, borderWidth: 0.6 })
        f.st.p.drawImage(img, { x: M + (boxW - iw) / 2, y: f.st.y - boxH + (boxH - ih) / 2, width: iw, height: ih })
        f.st.y -= boxH + 16
      } catch { /* no picture: the table still prints */ }
    }
    if (input.tasks?.length) {
      f.need(40)
      f.st.p.drawText(winAnsi(PT.tasksTitle).toUpperCase(), { x: M, y: f.st.y, size: 8, font: bold, color: teal }); f.st.y -= 8
      const c = PT.taskCols
      drawTable(f, [{ label: c[0], w: 0.11 }, { label: c[1], w: 0.25 }, { label: c[2], w: 0.24 }, { label: c[3], w: 0.06 }, { label: c[4], w: 0.08, align: 'right' }, { label: c[5], w: 0.08, align: 'right' }, { label: c[6], w: 0.08, align: 'right' }, { label: c[7], w: 0.10, align: 'right' }],
        input.tasks.map(t => ({ color: t.color, cells: [t.tag, t.activity, t.wall, t.face, t.length, t.height, t.openings, t.qty] })))
    }
  }

  // ---- Page 3: wall type cards, then the framing elevation of each wall stretch.
  if (PT && (input.walls?.length || input.elevations?.length)) {
    const f = flow(PT.wallsTitle)
    for (const w of input.walls || []) {
      const cardH = Math.max(96, 22 + Math.ceil(w.spec.length / 2) * 12)
      f.need(cardH + 10)
      const top = f.st.y
      const p = f.st.p
      p.drawRectangle({ x: M, y: top - cardH, width: W - 2 * M, height: cardH, borderColor: line, borderWidth: 0.7, color: rgb(0.99, 1, 1) })
      p.drawRectangle({ x: M, y: top - cardH, width: 4, height: cardH, color: col(w.card.color) })
      p.drawText(winAnsi(w.card.name).slice(0, 110), { x: M + 12, y: top - 15, size: 10.5, font: bold, color: ink })
      // Specification in two columns (left 62% of the card).
      const specW = (W - 2 * M) * 0.62
      w.spec.forEach(([label, value], i) => {
        const cx = M + 12 + (i % 2) * (specW / 2), cy = top - 32 - Math.floor(i / 2) * 12
        const l = winAnsi(`${label}: `)
        const lw = bold.widthOfTextAtSize(l, 7)
        p.drawText(l, { x: cx, y: cy, size: 7, font: bold, color: grey })
        let v = winAnsi(value)
        while (v.length > 1 && font.widthOfTextAtSize(v, 7.3) > specW / 2 - lw - 10) v = v.slice(0, -2) + '…'
        p.drawText(v, { x: cx + lw, y: cy, size: 7.3, font, color: ink })
      })
      // Section across the wall (to scale): face A boards, the stud with insulation, face B boards.
      const c = w.card
      const total = c.faceA.layers * c.faceA.thkMm + c.coreMm + c.faceB.layers * c.faceB.thkMm
      const sx0 = M + 12 + specW + 14, sw = W - M - 14 - sx0
      const k3 = Math.min(sw / Math.max(total, 1), 1.6)
      const secH = Math.min(cardH - 40, 52)
      const sy = top - 24 - secH
      let x = sx0 + (sw - total * k3) / 2
      const boardCol = (n: string) => (/\bRU\b|umid|water|mold|moisture/i.test(n) ? rgb(0.43, 0.75, 0.49) : /\bRF\b|fogo|fire|type x/i.test(n) ? rgb(0.93, 0.56, 0.56) : rgb(0.86, 0.88, 0.9))
      const boards = (face: WallCard['faceA']) => { for (let i = 0; i < face.layers; i++) { p.drawRectangle({ x, y: sy, width: face.thkMm * k3, height: secH, color: boardCol(face.name), borderColor: grey, borderWidth: 0.4 }); x += face.thkMm * k3 } }
      const xa = x
      boards(c.faceA)
      const coreX = x, coreW = c.coreMm * k3
      if (c.insulation) {
        p.drawRectangle({ x: coreX, y: sy, width: coreW, height: secH, color: rgb(0.99, 0.95, 0.8) })
        const zig: string[] = []
        const n = 8
        for (let i = 0; i <= n; i++) zig.push(`${i ? 'L' : 'M'}${(coreX + (i % 2 ? coreW - 2 : 2)).toFixed(1)},${(-(sy + (secH * i) / n)).toFixed(1)}`)
        p.drawSvgPath(zig.join(' '), { x: 0, y: 0, borderColor: rgb(0.85, 0.65, 0.2), borderWidth: 0.6 })
      }
      // The stud: a C profile drawn as the web and two flanges.
      p.drawLine({ start: { x: coreX, y: sy + secH / 2 - 10 }, end: { x: coreX + coreW, y: sy + secH / 2 - 10 }, thickness: 1.2, color: ink })
      p.drawLine({ start: { x: coreX, y: sy + secH / 2 - 10 }, end: { x: coreX, y: sy + secH / 2 + 10 }, thickness: 1.2, color: ink })
      p.drawLine({ start: { x: coreX + coreW, y: sy + secH / 2 - 10 }, end: { x: coreX + coreW, y: sy + secH / 2 + 10 }, thickness: 1.2, color: ink })
      x = coreX + coreW
      boards(c.faceB)
      p.drawText(winAnsi(PT.faceA), { x: xa - 4 - bold.widthOfTextAtSize(winAnsi(PT.faceA), 7), y: sy + secH / 2 - 2, size: 7, font: bold, color: grey })
      p.drawText(winAnsi(PT.faceB), { x: x + 4, y: sy + secH / 2 - 2, size: 7, font: bold, color: grey })
      const totTxt = winAnsi(`${fmt(total)} mm`)
      p.drawText(totTxt, { x: sx0 + (sw - font.widthOfTextAtSize(totTxt, 7)) / 2, y: sy - 10, size: 7, font, color: grey })
      f.st.y = top - cardH - 12
    }
    const els = input.elevations || []
    if (els.length) {
      f.need(60)
      f.st.p.drawText(winAnsi(PT.elevationsTitle).toUpperCase(), { x: M, y: f.st.y, size: 8, font: bold, color: teal })
      f.st.p.drawText(winAnsi(PT.elevationsNote), { x: M + bold.widthOfTextAtSize(winAnsi(PT.elevationsTitle).toUpperCase(), 8) + 10, y: f.st.y, size: 6.8, font, color: grey })
      f.st.y -= 12
      const colsN = 2, gap = 14
      const cellW = (W - 2 * M - gap * (colsN - 1)) / colsN, cellH = paper === 'A3' ? 230 : 160
      for (let i = 0; i < els.length; i += colsN) {
        f.need(cellH)
        const top = f.st.y
        for (let j = 0; j < colsN && i + j < els.length; j++) drawElevation(f.st.p, els[i + j], M + j * (cellW + gap), top - cellH, cellW, cellH)
        f.st.y = top - cellH - 8
      }
    }
  }

  /** One framing elevation in a box: the stretch to scale, studs, tracks, headers, openings and the stud spacing below. */
  function drawElevation(p: any, e: FieldElevation, bx: number, by: number, bw: number, bh: number) {
    const c = col(e.color)
    const title = winAnsi(`${e.tags.join(', ')} · ${e.wall}`)
    let tt = title
    while (tt.length > 1 && bold.widthOfTextAtSize(tt, 8) > bw - 4) tt = tt.slice(0, -2) + '…'
    p.drawText(tt, { x: bx, y: by + bh - 9, size: 8, font: bold, color: c })
    const meta = winAnsi(`${fmt(e.lengthM)} × ${fmt(e.heightM)} m · ${PT!.studs(e.studs.length)} · ${fmt(e.spacingM)} m`)
    p.drawText(meta, { x: bx, y: by + bh - 19, size: 6.8, font, color: grey })
    const L = Math.max(e.lengthM, 0.1), Hh = Math.max(e.heightM, 0.1)
    const s = Math.min((bw - 24) / L, (bh - 54) / Hh)
    const ox = bx + 12 + (bw - 24 - L * s) / 2, oy = by + 24
    const X = (v: number) => ox + v * s, Y = (v: number) => oy + v * s
    p.drawRectangle({ x: X(0), y: Y(0), width: L * s, height: Hh * s, color: rgb(0.98, 0.99, 0.99), borderColor: line, borderWidth: 0.5 })
    for (const o of e.openings) {
      p.drawRectangle({ x: X(o.x0), y: Y(o.y0), width: (o.x1 - o.x0) * s, height: (o.y1 - o.y0) * s, color: o.kind === 'window' ? rgb(0.88, 0.95, 1) : rgb(1, 0.95, 0.88), borderColor: o.kind === 'window' ? rgb(0.01, 0.52, 0.78) : rgb(0.71, 0.33, 0.04), borderWidth: 0.6, borderDashArray: [2, 1.5] })
    }
    for (const t of e.tracks) p.drawLine({ start: { x: X(t.x0), y: Y(t.y) }, end: { x: X(t.x1), y: Y(t.y) }, thickness: 1.8, color: rgb(0.45, 0.52, 0.56) })
    for (const h of e.headers) p.drawLine({ start: { x: X(h.x0), y: Y(h.y) }, end: { x: X(h.x1), y: Y(h.y) }, thickness: 1.4, color: rgb(0.45, 0.52, 0.56) })
    for (const st of e.studs) p.drawLine({ start: { x: X(st.x), y: Y(st.y0) }, end: { x: X(st.x), y: Y(st.y1) }, thickness: st.kind === 'batente' ? 1.4 : st.kind === 'complemento' ? 0.6 : 0.9, color: c, opacity: st.kind === 'complemento' ? 0.7 : 1 })
    // Dimension chain: one tick per stud, the gap written when it fits.
    const dy = oy - 9
    p.drawLine({ start: { x: X(0), y: dy }, end: { x: X(L), y: dy }, thickness: 0.4, color: grey })
    const gaps = studGaps(e.studs, L)
    let acc = 0
    p.drawLine({ start: { x: X(0), y: dy - 2.5 }, end: { x: X(0), y: dy + 2.5 }, thickness: 0.4, color: grey })
    for (const g of gaps) {
      const a = acc
      acc += g
      p.drawLine({ start: { x: X(acc), y: dy - 2.5 }, end: { x: X(acc), y: dy + 2.5 }, thickness: 0.4, color: grey })
      const label = fmt(g)
      const lw = font.widthOfTextAtSize(label, 5)
      if (g * s > lw + 2) p.drawText(label, { x: X(a + g / 2) - lw / 2, y: dy + 2, size: 5, font, color: grey })
    }
    const total = winAnsi(`${fmt(L)} m`)
    p.drawText(total, { x: X(L / 2) - font.widthOfTextAtSize(total, 6.5) / 2, y: dy - 10, size: 6.5, font: bold, color: ink })
    const hTxt = winAnsi(`${fmt(Hh)} m`)
    p.drawText(hTxt, { x: X(0) - 4, y: Y(Hh / 2), size: 6, font, color: grey, rotate: degrees(90) })
  }

  // ---- Materials page(s): per activity, then the location summary.
  const mats = input.materials
  if (mats && (mats.groups.length || mats.summary?.length)) {
    let p = out.addPage([W, H])
    let yy = H - M
    const colTake = W - M - 230, colExact = W - M - 110
    const head = () => {
      if (logo) { const h = 22, w = (logo.width / logo.height) * h; p.drawImage(logo, { x: W - M - w, y: H - M - h + 6, width: w, height: h }) }
      p.drawText(winAnsi(text.materialsTitle || ''), { x: M, y: yy - 4, size: 14, font: bold, color: ink }); yy -= 18
      p.drawText(winAnsi(`${text.revision} · ${text.issued}`), { x: M, y: yy - 2, size: 8, font, color: grey }); yy -= 20
    }
    const newPage = () => { p = out.addPage([W, H]); yy = H - M; head() }
    const need = (h: number) => { if (yy - h < M + 20) newPage() }
    head()
    const table = (title: string, color: string | null, rows: FieldMaterialRow[]) => {
      if (!rows.length) return
      need(48)
      if (color) p.drawRectangle({ x: M, y: yy - 2, width: 10, height: 8, color: col(color) })
      p.drawText(winAnsi(title).slice(0, 120), { x: M + (color ? 16 : 0), y: yy, size: 10, font: bold, color: color ? col(color) : teal }); yy -= 14
      p.drawText(winAnsi(text.colMaterial || ''), { x: M + 16, y: yy, size: 7.5, font: bold, color: grey })
      p.drawText(winAnsi(text.colTake || ''), { x: colTake, y: yy, size: 7.5, font: bold, color: grey })
      p.drawText(winAnsi(text.colExact || ''), { x: colExact, y: yy, size: 7.5, font: bold, color: grey }); yy -= 5
      p.drawLine({ start: { x: M, y: yy }, end: { x: W - M, y: yy }, thickness: 0.5, color: line }); yy -= 12
      for (const r of rows) {
        need(14)
        p.drawText(winAnsi(r.mat).slice(0, 110), { x: M + 16, y: yy, size: 8.5, font, color: ink })
        p.drawText(winAnsi(r.whole), { x: colTake, y: yy, size: 8.5, font: bold, color: ink })
        p.drawText(winAnsi(r.exact), { x: colExact, y: yy, size: 8, font, color: grey })
        yy -= 13
      }
      yy -= 10
    }
    for (const g of mats.groups) table(g.title, g.color, g.rows)
    if (mats.summary?.length) {
      need(60)
      p.drawRectangle({ x: M, y: yy - 6, width: W - 2 * M, height: 20, color: rgb(0.9, 0.96, 0.95) })
      yy -= 2
      table(text.materialsSummary || '', null, mats.summary)
    }
    if (text.materialsNote) { need(16); p.drawText(winAnsi(text.materialsNote), { x: M, y: Math.max(M, yy - 4), size: 7, font, color: grey }) }
  }

  // ---- Page 5: order of work with hold points, the production log to fill in, the revision history.
  if (PT && (input.sequence?.length || input.log?.length || input.history?.length)) {
    const f = flow(PT.sequenceTitle)
    if (input.sequence?.length) {
      const c = PT.seqCols
      let n = 0
      drawTable(f, [{ label: c[0], w: 0.05 }, { label: c[1], w: 0.33 }, { label: c[2], w: 0.36 }, { label: c[3], w: 0.15 }, { label: c[4], w: 0.11 }],
        input.sequence.map(r => (r.hold
          ? { cells: ['', r.title, r.check, '', ''], fill: [1, 0.95, 0.8] as [number, number, number], bold: true }
          : { cells: [String(++n), r.title, r.check, '', ''], color: null })), { rowH: 18 })
    }
    if (input.log?.length) {
      f.need(60)
      f.st.p.drawText(winAnsi(PT.logTitle).toUpperCase(), { x: M, y: f.st.y, size: 8, font: bold, color: teal }); f.st.y -= 8
      const c = PT.logCols
      drawTable(f, [{ label: c[0], w: 0.11 }, { label: c[1], w: 0.27 }, { label: c[2], w: 0.11 }, { label: c[3], w: 0.17 }, { label: c[4], w: 0.08 }, { label: c[5], w: 0.26 }],
        [...input.log.map(r => ({ color: r.color, cells: [r.tag, r.activity, '', '', '', ''] })), ...[0, 1, 2].map(() => ({ cells: ['', '', '', '', '', ''] }))], { rowH: 20 })
    }
    if (input.history?.length) {
      f.need(50)
      f.st.p.drawText(winAnsi(PT.historyTitle).toUpperCase(), { x: M, y: f.st.y, size: 8, font: bold, color: teal }); f.st.y -= 8
      const c = PT.histCols
      drawTable(f, [{ label: c[0], w: 0.15 }, { label: c[1], w: 0.25 }, { label: c[2], w: 0.6 }],
        input.history.map(h => ({ cells: [h.rev, h.date, h.by], bold: !!h.current })), { width: (W - 2 * M) * 0.6 })
    }
  }

  // Page numbers on every page ("2 / 5").
  if (PT) {
    const pages = out.getPages()
    pages.forEach((pg: any, i: number) => {
      const t = winAnsi(PT.pageOf(i + 1, pages.length))
      pg.drawText(t, { x: W - M - font.widthOfTextAtSize(t, 6.5), y: M - 10, size: 6.5, font, color: grey })
    })
  }

  const bytes = await out.save()
  return new Blob([bytes], { type: 'application/pdf' })
}
