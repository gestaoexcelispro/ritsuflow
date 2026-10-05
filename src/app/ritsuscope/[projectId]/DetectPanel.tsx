'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { applyFramingDefaults, defaultFraming, framingLabelsPtBR, type FramingDefaults } from '@/lib/takeoff/framing/framing'
import type { Vec2 } from '@/lib/takeoff/geometry'
import { LAYER_PALETTE, importLabelsEnUS } from '@/lib/takeoff/ifc/importIfcModel'
import { defaultLayerExcluded, detectWalls, groupByThickness, layerStats, type DetectedWall, type VSeg } from '@/lib/takeoff/detect/walls'
import type { LayerRow } from '@/lib/takeoff/rows'
import { ui } from '../ui'

type Props = {
  projectId: string
  sourceId: string
  ptPerM: number
  /** null while the page's linework is still being read. */
  vectors: VSeg[] | null
  region: [Vec2, Vec2] | null
  picking: boolean
  onPickRegion: () => void
  onClearRegion: () => void
  suggestions: DetectedWall[]
  selected: Set<string>
  onResults: (walls: DetectedWall[]) => void
  onSelectedChange: (ids: Set<string>) => void
  layers: LayerRow[]
  activeLayer: LayerRow | null
  framingDefaults: FramingDefaults
  onSaved: (message: string, elementIds: string[]) => Promise<void> | void
  onClose: () => void
}

