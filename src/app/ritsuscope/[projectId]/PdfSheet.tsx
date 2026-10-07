'use client'

import { MouseEvent, useEffect, useRef, useState } from 'react'
import { dist, polyLen, type LayerKind, type TakeoffItem, type Vec2 } from '@/lib/takeoff/geometry'
import { planOpacity } from '@/lib/takeoff/planOpacity'
import { extractPdfSegments, findSnap, type SnapPoint, type VectorSegment } from '@/lib/takeoff/pdfSnapEngine'
import { extractPdfVectors } from '@/lib/takeoff/detect/pdfVectors'
import type { VSeg } from '@/lib/takeoff/detect/walls'
import { centroid, type SheetText } from '@/lib/takeoff/zones'
import { wallBand } from '@/lib/takeoff/faceWall'
import { openingMarks } from '@/lib/takeoff/openingMarks'
import { areaAt, paintOrder } from '@/lib/takeoff/pick'
import { ICON_PATHS } from './icons'

export type Suggestion = { id: string; pts: [Vec2, Vec2]; on: boolean }
export type ZoneShape = { id: string; name: string; color: string; pts: Vec2[]; label: string; selected: boolean; suggested?: boolean; on?: boolean; /** Block / Zone / Area: dashed outline, light fill, label at the top. */ macro?: boolean }

/** Largest canvas side we render; beyond this the browser scales the bitmap. */
const MAX_CANVAS_SIDE = 8192
const NO_IDS: ReadonlySet<string> = new Set()
/** Extra area rendered on every side of the view (fraction of the view), so panning stays sharp without re-rendering. */
const DETAIL_MARGIN = 1
/** Re-render once less than this much (fraction of the view) of sharp area is left beyond the view's edge. */
const DETAIL_KEEP = 0.35
/** Cap on the sharp layer's size in device pixels (memory); the margin shrinks on very large screens. */
const DETAIL_MAX_PIXELS = 24_000_000
/** Short pause after scroll/zoom before rendering, so a fast pan or wheel zoom renders once. */
const DETAIL_DELAY_MS = 50

/** Nearest ancestor that scrolls; null means the window does. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let node = el?.parentElement ?? null; node; node = node.parentElement) {
    const { overflow, overflowX, overflowY } = getComputedStyle(node)
    if (/(auto|scroll)/.test(overflow + overflowX + overflowY)) return node
  }
  return null
}

type Props = {
  url: string
  pageNumber: number
  zoom: number
  items: TakeoffItem[]
  /** Points picked so far for calibration (0–2). */
  calibration: Vec2[]
  /** Points of the element being drawn. */
  draft: Vec2[]
  draftKind: LayerKind | null
  draftColor: string
  crosshair: boolean
  /** Measure tool points (not saved) and whether the measurement was closed with a double-click. */
  measure?: Vec2[]
  measureDone?: boolean
  /** Area layers: preview a rectangle from the first click to the cursor. */
  rectPreview?: boolean
  /** Sheet scale (PDF points per metre); 0 hides live lengths. */
  ptPerM?: number
  fmt?: (v: number) => string
  /** Snap to PDF vector lines (endpoints, intersections, midpoints, nearest). */
  snap: boolean
  /** Show the tag of each wall stretch (DW01-03…) at its middle. */
  showTags?: boolean
  /** White wash over the source drawing (0…0.8), so takeoff colours read true on coloured PDFs. */
  backgroundFade?: number
  /** Select mode: shapes are clickable. */
  selectable: boolean
  selectedId: string | null
  onSelect: (elementId: string | null) => void
  /** Elements picked with a selection box (highlighted like the selected one). */
  multiSelected?: ReadonlySet<string>
  /** Select mode: a vertex of the selected element was dragged to a new position. */
  onMovePoints?: (elementId: string, points: Vec2[]) => void
  onSize: (size: { width: number; height: number }) => void
  onPoint: (point: Vec2) => void
  onFinish: () => void
  onError: (message: string) => void
  loadingLabel: string
  /** Vector linework with CAD layers, once read (for wall detection). */
  onVectors?: (segments: VSeg[]) => void
  /** Detected walls waiting for review; clicking one toggles it. */
  suggestions?: Suggestion[]
  onToggleSuggestion?: (id: string) => void
  /** Area chosen for detection. */
  regionBox?: [Vec2, Vec2] | null
  /** Ortho: lock each new point horizontal/vertical from the previous one (like holding Shift). */
  ortho?: boolean
  /** Cursor position in sheet points (null when it leaves the sheet). */
  onCursor?: (p: Vec2 | null) => void
  /** Text printed on the sheet, once read (used to name zones). */
  onTexts?: (texts: SheetText[]) => void
  /** Zoning outlines with a label; clickable when `onSelectZone` is given and not drawing. */
  zones?: ZoneShape[]
  onSelectZone?: (id: string) => void
  /** Draw takeoff items faintly (e.g. while zoning). */
  dimItems?: boolean
  /** Selected zone: corner handles can be dragged; called with the new outline. */
  onMoveZonePoints?: (zoneId: string, points: Vec2[]) => void
  /** Sheet origin (building reference point) with the direction of its X axis, in degrees. */
  originMark?: { x: number; y: number; angleDeg: number } | null
  /** Face placement: the face a→b is drawn; the wall body follows the side the cursor is on. */
  sidePick?: { a: Vec2; b: Vec2; thickness: number; color: string } | null
}

