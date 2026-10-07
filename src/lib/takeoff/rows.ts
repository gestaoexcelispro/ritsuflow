// Maps engine data to database rows and back. Pure functions (no Supabase client),
// so the mapping is covered by tests.

import { IFC_SHEET_PT_PER_M, type IfcImport } from './ifc/importIfcModel'
import { ceilingSpecOf } from './ceilingTypes'
import { floorSpecOf } from './floorTypes'
import type { ElementOpening, FramingConfig, LayerKind, TakeoffItem, TakeoffShape, Vec2 } from './geometry'

/** Placeholder GlobalId for elements the IFC has outside any storey. */
export const NO_STOREY_GUID = '__no_storey__'

export type SourceRow = {
  id: string
  project_id: string
  kind: 'pdf_page' | 'ifc_storey'
  name: string
  file_path: string
  page_number: number | null
  ifc_storey_guid: string | null
  scale_pt_per_m: number | null
  metadata: Record<string, unknown>
  sort_order: number
  /** Sheet origin (sheet points) and level, so floors align in 3D. */
  origin_x?: number | null
  origin_y?: number | null
  origin_angle_deg?: number | null
  level_name?: string | null
  level_elevation_m?: number | null
  /** Building level the sheet belongs to (takeoff_levels). */
  level_id?: string | null
}

export type LayerRow = {
  id: string
  project_id: string
  kind: LayerKind
  name: string
  system: string | null
  color: string
  thickness_m: number | null
  height_m: number | null
  elevation_m: number
  deduct_openings: boolean
  framing: Partial<FramingConfig> & Record<string, unknown>
  is_visible: boolean
  sort_order: number
  recipe_id?: string | null
  /** Library wall type the item was built from (or assigned), if any. */
  wall_type_id?: string | null
}

export type ElementRow = {
  id: string
  project_id: string
  layer_id: string
  source_id: string
  points: Vec2[]
  height_override_m: number | null
  z_rel_m: number
  ifc_guid: string | null
  root_guid: string | null
  layer_guids: string[]
  openings: ElementOpening[]
  faces: { faceA?: string; faceB?: string; flip?: boolean; exploded?: boolean }
  /** Tags renamed by the user, one per segment (null/missing = automatic). Column added by migration 20261006_008. */
  segment_tags?: (string | null)[] | null
  created_at?: string
  /** Final tag of each segment (computed, see segmentTags.ts); not a database column. */
  tag_labels?: string[]
  /** Automatic tag of each segment (shown as the placeholder when renaming). */
  tag_auto?: string[]
}

export type IfcImportRows = {
  sources: Omit<SourceRow, 'id'>[]
  /** Layer rows; `key` is local and is not stored. */
  layers: (Omit<LayerRow, 'id'> & { key: string })[]
  /** Element rows reference layers by `layerKey` and sources by `storeyIndex` until ids exist. */
  elements: (Omit<ElementRow, 'id' | 'layer_id' | 'source_id'> & { layerKey: string; storeyIndex: number })[]
}

/**
 * Builds insert payloads for an IFC import. Count layers keep the opening sill in
 * elevation_m and width/height/IFC type inside `framing.meta`, because the layer
 * table has no separate metadata column yet.
 */
export function ifcImportToRows(
  model: IfcImport,
  ctx: { projectId: string; filePath: string; fileName: string; schema: string; app: string; sortStart: number },
): IfcImportRows {
  const sources = model.sheet.storeys.map((st, index) => ({
    project_id: ctx.projectId,
    kind: 'ifc_storey' as const,
    name: st.name,
    file_path: ctx.filePath,
    page_number: null,
    ifc_storey_guid: st.guid ?? NO_STOREY_GUID,
    scale_pt_per_m: IFC_SHEET_PT_PER_M,
    metadata: {
      original_name: ctx.fileName,
      schema: ctx.schema,
      app: ctx.app,
      storey_elevation_m: st.elev,
      sheet_width_pt: model.sheet.width,
      sheet_height_pt: model.sheet.height,
      storey_index: index,
    },
    sort_order: ctx.sortStart + (index + 1) * 10,
  }))

  const layers = model.items.map((it, index) => ({
    key: it.key,
    project_id: ctx.projectId,
    kind: it.kind,
    name: it.name,
    system: it.system || null,
    color: it.color,
    thickness_m: it.thickness ?? null,
    height_m: it.height ?? null,
    elevation_m: it.kind === 'count' ? it.sill ?? 0 : it.elevation ?? 0,
    deduct_openings: it.deductOpenings !== false,
    framing: {
      ...(it.framing || {}),
      meta: { ifcType: it.ifcType ?? null, layers: it.layers ?? [], width: it.width ?? null, location: it.location ?? null },
    },
    is_visible: true,
    sort_order: (index + 1) * 10,
  }))

  const elements = model.items.flatMap(it =>
    it.shapes.map(sh => ({
      layerKey: it.key,
      storeyIndex: sh.page - 1,
      project_id: ctx.projectId,
      points: sh.pts,
      height_override_m: sh.h ?? null,
      z_rel_m: it.kind === 'count' ? sh.sill ?? 0 : sh.zrel ?? 0,
      ifc_guid: sh.guid ?? null,
      root_guid: sh.root ?? null,
      layer_guids: (sh.layerGuids || []).filter((g): g is string => !!g),
      openings: sh.openings || [],
      faces: {},
    })),
  )

  return { sources, layers, elements }
}

