'use client'

/* 3D view of one sheet or storey, ported from the prototype (init3D, build3D, addExploded).
   three.js r128 and OrbitControls are loaded from the same CDNs the prototype used, so no
   package install is needed. Coordinates: sheet x -> world x, sheet y -> world z, height -> y. */

import { useEffect, useMemo, useRef, useState } from 'react'
import { loadUnderlay, type LoadedUnderlay, type UnderlaySpec, type UnderlayZone } from './planUnderlay'
import { layoutLabels, type LabelIn, type LabelOut } from '@/lib/takeoff/labelLayout'
import { openingMarks } from '@/lib/takeoff/openingMarks'
import { findJunctions, junctionStudsOnWall, layoutWall, type Junction } from '@/lib/takeoff/framing/framing'
import { shapeHeight, type TakeoffItem, type TakeoffShape, type Vec2 } from '@/lib/takeoff/geometry'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { ui } from '../ui'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Three = any

const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'
const ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'

let threePromise: Promise<Three> | null = null

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

function loadThree(): Promise<Three> {
  const w = window as any
  if (w.THREE?.OrbitControls) return Promise.resolve(w.THREE)
  if (!threePromise) {
    threePromise = loadScript(THREE_URL)
      .then(() => loadScript(ORBIT_URL))
      .then(() => {
        if (!w.THREE?.OrbitControls) throw new Error('OrbitControls missing')
        return w.THREE
      })
      .catch(err => { threePromise = null; throw err })
  }
  return threePromise
}

const boardColor = (n: string) =>
  /\bRU\b|umid|water/i.test(n || '') ? '#6DBE7E' : /\bRF\b|fogo|fire/i.test(n || '') ? '#EE8E8E' : '#E4E7EB'

function coreWidthM(item: TakeoffItem): number {
  const m = item.framing?.studName?.match(/(\d{2,3})\s*mm/)
  if (m) return Number(m[1]) / 1000
  return Math.max(0.048, (item.thickness || 0.095) - 0.025)
}

function segDist(p: Vec2, a: Vec2, b: Vec2) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}

/** A storey (or sheet) in the scene: its page number in `items` and its elevation. */
export type View3DStorey = { page: number; name: string; elevation: number }

type Props = {
  items: TakeoffItem[]
  ptPerM: number
  selectedId: string | null
  onSelect: (elementId: string | null) => void
  /** When given, shapes are stacked by storey elevation and each storey can be shown or hidden. */
  storeys?: View3DStorey[]
  /** Plan underlays per storey (sheet region framed for room detection) and the locations on them. */
  underlays?: UnderlaySpec[]
  underlayZones?: UnderlayZone[]
  /** Storey (page) of the sheet open in the editor: its underlay is preferred. */
  preferPage?: number
  /** Tags shown from the start (task view). */
  initialTags?: boolean
  /** Called when the user stops orbiting: the view on screen (for the field sheet's 3D picture). */
  onView?: (view: View3DCamera) => void
  /**
   * Explode handled by the page (task view): the page pulls its own layers apart (each task band away
   * from the wall), so the button works even without construction layers.
   */
  explodeControl?: { on: boolean; onToggle: () => void }
}

type Scene = { THREE: Three; renderer: any; scene: any; cam: any; ctl: any; group: any; raf: number }

const NO_UNDERLAYS: UnderlaySpec[] = []
const NO_ZONES: UnderlayZone[] = []

