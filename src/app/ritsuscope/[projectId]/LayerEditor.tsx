'use client'

import { FormEvent, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { DEFAULT_CORNER_STUDS, DEFAULT_LA_PER_STUD_END, DEFAULT_SCREW_SPACING, DEFAULT_TEE_STUDS, defaultFraming, framingLabelsPtBR, parseBars } from '@/lib/takeoff/framing/framing'
import { importLabelsEnUS } from '@/lib/takeoff/ifc/importIfcModel'
import type { FramingConfig } from '@/lib/takeoff/geometry'
import type { LayerRow } from '@/lib/takeoff/rows'
import type { Recipe } from '@/lib/takeoff/recipes'
import { ui } from '../ui'

type Props = { layer: LayerRow; recipes: Recipe[]; onSaved: () => Promise<void> | void; onClose: () => void }

type Form = {
  name: string
  color: string
  height: string
  /** Count items: width along the wall (metres). */
  width: string
  /** Structural points (columns, footings): section depth (metres). */
  depth: string
  thickness: string
  elevation: string
  transparency: number
  deductOpenings: boolean
  recipeId: string
  framingOn: boolean
  spacing: string
  bars: string
  studName: string
  trackName: string
  boardW: string
  boardH: string
  boardA: string
  boardB: string
  layersA: string
  layersB: string
  doorJamb: string
  winJamb: string
  cornerStuds: string
  teeStuds: string
  screwsFromLayout: boolean
  screwSpacing: string
  laPerStudEnd: string
}

export default function LayerEditor({ layer, recipes, onSaved, onClose }: Props) {
  const t = useTakeoffT()
  const { language, formatNumber } = useLanguage()
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const stored = (layer.framing || {}) as Partial<FramingConfig>
    const base = typeof stored.spacing === 'number'
      ? (stored as FramingConfig)
      : defaultFraming({ thickness: layer.thickness_m ?? undefined }, language === 'en-US' ? importLabelsEnUS.framing : framingLabelsPtBR)
    const n = (v: number | null | undefined, d = 2) => (v == null ? '' : formatNumber(v, d))
    setForm({
      name: layer.name,
      color: layer.color,
      height: n(layer.height_m),
      width: n(((layer.framing || {}) as { meta?: { width?: number } }).meta?.width ?? null),
      depth: n(((layer.framing || {}) as { meta?: { depth?: number } }).meta?.depth ?? null),
      thickness: n(layer.thickness_m, 3),
      elevation: n(layer.elevation_m ?? 0),
      transparency: Math.round(100 * Number(((layer.framing || {}) as { meta?: { transparency?: number } }).meta?.transparency || 0)),
      deductOpenings: layer.deduct_openings,
      recipeId: layer.recipe_id || '',
      framingOn: !!base.on,
      spacing: n(base.spacing),
      bars: base.bars.map(b => formatNumber(b, 2)).join('; '),
      studName: base.studName,
      trackName: base.trackName,
      boardW: n(base.boardW),
      boardH: n(base.boardH),
      boardA: base.boardA,
      boardB: base.boardB,
      layersA: String(base.layersA),
      layersB: String(base.layersB),
      doorJamb: String(base.doorJamb),
      winJamb: String(base.winJamb),
      cornerStuds: String(base.cornerStuds ?? DEFAULT_CORNER_STUDS),
      teeStuds: String(base.teeStuds ?? DEFAULT_TEE_STUDS),
      screwsFromLayout: base.screwsFromLayout !== false,
      screwSpacing: n(base.screwSpacing ?? DEFAULT_SCREW_SPACING),
      laPerStudEnd: String(base.laPerStudEnd ?? DEFAULT_LA_PER_STUD_END),
    })
    setError('')
  }, [layer, language, formatNumber])

  if (!form) return null
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm(prev => (prev ? { ...prev, [key]: value } : prev))
  const isLinear = layer.kind === 'linear'
  /** Concrete structure / foundation item (sizes and bottom elevation). */
  const isStruct = typeof ((layer.framing || {}) as { meta?: { struct?: string } }).meta?.struct === 'string'

  async function deleteLayer() {
    if (!window.confirm(t('layer.confirmDelete', { name: layer.name }))) return
    setSaving(true)
    setError('')
    const { data, error: e } = await createClient().from('takeoff_layers').delete().eq('id', layer.id).select('id')
    setSaving(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    if (!data || data.length === 0) { setError(t('admin.only')); return }
    onClose()
    await onSaved()
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    if (!form.name.trim()) { setError(t('layer.nameRequired')); return }
    const num = (s: string) => {
      const v = parseLocaleNumber(s)
      return Number.isFinite(v) ? v : null
    }
    const int = (s: string, fallback: number) => {
      const v = parseInt(s, 10)
      return Number.isFinite(v) && v >= 0 ? v : fallback
    }
    const update: Record<string, unknown> = { name: form.name.trim(), color: form.color, recipe_id: form.recipeId || null }
    if (layer.kind === 'area') {
      update.elevation_m = num(form.elevation) ?? 0
      update.thickness_m = num(form.thickness)
    }
    if (layer.kind === 'count') {
      // Size and mounting height (3D, reinforcement metres); width lives in framing.meta.
      update.elevation_m = num(form.elevation) ?? 0
      update.height_m = num(form.height)
      const current = (layer.framing || {}) as Record<string, unknown> & { meta?: Record<string, unknown> }
      update.framing = { ...current, meta: { ...(current.meta || {}), width: num(form.width), ...(isStruct ? { depth: num(form.depth) } : {}) } }
    }
    if (isLinear) {
      const stored = (layer.framing || {}) as Record<string, unknown>
      const base = defaultFraming({ thickness: num(form.thickness) ?? undefined })
      const bars = parseBars(form.bars)
      update.height_m = num(form.height)
      update.thickness_m = num(form.thickness)
      if (isStruct) update.elevation_m = num(form.elevation) ?? 0
      update.deduct_openings = form.deductOpenings
      update.framing = {
        ...stored,
        on: form.framingOn,
        spacing: num(form.spacing) || base.spacing,
        bars: bars.length ? bars : base.bars,
        studName: form.studName.trim() || base.studName,
        trackName: form.trackName.trim() || base.trackName,
        boardW: num(form.boardW) || base.boardW,
        boardH: num(form.boardH) || base.boardH,
        boardA: form.boardA.trim() || base.boardA,
        boardB: form.boardB.trim() || base.boardB,
        layersA: int(form.layersA, 1),
        layersB: int(form.layersB, 1),
        doorJamb: int(form.doorJamb, base.doorJamb),
        winJamb: int(form.winJamb, base.winJamb),
        cornerStuds: int(form.cornerStuds, DEFAULT_CORNER_STUDS),
        teeStuds: int(form.teeStuds, DEFAULT_TEE_STUDS),
        screwsFromLayout: form.screwsFromLayout,
        screwSpacing: num(form.screwSpacing) || DEFAULT_SCREW_SPACING,
        laPerStudEnd: int(form.laPerStudEnd, DEFAULT_LA_PER_STUD_END),
        taName: typeof stored.taName === 'string' ? stored.taName : base.taName,
        laName: typeof stored.laName === 'string' ? stored.laName : base.laName,
        studGap: typeof stored.studGap === 'number' ? stored.studGap : base.studGap,
        headerExtra: typeof stored.headerExtra === 'number' ? stored.headerExtra : base.headerExtra,
        faceOffset: typeof stored.faceOffset === 'number' ? stored.faceOffset : base.faceOffset,
      }
    }
    setSaving(true)
    // Transparency (3D) lives with the other display settings in framing.meta.
    {
      const current = (update.framing || layer.framing || {}) as Record<string, unknown> & { meta?: Record<string, unknown> }
      update.framing = { ...current, meta: { ...(current.meta || {}), transparency: Math.max(0, Math.min(90, form.transparency)) / 100 } }
    }
    const { error: e } = await createClient().from('takeoff_layers').update(update).eq('id', layer.id)
    setSaving(false)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await onSaved()
  }

  const text = (key: keyof Form, label: string, width?: number) => (
    <label style={fieldStyle}>
      {label}
      <input style={{ ...inputStyle, width: width || '100%' }} value={form[key] as string} onChange={e => set(key, e.target.value as never)} />
    </label>
  )

  return (
    <form onSubmit={save} style={{ ...ui.panel, gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ ...ui.panelTitle, fontSize: 12 }}>{t('layer.edit')}</h3>
        <button type="button" onClick={onClose} style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 16 }} aria-label="×">×</button>
      </div>
      {text('name', t('layer.name'))}
      <label style={fieldStyle}>
        {t('recipe.label')}
        <select style={inputStyle} value={form.recipeId} onChange={e => set('recipeId', e.target.value)}>
          <option value="">{t('recipe.none')}</option>
          {recipes.filter(r => r.kind === layer.kind).map(r => (
            <option key={r.id} value={r.id}>{[r.maker, r.name].filter(Boolean).join(' · ')} ({t(r.status === 'approved' ? 'recipe.status.approved' : r.status === 'review' ? 'recipe.status.review' : 'recipe.status.draft')})</option>
          ))}
        </select>
      </label>
      <label style={fieldStyle}>{t('layer.color')}<input type="color" style={{ ...inputStyle, padding: 2, width: 60 }} value={form.color} onChange={e => set('color', e.target.value)} /></label>
      <label style={fieldStyle}>
        {t('layer.transparency', { pct: form.transparency })}
        <input type="range" min={0} max={90} step={10} value={form.transparency} onChange={e => set('transparency', Number(e.target.value))} />
        <span style={ui.small}>{t('layer.transparencyHint')}</span>
      </label>
      {layer.kind === 'area' && (
        <div style={rowStyle}>{text('elevation', t('layer.elevation'), 90)}{text('thickness', t('layer.thickness'), 90)}</div>
      )}
      {layer.kind === 'count' && (
        <div style={rowStyle}>{text('width', t('layer.width'), 70)}{isStruct && text('depth', t('layer.depth'), 70)}{text('height', t('layer.height'), 70)}{text('elevation', t(isStruct ? 'layer.baseElevation' : 'layer.mountHeight'), 80)}</div>
      )}
      {isLinear && (
        <>
          <div style={rowStyle}>{text('height', t('layer.height'), 90)}{text('thickness', t(isStruct ? 'layer.width' : 'layer.thickness'), 90)}{isStruct && text('elevation', t('layer.baseElevation'), 90)}</div>
          {!isStruct && <label style={checkStyle}><input type="checkbox" checked={form.deductOpenings} onChange={e => set('deductOpenings', e.target.checked)} />{t('layer.deductOpenings')}</label>}
          {!isStruct && <div style={{ ...ui.small, fontWeight: 800, marginTop: 4 }}>{t('framing.title')}</div>}
          {!isStruct && <label style={checkStyle}><input type="checkbox" checked={form.framingOn} onChange={e => set('framingOn', e.target.checked)} />{t('framing.on')}</label>}
          {!isStruct && form.framingOn && (
            <>
              <div style={rowStyle}>{text('spacing', t('framing.spacing'), 90)}{text('bars', t('framing.bars'), 110)}</div>
              {text('studName', t('framing.studName'))}
              {text('trackName', t('framing.trackName'))}
              <div style={rowStyle}>{text('doorJamb', t('framing.doorJamb'), 60)}{text('winJamb', t('framing.winJamb'), 60)}</div>
              <div style={rowStyle}>{text('cornerStuds', t('framing.cornerStuds'), 60)}{text('teeStuds', t('framing.teeStuds'), 60)}</div>
              <label style={checkStyle}><input type="checkbox" checked={form.screwsFromLayout} onChange={e => set('screwsFromLayout', e.target.checked)} />{t('framing.screwsFromLayout')}</label>
              {form.screwsFromLayout && <div style={rowStyle}>{text('screwSpacing', t('framing.screwSpacing'), 70)}{text('laPerStudEnd', t('framing.laPerStudEnd'), 60)}</div>}
              <div style={rowStyle}>{text('boardW', t('framing.boardW'), 90)}{text('boardH', t('framing.boardH'), 90)}</div>
              {text('boardA', t('framing.boardA'))}
              {text('boardB', t('framing.boardB'))}
              <div style={rowStyle}>{text('layersA', t('framing.layersA'), 60)}{text('layersB', t('framing.layersB'), 60)}</div>
            </>
          )}
        </>
      )}
      {!isLinear && <div style={ui.small}>{t('framing.needLinear')}</div>}
      {error && <div style={ui.error}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="submit" style={{ ...ui.button, opacity: saving ? 0.6 : 1 }} disabled={saving}>{t('layer.save')}</button>
        <button type="button" style={{ ...ui.button, background: '#fff7f7', color: '#c94a4a', border: '1px solid #efcaca' }} disabled={saving} onClick={() => void deleteLayer()}>{t('layer.delete')}</button>
      </div>
    </form>
  )
}

const fieldStyle = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const inputStyle = { height: 30, padding: '0 7px', border: '1px solid #d6e0e3', borderRadius: 6, fontSize: 11, background: '#fff', boxSizing: 'border-box' } as const
const rowStyle = { display: 'flex', gap: 8, flexWrap: 'wrap' } as const
const checkStyle = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#294955' } as const
