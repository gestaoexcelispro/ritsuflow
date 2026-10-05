// Moves a project's old Location Map (project_drawing_maps + project_drawing_location_geometries,
// with the PDF in project-documents) into RitsuScope: the PDF page becomes a RitsuScope sheet with
// the same scale and A4 print area, and each outline becomes a zone linked to the SAME location
// (no new locations are created). The old rows are left untouched; an imported map is recognised by
// `takeoff_sources.metadata.imported_drawing_map`.
import type { createClient } from '@/lib/supabase/client'
import type { LevelRow } from './levels'
import type { ZoneKind } from './zones'

type Supabase = ReturnType<typeof createClient>
type NPoint = { x: number; y: number }

export type LegacyOutline = { id: string; locationId: string; name: string; locationType: string; points: NPoint[]; color: string }
export type LegacyMap = {
  mapId: string
  documentId: string
  fileName: string
  storagePath: string
  pageNumber: number
  printView: Record<string, unknown> | null
  calibration: { point_a?: NPoint; point_b?: NPoint; known_distance?: number } | null
  outlines: LegacyOutline[]
}

const TYPE_KIND: Record<string, ZoneKind> = { building: 'block', zone: 'zone', area: 'area', room: 'room', custom: 'area', phase: 'block' }

/** Old Location Map pages of this project that were not moved to RitsuScope yet. */
export async function loadLegacyLocationMaps(supabase: Supabase, projectId: string): Promise<LegacyMap[]> {
  const { data: maps, error } = await supabase.from('project_drawing_maps').select('id, document_id, page_number, print_view, scale_calibration').eq('project_id', projectId)
  if (error || !maps?.length) return []
  const { data: sheets } = await supabase.from('takeoff_sources').select('metadata').eq('project_id', projectId)
  const done = new Set((sheets || []).map(s => (s.metadata as Record<string, unknown> | null)?.imported_drawing_map).filter(Boolean) as string[])
  const todo = maps.filter(m => !done.has(m.id))
  if (!todo.length) return []
  const [{ data: docs }, { data: geoms }, { data: locs }] = await Promise.all([
    supabase.from('project_documents').select('id, file_name, storage_path').in('id', todo.map(m => m.document_id)),
    supabase.from('project_drawing_location_geometries').select('id, drawing_map_id, location_id, geometry').in('drawing_map_id', todo.map(m => m.id)),
    supabase.from('locations').select('id, name, location_type').eq('project_id', projectId),
  ])
  const docById = new Map((docs || []).map(d => [d.id, d]))
  const locById = new Map((locs || []).map(l => [l.id, l]))
  return todo.flatMap(m => {
    const doc = docById.get(m.document_id)
    if (!doc?.storage_path) return []
    const outlines = (geoms || []).filter(g => g.drawing_map_id === m.id).flatMap(g => {
      const loc = locById.get(g.location_id)
      const geometry = (g.geometry || {}) as { points?: NPoint[]; display?: { color?: string } }
      if (!loc || !Array.isArray(geometry.points)) return []
      return [{ id: g.id, locationId: loc.id, name: loc.name, locationType: loc.location_type, points: geometry.points, color: geometry.display?.color || '#0F9D8A' }]
    })
    return [{
      mapId: m.id,
      documentId: m.document_id,
      fileName: doc.file_name,
      storagePath: doc.storage_path,
      pageNumber: Number(m.page_number) || 1,
      printView: (m.print_view as Record<string, unknown> | null) || null,
      calibration: (m.scale_calibration as LegacyMap['calibration']) || null,
      outlines,
    }]
  })
}

/** An outline can be moved when it is a real area (3+ points) drawn in the page's 0–1 space. */
export function importableOutline(o: LegacyOutline): boolean {
  return o.locationType !== 'floor' && o.points.length >= 3 && o.points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= -0.001 && p.x <= 1.001 && p.y >= -0.001 && p.y <= 1.001)
}