export default function View3D({ items, ptPerM, selectedId, onSelect, storeys, underlays = NO_UNDERLAYS, underlayZones = NO_ZONES, preferPage, initialTags = false, onView, explodeControl }: Props) {
  const t = useTakeoffT()
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const fittedRef = useRef(false)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const onViewRef = useRef(onView)
  onViewRef.current = onView
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [layered, setLayered] = useState(true)
  const [explodeOwn, setExplode] = useState(false)
  const explode = explodeControl ? explodeControl.on : explodeOwn
  /** Construction layers: which board sides are drawn (none = framing only). */
  const [boards, setBoards] = useState<BoardSides>('both')
  /** Tag of each wall stretch floating above it (off by default: busy on big models). */
  const [tagsOn, setTagsOn] = useState(initialTags)
  /** Doors and windows drawn as objects in their openings. */
  const [openingsOn, setOpeningsOn] = useState(true)
  /** Ground grid under the model. */
  const [gridOn, setGridOn] = useState(true)
  /** The PDF region under the model (half tone) with the locations in colour. */
  const [underlayOn, setUnderlayOn] = useState(true)
  const [underlay, setUnderlay] = useState<LoadedUnderlay | null>(null)
  /** Tag anchors of the current model, drawn as a 2D overlay every frame. */
  const anchorsRef = useRef<TagAnchor[]>([])
  const overlayRef = useRef<HTMLCanvasElement | null>(null)
  const [isolate, setIsolate] = useState(false)
  const [hiddenPages, setHiddenPages] = useState<Set<number>>(new Set())
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set())
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [showPanel, setShowPanel] = useState(false)

  const elevationOf = useMemo(() => {
    const m = new Map((storeys || []).map(st => [st.page, st.elevation]))
    return (page: number) => m.get(page) || 0
  }, [storeys])

  const layerList = useMemo(() => items.filter(it => it.shapes.length > 0).map(it => ({ key: it.key, name: it.name, color: it.color })), [items])

  // What is actually drawn after the visibility choices.
  const visibleItems = useMemo(
    () =>
      items
        .filter(it => !hiddenLayers.has(it.key))
        .map(it => ({ ...it, shapes: it.shapes.filter(sh => !hiddenPages.has(sh.page) && !(sh.id && hiddenIds.has(sh.id))) }))
        .filter(it => it.shapes.length > 0),
    [items, hiddenLayers, hiddenPages, hiddenIds],
  )
  const hiddenCount = hiddenPages.size + hiddenLayers.size + hiddenIds.size
  const toggleIn = <T,>(set: Set<T>, value: T) => { const next = new Set(set); if (next.has(value)) next.delete(value); else next.add(value); return next }

  // Create the renderer once.
  useEffect(() => {
    let disposed = false
    let ro: ResizeObserver | null = null
    loadThree()
      .then(THREE => {
        const host = hostRef.current
        if (disposed || !host) return
        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(window.devicePixelRatio || 1)
        host.appendChild(renderer.domElement)
        // Tag labels: a flat canvas over the 3D one, redrawn each frame so labels never collide.
        const overlay = document.createElement('canvas')
        overlay.style.cssText = 'position:absolute;inset:0;pointer-events:none'
        if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
        host.appendChild(overlay)
        overlayRef.current = overlay
        const scene = new THREE.Scene()
        scene.background = new THREE.Color('#eef2f3')
        const cam = new THREE.PerspectiveCamera(40, 1, 0.1, 2000)
        const ctl = new THREE.OrbitControls(cam, renderer.domElement)
        ctl.enableDamping = true
        ctl.maxPolarAngle = Math.PI * 0.495
        // Left drag orbits, pressing the wheel (middle button) and dragging pans, the wheel zooms;
        // the right button is kept free for later features.
        ctl.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: null }
        renderer.domElement.addEventListener('mousedown', (e: MouseEvent) => { if (e.button === 1) e.preventDefault() })
        // Touch: one finger orbits, two fingers pinch to zoom (and turn) without panning,
        // so the model stays centred on phones; the page itself must not scroll or zoom.
        ctl.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE }
        ctl.addEventListener('end', () => {
          const d = cam.position.clone().sub(ctl.target)
          onViewRef.current?.(viewOfDir([d.x, d.y, d.z]))
        })
        renderer.domElement.style.touchAction = 'none'
        renderer.domElement.style.display = 'block'
        scene.add(new THREE.HemisphereLight(0xffffff, 0x88939e, 0.85))
        const dl = new THREE.DirectionalLight(0xffffff, 0.55)
        dl.position.set(-15, 30, 20)
        scene.add(dl)
        const group = new THREE.Group()
        scene.add(group)
        const state: Scene = { THREE, renderer, scene, cam, ctl, group, raf: 0 }
        sceneRef.current = state

        const size = () => {
          const w = Math.max(1, host.clientWidth)
          const h = Math.max(1, host.clientHeight)
          renderer.setSize(w, h)
          const dpr = window.devicePixelRatio || 1
          overlay.width = Math.round(w * dpr)
          overlay.height = Math.round(h * dpr)
          overlay.style.width = `${w}px`
          overlay.style.height = `${h}px`
          cam.aspect = w / h
          cam.updateProjectionMatrix()
        }
        size()
        ro = new ResizeObserver(size)
        ro.observe(host)

        // Click (not drag) selects an element.
        const ray = new THREE.Raycaster()
        let down: { x: number; y: number; b: number } | null = null
        renderer.domElement.addEventListener('pointerdown', (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, b: e.button } })
        renderer.domElement.addEventListener('pointerup', (e: PointerEvent) => {
          if (!down || down.b !== 0 || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) { down = null; return }
          down = null
          const r = renderer.domElement.getBoundingClientRect()
          ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), cam)
          const hit = ray.intersectObjects(group.children, false).find((h: any) => h.object.userData?.id)
          onSelectRef.current(hit ? hit.object.userData.id : null)
        })

        const loop = () => {
          state.raf = requestAnimationFrame(loop)
          ctl.update()
          renderer.render(scene, cam)
          const octx = overlay.getContext('2d')
          if (octx) {
            const dpr = window.devicePixelRatio || 1
            octx.setTransform(1, 0, 0, 1, 0, 0)
            drawTagOverlay(octx, THREE, cam, anchorsRef.current, overlay.width, overlay.height, dpr, group)
          }
        }
        loop()
        setStatus('ready')
      })
      .catch(() => { if (!disposed) setStatus('error') })

    return () => {
      disposed = true
      ro?.disconnect()
      const s = sceneRef.current
      if (s) {
        cancelAnimationFrame(s.raf)
        clearGroup(s.group)
        s.ctl.dispose?.()
        s.renderer.dispose()
        s.renderer.domElement.remove()
        overlayRef.current?.remove()
      }
      sceneRef.current = null
    }
  }, [])

  // Re-frame the camera when the sheet changes (declared first so it runs before the rebuild).
  useEffect(() => { fittedRef.current = false }, [ptPerM, items.length])

  // Plan underlay: one storey only — the sheet the drawn model comes from (its own region and scale, so the
  // walls sit exactly on their drawing), the selected sheet first, then the lowest visible one.
  const underlaySpec = useMemo(() => {
    if (!underlayOn || !underlays.length) return null
    const elev = (page: number) => (storeys || []).find(st => st.page === page)?.elevation ?? 0
    const drawn = new Set(visibleItems.flatMap(it => it.shapes.map(sh => sh.page)))
    const score = (u: UnderlaySpec) => (drawn.has(u.page) ? 0 : 2) + (u.page === preferPage ? 0 : 1)
    return [...underlays]
      .filter(u => !hiddenPages.has(u.page) && drawn.has(u.page))
      .sort((a, b) => score(a) - score(b) || elev(a.page) - elev(b.page))[0] || null
  }, [underlayOn, underlays, storeys, hiddenPages, visibleItems, preferPage])
  // Reload only when the region really changes (the parent rebuilds the spec objects on every change).
  const specRef = useRef(underlaySpec)
  specRef.current = underlaySpec
  const specKey = underlaySpec ? `${underlaySpec.page}|${underlaySpec.filePath}|${underlaySpec.pageNumber}|${underlaySpec.region.flat().join(',')}|${underlaySpec.toModel([0, 0]).join(',')}|${underlaySpec.toModel([1000, 1000]).join(',')}` : ''
  useEffect(() => {
    let alive = true
    const spec = specRef.current
    if (!spec) { setUnderlay(null); return }
    void loadUnderlay(spec).then(u => { if (alive) setUnderlay(u) })
    return () => { alive = false }
  }, [specKey])

  // Rebuild the model when the data or options change.
  useEffect(() => {
    const s = sceneRef.current
    if (!s || status !== 'ready' || !ptPerM) return
    anchorsRef.current = build(s, visibleItems, ptPerM, { selectedId, layered, explode: explode ? 0.6 : 0, isolate, elevationOf, center: items, boards, tags: tagsOn, openings: openingsOn, grid: gridOn, underlay, zones: underlay ? underlayZones.filter(z => z.page === underlay.page) : [] })
    if (!fittedRef.current) { fit(s, items, ptPerM, elevationOf); fittedRef.current = true }
  }, [items, visibleItems, ptPerM, selectedId, layered, explode, isolate, status, elevationOf, boards, tagsOn, openingsOn, gridOn, underlay, underlayZones])


  const toggle = (active: boolean) => ({
    ...ui.button,
    height: 30,
    fontSize: 10,
    background: active ? '#109d91' : '#fff',
    color: active ? '#fff' : '#294955',
    border: '1px solid ' + (active ? '#109d91' : '#d3dfe2'),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '100%', minHeight: 0, minWidth: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', minWidth: 0 }}>
        <button type="button" style={toggle(layered)} onClick={() => setLayered(v => !v)}>{t('view3d.layers')}</button>
        <button type="button" style={toggle(explode)} disabled={!explodeControl && !layered} onClick={() => (explodeControl ? explodeControl.onToggle() : setExplode(v => !v))}>{t('view3d.explode')}</button>
        <span title={t('view3d.boardsHint')} style={{ display: 'flex', alignItems: 'center', gap: 0, opacity: layered ? 1 : 0.45 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: '#536d78', marginRight: 6 }}>{t('view3d.boards')}</span>
          {BOARD_SIDES.map((v, i) => (
            <button
              key={v}
              type="button"
              disabled={!layered}
              onClick={() => setBoards(v)}
              style={{ ...toggle(layered && boards === v), padding: '0 10px', borderRadius: i === 0 ? '7px 0 0 7px' : i === BOARD_SIDES.length - 1 ? '0 7px 7px 0' : 0, marginLeft: i ? -1 : 0 }}
            >
              {t(`view3d.boards.${v}` as const)}
            </button>
          ))}
        </span>
        <button type="button" style={toggle(tagsOn)} title={t('tags.hint')} onClick={() => setTagsOn(v => !v)}>{t('tags.toggle')}</button>
        <button type="button" style={toggle(openingsOn)} title={t('view3d.openingsHint')} onClick={() => setOpeningsOn(v => !v)}>{t('view3d.openings')}</button>
        <button type="button" style={toggle(gridOn)} title={t('view3d.gridHint')} onClick={() => setGridOn(v => !v)}>{t('view3d.grid')}</button>
        {underlays.length > 0 && <button type="button" style={toggle(underlayOn)} title={t('view3d.underlayHint')} onClick={() => setUnderlayOn(v => !v)}>{t('view3d.underlay')}</button>}
        <button type="button" style={toggle(isolate)} disabled={!selectedId && !isolate} onClick={() => setIsolate(v => !v)}>{t('view3d.isolate')}</button>
        <button type="button" style={toggle(false)} onClick={() => { const s = sceneRef.current; if (s) fit(s, items, ptPerM, elevationOf) }}>{t('tool.fit')}</button>
        <button type="button" style={toggle(showPanel || hiddenCount > 0)} onClick={() => setShowPanel(v => !v)}>
          {t('view3d.visibility')}{hiddenCount > 0 ? ` (${hiddenCount})` : ''}
        </button>
        <button type="button" style={toggle(false)} disabled={!selectedId} onClick={() => { if (selectedId) { setHiddenIds(h => toggleIn(h, selectedId)); onSelect(null) } }}>{t('view3d.hideSelected')}</button>
        {hiddenCount > 0 && (
          <button type="button" style={toggle(false)} onClick={() => { setHiddenPages(new Set()); setHiddenLayers(new Set()); setHiddenIds(new Set()) }}>{t('view3d.showAll')}</button>
        )}
        <span style={ui.small}>{t('view3d.hint')}</span>
      </div>
      {showPanel && (
        <div style={{ ...ui.panel, flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
          {storeys && storeys.length > 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 180 }}>
              <strong style={{ fontSize: 11, color: '#173441' }}>{t('view3d.storeys')}</strong>
              {[...storeys].sort((a, b) => b.elevation - a.elevation).map(st => (
                <label key={st.page} style={checkRow}>
                  <input type="checkbox" checked={!hiddenPages.has(st.page)} onChange={() => setHiddenPages(h => toggleIn(h, st.page))} />
                  {st.name}
                </label>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 240 }}>
            <strong style={{ fontSize: 11, color: '#173441' }}>{t('workspace.layers')}</strong>
            {layerList.map(l => (
              <label key={l.key} style={checkRow}>
                <input type="checkbox" checked={!hiddenLayers.has(l.key)} onChange={() => setHiddenLayers(h => toggleIn(h, l.key))} />
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: l.color }} />
                {l.name}
              </label>
            ))}
          </div>
          {hiddenIds.size > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <strong style={{ fontSize: 11, color: '#173441' }}>{t('view3d.hiddenElements', { count: hiddenIds.size })}</strong>
              <button type="button" style={toggle(false)} onClick={() => setHiddenIds(new Set())}>{t('view3d.showHidden')}</button>
            </div>
          )}
        </div>
      )}
      <div ref={hostRef} style={{ position: 'relative', flex: 1, minHeight: 300, border: '1px solid #dfe7ea', borderRadius: 10, overflow: 'hidden', background: '#eef2f3' }}>
        {status !== 'ready' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: status === 'error' ? '#a44343' : '#6b8089' }}>
            {status === 'error' ? t('view3d.error') : t('view3d.loading')}
          </div>
        )}
      </div>
    </div>
  )
}

