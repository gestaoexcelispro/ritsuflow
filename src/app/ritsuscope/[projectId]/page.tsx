'use client'

import { ChangeEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AppBar } from '../../fieldop/ui'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { takeoffTranslator, useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { AppLanguage } from '@/lib/i18n/settings'
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import { layerQuantities } from '@/lib/takeoff/geometry'
import { openingRows } from '@/lib/takeoff/printMarkup'
import { IfcReadError } from '@/lib/takeoff/ifc/readIfc'
import { buildQuantitiesCsv } from '@/lib/takeoff/csv'
import { freeEnds, sanitizeFramingDefaults, type FramingDefaults } from '@/lib/takeoff/framing/framing'
import { recipeLineQuantities, recipeMaterials, rowToRecipe, type Recipe, type RecipeRow } from '@/lib/takeoff/recipes'
import { recipeVariables } from '@/lib/takeoff/systemRecipes'
import { projectItemsInMetres, rowsToItems, type ElementRow, type LayerRow, type SourceRow } from '@/lib/takeoff/rows'
import { computeOpeningTags, computeSegmentTags, withSegmentTags } from '@/lib/takeoff/segmentTags'
import { ui } from '../ui'
import FramingPanel from './FramingPanel'
import ElevationView from './ElevationView'
import LayerEditor from './LayerEditor'
import SplitPanel from './SplitPanel'
import ElementPanel from './ElementPanel'
import ChecksPanel from './ChecksPanel'
import RevisionPanel from './RevisionPanel'
import View3D, { render3DImage, type View3DStorey } from './View3D'
import PdfWorkspace, { type WorkCommand } from './PdfWorkspace'
import PlanView from './PlanView'
import ProjectPurchases from './ProjectPurchases'
import RecipesEditor from './RecipesEditor'
import SettingsPanel from './SettingsPanel'
import WallTypesLibrary from './WallTypesLibrary'
import WallTypePicker from './WallTypePicker'
import { COUNTRIES, WALL_TYPE_COLUMNS, layerFromWallType, projectCountry, type WallTypeRow } from '@/lib/takeoff/wallTypes'
import WallTypeCard from './WallTypeCard'
import OpeningsEditor from './OpeningsEditor'
import { useRecipeContext } from './useRecipeContext'
import MaterialsCatalog from './MaterialsCatalog'
import { ZONE_COLUMNS, scaleRatio, type ZoneKind, type ZoneRow } from '@/lib/takeoff/zones'
import { createFloorsForLevels, createLocationsForZones, loadLocations, placeRootLocations } from '@/lib/takeoff/locationSync'
import { importLegacyLocationMap, importableOutline, loadLegacyLocationMaps, type LegacyMap } from '@/lib/takeoff/importLocationMap'
import type { ElementOpening, TakeoffItem, Vec2 } from '@/lib/takeoff/geometry'
import ZoningSidebar from './ZoningSidebar'
import ZoneProperties from './ZoneProperties'
import { useRitsuScopeLicensed } from '../license'
import ShareDialog, { type ShareSnapshot } from './ShareDialog'
import { buildProjectPdf, type PrintSheet } from './printPdf'
import { areaRole, type AreaRole } from '@/lib/takeoff/areaRole'
import { mepExtra } from '@/lib/takeoff/mep'
import { structText } from '@/lib/takeoff/printMarkup'
import { originOf, pdfBuildingItems, sheetToModel, type SheetOrigin } from '@/lib/takeoff/origin'
import Icon from './icons'
import LevelsPanel from './LevelsPanel'
import LevelProperties from './LevelProperties'
import LevelsBulkEdit from './LevelsBulkEdit'
import TagsEditor from './TagsEditor'
import SurfaceTypePicker from './SurfaceTypePicker'
import type { SurfaceTypeRow } from './SurfaceTypesLibrary'
import SurfaceTypesLibrary, { surfaceLabelsFrom, useSurfaceLabels } from './SurfaceTypesLibrary'
import { loadUnderlay, underlayRegionOf, type UnderlaySpec, type UnderlayZone } from './planUnderlay'
import { sheetToModelOf } from '@/lib/takeoff/origin'
import { hexToRgb } from '@/lib/takeoff/printMarkup'
import { CEILING_FAMILY, FAMILIES, FLOOR_FAMILY, surfaceMaterials, type FamilyId } from './surfaceFamilies'
import GenerateLevelsDialog from './GenerateLevelsDialog'
import CopyToLevelsDialog from './CopyToLevelsDialog'
import DeleteFromLevelsDialog from './DeleteFromLevelsDialog'
import { NO_LEVEL, branchItems, branchOfLevel, levelBranches, withoutHiddenStoreys, type LevelBranch } from '@/lib/takeoff/levelTree'
import type { Quantities } from '@/lib/takeoff/geometry'
import { groupRows, type GroupKey, type SubKey } from '@/lib/takeoff/itemGroups'
import { materialRows, scaleGroup } from '@/lib/takeoff/materialList'
import { itemShareByZone, NONE } from '@/lib/takeoff/locationShare'
import { LEVEL_COLUMNS, fillLevelHeights, levelGroups, groupLabel, masterOf, matchLevelByName, normalizeLevels, sheetLevel, sheetMultiplier, wallHeightOf, type LevelRow } from '@/lib/takeoff/levels'
import { IfcEmptyError, importIfcFile } from './importIfc'
import { bandCentre, frameOf, measureTaskLines, nextTaskTag, planStyleOf, sameFace, takeWallStretch, type PlanStyle, type TaskDrawingRow, type WallRef } from '@/lib/takeoff/taskDrawings'
import { fingerprint, planColor, tagsOnLongest } from '@/lib/takeoff/fieldSheet'
import { buildFieldSheetPdf, type FieldSheetRow } from './fieldSheetPdf'
import { planMaterialsOf, sumMaterials, taskMaterials, type PlanMaterial, type TaskMaterialRow } from '@/lib/takeoff/taskMaterials'

type Project = { id: string; project_code: string | null; name: string; country: string | null; country_code: string | null; stage?: string | null }

const BUCKET = 'takeoff-files'

const layerKindKey: Record<LayerRow['kind'], TakeoffMessageKey> = {
  linear: 'workspace.layer.linear',
  area: 'workspace.layer.area',
  count: 'workspace.layer.count',
}

/** Storage keys must be ASCII-safe; keep the readable name in the source row. */
function safeFileName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '_')
}

function errorMessage(err: unknown) {
  if (err instanceof Error) return err.message
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return String(err)
}

async function countPdfPages(file: File): Promise<number> {
  const pdfjs = await import('pdfjs-dist-v5')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
  }
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    const pdf = await task.promise
    return pdf.numPages
  } finally {
    await task.destroy()
  }
}

const ELEMENT_COLUMNS = 'id, project_id, layer_id, source_id, points, height_override_m, z_rel_m, ifc_guid, root_guid, layer_guids, openings, faces'

/** Tarefas: lines of the activity being drawn. */
const TASK_COLOR = '#E11D48'
/** Location kinds that group others (not where work is built). */
const TASK_GROUP_KINDS = new Set(['building', 'floor', 'zone'])
type TaskScopeRow = { id: string; scope_code: string | null; scope_name: string; unit: string | null; quantity: number | null; takeoff_layer_id: string | null; takeoff_step?: string | null; plan_style?: PlanStyle | null; plan_materials?: unknown }
type TaskLocationRow = { id: string; name: string; location_type: string; parent_id: string | null; sequence_number: number | null; qr_token: string | null }
/** Task report (field sheet) settings, chosen in its dialog and kept with each issued revision. */
type ReportCfg = {
  kind: 'location' | 'activity'
  /** location: the zone + margin · custom: an area drawn on a sheet · sheet: the whole sheet. */
  areaMode: 'location' | 'custom' | 'sheet'
  marginM: number
  area: { sourceId: string; box: [number, number, number, number] } | null
  show: { estimate: boolean; openings: boolean; tags: boolean; table: boolean; detail: boolean; qr: boolean; materials: boolean; materialSummary: boolean }
  paper: 'A4' | 'A3'
  title: string
  responsible: string
  crew: string
  start: string
  end: string
  notes: string
}
const REPORT_DEFAULT: ReportCfg = {
  kind: 'location', areaMode: 'location', marginM: 1, area: null,
  show: { estimate: true, openings: true, tags: true, table: true, detail: true, qr: true, materials: true, materialSummary: true },
  paper: 'A4', title: '', responsible: '', crew: '', start: '', end: '', notes: '',
}
type FieldIssueRow = { id: string; location_id: string; kind: 'location' | 'activity'; scope_item_id: string | null; revision: number; fingerprint: string | null; file_path: string | null; issued_by_name: string | null; issued_at: string }

