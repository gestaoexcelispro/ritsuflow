'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { applyFramingDefaults, defaultFraming, framingLabelsPtBR, type FramingDefaults } from '@/lib/takeoff/framing/framing'
import { LAYER_PALETTE, importLabelsEnUS } from '@/lib/takeoff/ifc/importIfcModel'
import {
  COUNTRIES,
  WALL_CATEGORIES,
  WALL_TYPE_COLUMNS,
  filterWallTypes,
  layerFromWallType,
  wallTypeLabel,
  type WallCategory,
  type WallTypeRow,
} from '@/lib/takeoff/wallTypes'
import { ui } from '../ui'
import { categoryKey, statusColor, statusKey } from './WallTypesLibrary'

type Props = {
  projectId: string
  projectCountry: string | null
  layerCount: number
  framingDefaults: FramingDefaults
  onClose: () => void
  /** Called with the new takeoff item (layer) id. */
  onCreated: (layerId: string) => Promise<void> | void
  onOpenLibrary: () => void
  /**
   * Assign mode (from a selected wall): instead of creating an item to draw, the chosen type
   * goes to the wall's item (all its walls) or to this wall only. Gets the item row built from the type.
   */
  assign?: { itemName: string; wallCount: number; onAssign: (row: ReturnType<typeof layerFromWallType>, scope: 'item' | 'element') => Promise<void> | void } | null
}