function clearGroup(g: any) {
  while (g.children.length) {
    const c = g.children.pop()
    c.geometry?.dispose?.()
    const m = c.material
    if (m) (Array.isArray(m) ? m : [m]).forEach((x: any) => { x.map?.dispose?.(); x.dispose?.() })
  }
}

function bounds(items: TakeoffItem[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const it of items) for (const sh of it.shapes) for (const p of sh.pts) {
    x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1])
  }
  if (!Number.isFinite(x0)) return { x0: 0, y0: 0, x1: 1, y1: 1 }
  return { x0, y0, x1, y1 }
}

/** Frames the whole model for the current view's shape (portrait phones included) and orbits around it. */
function fit(s: Scene, _items?: TakeoffItem[], _k?: number, _elevationOf?: (page: number) => number) {
  void _items; void _k; void _elevationOf
  const target = fitWhole(s.THREE, s.cam, s.group, s.cam.aspect || 1)
  if (target) s.ctl.target.copy(target)
  s.ctl.update()
}

type BuildOptions = {
  selectedId: string | null
  /** Construction layers: board sides drawn (default both). */
  boards?: BoardSides
  /** Draw the tag of each wall stretch above it. */
  tags?: boolean
  /** Doors and windows as objects in their openings (default on); the holes stay either way. */
  openings?: boolean
  /** PDF region in half tone under its storey, with the locations in colour on it. */
  underlay?: LoadedUnderlay | null
  zones?: UnderlayZone[]
  /** Ground grid (default on). */
  grid?: boolean
  layered: boolean
  explode: number
  isolate: boolean
  /** Elevation of each page (storey) in metres; 0 when not stacked. */
  elevationOf: (page: number) => number
  /** Items used to centre the model, so hiding things does not move the camera target. */
  center: TakeoffItem[]
}

