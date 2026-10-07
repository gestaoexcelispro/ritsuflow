'use client'

// Task view: draw where one scope item is built in one location (e.g. the framing in Room 1).
// Opened from Projects › Locations › Scope allocation ("Draw in RitsuScope"). The sheet is framed on
// the room's zone plus 1 m around it; the takeoff walls are a faint, locked background (they can be
// hidden). Lines are saved to location_task_drawings, never to the takeoff.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { AppBar } from '../../../fieldop/ui'
import { createClient } from '@/lib/supabase/client'
import { useT } from '@/lib/i18n/useT'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import type { TakeoffItem, Vec2 } from '@/lib/takeoff/geometry'
import { rowsToItems, type ElementRow, type LayerRow } from '@/lib/takeoff/rows'
import { wallHeightOf, type LevelRow } from '@/lib/takeoff/levels'
import { frameOf, measureTaskLines, takeWallAt, type Box, type TaskDrawingRow, type WallRef } from '@/lib/takeoff/taskDrawings'
import PdfSheet from '../PdfSheet'
import styles from './task.module.css'

const BUCKET = 'takeoff-files'
const TASK_COLOR = '#E11D48'
const LAYER_COLUMNS = 'id, project_id, kind, name, system, color, thickness_m, height_m, elevation_m, deduct_openings, framing, is_visible, sort_order, recipe_id, wall_type_id'
const ELEMENT_COLUMNS = 'id, project_id, layer_id, source_id, points, height_override_m, z_rel_m, ifc_guid, root_guid, layer_guids, openings, faces'
const PAD = 240 // free space around the sheet (px) so the frame can sit in the middle near the edges

type Mode = 'draw' | 'take' | 'select'
type Loaded = {
  scope: { id: string; scope_code: string | null; scope_name: string; unit: string | null; quantity: number | null; takeoff_layer_id: string | null }
  location: { id: string; name: string }
  zone: { id: string; name: string; points: Vec2[]; source_id: string }
  sheet: { id: string; name: string; file_path: string; page_number: number | null; scale_pt_per_m: number | null; level_id: string | null }
  url: string
  layers: LayerRow[]
  elements: ElementRow[]
  others: TaskDrawingRow[]
  locationNames: Map<string, string>
  defaultHeight: number | null
}

export default function TaskViewPage() {
  return <Suspense fallback={null}><TaskView /></Suspense>
}

