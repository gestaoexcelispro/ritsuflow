'use client'

import { createPortal } from 'react-dom'
import { FormEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import { parseLocaleNumber, scaleFromPoints } from '@/lib/takeoff/calibration'
import { dist, perimeter, polyArea, polyLen, shapeHeight, type ElementOpening, type LayerKind, type TakeoffItem, type Vec2 } from '@/lib/takeoff/geometry'
import { openingCentreAt, openingMarks } from '@/lib/takeoff/openingMarks'
import { addOpening, validateOpening } from '@/lib/takeoff/openings'
import { LAYER_PALETTE } from '@/lib/takeoff/ifc/importIfcModel'
import type { LayerRow, SourceRow } from '@/lib/takeoff/rows'
import { angleFromPoints, originOf } from '@/lib/takeoff/origin'
import { centrelineFromFace, joinToNeighbours, type NeighbourWall } from '@/lib/takeoff/faceWall'
import { areaRole } from '@/lib/takeoff/areaRole'
import { MEP_GROUPS, MEP_TYPES, mepType, type MepGroup } from '@/lib/takeoff/mep'
import { STRUCT_GROUPS, STRUCT_TYPES, structType } from '@/lib/takeoff/struct'
import { footprintFromWalls, roomsFromWalls } from '@/lib/takeoff/detect/roomsFromWalls'
import { KIND_COLOR, centroid, isMacroKind, nameFromTexts, nextZoneName, pointInPolygon, type SheetText, type ZoneKind, type ZoneRow } from '@/lib/takeoff/zones'
import { ui } from '../ui'
import PdfSheet from './PdfSheet'
import DetectPanel from './DetectPanel'
import Icon from './icons'
import { defaultLayerExcluded, type DetectedWall, type VSeg } from '@/lib/takeoff/detect/walls'
import { detectRooms, type DetectedRoom } from '@/lib/takeoff/detect/rooms'
import { findOpenings, placeOpenings, type PlannedOpening } from '@/lib/takeoff/detect/openings'
import { applyFramingDefaults, defaultFraming, framingLabelsPtBR, type FramingDefaults } from '@/lib/takeoff/framing/framing'
import { importLabelsEnUS } from '@/lib/takeoff/ifc/importIfcModel'
import { boxSelect } from '@/lib/takeoff/boxSelect'
import { TASK_BAND_M, faceFor } from '@/lib/takeoff/taskDrawings'

const BUCKET = 'takeoff-files'

type Mode = 'select' | 'calibrate' | 'draw' | 'measure' | 'detect' | 'origin'
/** Geometry drawn with the draw tool. */
type Shape = 'line' | 'rect' | 'polygon' | 'count'
export type WorkCommand = { name: 'undo' | 'delete' | 'cancel' | 'select' | 'zoomIn' | 'zoomOut' | 'fit'; n: number }
type Created = { table: 'takeoff_elements' | 'takeoff_zones' | 'location_task_drawings'; id: string }

/** Tasks mode: one scope item in one location (lines are measured and saved by the page). */
export type TaskDrawing = {
  /** Task lines of this item in this location on this sheet, as shapes `task:<id>` in `items`. */
  color: string
  /** Outline of the location's zone, drawn as a reference; null when it is on another sheet. */
  zone: { id: string; name: string; pts: Vec2[] } | null
  /** Room + 1 m to frame (sheet points), applied whenever `frameTick` changes or the sheet loads. */
  frame: [number, number, number, number] | null
  frameTick: number
  /** Band width of the chosen activity (m), for the side preview. */
  bandM?: number
}

type Props = {
  projectId: string
  source: SourceRow
  layers: LayerRow[]
  items: TakeoffItem[]
  onChanged: () => Promise<void> | void
  selectedId: string | null
  onSelect: (elementId: string | null) => void
  framingDefaults: FramingDefaults
  /** Active takeoff item (layer) for drawing; owned by the page so the item list can pick it. */
  activeLayerId: string | null
  onActiveLayerChange: (layerId: string | null) => void
  /** Incremented by the page to switch to the draw tool. */
  drawRequest: number
  /** Incremented by the page to open the new-item form. */
  newLayerRequest: number
  /** Takeoff (items), zoning (locations) or tasks (where each scope item is built, per location). */
  workMode: 'takeoff' | 'zoning' | 'tasks'
  task?: TaskDrawing | null
  /** Tasks mode: a finished line, as the face it lies against and its side; returns the saved row id (null on failure). */
  onTaskLine?: (face: Vec2[], side: 1 | -1) => Promise<string | null>
  /** Tasks mode, "take a wall": the stretch of the clicked wall along the room and its thickness (null when none). */
  onTaskPick?: (p: Vec2) => { a: Vec2; b: Vec2; thicknessM: number } | null
  zones: ZoneRow[]
  /** Kind given to zones drawn now (Block, Zone, Area, Room). */
  zoneKind?: ZoneKind
  selectedZoneId: string | null
  onSelectZone: (id: string | null) => void
  /** Incremented by the page to start drawing a new zone. */
  newZoneRequest: number
  /** Incremented by the page to detect rooms on this sheet. */
  detectRoomsRequest: number
  /** Edit / View menu commands from the header. */
  command: WorkCommand | null
  onZoomChange?: (zoom: number) => void
  onCursor?: (p: Vec2 | null) => void
  /** Placing an opening configured in the wall's properties: the next click on the plan sets its position. */
  openingPick?: { elementId: string; opening: Omit<ElementOpening, 'off' | 'guid'> } | null
  onOpeningPicked?: (message: string) => Promise<void> | void
  onOpeningPickCancel?: () => void
  /** The sheet's level from the levels list (replaces the level fields of the origin form). */
  levelLabel?: string | null
  /** Element (a full-width row under the header) to render the tool bar into; inline strip when absent. */
  toolbarSlot?: HTMLElement | null
  /** Quick buttons at the start of the tool bar (takeoff: add a wall, ceiling or floor type, or a new item). */
  quickActions?: { key: string; icon: string; label: string; title: string; onClick: () => void }[]
  /** Export buttons at the end of the tool bar (takeoff: CSV of the items). */
  exportActions?: { key: string; icon: string; label: string; title: string; onClick: () => void; disabled?: boolean }[]
  /** Spot in the footer (left of the zoom) that hosts the Snap and Ortho switches. */
  footerSlot?: HTMLElement | null
  /** Free stretch of the footer (between the cursor and the switches) for the tool hint and the active-item bar. */
  statusSlot?: HTMLElement | null
  /** Fade of the source drawing on this sheet (0…0.8). */
  backgroundFade?: number
}

const kindKey: Record<LayerKind, TakeoffMessageKey> = {
  linear: 'workspace.layer.linear',
  area: 'workspace.layer.area',
  count: 'workspace.layer.count',
}
const kindForShape: Record<Shape, LayerKind> = { line: 'linear', rect: 'area', polygon: 'area', count: 'count' }

/** Removes consecutive duplicates (a double-click adds the same point twice). */
function dedupe(points: Vec2[]): Vec2[] {
  return points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > 1)
}