function build(s: Scene, items: TakeoffItem[], k: number, o: BuildOptions): TagAnchor[] {
  const { THREE, group: g } = s
  clearGroup(g)
  const b = bounds(o.center.length ? o.center : items)
  const cx = (b.x0 + b.x1) / 2
  const cy = (b.y0 + b.y1) / 2
  const M = (p: Vec2): Vec2 => [(p[0] - cx) / k, (p[1] - cy) / k]
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x1a2027, transparent: true, opacity: 0.45 })
  /** Solid by default; see-through only when the item's Transparency setting asks for it. */
  const look = (it: TakeoffItem) => {
    const tr = Math.max(0, Math.min(0.9, it.transparency || 0))
    return tr > 0 ? { transparent: true, opacity: 1 - tr, depthWrite: false } : { transparent: false, opacity: 1, depthWrite: true }
  }
  const selEdge = new THREE.LineBasicMaterial({ color: 0xe11d48 })
  const segs: { a: Vec2; b: Vec2; t: number; ang: number }[] = []
  const show = (sh: TakeoffShape) => !o.isolate || !o.selectedId || sh.id === o.selectedId
  const junctions = o.layered ? findJunctions(items, k) : []

  for (const it of items) {
    const col = new THREE.Color(it.color)
    for (const sh of it.shapes) {
      if (!show(sh)) continue
      const selected = !!sh.id && sh.id === o.selectedId
      if (it.kind === 'linear' && o.layered && it.framing?.on) {
        addLayered(s, it, sh, M, k, segs, selected, o.explode, junctions, o.elevationOf(sh.page), o.boards || 'both')
      } else if (it.kind === 'linear') {
        const th = it.thickness || 0.1
        const h = shapeHeight(it, sh) || 2.8
        const z0 = (sh.zrel || 0) + (it.elevation || 0) + o.elevationOf(sh.page)
        const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, ...look(it) })
        if (selected) { mat.emissive = new THREE.Color(0xe11d48); mat.emissiveIntensity = 0.55 }
        let acc = 0
        const box = (a: Vec2, u: Vec2, ang: number, s0: number, s1: number, y0: number, y1: number) => {
          if (s1 - s0 < 1e-3 || y1 - y0 < 1e-3) return
          const geo = new THREE.BoxGeometry(s1 - s0, y1 - y0, th)
          const mesh = new THREE.Mesh(geo, mat)
          const c = (s0 + s1) / 2
          mesh.position.set(a[0] + u[0] * c, z0 + (y0 + y1) / 2, a[1] + u[1] * c)
          mesh.rotation.y = -ang
          mesh.userData = { id: sh.id }
          g.add(mesh)
          const ed = new THREE.LineSegments(new THREE.EdgesGeometry(geo), selected ? selEdge : edgeMat)
          ed.position.copy(mesh.position)
          ed.rotation.copy(mesh.rotation)
          g.add(ed)
        }
        for (let i = 1; i < sh.pts.length; i++) {
          const a = M(sh.pts[i - 1])
          const bb = M(sh.pts[i])
          const L = Math.hypot(bb[0] - a[0], bb[1] - a[1])
          if (L < 1e-3) continue
          const ang = Math.atan2(bb[1] - a[1], bb[0] - a[0])
          const u: Vec2 = [(bb[0] - a[0]) / L, (bb[1] - a[1]) / L]
          segs.push({ a, b: bb, t: th, ang })
          const ops = (sh.openings || [])
            .map(op => ({ s0: op.off - op.w / 2 - acc, s1: op.off + op.w / 2 - acc, y0: op.sill, y1: Math.min(h, op.sill + op.h) }))
            .filter(op => op.s1 > 0 && op.s0 < L)
            .sort((x, y) => x.s0 - y.s0)
          let cur = i === 1 ? -th / 2 : 0
          const end = i === sh.pts.length - 1 ? L + th / 2 : L
          for (const op of ops) {
            const s0 = Math.max(0, op.s0)
            const s1 = Math.min(L, op.s1)
            box(a, u, ang, cur, s0, 0, h)
            box(a, u, ang, s0, s1, 0, op.y0)
            box(a, u, ang, s0, s1, op.y1, h)
            cur = s1
          }
          box(a, u, ang, cur, end, 0, h)
          acc += L
        }
      } else if (it.kind === 'area') {
        const shape = new THREE.Shape(sh.pts.map(p => { const q = M(p); return new THREE.Vector2(q[0], -q[1]) }))
        const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(it.thickness || 0.02, 0.02), bevelEnabled: false })
        geo.rotateX(-Math.PI / 2)
        // A solid slab-like volume (floor, ceiling, slab); selection shows as a glow, not a colour wash.
        const amat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.85, side: THREE.DoubleSide, ...look(it) })
        if (selected) { amat.emissive = new THREE.Color(0xe11d48); amat.emissiveIntensity = 0.55 }
        const mesh = new THREE.Mesh(geo, amat)
        mesh.position.y = (it.elevation || 0) + o.elevationOf(sh.page)
        mesh.userData = { id: sh.id }
        g.add(mesh)
        const aed = new THREE.LineSegments(new THREE.EdgesGeometry(geo), selected ? selEdge : edgeMat)
        aed.position.copy(mesh.position)
        g.add(aed)
      }
    }
  }

  // Doors and windows sit in the nearest wall.
  for (const it of items) {
    if (it.kind !== 'count') continue
    const col = new THREE.Color(it.color)
    for (const sh of it.shapes) {
      if (!show(sh)) continue
      const p = M(sh.pts[0])
      let best: (typeof segs)[number] | null = null
      let bd = Infinity
      for (const sg of segs) { const d = segDist(p, sg.a, sg.b); if (d < bd) { bd = d; best = sg } }
      // Columns, footings, piles: their own section depth; wall points: the wall's thickness.
      const wt = it.depth ?? (best && bd < 0.5 ? best.t + 0.04 : 0.12)
      const ang = best && bd < 0.5 ? best.ang : 0
      const w = it.width || 0.8
      const h = it.height || 2.1
      const selected = !!sh.id && sh.id === o.selectedId
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, wt), new THREE.MeshStandardMaterial({ color: selected ? 0xe11d48 : col, ...look(it) }))
      mesh.position.set(p[0], (sh.sill != null ? sh.sill : it.sill || 0) + o.elevationOf(sh.page) + h / 2, p[1])
      mesh.rotation.y = -ang
      mesh.userData = { id: sh.id }
      g.add(mesh)
    }
  }

  // Doors and windows as real objects in their openings (frame, leaf / glass), not only holes in the wall.
  if (o.openings !== false) {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 0.6 })
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xb7793f, roughness: 0.7 })
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.45 })
    let owner: string | undefined
    const put = (geo: unknown, mat: unknown, at: Vec2, ang: number, along: number, y: number, across = 0) => {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.userData = { owner }
      const c = Math.cos(ang), sn = Math.sin(ang)
      mesh.position.set(at[0] + c * along - sn * across, y, at[1] + sn * along + c * across)
      mesh.rotation.y = -ang
      g.add(mesh)
    }
    for (const it of items) {
      if (it.kind !== 'linear' || it.struct) continue
      const wallT = Math.max(it.thickness || 0.1, 0.06)
      for (const sh of it.shapes) {
        if (!show(sh) || !sh.openings?.length) continue
        const base = (sh.zrel || 0) + o.elevationOf(sh.page)
        owner = sh.id
        for (const m of openingMarks(sh.pts, sh.openings, k)) {
          const op = sh.openings[m.index]
          if (!op || (op.kind !== 'door' && op.kind !== 'window')) continue
          const at = M([(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2])
          const ang = Math.atan2(m.u[1], m.u[0])
          const w = op.w, h = op.h, y0 = base + (op.sill || 0)
          const f = 0.05 // frame profile
          const depth = wallT + 0.02
          // Frame: two jambs and a head across the whole wall thickness (+ a sill for windows).
          put(new THREE.BoxGeometry(f, h, depth), frameMat, at, ang, -w / 2 + f / 2, y0 + h / 2)
          put(new THREE.BoxGeometry(f, h, depth), frameMat, at, ang, w / 2 - f / 2, y0 + h / 2)
          put(new THREE.BoxGeometry(w, f, depth), frameMat, at, ang, 0, y0 + h - f / 2)
          if (op.kind === 'door') {
            // Leaf, slightly open is hard to read in a takeoff: closed, flush with the frame.
            put(new THREE.BoxGeometry(Math.max(0.1, w - 2 * f), Math.max(0.1, h - f - 0.01), 0.04), leafMat, at, ang, 0, y0 + (h - f) / 2)
          } else {
            put(new THREE.BoxGeometry(w, f, depth + 0.04), frameMat, at, ang, 0, y0 + f / 2)
            put(new THREE.BoxGeometry(Math.max(0.1, w - 2 * f), Math.max(0.1, h - 2 * f), 0.012), glassMat, at, ang, 0, y0 + h / 2)
            put(new THREE.BoxGeometry(f * 0.6, Math.max(0.1, h - 2 * f), 0.03), frameMat, at, ang, 0, y0 + h / 2)
          }
        }
      }
    }
  }

  // Tags: only their anchor points here (the exact spot each one names); the labels and leader
  // lines are drawn flat on top of the picture by drawTagOverlay, laid out so none collide.
  const anchors: TagAnchor[] = []
  if (o.tags) {
    for (const it of items) {
      if (it.kind !== 'linear') {
        for (const sh of it.shapes) {
          const tag = sh.tags?.[0]
          if (!show(sh) || !tag || !sh.pts.length || (it.kind === 'area' && sh.pts.length < 3)) continue
          if (it.kind === 'area') {
            const ms = sh.pts.map(M)
            const at: Vec2 = [ms.reduce((t, q) => t + q[0], 0) / ms.length, ms.reduce((t, q) => t + q[1], 0) / ms.length]
            anchors.push({ id: `${sh.id || it.key}-a`, owner: sh.id, text: tag, color: it.color, p: [at[0], (it.elevation || 0) + o.elevationOf(sh.page) + Math.max(it.thickness || 0.02, 0.02), at[1]] })
          } else {
            const at = M(sh.pts[0])
            anchors.push({ id: `${sh.id || it.key}-c`, owner: sh.id, text: tag, color: it.color, p: [at[0], (sh.sill != null ? sh.sill : it.sill || 0) + o.elevationOf(sh.page) + (it.height || 2.1), at[1]] })
          }
        }
        continue
      }
      for (const [si, sh] of it.shapes.entries()) {
        if (!show(sh)) continue
        const base = (sh.zrel || 0) + o.elevationOf(sh.page)
        const wallTop = base + (shapeHeight(it, sh) || 2.8)
        for (let i = 1; i < sh.pts.length && sh.tags?.length; i++) {
          const tag = sh.tags[i - 1]
          if (!tag) continue
          const a = M(sh.pts[i - 1])
          const bb = M(sh.pts[i])
          if (Math.hypot(bb[0] - a[0], bb[1] - a[1]) < 0.3) continue
          anchors.push({ id: `${sh.id || it.key + si}-s${i}`, owner: sh.id, text: tag, color: it.color, p: [(a[0] + bb[0]) / 2, wallTop, (a[1] + bb[1]) / 2] })
        }
        if (!sh.openingTags?.length) continue
        for (const m of openingMarks(sh.pts, sh.openings, k)) {
          const tag = sh.openingTags[m.index]
          const op = sh.openings?.[m.index]
          if (!tag || !op) continue
          const at = M([(m.a[0] + m.b[0]) / 2, (m.a[1] + m.b[1]) / 2])
          anchors.push({ id: `${sh.id || it.key + si}-o${m.index}`, owner: sh.id, text: tag, color: m.kind === 'window' ? '#0284C7' : m.kind === 'door' ? '#B45309' : '#64748B', p: [at[0], base + (op.sill || 0) + (op.h || 2.1), at[1]] })
        }
      }
    }
  }

  // Plan underlay (half-tone PDF region) flat under its storey, the locations in colour on top.
  if (o.underlay) {
    const u = o.underlay
    const y0 = o.elevationOf(u.page) - 0.012
    const c = u.corners.map(M)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([c[0][0], y0, c[0][1], c[1][0], y0, c[1][1], c[2][0], y0, c[2][1], c[3][0], y0, c[3][1]], 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2))
    geo.setIndex([0, 2, 1, 0, 3, 2])
    const tex = new THREE.CanvasTexture(u.image)
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace
    const plane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true, opacity: 0.92, depthWrite: false }))
    plane.renderOrder = -2
    plane.raycast = () => {}
    // The framed region can be much larger than what is drawn: framing the picture ignores it.
    plane.userData = { noFit: true }
    g.add(plane)
    for (const z of o.zones || []) {
      if (z.pts.length < 3) continue
      const shape = new THREE.Shape(z.pts.map(p => { const q = M(p); return new THREE.Vector2(q[0], -q[1]) }))
      const zg = new THREE.ShapeGeometry(shape)
      zg.rotateX(-Math.PI / 2)
      const zm = new THREE.Mesh(zg, new THREE.MeshBasicMaterial({ color: z.color, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }))
      zm.position.y = o.elevationOf(z.page) - 0.006
      zm.renderOrder = -1
      zm.raycast = () => {}
      g.add(zm)
      const ring = z.pts.map(p => { const q = M(p); return new THREE.Vector3(q[0], o.elevationOf(z.page) - 0.004, q[1]) })
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineBasicMaterial({ color: z.color }))
      line.raycast = () => {}
      g.add(line)
      if (o.tags && z.name) {
        const ms = z.pts.map(M)
        anchors.push({ id: `zone-${z.page}-${z.name}-${ms.length}-${Math.round(ms[0][0] * 100)}`, text: z.name, color: z.color, p: [ms.reduce((t, q) => t + q[0], 0) / ms.length, o.elevationOf(z.page) + 0.06, ms.reduce((t, q) => t + q[1], 0) / ms.length] })
      }
    }
  }

  if (o.grid === false) return anchors
  const span = Math.max((b.x1 - b.x0) / k, (b.y1 - b.y0) / k, 4)
  const grid = new THREE.GridHelper(Math.ceil(span * 1.4), Math.ceil(span * 1.4), 0x7a8590, 0x9aa4ae)
  grid.material.transparent = true
  grid.material.opacity = 0.35
  g.add(grid)
  return anchors
}