function TaskView() {
  const t = useT('projects')
  const { language } = useLanguage()
  const { projectId } = useParams<{ projectId: string }>()
  const search = useSearchParams()
  const scopeId = search.get('scope') || ''
  const locationId = search.get('location') || ''
  const supabase = useMemo(() => createClient(), [])
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [lines, setLines] = useState<Vec2[][]>([])
  const [savedJson, setSavedJson] = useState('[]')
  const [draft, setDraft] = useState<Vec2[]>([])
  const [mode, setMode] = useState<Mode>('take')
  const [showWalls, setShowWalls] = useState(true)
  const [snapOn, setSnapOn] = useState(true)
  const [orthoOn, setOrthoOn] = useState(false)
  const [selected, setSelected] = useState<number | null>(null)
  const [height, setHeight] = useState('')
  const [savedHeight, setSavedHeight] = useState('')
  const [zoom, setZoom] = useState(1)
  const [pageSize, setPageSize] = useState<{ width: number; height: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const framed = useRef(false)

  const fmt = useCallback((v: number, d = 2) => new Intl.NumberFormat(language, { maximumFractionDigits: d, minimumFractionDigits: d }).format(v), [language])
  const backHref = `/projects/${projectId}/locations?tab=allocation&scope=${scopeId}`

  // ---------- load ----------
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [s, l, z] = await Promise.all([
          supabase.from('project_scopes').select('id, scope_code, scope_name, unit, quantity, takeoff_layer_id').eq('id', scopeId).maybeSingle(),
          supabase.from('locations').select('id, name').eq('id', locationId).maybeSingle(),
          supabase.from('takeoff_zones').select('id, name, points, source_id').eq('project_id', projectId).eq('location_id', locationId),
        ])
        const err = s.error || l.error || z.error
        if (err) throw err
        if (!s.data || !l.data) throw new Error(t('task.errMissing'))
        const zone = (z.data || []).find((row) => Array.isArray(row.points) && row.points.length >= 3)
        if (!zone) { if (alive) setError(t('task.errNoZone', { name: l.data.name })); return }
        const { data: sheet, error: se } = await supabase.from('takeoff_sources').select('id, name, file_path, page_number, scale_pt_per_m, level_id').eq('id', zone.source_id).maybeSingle()
        if (se || !sheet) throw se || new Error(t('task.errMissing'))
        const [signed, layers, elements, tasks, level, locs] = await Promise.all([
          supabase.storage.from(BUCKET).createSignedUrl(sheet.file_path, 3600),
          supabase.from('takeoff_layers').select(LAYER_COLUMNS).eq('project_id', projectId).order('sort_order'),
          supabase.from('takeoff_elements').select(ELEMENT_COLUMNS).eq('project_id', projectId).eq('source_id', sheet.id),
          supabase.from('location_task_drawings').select('*').eq('project_id', projectId).eq('scope_item_id', scopeId),
          sheet.level_id ? supabase.from('takeoff_levels').select('height_m, slab_m').eq('id', sheet.level_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
          supabase.from('locations').select('id, name').eq('project_id', projectId),
        ])
        const e2 = signed.error || layers.error || elements.error || tasks.error || level.error || locs.error
        if (e2) throw e2
        const layerRows = (layers.data || []) as unknown as LayerRow[]
        const own = layerRows.find((x) => x.id === s.data!.takeoff_layer_id)
        const defaultHeight = (own?.height_m && own.height_m > 0 ? Number(own.height_m) : null) ?? wallHeightOf(level.data as Pick<LevelRow, 'height_m' | 'slab_m'> | null)
        const rows = (tasks.data || []) as TaskDrawingRow[]
        const mine = rows.filter((r) => r.location_id === locationId && r.source_id === sheet.id).map((r) => r.points)
        if (!alive) return
        setData({
          scope: s.data, location: l.data, zone: zone as Loaded['zone'], sheet, url: signed.data!.signedUrl,
          layers: layerRows, elements: (elements.data || []) as unknown as ElementRow[],
          others: rows.filter((r) => r.location_id !== locationId && r.source_id === sheet.id),
          locationNames: new Map((locs.data || []).map((x) => [x.id, x.name])),
          defaultHeight,
        })
        setLines(mine); setSavedJson(JSON.stringify(mine))
        const initialHeight = rows.find((r) => r.location_id === locationId && r.height_m)?.height_m
        const h = initialHeight ? String(initialHeight) : defaultHeight ? String(defaultHeight) : ''
        setHeight(h); setSavedHeight(h)
      } catch (e) { if (alive) setError((e as Error)?.message || String(e)) }
    })()
    return () => { alive = false }
  }, [supabase, projectId, scopeId, locationId, t])

  const ptPerM = Number(data?.sheet.scale_pt_per_m) || 0
  const roomBox: Box | null = useMemo(() => (data ? frameOf(data.zone.points, ptPerM, 0) : null), [data, ptPerM])
  const frame: Box | null = useMemo(() => (data ? frameOf(data.zone.points, ptPerM, 1) : null), [data, ptPerM])
  const takeoffItems: TakeoffItem[] = useMemo(() => (data ? rowsToItems(data.layers, data.elements, new Map([[data.sheet.id, 1]])) : []), [data])
  const walls: WallRef[] = useMemo(() => takeoffItems.flatMap((it) => it.shapes.map((sh) => ({ pts: sh.pts, openings: sh.openings, kind: it.kind }))), [takeoffItems])

  // ---------- frame the room + 1 m ----------
  const fitFrame = useCallback(() => {
    const el = scrollRef.current
    if (!el || !frame) return
    const fw = Math.max(1, frame[2] - frame[0]), fh = Math.max(1, frame[3] - frame[1])
    const z = Math.max(0.1, Math.min(8, Math.min(el.clientWidth / fw, el.clientHeight / fh)))
    setZoom(z)
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.scrollLeft = PAD + frame[0] * z - (el.clientWidth - fw * z) / 2
      el.scrollTop = PAD + frame[1] * z - (el.clientHeight - fh * z) / 2
    }))
  }, [frame])
  useEffect(() => { if (pageSize && frame && !framed.current) { framed.current = true; fitFrame() } }, [pageSize, frame, fitFrame])
  function zoomBy(f: number) {
    const el = scrollRef.current
    if (!el) { setZoom((z) => Math.max(0.1, Math.min(8, z * f))); return }
    const cx = (el.scrollLeft + el.clientWidth / 2 - PAD) / zoom, cy = (el.scrollTop + el.clientHeight / 2 - PAD) / zoom
    const z = Math.max(0.1, Math.min(8, zoom * f))
    setZoom(z)
    requestAnimationFrame(() => { el.scrollLeft = PAD + cx * z - el.clientWidth / 2; el.scrollTop = PAD + cy * z - el.clientHeight / 2 })
  }

  // ---------- drawing ----------
  function onPoint(p: Vec2) {
    setNotice('')
    if (mode === 'draw') { setDraft((d) => [...d, p]); return }
    if (mode === 'take' && roomBox) {
      const seg = takeWallAt(p, walls, roomBox, ptPerM)
      if (seg) setLines((ls) => [...ls, [seg[0], seg[1]]])
      else setNotice(t('task.noWallHere'))
    }
  }
  function finishDraft() {
    if (draft.length >= 2) { const line = draft; setLines((ls) => [...ls, line]) }
    setDraft([])
  }
  function removeSelected() { if (selected == null) return; setLines((ls) => ls.filter((_, i) => i !== selected)); setSelected(null) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'Escape') { setDraft([]); setSelected(null) }
      if (e.key === 'Enter') finishDraft()
      if (e.key === 'Backspace' && draft.length) { e.preventDefault(); setDraft((d) => d.slice(0, -1)) }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !draft.length && selected != null) { e.preventDefault(); removeSelected() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- quantity ----------
  const heightM = Number(height) > 0 ? Number(height) : null
  const measured = useMemo(() => measureTaskLines(lines, { ptPerM, heightM, unit: data?.scope.unit, walls }), [lines, ptPerM, heightM, data, walls])
  const needsHeight = measured.measure === 'wallArea' && !heightM && lines.length > 0
  const dirty = JSON.stringify(lines) !== savedJson || (lines.length > 0 && height !== savedHeight)

  async function save(goBack: boolean) {
    if (!data || saving || needsHeight) return
    setSaving(true); setError('')
    try {
      const { error: de } = await supabase.from('location_task_drawings').delete().eq('project_id', projectId).eq('scope_item_id', scopeId).eq('location_id', locationId).eq('source_id', data.sheet.id)
      if (de) throw de
      if (lines.length) {
        const rows = lines.map((pts) => {
          const m = measureTaskLines([pts], { ptPerM, heightM, unit: data.scope.unit, walls })
          return { project_id: projectId, scope_item_id: scopeId, location_id: locationId, source_id: data.sheet.id, points: pts, height_m: m.measure === 'wallArea' ? heightM : null, quantity: Math.round(m.quantity * 10000) / 10000, unit: data.scope.unit }
        })
        const { error: ie } = await supabase.from('location_task_drawings').insert(rows)
        if (ie) throw ie
      }
      setSavedJson(JSON.stringify(lines)); setSavedHeight(height)
      if (goBack) window.location.href = `${backHref}&drawn=${locationId}`
      else setNotice(t('task.saved'))
    } catch (e) { setError((e as Error)?.message || String(e)) } finally { setSaving(false) }
  }

  // ---------- render ----------
  const items: TakeoffItem[] = useMemo(() => {
    const out: TakeoffItem[] = []
    if (showWalls) out.push(...takeoffItems.map((it) => ({ ...it, planTransparency: 0.8, shapes: it.shapes.map((sh) => ({ ...sh, id: `w:${sh.id || ''}` })) })))
    if (data?.others.length) out.push({ key: '__others', kind: 'linear', name: '', system: '', color: '#64748B', thickness: 0.06, planTransparency: 0.45, shapes: data.others.map((r) => ({ id: `o:${r.id}`, page: 1, pts: r.points })) })
    out.push({ key: '__task', kind: 'linear', name: data?.scope.scope_name || '', system: '', color: TASK_COLOR, thickness: 0.1, planTransparency: 0, shapes: lines.map((pts, i) => ({ id: `t:${i}`, page: 1, pts })) })
    return out
  }, [showWalls, takeoffItems, data, lines])

  if (error && !data) return <div className={styles.page}>
    <AppBar module="ritsuscope" compact standalone title={t('task.title')} />
    <div className={styles.errorBox}><p>{error}</p><div><Link href={backHref} className={styles.btn}>{t('task.back')}</Link> <Link href={`/ritsuscope/${projectId}`} className={styles.btnPrimary}>{t('task.openRitsuScope')}</Link></div></div>
  </div>
  if (!data) return <div className={styles.page}><AppBar module="ritsuscope" compact standalone title={t('task.title')} /><p className={styles.muted}>{t('task.loading')}</p></div>

  const unitLabel = measured.measure === 'wallArea' ? 'm²' : measured.measure === 'length' ? 'm' : data.scope.unit || ''
  const otherNames = [...new Set(data.others.map((r) => data.locationNames.get(r.location_id)).filter(Boolean))]

  return <div className={styles.page}>
    <AppBar module="ritsuscope" compact standalone title={t('task.title')} />
    <header className={styles.head}>
      <Link href={backHref} className={styles.back}>← {t('task.back')}</Link>
      <div className={styles.title}>
        <small>{data.scope.scope_code} · {t('task.in', { location: data.location.name })} · {data.sheet.name}</small>
        <h1>{data.scope.scope_name}</h1>
      </div>
      <div className={styles.total}>
        <span>{t('task.drawnHere')}</span>
        <b>{fmt(measured.quantity)} {unitLabel}</b>
        {measured.measure === 'wallArea' && lines.length > 0 ? <small>{t('task.breakdown', { length: fmt(measured.length), height: heightM ? fmt(heightM) : '—', openings: fmt(measured.openings) })}</small> : null}
      </div>
    </header>

    <div className={styles.toolbar}>
      <div className={styles.segments} role="group">
        {(['take', 'draw', 'select'] as Mode[]).map((m) => <button key={m} type="button" className={mode === m ? styles.on : ''} onClick={() => { setMode(m); setDraft([]); setSelected(null) }} title={t(`task.mode.${m}Hint`)}>{t(`task.mode.${m}`)}</button>)}
      </div>
      {mode === 'draw' ? <span className={styles.hint}>{t('task.drawHint')}</span> : mode === 'take' ? <span className={styles.hint}>{t('task.takeHint')}</span> : <span className={styles.hint}>{t('task.selectHint')}</span>}
      {mode === 'draw' && draft.length >= 2 ? <button type="button" className={styles.btn} onClick={finishDraft}>{t('task.finishLine')}</button> : null}
      {mode === 'select' && selected != null ? <button type="button" className={styles.btnDanger} onClick={removeSelected}>{t('task.deleteLine')}</button> : null}
      <span className={styles.spacer} />
      {measured.measure === 'wallArea' ? <label className={`${styles.height} ${needsHeight ? styles.bad : ''}`}>{t('task.height')}<input type="number" min="0" step="0.01" value={height} onChange={(e) => setHeight(e.target.value)} /> m</label> : null}
      <label className={styles.check}><input type="checkbox" checked={showWalls} onChange={(e) => setShowWalls(e.target.checked)} />{t('task.showWalls')}</label>
      <label className={styles.check}><input type="checkbox" checked={snapOn} onChange={(e) => setSnapOn(e.target.checked)} />{t('task.snap')}</label>
      <label className={styles.check}><input type="checkbox" checked={orthoOn} onChange={(e) => setOrthoOn(e.target.checked)} />{t('task.ortho')}</label>
      <div className={styles.zoom}>
        <button type="button" onClick={() => zoomBy(1 / 1.25)} aria-label={t('task.zoomOut')}>−</button>
        <button type="button" onClick={fitFrame}>{t('task.frameRoom')}</button>
        <button type="button" onClick={() => zoomBy(1.25)} aria-label={t('task.zoomIn')}>+</button>
      </div>
    </div>

    <div className={styles.canvas} ref={scrollRef}>
      <div style={{ padding: PAD, display: 'inline-block' }}>
        <div className={styles.sheet}>
          <PdfSheet
            url={data.url}
            pageNumber={data.sheet.page_number || 1}
            zoom={zoom}
            items={items}
            calibration={[]}
            draft={mode === 'draw' ? draft : []}
            draftKind="linear"
            draftColor={TASK_COLOR}
            crosshair={mode !== 'select'}
            ptPerM={ptPerM}
            fmt={(v) => fmt(v)}
            snap={snapOn}
            ortho={orthoOn}
            selectable={mode === 'select'}
            selectedId={selected != null ? `t:${selected}` : null}
            onSelect={(id) => setSelected(id && id.startsWith('t:') ? Number(id.slice(2)) : null)}
            onSize={setPageSize}
            onPoint={onPoint}
            onFinish={finishDraft}
            onError={(m) => setError(m)}
            loadingLabel={t('task.loadingSheet')}
            zones={[{ id: data.zone.id, name: data.location.name, color: '#0EA5E9', pts: data.zone.points, label: data.location.name, selected: false }]}
          />
        </div>
      </div>
    </div>

    <footer className={styles.foot}>
      <span className={error ? styles.bad : styles.muted}>
        {error || notice || (needsHeight ? t('task.needsHeight') : !ptPerM ? t('task.noScale') : otherNames.length ? t('task.othersDrawn', { locations: otherNames.join(', ') }) : t('task.footHint'))}
      </span>
      <div>
        <button type="button" className={styles.btn} disabled={!lines.length} onClick={() => { setLines([]); setSelected(null) }}>{t('task.clearAll')}</button>
        <button type="button" className={styles.btn} disabled={saving || needsHeight || !dirty} onClick={() => void save(false)}>{saving ? t('task.saving') : t('task.save')}</button>
        <button type="button" className={styles.btnPrimary} disabled={saving || needsHeight} onClick={() => void save(true)}>{t('task.saveBack')}</button>
      </div>
    </footer>
  </div>
}