/** Pick a wall type from the library; creates a takeoff item from it, ready to draw. */
export default function WallTypePicker({ projectId, projectCountry, layerCount, framingDefaults, onClose, onCreated, onOpenLibrary, assign = null }: Props) {
  const t = useTakeoffT()
  const { language, formatNumber } = useLanguage()
  const [rows, setRows] = useState<WallTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState<string>(projectCountry || 'all')
  const [category, setCategory] = useState<WallCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [height, setHeight] = useState(assign ? '' : formatNumber(2.8, 2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    createClient().from('takeoff_wall_types').select(WALL_TYPE_COLUMNS).order('name').then(({ data, error: e }) => {
      if (!alive) return
      if (e) setError(t('workspace.error', { message: e.message }))
      setRows(((data || []) as WallTypeRow[]).map(x => ({ ...x, boards: Array.isArray(x.boards) ? x.boards : [], framing: x.framing || {} })))
      setLoading(false)
    })
    return () => { alive = false }
  }, [t])

  // Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const visible = useMemo(() => filterWallTypes(rows, { country, category, search, projectId }), [rows, country, category, search, projectId])
  const selected = visible.find(r => r.id === selectedId) || null

  async function use(pick: WallTypeRow | null = selected, scope: 'item' | 'element' | null = null) {
    if (!pick) return
    if (assign && !scope) scope = 'item'
    const h = parseLocaleNumber(height)
    if (height.trim() && !(h > 0)) { setError(t('element.heightInvalid')); return }
    setBusy(true)
    setError('')
    const labels = language === 'en-US' ? importLabelsEnUS.framing : framingLabelsPtBR
    const base = applyFramingDefaults(defaultFraming({ thickness: pick.thickness_m || undefined }, labels), framingDefaults)
    const row = layerFromWallType(pick, base, {
      projectId,
      color: LAYER_PALETTE[layerCount % LAYER_PALETTE.length],
      sortOrder: (layerCount + 1) * 10,
      heightM: h > 0 ? h : null,
    })
    if (assign && scope) {
      try { await assign.onAssign(row, scope) } catch (err) { setError(t('workspace.error', { message: err instanceof Error ? err.message : String((err as { message?: string })?.message || err) })) }
      setBusy(false)
      return
    }
    const { data, error: e } = await createClient().from('takeoff_layers').insert(row).select('id').single()
    setBusy(false)
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    await onCreated(data.id)
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()} role="dialog" aria-label={t('walltype.pickTitle')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14, color: '#173441', flex: 1 }}>{t('walltype.pickTitle')}</strong>
          <button type="button" style={ghostBtn} onClick={onOpenLibrary}>{t('walltype.openLibrary')}</button>
          <button type="button" style={ghostBtn} onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select style={{ ...input, width: 170 }} value={country} onChange={e => setCountry(e.target.value)} aria-label={t('walltype.country')}>
            <option value="all">{t('walltype.allCountries')}</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
          </select>
          <input style={{ ...input, flex: 1, minWidth: 180 }} placeholder={t('walltype.search')} value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', ...WALL_CATEGORIES] as const).map(c => (
            <button key={c} type="button" onClick={() => setCategory(c)} style={chip(category === c)}>
              {c === 'all' ? t('walltype.allCategories') : t(categoryKey[c])}
            </button>
          ))}
        </div>
        {error && <div style={ui.error}>{error}</div>}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading ? (
            <div style={ui.small}>{t('workspace.loading')}</div>
          ) : visible.length === 0 ? (
            <div style={{ ...ui.small, padding: 12 }}>{t('walltype.pickEmpty')}</div>
          ) : visible.map(wt => {
            const active = wt.id === selectedId
            const a = wt.boards.find(b => b.side === 'A')
            const b = wt.boards.find(x => x.side === 'B')
            return (
              <button
                key={wt.id}
                type="button"
                onClick={() => setSelectedId(wt.id)}
                onDoubleClick={() => { setSelectedId(wt.id); void use(wt) }}
                style={{ ...ui.listItem, width: '100%', font: 'inherit', textAlign: 'left', cursor: 'pointer', background: active ? '#edf9f7' : '#fff', borderColor: active ? '#109d91' : '#edf1f2' }}
              >
                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <strong style={{ flex: 1 }}>{wallTypeLabel(wt)}</strong>
                  <span style={{ fontSize: 10, fontWeight: 800, color: statusColor[wt.status] }}>{t(statusKey[wt.status])}</span>
                </span>
                <span style={ui.small}>
                  {t(categoryKey[wt.category])}
                  {wt.fire_rating_hr ? ` · ${formatNumber(wt.fire_rating_hr, 1)} h` : ''}
                  {wt.rated_design ? ` · ${wt.rated_design}` : ''}
                  {wt.stc_min ? ` · STC ${wt.stc_min}${wt.stc_max ? `–${wt.stc_max}` : ''}` : ''}
                  {wt.project_id ? ` · ${t('walltype.scope.project')}` : ''}
                </span>
                {(a || b) && <span style={ui.small}>{[a && `A: ${a.count}× ${a.product}`, b && `B: ${b.count}× ${b.product}`].filter(Boolean).join(' · ')}</span>}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={field}>{assign ? t('walltype.heightOptional') : t('walltype.height')}<input style={{ ...input, width: 120 }} inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} /></label>
          <span style={{ ...ui.small, flex: 1 }}>{selected?.status !== 'approved' && selected ? t('walltype.notApproved') : ''}</span>
          {assign ? (
            <>
              <button type="button" style={{ ...ghostBtn, height: 34, opacity: !selected || busy ? 0.5 : 1 }} disabled={!selected || busy} onClick={() => void use(selected, 'element')}>{t('walltype.assignElement')}</button>
              <button type="button" style={{ ...ui.button, opacity: !selected || busy ? 0.5 : 1 }} disabled={!selected || busy} onClick={() => void use(selected, 'item')}>{t('walltype.assignItem', { name: assign.itemName, count: assign.wallCount })}</button>
            </>
          ) : (
            <button type="button" style={{ ...ui.button, opacity: !selected || busy ? 0.5 : 1 }} disabled={!selected || busy} onClick={() => void use()}>{t('walltype.use')}</button>
          )}
        </div>
      </div>
    </div>
  )
}

const backdrop = { position: 'fixed', inset: 0, background: 'rgba(15, 35, 45, .35)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 } as const
const dialog = { width: 'min(720px, 100%)', height: 'min(640px, 100%)', display: 'flex', flexDirection: 'column', gap: 10, padding: 16, background: '#fff', borderRadius: 12, boxShadow: '0 20px 50px rgba(0,0,0,.2)' } as const
const field = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const input = { height: 32, padding: '0 8px', border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12, background: '#fff', boxSizing: 'border-box' } as const
const ghostBtn = { height: 30, padding: '0 10px', border: '1px solid #d3dfe2', borderRadius: 7, background: '#fff', color: '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const
const chip = (on: boolean) => ({ height: 26, padding: '0 10px', borderRadius: 13, border: '1px solid ' + (on ? '#109d91' : '#d3dfe2'), background: on ? '#109d91' : '#fff', color: on ? '#fff' : '#294955', fontSize: 10, fontWeight: 700, cursor: 'pointer' }) as const