/** Framing + Face A + Face B as separate solids, optionally pulled apart (exploded). */
function addLayered(s: Scene, it: TakeoffItem, sh: TakeoffShape, M: (p: Vec2) => Vec2, k: number, segs: { a: Vec2; b: Vec2; t: number; ang: number }[], selected: boolean, ex: number, junctions: Junction[], baseElevation = 0, boards: BoardSides = 'both') {
  const { THREE, group: g } = s
  const F = it.framing!
  const lay = layoutWall(it, sh, k)
  const z0 = (sh.zrel || 0) + baseElevation
  const core = coreWidthM(it)
  const tb = 0.0125
  const P: { a: Vec2; u: Vec2; ang: number; s0: number; s1: number }[] = []
  let acc = 0
  for (let i = 1; i < sh.pts.length; i++) {
    const a = M(sh.pts[i - 1])
    const b = M(sh.pts[i])
    const L = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (L < 1e-3) continue
    const u: Vec2 = [(b[0] - a[0]) / L, (b[1] - a[1]) / L]
    P.push({ a, u, ang: Math.atan2(u[1], u[0]), s0: acc, s1: acc + L })
    segs.push({ a, b, t: core + 2 * tb, ang: Math.atan2(u[1], u[0]) })
    acc += L
  }
  if (!P.length) return
  const segAt = (x: number) => P.find(p => x >= p.s0 - 1e-6 && x <= p.s1 + 1e-6) || P[P.length - 1]
  const mats: Record<string, any> = {}
  const tr = Math.max(0, Math.min(0.9, it.transparency || 0))
  const mat = (c: string, op0 = 1) => {
    const op = op0 * (1 - tr)
    const key = `${c}|${op}`
    if (!mats[key]) mats[key] = new THREE.MeshStandardMaterial({ color: new THREE.Color(c), roughness: 0.7, metalness: c === '#A7B1BB' ? 0.45 : 0, transparent: op < 1, opacity: op, depthWrite: op >= 1 })
    return mats[key]
  }
  const edge = new THREE.LineBasicMaterial({ color: selected ? 0xe11d48 : 0x334155, transparent: true, opacity: selected ? 0.9 : 0.55 })
  const put = (x0: number, x1: number, y0: number, y1: number, nOff: number, depth: number, m: any, edges: boolean) => {
    const sg = segAt((x0 + x1) / 2)
    const len = x1 - x0
    if (len < 1e-3 || y1 - y0 < 1e-3) return
    const geo = new THREE.BoxGeometry(len, y1 - y0, depth)
    const mesh = new THREE.Mesh(geo, m)
    const c = (x0 + x1) / 2 - sg.s0
    const n = [-sg.u[1], sg.u[0]]
    mesh.position.set(sg.a[0] + sg.u[0] * c + n[0] * nOff, z0 + (y0 + y1) / 2, sg.a[1] + sg.u[1] * c + n[1] * nOff)
    mesh.rotation.y = -sg.ang
    mesh.userData = { id: sh.id }
    g.add(mesh)
    if (edges) {
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge)
      e.position.copy(mesh.position)
      e.rotation.copy(mesh.rotation)
      g.add(e)
    }
  }
  const steel = mat('#A7B1BB')
  const hdr = mat('#8B95A0')
  for (const st of lay.studs) put(st.x - 0.024, st.x + 0.024, st.y0, st.y1, 0, core, steel, false)
  // Extra corner / T-junction studs, 5 cm apart around the meeting point.
  const junctionSteel = mat('#DC2626')
  for (const j of junctionStudsOnWall(junctions, sh, k)) {
    for (let n = 0; n < j.studs; n++) {
      const x = Math.max(0.024, Math.min(lay.L - 0.024, j.x + (n - (j.studs - 1) / 2) * 0.05))
      put(x - 0.024, x + 0.024, 0, lay.H, 0, core, junctionSteel, false)
    }
  }
  for (const tr of lay.tracks) put(tr.x0, tr.x1, tr.y - (tr.y > 0 ? 0.03 : 0), tr.y + (tr.y > 0 ? 0 : 0.03), 0, core, steel, false)
  for (const h of lay.headers) put(h.x0, h.x1, h.y - 0.015, h.y + 0.015, 0, core, hdr, false)
  const ops = lay.segs.flatMap(sg => sg.ops.map(op => ({ x0: sg.start + op.x0, x1: sg.start + op.x1, y0: op.y0, y1: op.y1 })))
  for (const [f, sgn] of [['A', 1], ['B', -1]] as const) {
    if (boards === 'none' || (boards === 'A' && f === 'B') || (boards === 'B' && f === 'A')) continue
    const name = (f === 'A' ? sh.faceA : sh.faceB) || lay.boardName[f]
    const m = mat(boardColor(name), 0.97)
    const nl = f === 'A' ? F.layersA : F.layersB
    for (const bd of lay.board[f]) {
      const ly = bd.layer || 0
      if (ly >= nl) continue
      let rs = [{ x0: bd.x0, x1: bd.x1, y0: bd.y0, y1: bd.y1 }]
      for (const op of ops) {
        const nx: typeof rs = []
        for (const r of rs) {
          if (op.x1 <= r.x0 || op.x0 >= r.x1 || op.y1 <= r.y0 || op.y0 >= r.y1) { nx.push(r); continue }
          if (op.x0 > r.x0) nx.push({ ...r, x1: op.x0 })
          if (op.x1 < r.x1) nx.push({ ...r, x0: op.x1 })
          const mx0 = Math.max(r.x0, op.x0)
          const mx1 = Math.min(r.x1, op.x1)
          if (op.y0 > r.y0) nx.push({ x0: mx0, x1: mx1, y0: r.y0, y1: op.y0 })
          if (op.y1 < r.y1) nx.push({ x0: mx0, x1: mx1, y0: op.y1, y1: r.y1 })
        }
        rs = nx
      }
      rs.forEach((r, i) => put(r.x0 + 0.002, r.x1 - 0.002, r.y0 + 0.002, r.y1 - 0.002, sgn * (core / 2 + tb / 2 + ly * tb + ex), tb, m, i === 0 && rs.length === 1))
    }
  }
}