/** Finds walls in the page's vector linework and turns the reviewed ones into takeoff elements. */
export default function DetectPanel(props: Props) {
  const { projectId, sourceId, ptPerM, vectors, region, picking, onPickRegion, onClearRegion, suggestions, selected, onResults, onSelectedChange, layers, activeLayer, framingDefaults, onSaved, onClose } = props
  const t = useTakeoffT()
  const { formatNumber, language } = useLanguage()
  const n = (v: number, d = 2) => formatNumber(v, d)
  const stats = useMemo(() => layerStats(vectors || []), [vectors])
  const [cadLayers, setCadLayers] = useState<Set<string>>(new Set())
  const [minThick, setMinThick] = useState(n(0.05))
  const [maxThick, setMaxThick] = useState(n(0.35))
  const [minLen, setMinLen] = useState(n(0.3))
  /** Walls continue through door/window openings up to this width (0 = cut at openings). */
  const [bridge, setBridge] = useState(n(1.6))
  const [target, setTarget] = useState<'perThickness' | 'active'>('perThickness')
  const [height, setHeight] = useState(n(2.8))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [ran, setRan] = useState(false)

  // Default layer choice: everything that doesn't look like dimensions, text, hatches, title blocks…
  useEffect(() => {
    setCadLayers(new Set(stats.map(s => s.name).filter(name => !defaultLayerExcluded(name))))
  }, [stats])

  useEffect(() => {
    if (activeLayer?.kind === 'linear') setTarget('active')
  }, [activeLayer])

  const groups = useMemo(() => groupByThickness(suggestions), [suggestions])

  function run() {
    setError('')
    const lo = parseLocaleNumber(minThick)
    const hi = parseLocaleNumber(maxThick)
    const len = parseLocaleNumber(minLen)
    const br = bridge.trim() ? parseLocaleNumber(bridge) : 0
    if (!(lo > 0) || !(hi > lo) || !(len > 0) || !(br >= 0)) { setError(t('detect.invalidRange')); return }
    const walls = detectWalls(vectors || [], {
      ptPerM,
      minThickM: lo,
      maxThickM: hi,
      minLenM: len,
      bridgeOpeningsM: br,
      region: region ? { x0: region[0][0], y0: region[0][1], x1: region[1][0], y1: region[1][1] } : null,
      layers: stats.length ? cadLayers : null,
      keepUnlayered: false,
    })
    setRan(true)
    onResults(walls)
    onSelectedChange(new Set(walls.map(w => w.id)))
  }

  function toggleGroup(ids: string[], on: boolean) {
    const next = new Set(selected)
    for (const id of ids) { if (on) next.add(id); else next.delete(id) }
    onSelectedChange(next)
  }

  async function accept() {
    const picked = suggestions.filter(w => selected.has(w.id))
    if (!picked.length) return
    setBusy(true)
    setError('')
    const supabase = createClient()
    const created: string[] = []
    try {
      const insertElements = async (layerId: string, walls: DetectedWall[]) => {
        const { data, error: e } = await supabase
          .from('takeoff_elements')
          .insert(walls.map(w => ({ project_id: projectId, layer_id: layerId, source_id: sourceId, points: w.pts })))
          .select('id')
        if (e) throw e
        created.push(...(data || []).map(r => r.id as string))
      }
      if (target === 'active' && activeLayer?.kind === 'linear') {
        await insertElements(activeLayer.id, picked)
      } else {
        const h = parseLocaleNumber(height)
        const labels = language === 'en-US' ? importLabelsEnUS.framing : framingLabelsPtBR
        let order = layers.length
        for (const g of groupByThickness(picked)) {
          const thicknessMm = Math.round(g.thicknessM * 1000)
          const { data, error: e } = await supabase
            .from('takeoff_layers')
            .insert({
              project_id: projectId,
              kind: 'linear',
              name: t('detect.itemName', { mm: thicknessMm }),
              color: LAYER_PALETTE[order % LAYER_PALETTE.length],
              height_m: h > 0 ? h : null,
              thickness_m: g.thicknessM,
              framing: applyFramingDefaults(defaultFraming({ thickness: g.thicknessM }, labels), framingDefaults),
              sort_order: (order + 1) * 10,
            })
            .select('id')
            .single()
          if (e || !data) throw e || new Error('insert failed')
          order++
          await insertElements(data.id, g.walls)
        }
      }
      onResults(suggestions.filter(w => !selected.has(w.id)))
      onSelectedChange(new Set())
      await onSaved(t('detect.accepted', { count: picked.length }), created)
    } catch (e) {
      setError(t('workspace.error', { message: e instanceof Error ? e.message : String((e as { message?: string })?.message || e) }))
      if (created.length) await onSaved(t('detect.partial', { count: created.length }), created)
    } finally {
      setBusy(false)
    }
  }

  const totalSelected = suggestions.filter(w => selected.has(w.id)).reduce((s, w) => s + w.lengthM, 0)

  return (
    <div style={{ ...ui.panel, gap: 10, borderColor: '#bcd7f5', background: '#f8fbff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 12, color: '#173441', flex: 1 }}>{t('detect.title')}</strong>
        <span style={ui.small}>{t('detect.beta')}</span>
        <button type="button" style={smallBtn(false)} onClick={onClose}>×</button>
      </div>

      {!(ptPerM > 0) ? (
        <div style={ui.small}>{t('draw.needScale')}</div>
      ) : vectors == null ? (
        <div style={ui.small}>{t('detect.reading')}</div>
      ) : vectors.length === 0 ? (
        <div style={{ ...ui.small, color: '#9a6700' }}>{t('detect.noVectors')}</div>
      ) : (
        <>
          <div style={ui.small}>{t('detect.found', { lines: vectors.length, layers: stats.length })}</div>

          {stats.length > 0 && (
            <details open={!ran}>
              <summary style={{ fontSize: 11, fontWeight: 700, color: '#294955', cursor: 'pointer' }}>{t('detect.cadLayers', { on: cadLayers.size, total: stats.length })}</summary>
              <div style={{ display: 'flex', gap: 6, margin: '6px 0' }}>
                <button type="button" style={smallBtn(false)} onClick={() => setCadLayers(new Set(stats.map(s => s.name)))}>{t('detect.all')}</button>
                <button type="button" style={smallBtn(false)} onClick={() => setCadLayers(new Set())}>{t('detect.none')}</button>
                <button type="button" style={smallBtn(false)} onClick={() => setCadLayers(new Set(stats.map(s => s.name).filter(x => !defaultLayerExcluded(x))))}>{t('detect.suggested')}</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2, maxHeight: 160, overflow: 'auto' }}>
                {stats.map(s => (
                  <label key={s.name} style={check}>
                    <input
                      type="checkbox"
                      checked={cadLayers.has(s.name)}
                      onChange={e => setCadLayers(prev => { const next = new Set(prev); if (e.target.checked) next.add(s.name); else next.delete(s.name); return next })}
                    />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <span style={ui.small}>{s.count}</span>
                  </label>
                ))}
              </div>
            </details>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
            <label style={field}>{t('detect.minThick')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={minThick} onChange={e => setMinThick(e.target.value)} /></label>
            <label style={field}>{t('detect.maxThick')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={maxThick} onChange={e => setMaxThick(e.target.value)} /></label>
            <label style={field}>{t('detect.minLen')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={minLen} onChange={e => setMinLen(e.target.value)} /></label>
            <label style={field} title={t('detect.bridgeHint')}>{t('detect.bridge')}<input style={{ ...input, width: 80 }} inputMode="decimal" value={bridge} onChange={e => setBridge(e.target.value)} /></label>
            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button type="button" style={smallBtn(picking)} onClick={onPickRegion}>{t('detect.pickRegion')}</button>
              {region && <button type="button" style={smallBtn(false)} onClick={onClearRegion}>{t('detect.wholePage')}</button>}
              <span style={ui.small}>{picking ? t('detect.pickHint') : region ? t('detect.regionSet') : t('detect.regionWhole')}</span>
            </span>
            <button type="button" style={ui.button} onClick={run}>{t('detect.run')}</button>
          </div>

          {ran && (suggestions.length === 0 ? (
            <div style={ui.small}>{t('detect.nothing')}</div>
          ) : (
            <>
              <div style={ui.small}>{t('detect.reviewHint')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {groups.map(g => {
                  const ids = g.walls.map(w => w.id)
                  const on = ids.filter(id => selected.has(id)).length
                  return (
                    <label key={g.thicknessM} style={{ ...check, padding: '4px 6px', border: '1px solid #e2ebf0', borderRadius: 6, background: '#fff' }}>
                      <input type="checkbox" checked={on === ids.length} ref={el => { if (el) el.indeterminate = on > 0 && on < ids.length }} onChange={e => toggleGroup(ids, e.target.checked)} />
                      <strong style={{ minWidth: 90 }}>{t('detect.thickness', { mm: Math.round(g.thicknessM * 1000) })}</strong>
                      <span>{t('detect.groupDetail', { count: g.walls.length, length: n(g.lengthM) })}</span>
                      <span style={ui.small}>{t('detect.selectedOf', { on, total: ids.length })}</span>
                    </label>
                  )
                })}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
                <label style={field}>{t('detect.target')}
                  <select style={{ ...input, width: 260 }} value={target} onChange={e => setTarget(e.target.value as typeof target)}>
                    <option value="perThickness">{t('detect.target.perThickness')}</option>
                    {activeLayer?.kind === 'linear' && <option value="active">{t('detect.target.active', { name: activeLayer.name })}</option>}
                  </select>
                </label>
                {target === 'perThickness' && (
                  <label style={field}>{t('walltype.height')}<input style={{ ...input, width: 90 }} inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} /></label>
                )}
                <button type="button" style={{ ...ui.button, opacity: busy || selected.size === 0 ? 0.5 : 1 }} disabled={busy || selected.size === 0} onClick={() => void accept()}>
                  {t('detect.accept', { count: suggestions.filter(w => selected.has(w.id)).length, length: n(totalSelected) })}
                </button>
                <button type="button" style={smallBtn(false)} onClick={() => { onResults([]); onSelectedChange(new Set()); setRan(false) }}>{t('detect.discard')}</button>
              </div>
            </>
          ))}
        </>
      )}
      {error && <div style={ui.error}>{error}</div>}
    </div>
  )
}

const field = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const input = { height: 30, padding: '0 7px', border: '1px solid #d6e0e3', borderRadius: 6, fontSize: 11, background: '#fff', boxSizing: 'border-box' } as const
const check = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#294955' } as const
const smallBtn = (on: boolean) => ({ height: 28, padding: '0 10px', border: '1px solid ' + (on ? '#2563EB' : '#d3dfe2'), borderRadius: 6, background: on ? '#2563EB' : '#fff', color: on ? '#fff' : '#294955', fontSize: 10, fontWeight: 700, cursor: 'pointer' }) as const