/** Rebuilds engine items from stored rows (only elements of the given sources are included). */
export function rowsToItems(layers: LayerRow[], elements: ElementRow[], pageOfSource: Map<string, number>): TakeoffItem[] {
  return layers.map(l => {
    const { meta, ...framing } = (l.framing || {}) as Record<string, unknown> & { meta?: Record<string, unknown> }
    const hasFraming = typeof framing.spacing === 'number'
    const shapes: TakeoffShape[] = elements
      .filter(e => e.layer_id === l.id && pageOfSource.has(e.source_id))
      .map(e => ({
        id: e.id,
        page: pageOfSource.get(e.source_id)!,
        pts: e.points,
        h: e.height_override_m ?? undefined,
        zrel: e.z_rel_m,
        guid: e.ifc_guid,
        root: e.root_guid,
        layerGuids: e.layer_guids,
        openings: e.openings,
        sill: l.kind === 'count' ? e.z_rel_m : undefined,
        faceA: e.faces?.faceA,
        faceB: e.faces?.faceB,
        flipFaces: e.faces?.flip,
    tags: e.tag_labels,
      }))
    return {
      key: l.id,
      kind: l.kind,
      name: l.name,
      system: l.system || '',
      color: l.color,
      thickness: l.thickness_m ?? undefined,
      height: l.height_m ?? undefined,
      // Areas sit at their elevation; structural lines (grade beams, beams) too, walls at the floor.
      elevation: l.kind === 'area' || (l.kind === 'linear' && typeof meta?.struct === 'string') ? l.elevation_m : undefined,
      sill: l.kind === 'count' ? l.elevation_m : undefined,
      width: typeof meta?.width === 'number' ? meta.width : undefined,
      deductOpenings: l.deduct_openings,
      ifcType: typeof meta?.ifcType === 'string' ? meta.ifcType : undefined,
      ceiling: l.kind === 'area' ? ceilingSpecOf(meta) ?? undefined : undefined,
      floor: l.kind === 'area' ? floorSpecOf(meta) ?? undefined : undefined,
      mep: typeof meta?.mep === 'string' ? meta.mep : undefined,
      struct: typeof meta?.struct === 'string' ? meta.struct : undefined,
      depth: typeof meta?.depth === 'number' ? meta.depth : undefined,
      transparency: typeof meta?.transparency === 'number' ? Math.max(0, Math.min(0.9, meta.transparency)) : undefined,
      planTransparency: typeof meta?.planTransparency === 'number' ? Math.max(0, Math.min(0.95, meta.planTransparency)) : undefined,
      framing: hasFraming ? (framing as unknown as FramingConfig) : undefined,
      recipeId: l.recipe_id ?? null,
      wallTypeId: l.wall_type_id ?? null,
      shapes,
    }
  })
}

/**
 * Builds engine items for a whole project, with points converted to metres so that
 * sheets with different scales can be optimised together (use ptPerM = 1).
 * Each source becomes its own "page", so junctions never connect walls across sheets.
 * Sources without a scale are skipped.
 */
export function projectItemsInMetres(layers: LayerRow[], elements: ElementRow[], sources: SourceRow[]): { items: TakeoffItem[]; pageOfSource: Map<string, number> } {
  const scaled = sources.filter(s => Number(s.scale_pt_per_m) > 0)
  const pageOfSource = new Map(scaled.map((s, i) => [s.id, i + 1]))
  const scaleOf = new Map(scaled.map(s => [s.id, Number(s.scale_pt_per_m)]))
  const metricElements = elements
    .filter(e => scaleOf.has(e.source_id))
    .map(e => {
      const k = scaleOf.get(e.source_id)!
      return { ...e, points: e.points.map(p => [p[0] / k, p[1] / k] as Vec2) }
    })
  return { items: rowsToItems(layers, metricElements, pageOfSource), pageOfSource }
}