/** Board sides shown in Construction layers: both, one side, or none (framing only). */
const BOARD_SIDES = ['both', 'A', 'B', 'none'] as const
type BoardSides = (typeof BOARD_SIDES)[number]

const checkRow = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#294955', cursor: 'pointer' } as const

/**
 * Renders the model once, off screen, from the default 3D view angle, for printing.
 * Returns PNG bytes, or null when WebGL or three.js is not available.
 */
/** A tag's exact spot in the model (world coordinates) with its text and colour. */
export type TagAnchor = { id: string; text: string; color: string; p: [number, number, number]; /** Element the anchor sits on (its own surfaces don't hide it). */ owner?: string }

/**
 * Draws the tags on a 2D canvas over the 3D picture: each label placed so labels, anchors and
 * leader lines never collide (layoutLabels), with a leader line down to a dot on its spot.
 */
function drawTagOverlay(ctx: CanvasRenderingContext2D, THREE: Three, cam: any, anchors: TagAnchor[], width: number, height: number, scale: number, group?: any) {
  ctx.clearRect(0, 0, width, height)
  if (!anchors.length) return
  const fontPx = 11 * scale
  ctx.font = `700 ${fontPx}px system-ui, -apple-system, Segoe UI, sans-serif`
  const v = new THREE.Vector3()
  const ins: (LabelIn & { a: TagAnchor })[] = []
  // Tags whose spot is hidden behind something (a wall in front of a room…) are left out:
  // a ray from the camera to the spot must not hit another element first.
  const solids: any[] = []
  group?.traverse((c: any) => { if (c.isMesh && !c.userData?.noFit && c.material && !c.material.transparent) solids.push(c) })
  const ray = new THREE.Raycaster()
  const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld)
  const hidden = (a: TagAnchor) => {
    if (!solids.length) return false
    const target = new THREE.Vector3(a.p[0], a.p[1], a.p[2])
    const dir = target.clone().sub(camPos)
    const dist = dir.length()
    ray.set(camPos, dir.normalize())
    ray.far = dist - 0.03
    for (const h of ray.intersectObjects(solids, false)) {
      const ud = h.object.userData || {}
      if (a.owner && (ud.id === a.owner || ud.owner === a.owner)) continue
      return true
    }
    return false
  }
  for (const a of anchors) {
    if (hidden(a)) continue
    v.set(a.p[0], a.p[1], a.p[2]).project(cam)
    if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.02 || Math.abs(v.y) > 1.02) continue
    ins.push({ id: a.id, a, x: (v.x + 1) / 2 * width, y: (1 - v.y) / 2 * height, w: ctx.measureText(a.text).width + 12 * scale, h: 17 * scale })
  }
  const placed = layoutLabels(ins, width, height, scale)
  // Leaders and dots first, labels on top.
  for (const l of placed) {
    const a = (l as LabelOut & { a: TagAnchor }).a
    ctx.strokeStyle = a.color
    ctx.lineWidth = 1.4 * scale
    ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.lx, l.ly); ctx.stroke()
    ctx.fillStyle = a.color
    ctx.beginPath(); ctx.arc(l.x, l.y, 3.2 * scale, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1 * scale; ctx.stroke()
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const l of placed) {
    const a = (l as LabelOut & { a: TagAnchor }).a
    const x0 = l.bx - l.w / 2, y0 = l.by - l.h / 2, r = 3 * scale
    ctx.beginPath()
    ctx.moveTo(x0 + r, y0); ctx.lineTo(x0 + l.w - r, y0); ctx.quadraticCurveTo(x0 + l.w, y0, x0 + l.w, y0 + r)
    ctx.lineTo(x0 + l.w, y0 + l.h - r); ctx.quadraticCurveTo(x0 + l.w, y0 + l.h, x0 + l.w - r, y0 + l.h)
    ctx.lineTo(x0 + r, y0 + l.h); ctx.quadraticCurveTo(x0, y0 + l.h, x0, y0 + l.h - r)
    ctx.lineTo(x0, y0 + r); ctx.quadraticCurveTo(x0, y0, x0 + r, y0)
    ctx.fillStyle = 'rgba(255,255,255,0.96)'; ctx.fill()
    ctx.strokeStyle = a.color; ctx.lineWidth = 1.6 * scale; ctx.stroke()
    ctx.fillStyle = '#173441'
    ctx.fillText(a.text, l.bx, l.by + 0.5 * scale)
  }
}

