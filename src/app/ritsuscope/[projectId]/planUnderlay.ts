// Plan underlay for the 3D view and the report: the part of a PDF sheet the user framed for
// room detection (never the whole sheet), in light grey half tone, laid flat under the model,
// with the locations (zones) in their colours on top.
import { createClient } from '@/lib/supabase/client'
import type { Vec2 } from '@/lib/takeoff/geometry'
import type { SourceRow } from '@/lib/takeoff/rows'

const BUCKET = 'takeoff-files'

/** The sheet region kept for the underlay (sheet points), set when rooms are detected in a region. */
export function underlayRegionOf(src: Pick<SourceRow, 'metadata'> | null | undefined): [Vec2, Vec2] | null {
  const r = (src?.metadata as { underlay_region?: unknown } | undefined)?.underlay_region
  if (!Array.isArray(r) || r.length !== 2) return null
  const [a, b] = r as number[][]
  if (![a?.[0], a?.[1], b?.[0], b?.[1]].every(v => typeof v === 'number' && Number.isFinite(v))) return null
  const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1])
  return x1 - x0 > 1 && y1 - y0 > 1 ? [[x0, y0], [x1, y1]] : null
}

/** What to show under one storey: its sheet region and how sheet points map to the model's coordinates. */
export type UnderlaySpec = { page: number; filePath: string; pageNumber: number; region: [Vec2, Vec2]; toModel: (p: Vec2) => Vec2 }
/** A location (zone) drawn on the underlay, in model coordinates. */
export type UnderlayZone = { page: number; pts: Vec2[]; color: string; name: string }
/** Ready to draw: the half-tone picture and its four corners in model coordinates (TL, TR, BR, BL). */
export type LoadedUnderlay = { page: number; corners: [Vec2, Vec2, Vec2, Vec2]; image: HTMLCanvasElement }

const cache = new Map<string, Promise<HTMLCanvasElement | null>>()

/** Renders only the region of the PDF page, then turns it into a light grey half tone. */
async function renderRegion(filePath: string, pageNumber: number, region: [Vec2, Vec2], maxPx: number): Promise<HTMLCanvasElement | null> {
  const { data } = await createClient().storage.from(BUCKET).createSignedUrl(filePath, 600)
  if (!data?.signedUrl) return null
  const pdfjs = await import('pdfjs-dist-v5')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }
  const task = pdfjs.getDocument(data.signedUrl)
  try {
    const doc = await task.promise
    const page = await doc.getPage(pageNumber)
    const [[x0, y0], [x1, y1]] = region
    const scale = Math.min(4, maxPx / Math.max(x1 - x0, y1 - y0))
    const vp = page.getViewport({ scale, offsetX: -x0 * scale, offsetY: -y0 * scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round((x1 - x0) * scale))
    canvas.height = Math.max(1, Math.round((y1 - y0) * scale))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport: vp, canvas } as never).promise
    // Half tone: grey, and lightened so the drawing stays in the background.
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const d = img.data
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const v = 255 - (255 - g) * 0.5
      d[i] = d[i + 1] = d[i + 2] = v
    }
    ctx.putImageData(img, 0, 0)
    return canvas
  } catch {
    return null
  } finally {
    void task.destroy()
  }
}

export async function loadUnderlay(spec: UnderlaySpec, maxPx = 2048): Promise<LoadedUnderlay | null> {
  const key = `${spec.filePath}#${spec.pageNumber}#${spec.region.flat().join(',')}#${maxPx}`
  if (!cache.has(key)) cache.set(key, renderRegion(spec.filePath, spec.pageNumber, spec.region, maxPx))
  const image = await cache.get(key)!
  if (!image) { cache.delete(key); return null }
  const [[x0, y0], [x1, y1]] = spec.region
  const corners = ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Vec2[]).map(spec.toModel) as [Vec2, Vec2, Vec2, Vec2]
  return { page: spec.page, corners, image }
}
