// Field sheet PDF (RitsuScope › Tarefas): one A4 landscape page for one location.
// Left: the location (its zone + 1 m) cut out of the original sheet, still vector, with the estimate
// takeoff faint and the planning lines in their activity colours and labels. Right: title block with
// the location, the activities and quantities, the revision, and the location's FieldOp QR code.
import { buildMarks, invert, winAnsi, type Matrix } from '@/lib/takeoff/printMarkup'
import type { TakeoffItem, Vec2 } from '@/lib/takeoff/geometry'
import { fitCrop, printedRatio, userBox, wrapText } from '@/lib/takeoff/fieldSheet'
import { hexToRgb } from '@/lib/takeoff/printMarkup'
import { loadPdfLib } from './printPdf'
import { ICON_PATHS } from './icons'

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
  for (const m of buildMarks(items, [], toUser, ptPerM, fmt)) {
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

  const bytes = await out.save()
  return new Blob([bytes], { type: 'application/pdf' })
}