export async function render3DImage(opts: { items: TakeoffItem[]; ptPerM: number; storeys?: View3DStorey[]; width: number; height: number; layered?: boolean; tags?: boolean; underlay?: LoadedUnderlay | null; zones?: UnderlayZone[]; grid?: boolean; view?: View3DCamera | null }): Promise<Uint8Array | null> {
  const { items, ptPerM, storeys, width, height, layered = true, tags = false, underlay = null, zones = [], grid = true, view = null } = opts
  if (!ptPerM || !items.some(it => it.shapes.length)) return null
  let THREE: Three
  try { THREE = await loadThree() } catch { return null }
  let renderer: any = null
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(width, height, false)
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#ffffff')
    const cam = new THREE.PerspectiveCamera(40, width / height, 0.1, 2000)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x88939e, 0.85))
    const dl = new THREE.DirectionalLight(0xffffff, 0.55)
    dl.position.set(-15, 30, 20)
    scene.add(dl)
    const group = new THREE.Group()
    scene.add(group)
    const target = new THREE.Vector3()
    const ctl = { target, update: () => cam.lookAt(target) }
    const s: Scene = { THREE, renderer, scene, cam, ctl, group, raf: 0 }
    const elev = new Map((storeys || []).map(st => [st.page, st.elevation]))
    const elevationOf = (page: number) => elev.get(page) || 0
    const anchors = build(s, items, ptPerM, { selectedId: null, layered, explode: 0, isolate: false, elevationOf, center: items, tags, grid, underlay, zones: underlay ? zones.filter(z => z.page === underlay.page) : [] })
    const tgt = fitWhole(THREE, cam, group, width / height, view)
    if (tags && anchors.length && tgt) {
      // A little more room around the model for the labels above it.
      cam.position.sub(tgt).multiplyScalar(1.06).add(tgt)
      cam.updateMatrixWorld()
    }
    renderer.render(scene, cam)
    let url: string
    if (tags && anchors.length) {
      // Labels drawn flat over the picture (same size everywhere, never colliding): ~9 pt on the A4 page.
      const out = document.createElement('canvas')
      out.width = width
      out.height = height
      const ctx = out.getContext('2d')!
      const over = document.createElement('canvas')
      over.width = width
      over.height = height
      drawTagOverlay(over.getContext('2d')!, THREE, cam, anchors, width, height, width / 900, group)
      ctx.drawImage(renderer.domElement, 0, 0)
      ctx.drawImage(over, 0, 0)
      url = out.toDataURL('image/png')
    } else url = renderer.domElement.toDataURL('image/png')
    clearGroup(group)
    const bin = atob(url.slice(url.indexOf(',') + 1))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytes
  } catch {
    return null
  } finally {
    renderer?.dispose?.()
    renderer?.forceContextLoss?.()
  }
}