type PdfPageProxy = {
  getViewport: (opts: { scale: number }) => { width: number; height: number; transform: number[] }
  render: (params: unknown) => { promise: Promise<void>; cancel: () => void }
}

/** One PDF page with the takeoff overlay. Coordinates are PDF points (viewport at scale 1). */
export default function PdfSheet(props: Props) {
  const { url, pageNumber, zoom, items, calibration, draft, draftKind, draftColor, crosshair, measure = [], measureDone = false, rectPreview = false, ptPerM = 0, fmt = (v: number) => v.toFixed(2), snap, selectable, selectedId, onSelect, multiSelected = NO_IDS, onMovePoints, showTags = false, backgroundFade = 0, onSize, onPoint, onFinish, onError, loadingLabel, onVectors, suggestions = [], onToggleSuggestion, regionBox = null, ortho: orthoOn = false, onCursor, onTexts, zones = [], onSelectZone, dimItems = false, onMoveZonePoints, originMark = null, sidePick = null } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const detailRef = useRef<HTMLCanvasElement>(null)
  /** Sharp layer currently on screen: its box in CSS px on the sheet and the zoom it was drawn for. */
  const [detail, setDetail] = useState<{ x: number; y: number; w: number; h: number; zoom: number } | null>(null)
  /** Same as `detail`, readable from scroll handlers without re-subscribing. */
  const shownRef = useRef<{ x: number; y: number; w: number; h: number; zoom: number } | null>(null)
  const [page, setPage] = useState<PdfPageProxy | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [hover, setHover] = useState<Vec2 | null>(null)
  const [segments, setSegments] = useState<VectorSegment[]>([])
  const [snapHit, setSnapHit] = useState<SnapPoint | null>(null)
  /** Vertex being dragged: element, vertex index and the element's points while dragging. */
  const [drag, setDrag] = useState<{ id: string; index: number; pts: Vec2[] } | null>(null)
  /** The click that ends a drag must not clear the selection. */
  const justDragged = useRef(false)

  // Load the document and page.
  useEffect(() => {
    let alive = true
    let task: { promise: Promise<{ getPage: (n: number) => Promise<PdfPageProxy> }>; destroy: () => Promise<void> } | null = null
    setPage(null)
    setSegments([])
    ;(async () => {
      const pdfjs = await import('pdfjs-dist-v5')
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
      }
      task = pdfjs.getDocument(url) as unknown as typeof task
      const pdf = await task!.promise
      const p = await pdf.getPage(pageNumber)
      if (!alive) return
      const viewport = p.getViewport({ scale: 1 })
      setSize({ width: viewport.width, height: viewport.height })
      onSize({ width: viewport.width, height: viewport.height })
      setPage(p)
      // Text on the sheet (room names etc.), in viewport points.
      if (onTexts) {
        try {
          const content = await (p as unknown as { getTextContent: () => Promise<{ items: { str?: string; transform?: number[]; height?: number }[] }> }).getTextContent()
          const vt = viewport.transform
          const texts: SheetText[] = []
          for (const it of content.items) {
            if (!it.str || !it.transform) continue
            const [, , , , e, f] = it.transform
            texts.push({ str: it.str, x: vt[0] * e + vt[2] * f + vt[4], y: vt[1] * e + vt[3] * f + vt[5], size: Math.abs(it.height || Math.hypot(it.transform[2], it.transform[3])) || 8 })
          }
          if (alive) onTexts(texts)
        } catch {
          if (alive) onTexts([])
        }
      }
      // Vector linework (with CAD layers) for snapping and wall detection; a failure only disables them.
      try {
        const found = await extractPdfVectors(pdf, p, pdfjs, viewport.transform)
        if (!alive) return
        setSegments(found.map(sg => ({ a: { x: sg.a[0], y: sg.a[1] }, b: { x: sg.b[0], y: sg.b[1] } })))
        onVectors?.(found)
      } catch {
        try {
          const found = await extractPdfSegments(p, pdfjs, viewport.transform)
          if (alive) { setSegments(found); onVectors?.(found.map(sg => ({ a: [sg.a.x, sg.a.y], b: [sg.b.x, sg.b.y], layer: null }))) }
        } catch {
          if (alive) { setSegments([]); onVectors?.([]) }
        }
      }
    })().catch(err => {
      if (alive) onError(err instanceof Error ? err.message : String(err))
    })
    return () => {
      alive = false
      void task?.destroy()
    }
    // onSize/onError are callbacks from the parent; reloading only depends on the file and page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, pageNumber])

  // Render the bitmap for the current zoom.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!page || !canvas || !size.width) return
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const scale = Math.min(zoom * dpr, MAX_CANVAS_SIDE / Math.max(size.width, size.height))
    const viewport = page.getViewport({ scale })
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const job = page.render({ canvasContext: ctx, canvas, viewport })
    job.promise.catch(() => { /* cancelled by a newer render */ })
    return () => job.cancel()
  }, [page, zoom, size.width, size.height])

  // Large sheets at high zoom: the full-page bitmap above hits MAX_CANVAS_SIDE and gets stretched (blurry).
  // Render just the visible area again, at full resolution, in a screen-sized canvas on top of it.
  useEffect(() => {
    const wrap = wrapRef.current
    const canvas = detailRef.current
    if (!page || !wrap || !canvas || !size.width) return
    const dpr = window.devicePixelRatio || 1
    const want = zoom * dpr
    const base = Math.min(want, MAX_CANVAS_SIDE / Math.max(size.width, size.height))
    if (want <= base * 1.05) { shownRef.current = null; setDetail(null); return } // the full-page bitmap is already sharp
    const scroller = scrollParent(wrap)
    let job: { promise: Promise<void>; cancel: () => void } | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    /** Area being rendered right now (null when idle). */
    let pending: { x: number; y: number; w: number; h: number } | null = null

    /** Visible part of the sheet, in CSS px relative to its top-left corner. */
    const visible = () => {
      const sheet = wrap.getBoundingClientRect()
      const view = scroller ? scroller.getBoundingClientRect() : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
      return {
        x: view.left - sheet.left, y: view.top - sheet.top,
        w: view.right - view.left, h: view.bottom - view.top,
        sheetW: sheet.width, sheetH: sheet.height,
      }
    }

    /** True when `box` still covers the view with room to pan before its edge shows (sheet edges count as covered). */
    const covers = (box: { x: number; y: number; w: number; h: number }, v: ReturnType<typeof visible>) => {
      const gx = v.w * DETAIL_KEEP
      const gy = v.h * DETAIL_KEEP
      return (box.x <= Math.max(0, v.x - gx) + 1)
        && (box.y <= Math.max(0, v.y - gy) + 1)
        && (box.x + box.w >= Math.min(v.sheetW, v.x + v.w + gx) - 1)
        && (box.y + box.h >= Math.min(v.sheetH, v.y + v.h + gy) - 1)
    }

    const draw = () => {
      const v = visible()
      // Margin around the view, shrunk on very large screens so the canvas stays within DETAIL_MAX_PIXELS.
      const fit = (Math.sqrt(DETAIL_MAX_PIXELS / Math.max(1, v.w * v.h * dpr * dpr)) - 1) / 2
      const margin = Math.max(0, Math.min(DETAIL_MARGIN, fit))
      const mx = v.w * margin
      const my = v.h * margin
      const maxSide = MAX_CANVAS_SIDE / dpr
      const x0 = Math.max(0, Math.floor(v.x - mx))
      const y0 = Math.max(0, Math.floor(v.y - my))
      const x1 = Math.min(v.sheetW, Math.ceil(v.x + v.w + mx), x0 + maxSide)
      const y1 = Math.min(v.sheetH, Math.ceil(v.y + v.h + my), y0 + maxSide)
      if (x1 <= x0 || y1 <= y0) return
      job?.cancel()
      const box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0, zoom }
      pending = box
      // Draw into an offscreen canvas, then swap, so the old sharp layer stays until the new one is ready.
      const off = document.createElement('canvas')
      off.width = Math.round(box.w * dpr)
      off.height = Math.round(box.h * dpr)
      const ctx = off.getContext('2d')
      if (!ctx) return
      const viewport = page.getViewport({ scale: want })
      const current = page.render({ canvasContext: ctx, canvas: off, viewport, transform: [1, 0, 0, 1, -x0 * dpr, -y0 * dpr] })
      job = current
      current.promise.then(() => {
        canvas.width = off.width
        canvas.height = off.height
        canvas.getContext('2d')?.drawImage(off, 0, 0)
        shownRef.current = box
        pending = null
        setDetail(box)
      }).catch(() => { /* cancelled by a newer render */ })
    }
    // Panning inside the sharp area costs nothing; only re-render when the view nears its edge.
    const schedule = () => {
      const v = visible()
      const shown = shownRef.current
      if (shown && shown.zoom === zoom && covers(shown, v)) return
      if (pending && covers(pending, v)) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(draw, DETAIL_DELAY_MS)
    }

    schedule()
    const target: HTMLElement | Window = scroller ?? window
    target.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      if (timer) clearTimeout(timer)
      job?.cancel()
      target.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [page, zoom, size.width, size.height])

  function rawPoint(event: MouseEvent<SVGSVGElement>): Vec2 {
    const rect = event.currentTarget.getBoundingClientRect()
    return [(event.clientX - rect.left) / zoom, (event.clientY - rect.top) / zoom]
  }

  function snapAt(raw: Vec2): SnapPoint | null {
    if (!snap || !segments.length) return null
    return findSnap({ x: raw[0], y: raw[1] }, segments, zoom, 10)
  }

  /** Last fixed point of whatever is being drawn: Shift locks the next one to horizontal/vertical from it. */
  const anchor: Vec2 | null = draft.length ? draft[draft.length - 1] : measure.length && !measureDone ? measure[measure.length - 1] : calibration.length === 1 ? calibration[0] : null

  function ortho(p: Vec2, shift: boolean): Vec2 {
    if (!shift || !anchor) return p
    return Math.abs(p[0] - anchor[0]) >= Math.abs(p[1] - anchor[1]) ? [p[0], anchor[1]] : [anchor[0], p[1]]
  }

  function toPoint(event: MouseEvent<SVGSVGElement>): Vec2 {
    const raw = rawPoint(event)
    if ((event.shiftKey || orthoOn) && anchor) return ortho(raw, true)
    const hit = snapAt(raw)
    return hit ? [hit.x, hit.y] : raw
  }

  const m = (pt: number) => (ptPerM > 0 ? pt / ptPerM : 0)

  const W = size.width
  const H = size.height
  const stroke = (px: number) => px / zoom
  const rect = rectPreview && draft.length === 1 && hover
    ? ([draft[0], [hover[0], draft[0][1]], hover, [draft[0][0], hover[1]]] as Vec2[])
    : null
  const draftPts = rect || (sidePick ? draft : hover && draft.length && draftKind !== 'count' ? [...draft, hover] : draft)
  const measurePts = !measureDone && hover && measure.length ? [...measure, hover] : measure

  /** Live label near the cursor: current segment and total (or rectangle size and area). */
  const live = (() => {
    if (!ptPerM || !hover) return null
    if (rect) {
      const w = m(Math.abs(hover[0] - draft[0][0]))
      const h = m(Math.abs(hover[1] - draft[0][1]))
      return `${fmt(w)} × ${fmt(h)} m · ${fmt(w * h)} m²`
    }
    const pts = draft.length && draftKind !== 'count' ? draft : !measureDone && measure.length ? measure : null
    if (!pts) return null
    const seg = m(dist(pts[pts.length - 1], hover))
    const total = m(polyLen([...pts, hover]))
    return pts.length > 1 ? `${fmt(seg)} m · Σ ${fmt(total)} m` : `${fmt(seg)} m`
  })()

  const label = (x: number, y: number, text: string, key: string) => (
    <g key={key} style={{ pointerEvents: 'none' }}>
      <rect x={x + stroke(10)} y={y - stroke(22)} width={stroke(text.length * 6.6 + 10)} height={stroke(18)} rx={stroke(4)} fill="#111827" fillOpacity={0.85} />
      <text x={x + stroke(15)} y={y - stroke(9)} fontSize={stroke(11)} fill="#fff" fontFamily="system-ui, sans-serif">{text}</text>
    </g>
  )

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: W * zoom || '100%', height: H * zoom || 200 }}>
      {!page && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: '#6b8089' }}>{loadingLabel}</div>}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: W * zoom, height: H * zoom, background: '#fff' }} />
      {/* Sharp layer around the visible area. Right after a zoom it is stretched to the new zoom
          (still far sharper than the full-page bitmap) until the new render swaps in. */}
      {(() => {
        const k = detail ? zoom / detail.zoom : 1
        return (
          <canvas
            ref={detailRef}
            style={{
              position: 'absolute',
              left: (detail?.x ?? 0) * k,
              top: (detail?.y ?? 0) * k,
              width: (detail?.w ?? 0) * k,
              height: (detail?.h ?? 0) * k,
              visibility: detail ? 'visible' : 'hidden',
              pointerEvents: 'none',
            }}
          />
        )
      })()}
      {W > 0 && (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W * zoom}
          height={H * zoom}
          style={{ position: 'absolute', inset: 0, cursor: crosshair ? 'crosshair' : 'default' }}
          onClick={event => {
            if (justDragged.current) { justDragged.current = false; return }
            // The second click of a double-click (detail > 1) must not add a point or a count.
            if (crosshair && event.detail <= 1) onPoint(toPoint(event))
            else if (selectable && event.target === event.currentTarget) onSelect(null)
          }}
          onDoubleClick={event => { if (crosshair) { event.preventDefault(); onFinish() } }}
          onPointerMove={event => {
            if (!drag) return
            const p = toPoint(event)
            setSnapHit(snapAt(rawPoint(event)))
            setDrag(d => (d ? { ...d, pts: d.pts.map((q, i) => (i === d.index ? p : q)) } : d))
          }}
          onPointerUp={() => {
            if (!drag) return
            const d = drag
            justDragged.current = true
            setDrag(null)
            setSnapHit(null)
            if (d.id.startsWith('zone:')) onMoveZonePoints?.(d.id.slice(5), d.pts)
            else onMovePoints?.(d.id, d.pts)
          }}
          onMouseMove={event => {
            onCursor?.(rawPoint(event))
            if (!crosshair) return
            const raw = rawPoint(event)
            if ((event.shiftKey || orthoOn) && anchor) { setSnapHit(null); setHover(ortho(raw, true)); return }
            const hit = snapAt(raw)
            setSnapHit(hit)
            setHover(hit ? [hit.x, hit.y] : raw)
          }}
          onMouseLeave={() => { setHover(null); setSnapHit(null); onCursor?.(null) }}
        >
          {backgroundFade > 0 && <rect x={0} y={0} width={W} height={H} fill="#fff" fillOpacity={backgroundFade} style={{ pointerEvents: 'none' }} />}
          {zones.map(z => {
            const zpts = drag && drag.id === `zone:${z.id}` ? drag.pts : z.pts
            const pts = zpts.map(p => `${p[0]},${p[1]}`).join(' ')
            let cx = 0
            let cy = 0
            for (const p of zpts) { cx += p[0]; cy += p[1] }
            cx /= zpts.length || 1
            cy /= zpts.length || 1
            // Macro areas carry their name along the top edge, clear of the rooms inside them.
            if (z.macro && zpts.length) cy = Math.min(...zpts.map(p => p[1])) + stroke(26)
            const pick = onSelectZone && !crosshair
              ? { onClick: (event: MouseEvent<SVGElement>) => { event.stopPropagation(); onSelectZone(z.id) }, style: { cursor: 'pointer' } }
              : { style: { pointerEvents: 'none' as const } }
            return (
              <g key={`z-${z.id}`}>
                {z.suggested ? (
                  <polygon points={pts} fill={z.on ? '#16A34A' : '#C2410C'} fillOpacity={z.on ? 0.18 : 0.06} stroke={z.on ? '#16A34A' : '#C2410C'} strokeWidth={stroke(2)} strokeDasharray={`${stroke(8)} ${stroke(5)}`} {...pick} />
                ) : (
                  z.macro
                    ? <polygon points={pts} fill={z.color} fillOpacity={z.selected ? 0.16 : 0.06} stroke={z.selected ? '#0b6b63' : z.color} strokeWidth={stroke(z.selected ? 3 : 2.2)} strokeDasharray={`${stroke(10)} ${stroke(6)}`} {...pick} />
                    : <polygon points={pts} fill={z.color} fillOpacity={z.selected ? 0.42 : 0.26} stroke={z.selected ? '#0b6b63' : z.color} strokeWidth={stroke(z.selected ? 2.5 : 1.2)} {...pick} />
                )}
                <text x={cx} y={cy - stroke(3)} textAnchor="middle" fontSize={stroke(12)} fontWeight={700} fill="#173441" style={{ pointerEvents: 'none' }} fontFamily="system-ui, sans-serif">{z.name}</text>
                <text x={cx} y={cy + stroke(12)} textAnchor="middle" fontSize={stroke(11)} fill="#294955" style={{ pointerEvents: 'none' }} fontFamily="system-ui, sans-serif">{z.label}</text>
                {z.selected && zpts.map((p, i) => (
                  <rect
                    key={i}
                    x={p[0] - stroke(5)}
                    y={p[1] - stroke(5)}
                    width={stroke(10)}
                    height={stroke(10)}
                    fill="#fff"
                    stroke="#0b6b63"
                    strokeWidth={stroke(1.5)}
                    style={onMoveZonePoints && !crosshair ? { cursor: 'move' } : { pointerEvents: 'none' }}
                    onPointerDown={event => {
                      if (!onMoveZonePoints || crosshair) return
                      event.stopPropagation()
                      ;(event.currentTarget.ownerSVGElement as SVGSVGElement | null)?.setPointerCapture?.(event.pointerId)
                      setDrag({ id: `zone:${z.id}`, index: i, pts: z.pts.map(q => [q[0], q[1]] as Vec2) })
                    }}
                    onClick={event => event.stopPropagation()}
                  />
                ))}
              </g>
            )
          })}

          {paintOrder(items).map(item =>
            item.shapes.map((shape, index) => {
              if (dimItems) {
                const pts0 = shape.pts.map(p => `${p[0]},${p[1]}`).join(' ')
                const key0 = `${item.key}-${index}`
                if (item.kind === 'area') return <polygon key={key0} points={pts0} fill="none" stroke={item.color} strokeOpacity={0.35} strokeWidth={stroke(1)} style={{ pointerEvents: 'none' }} />
                if (item.kind === 'linear') return <polyline key={key0} points={pts0} fill="none" stroke={item.color} strokeOpacity={0.35} strokeWidth={stroke(3)} style={{ pointerEvents: 'none' }} />
                return <circle key={key0} cx={shape.pts[0][0]} cy={shape.pts[0][1]} r={stroke(4)} fill="none" stroke={item.color} strokeOpacity={0.35} style={{ pointerEvents: 'none' }} />
              }
              const pts = drag && shape.id === drag.id ? drag.pts : shape.pts
              const points = pts.map(p => `${p[0]},${p[1]}`).join(' ')
              const key = `${item.key}-${index}`
              const selected = !!shape.id && (shape.id === selectedId || multiSelected.has(shape.id))
              const color = selected ? '#111827' : item.color
              const pick = selectable && shape.id
                ? {
                    onClick: (event: MouseEvent<SVGElement>) => { event.stopPropagation(); onSelect(shape.id!) },
                    style: { cursor: 'pointer' },
                  }
                : { style: { pointerEvents: 'none' as const } }
              if (item.kind === 'area') {
                // Stacked areas (slab, floor, ceiling…): each click on the selected one moves to the one under it.
                const areaPick = selectable && shape.id
                  ? {
                      onClick: (event: MouseEvent<SVGElement>) => {
                        event.stopPropagation()
                        const svg = (event.currentTarget as SVGElement).ownerSVGElement
                        const rect = svg ? svg.getBoundingClientRect() : null
                        const p: Vec2 | null = rect ? [(event.clientX - rect.left) / zoom, (event.clientY - rect.top) / zoom] : null
                        onSelect((p && areaAt(p, items, selectedId)) || shape.id!)
                      },
                      style: { cursor: 'pointer' },
                    }
                  : pick
                return <polygon key={key} points={points} fill={item.color} fillOpacity={selected ? Math.min(1, planOpacity(item, 'screen') + 0.17) : planOpacity(item, 'screen')} stroke={color} strokeWidth={stroke(selected ? 3 : 2)} {...areaPick} />
              }
              if (item.kind === 'linear') {
                // Real wall thickness once the sheet has a scale (stays the same on paper at any zoom);
                // a thin minimum on screen so walls never vanish when zoomed out.
                const real = item.thickness && item.thickness > 0 && ptPerM > 0 ? item.thickness * ptPerM : 0
                const width = real > 0 ? Math.max(real, stroke(selected ? 3 : 1.5)) : stroke(selected ? 7 : 5)
                return (
                  <g key={key}>
                    <polyline points={points} fill="none" stroke={color} strokeOpacity={selected ? Math.max(0.85, planOpacity(item, 'screen')) : planOpacity(item, 'screen')} strokeWidth={width} strokeLinejoin="miter" strokeLinecap={real > 0 ? 'square' : 'round'} {...pick} />
                    {selectable && shape.id && <polyline points={points} fill="none" stroke="transparent" strokeWidth={Math.max(width, stroke(10))} strokeLinejoin="round" strokeLinecap="round" style={{ cursor: 'pointer', pointerEvents: 'stroke' }} onClick={event => { event.stopPropagation(); onSelect(shape.id!) }} />}
                    {selected && real > 0 && <polyline points={points} fill="none" stroke="#fff" strokeOpacity={0.9} strokeWidth={stroke(1.2)} strokeDasharray={`${stroke(6)} ${stroke(4)}`} style={{ pointerEvents: 'none' }} />}
                  </g>
                )
              }
              const [x, y] = pts[0]
              return <circle key={key} cx={x} cy={y} r={stroke(selected ? 9 : 7)} fill="#fff" stroke={color} strokeWidth={stroke(3)} opacity={selected ? 1 : planOpacity(item, 'screen')} {...pick} />
            }),
          )}

          {/* Doors, windows and plain openings: an icon badge at each opening, over a short line along it. */}
          {!dimItems && ptPerM > 0 && items.filter(item => item.kind === 'linear').flatMap(item => item.shapes.flatMap((shape, index) => {
            const pts = drag && shape.id === drag.id ? drag.pts : shape.pts
            return openingMarks(pts, shape.openings, ptPerM).map((m, j) => {
              const color = m.kind === 'window' ? '#0284C7' : m.kind === 'door' ? '#B45309' : '#64748B'
              const icon = m.kind === 'window' ? 'window' : m.kind === 'door' ? 'door' : 'opening'
              const size = stroke(24)
              const cx = (m.a[0] + m.b[0]) / 2, cy = (m.a[1] + m.b[1]) / 2
              return (
                <g key={`op-${item.key}-${index}-${j}`} style={{ pointerEvents: 'none' }}>
                  <line x1={m.a[0]} y1={m.a[1]} x2={m.b[0]} y2={m.b[1]} stroke={color} strokeWidth={item.thickness && item.thickness > 0 ? Math.max(item.thickness * ptPerM, stroke(1.5)) : stroke(5)} strokeOpacity={0.9} />
                  <svg x={cx - size / 2} y={cy - size / 2} width={size} height={size} viewBox="0 0 24 24" overflow="visible">
                    <circle cx={12} cy={12} r={11.5} fill="#fff" stroke={color} strokeWidth={1.6} />
                    <g transform="translate(5.5 5.5) scale(0.54)">
                      <path d={ICON_PATHS[icon]} fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                    </g>
                  </svg>
                </g>
              )
            })
          }))}

          {regionBox && (
            <rect
              x={Math.min(regionBox[0][0], regionBox[1][0])}
              y={Math.min(regionBox[0][1], regionBox[1][1])}
              width={Math.abs(regionBox[1][0] - regionBox[0][0])}
              height={Math.abs(regionBox[1][1] - regionBox[0][1])}
              fill="#2563EB"
              fillOpacity={0.04}
              stroke="#2563EB"
              strokeWidth={stroke(1.5)}
              strokeDasharray={`${stroke(8)} ${stroke(4)}`}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {suggestions.map(sg => (
            <line
              key={`sg-${sg.id}`}
              x1={sg.pts[0][0]}
              y1={sg.pts[0][1]}
              x2={sg.pts[1][0]}
              y2={sg.pts[1][1]}
              stroke={sg.on ? '#16A34A' : '#C2410C'}
              strokeOpacity={sg.on ? 0.75 : 0.9}
              strokeWidth={stroke(sg.on ? 6 : 4)}
              strokeDasharray={sg.on ? undefined : `${stroke(7)} ${stroke(4)}`}
              strokeLinecap="round"
              style={onToggleSuggestion && !crosshair ? { cursor: 'pointer' } : { pointerEvents: 'none' }}
              onClick={event => { if (!onToggleSuggestion || crosshair) return; event.stopPropagation(); onToggleSuggestion(sg.id) }}
            />
          ))}

          {/* Tags of everything drawn: middle of each wall stretch, centre of each area, beside each counted point. */}
          {showTags && !dimItems && items.flatMap(item => item.shapes.flatMap((shape, index) => {
            if (!shape.tags?.length) return []
            const pts = drag && shape.id === drag.id ? drag.pts : shape.pts
            const pill = (key: string, cx: number, cy: number, tag: string) => {
              const w = stroke(tag.length * 6.2 + 10)
              const h = stroke(15)
              return (
                <g key={key} style={{ pointerEvents: 'none' }}>
                  <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={stroke(3)} fill="#fff" fillOpacity={0.92} stroke={item.color} strokeWidth={stroke(1.2)} />
                  <text x={cx} y={cy + stroke(3.6)} textAnchor="middle" fontSize={stroke(10)} fontWeight={700} fill="#173441" fontFamily="system-ui, sans-serif">{tag}</text>
                </g>
              )
            }
            if (item.kind === 'linear') {
              return pts.slice(1).map((b, i) => {
                const a = pts[i]
                const tag = shape.tags![i]
                // Only on stretches long enough on screen to hold the label.
                if (!tag || dist(a, b) * zoom < tag.length * 6.4 + 24) return null
                return pill(`tag-${item.key}-${index}-${i}`, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, tag)
              })
            }
            const tag = shape.tags[0]
            if (!tag || !pts.length) return []
            if (item.kind === 'area') {
              if (pts.length < 3) return []
              const [cx, cy] = centroid(pts)
              return [pill(`tag-${item.key}-${index}`, cx, cy, tag)]
            }
            const w = tag.length * 6.2 + 10
            return [pill(`tag-${item.key}-${index}`, pts[0][0] + stroke(w / 2 + 8), pts[0][1] - stroke(14), tag)]
          }))}

          {/* Door, window and opening tags (D-01, W-01…): beside each opening's badge, on the side the wall's normal points to. */}
          {showTags && !dimItems && ptPerM > 0 && items.filter(item => item.kind === 'linear').flatMap(item => item.shapes.flatMap((shape, index) => {
            if (!shape.openingTags?.length) return []
            const pts = drag && shape.id === drag.id ? drag.pts : shape.pts
            return openingMarks(pts, shape.openings, ptPerM).map(m => {
              const tag = shape.openingTags![m.index]
              if (!tag) return null
              const color = m.kind === 'window' ? '#0284C7' : m.kind === 'door' ? '#B45309' : '#64748B'
              const off = stroke(26)
              const cx = (m.a[0] + m.b[0]) / 2 + m.n[0] * off, cy = (m.a[1] + m.b[1]) / 2 + m.n[1] * off
              const w = stroke(tag.length * 6.2 + 10), h = stroke(15)
              return (
                <g key={`otag-${item.key}-${index}-${m.index}`} style={{ pointerEvents: 'none' }}>
                  <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={stroke(3)} fill="#fff" fillOpacity={0.94} stroke={color} strokeWidth={stroke(1.2)} />
                  <text x={cx} y={cy + stroke(3.6)} textAnchor="middle" fontSize={stroke(10)} fontWeight={700} fill="#173441" fontFamily="system-ui, sans-serif">{tag}</text>
                </g>
              )
            })
          }))}

          {selectable && onMovePoints && selectedId && items.flatMap(item => item.shapes.filter(sh => sh.id === selectedId).map(sh => {
            const pts = drag && drag.id === sh.id ? drag.pts : sh.pts
            return pts.map((p, i) => (
              <rect
                key={`h-${sh.id}-${i}`}
                x={p[0] - stroke(6)}
                y={p[1] - stroke(6)}
                width={stroke(12)}
                height={stroke(12)}
                fill="#fff"
                stroke="#111827"
                strokeWidth={stroke(2)}
                style={{ cursor: 'move' }}
                onPointerDown={event => {
                  // Start dragging this vertex; keep the container from panning.
                  event.stopPropagation()
                  ;(event.currentTarget.ownerSVGElement as SVGSVGElement | null)?.setPointerCapture?.(event.pointerId)
                  setDrag({ id: sh.id!, index: i, pts: sh.pts.map(q => [q[0], q[1]] as Vec2) })
                }}
                onClick={event => event.stopPropagation()}
              />
            ))
          }))}

          {originMark && (() => {
            const a = (originMark.angleDeg * Math.PI) / 180
            const L = stroke(46)
            const ax: Vec2 = [originMark.x + Math.cos(a) * L, originMark.y + Math.sin(a) * L]
            // Y is shown pointing up the sheet (as in CAD).
            const ay: Vec2 = [originMark.x + Math.sin(a) * L, originMark.y - Math.cos(a) * L]
            return (
              <g style={{ pointerEvents: 'none' }}>
                <line x1={originMark.x} y1={originMark.y} x2={ax[0]} y2={ax[1]} stroke="#DC2626" strokeWidth={stroke(2.5)} />
                <line x1={originMark.x} y1={originMark.y} x2={ay[0]} y2={ay[1]} stroke="#16A34A" strokeWidth={stroke(2.5)} />
                <text x={ax[0] + stroke(4)} y={ax[1] + stroke(4)} fontSize={stroke(11)} fontWeight={800} fill="#DC2626" fontFamily="system-ui, sans-serif">X</text>
                <text x={ay[0] + stroke(4)} y={ay[1] - stroke(2)} fontSize={stroke(11)} fontWeight={800} fill="#16A34A" fontFamily="system-ui, sans-serif">Y</text>
                <circle cx={originMark.x} cy={originMark.y} r={stroke(7)} fill="#fff" stroke="#173441" strokeWidth={stroke(2)} />
                <circle cx={originMark.x} cy={originMark.y} r={stroke(2.5)} fill="#173441" />
              </g>
            )
          })()}

          {sidePick && hover && (
            <polygon
              points={wallBand(sidePick.a, sidePick.b, hover, sidePick.thickness).map(p => p.join(',')).join(' ')}
              fill={sidePick.color}
              fillOpacity={0.35}
              stroke={sidePick.color}
              strokeWidth={stroke(1.5)}
              style={{ pointerEvents: 'none' }}
            />
          )}

          {crosshair && hover && live && !sidePick && label(hover[0], hover[1], live, 'live')}

          {drag && snapHit && (
            <rect x={snapHit.x - stroke(6)} y={snapHit.y - stroke(6)} width={stroke(12)} height={stroke(12)} fill="none" stroke="#2563EB" strokeWidth={stroke(2)} style={{ pointerEvents: 'none' }} />
          )}

          {measurePts.length > 0 && (
            <g style={{ pointerEvents: 'none' }}>
              {measureDone && measurePts.length >= 3 ? (
                <polygon points={measurePts.map(p => p.join(',')).join(' ')} fill="#C2410C" fillOpacity={0.1} stroke="#C2410C" strokeWidth={stroke(2)} strokeDasharray={`${stroke(8)} ${stroke(4)}`} />
              ) : (
                <polyline points={measurePts.map(p => p.join(',')).join(' ')} fill="none" stroke="#C2410C" strokeWidth={stroke(2)} strokeDasharray={`${stroke(8)} ${stroke(4)}`} />
              )}
              {measure.map((p, i) => <circle key={`m${i}`} cx={p[0]} cy={p[1]} r={stroke(4)} fill="#C2410C" />)}
              {ptPerM > 0 && measure.slice(1).map((p, i) => {
                const a = measure[i]
                return label((a[0] + p[0]) / 2, (a[1] + p[1]) / 2, `${fmt(m(dist(a, p)))} m`, `ml${i}`)
              })}
            </g>
          )}

          {draftPts.length > 0 && draftKind === 'area' && (
            <polygon points={draftPts.map(p => p.join(',')).join(' ')} fill={draftColor} fillOpacity={0.12} stroke={draftColor} strokeWidth={stroke(2)} strokeDasharray={`${stroke(6)} ${stroke(4)}`} />
          )}
          {draftPts.length > 0 && draftKind === 'linear' && (
            <polyline points={draftPts.map(p => p.join(',')).join(' ')} fill="none" stroke={draftColor} strokeWidth={stroke(3)} strokeDasharray={`${stroke(6)} ${stroke(4)}`} />
          )}
          {draft.map((p, i) => <circle key={`d${i}`} cx={p[0]} cy={p[1]} r={stroke(4)} fill={draftColor} />)}

          {calibration.length > 0 && (
            <>
              {calibration.length === 2 && (
                <line x1={calibration[0][0]} y1={calibration[0][1]} x2={calibration[1][0]} y2={calibration[1][1]} stroke="#C2410C" strokeWidth={stroke(2)} />
              )}
              {calibration.length === 1 && hover && (
                <line x1={calibration[0][0]} y1={calibration[0][1]} x2={hover[0]} y2={hover[1]} stroke="#C2410C" strokeWidth={stroke(2)} strokeDasharray={`${stroke(6)} ${stroke(4)}`} />
              )}
              {calibration.map((p, i) => <circle key={`c${i}`} cx={p[0]} cy={p[1]} r={stroke(5)} fill="#C2410C" />)}
            </>
          )}

          {crosshair && snapHit && (
            <rect
              x={snapHit.x - stroke(6)}
              y={snapHit.y - stroke(6)}
              width={stroke(12)}
              height={stroke(12)}
              fill="none"
              stroke={snapHit.kind === 'intersection' ? '#DC2626' : snapHit.kind === 'endpoint' ? '#2563EB' : '#CA8A04'}
              strokeWidth={stroke(2)}
              style={{ pointerEvents: 'none' }}
            />
          )}
        </svg>
      )}
    </div>
  )
}