function safeName(name: string) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80) || 'drawing.pdf'
}

/**
 * Imports one old Location Map page. Returns the new sheet id, how many outlines became zones and
 * the names of the outlines left out (floor outlines: floors are levels in RitsuScope; broken shapes).
 */
export async function importLegacyLocationMap(
  supabase: Supabase,
  map: LegacyMap,
  ctx: { projectId: string; sortOrder: number; levels: LevelRow[] },
): Promise<{ sourceId: string; imported: number; skipped: string[] }> {
  const { data: signed, error: se } = await supabase.storage.from('project-documents').createSignedUrl(map.storagePath, 300)
  if (se || !signed?.signedUrl) throw se || new Error('The Location Map PDF could not be opened.')
  const response = await fetch(signed.signedUrl)
  if (!response.ok) throw new Error(`The Location Map PDF could not be downloaded (${response.status}).`)
  const bytes = new Uint8Array(await response.arrayBuffer())

  // Page size in PDF points, the same space RitsuScope draws in (y down, rotation applied).
  const pdfjs = await import('pdfjs-dist-v5')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise
  const pageNumber = Math.min(Math.max(1, map.pageNumber), pdf.numPages)
  const viewport = (await pdf.getPage(pageNumber)).getViewport({ scale: 1 })
  const W = viewport.width
  const H = viewport.height
  const pageCount = pdf.numPages
  await pdf.destroy().catch(() => {})

  // Scale: the calibration line (0–1 space) and its real length in metres → points per metre.
  const a = map.calibration?.point_a
  const b = map.calibration?.point_b
  const known = Number(map.calibration?.known_distance)
  const linePt = a && b ? Math.hypot((b.x - a.x) * W, (b.y - a.y) * H) : 0
  const ptPerM = linePt > 0 && known > 0 ? linePt / known : null

  // The sheet sits on the level linked to the floor outlined on this page, when there is one.
  const floorIds = new Set(map.outlines.filter(o => o.locationType === 'floor').map(o => o.locationId))
  const level = ctx.levels.find(l => l.location_id && floorIds.has(l.location_id)) || null

  const path = `${ctx.projectId}/${crypto.randomUUID()}-${safeName(map.fileName)}`
  const upload = await supabase.storage.from('takeoff-files').upload(path, new Blob([bytes], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: false })
  if (upload.error) throw upload.error
  const baseName = map.fileName.replace(/\.pdf$/i, '')
  const { data: sheet, error: ie } = await supabase.from('takeoff_sources').insert({
    project_id: ctx.projectId,
    kind: 'pdf_page',
    name: pageCount > 1 ? `${baseName} · ${pageNumber}` : baseName,
    file_path: path,
    page_number: pageNumber,
    sort_order: ctx.sortOrder,
    scale_pt_per_m: ptPerM,
    level_id: level?.id || null,
    metadata: { original_name: map.fileName, page_count: pageCount, imported_drawing_map: map.mapId, print_view: map.printView },
  }).select('id').single()
  if (ie || !sheet) {
    await supabase.storage.from('takeoff-files').remove([path])
    throw ie || new Error('The RitsuScope sheet could not be created.')
  }

  const good = map.outlines.filter(importableOutline)
  const skipped = map.outlines.filter(o => !importableOutline(o)).map(o => o.name)
  if (good.length) {
    const { error: ze } = await supabase.from('takeoff_zones').insert(good.map((o, i) => ({
      project_id: ctx.projectId,
      source_id: sheet.id,
      name: o.name,
      color: o.color,
      points: o.points.map(p => [Number((p.x * W).toFixed(3)), Number((p.y * H).toFixed(3))]),
      location_id: o.locationId,
      zone_kind: TYPE_KIND[o.locationType] || 'area',
      sort_order: (i + 1) * 10,
    })))
    if (ze) throw ze
  }
  return { sourceId: sheet.id as string, imported: good.length, skipped }
}