export default function TakeoffWorkspacePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const t = useTakeoffT()
  const { formatNumber, language, numberFormat } = useLanguage()
  const [project, setProject] = useState<Project | null>(null)
  const [sources, setSources] = useState<SourceRow[]>([])
  /** Building levels (pavimentos) and the one being edited in the right sidebar. */
  const [levels, setLevels] = useState<LevelRow[]>([])
  const [editingLevelId, setEditingLevelId] = useState<string | null>(null)
  /** Levels ticked in the levels panel, to edit or delete together. */
  const [checkedLevelIds, setCheckedLevelIds] = useState<Set<string>>(new Set())
  const [generateOpen, setGenerateOpen] = useState(false)
  /** Sheet whose takeoff is being copied to other levels. */
  const [copyFromId, setCopyFromId] = useState<string | null>(null)
  const [deleteLevelsOpen, setDeleteLevelsOpen] = useState(false)
  /** Level groups hidden with the level eye: this session only, not saved. */
  const [hiddenBranches, setHiddenBranches] = useState<Set<string>>(new Set())
  const [othersOpen, setOthersOpen] = useState(false)
  /** Item list groups folded by the user (this session only): "<branch>:<group>" or "<branch>:<group>:<sub>". */
  const [foldedGroups, setFoldedGroups] = useState<Set<string>>(new Set())
  const [layers, setLayers] = useState<LayerRow[]>([])
  /** Wall-type library (to show and assign the type of a selected wall's item). */
  const [wallTypes, setWallTypes] = useState<WallTypeRow[]>([])
  /** Choosing a library wall type for the selected wall (its item, or this wall only). */
  const [assignFor, setAssignFor] = useState<{ layerId: string; elementId: string } | null>(null)
  /** Choosing a library ceiling / floor type for the selected area (its item, or this area only). */
  const [surfaceAssign, setSurfaceAssign] = useState<{ family: FamilyId; layerId: string; elementId: string } | null>(null)
  const [assigning, setAssigning] = useState(false)
  /** Doors / Windows / Openings row being edited in the right sidebar. */
  /** Row under the header that hosts the drawing tool bar (filled by PdfWorkspace through a portal). */
  const [toolbarSlot, setToolbarSlot] = useState<HTMLDivElement | null>(null)
  /** Footer spot (left of the zoom) for the Snap and Ortho switches. */
  const [footerSlot, setFooterSlot] = useState<HTMLSpanElement | null>(null)
  /** Footer stretch between the cursor and the switches: tool hint and active-item bar. */
  const [statusSlot, setStatusSlot] = useState<HTMLSpanElement | null>(null)
  const [openingEditor, setOpeningEditor] = useState<'door' | 'window' | 'void' | null>(null)
  /** Elements as stored; `elements` (below) adds each stretch's tag. */
  const [rawElements, setElements] = useState<ElementRow[]>([])
  /** Every element with the tag of each of its stretches ("DW01-03") and of its openings ("D-01"), numbered across the whole project. */
  const elements = useMemo(() => {
    const order = sources.map(s => s.id)
    return withSegmentTags(
      rawElements,
      computeSegmentTags(rawElements, layers, wallTypes, order),
      computeOpeningTags(rawElements, order, { door: t('openingTag.door'), window: t('openingTag.window'), void: t('openingTag.void') }),
    )
  }, [rawElements, layers, wallTypes, sources, t])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [framingDefaults, setFramingDefaults] = useState<FramingDefaults>({})
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null)
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'plan' | '3d'>('plan')
  /** Header mode: what the sidebars (or the whole page) show. */
  /** Takeoff, estimating, 3D, reports, share links and IFC need the RitsuScope license; zoning is for everyone. */
  const licensed = useRitsuScopeLicensed()
  const [section, setSection] = useState<'zoning' | 'takeoff' | 'tasks' | 'estimating' | 'settings'>(licensed ? 'takeoff' : 'zoning')
  // Tarefas: where each scope item is built, per location (location_task_drawings). Opened from
  // Projects › Locations › Scope allocation with ?task=<scope item>&location=<location>&from=allocation.
  const [taskScopes, setTaskScopes] = useState<TaskScopeRow[]>([])
  const [taskLocations, setTaskLocations] = useState<TaskLocationRow[]>([])
  const [taskRows, setTaskRows] = useState<TaskDrawingRow[]>([])
  const [taskScopeId, setTaskScopeId] = useState<string | null>(null)
  const [taskLocationId, setTaskLocationId] = useState<string | null>(null)
  /** Task line clicked on the drawing: its properties show in the right panel. */
  const [inspectLineId, setInspectLineId] = useState<string | null>(null)
  /** Tasks: the locations' colour code under the drawing (plan and 3D). */
  const [taskZonesOn, setTaskZonesOn] = useState(true)
  const [taskHeight, setTaskHeight] = useState('')
  const [taskWalls, setTaskWalls] = useState(true)
  const [taskFrameTick, setTaskFrameTick] = useState(0)
  const [tasksLoaded, setTasksLoaded] = useState(false)
  /** Planning layer (the planner's lines) shown on the sheet; `taskWalls` is the estimate layer. */
  const [taskPlan, setTaskPlan] = useState(true)
  const [fieldIssues, setFieldIssues] = useState<FieldIssueRow[]>([])
  const [fieldBusy, setFieldBusy] = useState<string | null>(null)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportCfg, setReportCfg] = useState<ReportCfg>(REPORT_DEFAULT)
  /** Drawing the report area on the sheet (the dialog is hidden meanwhile). */
  const [areaPicking, setAreaPicking] = useState(false)
  /** Kind given to the next zone drawn in Zoning. */
  const [drawKind, setDrawKind] = useState<ZoneKind>('room')
  /** Old Location Map pages not moved into RitsuScope yet. */
  const [legacyMaps, setLegacyMaps] = useState<LegacyMap[]>([])
  const [legacyBusy, setLegacyBusy] = useState(false)
  useEffect(() => {
    let alive = true
    loadLegacyLocationMaps(createClient(), projectId).then(rows => { if (alive) setLegacyMaps(rows) }).catch(() => { if (alive) setLegacyMaps([]) })
    return () => { alive = false }
  }, [projectId])
  const [settingsTab, setSettingsTab] = useState<'project' | 'walltypes' | 'ceilingtypes' | 'floortypes' | 'recipes' | 'materials'>('project')
  const [pickerOpen, setPickerOpen] = useState(false)
  /** "+ Ceiling type" / "+ Floor type": pick a build-up (CL01…, FL01…) and draw it. */
  const [surfacePicker, setSurfacePicker] = useState<FamilyId | null>(null)
  const [zones, setZones] = useState<ZoneRow[]>([])
  const [zonesError, setZonesError] = useState<string | null>(null)
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [newZoneRequest, setNewZoneRequest] = useState(0)
  const [detectRoomsRequest, setDetectRoomsRequest] = useState(0)
  const [command, setCommand] = useState<WorkCommand | null>(null)
  const [zoom, setZoom] = useState(1)
  /** An opening configured in the wall's properties, waiting for a click on the plan to place it. */
  const [openingPick, setOpeningPick] = useState<{ elementId: string; opening: Omit<ElementOpening, 'off' | 'guid'> } | null>(null)
  useEffect(() => { setOpeningPick(null) }, [selectedElementId, selectedSourceId])
  const [menu, setMenu] = useState<'edit' | 'view' | 'sheet' | 'print' | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [printing, setPrinting] = useState(false)
  /** Report: PDF region with the locations in colour under the 3D page. */
  const [printUnderlay, setPrintUnderlay] = useState(true)
  /** Takeoff items ticked in the left list (for bulk delete), and the last one clicked (Shift-click ranges). */
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const lastChecked = useRef<string | null>(null)
  const cursorSink = useRef<((p: Vec2 | null) => void) | null>(null)
  const [leftOpen, setLeftOpen] = useState(true)
  const [rightOpen, setRightOpen] = useState(true)
  const [rightTab, setRightTab] = useState<'props' | 'buy' | 'revision'>('props')
  /** Item (layer) used for drawing on PDF sheets. */
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null)
  const [drawRequest, setDrawRequest] = useState(0)
  const [newLayerRequest, setNewLayerRequest] = useState(0)
  const [scope3d, setScope3d] = useState<'model' | 'source'>('model')
  /** Element picked in the whole-model 3D view on another storey; selected after the switch. */
  const pendingSelect = useRef<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [p, s, l, e, r, d] = await Promise.all([
      // RitsuFlow projects: `code` and `country_code` (aliased to the names the takeoff uses).
      supabase.from('projects').select('id, project_code:code, name, country:country_code, country_code, stage').eq('id', projectId).maybeSingle(),
      supabase.from('takeoff_sources')
        .select('*') // includes origin/level columns once they exist
        .eq('project_id', projectId)
        .order('sort_order').order('created_at'),
      supabase.from('takeoff_layers')
        .select('id, project_id, kind, name, system, color, thickness_m, height_m, elevation_m, deduct_openings, framing, is_visible, sort_order, recipe_id, wall_type_id')
        .eq('project_id', projectId)
        .order('sort_order').order('created_at'),
      supabase.from('takeoff_elements')
        .select(`${ELEMENT_COLUMNS}, segment_tags, created_at`)
        .eq('project_id', projectId)
        // Before migration 20261006_008 (segment_tags) the column is missing: load without it.
        .then(res => (res.error && /segment_tags/.test(res.error.message)
          ? supabase.from('takeoff_elements').select(`${ELEMENT_COLUMNS}, created_at`).eq('project_id', projectId)
          : res)),
      supabase.from('takeoff_recipes')
        .select('id, name, maker, system, kind, height_basis_m, waste_included_pct, status, lines, mode')
        .order('name'),
      supabase.from('takeoff_framing_defaults').select('settings').eq('project_id', projectId).maybeSingle(),
    ])
    // Zoning is optional: if its table isn't there yet, the rest still loads.
    const z = await supabase.from('takeoff_zones').select(ZONE_COLUMNS).eq('project_id', projectId).order('sort_order').order('created_at')
    setZones(z.error ? [] : ((z.data || []) as ZoneRow[]))
    const lv = await supabase.from('takeoff_levels').select(LEVEL_COLUMNS).eq('project_id', projectId).order('elevation_m').order('sort_order')
    setLevels(lv.error ? [] : normalizeLevels((lv.data || []) as Partial<LevelRow>[]))
    const wt = await supabase.from('takeoff_wall_types').select(WALL_TYPE_COLUMNS).order('name')
    setWallTypes(wt.error ? [] : ((wt.data || []) as WallTypeRow[]).map(x => ({ ...x, boards: Array.isArray(x.boards) ? x.boards : [], framing: x.framing || {} })))
    setZonesError(z.error ? z.error.message : null)
    const failure = p.error || s.error || l.error || e.error || r.error
    if (failure) setError(t('workspace.error', { message: failure.message }))
    const sourceRows = (s.data || []) as SourceRow[]
    setProject((p.data as Project | null) || null)
    setSources(sourceRows)
    setLayers((l.data || []) as LayerRow[])
    setElements((e.data || []) as ElementRow[])
    setRecipes(((r.data || []) as RecipeRow[]).map(rowToRecipe))
    setFramingDefaults(sanitizeFramingDefaults(d.data?.settings))
    setSelectedSourceId(current => (current && sourceRows.some(r => r.id === current) ? current : sourceRows[0]?.id ?? null))
    setLoading(false)
  }, [projectId, t])

  useEffect(() => { load() }, [load])

  const loadTasks = useCallback(async () => {
    const supabase = createClient()
    const [sc, lc, td, fi] = await Promise.all([
      // Planning columns are optional (older databases): fall back to the base columns.
      supabase.from('project_scopes').select('id, scope_code, scope_name, unit, quantity, takeoff_layer_id, takeoff_step, plan_style, plan_materials').eq('project_id', projectId).eq('item_type', 'item').order('scope_code')
        .then(async r => (r.error && /plan_style|plan_materials|takeoff_step/.test(r.error.message) ? await supabase.from('project_scopes').select('id, scope_code, scope_name, unit, quantity, takeoff_layer_id').eq('project_id', projectId).eq('item_type', 'item').order('scope_code') : r)),
      supabase.from('locations').select('id, name, location_type, parent_id, sequence_number, qr_token').eq('project_id', projectId).order('sequence_number'),
      supabase.from('location_task_drawings').select('*').eq('project_id', projectId),
      supabase.from('field_sheet_issues').select('id, location_id, kind, scope_item_id, revision, fingerprint, file_path, issued_by_name, issued_at').eq('project_id', projectId).order('revision', { ascending: false }),
    ])
    // Field sheet revisions are optional: without their table the rest still works.
    setFieldIssues(fi.error ? [] : ((fi.data || []) as FieldIssueRow[]))
    const failure = sc.error || lc.error || td.error
    if (failure) setError(t('workspace.error', { message: failure.message }))
    setTaskScopes((sc.data || []) as TaskScopeRow[])
    setTaskLocations((lc.data || []) as TaskLocationRow[])
    setTaskRows((td.data || []) as TaskDrawingRow[])
    setTasksLoaded(true)
  }, [projectId, t])
  useEffect(() => { if (section === 'tasks' && !tasksLoaded) void loadTasks() }, [section, tasksLoaded, loadTasks])
  // Deep link from Scope allocation: open Tarefas on that activity and location.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const scope = q.get('task')
    if (!scope) return
    setSection('tasks')
    setTaskScopeId(scope)
    setTaskLocationId(q.get('location'))
  }, [])

  const selectedSource = sources.find(s => s.id === selectedSourceId) || null
  /** Fade of a sheet's own drawing (white wash, 0…0.8), kept in the sheet's metadata. */
  const fadeOf = (src: SourceRow | null | undefined) => Math.max(0, Math.min(0.8, Number((src?.metadata as { background_fade?: number } | undefined)?.background_fade) || 0))
  const backgroundFade = fadeOf(selectedSource)
  const fadeSave = useRef<ReturnType<typeof setTimeout> | null>(null)
  function setBackgroundFade(value: number) {
    const src = selectedSource
    if (!src) return
    const metadata = { ...(src.metadata || {}), background_fade: value }
    setSources(prev => prev.map(x => (x.id === src.id ? { ...x, metadata } : x)))
    if (fadeSave.current) clearTimeout(fadeSave.current)
    fadeSave.current = setTimeout(() => {
      void createClient().from('takeoff_sources').update({ metadata }).eq('id', src.id).then(({ error: e }) => { if (e) setError(t('workspace.error', { message: e.message })) })
    }, 400)
  }

  // Engine items for the selected source only.
  // Every layer, with only this source's elements; layers without elements stay listed so they can be edited.
  const layerItems = useMemo(() => {
    if (!selectedSource) return []
    const items = rowsToItems(layers, elements, new Map([[selectedSource.id, 1]]))
    const lv = sheetLevel(selectedSource, new Map<string, LevelRow>(levels.map(l => [l.id, l] as [string, LevelRow])))
    const h = wallHeightOf(lv?.level)
    return h ? fillLevelHeights(items, () => h) : items
  }, [layers, elements, selectedSource, levels])
  const sourceItems = useMemo(() => layerItems.filter(it => it.shapes.length > 0), [layerItems])
  /** The item list grouped by level (tree mode, when the project has levels). */
  const branchData = useMemo(() => {
    const branches = levelBranches(levels, sources.filter(s => s.kind === 'pdf_page'))
    return new Map(branches.map(b => [b.id, branchItems(b, layers, elements)]))
  }, [levels, sources, layers, elements])
  /** Doors, windows and plain openings on this sheet's walls, one row per type (sizes in the detail). */
  /** Doors, windows and plain openings on these items' walls, one row per type (sizes in the detail). */
  const summarizeOpenings = useCallback((list: typeof layerItems) => {
    const kinds: { kind: 'door' | 'window' | 'void'; color: string; icon: string }[] = [
      { kind: 'door', color: '#B45309', icon: 'door' },
      { kind: 'window', color: '#0284C7', icon: 'window' },
      { kind: 'void', color: '#64748B', icon: 'opening' },
    ]
    const rows = openingRows(list)
    return kinds.map(k => {
      const mine = rows.filter(r => (k.kind === 'void' ? r.kind === 'void' || r.kind === 'other' : r.kind === k.kind))
      const sizes = new Map<string, number>()
      for (const r of mine) {
        const key = `${formatNumber(r.w, 2)} × ${formatNumber(r.h, 2)}`
        sizes.set(key, (sizes.get(key) || 0) + r.count)
      }
      return { ...k, count: mine.reduce((s2, r) => s2 + r.count, 0), area: mine.reduce((s2, r) => s2 + r.areaM2, 0), sizes: [...sizes.entries()] }
    }).filter(k => k.count > 0)
  }, [formatNumber])
  const openingSummary = useMemo(() => summarizeOpenings(sourceItems), [summarizeOpenings, sourceItems])
  const editingLayer = layers.find(l => l.id === editingLayerId) || null
  const recipeById = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes])
  const recipeOfItem = useCallback((it: { recipeId?: string | null }) => (it.recipeId ? recipeById.get(it.recipeId) : null), [recipeById])
  const recipeCtx = useRecipeContext(sourceItems, recipeOfItem)
  /** Recipe context for every item of the project (the PDF report covers all sheets). */
  const allLayerItems = useMemo(() => rowsToItems(layers, [], new Map()), [layers])
  const projectRecipeCtx = useRecipeContext(allLayerItems, recipeOfItem)

  useEffect(() => {
    setSelectedElementId(pendingSelect.current)
    pendingSelect.current = null
  }, [selectedSourceId])

  // Whole model in 3D: every storey of the same IFC file, stacked by elevation, in metres.
  const modelSources = useMemo(() => {
    if (!selectedSource) return []
    if (selectedSource.kind !== 'ifc_storey') return [selectedSource]
    return sources.filter(src => src.kind === 'ifc_storey' && src.file_path === selectedSource.file_path)
  }, [sources, selectedSource])
  const model3d = useMemo(() => {
    const { items, pageOfSource } = projectItemsInMetres(layers, elements, modelSources)
    const storeys: View3DStorey[] = modelSources
      .filter(src => pageOfSource.has(src.id))
      .map(src => ({
        page: pageOfSource.get(src.id)!,
        name: src.name,
        elevation: Number((src.metadata as Record<string, unknown>)?.storey_elevation_m) || 0,
      }))
    return { items: items.filter(it => it.shapes.length > 0), storeys }
  }, [layers, elements, modelSources])
  // PDF floors aligned on their origins (one storey per sheet with an origin and a scale).
  const pdfBuilding = useMemo(() => {
    if (selectedSource?.kind !== 'pdf_page') return null
    const b = pdfBuildingItems(layers, elements, sources, levels)
    const byId = new Map<string, LevelRow>(levels.map(l => [l.id, l] as [string, LevelRow]))
    const hOfPage = new Map(b.storeys.map(st => [st.page, wallHeightOf(st.levelId ? byId.get(st.levelId) : null)]))
    return { ...b, items: fillLevelHeights(b.items, page => hOfPage.get(page) ?? null) }
  }, [selectedSource, layers, elements, sources, levels])
  /** Plan underlays for the 3D: each sheet's framed region (never the whole sheet) and its locations, per 3D scope. */
  // Locations: the most detailed kind drawn on the sheet (rooms over areas over zones over blocks), so colours don't stack.
  const locationZonesOf = useCallback((sourceId: string) => {
    const vis = zones.filter(z => z.source_id === sourceId && z.is_visible && z.points.length >= 3)
    const rank = ['room', 'area', 'zone', 'block']
    const kind = rank.find(k => vis.some(z => (z.zone_kind || 'room') === k))
    return vis.filter(z => (z.zone_kind || 'room') === kind)
  }, [zones])
  const underlay3d = useMemo(() => {
    const toModelOf = sheetToModelOf(sources)
    const zonesOf = locationZonesOf
    const sheet: { underlays: UnderlaySpec[]; zones: UnderlayZone[] } = { underlays: [], zones: [] }
    if (selectedSource?.kind === 'pdf_page') {
      const region = underlayRegionOf(selectedSource)
      if (region) {
        sheet.underlays.push({ page: 1, filePath: selectedSource.file_path, pageNumber: selectedSource.page_number || 1, region, toModel: p => p })
        sheet.zones = zonesOf(selectedSource.id).map(z => ({ page: 1, pts: z.points, color: z.color, name: z.name }))
      }
    }
    const model: { underlays: UnderlaySpec[]; zones: UnderlayZone[] } = { underlays: [], zones: [] }
    for (const st of pdfBuilding?.storeys || []) {
      const src = sources.find(x => x.id === st.sourceId)
      const region = underlayRegionOf(src)
      const toModel = src ? toModelOf(src) : null
      if (!src || !region || !toModel) continue
      model.underlays.push({ page: st.page, filePath: src.file_path, pageNumber: src.page_number || 1, region, toModel })
      model.zones.push(...zonesOf(src.id).map(z => ({ page: st.page, pts: z.points.map(toModel), color: z.color, name: z.name })))
    }
    return { sheet, model }
  }, [sources, locationZonesOf, selectedSource, pdfBuilding])
  const isIfcModel = selectedSource?.kind === 'ifc_storey'
  const modelData = isIfcModel ? model3d : pdfBuilding ? { items: pdfBuilding.items.filter(it => it.shapes.length > 0), storeys: pdfBuilding.storeys } : model3d
  const canShowModel = isIfcModel
    ? modelSources.length > 1
    : !!pdfBuilding && pdfBuilding.storeys.length > 1 && pdfBuilding.storeys.some(st => st.sourceId === selectedSource?.id)

  function selectFromModel(id: string | null) {
    if (!id) { setSelectedElementId(null); return }
    const el = elements.find(e => e.id === id)
    if (el && el.source_id !== selectedSourceId) {
      pendingSelect.current = id
      setSelectedSourceId(el.source_id)
    } else {
      setSelectedElementId(id)
    }
  }

  const selection = useMemo(() => {
    if (!selectedElementId) return null
    for (const item of sourceItems) {
      const shape = item.shapes.find(sh => sh.id === selectedElementId)
      if (shape) return { item, shape }
    }
    return null
  }, [sourceItems, selectedElementId])
  const selectedElementRow = elements.find(e => e.id === selectedElementId) || null

  useEffect(() => {
    if (!selectedElementId) return
    setEditingLayerId(null)
    setEditingLevelId(null)
    setCheckedLevelIds(new Set())
    setOpeningEditor(null)
    setRightTab('props')
  }, [selectedElementId])
  useEffect(() => { if (editingLayerId || openingEditor) { setEditingLevelId(null); setCheckedLevelIds(new Set()) } }, [editingLayerId, openingEditor])

  async function deleteSource(source: SourceRow) {
    const count = elements.filter(e => e.source_id === source.id).length
    if (!window.confirm(t('source.confirmDelete', { name: source.name, count }))) return
    setError('')
    const supabase = createClient()
    const { data, error: e } = await supabase.from('takeoff_sources').delete().eq('id', source.id).select('id')
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    // RLS hides the row from non-admins: nothing is deleted and no error is returned.
    if (!data || data.length === 0) { setError(t('admin.only')); return }
    // Remove the stored file when no other source (page or storey) still uses it.
    if (!sources.some(s => s.id !== source.id && s.file_path === source.file_path)) {
      await supabase.storage.from('takeoff-files').remove([source.file_path])
    }
    setStatus(t('source.deleted', { name: source.name }))
    await load()
  }

  const surfaceLabels = useSurfaceLabels()
  function exportCsv() {
    if (!selectedSource || !ptPerM) return
    const csv = buildQuantitiesCsv(sourceItems, ptPerM, numberFormat, {
      layer: t('csv.layer'),
      kind: { linear: t('workspace.layer.linear'), area: t('workspace.layer.area'), count: t('workspace.layer.count') },
      system: t('csv.system'),
      elements: t('csv.elements'),
      length: t('csv.length'),
      grossArea: t('csv.grossArea'),
      openings: t('csv.openings'),
      netArea: t('csv.netArea'),
      area: t('csv.area'),
      perimeter: t('csv.perimeter'),
      count: t('csv.count'),
      material: t('csv.material'),
      type: t('csv.type'),
      profile: t('csv.profile'),
      board: t('csv.board'),
      quantity: t('csv.quantity'),
      unit: t('csv.unit'),
      bars: t('csv.bars'),
      sheets: t('csv.sheets'),
      waste: t('csv.waste'),
      splices: t('csv.splices'),
      recipe: t('csv.recipe'),
      packages: t('csv.packages'),
      screws: t('csv.screws'),
      tag: t('csv.tag'),
      height: t('csv.height'),
    }, [...recipeMaterials(sourceItems, ptPerM, recipeOfItem, recipeCtx), ...surfaceMaterials(sourceItems, ptPerM, surfaceLabels).flatMap(x => x.materials)])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${project?.project_code || project?.name || 'levantamento'} - ${selectedSource.name}.csv`.replace(/[\\/:*?"<>|]+/g, '_')
    document.body.appendChild(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
  }

  const ptPerM = selectedSource?.scale_pt_per_m ? Number(selectedSource.scale_pt_per_m) : 0

  async function uploadPdf(file: File) {
    const pageCount = await countPdfPages(file)
    const supabase = createClient()
    const path = `${projectId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
    const upload = await supabase.storage.from(BUCKET).upload(path, file, { contentType: 'application/pdf', upsert: false })
    if (upload.error) throw upload.error
    const baseName = file.name.replace(/\.pdf$/i, '')
    const rows = Array.from({ length: pageCount }, (_, index) => ({
      project_id: projectId,
      kind: 'pdf_page' as const,
      name: pageCount > 1 ? `${baseName} · ${index + 1}` : baseName,
      file_path: path,
      page_number: index + 1,
      sort_order: (sources.length + index + 1) * 10,
      metadata: { original_name: file.name, page_count: pageCount },
      // One-page PDFs: guess the level from the file name ("PAV 3", "Térreo"…); the user can move it.
      level_id: pageCount === 1 ? matchLevelByName(baseName, levels.filter(l => !l.typical_of)) : null,
    }))
    const insert = await supabase.from('takeoff_sources').insert(rows)
    if (insert.error) {
      await supabase.storage.from(BUCKET).remove([path])
      throw insert.error
    }
    setStatus(t('workspace.upload.done', { name: file.name, count: pageCount }))
  }

  async function uploadIfc(file: File) {
    setStatus(t('workspace.ifc.reading', { name: file.name }))
    try {
      const outcome = await importIfcFile(createClient(), file, projectId, language, sources.length * 10, count =>
        setStatus(t('workspace.ifc.saving', { count })),
        framingDefaults,
      )
      const parts = [t('workspace.ifc.done', { name: file.name, walls: outcome.walls, layers: outcome.layers, elements: outcome.elements })]
      if (outcome.warnings) parts.push(t('workspace.ifc.warnings', { count: outcome.warnings }))
      setStatus(parts.join(' '))
    } catch (err) {
      if (err instanceof IfcEmptyError) throw new Error(t('workspace.ifc.empty'))
      if (err instanceof IfcReadError) throw new Error(t('workspace.ifc.readError', { message: err.message }))
      throw err
    }
  }

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError('')
    setStatus('')
    const lower = file.name.toLowerCase()
    const isPdf = lower.endsWith('.pdf')
    const isIfc = lower.endsWith('.ifc')
    if (!isPdf && !isIfc) {
      setError(t('workspace.upload.unsupported', { name: file.name }))
      return
    }
    if (isIfc && !licensed) {
      setError(t('license.ifc'))
      return
    }
    setBusy(true)
    if (isPdf) setStatus(t('workspace.uploading', { name: file.name }))
    try {
      if (isPdf) await uploadPdf(file)
      else await uploadIfc(file)
      await load()
    } catch (err) {
      setStatus('')
      setError(t('workspace.upload.error', { message: errorMessage(err) }))
    } finally {
      setBusy(false)
    }
  }

  const sheet = selectedSource?.metadata as { sheet_width_pt?: number; sheet_height_pt?: number } | undefined

  /** Reinforcements: metres along the wall and m² of backing, under the count. */
  const blockingSub = (item: (typeof layerItems)[number], n: number) => {
    const e = mepExtra(item, n)
    return e ? `${formatNumber(e.lengthM)} m · ${formatNumber(e.areaM2)} m²` : ''
  }
  const itemQuantity = (item: (typeof layerItems)[number]) => {
    if (!ptPerM || !item.shapes.length) return { main: '—', sub: '' }
    const q = layerQuantities(item, ptPerM)
    if (!q) return { main: '—', sub: '' }
    if (item.struct) return { ...plainQuantity(item, q), sub: structText(item, q, v => formatNumber(v, 2), t('struct.formwork')) }
    // Walls lead with their area (net of openings), length below; lines without a height keep metres.
    if (item.kind === 'linear') return (q.net ?? 0) > 0
      ? { main: `${formatNumber(q.net ?? 0)} m²`, sub: `${formatNumber(q.len)} m` }
      : { main: `${formatNumber(q.len)} m`, sub: '' }
    if (item.kind === 'area') return { main: `${formatNumber(q.area)} m²`, sub: `${formatNumber(q.per)} m` }
    return { main: `${q.n} ${t('unit.un')}`, sub: blockingSub(item, q.n) }
  }

  /** Main figure of an item: length, area or count. */
  const plainQuantity = (item: (typeof layerItems)[number], q: Quantities) => (
    item.kind === 'linear' ? { main: `${formatNumber(q.len)} m`, sub: '' }
      : item.kind === 'area' ? { main: `${formatNumber(q.area)} m²`, sub: '' }
        : { main: `${q.n} ${t('unit.un')}`, sub: '' }
  )
  const quantityText = (item: (typeof layerItems)[number], q: Quantities | null) => {
    if (!q) return { main: '—', sub: '' }
    if (item.struct) return { ...plainQuantity(item, q), sub: structText(item, q, v => formatNumber(v, 2), t('struct.formwork')) }
    // Walls lead with their area (net of openings), length below; lines without a height keep metres.
    if (item.kind === 'linear') return (q.net ?? 0) > 0
      ? { main: `${formatNumber(q.net ?? 0)} m²`, sub: `${formatNumber(q.len)} m` }
      : { main: `${formatNumber(q.len)} m`, sub: '' }
    if (item.kind === 'area') return { main: `${formatNumber(q.area)} m²`, sub: `${formatNumber(q.per)} m` }
    return { main: `${q.n} ${t('unit.un')}`, sub: blockingSub(item, q.n) }
  }

  const tabBtn = (active: boolean) => ({
    ...ui.button,
    height: 28,
    padding: '0 10px',
    fontSize: 10,
    background: active ? '#109d91' : '#fff',
    color: active ? '#fff' : '#294955',
    border: '1px solid ' + (active ? '#109d91' : '#d3dfe2'),
  })
  const isPdf = selectedSource?.kind === 'pdf_page'
  /** The drawing tool bar gets its own full-width row under the header on PDF sheets. */
  // ---------- Tarefas ----------
  const taskScope = taskScopes.find(x => x.id === taskScopeId) || null
  const taskLocation = taskLocations.find(x => x.id === taskLocationId) || null
  const taskZone = taskLocationId ? zones.find(z => z.location_id === taskLocationId && Array.isArray(z.points) && z.points.length >= 3) || null : null
  const taskZoneSheet = taskZone ? sources.find(x => x.id === taskZone.source_id) || null : null
  // Choosing a location shows its zone's sheet and frames it (room + 1 m).
  useEffect(() => {
    if (section !== 'tasks' || !taskZone) return
    if (taskZone.source_id !== selectedSourceId) setSelectedSourceId(taskZone.source_id)
    setTaskFrameTick(n => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, taskZone?.id])
  /** Walls (and their openings) on this sheet: "take a wall" and the openings deducted from task lines. */
  const taskWallRefs: WallRef[] = useMemo(() => sourceItems.filter(it => it.kind === 'linear').flatMap(it => it.shapes.map(sh => ({ pts: sh.pts, openings: sh.openings, kind: it.kind, thickness: it.thickness }))), [sourceItems])
  const taskHeightM = (() => { const v = Number(String(taskHeight).replace(',', '.')); return v > 0 ? v : null })()
  // Default wall height: the one already used for these lines, else the item's own takeoff item, else the sheet's level.
  useEffect(() => {
    if (!taskScopeId || !taskLocationId) return
    const used = taskRows.find(r => r.scope_item_id === taskScopeId && r.location_id === taskLocationId && r.height_m)?.height_m
    const own = taskScope?.takeoff_layer_id ? layers.find(l => l.id === taskScope.takeoff_layer_id)?.height_m : null
    const lv = taskZoneSheet?.level_id ? levels.find(l => l.id === taskZoneSheet.level_id) : null
    const h = used || (own && Number(own) > 0 ? Number(own) : null) || wallHeightOf(lv ?? null)
    setTaskHeight(h ? String(h) : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskScopeId, taskLocationId, tasksLoaded, taskScope?.takeoff_layer_id])
  const taskHere = taskRows.filter(r => r.scope_item_id === taskScopeId && r.location_id === taskLocationId)
  const taskMeasured = measureTaskLines(taskHere.filter(r => r.source_id === selectedSource?.id).map(r => r.points), { ptPerM: Number(selectedSource?.scale_pt_per_m) || 0, heightM: taskHeightM, unit: taskScope?.unit, walls: taskWallRefs })

  const lockedSection = !licensed && (section === 'takeoff' || section === 'tasks' || section === 'estimating')
  const toolbarShown = !lockedSection && (section === 'zoning' || section === 'takeoff' || section === 'tasks') && isPdf && viewMode === 'plan'

  if (loading || !project) {
    return (
      <section style={{ ...ui.page, padding: 16 }}>
        <Link href="/ritsuscope" style={ui.backLink}>← {t('workspace.back')}</Link>
        {loading ? <div style={ui.muted}>{t('workspace.loading')}</div> : (
          <>
            {error && <div style={ui.error}>{error}</div>}
            <div style={ui.empty}>{t('workspace.notFound')}</div>
          </>
        )}
      </section>
    )
  }

  /** Items hidden with the eye in the list: not drawn on the plan or in 3D (still counted). */
  const hiddenLayerIds = new Set(layers.filter(l => l.is_visible === false).map(l => l.id))
  /** Level eye: the current sheet's level hidden → nothing drawn on the plan; hidden levels leave the building 3D. */
  const currentBranch = selectedSource ? branchOfLevel(selectedSource.level_id, levels) : null
  const levelHidden = currentBranch != null && hiddenBranches.has(currentBranch)
  const shownItems = levelHidden ? [] : hiddenLayerIds.size ? sourceItems.filter(it => !hiddenLayerIds.has(it.key)) : sourceItems

  /** Planning layer colour of a scope item (its place in the scope list). */
  const styleOfScope = (scopeId: string | null | undefined) => planStyleOf(taskScopes.find(x => x.id === scopeId)?.plan_style)
  const colorOfScope = (scopeId: string | null | undefined) => styleOfScope(scopeId).color || planColor(Math.max(0, taskScopes.findIndex(x => x.id === scopeId)))
  /** Estimate layer: the takeoff, faint, without its tags (the planning labels must read). */
  const estimateLayer = (list: TakeoffItem[]): TakeoffItem[] => list.map(it => ({ ...it, planTransparency: 0.8, shapes: it.shapes.map(sh => ({ ...sh, tags: undefined, openingTags: undefined })) }))
  /** Planning layer on a sheet: one item per activity, each line labelled "code · quantity unit". */
  const planningLayer = (sheetId: string, opts: { locationId?: string | null; scopeId?: string | null; emphasize?: string | null; selectable?: { scopeId: string | null; locationId: string | null } }): TakeoffItem[] =>
    taskScopes.map(sc => {
      const rows = taskRows.filter(r => r.scope_item_id === sc.id && r.source_id === sheetId && (!opts.locationId || r.location_id === opts.locationId) && (!opts.scopeId || r.scope_item_id === opts.scopeId))
      if (!rows.length) return null
      const faded = opts.emphasize && sc.id !== opts.emphasize
      const st = planStyleOf(sc.plan_style)
      const k = Number(sources.find(x => x.id === sheetId)?.scale_pt_per_m) || 0
      return {
        key: `__plan_${sc.id}`, kind: 'linear' as const, name: sc.scope_name, system: '', color: colorOfScope(sc.id), thickness: st.thickness_m, flatEnds: true, planTransparency: faded ? Math.max(0.6, st.transparency) : st.transparency,
        shapes: rows.map(r => ({ r, pts: bandCentre(r.points, r.side, st.thickness_m, k) })).map(({ r, pts }) => ({
          id: opts.selectable && r.scope_item_id === opts.selectable.scopeId && r.location_id === opts.selectable.locationId ? `task:${r.id}` : `plan:${r.id}`,
          page: 1, pts, tags: tagsOnLongest(pts, r.tag || sc.scope_code || ''), // the tag only: quantities go to the report
          tagCallout: true, tagAt: Array.isArray(r.label_at) && r.label_at.length === 2 ? r.label_at as Vec2 : null,
        })),
      }
    }).filter(Boolean) as TakeoffItem[]
  const taskShownItems: TakeoffItem[] = (() => {
    if (section !== 'tasks' || !selectedSource) return shownItems
    return [
      ...(taskWalls ? estimateLayer(shownItems) : []),
      ...(taskPlan ? planningLayer(selectedSource.id, { emphasize: taskScopeId, selectable: { scopeId: taskScopeId, locationId: taskLocationId } }) : []),
    ]
  })()

  /** Saves one task line for the chosen activity and location, measured now. */
  async function saveTaskLine(pts: Vec2[], side: 1 | -1): Promise<string | null> {
    if (!taskScope || !taskLocationId) { setError(t('task.panel.pick')); return null }
    if (!selectedSource) return null
    const k = Number(selectedSource.scale_pt_per_m) || 0
    const m = measureTaskLines([pts], { ptPerM: k, heightM: taskHeightM, unit: taskScope.unit, walls: taskWallRefs })
    if (m.measure === 'wallArea' && !taskHeightM) { setError(t('task.needsHeight')); return null }
    const supabase = createClient()
    const insert = (tag: string) => supabase.from('location_task_drawings').insert({
      project_id: projectId, scope_item_id: taskScope.id, location_id: taskLocationId, source_id: selectedSource.id,
      points: pts, side, height_m: m.measure === 'wallArea' ? taskHeightM : null, quantity: Math.round(m.quantity * 10000) / 10000, unit: taskScope.unit, tag,
    }).select('id').single()
    let { data, error: e } = await insert(nextTaskTag(taskScope.scope_code, taskRows.filter(r => r.scope_item_id === taskScope.id).map(r => r.tag)))
    if (e?.code === '23505') {
      // Someone else took that tag meanwhile: number again from the database.
      const { data: used } = await supabase.from('location_task_drawings').select('tag').eq('project_id', projectId).eq('scope_item_id', taskScope.id)
      ;({ data, error: e } = await insert(nextTaskTag(taskScope.scope_code, (used || []).map(r => (r as { tag: string | null }).tag))))
    }
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return null }
    await loadTasks()
    return data.id as string
  }
  /** A task label (callout) dragged on the sheet: its new place, or null to place it automatically again. */
  async function moveTaskLabel(shapeId: string, at: Vec2 | null) {
    const id = shapeId.replace(/^(task|plan):/, '')
    const value = at ? [Math.round(at[0] * 100) / 100, Math.round(at[1] * 100) / 100] as Vec2 : null
    setTaskRows(prev => prev.map(r => (r.id === id ? { ...r, label_at: value } : r)))
    const { error: e } = await createClient().from('location_task_drawings').update({ label_at: value }).eq('id', id)
    // Without the label_at column (migration not run yet) the label still moves on screen, but is not kept.
    if (e) setError(/label_at/.test(e.message) ? t('task.labelNotSaved') : t('workspace.error', { message: e.message }))
  }
  /** "Take wall": the clicked wall's stretch along the location (the side click then places the task line). */
  function pickTaskWall(p: Vec2): { a: Vec2; b: Vec2; thicknessM: number } | null {
    if (!selectedSource) return null
    const k = Number(selectedSource.scale_pt_per_m) || 0
    // With the location's zone on this sheet, the stretch stops at the room; without it, the whole wall stretch.
    const room = taskZone && taskZone.source_id === selectedSource.id ? frameOf(taskZone.points as Vec2[], k, 0) : null
    return takeWallStretch(p, taskWallRefs, room || [-1e9, -1e9, 1e9, 1e9], k)
  }
  /** A new wall height re-measures this location's lines. */
  async function applyTaskHeight() {
    if (!taskScope || !selectedSource) return
    const k = Number(selectedSource.scale_pt_per_m) || 0
    const rows = taskHere.filter(r => r.source_id === selectedSource.id)
    if (!rows.length || !taskHeightM) return
    if (rows.every(r => Number(r.height_m) === taskHeightM)) return
    const supabase = createClient()
    for (const r of rows) {
      const m = measureTaskLines([r.points], { ptPerM: k, heightM: taskHeightM, unit: taskScope.unit, walls: taskWallRefs })
      const { error: e } = await supabase.from('location_task_drawings').update({ height_m: m.measure === 'wallArea' ? taskHeightM : null, quantity: Math.round(m.quantity * 10000) / 10000 }).eq('id', r.id)
      if (e) { setError(t('workspace.error', { message: e.message })); return }
    }
    await loadTasks()
    setStatus(t('task.panel.heightApplied'))
  }
  // ---------- Materials of planned tasks ----------
  const matLabels = { bars: t('mat.bars'), sheets: t('mat.sheets'), un: t('mat.un'), rolls: t('fixings.rollsUnit'), barLen: (v: number) => `${formatNumber(v, 2)} m` }
  /** Materials of one activity's lines in one location (all sheets), from the wall layout and the activity's rates. */
  function materialsFor(scopeId: string, locationId: string): TaskMaterialRow[] {
    const sc = taskScopes.find(x => x.id === scopeId)
    if (!sc) return []
    const rows = taskRows.filter(r => r.scope_item_id === scopeId && r.location_id === locationId)
    const rates = planMaterialsOf(sc.plan_materials)
    const out: TaskMaterialRow[][] = []
    for (const sheetId of [...new Set(rows.map(r => r.source_id))]) {
      const sheet = sources.find(x => x.id === sheetId)
      const k = Number(sheet?.scale_pt_per_m) || 0
      if (!sheet || !(k > 0)) continue
      const lv = sheetLevel(sheet, new Map<string, LevelRow>(levels.map(l => [l.id, l] as [string, LevelRow])))
      const h = wallHeightOf(lv?.level)
      const raw = rowsToItems(layers, rawElements, new Map([[sheetId, 1]]))
      const sheetItems = (h ? fillLevelHeights(raw, () => h) : raw).filter(it => it.shapes.length > 0)
      const item = sc.takeoff_layer_id ? sheetItems.find(it => it.key === sc.takeoff_layer_id) || null : null
      const wt = item ? projectRecipeCtx.wallTypeOf?.(item) : null
      const insId = wt?.materials?.insulation
      const ins = insId ? projectRecipeCtx.catalog?.get(insId) : undefined
      // The wall's estimate: its recipe lines for the whole item; the task takes its stretch's share.
      const recipeLines = item ? recipeLineQuantities(item, k, recipeOfItem(item), projectRecipeCtx) : []
      const vars = item && recipeLines.length ? recipeVariables(item, k, wt) : null
      out.push(taskMaterials({
        step: sc.takeoff_step || null, item, sheetItems, ptPerM: k, rates, labels: matLabels,
        recipeLines, itemBase: vars ? { area: vars.area, length: vars.length } : null, ends: freeEnds(sheetItems, k),
        lines: rows.filter(r => r.source_id === sheetId).map(r => ({ points: r.points, side: r.side, height_m: r.height_m })),
        insulation: ins ? { name: ins.name, unit: ins.unit, packSize: ins.pack_size, packName: ins.pack_name } : sc.takeoff_step === 'insulation' && insId ? { name: t('mat.insulation'), unit: 'm²' } : null,
      }))
    }
    return sumMaterials(out)
  }
  const fmtMat = (r: TaskMaterialRow) => ({ whole: `${formatNumber(r.whole, 0)} ${r.wholeUnit}`, exact: `${formatNumber(r.exact, 2)} ${r.unit}` })
  /** Activity rates: changed live, saved when a field is left. */
  function setRatesLocal(scopeId: string, list: PlanMaterial[]) { setTaskScopes(prev => prev.map(x => (x.id === scopeId ? { ...x, plan_materials: list } : x))) }
  async function saveRates(scopeId: string, list: PlanMaterial[]) {
    setRatesLocal(scopeId, list)
    const { error: e } = await createClient().from('project_scopes').update({ plan_materials: list }).eq('id', scopeId)
    if (e) setError(t('workspace.error', { message: e.message }))
  }

  // ---------- Field sheets (PDF to the field, issued as revisions) ----------
  type FieldKind = 'location' | 'activity'
  const fieldLines = (kind: FieldKind) => taskRows.filter(r => r.location_id === taskLocationId && (kind === 'location' || r.scope_item_id === taskScopeId))
  const latestIssue = (kind: FieldKind) => fieldIssues.find(i => i.location_id === taskLocationId && i.kind === kind && (kind === 'location' || i.scope_item_id === taskScopeId)) || null
  const fieldState = (kind: FieldKind) => {
    const last = latestIssue(kind)
    const lines = fieldLines(kind)
    return { last, lines, changed: !!last && last.fingerprint !== fingerprint(lines), next: last ? last.revision + 1 : 0 }
  }
  async function actorName(): Promise<string> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return ''
    const { data: p } = await supabase.from('user_profiles').select('full_name, display_name, email').eq('user_id', user.id).maybeSingle()
    return p?.full_name || p?.display_name || p?.email || user.email || ''
  }
  function saveBlob(blob: Blob, name: string) {
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href; a.download = name; document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 60_000)
  }
  const fileSafe = (v: string) => v.replace(/[\\/:*?"<>|]+/g, '-').trim()
  /** Builds the PDF of the chosen location (all activities or just the chosen one) with the report settings, as a preview or as revision `revision`. */
  async function makeFieldSheet(kind: FieldKind, revision: number | null, issuedBy: string, cfg: ReportCfg) {
    if (!taskLocation || (kind === 'activity' && !taskScope)) throw new Error(t('task.panel.pick'))
    // Which sheet and which part of it.
    let sheet: SourceRow | undefined
    let frame: [number, number, number, number] | null = null
    if (cfg.areaMode === 'custom') {
      if (!cfg.area) throw new Error(t('report.area.missing'))
      sheet = sources.find(x => x.id === cfg.area!.sourceId)
      frame = cfg.area.box
    } else if (cfg.areaMode === 'location') {
      if (!taskZone) throw new Error(t('task.panel.noZone', { location: taskLocation.name }))
      sheet = sources.find(x => x.id === taskZone.source_id)
      frame = frameOf(taskZone.points as Vec2[], Number(sheet?.scale_pt_per_m) || 0, Math.max(0, cfg.marginM))
    } else {
      sheet = (taskZone && sources.find(x => x.id === taskZone.source_id)) || selectedSource || undefined
    }
    if (!sheet || sheet.kind !== 'pdf_page') throw new Error(t('zone.pdfOnly'))
    const k = Number(sheet.scale_pt_per_m) || 0
    if (!(k > 0)) throw new Error(t('draw.needScale'))
    const lines = fieldLines(kind)
    const { data: signed, error: se } = await createClient().storage.from(BUCKET).createSignedUrl(sheet.file_path, 600)
    if (se || !signed) throw se || new Error('no URL')
    const sheetItems = rowsToItems(layers, rawElements, new Map([[sheet.id, 1]])).filter(it => it.shapes.length > 0)
    const estimate = cfg.show.estimate ? estimateLayer(sheetItems).map(it => (cfg.show.openings ? it : { ...it, shapes: it.shapes.map(sh => ({ ...sh, openings: [] })) })) : []
    const planning = planningLayer(sheet.id, { locationId: taskLocation.id, scopeId: kind === 'activity' ? taskScopeId : null })
      .map(it => (cfg.show.tags ? it : { ...it, shapes: it.shapes.map(sh => ({ ...sh, tags: undefined })) }))
    const items = [...estimate, ...planning]
    const walls: WallRef[] = sheetItems.filter(it => it.kind === 'linear').flatMap(it => it.shapes.map(sh => ({ pts: sh.pts, openings: sh.openings, kind: it.kind })))
    const scopes = taskScopes.filter(sc => lines.some(r => r.scope_item_id === sc.id))
    const rows: FieldSheetRow[] = scopes.map(sc => {
      const mine = lines.filter(r => r.scope_item_id === sc.id)
      const qty = mine.reduce((a, r) => a + Number(r.quantity || 0), 0)
      const tags = cfg.show.tags ? mine.map(r => r.tag).filter(Boolean).join(', ') : ''
      let detail: string | undefined = tags || undefined
      if (kind === 'activity') {
        const h = Number(mine.find(r => r.height_m)?.height_m) || null
        const m = measureTaskLines(mine.map(r => r.points), { ptPerM: k, heightM: h, unit: sc.unit, walls })
        if (m.measure === 'wallArea') detail = [tags, t('task.panel.breakdown', { length: formatNumber(m.length, 2), height: h ? formatNumber(h, 2) : '—', openings: formatNumber(m.openings, 2) })].filter(Boolean).join(' · ')
      }
      return { color: colorOfScope(sc.id), code: sc.scope_code || '', name: sc.scope_name, qty: `${formatNumber(qty, 2)} ${sc.unit || ''}`.trim(), detail }
    })
    const matGroups = scopes.map(sc => ({ sc, rows: materialsFor(sc.id, taskLocation.id) })).filter(g => g.rows.length)
    const matSummary = sumMaterials(matGroups.map(g => g.rows))
    const level = sheet.level_id ? levels.find(l => l.id === sheet!.level_id) : null
    const date = new Date().toLocaleDateString(language)
    const fmtDate = (v: string) => (v ? new Date(`${v}T12:00:00`).toLocaleDateString(language) : '')
    const dates = cfg.start || cfg.end ? `${fmtDate(cfg.start) || '…'} – ${fmtDate(cfg.end) || '…'}` : ''
    const blob = await buildFieldSheetPdf({
      url: signed.signedUrl, pageNumber: sheet.page_number || 1, ptPerM: k, frame, items, paper: cfg.paper,
      zone: { name: taskLocation.name, pts: taskZone && taskZone.source_id === sheet.id ? taskZone.points as Vec2[] : [] },
      backgroundFade: fadeOf(sheet), rows,
      qrUrl: taskLocation.qr_token ? `${window.location.origin}/field/scan/${taskLocation.qr_token}` : null,
      show: { table: cfg.show.table, detail: cfg.show.detail, qr: cfg.show.qr },
      info: { responsible: cfg.responsible, crew: cfg.crew, dates, notes: cfg.notes },
      materials: (cfg.show.materials || cfg.show.materialSummary) && matGroups.length ? {
        groups: cfg.show.materials ? matGroups.map(g => ({ color: colorOfScope(g.sc.id), title: `${g.sc.scope_code || ''} ${g.sc.scope_name}`.trim(), rows: g.rows.map(r => ({ mat: r.mat, ...fmtMat(r) })) })) : [],
        summary: cfg.show.materialSummary ? matSummary.map(r => ({ mat: r.mat, ...fmtMat(r) })) : null,
      } : null,
      logoUrl: '/ritsu-logo.png',
      fmt: v => formatNumber(v, 2),
      text: {
        kicker: t('field.kicker'),
        location: cfg.title.trim() || taskLocation.name,
        path: [cfg.title.trim() ? taskLocation.name : null, project?.name, level?.name, sheet.name].filter(Boolean).join(' · '),
        scope: kind === 'location' ? t('field.scopeAll') : t('field.scopeOne', { code: taskScope?.scope_code || '' }),
        revision: revision == null ? t('field.previewShort') : `REV ${revision}`,
        issued: revision == null ? t('field.previewNote', { date }) : t('field.issuedLine', { date, name: issuedBy || '—' }),
        responsible: t('report.responsible'),
        crew: t('report.crew'),
        dates: t('report.dates'),
        notes: t('report.notes'),
        activities: t('field.activities'),
        qrCaption: t('field.qrCaption'),
        scale: t(cfg.areaMode === 'location' ? 'field.scaleMargin' : 'field.scaleArea', { margin: formatNumber(cfg.marginM, 2) }),
        footer: `${project?.name || ''}${project?.project_code ? ` · ${project.project_code}` : ''} · RitsuFlow`,
        draft: revision == null ? t('field.watermark') : undefined,
        materialsTitle: t('mat.title', { location: taskLocation.name }),
        materialsSummary: t('mat.summary'),
        colMaterial: t('mat.colMaterial'),
        colTake: t('mat.colTake'),
        colExact: t('mat.colExact'),
        materialsNote: t('mat.note'),
      },
    })
    const snapshot = {
      location: { id: taskLocation.id, name: taskLocation.name },
      sheet: { id: sheet.id, name: sheet.name },
      config: cfg,
      lines: lines.map(r => ({ id: r.id, tag: r.tag || null, scope_item_id: r.scope_item_id, source_id: r.source_id, points: r.points, side: r.side ?? null, height_m: r.height_m, quantity: Number(r.quantity || 0), unit: r.unit })),
      totals: scopes.map(sc => ({ scope_item_id: sc.id, code: sc.scope_code, name: sc.scope_name, unit: sc.unit, quantity: lines.filter(r => r.scope_item_id === sc.id).reduce((a, r) => a + Number(r.quantity || 0), 0) })),
      materials: matGroups.map(g => ({ scope_item_id: g.sc.id, rows: g.rows.map(r => ({ key: r.key, mat: r.mat, exact: r.exact, unit: r.unit, whole: r.whole, whole_unit: r.wholeUnit, source: r.source })) })),
    }
    return { blob, snapshot, fp: fingerprint(lines), fileName: fileSafe(`${taskLocation.name}${kind === 'activity' ? ` - ${taskScope?.scope_code || ''}` : ''}`) }
  }
  /** Shows a PDF in the tab opened by the click (pop-up blockers allow it), or downloads it. */
  function showPdf(win: Window | null, blob: Blob, name: string) {
    if (win && !win.closed) { win.location.href = URL.createObjectURL(blob); return }
    saveBlob(blob, name)
  }
  function openReport(kind?: FieldKind) {
    setReportCfg(c => ({ ...c, kind: kind || c.kind, areaMode: c.areaMode === 'location' && !taskZone ? 'sheet' : c.areaMode }))
    setReportOpen(true)
  }
  async function previewFieldSheet(kind: FieldKind) {
    const win = window.open('', '_blank')
    win?.document.write(`<p style="font:14px system-ui;padding:24px;color:#294955">${t('print.preparing')}</p>`)
    setFieldBusy(`${kind}:preview`); setError('')
    try { const r = await makeFieldSheet(kind, null, '', reportCfg); showPdf(win, r.blob, `${r.fileName} - ${t('field.previewShort')}.pdf`) }
    catch (e) { win?.close(); setError(t('workspace.error', { message: (e as Error)?.message || String(e) })) }
    finally { setFieldBusy(null) }
  }
  async function issueFieldSheet(kind: FieldKind) {
    const st = fieldState(kind)
    if (!st.lines.length) { setError(t('field.nothing')); return }
    if (!window.confirm(t('field.confirmIssue', { rev: st.next, location: taskLocation?.name || '' }))) return
    const win = window.open('', '_blank')
    win?.document.write(`<p style="font:14px system-ui;padding:24px;color:#294955">${t('print.preparing')}</p>`)
    setFieldBusy(`${kind}:issue`); setError('')
    const supabase = createClient()
    let path: string | null = null
    try {
      const name = await actorName()
      const r = await makeFieldSheet(kind, st.next, name, reportCfg)
      path = `${projectId}/field-sheets/${taskLocationId}/${kind}-${kind === 'activity' ? taskScopeId : 'all'}-rev${st.next}-${Date.now()}.pdf`
      const up = await supabase.storage.from(BUCKET).upload(path, r.blob, { contentType: 'application/pdf', upsert: false })
      if (up.error) throw up.error
      const { error: ie } = await supabase.from('field_sheet_issues').insert({
        project_id: projectId, location_id: taskLocationId, kind, scope_item_id: kind === 'activity' ? taskScopeId : null,
        revision: st.next, snapshot: r.snapshot, fingerprint: r.fp, file_path: path, issued_by_name: name || null,
      })
      if (ie) throw ie
      path = null
      await loadTasks()
      showPdf(win, r.blob, `${r.fileName} - Rev ${st.next}.pdf`)
      setReportOpen(false)
      setStatus(t('field.issued', { rev: st.next }))
    } catch (e) {
      win?.close()
      if (path) await supabase.storage.from(BUCKET).remove([path])
      setError(t('workspace.error', { message: (e as Error)?.message || String(e) }))
    } finally { setFieldBusy(null) }
  }
  async function downloadIssue(issue: FieldIssueRow) {
    if (!issue.file_path) return
    const { data, error: e } = await createClient().storage.from(BUCKET).createSignedUrl(issue.file_path, 600, { download: `${fileSafe(taskLocation?.name || 'ficha')} - Rev ${issue.revision}.pdf` })
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    window.location.assign(data.signedUrl)
  }

  /** Planning style of an activity: changed live on screen, saved when the control is released. */
  function setStyleLocal(scopeId: string, patch: PlanStyle) {
    setTaskScopes(prev => prev.map(x => (x.id === scopeId ? { ...x, plan_style: { ...(x.plan_style || {}), ...patch } } : x)))
  }
  async function commitStyle(scopeId: string, patch: PlanStyle | null) {
    const sc = taskScopes.find(x => x.id === scopeId)
    const next: PlanStyle = patch ? { ...(sc?.plan_style || {}), ...patch } : {}
    setTaskScopes(prev => prev.map(x => (x.id === scopeId ? { ...x, plan_style: next } : x)))
    const { error: e } = await createClient().from('project_scopes').update({ plan_style: next }).eq('id', scopeId)
    if (e) setError(t('workspace.error', { message: e.message }))
  }
  async function deleteTaskLine(id: string) {
    if (!window.confirm(t('task.confirmDelete'))) return
    const { error: e } = await createClient().from('location_task_drawings').delete().eq('id', id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await loadTasks()
    setStatus(t('task.deleted'))
  }
  const levelShownModel = isIfcModel ? modelData.items : withoutHiddenStoreys(modelData.items, modelData.storeys, hiddenBranches, levels)
  const shownModelItems = hiddenLayerIds.size ? levelShownModel.filter(it => !hiddenLayerIds.has(it.key)) : levelShownModel
  /** Items of the same library type at the same level/height (duplicates that should be one item), by key. */
  const sameTypeKey = (l: LayerRow) => (l.wall_type_id ? `${l.wall_type_id}|${l.kind}|${l.kind === 'area' ? Number(l.elevation_m) || 0 : l.kind === 'linear' ? Number(l.height_m) || 0 : ''}` : null)
  /** Merges duplicate items (same type, same level): their drawings move to the first one, the others are removed. */
  async function mergeDuplicates(ids: string[]) {
    const groups = new Map<string, LayerRow[]>()
    for (const l of layers.filter(x => ids.includes(x.id))) {
      const k = sameTypeKey(l)
      if (k) groups.set(k, [...(groups.get(k) || []), l])
    }
    const dupes = [...groups.values()].filter(g => g.length > 1)
    if (!dupes.length) return
    if (!window.confirm(t('group.mergeConfirm', { names: dupes.map(g => `${g[0].name} ×${g.length}`).join(', ') }))) return
    const supabase = createClient()
    for (const g of dupes) {
      const [keep, ...rest] = [...g].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      const restIds = rest.map(x => x.id)
      const { error: e } = await supabase.from('takeoff_elements').update({ layer_id: keep.id }).in('layer_id', restIds)
      if (e) { setError(t('workspace.error', { message: e.message })); return }
      const { error: e2 } = await supabase.from('takeoff_layers').delete().in('id', restIds)
      if (e2) { setError(t('workspace.error', { message: e2.message })); return }
    }
    await load()
    setStatus(t('group.merged'))
  }

  /** Shows or hides several items at once (a whole list group). */
  async function setLayersVisible(ids: string[], visible: boolean) {
    if (!ids.length) return
    const before = new Map(layers.filter(l => ids.includes(l.id)).map(l => [l.id, l.is_visible]))
    setLayers(prev => prev.map(l => (ids.includes(l.id) ? { ...l, is_visible: visible } : l)))
    const { error: e } = await createClient().from('takeoff_layers').update({ is_visible: visible }).in('id', ids)
    if (e) {
      setLayers(prev => prev.map(l => (before.has(l.id) ? { ...l, is_visible: before.get(l.id) ?? true } : l)))
      setError(t('workspace.error', { message: e.message }))
    }
  }

  async function toggleLayerVisible(id: string) {
    const layer = layers.find(l => l.id === id)
    if (!layer) return
    const next = layer.is_visible === false
    setLayers(prev => prev.map(l => (l.id === id ? { ...l, is_visible: next } : l)))
    const { error: e } = await createClient().from('takeoff_layers').update({ is_visible: next }).eq('id', id)
    if (e) {
      setLayers(prev => prev.map(l => (l.id === id ? { ...l, is_visible: !next } : l)))
      setError(t('workspace.error', { message: e.message }))
    }
  }

  /** 3D task view of the open sheet: estimate walls (see-through), task bands with tags, plan and locations underneath. */
  const tasks3d = (() => {
    const empty = { items: [] as TakeoffItem[], underlays: [] as UnderlaySpec[], zones: [] as UnderlayZone[] }
    if (section !== 'tasks' || viewMode !== '3d' || !selectedSource || !(ptPerM > 0)) return empty
    const k = ptPerM
    const rowsHere = taskRows.filter(r => r.source_id === selectedSource.id)
    // Activities sharing a face stack outwards (in scope order), so each band shows.
    const scopesHere = taskScopes.filter(sc => rowsHere.some(r => r.scope_item_id === sc.id))
    const layerOf = new Map<string, number>()
    const placed: { r: TaskDrawingRow; scope: string }[] = []
    for (const sc of scopesHere) {
      for (const r of rowsHere.filter(x => x.scope_item_id === sc.id)) {
        const under = new Set(placed.filter(p => p.scope !== sc.id && sameFace(p.r, r, k)).map(p => layerOf.get(p.r.id) || 0))
        let n = 0
        while (under.has(n)) n++
        layerOf.set(r.id, n)
        placed.push({ r, scope: sc.id })
      }
    }
    const planItems: TakeoffItem[] = scopesHere.map(sc => {
      const st = planStyleOf(sc.plan_style)
      const T = st.thickness_m
      return {
        key: `__plan3d_${sc.id}`, kind: 'linear' as const, name: sc.scope_name, system: '', color: colorOfScope(sc.id), thickness: T, height: 2.8,
        shapes: rowsHere.filter(r => r.scope_item_id === sc.id).map(r => {
          const pts = bandCentre(r.points, r.side, (2 * (layerOf.get(r.id) || 0) + 1) * T, k)
          return { id: `plan:${r.id}`, page: 1, pts, h: Number(r.height_m) > 0 ? Number(r.height_m) : 0.3, tags: tagsOnLongest(pts, r.tag || sc.scope_code || '') }
        }),
      }
    })
    const estimate = taskWalls ? shownItems.map(it => ({ ...it, transparency: Math.max(0.65, it.transparency || 0), shapes: it.shapes.map(sh => ({ ...sh, tags: undefined, openingTags: undefined })) })) : []
    const zonesHere = taskZonesOn ? locationZonesOf(selectedSource.id) : []
    // The sheet underneath: its framed region, or the box around what is drawn (+ 2 m).
    let region = selectedSource.kind === 'pdf_page' ? underlayRegionOf(selectedSource) : null
    if (!region && selectedSource.kind === 'pdf_page') {
      const all: Vec2[] = [...rowsHere.flatMap(r => r.points), ...zonesHere.flatMap(z => z.points as Vec2[]), ...shownItems.flatMap(it => it.shapes.flatMap(sh => sh.pts))]
      if (all.length) {
        const m = 2 * k
        region = [[Math.min(...all.map(p => p[0])) - m, Math.min(...all.map(p => p[1])) - m], [Math.max(...all.map(p => p[0])) + m, Math.max(...all.map(p => p[1])) + m]]
      }
    }
    return {
      items: [...estimate, ...planItems],
      underlays: region && selectedSource.kind === 'pdf_page' ? [{ page: 1, filePath: selectedSource.file_path, pageNumber: selectedSource.page_number || 1, region, toModel: (p: Vec2) => p }] : [],
      zones: zonesHere.map(z => ({ page: 1, pts: z.points as Vec2[], color: z.color, name: z.name })),
    }
  })()

  const viewer = !selectedSource ? (
    <div style={{ ...ui.viewer, height: '100%' }}>{t('workspace.viewer.select')}</div>
  ) : viewMode === '3d' && ptPerM > 0 ? (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {canShowModel && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          {(['model', 'source'] as const).map(sc => (
            <button key={sc} type="button" onClick={() => setScope3d(sc)} style={tabBtn(scope3d === sc)}>
              {t(sc === 'model' ? 'view3d.scopeModel' : 'view3d.scopeSource')}
            </button>
          ))}
          <span style={ui.small}>
            {scope3d === 'model' ? t('view3d.scopeModelHint', { count: modelData.storeys.length }) : selectedSource.name}
            {scope3d === 'model' && pdfBuilding && pdfBuilding.missing.length > 0 ? ` · ${t('origin.missingSheets', { count: pdfBuilding.missing.length })}` : ''}
            {scope3d === 'model' && pdfBuilding && pdfBuilding.noOrigin.length > 0 ? ` · ${t('origin.noOriginSheets', { count: pdfBuilding.noOrigin.length })}` : ''}
          </span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        {section === 'tasks' ? (
          // Task view in 3D: the task layers as coloured bands on the wall faces (stacked when several activities share a
          // face), each with its tag; the estimate walls see-through; the sheet and the locations' colours underneath.
          <View3D key={`tasks-${selectedSource.id}`} items={tasks3d.items} ptPerM={ptPerM} selectedId={null} onSelect={() => {}} initialTags
            underlays={tasks3d.underlays} underlayZones={tasks3d.zones} />
        ) : canShowModel && scope3d === 'model' ? (
          <View3D key={isIfcModel ? 'model' : 'building'} items={shownModelItems} ptPerM={1} storeys={modelData.storeys} selectedId={selectedElementId} onSelect={selectFromModel}
            underlays={isIfcModel ? undefined : underlay3d.model.underlays} underlayZones={isIfcModel ? undefined : underlay3d.model.zones}
            preferPage={modelData.storeys.find(st => st.sourceId === selectedSourceId)?.page} />
        ) : (
          <View3D key={selectedSource.id} items={shownItems} ptPerM={ptPerM} selectedId={selectedElementId} onSelect={setSelectedElementId}
            underlays={underlay3d.sheet.underlays} underlayZones={underlay3d.sheet.zones} />
        )}
      </div>
    </div>
  ) : selectedSource.kind === 'ifc_storey' && sheet?.sheet_width_pt && sheet?.sheet_height_pt ? (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <PlanView
        width={sheet.sheet_width_pt}
        height={sheet.sheet_height_pt}
        ptPerM={ptPerM}
        items={shownItems}
        gridLabel={`${selectedSource.name} · ${t('workspace.viewer.grid')}`}
        selectedId={selectedElementId}
        onSelect={setSelectedElementId}
      />
    </div>
  ) : isPdf ? (
    <PdfWorkspace
      toolbarSlot={toolbarShown ? toolbarSlot : null}
      footerSlot={toolbarShown ? footerSlot : null}
      statusSlot={toolbarShown ? statusSlot : null}
      backgroundFade={backgroundFade}
      quickActions={section === 'zoning' || section === 'tasks' ? [] : [
        { key: 'wall', icon: 'wall', label: t('quick.wall'), title: t('quick.wallHint'), onClick: () => setPickerOpen(true) },
        { key: 'ceiling', icon: 'ceiling', label: t('quick.ceiling'), title: t('quick.ceilingHint'), onClick: () => setSurfacePicker('ceiling') },
        { key: 'floor', icon: 'floor', label: t('quick.floor'), title: t('quick.floorHint'), onClick: () => setSurfacePicker('floor') },
        { key: 'item', icon: 'edit', label: t('quick.item'), title: t('quick.itemHint'), onClick: () => setNewLayerRequest(n => n + 1) },
      ]}
      exportActions={section === 'zoning' || section === 'tasks' ? [] : [
        { key: 'csv', icon: 'download', label: 'CSV', title: t('csv.hint'), onClick: exportCsv, disabled: !(ptPerM > 0 && sourceItems.length > 0) },
      ]}
      projectId={projectId}
      source={selectedSource}
      layers={layers}
      items={section === 'tasks' ? taskShownItems : shownItems}
      onChanged={section === 'tasks' ? loadTasks : load}
      selectedId={selectedElementId}
      onSelect={setSelectedElementId}
      framingDefaults={framingDefaults}
      activeLayerId={activeLayerId}
      onActiveLayerChange={setActiveLayerId}
      drawRequest={drawRequest}
      newLayerRequest={newLayerRequest}
      workMode={section === 'zoning' ? 'zoning' : section === 'tasks' ? 'tasks' : 'takeoff'}
      task={section === 'tasks' ? {
        color: taskScopeId ? colorOfScope(taskScopeId) : TASK_COLOR,
        zone: taskZone && taskZone.source_id === selectedSource.id ? { id: taskZone.id, name: taskLocation?.name || taskZone.name, pts: taskZone.points as Vec2[] } : null,
        frame: taskZone && taskZone.source_id === selectedSource.id ? frameOf(taskZone.points as Vec2[], Number(selectedSource.scale_pt_per_m) || 0, 1) : null,
        frameTick: taskFrameTick,
        bandM: styleOfScope(taskScopeId).thickness_m,
        areaPick: areaPicking,
        onAreaPicked: box => {
          setAreaPicking(false)
          if (box && selectedSource) setReportCfg(c => ({ ...c, areaMode: 'custom', area: { sourceId: selectedSource.id, box } }))
          setReportOpen(true)
        },
        area: reportOpen && reportCfg.areaMode === 'custom' && reportCfg.area?.sourceId === selectedSource.id ? reportCfg.area.box : null,
        onMoveTag: (shapeId, at) => void moveTaskLabel(shapeId, at),
        estimateOn: taskWalls,
        onToggleEstimate: () => setTaskWalls(v => !v),
        onInspect: setInspectLineId,
        zones: taskZonesOn ? locationZonesOf(selectedSource.id).map(z => ({ id: z.id, name: z.name, color: z.color, pts: z.points as Vec2[] })) : [],
        zonesOn: taskZonesOn,
        onToggleZones: () => setTaskZonesOn(v => !v),
      } : null}
      onTaskLine={saveTaskLine}
      onTaskPick={pickTaskWall}
      zones={zones}
      zoneKind={drawKind}
      selectedZoneId={selectedZoneId}
      onSelectZone={setSelectedZoneId}
      newZoneRequest={newZoneRequest}
      detectRoomsRequest={detectRoomsRequest}
      command={command}
      onZoomChange={setZoom}
      onCursor={p => cursorSink.current?.(p)}
      openingPick={openingPick}
      onOpeningPicked={async message => { setOpeningPick(null); await load(); setStatus(message) }}
      onOpeningPickCancel={() => setOpeningPick(null)}
      levelLabel={(() => { const lv = selectedSource.level_id ? levels.find(l => l.id === selectedSource.level_id) : null; return lv ? t('level.fromLevel', { name: lv.name, elev: `${lv.elevation_m >= 0 ? '+' : ''}${formatNumber(lv.elevation_m, 2)}` }) : null })()}
    />
  ) : (
    <div style={{ ...ui.viewer, height: '100%' }}>{t('workspace.viewer.pending')}</div>
  )

  /** Gives the selected wall's item (all its walls) or just this wall a library wall type. */
  async function assignWallType(row: ReturnType<typeof layerFromWallType>, scope: 'item' | 'element') {
    if (!assignFor) return
    const supabase = createClient()
    if (scope === 'item') {
      // Keep the item's own name, colour and order; take the build-up from the type.
      const { error: e } = await supabase.from('takeoff_layers').update({
        thickness_m: row.thickness_m, framing: row.framing, recipe_id: row.recipe_id, wall_type_id: row.wall_type_id, system: row.system,
        ...(row.height_m ? { height_m: row.height_m } : {}),
      }).eq('id', assignFor.layerId)
      if (e) throw e
    } else {
      const { data, error: e } = await supabase.from('takeoff_layers').insert(row).select('id').single()
      if (e || !data) throw e || new Error('insert failed')
      const { error: e2 } = await supabase.from('takeoff_elements').update({ layer_id: data.id }).eq('id', assignFor.elementId)
      if (e2) throw e2
    }
    setAssignFor(null)
    await load()
    setStatus(t(scope === 'item' ? 'walltype.assignedItem' : 'walltype.assignedElement'))
  }

  /** Gives the selected area's item (all its areas) or just this area a library ceiling / floor type. */
  async function assignSurfaceType(pick: SurfaceTypeRow, scope: 'item' | 'element') {
    if (!surfaceAssign) return
    const layer = layers.find(l => l.id === surfaceAssign.layerId)
    if (!layer) return
    const fam = FAMILIES[surfaceAssign.family]
    const row = fam.layerFrom(pick, { projectId, color: layer.color, sortOrder: (layers.length + 1) * 10, elevationM: Number(layer.elevation_m) || 0 }) as Record<string, unknown> & { framing: { meta: Record<string, unknown> } }
    const supabase = createClient()
    if (scope === 'item') {
      // The item becomes that type (name, colour, build-up, recipe); it keeps its level and display settings.
      const current = (layer.framing || {}) as Record<string, unknown> & { meta?: Record<string, unknown> }
      const meta = { ...(current.meta || {}) }
      delete meta.ceiling
      delete meta.floor
      const { error: e } = await supabase.from('takeoff_layers').update({
        name: row.name, color: row.color, thickness_m: row.thickness_m, recipe_id: row.recipe_id, wall_type_id: row.wall_type_id,
        framing: { ...current, meta: { ...meta, ...row.framing.meta } },
      }).eq('id', layer.id)
      if (e) throw e
    } else {
      // Join an item of the same type at the same level when there is one; otherwise a new item.
      const same = layers.find(l => l.id !== layer.id && l.kind === 'area' && l.wall_type_id === pick.id && Math.abs((Number(l.elevation_m) || 0) - (Number(layer.elevation_m) || 0)) < 0.001)
      let targetId = same?.id
      if (!targetId) {
        const { data, error: e } = await supabase.from('takeoff_layers').insert(row).select('id').single()
        if (e || !data) throw e || new Error('insert failed')
        targetId = data.id as string
      }
      const { error: e2 } = await supabase.from('takeoff_elements').update({ layer_id: targetId }).eq('id', surfaceAssign.elementId)
      if (e2) throw e2
      // The old item had only this area: it's now empty, so it goes.
      const { count } = await supabase.from('takeoff_elements').select('id', { count: 'exact', head: true }).eq('layer_id', layer.id)
      if (count === 0) await supabase.from('takeoff_layers').delete().eq('id', layer.id)
    }
    setSurfaceAssign(null)
    await load()
    setStatus(t(scope === 'item' ? 'surface.assignedItem' : 'surface.assignedElement'))
  }

  /** Saves the selected wall's item as a new (draft) type in the library and links the item to it. */
  async function saveItemToLibrary(layer: LayerRow) {
    setAssigning(true)
    setError('')
    const f = layer.framing || {}
    const boards = [
      f.boardA ? { side: 'A', product: String(f.boardA), thickness_m: null, count: Number(f.layersA) || 1 } : null,
      f.boardB ? { side: 'B', product: String(f.boardB), thickness_m: null, count: Number(f.layersB) || 1 } : null,
    ].filter(Boolean)
    const supabase = createClient()
    const { data, error: e } = await supabase.from('takeoff_wall_types').insert({
      name: layer.name, country_code: country || 'BR', category: 'non_rated', status: 'draft',
      thickness_m: layer.thickness_m, framing: layer.framing || {}, boards, recipe_id: layer.recipe_id ?? null, rated_design: layer.system || null,
    }).select('id').single()
    if (e || !data) { setAssigning(false); setError(t('workspace.error', { message: e?.message || '' })); return }
    const { error: e2 } = await supabase.from('takeoff_layers').update({ wall_type_id: data.id }).eq('id', layer.id)
    setAssigning(false)
    if (e2) { setError(t('workspace.error', { message: e2.message })); return }
    await load()
    setStatus(t('walltype.savedToLibrary', { name: layer.name }))
  }

  const selectedLayerRow = selection ? layers.find(l => l.id === selection.item.key) || null : null
  const selectedWallType = selectedLayerRow?.wall_type_id ? wallTypes.find(w => w.id === selectedLayerRow.wall_type_id) || null : null

  const editingLevel = levels.find(l => l.id === editingLevelId) || null
  const checkedLevels = levels.filter(l => checkedLevelIds.has(l.id))
  function checkLevels(ids: string[], checked: boolean) {
    setCheckedLevelIds(prev => {
      const next = new Set(prev)
      for (const id of ids) { if (checked) next.add(id); else next.delete(id) }
      return next
    })
    if (checked) {
      setEditingLayerId(null)
      setOpeningEditor(null)
      setSelectedElementId(null)
      setEditingLevelId(null)
      setRightTab('props')
      setRightOpen(true)
    }
  }
  function editLevel(id: string) {
    setCheckedLevelIds(new Set())
    setEditingLayerId(null)
    setOpeningEditor(null)
    setSelectedElementId(null)
    setEditingLevelId(id)
    setRightTab('props')
    setRightOpen(true)
  }
  function openCopyForLevel(levelId: string) {
    const sheet = selectedSource?.level_id === levelId ? selectedSource : sources.find(s => s.level_id === levelId && s.kind === 'pdf_page')
    if (sheet) setCopyFromId(sheet.id)
  }
  async function assignSheetLevel(sourceId: string, levelId: string | null) {
    const { error: e } = await createClient().from('takeoff_sources').update({ level_id: levelId }).eq('id', sourceId)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await load()
    setStatus(levelId ? t('level.assigned', { name: levels.find(l => l.id === levelId)?.name || '' }) : t('level.unassignedDone'))
  }
  async function addLevel() {
    const name = window.prompt(t('level.addPrompt'))
    if (!name || !name.trim()) return
    const top = [...levels].sort((a, b) => b.elevation_m - a.elevation_m)[0]
    const elevation = top ? Math.round((top.elevation_m + (top.height_m || 3)) * 1000) / 1000 : 0
    const { data, error: e } = await createClient().from('takeoff_levels')
      .insert({ project_id: projectId, name: name.trim(), elevation_m: elevation, height_m: top?.height_m ?? null, slab_m: top?.slab_m ?? null, sort_order: (levels.length + 1) * 10 })
      .select('id').single()
    if (e || !data) { setError(/duplicate|unique/i.test(e?.message || '') ? t('level.duplicate') : t('workspace.error', { message: e?.message || '' })); return }
    await load()
    editLevel(data.id)
  }

  const properties = checkedLevels.length ? (
    <LevelsBulkEdit
      levels={checkedLevels}
      sources={sources}
      onChanged={async message => { await load(); if (message) setStatus(message) }}
      onClose={() => setCheckedLevelIds(new Set())}
    />
  ) : editingLevel ? (
    <LevelProperties
      key={editingLevel.id}
      level={editingLevel}
      levels={levels}
      sources={sources}
      onChanged={async message => { await load(); setStatus(message) }}
      onClose={() => setEditingLevelId(null)}
      onCopy={() => openCopyForLevel(editingLevel.id)}
    />
  ) : openingEditor ? (
    <OpeningsEditor
      key={openingEditor}
      kind={openingEditor}
      items={sourceItems}
      ptPerM={ptPerM}
      onSaved={async message => { await load(); setStatus(message) }}
      onSelectWall={id => { setOpeningEditor(null); setSelectedElementId(id) }}
      onClose={() => setOpeningEditor(null)}
    />
  ) : editingLayer ? (
    <LayerEditor layer={editingLayer} recipes={recipes} onSaved={async () => { await load(); setStatus(t('layer.saved')) }} onClose={() => setEditingLayerId(null)} />
  ) : selection && selection.item.kind === 'linear' && selectedElementRow && ptPerM > 0 ? (
    <>
      {selectedLayerRow && (
        <WallTypeCard
          itemName={selection.item.name}
          wallCount={elements.filter(el => el.layer_id === selectedLayerRow.id).length}
          wallType={selectedWallType}
          missing={!!selectedLayerRow.wall_type_id && !selectedWallType}
          busy={assigning}
          onChoose={() => setAssignFor({ layerId: selectedLayerRow.id, elementId: selectedElementRow.id })}
          onSaveToLibrary={() => void saveItemToLibrary(selectedLayerRow)}
          onOpenLibrary={() => { setSection('settings'); setSettingsTab('walltypes') }}
        />
      )}
      <ElementPanel
        key={`el-${selectedElementRow.id}`}
        onPickOnPlan={isPdf ? o => setOpeningPick({ elementId: selectedElementRow.id, opening: o }) : undefined}
        picking={openingPick?.elementId === selectedElementRow.id}
        element={selectedElementRow}
        item={selection.item}
        shape={selection.shape}
        ptPerM={ptPerM}
        onSaved={async message => { await load(); setStatus(message) }}
      />
      <SplitPanel
        key={selectedElementRow.id}
        element={selectedElementRow}
        ptPerM={ptPerM}
        onDone={async (newId, message) => { await load(); setSelectedElementId(newId); setStatus(message) }}
      />
      {selection.item.framing?.on ? (
        <>
          <ElevationView item={selection.item} shape={selection.shape} ptPerM={ptPerM} allItems={sourceItems} />
          <ChecksPanel key={selection.shape.id} item={selection.item} shape={selection.shape} />
        </>
      ) : (
        <div style={ui.small}>{t('elevation.hint')}</div>
      )}
    </>
  ) : selection && selectedElementRow ? (
    // Areas and counted points: their tag.
    <div style={{ ...ui.panel, gap: 12 }}>
      <h2 style={ui.panelTitle}>{selection.item.name}</h2>
      {selection.item.kind === 'area' && selectedLayerRow && !selection.item.struct && selection.item.ifcType !== 'IfcSlab' && (() => {
        // Library ceiling / floor type of this area's item: shown, or a nudge to pick one when it has none.
        const typed = selectedLayerRow.wall_type_id ? wallTypes.find(w => w.id === selectedLayerRow.wall_type_id) || null : null
        const fams: FamilyId[] = typed
          ? [(typed.category as string) === 'floor' ? 'floor' : 'ceiling']
          : selection.item.ifcType === 'IfcCovering.CEILING' ? ['ceiling'] : selection.item.ifcType === 'IfcCovering.FLOORING' ? ['floor'] : ['ceiling', 'floor']
        const count = elements.filter(el => el.layer_id === selectedLayerRow.id).length
        const open = (family: FamilyId) => setSurfaceAssign({ family, layerId: selectedLayerRow.id, elementId: selectedElementRow.id })
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 8, border: `1px solid ${typed ? '#dfe7ea' : '#f3d19c'}`, background: typed ? '#fff' : '#fffaf0' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <strong style={{ fontSize: 12, color: '#173441', flex: 1 }}>{t('surface.cardTitle')}</strong>
              <span style={ui.small}>{t('surface.cardItem', { name: selection.item.name, count })}</span>
            </div>
            {typed
              ? <strong style={{ fontSize: 12, color: '#294955' }}>{typed.code ? `${typed.code} – ${typed.name}` : typed.name}</strong>
              : <span style={{ fontSize: 11, color: '#8a5a12' }}>{t(selectedLayerRow.wall_type_id ? 'surface.cardMissing' : 'surface.cardNone')}</span>}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {fams.map(f => (
                <button key={f} type="button" style={{ ...ui.button, height: 30, fontSize: 11 }} onClick={() => open(f)}>
                  {typed ? t('surface.cardChange') : t(FAMILIES[f].msg.pickTitle)}
                </button>
              ))}
            </div>
          </div>
        )
      })()}
      <TagsEditor key={`tag-${selectedElementRow.id}`} element={selectedElementRow} kind={selection.item.kind} ptPerM={ptPerM} onSaved={async message => { await load(); setStatus(message) }} />
      {(selection.item.ceiling || selection.item.floor) && ptPerM > 0 && (() => {
        // This ceiling's or floor's own materials, from its type's build-up.
        const fam = selection.item.ceiling ? CEILING_FAMILY : FLOOR_FAMILY
        return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <strong style={{ fontSize: 12, color: '#173441' }}>{t(fam.msg.thisMaterials)}</strong>
          {fam.materials([{ ...selection.item, shapes: [selection.shape] }], ptPerM, surfaceLabels).map(m => (
            <div key={`${m.mat}|${m.unit}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: '#294955', padding: '3px 0', borderBottom: '1px solid #f0f4f5' }}>
              <span>{m.mat}</span><strong>{formatNumber(m.qty, Number.isInteger(m.qty) ? 0 : 2)} {m.unit}</strong>
            </div>
          ))}
          <span style={ui.small}>{t(fam.msg.materialsNote)}</span>
        </div>
        )
      })()}
    </div>
  ) : (
    <div style={{ ...ui.small, padding: 8 }}>{t('layout.propsEmpty')}</div>
  )

  const country = projectCountry(project)
  const sheetZones = selectedSource ? zones.filter(z => z.source_id === selectedSource.id) : []
  const selectedZone = zones.find(z => z.id === selectedZoneId && z.source_id === selectedSource?.id) || null
  const canvasMode = section === 'zoning' || section === 'takeoff' || section === 'tasks'
  const ratio = scaleRatio(ptPerM)
  const sheetOrigin: SheetOrigin | null = selectedSource ? originOf(selectedSource) : null

  /** What the 3D view would show now: the aligned building when available, else this sheet. */
  function makeSnapshot(): ShareSnapshot | null {
    if (!selectedSource || !(ptPerM > 0)) return null
    const strip = (items: typeof sourceItems) => items.filter(it => it.shapes.length > 0).map(it => ({ ...it, recipeId: null }))
    if (canShowModel) {
      const names = modelData.storeys.map(st => st.name)
      return { version: 1, ptPerM: 1, items: strip(modelData.items), storeys: modelData.storeys.map(({ page, name, elevation }) => ({ page, name, elevation })), sheets: names }
    }
    return { version: 1, ptPerM, items: strip(sourceItems), sheets: [selectedSource.name] }
  }

  /**
   * Builds the sheet PDF with either the locations (zones) or the takeoff items drawn on it,
   * each with its own legend, and opens it (print from the viewer) or downloads it.
   */
  /** Which items go into each printable file (walls carry their doors and windows). */
  // Plain computation (not a hook): this part of the component runs after an early return.
  /** Floor, ceiling or slab: tagged by its tool, or by its name ("Laje") when made by hand. */
  const areaOf = (it: (typeof sourceItems)[number], role: AreaRole) => areaRole(it) === role
  type PrintWhat = 'locations' | 'walls' | 'floor' | 'ceiling' | 'slab' | 'mep' | 'struct' | 'takeoff'
  const printFilter: Record<Exclude<PrintWhat, 'locations'>, (it: (typeof sourceItems)[number]) => boolean> = {
    walls: it => it.kind === 'linear' && !it.struct,
    mep: it => !!it.mep,
    struct: it => !!it.struct,
    floor: it => areaOf(it, 'floor'),
    ceiling: it => areaOf(it, 'ceiling'),
    slab: it => areaOf(it, 'slab'),
    takeoff: () => true,
  }
  /** Every PDF sheet of the project, ground floor up (sheets without a level last), with its items. */
  const printSheets = levelBranches(levels, sources.filter(s => s.kind === 'pdf_page'))
    .sort((x, y) => (x.id === NO_LEVEL ? 1 : 0) - (y.id === NO_LEVEL ? 1 : 0) || (x.master?.elevation_m ?? 0) - (y.master?.elevation_m ?? 0))
    .flatMap(b => {
      const h = wallHeightOf(b.master)
      const group = b.master ? levelGroups(levels).find(g => g.master.id === b.master!.id) : null
      return b.sheets.map(s => {
        const raw = rowsToItems(layers, elements, new Map([[s.id, 1]])).filter(it => it.shapes.length > 0)
        return { source: s, branch: b, levelName: group ? groupLabel(group) : t('level.unassigned'), items: h ? fillLevelHeights(raw, () => h) : raw, zones: zones.filter(z => z.source_id === s.id && z.is_visible) }
      })
    })
  const printEmpty = (what: PrintWhat) => what === 'locations'
    ? !printSheets.some(ps => ps.zones.length > 0)
    : !printSheets.some(ps => ps.items.some(printFilter[what]))
  const printKindKey: Record<PrintWhat, TakeoffMessageKey> = {
    locations: 'print.kindLocations', walls: 'print.kindWalls', floor: 'print.kindFloor', ceiling: 'print.kindCeiling', slab: 'print.kindSlab', mep: 'print.kindMep', struct: 'print.kindStruct', takeoff: 'print.kindTakeoff',
  }

  /** The whole project in one PDF: every sheet with that kind of item, a 3D page, tables per level and totals. */
  async function printSheet(what: PrintWhat) {
    if (printing || printEmpty(what)) return
    // Open the tab now (inside the click) so pop-up blockers allow it; fill it when the PDF is ready.
    const win = window.open('', '_blank')
    win?.document.write(`<p style="font:14px system-ui;padding:24px;color:#294955">${t('print.preparing')}</p>`)
    setPrinting(true)
    setError('')
    try {
      // The report is in the language (and number format) the user is working in.
      const printLang: AppLanguage = language
      const pt = takeoffTranslator(printLang)
      const pfmt = (v: number, d = 2) => formatNumber(v, d)
      const pSurface = surfaceLabelsFrom(pt)
      const date = new Date().toLocaleString(printLang, { dateStyle: 'short', timeStyle: 'short' })
      const projectTitle = `${project!.name}${project!.project_code ? ` (${project!.project_code})` : ''}`
      const kind = pt(printKindKey[what])
      const chosen = printSheets
        .map(ps => ({ ...ps, items: what === 'locations' ? [] : ps.items.filter(printFilter[what]), zones: what === 'locations' ? ps.zones : [] }))
        .filter(ps => ps.items.length > 0 || ps.zones.length > 0)
      const urlOf = new Map<string, string>()
      for (const path of new Set(chosen.map(ps => ps.source.file_path))) {
        const { data, error: e } = await createClient().storage.from(BUCKET).createSignedUrl(path, 600)
        if (e || !data) throw e || new Error('no URL')
        urlOf.set(path, data.signedUrl)
      }
      const sheetsOut: PrintSheet[] = chosen.map(ps => {
        const k = Number(ps.source.scale_pt_per_m) || 0
        const r = scaleRatio(k)
        const scale = r ? `1:${pfmt(Math.round(r), 0)}` : pt('workspace.source.notCalibrated')
        const mult = ps.branch.count
        // One group per item (its type): framing layout, recipe and ceiling / floor build-up.
        const typeGroups = k > 0 ? ps.items.map(it => {
          const surf = surfaceMaterials([it], k, pSurface)
          return {
            key: it.key,
            group: {
              name: it.name,
              color: hexToRgb(it.color),
              rows: materialRows([it], k, {
                recipe: recipeMaterials([it], k, recipeOfItem, projectRecipeCtx),
                ceiling: surf.find(x => x.family.id === 'ceiling')?.materials || [],
                floor: surf.find(x => x.family.id === 'floor')?.materials || [],
              }, { bars: pt('csv.bars'), sheets: pt('csv.sheets'), un: pt('unit.un') }, v => pfmt(v, 2), (len, unit) => pt('print.stockBars', { len: pfmt(len, 2), unit })),
            },
          }
        }).filter(x => x.group.rows.length) : []
        // The same materials by location: the sheet's most detailed locations (rooms before areas, zones, blocks),
        // each type's share inside it (walls on a shared edge split between the two rooms).
        const sheetZones = zones.filter(z => z.source_id === ps.source.id && z.is_visible && z.points.length >= 3)
        const zKind = ['room', 'area', 'zone', 'block'].find(kd => sheetZones.some(z => (z.zone_kind || 'room') === kd))
        const locZones = sheetZones.filter(z => (z.zone_kind || 'room') === zKind).sort((x, y) => x.name.localeCompare(y.name, undefined, { numeric: true }))
        const share = locZones.length && typeGroups.length ? itemShareByZone(ps.items, locZones.map(z => ({ id: z.id, points: z.points })), k) : null
        const locationMaterials = share ? [
          ...locZones.map(z => ({ id: z.id, name: z.name, color: hexToRgb(z.color) })),
          { id: NONE, name: pt('print.noLocation'), color: [0.6, 0.65, 0.68] as [number, number, number] },
        ].map(l => ({
          name: l.name,
          color: l.color,
          groups: typeGroups.map(x => scaleGroup(x.group, share.get(x.key)?.get(l.id) || 0)).filter(g => g.rows.length),
        })).filter(l => l.groups.length) : []
        return {
          url: urlOf.get(ps.source.file_path)!,
          pageNumber: ps.source.page_number || 1,
          items: ps.items,
          zones: ps.zones,
          ptPerM: k,
          multiplier: mult,
          title: `${projectTitle} · ${ps.levelName} · ${ps.source.name} · ${kind}`,
          subtitle: pt('print.subtitle', { scale, date }),
          heading: `${ps.levelName} · ${ps.source.name}${mult > 1 ? ` · ${pt('print.perFloor')}` : ''}`,
          backgroundFade: fadeOf(ps.source),
          materialGroups: typeGroups.map(x => x.group),
          locationMaterials,
        }
      })
      // 3D page: the building with this PDF's items (everything for locations and the full takeoff).
      let image3d: Uint8Array | null = null
      const building = pdfBuildingItems(layers, elements, sources, levels)
      const byId = new Map<string, LevelRow>(levels.map(l => [l.id, l] as [string, LevelRow]))
      const hOfPage = new Map(building.storeys.map(st => [st.page, wallHeightOf(st.levelId ? byId.get(st.levelId) : null)]))
      const all3d = fillLevelHeights(building.items, page => hOfPage.get(page) ?? null).filter(it => it.shapes.length > 0)
      // Services are shown inside their walls, so the walls come along on that 3D page.
      const items3d = what === 'locations' || what === 'takeoff' ? all3d : all3d.filter(it => printFilter[what](it) || (what === 'mep' && it.kind === 'linear' && !it.struct))
      // Colour-coded (each item in its type colour, not the construction layers): the report is for aligning scope.
      // Plan underlay with the locations, under the lowest level that has a framed region (when chosen in the menu).
      let underlay: Awaited<ReturnType<typeof loadUnderlay>> = null
      let underlayZones: UnderlayZone[] = []
      if (printUnderlay && items3d.length) {
        const toModelOf = sheetToModelOf(sources)
        const elev = new Map(building.storeys.map(st => [st.page, st.elevation]))
        const specs = building.storeys.flatMap(st => {
          const src = sources.find(x => x.id === st.sourceId)
          const region = underlayRegionOf(src)
          const toModel = src ? toModelOf(src) : null
          return src && region && toModel ? [{ spec: { page: st.page, filePath: src.file_path, pageNumber: src.page_number || 1, region, toModel }, src }] : []
        })
          // Only a sheet whose drawings are on this 3D page (its own scale, so they sit on their drawing); lowest first.
          .filter(x => items3d.some(it => it.shapes.some(sh => sh.page === x.spec.page)))
          .sort((a, b) => (elev.get(a.spec.page) ?? 0) - (elev.get(b.spec.page) ?? 0))
        const first = specs[0]
        if (first) {
          underlay = await loadUnderlay(first.spec, 2600)
          const shown = zones.filter(z => z.source_id === first.src.id && z.is_visible && z.points.length >= 3)
          const kind = ['room', 'area', 'zone', 'block'].find(k => shown.some(z => (z.zone_kind || 'room') === k))
          underlayZones = shown.filter(z => (z.zone_kind || 'room') === kind).map(z => ({ page: first.spec.page, pts: z.points.map(first.spec.toModel), color: z.color, name: z.name }))
        }
      }
      if (items3d.length) image3d = await render3DImage({ items: items3d, ptPerM: 1, storeys: building.storeys, width: 2000, height: 1250, tags: true, layered: false, underlay, zones: underlayZones })
      // Legend of the 3D page: one swatch per item, in the list order.
      const legend3d = [...new Map(items3d.map(it => [it.name, { name: it.name, color: hexToRgb(it.color) }])).values()]
      const blob = await buildProjectPdf({
        sheets: sheetsOut,
        image3d,
        legend3d,
        title: `${projectTitle} · ${kind}`,
        subtitle: pt(sheetsOut.length === 1 ? 'print.projectSubtitleOne' : 'print.projectSubtitle', { sheets: sheetsOut.length, date }),
        fmt: v => pfmt(v, 2),
        logoUrl: '/ritsu-logo.png',
        labels: {
          title: `${projectTitle} · ${kind}`,
          subtitle: '',
          items: pt('print.items'),
          locations: pt('print.locations'),
          colItem: pt('print.colItem'),
          colKind: pt('print.colKind'),
          colQty: pt('print.colQty'),
          colExtra: pt('print.colExtra'),
          colArea: pt('zone.area'),
          colPerimeter: pt('zone.perimeter'),
          kind: { linear: pt('workspace.layer.linear'), area: pt('workspace.layer.area'), count: pt('workspace.layer.count') },
          unit: pt('unit.un'),
          footer: pt('print.footer'),
          openings: pt('print.openings'),
          colWall: pt('print.colWall'),
          colOpenArea: pt('print.colOpenArea'),
          openingKind: { door: pt('opening.kind.door'), window: pt('opening.kind.window'), void: pt('opening.kind.void'), other: pt('opening.kind.void') },
          formwork: pt('struct.formwork'),
          view3d: pt('print.view3d'),
          byLocation: pt('print.byLocation'),
          noLocation: pt('print.noLocation'),
          byLocationNote: pt('print.byLocationNote'),
          totals: pt('print.totals'),
          totalsNote: pt('print.totalsNote'),
          materials: pt('print.materials'),
          colMaterial: pt('csv.material'),
          colPacks: pt('csv.packages'),
          materialKind: { profile: pt('csv.profile'), board: pt('csv.board'), screws: pt('csv.screws'), recipe: pt('csv.recipe'), ceiling: pt('print.buildUp'), floor: pt('print.buildUp') },
          tags: pt('print.tags'),
          colTag: pt('csv.tag'),
          detail: { length: pt('print.detailLength'), perimeter: pt('print.detailPerimeter'), height: pt('print.detailHeight'), sill: pt('print.detailSill') },
        },
      })
      const href = URL.createObjectURL(blob)
      const fileName = `${project!.project_code || project!.name} - ${kind}.pdf`.replace(/[\\/:*?"<>|]+/g, '_')
      // Bids keep the latest export of each kind so Commercial can attach it to the proposal.
      if (project!.stage === 'bid') {
        void createClient().storage.from(BUCKET).upload(`${projectId}/exports/${what}.pdf`, blob, { upsert: true, contentType: 'application/pdf' })
      }
      if (win && !win.closed) win.location.href = href
      else {
        const a = document.createElement('a')
        a.href = href
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        a.remove()
      }
      setTimeout(() => URL.revokeObjectURL(href), 10 * 60 * 1000)
      setStatus(image3d || !items3d.length ? t('print.done') : t('print.done3dMissing'))
    } catch (err) {
      win?.close()
      setError(t('print.error', { message: errorMessage(err) }))
    } finally {
      setPrinting(false)
    }
  }

  const run = (name: WorkCommand['name']) => { setMenu(null); setCommand(c => ({ name, n: (c?.n || 0) + 1 })) }

  async function toggleZone(z: ZoneRow) {
    const { error: e } = await createClient().from('takeoff_zones').update({ is_visible: !z.is_visible }).eq('id', z.id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await load()
  }
  async function renameZone(z: ZoneRow) {
    const name = window.prompt(t('zone.renamePrompt'), z.name)
    if (!name || !name.trim() || name.trim() === z.name) return
    const { error: e } = await createClient().from('takeoff_zones').update({ name: name.trim() }).eq('id', z.id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await load()
  }
  async function deleteZones(list: ZoneRow[]): Promise<boolean> {
    if (!list.length) return false
    if (!window.confirm(t('bulk.confirmZones', { count: list.length }))) return false
    const ids = list.map(z => z.id)
    const { data, error: e } = await createClient().from('takeoff_zones').delete().in('id', ids).select('id')
    if (e) { setError(t('workspace.error', { message: e.message })); return false }
    const done = data?.length || 0
    if (selectedZoneId && ids.includes(selectedZoneId)) setSelectedZoneId(null)
    if (done === 0) setError(t('element.deleteDenied'))
    else setStatus(done < ids.length ? t('bulk.zonesPartial', { done, total: ids.length }) : t('bulk.zonesDeleted', { count: done }))
    await load()
    return done > 0
  }
  async function setZonesVisible(list: ZoneRow[], visible: boolean) {
    const { error: e } = await createClient().from('takeoff_zones').update({ is_visible: visible }).in('id', list.map(z => z.id))
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await load()
  }
  /** Adds zones to the project's Location Breakdown (largest kinds first, each under its container). */
  async function createZoneLocations(list: ZoneRow[]) {
    setError('')
    try {
      const supabase = createClient()
      const locations = await loadLocations(supabase, projectId)
      const count = await createLocationsForZones(supabase, { projectId, targets: list, zones, levels, sources, locations })
      setStatus(t('zone.createdMany', { count }))
    } catch (e) {
      setError(t('workspace.error', { message: e instanceof Error ? e.message : String(e) }))
    }
    await load()
  }
  /** Moves an old Location Map page into RitsuScope (sheet, scale, print area, outlines linked to the same locations). */
  async function importLegacy(map: LegacyMap) {
    setError('')
    setLegacyBusy(true)
    setStatus(t('legacy.importing'))
    try {
      const supabase = createClient()
      const result = await importLegacyLocationMap(supabase, map, { projectId, sortOrder: (sources.length + 1) * 10, levels })
      setLegacyMaps(await loadLegacyLocationMaps(supabase, projectId))
      await load()
      setSelectedSourceId(result.sourceId)
      setSection('zoning')
      const sheetName = map.fileName.replace(/\.pdf$/i, '')
      setStatus(t('legacy.done', { sheet: sheetName, count: result.imported }) + (result.skipped.length ? ' ' + t('legacy.skipped', { names: result.skipped.join(', ') }) : ''))
    } catch (e) {
      setError(t('workspace.error', { message: e instanceof Error ? e.message : String(e) }))
    } finally {
      setLegacyBusy(false)
    }
  }
  /** Moves linked locations sitting at the root under their floor or zone. */
  async function organizeZoneLocations() {
    setError('')
    try {
      const supabase = createClient()
      const locations = await loadLocations(supabase, projectId)
      const count = await placeRootLocations(supabase, { zones, levels, sources, locations })
      setStatus(t('zone.organized', { count }))
    } catch (e) {
      setError(t('workspace.error', { message: e instanceof Error ? e.message : String(e) }))
    }
    await load()
  }
  /** A "Floor" location for every level that has none yet. */
  async function syncFloors() {
    setError('')
    try {
      const supabase = createClient()
      const locations = await loadLocations(supabase, projectId)
      const count = await createFloorsForLevels(supabase, { projectId, levels, locations })
      setStatus(t('level.floorsCreated', { count }))
    } catch (e) {
      setError(t('workspace.error', { message: e instanceof Error ? e.message : String(e) }))
    }
    await load()
  }
  async function deleteZone(z: ZoneRow) {
    if (!window.confirm(t('zone.confirmDeleteNamed', { name: z.name }))) return
    const { data, error: e } = await createClient().from('takeoff_zones').delete().eq('id', z.id).select('id')
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    if (!data || data.length === 0) { setError(t('element.deleteDenied')); return }
    if (selectedZoneId === z.id) setSelectedZoneId(null)
    setStatus(t('zone.deleted'))
    await load()
  }

  const modes: { key: typeof section | 'home'; icon: string; label: TakeoffMessageKey }[] = [
    { key: 'home', icon: 'home', label: 'header.home' },
    { key: 'settings', icon: 'settings', label: 'header.settings' },
    { key: 'zoning', icon: 'zoning', label: 'header.zoning' },
    { key: 'takeoff', icon: 'takeoff', label: 'header.takeoff' },
    { key: 'tasks', icon: 'measure', label: 'header.tasks' },
    { key: 'estimating', icon: 'estimating', label: 'header.estimating' },
  ]

  const checkedIds = layerItems.filter(it => checked.has(it.key)).map(it => it.key)
  const elementsOnSheet = (ids: string[]) => elements.filter(e => ids.includes(e.layer_id) && e.source_id === selectedSource?.id).length
  const elementsElsewhere = (ids: string[]) => elements.filter(e => ids.includes(e.layer_id) && e.source_id !== selectedSource?.id).length

  function toggleChecked(key: string, shift: boolean) {
    setChecked(prev => {
      const next = new Set(prev)
      const on = !prev.has(key)
      if (shift && lastChecked.current) {
        const keys = layerItems.map(it => it.key)
        const a = keys.indexOf(lastChecked.current)
        const b = keys.indexOf(key)
        if (a >= 0 && b >= 0) {
          for (const k of keys.slice(Math.min(a, b), Math.max(a, b) + 1)) { if (on) next.add(k); else next.delete(k) }
          return next
        }
      }
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
    lastChecked.current = key
  }

  async function deleteCheckedDrawings() {
    if (!selectedSource || !checkedIds.length) return
    const expected = elementsOnSheet(checkedIds)
    if (!expected) { setStatus(t('bulk.nothingOnSheet')); return }
    if (!window.confirm(t('bulk.confirmDrawings', { count: expected, items: checkedIds.length, sheet: selectedSource.name }))) return
    setError('')
    const { data, error: e } = await createClient().from('takeoff_elements').delete().in('layer_id', checkedIds).eq('source_id', selectedSource.id).select('id')
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    const done = data?.length || 0
    setSelectedElementId(null)
    setStatus(done < expected ? t('bulk.drawingsPartial', { done, total: expected }) : t('bulk.drawingsDeleted', { count: done }))
    await load()
  }

  async function deleteCheckedItems() {
    if (!checkedIds.length) return
    const here = elementsOnSheet(checkedIds)
    const elsewhere = elementsElsewhere(checkedIds)
    if (!window.confirm(t('bulk.confirmItems', { items: checkedIds.length, here, elsewhere }))) return
    setError('')
    const { data, error: e } = await createClient().from('takeoff_layers').delete().in('id', checkedIds).select('id')
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    const done = data?.length || 0
    if (done === 0) { setError(t('admin.only')); return }
    if (activeLayerId && checkedIds.includes(activeLayerId)) setActiveLayerId(null)
    if (editingLayerId && checkedIds.includes(editingLayerId)) setEditingLayerId(null)
    setSelectedElementId(null)
    setChecked(new Set())
    setStatus(done < checkedIds.length ? t('bulk.itemsPartial', { done, total: checkedIds.length }) : t('bulk.itemsDeleted', { count: done }))
    await load()
  }

  const allChecked = layerItems.length > 0 && checkedIds.length === layerItems.length

  const levelById = new Map<string, LevelRow>(levels.map(l => [l.id, l] as [string, LevelRow]))
  const currentMaster = selectedSource?.level_id && levelById.get(selectedSource.level_id) ? masterOf(levelById.get(selectedSource.level_id)!, levelById) : null
  const levelSelector = (
    <label title={t('level.selector')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', borderLeft: '1px solid #dfe7ea', fontSize: 11, fontWeight: 800, color: '#536d78', whiteSpace: 'nowrap' }}>
      <Icon name="building" size={16} />
      <select
        value={currentMaster?.id || ''}
        disabled={levels.length === 0}
        onChange={e => {
          const id = e.target.value
          const first = sources.find(s => s.level_id === id)
          if (first) setSelectedSourceId(first.id)
          else if (id) editLevel(id)
        }}
        style={{ height: 32, maxWidth: 220, padding: '0 8px', border: '1px solid #d3dfe2', borderRadius: 7, background: '#fff', color: '#173441', fontSize: 12, fontWeight: 700, cursor: levels.length ? 'pointer' : 'default' }}
      >
        <option value="">{levels.length ? t('level.unassigned') : t('level.selectorNone')}</option>
        {levelGroups(levels).map(g => <option key={g.master.id} value={g.master.id}>{groupLabel(g)}</option>)}
      </select>
    </label>
  )
  /** One row of the item list (flat list or under a level). `sheetId`: sheet to switch to before drawing. */
  const renderItemRow = (item: (typeof layerItems)[number], q: { main: string; sub: string }, sheetId?: string, rowKey?: string, indent = 14) => {
          const activeDraw = isPdf && item.key === activeLayerId
          const editing = item.key === editingLayerId
          return (
            <div
              key={rowKey ?? item.key}
              onClick={() => {
                if (sheetId && sheetId !== selectedSourceId) { setSelectedSourceId(sheetId); setActiveLayerId(item.key); setDrawRequest(n => n + 1) }
                else if (isPdf) { setActiveLayerId(item.key); setDrawRequest(n => n + 1) }
                // The item's properties open in the right panel too.
                setOpeningEditor(null); setEditingLevelId(null); setCheckedLevelIds(new Set()); setSelectedElementId(null)
                setEditingLayerId(item.key); setRightOpen(true); setRightTab('props')
              }}
              title={isPdf ? t('layout.itemClickPdf') : t('layer.edit')}
              style={{
                display: 'grid', gridTemplateColumns: '16px 14px minmax(0,1fr) auto 22px 22px', gap: 6, alignItems: 'center', padding: `8px 14px 8px ${indent}px`, cursor: 'pointer', opacity: hiddenLayerIds.has(item.key) ? 0.5 : 1,
                borderBottom: '1px solid #f0f4f5', background: checked.has(item.key) ? '#fff4ec' : activeDraw ? '#e6f6f4' : editing ? '#f4f7ff' : 'transparent', boxShadow: activeDraw ? 'inset 3px 0 0 #109d91' : 'none',
              }}
            >
              <input
                type="checkbox"
                checked={checked.has(item.key)}
                onClick={event => { event.stopPropagation(); toggleChecked(item.key, event.shiftKey) }}
                onChange={() => { /* handled in onClick (needs Shift) */ }}
                style={{ margin: 0 }}
              />
              <span style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 650, color: '#173441', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                <span style={{ fontSize: 10, color: '#6b8089' }}>{t(layerKindKey[item.kind])}{item.kind === 'area' && (item.elevation ?? 0) > 0 ? ` · h ${formatNumber(item.elevation ?? 0, 2)} m` : ''}</span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: '#0d7f77' }}>{q.main}</span>
                {q.sub && <span style={{ fontSize: 10, color: '#6b8089' }}>{q.sub}</span>}
              </span>
              <button
                type="button"
                title={t('layer.edit')}
                onClick={event => { event.stopPropagation(); setOpeningEditor(null); setEditingLayerId(editing ? null : item.key); setRightOpen(true); setRightTab('props') }}
                style={{ width: 22, height: 22, border: '1px solid #d3dfe2', borderRadius: 5, background: '#fff', cursor: 'pointer', fontSize: 11 }}
              >
                ✎
              </button>
              <button
                type="button"
                title={t(hiddenLayerIds.has(item.key) ? 'layer.show' : 'layer.hide')}
                onClick={event => { event.stopPropagation(); void toggleLayerVisible(item.key) }}
                style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: '1px solid #d3dfe2', borderRadius: 5, background: '#fff', cursor: 'pointer', color: hiddenLayerIds.has(item.key) ? '#a0b0b6' : '#294955' }}
              >
                <Icon name={hiddenLayerIds.has(item.key) ? 'eyeOff' : 'eye'} size={13} />
              </button>
            </div>
          )
  }
  /** Opens the openings editor; on another level, switches to that level's sheet first. */
  const openOpenings = (kind: 'door' | 'window' | 'void', sheetId?: string) => {
    if (sheetId && sheetId !== selectedSourceId) setSelectedSourceId(sheetId)
    setEditingLayerId(null); setSelectedElementId(null); setOpeningEditor(kind); setRightOpen(true); setRightTab('props')
  }
  const renderOpeningRow = (o: ReturnType<typeof summarizeOpenings>[number], keyPrefix: string, sheetId?: string, indent = 14) => {
    const active = !sheetId || sheetId === selectedSourceId
    return (
            <div
              key={`${keyPrefix}${o.kind}`}
              title={o.sizes.map(([size, n]) => `${n} × ${size} m`).join('\n')}
              onClick={() => openOpenings(o.kind, sheetId)}
              style={{ cursor: 'pointer', background: (active && openingEditor === o.kind) ? '#e6f6f4' : 'transparent', display: 'grid', gridTemplateColumns: '16px 14px minmax(0,1fr) auto 22px', gap: 6, alignItems: 'center', padding: `8px 14px 8px ${indent}px`, borderBottom: '1px solid #f0f4f5' }}
            >
              <span />
              <Icon name={o.icon} size={14} style={{ color: o.color }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 650, color: '#173441' }}>{t(o.kind === 'door' ? 'openings.listDoors' : o.kind === 'window' ? 'openings.listWindows' : 'openings.listVoids')}</span>
                <span style={{ display: 'block', fontSize: 10, color: '#6b8089', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.sizes.map(([size, n]) => `${n}× ${size} m`).join(' · ')}</span>
              </span>
              <span style={{ textAlign: 'right' }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 800, color: o.color }}>{o.count} {t('unit.un')}</span>
                <span style={{ fontSize: 10, color: '#6b8089' }}>{formatNumber(o.area, 2)} m²</span>
              </span>
              <button
                type="button"
                title={t('openings.editRow')}
                onClick={event => { event.stopPropagation(); openOpenings(o.kind, sheetId) }}
                style={{ width: 22, height: 22, border: '1px solid ' + ((active && openingEditor === o.kind) ? '#109d91' : '#d3dfe2'), borderRadius: 5, background: (active && openingEditor === o.kind) ? '#e6f6f4' : '#fff', cursor: 'pointer', fontSize: 11 }}
              >
                ✎
              </button>
            </div>
    )
  }
  /** Main figure of an item as a number and unit, for group subtotals (walls in m² when they have a height). */
  const qtyValue = (item: (typeof layerItems)[number], q: Quantities | null): { v: number; u: string } | null => {
    if (!q) return null
    if (item.kind === 'linear') return !item.struct && (q.net ?? 0) > 0 ? { v: q.net ?? 0, u: 'm²' } : { v: q.len, u: 'm' }
    if (item.kind === 'area') return { v: q.area, u: 'm²' }
    return { v: q.n, u: t('unit.un') }
  }
  const GROUP_LABEL: Record<GroupKey, TakeoffMessageKey> = {
    arch: 'tool.arch', struct: 'tool.struct', blocking: 'mep.group.blocking', electrical: 'mep.group.electrical', plumbing: 'mep.group.plumbing', other: 'group.other',
  }
  const SUB_LABEL: Record<SubKey, TakeoffMessageKey> = { walls: 'group.walls', ceilings: 'group.ceilings', floors: 'group.floors' }
  /** The item rows under discipline headers (Architecture → Walls / Ceilings / Floors, Structure, …), each foldable, with a subtotal, an eye and a select-all box. */
  const renderGrouped = (rows: { item: (typeof layerItems)[number]; q: Quantities | null; node: (indent: number) => ReactNode }[], prefix: string, indent: number, openings: ReturnType<typeof summarizeOpenings> = [], sheetId?: string) => {
    const STEP = 12
    const header = (key: string, label: string, list: typeof rows, level: 0 | 1, extra?: { total: string; count: number }) => {
      const ids = list.map(r => r.item.key)
      const folded = foldedGroups.has(key)
      const allChecked = ids.every(id => checked.has(id))
      const someChecked = !allChecked && ids.some(id => checked.has(id))
      const anyHidden = ids.some(id => hiddenLayerIds.has(id))
      const allHidden = ids.length > 0 && ids.every(id => hiddenLayerIds.has(id))
      const sums = new Map<string, number>()
      for (const r of list) { const v = qtyValue(r.item, r.q); if (v) sums.set(v.u, (sums.get(v.u) || 0) + v.v) }
      const total = extra ? extra.total : [...sums.entries()].map(([u, v]) => `${formatNumber(v, u === t('unit.un') ? 0 : 2)} ${u}`).join(' · ')
      // Same library type at the same level split over several items: offer to merge them into one.
      const seen = new Map<string, number>()
      for (const id of ids) { const l = layers.find(x => x.id === id); const k = l && sameTypeKey(l); if (k) seen.set(k, (seen.get(k) || 0) + 1) }
      const dupCount = [...seen.values()].filter(n => n > 1).length
      return (
        <div
          key={`h:${key}`}
          onClick={() => setFoldedGroups(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })}
          style={{ display: 'grid', gridTemplateColumns: '16px 14px minmax(0,1fr) auto 22px', gap: 6, alignItems: 'center', padding: `${level === 0 ? 7 : 5}px 14px ${level === 0 ? 7 : 5}px ${indent + level * STEP}px`, cursor: 'pointer', background: level === 0 ? '#f2f7f8' : '#f8fbfb', borderBottom: '1px solid #e8eff1', opacity: allHidden ? 0.55 : 1 }}
        >
          {extra ? <span /> : <input
            type="checkbox"
            checked={allChecked}
            ref={el => { if (el) el.indeterminate = someChecked }}
            onClick={event => event.stopPropagation()}
            onChange={() => setChecked(prev => { const n = new Set(prev); for (const id of ids) { if (allChecked) n.delete(id); else n.add(id) } return n })}
            title={t('group.selectAll')}
            style={{ margin: 0 }}
          />}
          <Icon name="chevron" size={12} style={{ color: '#536d78', transform: folded ? 'rotate(-90deg)' : 'none', transition: 'transform .12s' }} />
          {/* One text style for every group (any discipline added later looks the same): name never cut, count shrinks first. */}
          <span style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span style={groupName(level)}>{label}</span>
            <span style={groupCount}>{t((extra ? extra.count : list.length) === 1 ? 'group.typesOne' : 'group.types', { count: extra ? extra.count : list.length })}</span>
            {dupCount > 0 && (
              <button type="button" title={t('group.mergeHint')} onClick={event => { event.stopPropagation(); void mergeDuplicates(ids) }}
                style={{ marginLeft: 6, height: 18, padding: '0 6px', border: '1px solid #f3d19c', borderRadius: 9, background: '#fffaf0', color: '#8a5a12', fontSize: 9, fontWeight: 800, cursor: 'pointer', textTransform: 'none', letterSpacing: 0 }}>
                {t('group.merge')}
              </button>
            )}
          </span>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#0d7f77', whiteSpace: 'nowrap' }}>{total}</span>
          {extra ? <span /> : <button
            type="button"
            title={t(anyHidden ? 'group.show' : 'group.hide')}
            onClick={event => { event.stopPropagation(); void setLayersVisible(ids, anyHidden) }}
            style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, border: '1px solid #d3dfe2', borderRadius: 5, background: '#fff', cursor: 'pointer', color: anyHidden ? '#a0b0b6' : '#294955' }}
          >
            <Icon name={anyHidden ? 'eyeOff' : 'eye'} size={13} />
          </button>}
        </div>
      )
    }
    const groups = groupRows(rows, r => r.item).map(g => {
      const gKey = `${prefix}${g.group}`
      const all = g.subs.flatMap(s => s.rows)
      return (
        <div key={gKey}>
          {header(gKey, t(GROUP_LABEL[g.group]), all, 0)}
          {!foldedGroups.has(gKey) && g.subs.map(s => {
            if (!s.sub) return <div key={`${gKey}:rows`}>{s.rows.map(r => r.node(indent + STEP))}</div>
            const sKey = `${gKey}:${s.sub}`
            return (
              <div key={sKey}>
                {header(sKey, t(SUB_LABEL[s.sub]), s.rows, 1)}
                {!foldedGroups.has(sKey) && s.rows.map(r => r.node(indent + 2 * STEP))}
              </div>
            )
          })}
        </div>
      )
    })
    // Doors, windows and openings: their own group, last, like the disciplines.
    if (openings.length) {
      const oKey = `${prefix}openings`
      const n = openings.reduce((a, o) => a + o.count, 0)
      const area = openings.reduce((a, o) => a + o.area, 0)
      groups.push(
        <div key={oKey}>
          {header(oKey, t('group.openings'), [], 0, { total: `${n} ${t('unit.un')} · ${formatNumber(area, 2)} m²`, count: openings.length })}
          {!foldedGroups.has(oKey) && openings.map(o => renderOpeningRow(o, `${oKey}:`, sheetId, indent + STEP))}
        </div>,
      )
    }
    return groups
  }
  const treeMode = levels.length > 0 && isPdf
  const usedLayerIds = new Set(elements.map(e => e.layer_id))
  /** Under a level: items drawn on its sheets; on the current level also new (never drawn) items, and the others on demand. */
  const renderBranch = (b: LevelBranch) => {
    const drawn = branchData.get(b.id) || []
    const current = b.sheets.some(s => s.id === selectedSourceId)
    const drawnKeys = new Set(drawn.map(d => d.key))
    const fresh = current ? layerItems.filter(it => !drawnKeys.has(it.key) && !usedLayerIds.has(it.key)) : []
    const others = current ? layerItems.filter(it => !drawnKeys.has(it.key) && usedLayerIds.has(it.key)) : []
    const sheetId = current ? undefined : b.sheets[0]?.id
    const openings = summarizeOpenings(drawn.map(d => d.item))
    if (!drawn.length && !fresh.length && !others.length) return <div style={{ ...ui.small, padding: '2px 14px 4px 50px', color: '#a0b0b6' }}>{t('level.noItems')}</div>
    return (
      <>
        {renderGrouped([
          ...drawn.map(d => ({ item: d.item, q: d.q, node: (ind: number) => renderItemRow(d.item, quantityText(d.item, d.q), sheetId, `${b.id}:${d.key}`, ind) })),
          ...fresh.map(it => ({ item: it, q: null, node: (ind: number) => renderItemRow(it, quantityText(it, null), undefined, `${b.id}:${it.key}`, ind) })),
        ], `${b.id}:`, 28, openings, sheetId)}
        {others.length > 0 && (
          <button type="button" onClick={() => setOthersOpen(o => !o)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'transparent', padding: '6px 14px 6px 50px', color: '#0d7f77', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
            {othersOpen ? t('level.hideOtherItems') : t('level.otherItems', { count: others.length })}
          </button>
        )}
        {othersOpen && others.map(it => <div key={`${b.id}:o:${it.key}`} style={{ background: '#fafcfc' }}>{renderItemRow(it, quantityText(it, null), undefined, `${b.id}:o:${it.key}`)}</div>)}
      </>
    )
  }
  const toggleBranch = (id: string) => setHiddenBranches(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const sheetMult = selectedSource ? sheetMultiplier(selectedSource, levels) : 1
  const levelsPanelFor = (withItems: boolean) => (
    <LevelsPanel
      levels={levels}
      sources={sources.filter(s => s.kind === 'pdf_page')}
      selectedSourceId={selectedSourceId}
      editingLevelId={editingLevelId}
      onSelectSource={id => setSelectedSourceId(id)}
      onEditLevel={editLevel}
      onAddLevel={() => void addLevel()}
      onGenerate={() => setGenerateOpen(true)}
      onAssign={(sid, lid) => void assignSheetLevel(sid, lid)}
      onCopyLevel={openCopyForLevel}
      renderItems={withItems && treeMode ? renderBranch : undefined}
      hiddenBranches={hiddenBranches}
      onToggleBranch={toggleBranch}
      onSyncFloors={() => void syncFloors()}
      checkedLevels={checkedLevelIds}
      onCheckLevels={checkLevels}
    />
  )
  const levelsPanel = levelsPanelFor(true)
  const takeoffLeft = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {!treeMode && levelsPanel}
      <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid #e5ecee', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ ...paneTitle, flex: 1 }}>{t('layout.items')}</span>
        {sheetMult > 1 && <span title={t('level.sheetMultiplier', { count: sheetMult })} style={{ padding: '2px 7px', borderRadius: 10, background: '#e6f6f4', color: '#0d7f77', fontSize: 10, fontWeight: 800 }}>×{sheetMult}</span>}
      </div>
      {checkedIds.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#fff8f2', borderTop: '1px solid #f3dcc8' }}>
          <strong style={{ fontSize: 11, color: '#7c2d12', flex: '1 0 100%' }}>{t('bulk.selected', { count: checkedIds.length })}</strong>
          {isPdf && levels.length > 1 && selectedSource && <button type="button" style={chipBtn(false)} onClick={() => setCopyFromId(selectedSource.id)}><Icon name="copy" size={13} />{t('copy.button')}</button>}
          {isPdf && levels.length > 0
            ? <button type="button" style={{ ...chipBtn(false), color: '#c94a4a', borderColor: '#efcaca' }} onClick={() => setDeleteLevelsOpen(true)}><Icon name="building" size={13} />{t('levelDelete.button')}</button>
            : isPdf && <button type="button" style={{ ...chipBtn(false), color: '#c94a4a', borderColor: '#efcaca' }} onClick={() => void deleteCheckedDrawings()}>{t('bulk.deleteDrawings')}</button>}
          <button type="button" style={{ ...chipBtn(false), color: '#fff', background: '#c94a4a', borderColor: '#c94a4a' }} onClick={() => void deleteCheckedItems()}><Icon name="trash" size={13} />{t('bulk.deleteItems')}</button>
          <button type="button" style={chipBtn(false)} onClick={() => setChecked(new Set())}>{t('bulk.clear')}</button>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '16px 14px minmax(0,1fr) auto 22px 22px', gap: 6, alignItems: 'center', padding: '5px 14px', fontSize: 9, fontWeight: 800, color: '#536d78', background: '#f2f7f8', borderTop: '1px solid #e5ecee', borderBottom: '1px solid #e5ecee' }}>
        <input
          type="checkbox"
          title={t('bulk.selectAll')}
          checked={allChecked}
          ref={el => { if (el) el.indeterminate = checkedIds.length > 0 && !allChecked }}
          onChange={() => setChecked(allChecked ? new Set() : new Set(layerItems.map(it => it.key)))}
          style={{ margin: 0 }}
        />
        <span />
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {t('csv.layer')}
          {layerItems.some(it => it.shapes.length === 0) && (
            <button type="button" style={{ border: 0, background: 'transparent', color: '#0d7f77', fontSize: 9, fontWeight: 800, cursor: 'pointer', padding: 0 }} onClick={() => setChecked(new Set(layerItems.filter(it => it.shapes.length === 0).map(it => it.key)))}>
              {t('bulk.selectEmpty')}
            </button>
          )}
        </span>
        <span style={{ textAlign: 'right' }}>{t('csv.quantity')}</span>
        <span />
        <span />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {treeMode ? levelsPanel : layerItems.length === 0 ? (
          <div style={{ ...ui.small, padding: 14 }}>{t('workspace.layers.empty')}</div>
        ) : renderGrouped(layerItems.map(item => ({ item, q: ptPerM > 0 && item.shapes.length ? layerQuantities(item, ptPerM) : null, node: (ind: number) => renderItemRow(item, itemQuantity(item), undefined, undefined, ind) })), 'flat:', 14, openingSummary)}
      </div>
    </div>
  )

  const takeoffRight = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 6, padding: 10, borderBottom: '1px solid #e5ecee' }}>
        <button type="button" style={chipBtn(rightTab === 'props')} onClick={() => setRightTab('props')}>{t('layout.tabProps')}</button>
        <button type="button" style={chipBtn(rightTab === 'buy')} onClick={() => setRightTab('buy')}>{t('layout.tabBuy')}</button>
        {sources.some(src => src.kind === 'ifc_storey') && (
          <button type="button" style={chipBtn(rightTab === 'revision')} onClick={() => setRightTab('revision')}>{t('layout.tabRevision')}</button>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rightTab === 'props' && properties}
        {rightTab === 'buy' && (selectedSource && ptPerM > 0
          ? <FramingPanel items={sourceItems} ptPerM={ptPerM} recipes={recipeById} />
          : <div style={ui.small}>{t('layout.buyEmpty')}</div>)}
        {rightTab === 'revision' && <RevisionPanel sources={sources} layers={layers} elements={elements} />}
      </div>
    </div>
  )

  const zoningLeft = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
    {levelsPanelFor(false)}
    {legacyMaps.map(m => (
      <div key={m.mapId} style={{ margin: '10px 14px 0', padding: 10, border: '1px solid #d8c8f5', borderRadius: 8, background: '#f7f3fe', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong style={{ fontSize: 11, color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('legacy.title')}</strong>
        <span style={{ fontSize: 11, color: '#3b2a63' }}>{t('legacy.found', { count: m.outlines.filter(importableOutline).length, file: m.fileName })}</span>
        <button type="button" disabled={legacyBusy} onClick={() => void importLegacy(m)} style={{ alignSelf: 'flex-start', height: 28, padding: '0 10px', border: 0, borderRadius: 7, background: '#6d28d9', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>{t('legacy.import')}</button>
      </div>
    ))}
    <div style={{ flex: 1, minHeight: 0 }}>
    <ZoningSidebar
      zones={sheetZones}
      sheetName={selectedSource?.name || null}
      ptPerM={ptPerM}
      selectedId={selectedZoneId}
      onSelect={id => setSelectedZoneId(id)}
      onAdd={() => setNewZoneRequest(n => n + 1)}
      onDetect={() => setDetectRoomsRequest(n => n + 1)}
      onToggleVisible={z => void toggleZone(z)}
      onRename={z => void renameZone(z)}
      onDelete={z => void deleteZone(z)}
      onDeleteMany={deleteZones}
      onSetVisibleMany={setZonesVisible}
      unavailable={zonesError ? t('zone.unavailable') : !isPdf ? t('zone.pdfOnly') : null}
      drawKind={drawKind}
      onDrawKind={setDrawKind}
      onCreateLocations={createZoneLocations}
      onOrganize={organizeZoneLocations}
    />
    </div>
    </div>
  )

  // ---------- Tarefas sidebars ----------
  const fmtQty = (v: number) => formatNumber(v, 2)
  const taskProduction = taskLocations.filter(l => !TASK_GROUP_KINDS.has(l.location_type)).slice().sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  const drawnOf = (scopeId: string, locationId: string) => taskRows.filter(r => r.scope_item_id === scopeId && r.location_id === locationId).reduce((a, r) => a + Number(r.quantity || 0), 0)
  const hasZone = (locationId: string) => zones.some(z => z.location_id === locationId && Array.isArray(z.points) && z.points.length >= 3)
  const tasksLeft = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid #e5edef' }}>
        <div style={paneTitle}>{t('task.sidebar.title')}</div>
        <div style={{ ...ui.small, marginTop: 6, lineHeight: 1.45 }}>{t('task.sidebar.help')}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '6px 8px 14px' }}>
        {!tasksLoaded ? <div style={ui.muted}>{t('workspace.loading')}</div>
          : !taskScopes.length ? <div style={{ ...ui.small, padding: 10, lineHeight: 1.5 }}>{t('task.sidebar.noScope')}</div>
          : taskScopes.map(sc => {
            const open = sc.id === taskScopeId
            const total = taskRows.filter(r => r.scope_item_id === sc.id).reduce((a, r) => a + Number(r.quantity || 0), 0)
            return <div key={sc.id} style={{ marginTop: 4, border: '1px solid ' + (open ? '#9fd6cf' : '#e5edef'), borderRadius: 8, background: open ? '#f2fbfa' : '#fff', overflow: 'hidden' }}>
              <button type="button" onClick={() => { setTaskScopeId(open ? null : sc.id) }} style={{ display: 'grid', gap: 2, width: '100%', padding: '8px 10px', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', color: '#173441' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: '#6b8089', fontWeight: 700 }}><i style={{ width: 14, height: 4, borderRadius: 2, background: colorOfScope(sc.id) }} />{sc.scope_code}{sc.unit ? ` · ${sc.unit}` : ''}</span>
                <span style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.3 }}>{sc.scope_name}</span>
                <span style={{ fontSize: 10.5, color: total > 0 ? '#be123c' : '#8aa0a8' }}>{t('task.sidebar.drawnTotal', { value: `${fmtQty(total)} / ${fmtQty(Number(sc.quantity || 0))} ${sc.unit || ''}` })}</span>
              </button>
              {open && <div style={{ borderTop: '1px solid #dcefeb', padding: '4px 6px 6px' }}>
                {!taskProduction.length ? <div style={{ ...ui.small, padding: 6 }}>{t('task.sidebar.noLocations')}</div> : taskProduction.map(loc => {
                  const on = loc.id === taskLocationId
                  const zoned = hasZone(loc.id)
                  const q = drawnOf(sc.id, loc.id)
                  return <button key={loc.id} type="button" title={zoned ? undefined : t('task.sidebar.noZoneHint')} onClick={() => { setTaskLocationId(loc.id); setTaskFrameTick(n => n + 1) }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', marginTop: 3, padding: '6px 8px', border: '1px solid ' + (on ? '#e11d48' : 'transparent'), borderRadius: 6, background: on ? '#fff1f3' : 'transparent', cursor: 'pointer', color: zoned ? '#294955' : '#6b8089', fontSize: 12, textAlign: 'left' }}>
                    <span>{loc.name}</span>
                    <span style={{ fontWeight: 700, color: q > 0 ? '#be123c' : '#9aaeb5', whiteSpace: 'nowrap' }}>{q > 0 ? `${fmtQty(q)} ${sc.unit || ''}` : !zoned ? t('task.sidebar.noZone') : '—'}</span>
                  </button>
                })}
              </div>}
            </div>
          })}
      </div>
    </div>
  )

  const backToAllocation = `/projects/${projectId}/locations?tab=allocation${taskScopeId ? `&scope=${taskScopeId}` : ''}${taskScopeId && taskLocationId ? `&drawn=${taskLocationId}` : ''}`
  const taskOthers = taskScopeId ? taskProduction.filter(l => l.id !== taskLocationId).map(l => ({ l, q: drawnOf(taskScopeId, l.id) })).filter(x => x.q > 0) : []
  /** Properties of the task line clicked on the drawing. */
  const inspectCard = (() => {
    const r = inspectLineId ? taskRows.find(x => x.id === inspectLineId) : null
    if (!r) return null
    const sc = taskScopes.find(x => x.id === r.scope_item_id)
    const loc = taskLocations.find(x => x.id === r.location_id)
    const sheet = sources.find(x => x.id === r.source_id)
    const k = Number(sheet?.scale_pt_per_m) || 0
    const len = k > 0 ? r.points.slice(1).reduce((a, p, i) => a + Math.hypot(p[0] - r.points[i][0], p[1] - r.points[i][1]), 0) / k : 0
    const current = r.scope_item_id === taskScopeId && r.location_id === taskLocationId
    const row = (label: string, value: string) => <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 6, fontSize: 11.5 }}><span style={{ color: '#6b8089' }}>{label}</span><b style={{ color: '#173441', fontWeight: 700 }}>{value}</b></div>
    const btn = { height: 28, padding: '0 10px', border: '1px solid #cddcdf', borderRadius: 6, background: '#fff', color: '#173441', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' } as const
    return <div style={{ display: 'grid', gap: 6, padding: '10px', border: `2px solid ${colorOfScope(r.scope_item_id)}`, borderRadius: 8, background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 12, height: 4, borderRadius: 2, background: colorOfScope(r.scope_item_id) }} />
        <b style={{ flex: 1, fontSize: 13, color: '#173441' }}>{r.tag || t('task.inspect.title')}</b>
        <button type="button" onClick={() => setInspectLineId(null)} aria-label="×" style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 15, color: '#6b8089' }}>×</button>
      </div>
      {row(t('task.inspect.activity'), sc ? `${sc.scope_code || ''} ${sc.scope_name}`.trim() : '—')}
      {row(t('task.inspect.location'), loc?.name || '—')}
      {row(t('task.inspect.sheet'), sheet?.name || '—')}
      {row(t('task.inspect.quantity'), `${formatNumber(Number(r.quantity || 0), 2)} ${r.unit || sc?.unit || ''}`.trim())}
      {k > 0 && row(t('task.inspect.length'), `${formatNumber(len, 2)} m`)}
      {r.height_m != null && row(t('task.inspect.height'), `${formatNumber(Number(r.height_m), 2)} m`)}
      {row(t('task.inspect.label'), r.label_at ? t('task.inspect.labelMoved') : t('task.inspect.labelAuto'))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        {!current && <button type="button" style={btn} onClick={() => { setTaskScopeId(r.scope_item_id); setTaskLocationId(r.location_id) }}>{t('task.inspect.open')}</button>}
        {r.label_at && <button type="button" style={btn} onClick={() => void moveTaskLabel(r.id, null)}>{t('task.inspect.resetLabel')}</button>}
        <button type="button" style={{ ...btn, color: '#a44343', borderColor: '#efcaca' }} onClick={async () => { await deleteTaskLine(r.id); setInspectLineId(null) }}>{t('task.delete')}</button>
      </div>
    </div>
  })()
  const tasksRight = (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 12, overflow: 'auto', height: '100%', boxSizing: 'border-box' }}>
      <a href={backToAllocation} style={{ ...ui.backLink, fontSize: 12 }}>← {t('task.panel.back')}</a>
      {inspectCard}
      {!taskScope || !taskLocation ? <div style={{ ...ui.small, lineHeight: 1.5 }}>{t('task.panel.pick')}</div> : <>
        <div>
          <div style={{ fontSize: 10.5, color: '#6b8089', fontWeight: 700 }}>{taskScope.scope_code} · {t('task.panel.in', { location: taskLocation.name })}</div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#173441', lineHeight: 1.3, marginTop: 2 }}>{taskScope.scope_name}</div>
        </div>
        {!taskZone && <div style={{ ...ui.error, background: '#fff8eb', color: '#8a4b0f' }}>{t('task.panel.noZoneDraw', { location: taskLocation.name })}</div>}
        {<>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: '#fff1f3', display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9f1239' }}>{t('task.panel.drawn')}</span>
            <b style={{ fontSize: 20, color: '#be123c' }}>{fmtQty(taskHere.reduce((a, r) => a + Number(r.quantity || 0), 0))} {taskScope.unit || ''}</b>
            {taskMeasured.measure === 'wallArea' && taskHere.length > 0 && <span style={{ fontSize: 11, color: '#6b8089' }}>{t('task.panel.breakdown', { length: fmtQty(taskMeasured.length), height: taskHeightM ? fmtQty(taskHeightM) : '—', openings: fmtQty(taskMeasured.openings) })}</span>}
          </div>
          {taskMeasured.measure === 'wallArea' && <label style={{ display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#42636f' }}>{t('task.panel.height')}
            <input type="number" min="0" step="0.01" value={taskHeight} onChange={e => setTaskHeight(e.target.value)} onBlur={() => void applyTaskHeight()} style={{ height: 32, padding: '0 8px', border: '1px solid ' + (taskHeightM ? '#cddcdf' : '#e5a3a3'), borderRadius: 6, fontSize: 13 }} />
          </label>}
          <div style={{ display: 'grid', gap: 6, padding: '8px 10px', border: '1px solid #e5edef', borderRadius: 8 }}>
            <div style={paneTitle}>{t('task.layers')}</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#42636f', cursor: 'pointer' }}><input type="checkbox" checked={taskWalls} onChange={e => setTaskWalls(e.target.checked)} /><span><b>{t('task.layer.estimate')}</b> · {t('task.layer.estimateHint')}</span></label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#42636f', cursor: 'pointer' }}><input type="checkbox" checked={taskPlan} onChange={e => setTaskPlan(e.target.checked)} /><span><b>{t('task.layer.planning')}</b> · {t('task.layer.planningHint')}</span></label>
          </div>
          {(() => {
            const st = styleOfScope(taskScope.id)
            const mm = Math.round(st.thickness_m * 1000)
            const pct = Math.round(st.transparency * 100)
            const row = { display: 'grid', gridTemplateColumns: '92px 1fr 46px', alignItems: 'center', gap: 8, fontSize: 12, color: '#42636f' } as const
            return <div style={{ display: 'grid', gap: 7, padding: '8px 10px', border: '1px solid #e5edef', borderRadius: 8 }}>
              <div style={paneTitle}>{t('task.style.title', { code: taskScope.scope_code || '' })}</div>
              <label style={row}>{t('task.style.color')}
                <input type="color" value={colorOfScope(taskScope.id)} onChange={e => setStyleLocal(taskScope.id, { color: e.target.value })} onBlur={e => void commitStyle(taskScope.id, { color: e.currentTarget.value })} style={{ width: 44, height: 26, padding: 0, border: '1px solid #cddcdf', borderRadius: 5, background: '#fff' }} />
                <span />
              </label>
              <div style={{ ...row, gridTemplateColumns: '92px 1fr 78px' }}>{t('task.style.thickness')}
                <input type="range" min={5} max={500} step={5} value={mm} aria-label={t('task.style.thickness')} onChange={e => setStyleLocal(taskScope.id, { thickness_m: Number(e.target.value) / 1000 })} onPointerUp={e => void commitStyle(taskScope.id, { thickness_m: Number(e.currentTarget.value) / 1000 })} onKeyUp={e => void commitStyle(taskScope.id, { thickness_m: Number(e.currentTarget.value) / 1000 })} />
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input key={`mm-${taskScope.id}-${mm}`} type="number" min={5} max={500} step={1} defaultValue={mm} aria-label={t('task.style.thicknessMm')}
                    onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur() }}
                    onBlur={e => { const v = Math.round(Number(e.currentTarget.value)); if (Number.isFinite(v) && v > 0 && v !== mm) void commitStyle(taskScope.id, { thickness_m: Math.min(500, Math.max(5, v)) / 1000 }) }}
                    style={{ width: 50, height: 26, padding: '0 4px', border: '1px solid #cddcdf', borderRadius: 5, fontSize: 12, textAlign: 'right' }} />mm
                </span>
              </div>
              <label style={row}>{t('task.style.transparency')}
                <input type="range" min={0} max={90} step={5} value={pct} onChange={e => setStyleLocal(taskScope.id, { transparency: Number(e.target.value) / 100 })} onPointerUp={e => void commitStyle(taskScope.id, { transparency: Number(e.currentTarget.value) / 100 })} onKeyUp={e => void commitStyle(taskScope.id, { transparency: Number(e.currentTarget.value) / 100 })} />
                <b style={{ textAlign: 'right' }}>{pct}%</b>
              </label>
              <button type="button" onClick={() => void commitStyle(taskScope.id, null)} style={{ justifySelf: 'start', border: 0, background: 'transparent', padding: 0, color: '#0b7f75', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>{t('task.style.reset')}</button>
              <span style={{ fontSize: 10.5, color: '#8aa0a8', lineHeight: 1.4 }}>{t('task.style.hint')}</span>
            </div>
          })()}
          {taskZone && <button type="button" onClick={() => { if (taskZone.source_id !== selectedSourceId) setSelectedSourceId(taskZone.source_id); setTaskFrameTick(n => n + 1) }} style={{ alignSelf: 'flex-start', height: 30, padding: '0 12px', border: '1px solid #cddcdf', borderRadius: 7, background: '#fff', color: '#173441', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('task.panel.frame')}</button>}
          <div>
            <div style={paneTitle}>{t('task.panel.lines', { count: taskHere.length })}</div>
            {taskHere.length > 0 && <div style={{ ...ui.small, marginTop: 4, lineHeight: 1.4 }}>{t('task.panel.labelHint')}</div>}
            {!taskHere.length ? <div style={{ ...ui.small, marginTop: 6, lineHeight: 1.5 }}>{t('task.panel.noLines')}</div> : <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>
              {taskHere.map((r, i) => <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', border: '1px solid #f3d0d7', borderRadius: 6, fontSize: 12 }}>
                <span style={{ width: 10, height: 3, background: colorOfScope(taskScopeId), borderRadius: 2 }} />
                <span style={{ flex: 1, color: '#294955', fontWeight: 700 }}>{r.tag || `#${i + 1}`}</span>
                <b style={{ color: '#be123c' }}>{fmtQty(Number(r.quantity || 0))} {taskScope.unit || ''}</b>
                <button type="button" onClick={() => void deleteTaskLine(r.id)} title={t('task.delete')} aria-label={t('task.delete')} style={{ border: 0, background: 'transparent', color: '#a44343', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>)}
            </div>}
          </div>
          {(() => {
            const mats = materialsFor(taskScope.id, taskLocation.id)
            const rates = planMaterialsOf(taskScope.plan_materials)
            const cell = { height: 26, padding: '0 6px', border: '1px solid #cddcdf', borderRadius: 5, fontSize: 11.5, minWidth: 0, width: '100%', boxSizing: 'border-box' } as const
            const upd = (i: number, patch: Partial<PlanMaterial>) => setRatesLocal(taskScope.id, rates.map((r, j) => (j === i ? { ...r, ...patch } : r)))
            const commit = () => void saveRates(taskScope.id, planMaterialsOf(taskScopes.find(x => x.id === taskScope.id)?.plan_materials))
            return <div style={{ display: 'grid', gap: 7, padding: '8px 10px', border: '1px solid #e5edef', borderRadius: 8 }}>
              <div style={paneTitle}>{t('mat.panelTitle', { code: taskScope.scope_code || '' })}</div>
              {!taskHere.length ? <span style={{ ...ui.small, lineHeight: 1.4 }}>{t('mat.drawFirst')}</span>
                : !mats.length ? <span style={{ ...ui.small, lineHeight: 1.4 }}>{t(taskScope.takeoff_layer_id ? 'mat.noneYet' : 'mat.noLink')}</span>
                : <div style={{ display: 'grid', gap: 3 }}>
                  {mats.map(r => { const f = fmtMat(r); return <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, fontSize: 11.5, color: '#294955', padding: '3px 0', borderBottom: '1px solid #f0f4f5' }}>
                    <span>{r.mat}<em style={{ color: '#8aa0a8', fontStyle: 'normal' }}> · {t(r.source === 'rate' ? 'mat.rate' : r.source === 'recipe' ? 'mat.fromRecipe' : 'mat.fromLayout')}</em></span>
                    <span style={{ textAlign: 'right' }}><b>{f.whole}</b><br /><span style={{ color: '#8aa0a8', fontSize: 10.5 }}>{f.exact}</span></span>
                  </div> })}
                </div>}
              <div style={{ fontSize: 10.5, fontWeight: 800, color: '#6b8089', textTransform: 'uppercase', letterSpacing: '.05em', marginTop: 4 }}>{t('mat.rates')}</div>
              <span style={{ fontSize: 10.5, color: '#8aa0a8', lineHeight: 1.4 }}>{t('mat.ratesHint')}</span>
              {rates.map((r, i) => <div key={i} style={{ display: 'grid', gap: 4, padding: 6, border: '1px solid #eef3f4', borderRadius: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 22px', gap: 4 }}>
                  <input value={r.name} placeholder={t('mat.rateName')} onChange={e => upd(i, { name: e.target.value })} onBlur={commit} style={cell} />
                  <button type="button" title={t('mat.removeRate')} onClick={() => void saveRates(taskScope.id, rates.filter((_, j) => j !== i))} style={{ border: 0, background: 'transparent', color: '#a44343', cursor: 'pointer' }}>×</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 48px 10px 62px 42px', gap: 4, alignItems: 'center', fontSize: 11, color: '#6b8089' }}>
                  <input type="number" min={0} step="any" value={r.coef || ''} placeholder="0" title={t('mat.coef')} onChange={e => upd(i, { coef: Number(e.target.value) })} onBlur={commit} style={cell} />
                  <input value={r.unit} placeholder="kg" title={t('mat.unit')} onChange={e => upd(i, { unit: e.target.value })} onBlur={commit} style={cell} />
                  <span>/</span>
                  <select value={r.per} title={t('mat.per')} onChange={e => { const list = rates.map((x, j) => (j === i ? { ...x, per: e.target.value as PlanMaterial['per'] } : x)); void saveRates(taskScope.id, list) }} style={cell}>
                    <option value="m2">m²</option><option value="m">m</option><option value="un">{t('mat.perLine')}</option>
                  </select>
                  <input type="number" min={0} step="any" value={r.waste || ''} placeholder="%" title={t('mat.waste')} onChange={e => upd(i, { waste: Number(e.target.value) })} onBlur={commit} style={cell} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 4, alignItems: 'center', fontSize: 11, color: '#6b8089' }}>
                  <input type="number" min={0} step="any" value={r.packSize || ''} placeholder={t('mat.packSize')} title={t('mat.packSize')} onChange={e => upd(i, { packSize: Number(e.target.value) || null })} onBlur={commit} style={cell} />
                  <input value={r.packName || ''} placeholder={t('mat.packName')} title={t('mat.packName')} onChange={e => upd(i, { packName: e.target.value || null })} onBlur={commit} style={cell} />
                </div>
              </div>)}
              <button type="button" onClick={() => void saveRates(taskScope.id, [...rates, { name: '', unit: '', per: 'm2', coef: 0, waste: 0, packSize: null, packName: null }])} style={{ justifySelf: 'start', border: 0, background: 'transparent', padding: 0, color: '#0b7f75', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>+ {t('mat.addRate')}</button>
            </div>
          })()}
          <div style={{ display: 'grid', gap: 8, padding: '10px', border: '1px solid #cfe9e5', borderRadius: 8, background: '#f7fcfb' }}>
            <div style={paneTitle}>{t('field.title')}</div>
            {(['location', 'activity'] as FieldKind[]).map(kind => {
              const st = fieldState(kind)
              const busy = fieldBusy?.startsWith(`${kind}:`)
              return <div key={kind} style={{ display: 'grid', gap: 5, padding: '8px', background: '#fff', border: '1px solid #e5edef', borderRadius: 7 }}>
                <b style={{ fontSize: 12, color: '#173441' }}>{kind === 'location' ? t('field.kindLocation', { location: taskLocation.name }) : t('field.kindActivity', { code: taskScope.scope_code || '' })}</b>
                <span style={{ fontSize: 11, color: st.changed ? '#b45309' : '#6b8089' }}>
                  {!st.last ? t('field.notIssued') : st.changed ? t('field.changedSince', { rev: st.last.revision }) : t('field.upToDate', { rev: st.last.revision, date: new Date(st.last.issued_at).toLocaleDateString(language) })}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" disabled={!!fieldBusy || !st.lines.length} onClick={() => openReport(kind)} style={{ height: 28, padding: '0 10px', border: '1px solid #cddcdf', borderRadius: 6, background: '#fff', color: '#173441', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', opacity: !st.lines.length ? 0.5 : 1 }}>{fieldBusy === `${kind}:preview` ? t('field.working') : t('field.preview')}</button>
                  <button type="button" disabled={!!fieldBusy || !st.lines.length || (!!st.last && !st.changed)} onClick={() => openReport(kind)} style={{ height: 28, padding: '0 10px', border: 0, borderRadius: 6, background: '#109d91', color: '#fff', fontSize: 11.5, fontWeight: 800, cursor: 'pointer', opacity: (!st.lines.length || (!!st.last && !st.changed)) ? 0.45 : 1 }}>{busy && fieldBusy?.endsWith('issue') ? t('field.working') : t('field.issue', { rev: st.next })}</button>
                </div>
              </div>
            })}
            {fieldIssues.some(i => i.location_id === taskLocationId) && <div style={{ display: 'grid', gap: 3 }}>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#6b8089', textTransform: 'uppercase', letterSpacing: '.05em' }}>{t('field.history')}</span>
              {fieldIssues.filter(i => i.location_id === taskLocationId).map(i => {
                const sc = i.scope_item_id ? taskScopes.find(x => x.id === i.scope_item_id) : null
                return <button key={i.id} type="button" onClick={() => void downloadIssue(i)} title={t('field.download')} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, padding: '4px 6px', border: 0, borderRadius: 5, background: 'transparent', fontSize: 11, color: '#294955', cursor: 'pointer', textAlign: 'left' }}>
                  <span><b>Rev {i.revision}</b> · {i.kind === 'location' ? t('field.allShort') : sc?.scope_code || '—'}</span>
                  <span style={{ color: '#6b8089' }}>{new Date(i.issued_at).toLocaleDateString(language)}{i.issued_by_name ? ` · ${i.issued_by_name}` : ''} ↓</span>
                </button>
              })}
            </div>}
          </div>
          {taskOthers.length > 0 && <div>
            <div style={paneTitle}>{t('task.panel.others')}</div>
            <div style={{ marginTop: 6, display: 'grid', gap: 3 }}>
              {taskOthers.map(({ l, q }) => <button key={l.id} type="button" onClick={() => { setTaskLocationId(l.id); setTaskFrameTick(n => n + 1) }} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', border: 0, borderRadius: 6, background: '#f4f7f8', fontSize: 12, color: '#42636f', cursor: 'pointer' }}><span>{l.name}</span><b>{fmtQty(q)} {taskScope.unit || ''}</b></button>)}
            </div>
          </div>}
        </>}
      </>}
    </div>
  )

  const zoningRight = selectedZone ? (
    <ZoneProperties
      key={selectedZone.id}
      zone={selectedZone}
      ptPerM={ptPerM}
      items={sourceItems}
      projectId={projectId}
      zones={zones}
      levels={levels}
      sources={sources}
      onSaved={async msg => { await load(); setStatus(msg) }}
      onDelete={() => void deleteZone(selectedZone)}
    />
  ) : (
    <div style={{ padding: 14 }}>
      <div style={paneTitle}>{t('zone.properties')}</div>
      <div style={{ ...ui.small, marginTop: 10, lineHeight: 1.5 }}>{t('zone.selectHint')}</div>
    </div>
  )

  const fullPage = section === 'estimating' ? (
    <ProjectPurchases projectId={projectId} />
  ) : section === 'settings' ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {(licensed ? (['project', 'walltypes', 'ceilingtypes', 'floortypes', 'recipes', 'materials'] as const) : (['project'] as const)).map(tab => (
          <button key={tab} type="button" style={chipBtn(settingsTab === tab)} onClick={() => setSettingsTab(tab)}>{t(settingsKey[tab])}</button>
        ))}
      </div>
      {settingsTab === 'project' && <SettingsPanel projectId={projectId} onChanged={load} framingLocked={!licensed} />}
      {settingsTab === 'walltypes' && <WallTypesLibrary projectId={projectId} projectCountry={country} onChanged={load} />}
        {settingsTab === 'ceilingtypes' && <SurfaceTypesLibrary key="ceiling" family={CEILING_FAMILY} projectId={projectId} projectCountry={country} onChanged={load} />}
        {settingsTab === 'floortypes' && <SurfaceTypesLibrary key="floor" family={FLOOR_FAMILY} projectId={projectId} projectCountry={country} onChanged={load} />}
      {settingsTab === 'recipes' && <RecipesEditor onChanged={load} />}
      {settingsTab === 'materials' && <MaterialsCatalog projectCountry={country} onChanged={load} />}
    </div>
  ) : null

  const menuPanel = (items: { label: string; onClick: () => void; disabled?: boolean; checked?: boolean }[]) => (
    <div style={dropdown} onClick={e => e.stopPropagation()}>
      {items.map(it => (
        <button key={it.label} type="button" disabled={it.disabled} style={{ ...dropdownItem, opacity: it.disabled ? 0.4 : 1 }} onClick={() => { setMenu(null); it.onClick() }}>
          <span style={{ width: 14, display: 'inline-block' }}>{it.checked ? '✓' : ''}</span>{it.label}
        </button>
      ))}
    </div>
  )

  const lockedPanel = (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 0, padding: 20 }}>
      <div style={{ maxWidth: 480, background: '#fff', border: '1px solid #dfe7ea', borderRadius: 12, padding: 24, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        <div style={{ fontSize: 30 }}>🔒</div>
        <strong style={{ fontSize: 17, color: '#173441' }}>{t('license.lockedTitle', { feature: t(section === 'estimating' ? 'header.estimating' : 'header.takeoff') })}</strong>
        <div style={{ fontSize: 12, color: '#536d78', lineHeight: 1.5 }}>{t('license.lockedBody')}</div>
        <button type="button" style={ui.button} onClick={() => setSection('zoning')}>{t('license.toZoning')}</button>
      </div>
    </div>
  )

  const workspace = (
    <div style={{ position: 'fixed', inset: 0, background: '#f4f7f8', display: 'grid', gridTemplateRows: `56px 56px ${toolbarShown ? '58px ' : ''}minmax(0,1fr) 30px` }} onClick={() => setMenu(null)}>
      {/* RITSUFLOW HEADER (standard, compact) */}
      <AppBar module="ritsuscope" compact standalone title={project.name} />
      {/* EDITOR TOOLS */}
      <header style={headerBar}>
        {section === 'tasks' ? (
          // Tarefas: straight back to Projects › Locations › Scope allocation (that activity, re-split with the new drawing).
          <a href={backToAllocation} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 14px', borderRadius: 8, background: '#109d91', color: '#fff', textDecoration: 'none', fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap' }} title={t('task.panel.back')}>
            ← {t('task.panel.back')}
          </a>
        ) : (
          <Link href="/ritsuscope" style={{ display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', color: '#0b7f75', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }} title={t('workspace.back')}>
            ← {t('workspace.back')}
          </Link>
        )}
        <span style={vRule} />
        <strong style={{ fontSize: 15, color: '#173441', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 260 }}>{project.name}</strong>
        {project.project_code && <small style={codeChip}>{project.project_code}</small>}
        {project.stage === 'bid' && (
          <Link href={`/commercial/${projectId}`} style={{ ...codeChip, background: '#fff4e8', color: '#8a4413', textDecoration: 'none', fontWeight: 700 }}>
            ← {t('workspace.backToEstimate')}
          </Link>
        )}
        <span style={{ flex: 1 }} />
        <nav style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {modes.map(m => m.key === 'home' ? (
            <Link key={m.key} href="/ritsuscope" style={modeBtn(false)}><Icon name={m.icon} size={17} />{t(m.label)}</Link>
          ) : (
            <button key={m.key} type="button" style={modeBtn(section === m.key)} onClick={() => setSection(m.key as typeof section)}>
              <Icon name={m.icon} size={17} />{t(m.label)}{!licensed && (m.key === 'takeoff' || m.key === 'tasks' || m.key === 'estimating') ? <span title={t('license.locked')} style={{ fontSize: 11 }}>🔒</span> : null}
            </button>
          ))}
          <span style={vRule} />
          <div style={{ position: 'relative' }}>
            <button type="button" style={menuBtn(menu === 'edit')} onClick={e => { e.stopPropagation(); setMenu(m => (m === 'edit' ? null : 'edit')) }}>{t('header.edit')}<Icon name="chevron" size={13} /></button>
            {menu === 'edit' && menuPanel([
              { label: t('menu.undo'), onClick: () => run('undo'), disabled: !canvasMode || !isPdf },
              { label: t('menu.delete'), onClick: () => run('delete'), disabled: !canvasMode || !isPdf || (section === 'zoning' ? !selectedZoneId : !selectedElementId) },
              { label: t('menu.cancel'), onClick: () => run('cancel'), disabled: !canvasMode || !isPdf },
              { label: t('menu.select'), onClick: () => run('select'), disabled: !canvasMode || !isPdf },
            ])}
          </div>
          <div style={{ position: 'relative' }}>
            <button type="button" style={menuBtn(menu === 'view')} onClick={e => { e.stopPropagation(); setMenu(m => (m === 'view' ? null : 'view')) }}>{t('header.view')}<Icon name="chevron" size={13} /></button>
            {menu === 'view' && menuPanel([
              { label: t('view3d.tabPlan'), onClick: () => setViewMode('plan'), checked: viewMode === 'plan', disabled: !canvasMode },
              { label: licensed ? t('view3d.tab3d') : `🔒 ${t('view3d.tab3d')}`, onClick: () => setViewMode('3d'), checked: viewMode === '3d', disabled: !licensed || !canvasMode || !(ptPerM > 0) },
              { label: t('layout.leftPanel'), onClick: () => setLeftOpen(v => !v), checked: leftOpen, disabled: !canvasMode },
              { label: t('layout.rightPanel'), onClick: () => setRightOpen(v => !v), checked: rightOpen, disabled: !canvasMode },
              { label: t('menu.zoomIn'), onClick: () => run('zoomIn'), disabled: !isPdf },
              { label: t('menu.zoomOut'), onClick: () => run('zoomOut'), disabled: !isPdf },
              { label: t('menu.fit'), onClick: () => run('fit'), disabled: !isPdf },
            ])}
          </div>
        </nav>
        <span style={vRule} />
        <div style={{ position: 'relative' }}>
          <button type="button" style={{ ...menuBtn(menu === 'sheet'), border: '1px solid #d6e0e3', maxWidth: 260 }} onClick={e => { e.stopPropagation(); setMenu(m => (m === 'sheet' ? null : 'sheet')) }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedSource?.name || t('header.noSheet')}</span>
            <Icon name="chevron" size={13} />
          </button>
          {menu === 'sheet' && (
            <div style={{ ...dropdown, right: 0, left: 'auto', width: 320, maxHeight: '60vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
              <label style={{ ...dropdownItem, color: '#0d7f77', fontWeight: 800, cursor: busy ? 'default' : 'pointer' }}>
                <Icon name="upload" size={14} />{t('layout.upload')}
                <input type="file" accept={licensed ? '.pdf,.ifc,application/pdf' : '.pdf,application/pdf'} onChange={e => { setMenu(null); void handleUpload(e) }} disabled={busy} hidden />
              </label>
              {sources.length === 0 && <div style={{ ...ui.small, padding: 10 }}>{t('workspace.sources.empty')}</div>}
              {sources.map(source => {
                const active = source.id === selectedSourceId
                return (
                  <div key={source.id} style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 6, background: active ? '#e6f6f4' : 'transparent' }}>
                    <button type="button" style={{ ...dropdownItem, flex: 1, flexDirection: 'column', alignItems: 'flex-start', gap: 1 }} onClick={() => { setSelectedSourceId(source.id); setMenu(null) }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#173441' }}>{source.name}</span>
                      <span style={{ fontSize: 10, color: '#6b8089' }}>
                        {source.kind === 'pdf_page' ? t('workspace.source.pdfPage', { page: source.page_number ?? '—' }) : t('workspace.source.ifcStorey')}
                        {' · '}
                        {source.scale_pt_per_m ? t('workspace.source.scale', { scale: formatNumber(Number(source.scale_pt_per_m), 2) }) : t('workspace.source.notCalibrated')}
                        {(() => { const lv = source.kind === 'pdf_page' ? sheetLevel(source, levelById) : null; return lv ? ` · ${lv.name} ${lv.elevation >= 0 ? '+' : ''}${formatNumber(lv.elevation, 2)} m` : '' })()}
                        {source.kind === 'pdf_page' && originOf(source) ? ' · ⊕' : ''}
                      </span>
                    </button>
                    {active && <button type="button" title={t('source.delete')} style={{ ...dropdownItem, width: 30, color: '#c94a4a' }} onClick={() => { setMenu(null); void deleteSource(source) }}><Icon name="trash" size={14} /></button>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button type="button" style={{ ...menuBtn(menu === 'print'), border: '1px solid #d6e0e3', opacity: printSheets.length && !printing ? 1 : 0.45 }} disabled={section === 'tasks' ? !taskLocation : !printSheets.length || printing} title={t('print.title')} onClick={e => { e.stopPropagation(); if (section === 'tasks') { setMenu(null); openReport(); return } setMenu(m => (m === 'print' ? null : 'print')) }}>
            <Icon name="print" size={15} />{printing ? t('print.working') : t('print.button')}<Icon name="chevron" size={13} />
          </button>
          {menu === 'print' && (
            <div style={{ ...dropdown, right: 0, left: 'auto', width: 280 }} onClick={e => e.stopPropagation()}>
              {underlay3d.model.underlays.length + underlay3d.sheet.underlays.length > 0 && (
                <label title={t('print.underlayHint')} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', margin: '0 0 4px', borderBottom: '1px solid #e5ecee', fontSize: 11, fontWeight: 700, color: '#173441', cursor: 'pointer' }}>
                  <input type="checkbox" checked={printUnderlay} onChange={e => setPrintUnderlay(e.target.checked)} style={{ margin: 0 }} />
                  {t('print.underlay')}
                </label>
              )}
              {(['locations', 'walls', 'floor', 'ceiling', 'slab', 'mep', 'struct', 'takeoff'] as PrintWhat[]).map(what => ({ what, locked: !licensed && what !== 'locations', empty: printEmpty(what) || (!licensed && what !== 'locations') })).map(o => (
                <button
                  key={o.what}
                  type="button"
                  disabled={o.empty}
                  style={{ ...dropdownItem, flexDirection: 'column', alignItems: 'flex-start', gap: 1, opacity: o.empty ? 0.45 : 1, cursor: o.empty ? 'default' : 'pointer', ...(o.what === 'takeoff' ? { borderTop: '1px solid #e5ecee', marginTop: 4, paddingTop: 8 } : {}) }}
                  onClick={() => { setMenu(null); void printSheet(o.what) }}
                >
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#173441' }}>{t(`print.menu.${o.what}` as TakeoffMessageKey)}</span>
                  <span style={{ fontSize: 10, color: '#6b8089' }}>{o.locked ? `🔒 ${t('license.locked')}` : o.empty ? t('print.menuEmpty') : t(`print.menu.${o.what}.hint` as TakeoffMessageKey)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="button" style={{ ...menuBtn(false), border: '1px solid #d6e0e3', opacity: licensed && ptPerM > 0 ? 1 : 0.45 }} disabled={!licensed || !(ptPerM > 0)} title={licensed ? t('share.title') : t('license.locked')} onClick={e => { e.stopPropagation(); setShareOpen(true) }}>
          <Icon name="share" size={15} />{t('share.button')}
        </button>
        {country && <small style={codeChip} title={t('walltype.country')}>{COUNTRIES.find(c => c.code === country)?.name[language] || country}</small>}
      </header>

      {toolbarShown && (
        <div style={{ display: 'flex', alignItems: 'stretch', height: 58, minWidth: 0, background: '#fff', borderBottom: '1px solid #dfe7ea' }}>
          <div ref={setToolbarSlot} style={{ flex: 1, minWidth: 0 }} />
          {levelSelector}
        </div>
      )}

      {/* MAIN */}
      {lockedSection ? lockedPanel : canvasMode ? (
        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `${leftOpen ? '290px ' : ''}minmax(0,1fr)${rightOpen ? ' 340px' : ''}`, minHeight: 0 }}>
          {/* Quick tab on the right panel's edge: hide / show it. */}
          <button
            type="button"
            onClick={() => setRightOpen(v => !v)}
            title={t(rightOpen ? 'layout.hideRight' : 'layout.showRight')}
            aria-label={t(rightOpen ? 'layout.hideRight' : 'layout.showRight')}
            style={{ position: 'absolute', zIndex: 30, top: '50%', right: rightOpen ? 340 : 0, transform: 'translateY(-50%)', width: 16, height: 56, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #cfdcdf', borderRight: 0, borderRadius: '8px 0 0 8px', background: '#fff', color: '#0d7f77', cursor: 'pointer', boxShadow: '-2px 0 6px rgba(15,35,45,.08)' }}
          >
            <Icon name="chevron" size={14} style={{ transform: `rotate(${rightOpen ? -90 : 90}deg)` }} />
          </button>
          {leftOpen && <aside style={sidePane}>{section === 'zoning' ? zoningLeft : section === 'tasks' ? tasksLeft : takeoffLeft}</aside>}
          <main style={{ position: 'relative', minWidth: 0, minHeight: 0, padding: (isPdf && viewMode === 'plan') ? 0 : 10 }}>
            {(error || status) && (
              <div style={{ position: 'absolute', zIndex: 5, right: 12, top: 12, maxWidth: 420, ...(error ? ui.error : { padding: 8, borderRadius: 6, background: '#fff', border: '1px solid #dfe7ea', fontSize: 11, color: '#294955' }) }}>
                {error || status}
                <button type="button" style={{ marginLeft: 8, border: 0, background: 'transparent', cursor: 'pointer' }} onClick={() => { setError(''); setStatus('') }}>×</button>
              </div>
            )}
            {(section === 'zoning' || section === 'tasks') && !isPdf ? <div style={{ ...ui.viewer, height: '100%' }}>{t('zone.pdfOnly')}</div> : viewer}
          </main>
          {rightOpen && <aside style={{ ...sidePane, borderRight: 0, borderLeft: '1px solid #dfe7ea' }}>{section === 'zoning' ? zoningRight : section === 'tasks' ? tasksRight : takeoffRight}</aside>}
        </div>
      ) : (
        <div style={{ minHeight: 0, overflow: 'auto', padding: 20 }}>
          <div style={{ background: '#fff', border: '1px solid #dfe7ea', borderRadius: 10, padding: 18 }}>{fullPage}</div>
        </div>
      )}

      {/* FOOTER */}
      <footer style={footerBar}>
        <span>
          {selectedSource
            ? ptPerM > 0
              ? t('footer.scale', { ratio: ratio ? formatNumber(Math.round(ratio), 0) : '—', ptm: formatNumber(ptPerM, 2) })
              : t('workspace.source.notCalibrated')
            : ''}
        </span>
        {isPdf && canvasMode && <><span style={{ color: '#c4d0d4' }}>|</span><CursorReadout sink={cursorSink} ptPerM={ptPerM} origin={sheetOrigin} fmt={v => formatNumber(v, 2)} label={t(sheetOrigin ? 'footer.cursorOrigin' : 'footer.cursor')} /></>}
        {toolbarShown && canvasMode
          ? <span ref={setStatusSlot} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, marginLeft: 8, overflow: 'hidden' }} />
          : <span style={{ flex: 1 }} />}
        {isPdf && canvasMode && viewMode === 'plan' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {selectedSource && (
              <label title={t('fade.hint')} style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 10, fontWeight: 700, color: '#294955' }}>
                {t('fade.label')}
                <input type="range" min={0} max={80} step={10} value={Math.round(backgroundFade * 100)} onChange={e => setBackgroundFade(Number(e.target.value) / 100)} style={{ width: 80, accentColor: '#109d91' }} />
                <span style={{ minWidth: 28, textAlign: 'right', fontWeight: 600 }}>{Math.round(backgroundFade * 100)}%</span>
              </label>
            )}
            <span ref={setFooterSlot} style={{ display: 'flex', alignItems: 'center', gap: 14, marginRight: 8 }} />
            <span style={{ minWidth: 40, textAlign: 'right' }}>{Math.round(zoom * 100)}%</span>
            <button type="button" style={footBtn} onClick={() => run('zoomOut')}>–</button>
            <button type="button" style={footBtn} onClick={() => run('zoomIn')}>+</button>
            <button type="button" style={{ ...footBtn, width: 'auto', padding: '0 8px' }} onClick={() => run('fit')}>{t('tool.fit')}</button>
          </span>
        )}
      </footer>
    </div>
  )

  return (
    <>
      {workspace}
      {copyFromId && sources.find(s => s.id === copyFromId) && (
        <CopyToLevelsDialog
          from={sources.find(s => s.id === copyFromId)!}
          levels={levels}
          sources={sources}
          layers={layers}
          elements={elements}
          zones={zones}
          checkedItemIds={checkedIds}
          zonesOnly={section === 'zoning' || !licensed}
          onClose={() => setCopyFromId(null)}
          onDone={async message => { await load(); setStatus(message) }}
        />
      )}
      {deleteLevelsOpen && checkedIds.length > 0 && (
        <DeleteFromLevelsDialog
          itemIds={checkedIds}
          defaultLevelId={selectedSource?.level_id && levels.some(l => l.id === selectedSource.level_id) ? masterOf(levels.find(l => l.id === selectedSource.level_id)!, new Map<string, LevelRow>(levels.map(l => [l.id, l] as [string, LevelRow]))).id : ''}
          levels={levels}
          sources={sources}
          layers={layers}
          elements={elements}
          onClose={() => setDeleteLevelsOpen(false)}
          onDone={async message => { await load(); setStatus(message) }}
        />
      )}
      {generateOpen && <GenerateLevelsDialog projectId={projectId} levels={levels} onClose={() => setGenerateOpen(false)} onDone={async message => { await load(); setStatus(message) }} />}
      {reportOpen && !areaPicking && section === 'tasks' && taskLocation && (() => {
        const cfg = reportCfg
        const set = (patch: Partial<ReportCfg>) => setReportCfg(c => ({ ...c, ...patch }))
        const setShow = (key: keyof ReportCfg['show'], v: boolean) => setReportCfg(c => ({ ...c, show: { ...c.show, [key]: v } }))
        const st = fieldState(cfg.kind)
        const areaSheet = cfg.area ? sources.find(x => x.id === cfg.area!.sourceId) : null
        const areaK = Number(areaSheet?.scale_pt_per_m) || 0
        const areaText = cfg.area && areaK > 0 ? t('report.area.size', { w: formatNumber((cfg.area.box[2] - cfg.area.box[0]) / areaK, 2), h: formatNumber((cfg.area.box[3] - cfg.area.box[1]) / areaK, 2), sheet: areaSheet?.name || '' }) : t('report.area.none')
        const lbl = { display: 'grid', gap: 4, fontSize: 11, fontWeight: 700, color: '#42636f' } as const
        const inp = { height: 32, padding: '0 8px', border: '1px solid #cddcdf', borderRadius: 6, fontSize: 13, fontFamily: 'inherit' } as const
        const check = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#294955', cursor: 'pointer' } as const
        const radio = (on: boolean) => ({ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', border: '1px solid ' + (on ? '#109d91' : '#e0e8ea'), borderRadius: 8, background: on ? '#f0faf8' : '#fff', cursor: 'pointer', fontSize: 12, color: '#294955' }) as const
        const sectionTitle = { fontSize: 10.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6b8089', marginTop: 4 } as const
        const canIssue = st.lines.length > 0 && (!st.last || st.changed)
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(6,38,55,.45)', display: 'grid', placeItems: 'center', padding: 16 }} onMouseDown={e => { if (e.target === e.currentTarget && !fieldBusy) setReportOpen(false) }}>
            <div role="dialog" aria-modal="true" style={{ width: 'min(760px, 100%)', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: 12, boxShadow: '0 24px 70px rgba(6,38,55,.3)', overflow: 'hidden' }}>
              <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '14px 18px', borderBottom: '1px solid #e5edef' }}>
                <div><div style={{ fontSize: 17, fontWeight: 800, color: '#173441' }}>{t('report.title')}</div><div style={{ fontSize: 12, color: '#6b8089', marginTop: 2 }}>{t('report.subtitle', { location: taskLocation.name })}</div></div>
                <button type="button" onClick={() => setReportOpen(false)} aria-label={t('report.cancel')} style={{ border: 0, background: 'transparent', fontSize: 20, color: '#6b8089', cursor: 'pointer' }}>×</button>
              </header>
              <div style={{ overflow: 'auto', padding: '14px 18px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
                <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                  <div style={sectionTitle}>{t('report.content')}</div>
                  <label style={radio(cfg.kind === 'location')}><input type="radio" checked={cfg.kind === 'location'} onChange={() => set({ kind: 'location' })} style={{ marginTop: 2 }} /><span><b>{t('field.kindLocation', { location: taskLocation.name })}</b></span></label>
                  <label style={{ ...radio(cfg.kind === 'activity'), opacity: taskScope ? 1 : 0.5 }}><input type="radio" disabled={!taskScope} checked={cfg.kind === 'activity'} onChange={() => set({ kind: 'activity' })} style={{ marginTop: 2 }} /><span><b>{taskScope ? t('field.kindActivity', { code: taskScope.scope_code || '' }) : t('report.pickActivity')}</b>{taskScope ? <><br /><span style={{ color: '#6b8089' }}>{taskScope.scope_name}</span></> : null}</span></label>

                  <div style={sectionTitle}>{t('report.area')}</div>
                  <label style={{ ...radio(cfg.areaMode === 'location'), opacity: taskZone ? 1 : 0.5 }}><input type="radio" disabled={!taskZone} checked={cfg.areaMode === 'location'} onChange={() => set({ areaMode: 'location' })} style={{ marginTop: 2 }} />
                    <span style={{ display: 'grid', gap: 6 }}><b>{t('report.area.location')}</b>{!taskZone ? <span style={{ color: '#8a4b0f' }}>{t('task.panel.noZone', { location: taskLocation.name })}</span> : <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{t('report.area.margin')}<input type="number" min={0} max={20} step={0.5} value={cfg.marginM} onChange={e => set({ marginM: Math.max(0, Number(e.target.value) || 0) })} style={{ ...inp, width: 70, height: 26 }} /> m</span>}</span>
                  </label>
                  <label style={radio(cfg.areaMode === 'custom')}><input type="radio" checked={cfg.areaMode === 'custom'} onChange={() => set({ areaMode: 'custom' })} style={{ marginTop: 2 }} />
                    <span style={{ display: 'grid', gap: 6 }}><b>{t('report.area.custom')}</b><span style={{ color: '#6b8089' }}>{areaText}</span>
                      <button type="button" onClick={e => { e.preventDefault(); set({ areaMode: 'custom' }); setAreaPicking(true) }} style={{ justifySelf: 'start', height: 28, padding: '0 10px', border: '1px solid #2563EB', borderRadius: 6, background: '#eff5ff', color: '#1d4ed8', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{cfg.area ? t('report.area.redraw') : t('report.area.draw')}</button>
                    </span>
                  </label>
                  <label style={radio(cfg.areaMode === 'sheet')}><input type="radio" checked={cfg.areaMode === 'sheet'} onChange={() => set({ areaMode: 'sheet' })} style={{ marginTop: 2 }} /><span><b>{t('report.area.sheet')}</b></span></label>

                  <div style={sectionTitle}>{t('report.paper')}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['A4', 'A3'] as const).map(p => <label key={p} style={{ ...radio(cfg.paper === p), flex: 1 }}><input type="radio" checked={cfg.paper === p} onChange={() => set({ paper: p })} /><b>{p}</b><span style={{ color: '#6b8089' }}>{t('report.landscape')}</span></label>)}
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 8, alignContent: 'start' }}>
                  <div style={sectionTitle}>{t('report.include')}</div>
                  <div style={{ display: 'grid', gap: 6, padding: '8px 10px', border: '1px solid #e0e8ea', borderRadius: 8 }}>
                    {([['estimate', 'report.show.estimate'], ['openings', 'report.show.openings'], ['tags', 'report.show.tags'], ['table', 'report.show.table'], ['detail', 'report.show.detail'], ['qr', 'report.show.qr'], ['materials', 'report.show.materials'], ['materialSummary', 'report.show.materialSummary']] as [keyof ReportCfg['show'], TakeoffMessageKey][]).map(([key, label]) => (
                      <label key={key} style={{ ...check, opacity: (key === 'openings' && !cfg.show.estimate) || (key === 'detail' && !cfg.show.table) || (key === 'qr' && !taskLocation.qr_token) ? 0.5 : 1 }}>
                        <input type="checkbox" checked={cfg.show[key]} disabled={(key === 'openings' && !cfg.show.estimate) || (key === 'detail' && !cfg.show.table)} onChange={e => setShow(key, e.target.checked)} />{t(label)}{key === 'qr' && !taskLocation.qr_token ? ` · ${t('report.noQr')}` : ''}
                      </label>
                    ))}
                  </div>
                  <div style={sectionTitle}>{t('report.header')}</div>
                  <label style={lbl}>{t('report.customTitle')}<input value={cfg.title} placeholder={taskLocation.name} onChange={e => set({ title: e.target.value })} style={inp} /></label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <label style={lbl}>{t('report.responsible')}<input value={cfg.responsible} onChange={e => set({ responsible: e.target.value })} style={inp} /></label>
                    <label style={lbl}>{t('report.crew')}<input value={cfg.crew} onChange={e => set({ crew: e.target.value })} style={inp} /></label>
                    <label style={lbl}>{t('report.start')}<input type="date" value={cfg.start} onChange={e => set({ start: e.target.value })} style={inp} /></label>
                    <label style={lbl}>{t('report.end')}<input type="date" value={cfg.end} onChange={e => set({ end: e.target.value })} style={inp} /></label>
                  </div>
                  <label style={lbl}>{t('report.notes')}<textarea rows={3} value={cfg.notes} onChange={e => set({ notes: e.target.value })} style={{ ...inp, height: 'auto', padding: 8, resize: 'vertical' }} /></label>
                </div>
              </div>
              <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 18px', borderTop: '1px solid #e5edef', background: '#f7fafb', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, color: st.changed ? '#b45309' : '#6b8089' }}>{!st.lines.length ? t('field.nothing') : !st.last ? t('field.notIssued') : st.changed ? t('field.changedSince', { rev: st.last.revision }) : t('field.upToDate', { rev: st.last.revision, date: new Date(st.last.issued_at).toLocaleDateString(language) })}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" onClick={() => setReportOpen(false)} disabled={!!fieldBusy} style={{ height: 34, padding: '0 14px', border: '1px solid #cddcdf', borderRadius: 8, background: '#fff', color: '#173441', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('report.cancel')}</button>
                  <button type="button" onClick={() => void previewFieldSheet(cfg.kind)} disabled={!!fieldBusy || !st.lines.length || (cfg.areaMode === 'custom' && !cfg.area)} style={{ height: 34, padding: '0 14px', border: '1px solid #109d91', borderRadius: 8, background: '#fff', color: '#0b7f75', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: !st.lines.length ? 0.5 : 1 }}>{fieldBusy?.endsWith('preview') ? t('field.working') : t('report.preview')}</button>
                  <button type="button" onClick={() => void issueFieldSheet(cfg.kind)} disabled={!!fieldBusy || !canIssue || (cfg.areaMode === 'custom' && !cfg.area)} style={{ height: 34, padding: '0 14px', border: 0, borderRadius: 8, background: '#109d91', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', opacity: canIssue ? 1 : 0.45 }}>{fieldBusy?.endsWith('issue') ? t('field.working') : t('field.issue', { rev: st.next })}</button>
                </div>
              </footer>
            </div>
          </div>
        )
      })()}
      {shareOpen && (
        <ShareDialog
          projectId={projectId}
          defaultTitle={`${project.name} · 3D`}
          makeSnapshot={makeSnapshot}
          onClose={() => setShareOpen(false)}
        />
      )}
      {assignFor && (
        <WallTypePicker
          projectId={projectId}
          projectCountry={country}
          layerCount={layers.length}
          framingDefaults={framingDefaults}
          onClose={() => setAssignFor(null)}
          onOpenLibrary={() => { setAssignFor(null); setSection('settings'); setSettingsTab('walltypes') }}
          onCreated={() => setAssignFor(null)}
          assign={{
            itemName: layers.find(l => l.id === assignFor.layerId)?.name || '',
            wallCount: elements.filter(el => el.layer_id === assignFor.layerId).length,
            onAssign: assignWallType,
          }}
        />
      )}
      {surfaceAssign && (
        <SurfaceTypePicker
          key={`assign-${surfaceAssign.family}`}
          family={FAMILIES[surfaceAssign.family]}
          projectId={projectId}
          projectCountry={country}
          layerCount={layers.length}
          defaultHeight={Number(layers.find(l => l.id === surfaceAssign.layerId)?.elevation_m) || 0}
          onClose={() => setSurfaceAssign(null)}
          onOpenLibrary={() => { setSettingsTab(surfaceAssign.family === 'ceiling' ? 'ceilingtypes' : 'floortypes'); setSurfaceAssign(null); setSection('settings') }}
          onCreated={() => setSurfaceAssign(null)}
          assign={{
            itemName: layers.find(l => l.id === surfaceAssign.layerId)?.name || '',
            count: elements.filter(el => el.layer_id === surfaceAssign.layerId).length,
            onAssign: assignSurfaceType,
          }}
        />
      )}
      {surfacePicker && (
        <SurfaceTypePicker
          key={surfacePicker}
          family={FAMILIES[surfacePicker]}
          projectId={projectId}
          projectCountry={country}
          layerCount={layers.length}
          // Ceilings just below the walls drawn so far (2,60 m when there are none), like the Ceiling tool; floors at 0.
          defaultHeight={FAMILIES[surfacePicker].defaultHeight(Math.max(0, ...sourceItems.filter(it => it.kind === 'linear').map(it => it.height || 0)))}
          onClose={() => setSurfacePicker(null)}
          onOpenLibrary={() => { setSettingsTab(surfacePicker === 'ceiling' ? 'ceilingtypes' : 'floortypes'); setSurfacePicker(null); setSection('settings') }}
          onCreated={async layerId => {
            const fam = FAMILIES[surfacePicker]
            setSurfacePicker(null)
            await load()
            setActiveLayerId(layerId)
            setDrawRequest(n => n + 1)
            setStatus(t(fam.msg.itemCreated))
          }}
        />
      )}
      {pickerOpen && (
        <WallTypePicker
          projectId={projectId}
          projectCountry={country}
          layerCount={layers.length}
          framingDefaults={framingDefaults}
          onClose={() => setPickerOpen(false)}
          onOpenLibrary={() => { setPickerOpen(false); setSection('settings'); setSettingsTab('walltypes') }}
          onCreated={async layerId => {
            setPickerOpen(false)
            await load()
            setActiveLayerId(layerId)
            setDrawRequest(n => n + 1)
            setStatus(t('walltype.itemCreated'))
          }}
        />
      )}
    </>
  )
}

/** Cursor position in metres; updates itself so moving the mouse doesn't re-render the page. */
function CursorReadout({ sink, ptPerM, origin, fmt, label }: { sink: { current: ((p: Vec2 | null) => void) | null }; ptPerM: number; origin: SheetOrigin | null; fmt: (v: number) => string; label: string }) {
  const [p, setP] = useState<Vec2 | null>(null)
  useEffect(() => {
    sink.current = setP
    return () => { sink.current = null }
  }, [sink])
  if (!p || !(ptPerM > 0)) return <span>{label} —</span>
  // From the origin when there is one (Y up, as in CAD); otherwise from the sheet's top-left corner.
  const m = origin ? sheetToModel(p, origin, ptPerM) : ([p[0] / ptPerM, p[1] / ptPerM] as Vec2)
  const y = origin ? -m[1] : m[1]
  return <span>{label} X {fmt(m[0])} m&nbsp;&nbsp;Y {fmt(y)} m</span>
}

const settingsKey = {
  project: 'layout.section.settings',
  walltypes: 'layout.section.walltypes',
  ceilingtypes: 'layout.section.ceilingtypes',
  floortypes: 'layout.section.floortypes',
  recipes: 'layout.section.recipes',
  materials: 'layout.section.materials',
} as const satisfies Record<string, TakeoffMessageKey>

const paneTitle = { fontSize: 11, fontWeight: 800, color: '#173441', textTransform: 'uppercase', letterSpacing: '.06em' } as const
const headerBar = { display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: '#fff', borderBottom: '1px solid #dfe7ea', minWidth: 0 } as const
const vRule = { width: 1, height: 26, background: '#e2eaed' } as const
const codeChip = { padding: '3px 8px', borderRadius: 6, background: '#eef3f4', border: '1px solid #dfe7ea', color: '#42636f', fontSize: 11, whiteSpace: 'nowrap' } as const
const modeBtn = (on: boolean) => ({
  display: 'flex', alignItems: 'center', gap: 6, height: 36, padding: '0 12px', border: 0, borderRadius: 8, textDecoration: 'none',
  background: on ? '#109d91' : 'transparent', color: on ? '#fff' : '#294955', fontSize: 13, fontWeight: on ? 700 : 600, cursor: 'pointer', whiteSpace: 'nowrap',
}) as const
const menuBtn = (on: boolean) => ({ display: 'flex', alignItems: 'center', gap: 4, height: 34, padding: '0 10px', border: 0, borderRadius: 8, background: on ? '#eef3f4' : 'transparent', color: '#294955', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }) as const
const dropdown = { position: 'absolute', top: 40, left: 0, zIndex: 50, display: 'flex', flexDirection: 'column', minWidth: 200, padding: 6, background: '#fff', border: '1px solid #dfe7ea', borderRadius: 10, boxShadow: '0 10px 30px rgba(15,35,45,.16)' } as const
const dropdownItem = { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 0, borderRadius: 6, background: 'transparent', fontSize: 12, color: '#294955', cursor: 'pointer', textAlign: 'left' } as const
const sidePane = { minHeight: 0, minWidth: 0, overflow: 'hidden', background: '#fff', borderRight: '1px solid #dfe7ea' } as const
const footerBar = { display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', background: '#eef3f4', borderTop: '1px solid #dfe7ea', fontSize: 11, color: '#4b6570', whiteSpace: 'nowrap', overflow: 'hidden' } as const
const footBtn = { width: 24, height: 22, border: '1px solid #d3dfe2', borderRadius: 5, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#294955' } as const
const chipBtn = (on: boolean) => ({ display: 'flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', border: '1px solid ' + (on ? '#109d91' : '#d3dfe2'), borderRadius: 7, background: on ? '#109d91' : '#fff', color: on ? '#fff' : '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' }) as const
/** Item list group headers: the same type for every discipline and feature. */
const groupName = (level: 0 | 1) => ({ flex: 'none', fontSize: 10, fontWeight: 800, letterSpacing: level === 0 ? '.06em' : '.02em', textTransform: level === 0 ? 'uppercase' : 'none', color: level === 0 ? '#294955' : '#536d78' }) as const
const groupCount = { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 10, fontWeight: 600, letterSpacing: 0, textTransform: 'none', color: '#8aa0a8' } as const