/**
 * Frames the whole model (all storeys, full height; the ground grid is ignored) from the usual
 * 3D view angle: the model's 8 bounding-box corners are projected and the camera is moved
 * until they all sit inside the picture with a small margin.
 */
function fitWhole(THREE: Three, cam: any, group: any, aspect: number, view?: View3DCamera | null) {
  const box = new THREE.Box3()
  for (const c of group.children) if (c.type !== 'GridHelper' && !c.userData?.noFit) box.expandByObject(c)
  if (box.isEmpty()) return null
  const center = box.getCenter(new THREE.Vector3())
  const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 1)
  const dir = view ? new THREE.Vector3(...cameraDir(view)) : new THREE.Vector3(-0.55, 0.65, 0.9).normalize()
  cam.aspect = aspect
  const corners: any[] = []
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z))
  let target = center.clone()
  let dist = radius / Math.sin((Math.min(cam.fov, (2 * Math.atan(Math.tan((cam.fov * Math.PI) / 360) * aspect) * 180) / Math.PI) * Math.PI) / 360)
  const place = () => {
    cam.position.copy(target).addScaledVector(dir, dist)
    cam.near = Math.max(0.05, dist / 200)
    cam.far = dist * 50 + radius * 10
    cam.updateProjectionMatrix()
    cam.lookAt(target)
    cam.updateMatrixWorld()
  }
  // A few passes: centre the projected box, then scale the distance so it fills ~90% of the frame.
  for (let i = 0; i < 6; i++) {
    place()
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (const c of corners) {
      const p = c.clone().project(cam)
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
    }
    // Shift the target toward the middle of what is seen (in camera space).
    const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1)
    const halfH = Math.tan((cam.fov * Math.PI) / 360) * dist
    target = target.clone().addScaledVector(right, ((x0 + x1) / 2) * halfH * aspect).addScaledVector(up, ((y0 + y1) / 2) * halfH)
    const extent = Math.max((x1 - x0) / 2, (y1 - y0) / 2)
    if (extent > 0) dist *= extent / 0.94
  }
  if (view && view.zoom > 0) dist /= view.zoom
  place()
  return target
}

/**
 * A view of the model for pictures (field sheet): where the camera looks from — azimuth (degrees, 0 = from the
 * bottom of the sheet, clockwise seen from above) and elevation (degrees above the floor) — and a zoom on the fitted
 * frame (1 = the whole model fills the picture).
 */
export type View3DCamera = { azimuth: number; elevation: number; zoom: number }
/** The usual 3D view angle (from the bottom-left of the sheet, about 32° up). */
export const DEFAULT_VIEW3D: View3DCamera = { azimuth: 329, elevation: 32, zoom: 1 }
/** Unit vector from the target to the camera for a view (x right, y up, z towards the bottom of the sheet). */
export function cameraDir(v: Pick<View3DCamera, 'azimuth' | 'elevation'>): [number, number, number] {
  const az = (v.azimuth * Math.PI) / 180, el = (Math.max(1, Math.min(89.5, v.elevation)) * Math.PI) / 180
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]
}
/** The view a camera direction stands for (the inverse of cameraDir); zoom kept at 1. */
export function viewOfDir(d: [number, number, number]): View3DCamera {
  const L = Math.hypot(d[0], d[1], d[2]) || 1
  const az = (Math.atan2(d[0] / L, d[2] / L) * 180) / Math.PI
  return { azimuth: Math.round(((az % 360) + 360) % 360), elevation: Math.round((Math.asin(Math.max(-1, Math.min(1, d[1] / L))) * 180) / Math.PI), zoom: 1 }
}