export default function PdfWorkspace(props: Props) {
  const { projectId, source, layers, items, onChanged, selectedId, onSelect, framingDefaults, activeLayerId, onActiveLayerChange, drawRequest, newLayerRequest, workMode, zones, zoneKind = 'room', selectedZoneId, onSelectZone, newZoneRequest, detectRoomsRequest, command, onZoomChange, task = null, onTaskLine, onTaskPick, onCursor, openingPick = null, onOpeningPicked, onOpeningPickCancel, toolbarSlot = null, footerSlot = null, statusSlot = null, backgroundFade = 0, levelLabel = null, quickActions = [], exportActions = [] } = props
  const barH = toolbarSlot ? 0 : TOOLBAR_H
  const t = useTakeoffT()
  const { formatNumber, language } = useLanguage()
  const containerRef = useRef<HTMLDivElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  /** Point under the mouse when zooming with the wheel, so it stays under the mouse. */
  const zoomAnchor = useRef<{ mx: number; my: number; sx: number; sy: number; ratio: number } | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState(0.5)
  const [mode, setMode] = useState<Mode>('select')
  const [shape, setShape] = useState<Shape>('line')
  const [calPts, setCalPts] = useState<Vec2[]>([])
  const [calMeters, setCalMeters] = useState('')
  const [draft, setDraft] = useState<Vec2[]>([])
  const [measurePts, setMeasurePts] = useState<Vec2[]>([])
  const [measureDone, setMeasureDone] = useState(false)
  const [showNewLayer, setShowNewLayer] = useState(false)
  const [newLayer, setNewLayer] = useState({ name: '', kind: 'linear' as LayerKind, color: LAYER_PALETTE[0], height: '2,80', thickness: '' })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [snapOn, setSnapOn] = useState(true)
  /** Tag of each wall stretch on the sheet (DW01-03…). */
  const [tagsOn, setTagsOn] = useState(true)
  /** Tool bar: group captions always; button names hidden only when the labelled bar doesn't fit the width (they stay in the tooltips). */
  const barOuter = useRef<HTMLDivElement>(null)
  const barInner = useRef<HTMLDivElement>(null)
  const [barFullW, setBarFullW] = useState(0)
  const [barAvail, setBarAvail] = useState(Infinity)
  const compactBar = barFullW > barAvail
  useLayoutEffect(() => {
    // Measure the bar with labels (only while it shows them), and the room it has.
    if (!compactBar && barInner.current) setBarFullW(barInner.current.getBoundingClientRect().width)
  })
  useEffect(() => {
    const el = barOuter.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const cs = getComputedStyle(el)
      setBarAvail(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [toolbarSlot])
  // Labels change with the language: measure the labelled bar again.
  useEffect(() => { setBarFullW(0) }, [t])
  const [orthoOn, setOrthoOn] = useState(false)
  /** Line walls: draw the centreline, or a face and then click the side the wall goes. */
  const [placement, setPlacement] = useState<'face' | 'center'>('face')
  /** Things created in this session on this sheet, newest last (for undo). */
  const [created, setCreated] = useState<Created[]>([])
  /** Wall detection: page linework (null while reading), area box, suggestions and which ones are ticked. */
  const [vectors, setVectors] = useState<VSeg[] | null>(null)
  const [texts, setTexts] = useState<SheetText[]>([])
  const [regionPts, setRegionPts] = useState<Vec2[]>([])
  const [pickingRegion, setPickingRegion] = useState(false)
  const [suggestions, setSuggestions] = useState<DetectedWall[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  /** Box selection: elements picked, the drag in progress (client px) and the box drawn on screen. */
  const [boxSel, setBoxSel] = useState<string[]>([])
  const band = useRef<{ x: number; y: number; shift: boolean; active: boolean } | null>(null)
  const [bandRect, setBandRect] = useState<{ left: number; top: number; width: number; height: number; crossing: boolean } | null>(null)
  /** The click that ends a box drag must not change the selection. */
  const swallowClick = useRef(false)
  /** Room detection: suggested outlines, which are ticked, the door width closed, and whether it ran. */
  const [roomSugs, setRoomSugs] = useState<DetectedRoom[] | null>(null)
  const [roomPicked, setRoomPicked] = useState<Set<string>>(new Set())
  const [roomGap, setRoomGap] = useState('1,00')
  /** Doors/openings or windows found in the PDF, placed on the drawn walls, waiting for review. */
  const [openSugs, setOpenSugs] = useState<{ kind: 'doors' | 'windows'; planned: PlannedOpening[]; unplaced: number } | null>(null)
  const [openPicked, setOpenPicked] = useState<Set<string>>(new Set())
  /** Floor / ceiling / slab tool in use (draws areas on that category's item). */
  const [areaTool, setAreaTool] = useState<AreaToolKey | null>(null)
  /** Building services: the open menu (anchored under its button) and the type being placed. */
  const [mepMenu, setMepMenu] = useState<{ left: number; top: number; group: MepGroup } | null>(null)
  const [mepTool, setMepTool] = useState<string | null>(null)
  /** Concrete structure and foundations: the open menu and the type being drawn. */
  const [structMenu, setStructMenu] = useState<{ left: number; top: number } | null>(null)
  const [structTool, setStructTool] = useState<string | null>(null)
  /** Architecture: walls (detection), doors, windows, floor and ceiling, in one menu. */
  const [archMenu, setArchMenu] = useState<{ left: number; top: number } | null>(null)
  const [areaLayerId, setAreaLayerId] = useState<string | null>(null)
  /** Cursor while placing an opening by clicking (for the preview on the wall). */
  const [pickHover, setPickHover] = useState<Vec2 | null>(null)
  /** What limits a room: wall linework only (default) or every line on the sheet. */
  const [roomLimits, setRoomLimits] = useState<'walls' | 'all'>('walls')
  /** Room detection area: picking it (two clicks), the clicks so far, and the chosen box (null = whole page). */
  const [roomPicking, setRoomPicking] = useState(false)
  const [roomPickPts, setRoomPickPts] = useState<Vec2[]>([])
  const [roomRegion, setRoomRegion] = useState<[Vec2, Vec2] | null>(null)
  /** Origin tool: picked points (origin, then an optional point along a reference line) and the level form. */
  const [originPts, setOriginPts] = useState<Vec2[]>([])
  const [originForm, setOriginForm] = useState<{ level: string; elevation: string } | null>(null)

  const scale = source.scale_pt_per_m ? Number(source.scale_pt_per_m) : 0
  const activeLayer = layers.find(l => l.id === activeLayerId) || null
  const zoning = workMode === 'zoning'
  const tasksMode = workMode === 'tasks'
  /** Tasks mode: "take a wall" (one click adds the clicked wall's stretch along the room). */
  const [takeWall, setTakeWall] = useState(false)
  /** Tasks mode: the selected task line (`task:<id>`). */
  const [taskSel, setTaskSel] = useState<string | null>(null)
  /** Tasks mode, "take a wall": thickness (m) of the wall picked by the first click (the band starts at its face). */
  const [taskWallT, setTaskWallT] = useState(0)
  /** Bumped by every sheet load, so the tasks frame is applied once the page is there. */
  const [loadTick, setLoadTick] = useState(0)
  const sheetZones = useMemo(() => zones.filter(z => z.source_id === source.id), [zones, source.id])

  useEffect(() => { setBoxSel([]) }, [source.id, workMode])

  const clearTransient = () => { setDraft([]); setCalPts([]); setMeasurePts([]); setMeasureDone(false); setPickingRegion(false); setOriginPts([]); setOriginForm(null) }

  function chooseTool(next: Mode, nextShape?: Shape, take = false) {
    clearTransient()
    setTakeWall(take)
    setTaskSel(null)
    setBoxSel([])
    setOpenSugs(null)
    setAreaTool(null)
    setMepTool(null)
    setStructTool(null)
    setMode(next)
    if (nextShape) setShape(nextShape)
    setError('')
    if (next !== 'select') { onSelect(null); onSelectZone(null) }
    if (next === 'draw' && nextShape && !zoning && !tasksMode && (!activeLayer || activeLayer.kind !== kindForShape[nextShape])) {
      const fit = layers.filter(l => l.kind === kindForShape[nextShape])
      if (fit.length === 1) onActiveLayerChange(fit[0].id)
      else if (fit.length === 0) { setNewLayer(v => ({ ...v, kind: kindForShape[nextShape] })); setShowNewLayer(true) }
    }
  }

  // Requests from the item list: draw with the chosen item (the tool follows its kind).
  useEffect(() => {
    if (!drawRequest) return
    const layer = layers.find(l => l.id === activeLayerId)
    clearTransient()
    setMode('draw')
    if (layer) setShape(s => (layer.kind === 'linear' ? 'line' : layer.kind === 'count' ? 'count' : s === 'rect' ? 'rect' : 'polygon'))
    onSelect(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawRequest])
  useEffect(() => { if (newLayerRequest) setShowNewLayer(true) }, [newLayerRequest])
  useEffect(() => {
    if (!newZoneRequest) return
    clearTransient()
    setMode('draw')
    setShape('rect')
    onSelectZone(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newZoneRequest])
  /**
   * Floor, ceiling and slab: finds the project's item of that category (or creates it with a
   * sensible elevation and thickness) and starts drawing its outline on the sheet.
   */
  async function startAreaTool(key: AreaToolKey) {
    const def = AREA_TOOLS[key]
    setError('')
    setOpenSugs(null)
    // Reuse the item already tagged for this tool, else one named for it ("Laje" made with "New item").
    const ifcOf = (l: (typeof layers)[number]) => (l.framing as { meta?: { ifcType?: string } })?.meta?.ifcType ?? null
    // Items made from a ceiling type (CL01…) keep their own build-up: the generic tool uses its own item.
    let layer = layers.find(l => l.kind === 'area' && ifcOf(l) === def.ifcType && !l.wall_type_id)
      || layers.find(l => !ifcOf(l) && areaRole({ kind: l.kind, name: l.name }) === key)
    let id = layer?.id || null
    if (!id) {
      const wallTop = Math.max(0, ...items.filter(it => it.kind === 'linear').map(it => it.height || 0))
      const elevation = key === 'slab' ? (wallTop || 2.8) : key === 'ceiling' ? Math.min(2.6, wallTop ? wallTop - 0.2 : 2.6) : 0
      const { data, error: e } = await createClient().from('takeoff_layers').insert({
        project_id: projectId, kind: 'area', name: t(def.itemName), color: def.color,
        elevation_m: Math.round(elevation * 1000) / 1000, thickness_m: def.thickness,
        framing: { meta: { ifcType: def.ifcType } }, sort_order: (layers.length + 1) * 10,
      }).select('id').single()
      if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
      id = data.id as string
      await onChanged()
    }
    onActiveLayerChange(id)
    clearTransient()
    onSelect(null)
    setMode('draw')
    setShape('polygon')
    setAreaTool(key)
    setAreaLayerId(id)
  }

  /**
   * Building services (reinforcements, electrical, plumbing): finds the project's item of that
   * type, or creates it with its default size and mounting height, then places points on walls.
   */
  async function startMepTool(key: string) {
    const m = mepType(key)
    setMepMenu(null)
    if (!m) return
    setError('')
    setOpenSugs(null)
    setAreaTool(null)
    const mepOf = (l: (typeof layers)[number]) => (l.framing as { meta?: { mep?: string } })?.meta?.mep ?? null
    let id = layers.find(l => l.kind === 'count' && mepOf(l) === key)?.id || null
    if (!id) {
      const { data, error: e } = await createClient().from('takeoff_layers').insert({
        project_id: projectId, kind: 'count', name: t(`mep.type.${key}` as TakeoffMessageKey), color: m.color,
        elevation_m: m.sill, height_m: m.h, framing: { meta: { mep: key, width: m.w } }, sort_order: (layers.length + 1) * 10,
      }).select('id').single()
      if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
      id = data.id as string
      await onChanged()
    }
    onActiveLayerChange(id)
    clearTransient()
    onSelect(null)
    setMode('draw')
    setShape('count')
    setMepTool(key)
  }

  /**
   * Concrete structure and foundations: finds the project's item of that type, or creates it with
   * its default section and bottom elevation, then draws it (area, line or points).
   */
  async function startStructTool(key: string) {
    const st = structType(key)
    setStructMenu(null)
    if (!st) return
    setError('')
    setOpenSugs(null)
    setAreaTool(null)
    setMepTool(null)
    const structOf = (l: (typeof layers)[number]) => (l.framing as { meta?: { struct?: string } })?.meta?.struct ?? null
    let id = layers.find(l => l.kind === st.kind && structOf(l) === key)?.id || null
    if (!id) {
      const base = { project_id: projectId, kind: st.kind, name: t(`struct.type.${key}` as TakeoffMessageKey), color: st.color, elevation_m: st.base, sort_order: (layers.length + 1) * 10 }
      // One record type for the three shapes (Supabase rejects a union of object literals).
      const row: Record<string, unknown> = st.kind === 'area'
        ? { ...base, thickness_m: st.h, framing: { meta: { struct: key } } }
        : st.kind === 'linear'
          ? { ...base, thickness_m: st.w, height_m: st.h, deduct_openings: false, framing: { meta: { struct: key } } }
          : { ...base, height_m: st.h, framing: { meta: { struct: key, width: st.w, depth: st.round ? st.w : st.d } } }
      const { data, error: e } = await createClient().from('takeoff_layers').insert(row).select('id').single()
      if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
      id = data.id as string
      await onChanged()
    }
    onActiveLayerChange(id)
    clearTransient()
    onSelect(null)
    setMode('draw')
    setShape(st.kind === 'area' ? 'polygon' : st.kind === 'linear' ? 'line' : 'count')
    setStructTool(key)
  }

  /** Radier from the building outline; grade beams / beams along every drawn wall (skipping ones already there). */
  async function generateStruct() {
    const st = structType(structTool)
    if (!st || !activeLayerId) return
    if (!(scale > 0)) { setError(t('draw.needScale')); return }
    if (!drawnWalls.length) { setError(t('openings.noWalls')); return }
    const existing = items.find(it => it.key === activeLayerId)?.shapes || []
    let outlines: Vec2[][] = []
    if (st.kind === 'area') {
      const fp = footprintFromWalls(drawnWalls, scale)
      if (!fp) { setError(t('struct.noFootprint')); return }
      outlines = existing.some(sh => sh.pts.length >= 3 && pointInPolygon(centroid(fp), sh.pts)) ? [] : [fp]
    } else {
      const same = (a: Vec2[], b: Vec2[]) => a.length === b.length && a.every((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) < 1)
      outlines = drawnWalls.map(w => w.pts).filter(pts => !existing.some(sh => same(sh.pts, pts) || same([...sh.pts].reverse(), pts)))
    }
    if (!outlines.length) { setMessage(t('struct.generatedNone')); return }
    setSaving(true)
    const { data, error: e } = await createClient().from('takeoff_elements')
      .insert(outlines.map(pts => ({ project_id: projectId, layer_id: activeLayerId, source_id: source.id, points: pts })))
      .select('id')
    setSaving(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setCreated(prev => [...prev, ...(data || []).map(d => ({ table: 'takeoff_elements' as const, id: d.id as string }))])
    setMessage(t('struct.generated', { count: outlines.length }))
    await onChanged()
  }

  /** Walls drawn on this sheet (centrelines and thickness), for rooms when there are no locations. */
  const drawnWalls = items.filter(it => it.kind === 'linear' && !it.struct).flatMap(it => it.shapes.filter(sh => sh.pts.length >= 2).map(sh => ({ pts: sh.pts, thicknessM: it.thickness ?? null })))
  /**
   * One outline per room, skipping rooms that already have one: the locations on this sheet,
   * or, when there are none, the rooms closed by the walls drawn (measured to their inner faces).
   */
  async function fillAreaFromZones() {
    if (!areaTool || !areaLayerId) return
    const existing = items.find(it => it.key === areaLayerId)?.shapes || []
    const fromZones = sheetZones.some(z => z.points.length >= 3)
    if (!fromZones && !(scale > 0)) { setError(t('draw.needScale')); return }
    const outlines = fromZones
      ? sheetZones.filter(z => z.points.length >= 3).map(z => z.points)
      : roomsFromWalls(drawnWalls, scale, texts).map(r => r.pts)
    const todo = outlines.filter(pts => !existing.some(sh => sh.pts.length >= 3 && pointInPolygon(centroid(sh.pts), pts)))
    if (!todo.length) { setMessage(t(fromZones ? 'area.fillNone' : 'area.fillNoneWalls')); return }
    setSaving(true)
    const { data, error: e } = await createClient().from('takeoff_elements')
      .insert(todo.map(pts => ({ project_id: projectId, layer_id: areaLayerId, source_id: source.id, points: pts })))
      .select('id')
    setSaving(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setCreated(prev => [...prev, ...(data || []).map(d => ({ table: 'takeoff_elements' as const, id: d.id as string }))])
    setMessage(t(fromZones ? 'area.filled' : 'area.filledWalls', { count: todo.length }))
    await onChanged()
  }

  /** Reads doors (and plain openings) or windows from the PDF and places them on the drawn walls. */
  function detectOpenings(kind: 'doors' | 'windows') {
    clearTransient()
    setMode('select')
    onSelect(null)
    setError('')
    if (!(scale > 0)) { setError(t('draw.needScale')); return }
    if (vectors == null) { setMessage(t('detect.reading')); return }
    if (vectors.length === 0) { setError(t('detect.noVectors')); return }
    const walls = items.filter(it => it.kind === 'linear' && !it.struct).flatMap(it => it.shapes.filter(sh => sh.id && sh.pts.length >= 2).map(sh => ({
      id: sh.id as string,
      pts: sh.pts,
      thicknessM: it.thickness ?? null,
      heightM: sh.h ?? it.height ?? null,
      openings: sh.openings || [],
    })))
    if (!walls.length) { setError(t('openings.noWalls')); return }
    const layerNames = new Set(vectors.map(v => v.layer).filter((x): x is string => !!x))
    const allowed = layerNames.size ? new Set([...layerNames].filter(n => !defaultLayerExcluded(n))) : null
    const found = findOpenings(vectors, { ptPerM: scale, layers: allowed })
      .filter(f => (kind === 'windows' ? f.kind === 'window' : f.kind !== 'window'))
    const res = placeOpenings(found, walls, scale)
    setOpenSugs({ kind, ...res })
    setOpenPicked(new Set(res.planned.map(p => p.key)))
  }

  async function acceptOpenings() {
    if (!openSugs) return
    const chosen = openSugs.planned.filter(p => openPicked.has(p.key))
    if (!chosen.length) return
    setSaving(true)
    setError('')
    try {
      const byWall = new Map<string, PlannedOpening[]>()
      for (const p of chosen) byWall.set(p.elementId, [...(byWall.get(p.elementId) || []), p])
      const shapes = new Map(items.flatMap(it => it.shapes.filter(sh => sh.id).map(sh => [sh.id as string, sh] as const)))
      for (const [id, list] of byWall) {
        const next = [...(shapes.get(id)?.openings || []), ...list.map(p => p.opening)].sort((a, b) => a.off - b.off)
        const { error: e } = await createClient().from('takeoff_elements').update({ openings: next }).eq('id', id)
        if (e) throw e
      }
      setMessage(t(openSugs.kind === 'windows' ? 'openings.addedWindows' : 'openings.addedDoors', { count: chosen.length, walls: byWall.size }))
      setOpenSugs(null)
      setOpenPicked(new Set())
      await onChanged()
    } catch (e) {
      setError(t('workspace.error', { message: e instanceof Error ? e.message : String((e as { message?: string })?.message || e) }))
    } finally {
      setSaving(false)
    }
  }

  function runRoomDetection(region: [Vec2, Vec2] | null = roomRegion, limits: 'walls' | 'all' = roomLimits) {
    setError('')
    if (!(scale > 0)) { setError(t('draw.needScale')); return }
    if (vectors == null) { setMessage(t('detect.reading')); return }
    if (vectors.length === 0) { setError(t('detect.noVectors')); return }
    const gap = parseLocaleNumber(roomGap)
    const layerNames = new Set(vectors.map(v => v.layer).filter((x): x is string => !!x))
    const allowed = layerNames.size ? new Set([...layerNames].filter(n => !defaultLayerExcluded(n))) : null
    const box = region ? { x0: region[0][0], y0: region[0][1], x1: region[1][0], y1: region[1][1] } : null
    const found = detectRooms(vectors, texts, { ptPerM: scale, gapM: gap > 0 ? gap : 1, layers: allowed, region: box, boundaries: limits })
      // Skip rooms that already have a location drawn over them.
      .filter(r => !sheetZones.some(z => pointInPolygon(centroid(r.pts), z.points)))
    // r.name keeps the label printed on the sheet (or ''); the final names follow "Draw as" (namedRoomSugs).
    setRoomSugs(found)
    setRoomPicked(new Set(found.map(r => r.id)))
    clearTransient()
    setMode('select')
    onSelectZone(null)
  }
  useEffect(() => {
    if (!detectRoomsRequest) return
    // Ask for the area first: two clicks around the floor plan (or Whole page in the card).
    clearTransient()
    setMode('select')
    onSelectZone(null)
    setRoomSugs([])
    setRoomPicked(new Set())
    setRoomPickPts([])
    setRoomPicking(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectRoomsRequest])

  /**
   * Detected outlines named for the kind chosen in "Draw as", like a hand-drawn location:
   * rooms keep the label printed on the sheet (or "Room n"); blocks, zones and areas are "Area 1", "Area 2"…
   */
  const namedRoomSugs = useMemo(() => {
    if (!roomSugs) return null
    const macro = isMacroKind(zoneKind)
    const word = macro ? t(`zone.kind.${zoneKind}` as TakeoffMessageKey) : t('zone.defaultWord')
    const used = zones.map(z => z.name)
    return roomSugs.map(r => {
      const label = macro ? '' : r.name
      const name = !label ? nextZoneName(used, word) : used.includes(label) ? nextZoneName(used, label) : label
      used.push(name)
      return { ...r, name }
    })
  }, [roomSugs, zoneKind, zones, t])

  async function acceptRooms() {
    const chosen = (namedRoomSugs || []).filter(r => roomPicked.has(r.id))
    if (!chosen.length) return
    setSaving(true)
    const { data, error: e } = await createClient().from('takeoff_zones').insert(chosen.map((r, i) => ({
      project_id: projectId,
      source_id: source.id,
      name: r.name,
      color: isMacroKind(zoneKind) ? KIND_COLOR[zoneKind] : LAYER_PALETTE[(zones.length + i) % LAYER_PALETTE.length],
      points: r.pts,
      sort_order: (zones.length + i + 1) * 10,
      zone_kind: zoneKind,
    }))).select('id')
    setSaving(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setCreated(prev => [...prev, ...(data || []).map(d => ({ table: 'takeoff_zones' as const, id: d.id as string }))])
    setRoomSugs(prev => (prev || []).filter(r => !roomPicked.has(r.id)))
    setRoomPicked(new Set())
    setMessage(t('rooms.accepted', { count: chosen.length }))
    await onChanged()
  }

  async function moveZonePoints(id: string, pts: Vec2[]) {
    const { error: e } = await createClient().from('takeoff_zones').update({ points: pts }).eq('id', id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setMessage(t('zone.moved'))
    await onChanged()
  }

  // Switching between takeoff and zoning resets the tool.
  useEffect(() => {
    clearTransient(); setShowNewLayer(false); setRoomSugs(null); setRoomPicking(false); setRoomPickPts([]); setTaskSel(null)
    // Tasks start with "take a wall"; the other modes with Select.
    if (workMode === 'tasks') { setMode('draw'); setShape('line'); setTakeWall(true) } else { setMode('select'); setTakeWall(false) }
  }, [workMode])

  // Signed URL for the private PDF (valid for one hour).
  useEffect(() => {
    let alive = true
    setUrl(null)
    createClient().storage.from(BUCKET).createSignedUrl(source.file_path, 3600).then(({ data, error: e }) => {
      if (!alive) return
      if (e || !data) setError(t('pdf.error', { message: e?.message || '' }))
      else setUrl(data.signedUrl)
    })
    return () => { alive = false }
  }, [source.file_path, t])

  // Reset tools when the sheet changes.
  useEffect(() => {
    setMode('select')
    clearTransient()
    setCreated([])
    setMessage('')
    setError('')
    setVectors(null)
    setTexts([])
    setRegionPts([])
    setSuggestions([])
    setPicked(new Set())
    setRoomSugs(null)
    setRoomPicked(new Set())
    setRoomPicking(false)
    setRoomPickPts([])
    setRoomRegion(null)
    setTaskSel(null)
  }, [source.id])

  /** Bumped to centre the sheet in view after the next render (Fit, first load). */
  const [centerTick, setCenterTick] = useState(0)
  const fit = useCallback(() => {
    const el = containerRef.current
    const width = el?.clientWidth || 0
    const height = el?.clientHeight || 0
    if (width && pageSize.width) {
      const z = Math.min((width - 24) / pageSize.width, height && pageSize.height ? (height - 24) / pageSize.height : Infinity)
      setZoom(Math.max(0.1, z))
      setCenterTick(n => n + 1)
    }
  }, [pageSize.width, pageSize.height])

  // Centre the sheet in the visible area.
  useLayoutEffect(() => {
    const el = containerRef.current
    const wrap = sheetRef.current
    if (!centerTick || !el || !wrap) return
    el.scrollLeft = wrap.offsetLeft + (pageSize.width * zoom - el.clientWidth) / 2
    el.scrollTop = wrap.offsetTop + (pageSize.height * zoom - el.clientHeight) / 2
    // Only when asked (Fit / load), not on every zoom change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerTick])

  useEffect(() => { fit() }, [fit])

  // Tasks: frame the location (its zone + 1 m) when asked and whenever the sheet (re)loads.
  const [frameReq, setFrameReq] = useState<[number, number, number, number] | null>(null)
  useEffect(() => {
    const box = tasksMode ? task?.frame : null
    const el = containerRef.current
    if (!box || !el || !pageSize.width) return
    const fw = Math.max(1, box[2] - box[0]), fh = Math.max(1, box[3] - box[1])
    setZoom(Math.max(0.1, Math.min(8, Math.min((el.clientWidth - 24) / fw, (el.clientHeight - 24) / fh))))
    setFrameReq(box)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasksMode, task?.frameTick, loadTick])
  useLayoutEffect(() => {
    const el = containerRef.current
    const wrap = sheetRef.current
    if (!frameReq || !el || !wrap) return
    el.scrollLeft = wrap.offsetLeft + frameReq[0] * zoom - (el.clientWidth - (frameReq[2] - frameReq[0]) * zoom) / 2
    el.scrollTop = wrap.offsetTop + frameReq[1] * zoom - (el.clientHeight - (frameReq[3] - frameReq[1]) * zoom) / 2
    setFrameReq(null)
  }, [frameReq, zoom])
  useEffect(() => { onZoomChange?.(zoom) }, [zoom, onZoomChange])

  // The mouse wheel zooms around the cursor (trackpad pinch too). Registered natively because
  // React wheel listeners are passive and can't prevent the page from scrolling.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = el.getBoundingClientRect()
      const wrap = sheetRef.current
      const mx = event.clientX - rect.left
      const my = event.clientY - rect.top
      // Position on the sheet (in screen pixels at the current zoom) under the mouse.
      const sx = el.scrollLeft + mx - (wrap?.offsetLeft || 0)
      const sy = el.scrollTop + my - (wrap?.offsetTop || 0)
      const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
      const factor = Math.min(1.25, Math.max(0.8, Math.exp(-delta * 0.0015)))
      setZoom(z => {
        const next = Math.max(0.1, Math.min(8, z * factor))
        zoomAnchor.current = { mx, my, sx, sy, ratio: next / z }
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // After a wheel zoom, scroll so the same sheet point is back under the mouse.
  useLayoutEffect(() => {
    const a = zoomAnchor.current
    const el = containerRef.current
    if (!a || !el) return
    zoomAnchor.current = null
    const wrap = sheetRef.current
    el.scrollLeft = (wrap?.offsetLeft || 0) + a.sx * a.ratio - a.mx
    el.scrollTop = (wrap?.offsetTop || 0) + a.sy * a.ratio - a.my
  }, [zoom])

  /** Thickness of the active wall item in sheet points (0 if unknown). */
  const activeThicknessPts = activeLayer?.kind === 'linear' && Number(activeLayer.thickness_m) > 0 && scale > 0 ? Number(activeLayer.thickness_m) * scale : 0
  const faceMode = mode === 'draw' && shape === 'line' && !zoning && !tasksMode && placement === 'face' && activeThicknessPts > 0

  /** Saves a wall drawn by its face: centreline offset to the clicked side, corners joined to neighbours. */
  async function finishFaceWall(a: Vec2, b: Vec2, side: Vec2) {
    if (!activeLayer || saving) return
    const centre = centrelineFromFace(a, b, side, activeThicknessPts)
    const neighbours: NeighbourWall[] = items
      .filter(it => it.kind === 'linear')
      .flatMap(it => it.shapes.filter(sh => sh.id && sh.pts.length >= 2).map(sh => ({
        id: sh.id!,
        pts: sh.pts,
        thickness: (it.thickness && it.thickness > 0 ? it.thickness : 0.1) * scale,
      })))
    const { seg, updates } = joinToNeighbours(centre, activeThicknessPts, neighbours)
    setSaving(true)
    const supabase = createClient()
    const { data, error: e } = await supabase.from('takeoff_elements').insert({
      project_id: projectId,
      layer_id: activeLayer.id,
      source_id: source.id,
      points: seg,
    }).select('id').single()
    if (e || !data) { setSaving(false); setError(t('workspace.error', { message: e?.message || '' })); return }
    for (const u of updates) {
      const { error: ue } = await supabase.from('takeoff_elements').update({ points: u.pts }).eq('id', u.id)
      if (ue) setError(t('workspace.error', { message: ue.message }))
    }
    setSaving(false)
    setCreated(prev => [...prev, { table: 'takeoff_elements', id: data.id }])
    setDraft([])
    setMessage(updates.length ? t('face.savedJoined', { layer: activeLayer.name, count: updates.length }) : t('draw.saved', { layer: activeLayer.name }))
    await onChanged()
  }

  const createZone = useCallback(async (pts: Vec2[]) => {
    // Macro areas take their kind's colour and name ("Zone 1"); rooms keep the sheet label or "Room n".
    const word = zoneKind === 'room' ? t('zone.defaultWord') : t(`zone.kind.${zoneKind}` as TakeoffMessageKey)
    const name = (zoneKind === 'room' ? nameFromTexts(pts, texts) : null) || nextZoneName(zones.map(z => z.name), word)
    setSaving(true)
    const { data, error: e } = await createClient().from('takeoff_zones').insert({
      project_id: projectId,
      source_id: source.id,
      name,
      color: isMacroKind(zoneKind) ? KIND_COLOR[zoneKind] : LAYER_PALETTE[zones.length % LAYER_PALETTE.length],
      points: pts,
      sort_order: (zones.length + 1) * 10,
      zone_kind: zoneKind,
    }).select('id').single()
    setSaving(false)
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    setCreated(prev => [...prev, { table: 'takeoff_zones', id: data.id }])
    setDraft([])
    setMessage(t('zone.created', { name }))
    await onChanged()
    onSelectZone(data.id)
  }, [onChanged, onSelectZone, projectId, source.id, t, texts, zones, zoneKind])

  const finishDraft = useCallback(async (explicit?: Vec2[]) => {
    if (saving) return
    const pts = dedupe(explicit || draft)
    // Tasks: a line is saved by its third click (the side), like a wall drawn by its face.
    if (tasksMode) return
    if (zoning) {
      if (pts.length < 3) return
      await createZone(pts)
      return
    }
    if (!activeLayer) return
    const min = activeLayer.kind === 'area' ? 3 : 2
    if (activeLayer.kind === 'count' || pts.length < min) return
    setSaving(true)
    const { data, error: e } = await createClient().from('takeoff_elements').insert({
      project_id: projectId,
      layer_id: activeLayer.id,
      source_id: source.id,
      points: pts,
    }).select('id').single()
    setSaving(false)
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    setCreated(prev => [...prev, { table: 'takeoff_elements', id: data.id }])
    setDraft([])
    setMessage(t('draw.saved', { layer: activeLayer.name }))
    await onChanged()
  }, [activeLayer, createZone, draft, onChanged, projectId, saving, source.id, t, tasksMode, zoning])

  /** Saves a dragged vertex. Walls with openings keep them only if they still fit. */
  async function movePoints(id: string, pts: Vec2[]) {
    const found = items.flatMap(it => it.shapes.map(sh => ({ it, sh }))).find(x => x.sh.id === id)
    if (!found) return
    if (found.it.kind === 'linear' && scale > 0) {
      const lengthM = polyLen(pts) / scale
      const outside = (found.sh.openings || []).some(o => o.off + o.w / 2 > lengthM + 1e-3)
      if (outside) { setError(t('move.openingsOutside')); await onChanged(); return }
    }
    const { error: e } = await createClient().from('takeoff_elements').update({ points: pts }).eq('id', id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setMessage(t('move.saved'))
    await onChanged()
  }

  /** Removes the last thing saved in this session (creators may delete their own elements and zones). */
  async function undoLast() {
    const last = created[created.length - 1]
    if (!last) return
    const { data, error: e } = await createClient().from(last.table).delete().eq('id', last.id).select('id')
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setCreated(prev => prev.slice(0, -1))
    if (!data || data.length === 0) { setError(t('element.deleteDenied')); return }
    if (selectedId === last.id) onSelect(null)
    if (selectedZoneId === last.id) onSelectZone(null)
    if (taskSel === `task:${last.id}`) setTaskSel(null)
    setMessage(t('undo.done'))
    await onChanged()
  }

  /** Deletes every element picked with the selection box (one confirmation for all). */
  /** Items (across every sheet) that would have no drawing left once these elements are deleted. */
  async function itemsEmptiedBy(ids: string[]): Promise<{ id: string; name: string }[]> {
    const supabase = createClient()
    const rows: { layer_id: string }[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const { data } = await supabase.from('takeoff_elements').select('layer_id').in('id', ids.slice(i, i + 200))
      rows.push(...((data || []) as { layer_id: string }[]))
    }
    const deleting = new Map<string, number>()
    for (const r of rows) deleting.set(r.layer_id, (deleting.get(r.layer_id) || 0) + 1)
    const out: { id: string; name: string }[] = []
    for (const [layerId, n] of deleting) {
      const { count } = await supabase.from('takeoff_elements').select('id', { count: 'exact', head: true }).eq('layer_id', layerId)
      if (count != null && count <= n) out.push({ id: layerId, name: layers.find(l => l.id === layerId)?.name || '' })
    }
    return out
  }
  /** Removes items left with no drawing (after their last element was deleted). */
  async function removeEmptyItems(list: { id: string }[]) {
    if (!list.length) return
    const { error: e } = await createClient().from('takeoff_layers').delete().in('id', list.map(x => x.id))
    if (e) setError(t('workspace.error', { message: e.message }))
    if (activeLayerId && list.some(x => x.id === activeLayerId)) onActiveLayerChange(null)
  }
  const emptiedNote = (list: { name: string }[]) => (list.length ? `\n\n${t('element.itemsEmptied', { names: list.map(x => x.name).join(', ') })}` : '')

  async function deleteBoxSelection() {
    const ids = boxSel
    if (!ids.length) return
    const emptied = await itemsEmptiedBy(ids)
    if (!window.confirm(t('element.confirmDeleteMany', { count: ids.length }) + emptiedNote(emptied))) return
    const supabase = createClient()
    const gone: string[] = []
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error: e } = await supabase.from('takeoff_elements').delete().in('id', ids.slice(i, i + 200)).select('id')
      if (e) { setError(t('workspace.error', { message: e.message })); break }
      for (const row of data || []) gone.push((row as { id: string }).id)
    }
    const goneSet = new Set(gone)
    setCreated(prev => prev.filter(c => !goneSet.has(c.id)))
    setBoxSel(prev => prev.filter(id => !goneSet.has(id)))
    // RLS hides rows from non-owners, so they are skipped without an error.
    if (gone.length === 0) setError(t('element.deleteDenied'))
    else if (gone.length < ids.length) setError(t('element.deletedPartial', { done: gone.length, total: ids.length }))
    else setMessage(t('element.deletedMany', { count: gone.length }))
    if (gone.length === ids.length) await removeEmptyItems(emptied)
    if (gone.length) await onChanged()
  }

  async function deleteSelected() {
    if (tasksMode) {
      if (!taskSel) return
      if (!window.confirm(t('task.confirmDelete'))) return
      const id = taskSel.slice(5)
      const { data, error: e } = await createClient().from('location_task_drawings').delete().eq('id', id).select('id')
      if (e) { setError(t('workspace.error', { message: e.message })); return }
      if (!data || data.length === 0) { setError(t('element.deleteDenied')); return }
      setCreated(prev => prev.filter(c => c.id !== id))
      setTaskSel(null)
      setMessage(t('task.deleted'))
      await onChanged()
      return
    }
    if (!zoning && boxSel.length) { await deleteBoxSelection(); return }
    const table = zoning ? 'takeoff_zones' : 'takeoff_elements'
    const id = zoning ? selectedZoneId : selectedId
    if (!id) return
    const emptied = zoning ? [] : await itemsEmptiedBy([id])
    if (!window.confirm(t(zoning ? 'zone.confirmDelete' : 'element.confirmDelete') + emptiedNote(emptied))) return
    const { data, error: e } = await createClient().from(table).delete().eq('id', id).select('id')
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    // RLS hides the row from non-owners, so nothing is deleted and no error is returned.
    if (!data || data.length === 0) { setError(t('element.deleteDenied')); return }
    await removeEmptyItems(emptied)
    if (zoning) onSelectZone(null)
    else onSelect(null)
    setMessage(t(zoning ? 'zone.deleted' : 'element.deleted'))
    await onChanged()
  }

  // Keyboard: Enter finishes, Escape ends the command and goes back to Select, Backspace removes the last point, Delete removes the selection.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (event.key === 'Escape' && openingPick) { setPickHover(null); onOpeningPickCancel?.(); return }
      if (event.key === 'Escape') {
        clearTransient(); setBoxSel([]); onSelect(null); onSelectZone(null); setRoomPicking(false); setRoomPickPts([])
        // End the command: drop any drawing / measuring tool and its menus, back to Select.
        if (mode !== 'select') chooseTool('select')
        setArchMenu(null); setStructMenu(null); setMepMenu(null)
      }
      if (event.key === 'Enter' && mode === 'draw' && !faceMode) void finishDraft()
      if (event.key === 'Backspace' && mode === 'draw') { event.preventDefault(); setDraft(prev => (tasksMode && takeWall ? [] : prev.slice(0, -1))) }
      if (event.key === 'Backspace' && mode === 'measure') { event.preventDefault(); setMeasureDone(false); setMeasurePts(prev => prev.slice(0, -1)) }
      if (event.key === 'Delete' && mode === 'select' && (tasksMode ? taskSel : zoning ? selectedZoneId : selectedId || boxSel.length)) void deleteSelected()
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && draft.length === 0) { event.preventDefault(); void undoLast() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // deleteSelected/undoLast are recreated each render; they read the values listed here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finishDraft, mode, selectedId, selectedZoneId, draft.length, created, zoning, faceMode, openingPick, boxSel, tasksMode, taskSel])

  // Edit / View menu commands from the header.
  useEffect(() => {
    if (!command) return
    if (command.name === 'undo') void undoLast()
    if (command.name === 'delete') void deleteSelected()
    if (command.name === 'cancel') clearTransient()
    if (command.name === 'select') chooseTool('select')
    if (command.name === 'zoomIn') setZoom(z => Math.min(8, z * 1.25))
    if (command.name === 'zoomOut') setZoom(z => Math.max(0.1, z / 1.25))
    if (command.name === 'fit') fit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [command?.n])

  /** The wall being given an opening by clicking, and where the opening would go for a point. */
  function pickTarget() {
    if (!openingPick) return null
    for (const it of items) for (const sh of it.shapes) if (sh.id === openingPick.elementId) return { item: it, shape: sh }
    return null
  }
  function pickPreview(p: Vec2 | null): [Vec2, Vec2] | null {
    const target = pickTarget()
    if (!p || !target || !openingPick || !(scale > 0)) return null
    const off = openingCentreAt(target.shape.pts, p, openingPick.opening.w, scale)
    if (off == null) return null
    const m = openingMarks(target.shape.pts, [{ ...openingPick.opening, off, guid: null }], scale)[0]
    return m ? [m.a, m.b] : null
  }
  async function placePickedOpening(p: Vec2) {
    const target = pickTarget()
    if (!target || !openingPick) return
    const { shape, item } = target
    const lengthM = polyLen(shape.pts) / scale
    const off = openingCentreAt(shape.pts, p, openingPick.opening.w, scale)
    if (off == null) { setError(t('opening.error.length', { length: formatNumber(lengthM, 2) })); return }
    const candidate = { ...openingPick.opening, off: Math.round(off * 1000) / 1000 }
    const heightM = shapeHeight(item, shape)
    const problem = validateOpening(candidate, lengthM, heightM, shape.openings || [])
    if (problem) {
      const key = problem === 'size' ? 'opening.error.size' : problem === 'outside_length' ? 'opening.error.length' : problem === 'outside_height' ? 'opening.error.height' : 'opening.error.overlap'
      setError(t(key, { length: formatNumber(lengthM, 2), height: formatNumber(heightM, 2) }))
      return
    }
    setSaving(true)
    const { error: e } = await createClient().from('takeoff_elements').update({ openings: addOpening(shape.openings || [], candidate) }).eq('id', openingPick.elementId)
    setSaving(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setPickHover(null)
    await onOpeningPicked?.(t('opening.added'))
  }

  async function handlePoint(p: Vec2) {
    setError('')
    if (openingPick) { await placePickedOpening(p); return }
    if (roomPicking) {
      if (roomPickPts.length !== 1) { setRoomPickPts([p]); return }
      const region: [Vec2, Vec2] = [roomPickPts[0], p]
      setRoomPickPts([])
      setRoomPicking(false)
      setRoomRegion(region)
      runRoomDetection(region)
      // The framed region is also the sheet's plan underlay in the 3D view and report (never the whole sheet).
      const box = [[Math.min(region[0][0], region[1][0]), Math.min(region[0][1], region[1][1])], [Math.max(region[0][0], region[1][0]), Math.max(region[0][1], region[1][1])]]
      void createClient().from('takeoff_sources').update({ metadata: { ...(source.metadata || {}), underlay_region: box } }).eq('id', source.id).then(() => onChanged())
      return
    }
    if (mode === 'detect') {
      if (!pickingRegion) return
      if (regionPts.length !== 1) { setRegionPts([p]); return }
      setRegionPts([regionPts[0], p])
      setPickingRegion(false)
      return
    }
    if (mode === 'calibrate') {
      setCalPts(prev => (prev.length >= 2 ? [p] : [...prev, p]))
      return
    }
    if (mode === 'origin') {
      if (originPts.length >= 2 || originPts.length === 0) { setOriginPts([p]); openOriginForm(); return }
      setOriginPts([originPts[0], p])
      return
    }
    if (mode === 'measure') {
      if (measureDone) { setMeasureDone(false); setMeasurePts([p]); return }
      setMeasurePts(prev => [...prev, p])
      return
    }
    if (!canDraw) return
    if (tasksMode) {
      // Third click: the side the task goes (its band lies against the face, like a wall drawn by its face).
      if (draft.length >= 2) {
        if (!onTaskLine || saving) return
        const { face, side } = faceFor(draft[0], draft[1], p, scale, takeWall ? taskWallT : 0)
        setSaving(true)
        const id = await onTaskLine([face[0], face[1]], side)
        setSaving(false)
        if (!id) return
        setCreated(prev => [...prev, { table: 'location_task_drawings', id }])
        setDraft([])
        setMessage(t('task.saved'))
        return
      }
      // Take wall: the first click picks the wall's stretch along the room.
      if (takeWall) {
        const r = onTaskPick?.(p) ?? null
        if (!r) { setError(t('task.noWall')); return }
        setTaskWallT(r.thicknessM)
        setDraft([r.a, r.b])
        return
      }
      setDraft(prev => [...prev, p])
      return
    }
    if (shape === 'rect') {
      if (draft.length === 0) { setDraft([p]); return }
      const a = draft[0]
      await finishDraft([a, [p[0], a[1]], p, [a[0], p[1]]])
      return
    }
    if (faceMode) {
      if (draft.length < 2) { setDraft(prev => [...prev, p]); return }
      await finishFaceWall(draft[0], draft[1], p)
      return
    }
    if (shape === 'count' && activeLayer) {
      const { data, error: e } = await createClient().from('takeoff_elements').insert({
        project_id: projectId,
        layer_id: activeLayer.id,
        source_id: source.id,
        points: [p],
      }).select('id').single()
      if (e || !data) setError(t('workspace.error', { message: e?.message || '' }))
      else { setCreated(prev => [...prev, { table: 'takeoff_elements', id: data.id }]); await onChanged() }
      return
    }
    setDraft(prev => [...prev, p])
  }

  function openOriginForm() {
    setOriginForm(f => f || {
      level: source.level_name || '',
      elevation: source.level_elevation_m == null ? '' : formatNumber(Number(source.level_elevation_m), 2),
    })
  }

  async function saveOrigin(event: FormEvent) {
    event.preventDefault()
    if (!originPts.length || !originForm) return
    const elevation = parseLocaleNumber(originForm.elevation)
    if (originForm.elevation.trim() && !Number.isFinite(elevation)) { setError(t('origin.invalidElevation')); return }
    const angle = originPts.length === 2 ? angleFromPoints(originPts[0], originPts[1]) : 0
    const { error: e } = await createClient().from('takeoff_sources').update({
      origin_x: originPts[0][0],
      origin_y: originPts[0][1],
      origin_angle_deg: Math.round(angle * 1000) / 1000,
      level_name: originForm.level.trim() || null,
      level_elevation_m: originForm.elevation.trim() ? elevation : null,
    }).eq('id', source.id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    clearTransient()
    setMode('select')
    setMessage(t('origin.saved'))
    await onChanged()
  }

  async function clearOrigin() {
    if (!window.confirm(t('origin.confirmClear'))) return
    const { error: e } = await createClient().from('takeoff_sources').update({ origin_x: null, origin_y: null, origin_angle_deg: 0 }).eq('id', source.id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    clearTransient()
    setMode('select')
    setMessage(t('origin.cleared'))
    await onChanged()
  }

  async function saveCalibration(event: FormEvent) {
    event.preventDefault()
    const meters = parseLocaleNumber(calMeters)
    const k = calPts.length === 2 ? scaleFromPoints(calPts[0], calPts[1], meters) : null
    if (!k) { setError(t('calibrate.invalid')); return }
    const { error: e } = await createClient()
      .from('takeoff_sources')
      .update({ scale_pt_per_m: k, calibration: { a: calPts[0], b: calPts[1], meters } })
      .eq('id', source.id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setCalPts([])
    setCalMeters('')
    setMode('select')
    setMessage(t('calibrate.done', { scale: formatNumber(k, 2) }))
    await onChanged()
  }

  async function createLayer(event: FormEvent) {
    event.preventDefault()
    if (!newLayer.name.trim()) { setError(t('layer.nameRequired')); return }
    const height = parseLocaleNumber(newLayer.height)
    const thickness = parseLocaleNumber(newLayer.thickness)
    const { data, error: e } = await createClient()
      .from('takeoff_layers')
      .insert({
        project_id: projectId,
        kind: newLayer.kind,
        name: newLayer.name.trim(),
        color: newLayer.color,
        height_m: newLayer.kind === 'linear' && height > 0 ? height : null,
        thickness_m: newLayer.kind === 'linear' && thickness > 0 ? thickness : null,
        framing: newLayer.kind === 'linear'
          ? applyFramingDefaults(defaultFraming({ thickness: thickness > 0 ? thickness : undefined }, language !== 'pt-BR' ? importLabelsEnUS.framing : framingLabelsPtBR), framingDefaults)
          : {},
        sort_order: (layers.length + 1) * 10,
      })
      .select('id')
      .single()
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    setShowNewLayer(false)
    setNewLayer(prev => ({ ...prev, name: '', color: LAYER_PALETTE[(layers.length + 1) % LAYER_PALETTE.length] }))
    await onChanged()
    onActiveLayerChange(data.id)
    clearTransient()
    setMode('draw')
    setShape(s => (newLayer.kind === 'linear' ? 'line' : newLayer.kind === 'count' ? 'count' : s === 'rect' ? 'rect' : 'polygon'))
  }

  const kindOk = tasksMode ? shape === 'line' : zoning ? shape === 'rect' || shape === 'polygon' : !!activeLayer && activeLayer.kind === kindForShape[shape]
  const canDraw = mode === 'draw' && !!scale && kindOk

  const hint = useMemo(() => {
    if (mode === 'calibrate') return scale ? `${t('calibrate.hint')} ${t('calibrate.replace', { scale: formatNumber(scale, 2) })}` : t('calibrate.hint')
    if (mode === 'draw') {
      if (!scale) return t('draw.needScale')
      if (tasksMode) return draft.length >= 2 ? t('task.hint.side') : takeWall ? t('task.hint.take') : draft.length === 1 ? t('task.hint.second') : t('task.hint.draw')
      if (zoning) return kindOk ? t(shape === 'rect' ? 'zone.hint.rect' : 'zone.hint.polygon') : t('zone.hint.tool')
      if (!activeLayer || !kindOk) return t('draw.pickKind', { kind: t(kindKey[kindForShape[shape]]) })
      if (activeLayer.kind === 'count') return t('draw.hint.count')
      if (faceMode) return draft.length === 0 ? t('face.hint.first') : draft.length === 1 ? t('face.hint.second') : t('face.hint.side')
      if (shape === 'line' && placement === 'face' && !(activeThicknessPts > 0)) return t('face.hint.noThickness')
      return `${t(activeLayer.kind === 'linear' ? 'draw.hint.linear' : 'draw.hint.area')} ${t('draw.undoHint')}`
    }
    if (mode === 'measure') return scale ? t('measure.hint') : t('draw.needScale')
    if (roomPicking) return roomPickPts.length ? t('rooms.pickSecond') : t('rooms.pickFirst')
    if (mode === 'detect') return ''
    if (mode === 'origin') return originPts.length === 0 ? t('origin.hint.point') : originPts.length === 1 ? t('origin.hint.direction') : t('origin.hint.done')
    if (tasksMode) return taskSel ? t('task.hint.selected') : t('task.hint.select')
    if (zoning) return sheetZones.length ? t('zone.hint.select') : t('zone.hint.empty')
    if (boxSel.length) return t('box.selectedHint')
    // Nothing selected: no banner over the sheet (the help is in the Select button's tooltip).
    return selectedId ? t('move.hint') : ''
  }, [boxSel.length, mode, scale, activeLayer, t, formatNumber, selectedId, zoning, kindOk, shape, sheetZones.length, originPts.length, faceMode, draft.length, placement, activeThicknessPts, roomPicking, roomPickPts.length, tasksMode, takeWall, taskSel])

  const zoneShapes = useMemo(() => [
    // Largest first, so the rooms drawn inside a block or zone stay on top and clickable.
    ...sheetZones.filter(z => z.is_visible).slice().sort((p, q) => polyArea(q.points) - polyArea(p.points)).map(z => {
      const a = scale > 0 ? polyArea(z.points) / (scale * scale) : 0
      return { id: z.id, name: z.name, color: z.color, pts: z.points, label: scale > 0 ? `${formatNumber(a, 2)} m²` : '', selected: z.id === selectedZoneId, macro: isMacroKind(z.zone_kind) }
    }),
    ...(namedRoomSugs || []).map(r => ({ id: `sug:${r.id}`, name: r.name, color: '#16A34A', pts: r.pts, label: `${formatNumber(r.areaM2, 2)} m²`, selected: false, suggested: true, on: roomPicked.has(r.id) })),
  ], [sheetZones, scale, formatNumber, selectedZoneId, namedRoomSugs, roomPicked])

  const isTool = (m: Mode, s?: Shape) => mode === m && (!s || shape === s)
  type ToolGroup = 'edit' | 'ref' | 'draw' | 'model' | 'services'
  const tools: { key: string; group: ToolGroup; icon: string; label: TakeoffMessageKey; title?: string; active: boolean; onClick: (event?: ReactMouseEvent<HTMLButtonElement>) => void; disabled?: boolean }[] = [
    { key: 'select', group: 'edit', icon: 'select', label: 'tool.select', title: `${t('tool.select')} (Esc): ${t('pan.hint')} ${t('box.hint')}`, active: isTool('select'), onClick: () => chooseTool('select') },
    { key: 'scale', group: 'ref', icon: 'scale', label: 'tool.scale', active: isTool('calibrate'), onClick: () => chooseTool('calibrate') },
    ...(tasksMode ? [
      { key: 'take', group: 'draw' as ToolGroup, icon: 'wall', label: 'task.tool.take' as TakeoffMessageKey, title: t('task.hint.take'), active: isTool('draw', 'line') && takeWall, onClick: () => chooseTool('draw', 'line', true) },
      { key: 'line', group: 'draw' as ToolGroup, icon: 'line', label: 'tool.line' as TakeoffMessageKey, title: t('task.hint.draw'), active: isTool('draw', 'line') && !takeWall, onClick: () => chooseTool('draw', 'line') },
    ] : [
      { key: 'line', group: 'draw' as ToolGroup, icon: 'line', label: 'tool.line' as TakeoffMessageKey, active: isTool('draw', 'line'), onClick: () => chooseTool('draw', 'line'), disabled: zoning },
      { key: 'rect', group: 'draw' as ToolGroup, icon: 'rect', label: 'tool.rect' as TakeoffMessageKey, active: isTool('draw', 'rect'), onClick: () => chooseTool('draw', 'rect') },
      { key: 'polygon', group: 'draw' as ToolGroup, icon: 'polygon', label: 'tool.polygon' as TakeoffMessageKey, active: isTool('draw', 'polygon'), onClick: () => chooseTool('draw', 'polygon') },
      { key: 'count', group: 'draw' as ToolGroup, icon: 'count', label: 'tool.count' as TakeoffMessageKey, active: isTool('draw', 'count'), onClick: () => chooseTool('draw', 'count'), disabled: zoning },
    ]),
    { key: 'measure', group: 'ref', icon: 'measure', label: 'tool.measure', active: isTool('measure'), onClick: () => chooseTool('measure') },
    { key: 'origin', group: 'ref', icon: 'origin', label: 'tool.origin', active: isTool('origin'), onClick: () => { chooseTool('origin'); openOriginForm() } },
    ...(zoning || tasksMode ? [] : [
      {
        key: 'arch', group: 'model' as ToolGroup, icon: 'building', label: 'tool.arch' as TakeoffMessageKey,
        active: !!archMenu || isTool('detect') || !!openSugs || ((areaTool === 'floor' || areaTool === 'ceiling') && mode === 'draw'),
        onClick: (event?: ReactMouseEvent<HTMLButtonElement>) => {
          if (archMenu) { setArchMenu(null); return }
          setMepMenu(null)
          setStructMenu(null)
          const r = event?.currentTarget.getBoundingClientRect()
          setArchMenu({ left: Math.max(8, Math.min((r?.left ?? 200), window.innerWidth - 300)), top: (r?.bottom ?? 120) + 4 })
        },
      },
      {
        key: 'struct', group: 'model' as ToolGroup, icon: 'column', label: 'tool.struct' as TakeoffMessageKey, active: !!structMenu || (!!structTool && mode === 'draw') || (areaTool === 'slab' && mode === 'draw'),
        onClick: (event?: ReactMouseEvent<HTMLButtonElement>) => {
          if (structMenu) { setStructMenu(null); return }
          setMepMenu(null)
          setArchMenu(null)
          const r = event?.currentTarget.getBoundingClientRect()
          setStructMenu({ left: Math.max(8, Math.min((r?.left ?? 200), window.innerWidth - 300)), top: (r?.bottom ?? 120) + 4 })
        },
      },
      // Services: one button per group (reinforcements, electrical, plumbing), each opening its own list.
      ...([['blocking', 'blocking'], ['electrical', 'outlet'], ['plumbing', 'water']] as [MepGroup, string][]).map(([g, icon]) => ({
        key: `mep-${g}`, group: 'services' as ToolGroup, icon, label: `mep.group.${g}` as TakeoffMessageKey,
        active: mepMenu?.group === g || (!!mepTool && mode === 'draw' && mepType(mepTool)?.group === g),
        onClick: (event?: ReactMouseEvent<HTMLButtonElement>) => {
          if (mepMenu?.group === g) { setMepMenu(null); return }
          setStructMenu(null)
          setArchMenu(null)
          const r = event?.currentTarget.getBoundingClientRect()
          setMepMenu({ group: g, left: Math.max(8, Math.min((r?.left ?? 200), window.innerWidth - 300)), top: (r?.bottom ?? 120) + 4 })
        },
      })),
    ]),
  ]

  tools.splice(1, 0, { key: 'undo', group: 'edit', icon: 'undo', label: 'undo.label', title: t('undo.hint'), active: false, onClick: () => void undoLast(), disabled: created.length === 0 })
  /** Tool bar groups, each under its caption: Add · Edit · Reference · Draw · Disciplines · Services · Drawing aids · Export. */
  const toolGroups: { key: string; caption: TakeoffMessageKey; tools: typeof tools }[] = [
    ...(quickActions.length ? [{ key: 'add', caption: 'toolbar.group.add' as TakeoffMessageKey, tools: [] }] : []),
    { key: 'edit', caption: 'toolbar.group.edit', tools: tools.filter(x => x.group === 'edit') },
    { key: 'ref', caption: 'toolbar.group.ref', tools: tools.filter(x => x.group === 'ref') },
    { key: 'draw', caption: 'toolbar.group.draw', tools: tools.filter(x => x.group === 'draw') },
    ...(zoning || tasksMode ? [] : [
      { key: 'model', caption: 'toolbar.group.model' as TakeoffMessageKey, tools: tools.filter(x => x.group === 'model') },
      { key: 'services', caption: 'tool.mep' as TakeoffMessageKey, tools: tools.filter(x => x.group === 'services') },
    ]),
    ...(footerSlot ? [] : [{ key: 'aids', caption: 'toolbar.group.aids' as TakeoffMessageKey, tools: [] }]),
    ...(exportActions.length ? [{ key: 'export', caption: 'toolbar.group.export' as TakeoffMessageKey, tools: [] }] : []),
  ]

  const selectionActive = tasksMode ? !!taskSel : zoning ? !!selectedZoneId : !!selectedId
  const canBox = mode === 'select' && !zoning && !tasksMode && !openingPick
  const boxSelSet = useMemo(() => new Set(boxSel), [boxSel])

  /** Ends a box drag: picks the elements in the box (window or crossing) and selects them. */
  function finishBox(b: { x: number; y: number; shift: boolean }, x: number, y: number) {
    swallowClick.current = true
    const sheet = sheetRef.current?.getBoundingClientRect()
    if (!sheet || !zoom) return
    const toPt = (cx: number, cy: number): Vec2 => [(cx - sheet.left) / zoom, (cy - sheet.top) / zoom]
    const a = toPt(b.x, b.y)
    const c = toPt(x, y)
    const box = { x0: Math.min(a[0], c[0]), y0: Math.min(a[1], c[1]), x1: Math.max(a[0], c[0]), y1: Math.max(a[1], c[1]) }
    let ids = boxSelect(items, box, x < b.x)
    if (b.shift) ids = Array.from(new Set([...boxSel, ...(selectedId ? [selectedId] : []), ...ids]))
    if (ids.length === 1) { setBoxSel([]); onSelect(ids[0]) }
    else { setBoxSel(ids); onSelect(null) }
  }
  const draftKind: LayerKind | null = tasksMode ? 'linear' : zoning ? 'area' : activeLayer?.kind ?? null
  const zoneColor = isMacroKind(zoneKind) ? KIND_COLOR[zoneKind] : LAYER_PALETTE[zones.length % LAYER_PALETTE.length]

  const newLayerForm = showNewLayer && !zoning && !tasksMode ? (
          <form onSubmit={createLayer} style={{ ...card, pointerEvents: 'auto', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={fieldStyle}>{t('layer.name')}<input autoFocus style={inputStyle} value={newLayer.name} onChange={e => setNewLayer(v => ({ ...v, name: e.target.value }))} /></label>
            <label style={fieldStyle}>{t('layer.kind')}
              <select style={inputStyle} value={newLayer.kind} onChange={e => setNewLayer(v => ({ ...v, kind: e.target.value as LayerKind }))}>
                <option value="linear">{t('workspace.layer.linear')}</option>
                <option value="area">{t('workspace.layer.area')}</option>
                <option value="count">{t('workspace.layer.count')}</option>
              </select>
            </label>
            <label style={fieldStyle}>{t('layer.color')}<input type="color" style={{ ...inputStyle, padding: 2, width: 52 }} value={newLayer.color} onChange={e => setNewLayer(v => ({ ...v, color: e.target.value }))} /></label>
            {newLayer.kind === 'linear' && (
              <>
                <label style={fieldStyle}>{t('layer.height')}<input style={{ ...inputStyle, width: 80 }} inputMode="decimal" value={newLayer.height} onChange={e => setNewLayer(v => ({ ...v, height: e.target.value }))} /></label>
                <label style={fieldStyle}>{t('layer.thickness')}<input style={{ ...inputStyle, width: 80 }} inputMode="decimal" value={newLayer.thickness} onChange={e => setNewLayer(v => ({ ...v, thickness: e.target.value }))} /></label>
              </>
            )}
            <button type="submit" style={{ ...ui.button, height: 32 }}>{t('layer.create')}</button>
            <button type="button" style={smallBtn(false)} onClick={() => setShowNewLayer(false)}>×</button>
          </form>
  ) : null

  /** Draw tools: pick the item being drawn (or make a new one) and, for lines, how the wall is placed. In the footer when there's room for it. */
  const inFooter = !!statusSlot
  const fSel = inFooter ? { height: 22, maxWidth: 260, border: '1px solid #d6e0e3', borderRadius: 5, fontSize: 11, background: '#fff' } : { height: 28, border: '1px solid #d6e0e3', borderRadius: 6, fontSize: 11 }
  const fBtn = (on: boolean) => inFooter ? { ...smallBtn(on), height: 22, padding: '0 8px', borderRadius: 5 } : smallBtn(on)
  const layerBar = !zoning && !tasksMode && mode === 'draw' ? (
    <div style={inFooter ? { display: 'flex', alignItems: 'center', gap: 6, flex: 'none' } : { ...card, pointerEvents: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <label style={{ ...ui.small, display: 'flex', alignItems: 'center', gap: 6, ...(inFooter ? { fontSize: 11, color: '#4b6570' } : {}) }}>
        {t('layer.active')}
        <select
          value={activeLayerId || ''}
          onChange={event => { onActiveLayerChange(event.target.value || null); setDraft([]) }}
          style={fSel}
        >
          <option value="">—</option>
          {layers.filter(l => l.kind === kindForShape[shape]).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </label>
      <button type="button" style={fBtn(showNewLayer)} onClick={() => { setNewLayer(v => ({ ...v, kind: kindForShape[shape] })); setShowNewLayer(v => !v) }}>+ {t('layer.new')}</button>
      {shape === 'line' && (
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
          <span style={{ ...ui.small, ...(inFooter ? { fontSize: 11, color: '#4b6570' } : {}) }}>{t('face.placement')}</span>
          <button type="button" style={fBtn(placement === 'face')} onClick={() => { setPlacement('face'); setDraft([]) }} title={t('face.faceHelp')}>{t('face.face')}</button>
          <button type="button" style={fBtn(placement === 'center')} onClick={() => { setPlacement('center'); setDraft([]) }} title={t('face.centerHelp')}>{t('face.center')}</button>
        </span>
      )}
    </div>
  ) : null

  return (
    <div style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      <div
        ref={containerRef}
        style={{ position: 'absolute', top: barH, left: 0, right: 0, bottom: 0, overflow: 'auto', background: '#e9eef0' }}
        // Pressing the mouse wheel (middle button) and dragging moves the sheet, in any tool. The wheel
        // still zooms; the left button selects/draws; the right button is kept free for later features.
        onMouseDown={event => { if (event.button === 1) event.preventDefault() /* no browser autoscroll */ }}
        onAuxClick={event => { if (event.button === 1) event.preventDefault() }}
        onPointerDown={event => {
          swallowClick.current = false
          // Left button on an empty spot (outside the drawing or on bare sheet), in Select: start a selection box.
          if (event.button === 0 && canBox) {
            // Clicks on the container's own scrollbars keep scrolling.
            const el = containerRef.current
            const r = el?.getBoundingClientRect()
            if (el && r && (event.clientX - r.left >= el.clientWidth || event.clientY - r.top >= el.clientHeight)) return
            const target = event.target as Element
            const onShape = target instanceof SVGElement && !(target instanceof SVGSVGElement && !target.ownerSVGElement)
            if (!onShape) {
              event.preventDefault() // no text selection while dragging
              band.current = { x: event.clientX, y: event.clientY, shift: event.shiftKey, active: false }
            }
            return
          }
          if (event.button !== 1) return
          const el = containerRef.current
          if (!el) return
          event.preventDefault()
          ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
          pan.current = { x: event.clientX, y: event.clientY, left: el.scrollLeft, top: el.scrollTop }
          el.style.cursor = 'grabbing'
        }}
        onPointerMove={event => {
          const b = band.current
          if (b) {
            const dx = event.clientX - b.x
            const dy = event.clientY - b.y
            // A few pixels of slack so a plain click still clicks.
            if (!b.active && Math.hypot(dx, dy) < 5) return
            if (!b.active) { b.active = true; (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId) }
            setBandRect({ left: Math.min(b.x, event.clientX), top: Math.min(b.y, event.clientY), width: Math.abs(dx), height: Math.abs(dy), crossing: dx < 0 })
            return
          }
          const el = containerRef.current
          const start = pan.current
          if (!el || !start) return
          const dx = event.clientX - start.x
          const dy = event.clientY - start.y
          el.scrollLeft = start.left - dx
          el.scrollTop = start.top - dy
        }}
        onPointerUp={event => {
          const b = band.current
          band.current = null
          if (b?.active) { finishBox(b, event.clientX, event.clientY); setBandRect(null) }
          pan.current = null
          if (containerRef.current) containerRef.current.style.cursor = ''
        }}
        onPointerCancel={() => { band.current = null; setBandRect(null); pan.current = null; if (containerRef.current) containerRef.current.style.cursor = '' }}
        onClickCapture={event => {
          // The click that ends a box drag is not a click on the sheet.
          if (swallowClick.current) { swallowClick.current = false; event.stopPropagation(); event.preventDefault(); return }
          // A normal click selects one element (or nothing): drop the box selection.
          if (boxSel.length && !event.shiftKey) setBoxSel([])
        }}
      >
        {url ? (
          // Free space around the sheet (like CAD model space): you can pan and zoom past every edge.
          <div style={{ display: 'inline-block', padding: '70vh 70vw' }}>
          <div ref={sheetRef} style={{ width: 'fit-content', boxShadow: '0 2px 10px rgba(15,35,45,.18)' }}>
            <PdfSheet
              url={url}
              pageNumber={source.page_number || 1}
              zoom={zoom}
              items={items}
              dimItems={zoning}
              calibration={mode === 'origin' ? originPts : calPts}
              draft={roomPicking ? roomPickPts : mode === 'detect' ? (pickingRegion && regionPts.length === 1 ? regionPts : []) : draft}
              draftKind={roomPicking || mode === 'detect' ? 'area' : draftKind}
              draftColor={roomPicking || mode === 'detect' ? '#2563EB' : tasksMode ? task?.color || '#E11D48' : zoning ? zoneColor : activeLayer?.color || '#109d91'}
              crosshair={!!openingPick || roomPicking || mode === 'calibrate' || mode === 'origin' || canDraw || (mode === 'measure' && scale > 0) || (mode === 'detect' && pickingRegion)}
              measure={measurePts}
              measureDone={measureDone}
              rectPreview={roomPicking || (canDraw && shape === 'rect') || (mode === 'detect' && pickingRegion)}
              ptPerM={scale}
              fmt={v => formatNumber(v, 2)}
              selectable={mode === 'select' && !zoning && !openingPick}
              selectedId={tasksMode ? taskSel : selectedId}
              onSelect={tasksMode ? (id => setTaskSel(id && id.startsWith('task:') ? id : null)) : onSelect}
              multiSelected={boxSelSet}
              onMovePoints={tasksMode ? undefined : (id, pts) => void movePoints(id, pts)}
              snap={snapOn}
              showTags={tagsOn && !zoning}
              backgroundFade={backgroundFade}
              ortho={orthoOn}
              onSize={size => { setPageSize(size); setLoadTick(n => n + 1) }}
              onPoint={p => void handlePoint(p)}
              onFinish={() => { if (mode === 'measure') setMeasureDone(true); else if (!faceMode) void finishDraft() }}
              onError={msg => setError(t('pdf.error', { message: msg }))}
              loadingLabel={t('pdf.loading')}
              onVectors={setVectors}
              onTexts={setTexts}
              onCursor={p => { onCursor?.(p); if (openingPick) setPickHover(p) }}
              zones={zoning ? zoneShapes : tasksMode && task?.zone ? [{ id: task.zone.id, name: task.zone.name, color: '#0EA5E9', pts: task.zone.pts, label: task.zone.name, selected: false }] : []}
              onSelectZone={zoning && mode === 'select' ? id => {
                if (id.startsWith('sug:')) {
                  const rid = id.slice(4)
                  setRoomPicked(prev => { const next = new Set(prev); if (next.has(rid)) next.delete(rid); else next.add(rid); return next })
                } else onSelectZone(id)
              } : undefined}
              onMoveZonePoints={zoning && mode === 'select' ? (id, pts) => void moveZonePoints(id, pts) : undefined}
              suggestions={openingPick ? (() => { const pv = pickPreview(pickHover); return pv ? [{ id: 'pick', pts: pv, on: true }] : [] })() : mode === 'detect' ? suggestions.map(w => ({ id: w.id, pts: w.pts, on: picked.has(w.id) })) : openSugs ? openSugs.planned.map(o => ({ id: o.key, pts: [o.a, o.b] as [Vec2, Vec2], on: openPicked.has(o.key) })) : []}
              onToggleSuggestion={id => (openSugs && mode !== 'detect' ? setOpenPicked : setPicked)(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })}
              regionBox={mode === 'detect' && regionPts.length === 2 ? [regionPts[0], regionPts[1]] : zoning && roomSugs && roomRegion && !roomPicking ? roomRegion : null}
              sidePick={faceMode && draft.length === 2 ? { a: draft[0], b: draft[1], thickness: activeThicknessPts, color: activeLayer?.color || '#109d91' }
                : tasksMode && mode === 'draw' && draft.length === 2 && scale > 0 ? { a: draft[0], b: draft[1], thickness: ((takeWall ? taskWallT / 2 : 0) + (task?.bandM ?? TASK_BAND_M)) * scale, color: task?.color || '#E11D48' }
                : null}
              originMark={mode === 'origin' && originPts.length
                ? { x: originPts[0][0], y: originPts[0][1], angleDeg: originPts.length === 2 ? angleFromPoints(originPts[0], originPts[1]) : 0 }
                : originOf(source) ? { x: originOf(source)!.x, y: originOf(source)!.y, angleDeg: originOf(source)!.angleDeg } : null}
            />
          </div>
          </div>
        ) : (
          <div style={ui.muted}>{t('pdf.loading')}</div>
        )}
      </div>

      {/* Selection box being dragged: blue = window (left → right), green dashed = crossing (right → left). */}
      {bandRect && (
        <div
          style={{
            position: 'fixed', left: bandRect.left, top: bandRect.top, width: bandRect.width, height: bandRect.height,
            border: bandRect.crossing ? '1.5px dashed #16A34A' : '1.5px solid #2563EB',
            background: bandRect.crossing ? 'rgba(22,163,74,.10)' : 'rgba(37,99,235,.10)',
            pointerEvents: 'none', zIndex: 50,
          }}
        />
      )}

      {/* Floating cards (top): hints, forms and results. */}
      <div style={{ position: 'absolute', top: barH + 10, left: 10, right: 10, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start', pointerEvents: 'none' }}>
        {hint && !statusSlot && <div style={{ ...pill, pointerEvents: 'auto' }}>{hint}</div>}
        {(message || error) && (
          <div style={{ ...pill, pointerEvents: 'auto', background: error ? '#fff5f5' : '#fff', color: error ? '#a44343' : '#294955', borderColor: error ? '#f1c7c7' : '#dfe7ea' }}>
            {error || message}
            <button type="button" style={xSmall} onClick={() => { setError(''); setMessage('') }}>×</button>
          </div>
        )}
        {!zoning && boxSel.length > 0 && (
          <div style={{ ...pill, pointerEvents: 'auto', fontWeight: 700 }}>
            {t('box.count', { count: boxSel.length })}
            <button type="button" style={{ ...smallBtn(false), height: 26, borderColor: '#e5b4b4', color: '#a44343' }} onClick={() => void deleteBoxSelection()}>{t('box.delete')}</button>
            <button type="button" style={{ ...smallBtn(false), height: 26 }} onClick={() => setBoxSel([])}>{t('box.clear')}</button>
          </div>
        )}

        {!statusSlot && layerBar}

        {!statusSlot && newLayerForm}

        {mode === 'origin' && originForm && (
          <form onSubmit={saveOrigin} style={{ ...card, pointerEvents: 'auto', gap: 10, maxWidth: 560 }}>
            <strong style={{ fontSize: 12, color: '#173441' }}>{t('origin.title')}</strong>
            <span style={ui.small}>{t('origin.explain')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
              {levelLabel ? <span style={{ fontSize: 11, color: '#294955' }}>{levelLabel}</span> : (
                <>
                  <label style={fieldStyle}>{t('origin.level')}<input style={{ ...inputStyle, width: 160 }} value={originForm.level} placeholder={t('origin.levelPlaceholder')} onChange={e => setOriginForm(f => (f ? { ...f, level: e.target.value } : f))} /></label>
                  <label style={fieldStyle}>{t('origin.elevation')}<input style={{ ...inputStyle, width: 110 }} inputMode="decimal" value={originForm.elevation} placeholder="0,00" onChange={e => setOriginForm(f => (f ? { ...f, elevation: e.target.value } : f))} /></label>
                </>
              )}
              <span style={{ ...ui.small, alignSelf: 'center' }}>
                {originPts.length ? t('origin.pointSet') : t('origin.pointMissing')}
                {originPts.length === 2 ? ` · ${t('origin.angle', { deg: formatNumber(angleFromPoints(originPts[0], originPts[1]), 1) })}` : ''}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="submit" style={{ ...smallBtn(true), opacity: originPts.length ? 1 : 0.5 }} disabled={!originPts.length}>{t('origin.save')}</button>
              <button type="button" style={smallBtn(false)} onClick={() => { clearTransient(); setMode('select') }}>{t('tool.cancel')}</button>
              {originOf(source) && <button type="button" style={{ ...smallBtn(false), color: '#c94a4a', borderColor: '#efcaca' }} onClick={() => void clearOrigin()}>{t('origin.clear')}</button>}
            </div>
          </form>
        )}

        {mode === 'calibrate' && calPts.length === 2 && (
          <form onSubmit={saveCalibration} style={{ ...card, pointerEvents: 'auto', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={fieldStyle}>{t('calibrate.distance')}<input autoFocus style={{ ...inputStyle, width: 120 }} inputMode="decimal" value={calMeters} onChange={e => setCalMeters(e.target.value)} /></label>
            <button type="submit" style={{ ...ui.button, height: 32 }}>{t('calibrate.save')}</button>
          </form>
        )}

        {mode === 'detect' && (
          <div style={{ pointerEvents: 'auto', width: 'min(760px, 100%)', maxHeight: '60vh', overflow: 'auto' }}>
            <DetectPanel
              projectId={projectId}
              sourceId={source.id}
              ptPerM={scale}
              vectors={vectors}
              region={regionPts.length === 2 ? [regionPts[0], regionPts[1]] : null}
              picking={pickingRegion}
              onPickRegion={() => { setRegionPts([]); setPickingRegion(true) }}
              onClearRegion={() => { setRegionPts([]); setPickingRegion(false) }}
              suggestions={suggestions}
              selected={picked}
              onResults={setSuggestions}
              onSelectedChange={setPicked}
              layers={layers}
              activeLayer={activeLayer}
              framingDefaults={framingDefaults}
              onSaved={async (msg, ids) => { setCreated(prev => [...prev, ...ids.map(id => ({ table: 'takeoff_elements' as const, id }))]); setMessage(msg); await onChanged() }}
              onClose={() => { setMode('select'); setSuggestions([]); setPicked(new Set()); setRegionPts([]); setPickingRegion(false) }}
            />
          </div>
        )}

        {mode === 'measure' && scale > 0 && measurePts.length > 1 && (
          <div style={{ ...card, pointerEvents: 'auto', flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center', borderColor: '#f3c9a8', background: '#fff8f2', fontSize: 12, color: '#7c2d12' }}>
            <strong>{t('measure.result')}</strong>
            <span>{t('measure.length', { value: formatNumber(polyLen(measurePts) / scale, 2) })}</span>
            {measureDone && measurePts.length >= 3 && (
              <>
                <span>{t('measure.area', { value: formatNumber(polyArea(measurePts) / (scale * scale), 2) })}</span>
                <span>{t('measure.perimeter', { value: formatNumber(perimeter(measurePts) / scale, 2) })}</span>
              </>
            )}
            <span style={{ ...ui.small, color: '#9a3412' }}>{t('measure.notSaved')}</span>
            <button type="button" style={smallBtn(false)} onClick={() => { setMeasurePts([]); setMeasureDone(false) }}>{t('measure.clear')}</button>
          </div>
        )}

        {mode === 'draw' && draft.length > 0 && !faceMode && (
          <div style={{ ...card, pointerEvents: 'auto', flexDirection: 'row', gap: 8 }}>
            <button type="button" style={smallBtn(true)} onClick={() => void finishDraft()} disabled={saving}>{t('tool.finish')}</button>
            <button type="button" style={smallBtn(false)} onClick={() => setDraft([])}>{t('tool.cancel')}</button>
          </div>
        )}

        {!zoning && structTool && mode === 'draw' && structType(structTool) && (
          <div style={{ ...card, pointerEvents: 'auto', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderColor: '#bcd7f5', background: '#f8fbff' }}>
            <Icon name={structType(structTool)!.icon} size={16} style={{ color: structType(structTool)!.color }} />
            <span style={{ fontSize: 12, color: '#173441' }}>{t(`struct.hint.${structType(structTool)!.kind}` as TakeoffMessageKey, { name: t(`struct.type.${structTool}` as TakeoffMessageKey) })}</span>
            {structType(structTool)!.kind !== 'count' && drawnWalls.length > 0 && (
              <button type="button" style={smallBtn(true)} disabled={saving} onClick={() => void generateStruct()}>
                {t(structTool === 'radier' ? 'struct.genRadier' : structTool === 'beam' ? 'struct.genBeams' : 'struct.genGradeBeams')}
              </button>
            )}
          </div>
        )}
        {!zoning && mepTool && mode === 'draw' && mepType(mepTool) && (
          <div style={{ ...card, pointerEvents: 'auto', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderColor: '#bcd7f5', background: '#f8fbff' }}>
            <Icon name={mepType(mepTool)!.icon} size={16} style={{ color: mepType(mepTool)!.color }} />
            <span style={{ fontSize: 12, color: '#173441' }}>
              {t(mepType(mepTool)!.icon === 'light' ? 'mep.hintCeiling' : 'mep.hint', { name: t(`mep.type.${mepTool}` as TakeoffMessageKey), sill: formatNumber(activeLayer?.elevation_m ?? mepType(mepTool)!.sill, 2) })}
            </span>
          </div>
        )}
        {!zoning && areaTool && mode === 'draw' && (
          <div style={{ ...card, pointerEvents: 'auto', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, borderColor: '#bcd7f5', background: '#f8fbff' }}>
            <span style={{ fontSize: 12, color: '#173441' }}>{t('area.drawHint', { name: t(AREA_TOOLS[areaTool].itemName) })}</span>
            {sheetZones.length > 0 ? (
              <button type="button" style={smallBtn(true)} disabled={saving} onClick={() => void fillAreaFromZones()}>{t('area.fillFromZones', { count: sheetZones.length })}</button>
            ) : drawnWalls.length > 0 && (
              <button type="button" style={smallBtn(true)} disabled={saving} title={t('area.fillFromWallsHint')} onClick={() => void fillAreaFromZones()}>{t('area.fillFromWalls')}</button>
            )}
          </div>
        )}

        {!zoning && openingPick && (
          <div style={{ ...card, pointerEvents: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, borderColor: '#bcd7f5', background: '#f8fbff' }}>
            <span style={{ fontSize: 12, color: '#173441' }}>
              {t('opening.pickHint', { kind: t(openingPick.opening.kind === 'window' ? 'opening.kind.window' : openingPick.opening.kind === 'door' ? 'opening.kind.door' : 'opening.kind.void'), w: formatNumber(openingPick.opening.w, 2), h: formatNumber(openingPick.opening.h, 2) })}
            </span>
            <button type="button" style={smallBtn(false)} onClick={() => { setPickHover(null); onOpeningPickCancel?.() }}>{t('tool.cancel')}</button>
          </div>
        )}

        {!zoning && openSugs && (
          <div style={{ ...card, pointerEvents: 'auto', gap: 8, borderColor: '#bcd7f5', background: '#f8fbff', maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 12, color: '#173441', flex: 1 }}>{t(openSugs.kind === 'windows' ? 'openings.titleWindows' : 'openings.titleDoors')}</strong>
              <span style={ui.small}>{t('detect.beta')}</span>
              <button type="button" style={smallBtn(false)} onClick={() => { setOpenSugs(null); setOpenPicked(new Set()) }}>×</button>
            </div>
            {openSugs.planned.length === 0 ? (
              <div style={ui.small}>{t(openSugs.kind === 'windows' ? 'openings.noneWindows' : 'openings.noneDoors')}</div>
            ) : (
              <div style={ui.small}>
                {openSugs.kind === 'windows'
                  ? t('openings.foundWindows', { count: openSugs.planned.length, walls: new Set(openSugs.planned.map(p => p.elementId)).size })
                  : t('openings.foundDoors', { doors: openSugs.planned.filter(p => p.kind === 'door').length, voids: openSugs.planned.filter(p => p.kind === 'void').length, walls: new Set(openSugs.planned.map(p => p.elementId)).size })}
                {' '}{t('openings.reviewHint')}
              </div>
            )}
            {openSugs.unplaced > 0 && <div style={{ ...ui.small, color: '#9a6700' }}>{t('openings.unplaced', { count: openSugs.unplaced })}</div>}
            {openSugs.planned.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" style={{ ...smallBtn(true), opacity: saving || openPicked.size === 0 ? 0.5 : 1 }} disabled={saving || openPicked.size === 0} onClick={() => void acceptOpenings()}>
                  {t(openSugs.kind === 'windows' ? 'openings.acceptWindows' : 'openings.acceptDoors', { count: openPicked.size })}
                </button>
                <button type="button" style={smallBtn(false)} onClick={() => { setOpenSugs(null); setOpenPicked(new Set()) }}>{t('tool.cancel')}</button>
              </div>
            )}
          </div>
        )}

        {zoning && roomPicking && (
          <div style={{ ...card, pointerEvents: 'auto', flexDirection: 'row', alignItems: 'center', gap: 8, borderColor: '#bcd7f5', background: '#f8fbff' }}>
            <strong style={{ fontSize: 12, color: '#173441' }}>{t('rooms.title')}</strong>
            <span style={ui.small}>{t('rooms.pickExplain')}</span>
            <button type="button" style={smallBtn(false)} onClick={() => { setRoomPicking(false); setRoomPickPts([]); setRoomRegion(null); runRoomDetection(null) }}>{t('detect.wholePage')}</button>
            <button type="button" style={smallBtn(false)} onClick={() => { setRoomPicking(false); setRoomPickPts([]); setRoomSugs(null) }}>{t('tool.cancel')}</button>
          </div>
        )}

        {zoning && roomSugs && !roomPicking && (
          <div style={{ ...card, pointerEvents: 'auto', gap: 8, borderColor: '#bcd7f5', background: '#f8fbff', maxWidth: 560 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <strong style={{ fontSize: 12, color: '#173441', flex: 1 }}>{t('rooms.titleAs', { kind: t(`zone.kind.${zoneKind}` as TakeoffMessageKey) })}</strong>
              <span style={ui.small}>{t('detect.beta')}</span>
              <button type="button" style={smallBtn(false)} onClick={() => { setRoomSugs(null); setRoomPicked(new Set()) }}>×</button>
            </div>
            {roomSugs.length === 0 ? (
              <div style={ui.small}>{t('rooms.nothing')}</div>
            ) : (
              <>
                <div style={ui.small}>{t('rooms.found', { count: roomSugs.length, area: formatNumber(roomSugs.reduce((s2, r) => s2 + r.areaM2, 0), 2) })} {t('rooms.reviewHint')}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 120, overflow: 'auto' }}>
                  {(namedRoomSugs || []).map(r => (
                    <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', border: '1px solid #dfe7ea', borderRadius: 12, fontSize: 11, background: roomPicked.has(r.id) ? '#ecfdf3' : '#fff' }}>
                      <input type="checkbox" checked={roomPicked.has(r.id)} onChange={() => setRoomPicked(prev => { const next = new Set(prev); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); return next })} />
                      {r.name} · {formatNumber(r.areaM2, 2)} m²
                    </label>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' }}>
              <label style={fieldStyle}>{t('rooms.gap')}<input style={{ ...inputStyle, width: 80, height: 30 }} inputMode="decimal" value={roomGap} onChange={e => setRoomGap(e.target.value)} /></label>
              <label style={fieldStyle}>{t('rooms.limits')}
                <select
                  style={{ ...inputStyle, height: 30 }}
                  value={roomLimits}
                  onChange={e => { const v = e.target.value === 'all' ? 'all' : 'walls'; setRoomLimits(v); runRoomDetection(roomRegion, v) }}
                >
                  <option value="walls">{t('rooms.limitsWalls')}</option>
                  <option value="all">{t('rooms.limitsAll')}</option>
                </select>
              </label>
              <button type="button" style={smallBtn(false)} onClick={() => runRoomDetection()}>{t('rooms.rerun')}</button>
              <button type="button" style={smallBtn(false)} onClick={() => { setRoomSugs([]); setRoomPicked(new Set()); setRoomPickPts([]); setRoomPicking(true) }}>{t('rooms.newArea')}</button>
              <span style={{ ...ui.small, alignSelf: 'center' }}>{roomRegion ? t('detect.regionSet') : t('detect.regionWhole')}</span>
              {roomSugs.length > 0 && (
                <button type="button" style={{ ...smallBtn(true), opacity: saving || roomPicked.size === 0 ? 0.5 : 1 }} disabled={saving || roomPicked.size === 0} onClick={() => void acceptRooms()}>
                  {t('rooms.accept', { count: roomPicked.size })}
                </button>
              )}
            </div>
          </div>
        )}

        {mode === 'select' && selectionActive && (
          <div style={{ ...card, pointerEvents: 'auto', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <button type="button" style={{ ...smallBtn(false), color: '#c94a4a', borderColor: '#efcaca' }} onClick={() => void deleteSelected()}>{t(tasksMode ? 'task.delete' : zoning ? 'zone.delete' : 'element.delete')}</button>
          </div>
        )}
      </div>

      {archMenu && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setArchMenu(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: archMenu.left, top: archMenu.top, width: 300, maxHeight: '70vh', overflow: 'auto', padding: 6, background: '#fff', border: '1px solid #dfe7ea', borderRadius: 10, boxShadow: '0 12px 30px rgba(15,35,45,.18)' }}>
            {([
              { key: 'detect', icon: 'detect', color: '#0d7f77', label: 'tool.detect', hint: 'arch.hint.detect', active: isTool('detect'), run: () => chooseTool('detect') },
              { key: 'doors', icon: 'door', color: '#B45309', label: 'tool.doors', hint: 'arch.hint.doors', active: openSugs?.kind === 'doors', run: () => detectOpenings('doors') },
              { key: 'windows', icon: 'window', color: '#0284C7', label: 'tool.windows', hint: 'arch.hint.windows', active: openSugs?.kind === 'windows', run: () => detectOpenings('windows') },
              { key: 'floor', icon: AREA_TOOLS.floor.icon, color: AREA_TOOLS.floor.color, label: AREA_TOOLS.floor.label, hint: 'arch.hint.floor', active: areaTool === 'floor' && mode === 'draw', run: () => void startAreaTool('floor') },
              { key: 'ceiling', icon: AREA_TOOLS.ceiling.icon, color: AREA_TOOLS.ceiling.color, label: AREA_TOOLS.ceiling.label, hint: 'arch.hint.ceiling', active: areaTool === 'ceiling' && mode === 'draw', run: () => void startAreaTool('ceiling') },
            ] as { key: string; icon: string; color: string; label: TakeoffMessageKey; hint: TakeoffMessageKey; active: boolean; run: () => void }[]).map(o => (
              <button key={o.key} type="button" onClick={() => { setArchMenu(null); o.run() }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 8px', border: 0, borderRadius: 6, background: o.active ? '#e6f6f4' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <Icon name={o.icon} size={15} style={{ color: o.color, flex: 'none' }} />
                <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 650, color: '#173441' }}>{t(o.label)}</span>
                  <span style={{ fontSize: 10, color: '#6b8089' }}>{t(o.hint)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
      {structMenu && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setStructMenu(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: structMenu.left, top: structMenu.top, width: 300, maxHeight: '70vh', overflow: 'auto', padding: 6, background: '#fff', border: '1px solid #dfe7ea', borderRadius: 10, boxShadow: '0 12px 30px rgba(15,35,45,.18)' }}>
            {STRUCT_GROUPS.map(g => (
              <div key={g} style={{ paddingBottom: 4 }}>
                <div style={{ padding: '8px 8px 4px', fontSize: 10, fontWeight: 800, color: '#536d78', letterSpacing: '.06em', textTransform: 'uppercase' }}>{t(`struct.group.${g}` as TakeoffMessageKey)}</div>
                {STRUCT_TYPES.filter(st => st.group === g).map(st => (
                  <button key={st.key} type="button" onClick={() => void startStructTool(st.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', border: 0, borderRadius: 6, background: structTool === st.key && mode === 'draw' ? '#e6f6f4' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <Icon name={st.icon} size={15} style={{ color: st.color, flex: 'none' }} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 650, color: '#173441' }}>{t(`struct.type.${st.key}` as TakeoffMessageKey)}</span>
                    <span style={{ fontSize: 10, color: '#6b8089', whiteSpace: 'nowrap' }}>
                      {st.kind === 'area' ? `e ${formatNumber(st.h, 2)}` : st.round ? `Ø ${formatNumber(st.w, 2)} · ${formatNumber(st.h, 2)}` : st.kind === 'linear' ? `${formatNumber(st.w, 2)} × ${formatNumber(st.h, 2)}` : `${formatNumber(st.w, 2)} × ${formatNumber(st.d, 2)} × ${formatNumber(st.h, 2)}`}
                    </span>
                  </button>
                ))}
              </div>
            ))}
            <button type="button" onClick={() => { setStructMenu(null); void startAreaTool('slab') }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', border: 0, borderRadius: 6, background: areaTool === 'slab' && mode === 'draw' ? '#e6f6f4' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <Icon name="slab" size={15} style={{ color: AREA_TOOLS.slab.color, flex: 'none' }} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 650, color: '#173441' }}>{t('tool.slab')}</span>
              <span style={{ fontSize: 10, color: '#6b8089', whiteSpace: 'nowrap' }}>e {formatNumber(AREA_TOOLS.slab.thickness, 2)}</span>
            </button>
            <div style={{ padding: '6px 8px', fontSize: 10, color: '#6b8089', borderTop: '1px solid #eef2f3' }}>{t('struct.menuNote')}</div>
          </div>
        </div>,
        document.body,
      )}
      {mepMenu && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setMepMenu(null)}>
          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', left: mepMenu.left, top: mepMenu.top, width: 290, maxHeight: '70vh', overflow: 'auto', padding: 6, background: '#fff', border: '1px solid #dfe7ea', borderRadius: 10, boxShadow: '0 12px 30px rgba(15,35,45,.18)' }}>
            {MEP_GROUPS.filter(g => g === mepMenu.group).map(g => (
              <div key={g} style={{ paddingBottom: 4 }}>
                <div style={{ padding: '8px 8px 4px', fontSize: 10, fontWeight: 800, color: '#536d78', letterSpacing: '.06em', textTransform: 'uppercase' }}>{t(`mep.group.${g}` as TakeoffMessageKey)}</div>
                {MEP_TYPES.filter(m => m.group === g).map(m => (
                  <button key={m.key} type="button" onClick={() => void startMepTool(m.key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 8px', border: 0, borderRadius: 6, background: mepTool === m.key && mode === 'draw' ? '#e6f6f4' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <Icon name={m.icon} size={15} style={{ color: m.color, flex: 'none' }} />
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 650, color: '#173441' }}>{t(`mep.type.${m.key}` as TakeoffMessageKey)}</span>
                    <span style={{ fontSize: 10, color: '#6b8089', whiteSpace: 'nowrap' }}>{m.group === 'blocking' ? `${formatNumber(m.w, 2)} × ${formatNumber(m.h, 2)} · ` : ''}h {formatNumber(m.sill, 2)}</span>
                  </button>
                ))}
              </div>
            ))}
            <div style={{ padding: '6px 8px', fontSize: 10, color: '#6b8089', borderTop: '1px solid #eef2f3' }}>{t('mep.menuNote')}</div>
          </div>
        </div>,
        document.body,
      )}

      {/* Tool bar: a 50 px strip at the top of the work area, right below the header. */}
      {(() => {
        const bar = (
        <div ref={barOuter} style={toolbarSlot ? toolbarFull : toolbar}>
          {/* Left-aligned; scrolls when the window is too narrow even for the icons. */}
          <div ref={barInner} style={{ display: 'flex', alignItems: 'stretch', flex: 'none', height: '100%' }}>
          {toolGroups.map((g, gi) => (
            <div key={g.key} style={{ display: 'flex', alignItems: 'stretch' }}>
              {gi > 0 && <span style={divider} />}
              <div style={groupBox}>
                <div style={groupCaption}>{t(g.caption)}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                  {g.key === 'add' && quickActions.map(q => (
                    <button key={q.key} type="button" onClick={q.onClick} title={compactBar ? `${q.label} · ${q.title}` : q.title} style={quickBtn}>
                      <Icon name={q.icon} size={16} />
                      {!compactBar && <span style={btnLabel}>{q.label}</span>}
                    </button>
                  ))}
                  {g.key === 'export' && exportActions.map(q => (
                    <button key={q.key} type="button" onClick={q.onClick} disabled={q.disabled} title={q.title} style={toolBtn(false, q.disabled)}>
                      <Icon name={q.icon} size={16} />
                      {!compactBar && <span style={btnLabel}>{q.label}</span>}
                    </button>
                  ))}
                  {g.tools.map(tool => (
                    <button
                      key={tool.key}
                      type="button"
                      disabled={tool.disabled}
                      onClick={event => tool.onClick(event)}
                      title={tool.title || t(tool.label)}
                      style={toolBtn(tool.active, tool.disabled)}
                    >
                      <Icon name={tool.icon} size={16} />
                      {!compactBar && <span style={btnLabel}>{t(tool.label)}</span>}
                    </button>
                  ))}
                  {g.key === 'aids' && (
                    <>
                      <label style={toggleLabel}>{t('tool.snap')}<Switch on={snapOn} onChange={setSnapOn} /></label>
                      <label style={toggleLabel}>{t('tool.ortho')}<Switch on={orthoOn} onChange={setOrthoOn} /></label>
                      {!zoning && <label style={toggleLabel} title={t('tags.hint')}>{t('tags.toggle')}<Switch on={tagsOn} onChange={setTagsOn} /></label>}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
        )
        return toolbarSlot ? createPortal(bar, toolbarSlot) : bar
      })()}
      {/* New item form: floats just above the footer, next to its button. */}
      {statusSlot && newLayerForm && (
        <div style={{ position: 'absolute', left: 10, bottom: 10, right: 10, display: 'flex', zIndex: 20 }}>{newLayerForm}</div>
      )}
      {/* Tool hint and active-item bar live in the footer, between the cursor and the switches. */}
      {statusSlot && createPortal(
        <>
          {layerBar}
          {layerBar && hint && <span style={{ color: '#c4d0d4', flex: 'none' }}>|</span>}
          {hint && <span title={hint} style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#294955' }}>{hint}</span>}
        </>,
        statusSlot,
      )}
      {/* Snap and Ortho live in the footer, left of the zoom. */}
      {footerSlot && createPortal(
        <>
          <label style={{ ...toggleLabel, fontSize: 11, padding: 0 }}>{t('tool.snap')}<Switch on={snapOn} onChange={setSnapOn} /></label>
          <label style={{ ...toggleLabel, fontSize: 11, padding: 0 }}>{t('tool.ortho')}<Switch on={orthoOn} onChange={setOrthoOn} /></label>
          {!zoning && <label style={{ ...toggleLabel, fontSize: 11, padding: 0 }} title={t('tags.hint')}>{t('tags.toggle')}<Switch on={tagsOn} onChange={setTagsOn} /></label>}
        </>,
        footerSlot,
      )}
    </div>
  )
}

function Switch({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      style={{ width: 34, height: 18, borderRadius: 9, border: 0, padding: 2, background: on ? '#109d91' : '#cfd9dd', cursor: 'pointer', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start' }}
    >
      <span style={{ width: 14, height: 14, borderRadius: 7, background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,.2)' }} />
    </button>
  )
}

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const inputStyle = { height: 32, padding: '0 8px', border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12, background: '#fff' } as const
const pill = { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', border: '1px solid #dfe7ea', borderRadius: 8, background: 'rgba(255,255,255,.95)', fontSize: 11, color: '#294955', boxShadow: '0 1px 4px rgba(15,35,45,.08)' } as const
const card = { display: 'flex', flexDirection: 'column', gap: 8, padding: 10, border: '1px solid #dfe7ea', borderRadius: 10, background: '#fff', boxShadow: '0 2px 10px rgba(15,35,45,.10)' } as const
const xSmall = { border: 0, background: 'transparent', cursor: 'pointer', fontSize: 14, color: 'inherit', padding: 0 } as const
const smallBtn = (on: boolean) => ({ height: 30, padding: '0 12px', border: '1px solid ' + (on ? '#109d91' : '#d3dfe2'), borderRadius: 7, background: on ? '#109d91' : '#fff', color: on ? '#fff' : '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' }) as const
const TOOLBAR_H = 58

/** Floor, ceiling and slab tools: the item category (IFC type), its look and starting thickness. */
type AreaToolKey = 'floor' | 'ceiling' | 'slab'
const AREA_TOOLS: Record<AreaToolKey, { ifcType: string; icon: string; label: TakeoffMessageKey; itemName: TakeoffMessageKey; color: string; thickness: number }> = {
  floor: { ifcType: 'IfcCovering.FLOORING', icon: 'floor', label: 'tool.floor', itemName: 'area.floorItem', color: '#B7791F', thickness: 0.02 },
  ceiling: { ifcType: 'IfcCovering.CEILING', icon: 'ceiling', label: 'tool.ceiling', itemName: 'area.ceilingItem', color: '#7C3AED', thickness: 0.0125 },
  slab: { ifcType: 'IfcSlab', icon: 'slab', label: 'tool.slab', itemName: 'area.slabItem', color: '#64748B', thickness: 0.12 },
}
const toolbar = { position: 'absolute', top: 0, left: 0, right: 0, height: TOOLBAR_H, boxSizing: 'border-box', display: 'flex', alignItems: 'stretch', gap: 2, padding: '0 8px', background: '#fff', borderBottom: '1px solid #dfe7ea', overflowX: 'auto', overflowY: 'hidden', zIndex: 5 } as const
/** Ribbon buttons: icon over a short label, so every name fits in the width of a full-HD screen. */
const toolBtn = (on: boolean, disabled?: boolean) => ({
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, height: 38, minWidth: 40, flex: 'none', padding: '0 7px', border: 0, borderRadius: 7, whiteSpace: 'nowrap',
  background: on ? '#109d91' : 'transparent', color: on ? '#fff' : '#294955', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.35 : 1,
}) as const
/** Quick add buttons: tinted so they read as "add an item", not as drawing tools. */
const quickBtn = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, height: 38, minWidth: 40, flex: 'none', padding: '0 6px', margin: '0 1px', border: '1px solid #bfe6e1', borderRadius: 7, boxSizing: 'border-box', whiteSpace: 'nowrap', background: '#effaf8', color: '#0d7f77', cursor: 'pointer' } as const
const btnLabel = { fontSize: 11, fontWeight: 650, lineHeight: '13px' } as const
const groupBox = { display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'center', padding: '3px 0 4px' } as const
const groupCaption = { fontSize: 9, fontWeight: 800, lineHeight: '11px', letterSpacing: '.07em', textTransform: 'uppercase', color: '#8aa0a8', textAlign: 'center', whiteSpace: 'nowrap', padding: '0 4px' } as const
const divider = { width: 1, alignSelf: 'center', height: 40, flex: 'none', margin: '0 6px', background: '#e2eaed' } as const
/** Same bar filling the full-width row under the header: everything visible, no scrolling. */
const toolbarFull = { height: '100%', width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'stretch', padding: '0 12px', background: '#fff', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin' } as const
const toggleLabel = { display: 'flex', alignItems: 'center', gap: 6, padding: '0 6px', flex: 'none', whiteSpace: 'nowrap', fontSize: 11, fontWeight: 700, color: '#294955' } as const
