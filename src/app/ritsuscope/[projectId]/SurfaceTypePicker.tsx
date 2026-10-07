'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { LAYER_PALETTE } from '@/lib/takeoff/ifc/importIfcModel'
import { COUNTRIES, WALL_TYPE_COLUMNS } from '@/lib/takeoff/wallTypes'
import { ui } from '../ui'
import { addStandardTypes, familyDbError, type SurfaceFamily } from './surfaceFamilies'
import type { SurfaceTypeRow } from './SurfaceTypesLibrary'
import { statusColor, statusKey } from './WallTypesLibrary'

type Props = {
  family: SurfaceFamily
  projectId: string
  projectCountry: string | null
  layerCount: number
  /** Default level (m): ceilings just below the walls drawn so far, floors at 0. */
  defaultHeight: number
  onClose: () => void
  /** Called with the new takeoff item (layer) id. */
  onCreated: (layerId: string) => Promise<void> | void
  onOpenLibrary: () => void
  /** Classify an existing item instead of creating one: the whole item, or just the selected area (into a new item). */
  assign?: { itemName: string; count: number; onAssign: (pick: SurfaceTypeRow, scope: 'item' | 'element') => Promise<void> | void } | null
}

/** Pick a ceiling or floor type from the library; creates an area item from it, ready to draw. */
export default function SurfaceTypePicker({ family, projectId, projectCountry, layerCount, defaultHeight, onClose, onCreated, onOpenLibrary, assign = null }: Props) {
  const t = useTakeoffT()
  const { language, formatNumber } = useLanguage()
  const [rows, setRows] = useState<SurfaceTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState<string>(projectCountry || 'all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [height, setHeight] = useState(formatNumber(defaultHeight, 2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fail = (m: string) => setError(familyDbError(m) ? t(family.msg.needsMigration) : t('workspace.error', { message: m }))
  async function load() {
    const { data, error: e } = await createClient().from('takeoff_wall_types').select(WALL_TYPE_COLUMNS).eq('category', family.category).order('code')
    if (e) fail(e.message)
    setRows(((data || []) as SurfaceTypeRow[]).map(x => ({ ...x, framing: x.framing || {} })))
    setLoading(false)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void load() }, [family])

  /** Empty library: add the standard list (CL01…, FL01…) right here, then pick from it. */
  async function addStandard() {
    setBusy(true)
    setError('')
    const res = await addStandardTypes(family, rows, country === 'all' ? projectCountry || 'BR' : country, language)
    if ('error' in res) { setBusy(false); fail(res.error); return }
    await load()
    setBusy(false)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter(r => r.project_id == null || r.project_id === projectId)
      .filter(r => country === 'all' || r.country_code === country)
      .filter(r => !q || [r.code, r.name, r.notes].filter(Boolean).join(' ').toLowerCase().includes(q))
      .sort((a, b) => `${a.code || ''} ${a.name}`.localeCompare(`${b.code || ''} ${b.name}`, undefined, { numeric: true }))
  }, [rows, search, country, projectId])
  const selected = visible.find(r => r.id === selectedId) || null

  async function use(pick: SurfaceTypeRow | null = selected, scope: 'item' | 'element' = 'item') {
    if (!pick) return
    if (assign) {
      setBusy(true)
      setError('')
      try { await assign.onAssign(pick, scope) } catch (err) { setError(t('workspace.error', { message: err instanceof Error ? err.message : String((err as { message?: string })?.message || err) })) }
      setBusy(false)
      return
    }
    const h = family.asksHeight ? parseLocaleNumber(height) : defaultHeight
    if (family.asksHeight && !(h > 0)) { setError(t(family.msg.heightInvalid)); return }
    setBusy(true)
    setError('')
    const row = family.layerFrom(pick, { projectId, color: LAYER_PALETTE[layerCount % LAYER_PALETTE.length], sortOrder: (layerCount + 1) * 10, elevationM: h })
    const { data, error: e } = await createClient().from('takeoff_layers').insert(row).select('id').single()
    setBusy(false)
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    await onCreated(data.id)
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()} role="dialog" aria-label={t(family.msg.pickTitle)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14, color: '#173441', flex: 1 }}>{t(family.msg.pickTitle)}</strong>
          <button type="button" style={ghostBtn} onClick={onOpenLibrary}>{t(family.msg.openLibrary)}</button>
          <button type="button" style={ghostBtn} onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select style={{ ...input, width: 170 }} value={country} onChange={e => setCountry(e.target.value)} aria-label={t('walltype.country')}>
            <option value="all">{t('walltype.allCountries')}</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
          </select>
          <input style={{ ...input, flex: 1, minWidth: 180 }} placeholder={t('surface.search')} value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        {error && <div style={ui.error}>{error}</div>}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading ? (
            <div style={ui.small}>{t('workspace.loading')}</div>
          ) : visible.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, padding: 12 }}>
              <span style={ui.small}>{t(family.msg.pickEmpty)}</span>
              {!search.trim() && (
                <button type="button" style={{ ...ui.button, opacity: busy ? 0.5 : 1 }} disabled={busy} onClick={() => void addStandard()}>{t(family.msg.addStandard)}</button>
              )}
            </div>
          ) : visible.map(r => {
            const active = r.id === selectedId
            const s = family.specOf(r.framing)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                onDoubleClick={() => { setSelectedId(r.id); void use(r) }}
                style={{ ...ui.listItem, width: '100%', font: 'inherit', textAlign: 'left', cursor: 'pointer', background: active ? '#edf9f7' : '#fff', borderColor: active ? '#109d91' : '#edf1f2' }}
              >
                <span style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <strong style={{ flex: 1 }}>{r.code ? `${r.code} – ${r.name}` : r.name}</strong>
                  <span style={{ fontSize: 10, fontWeight: 800, color: statusColor[r.status] }}>{t(statusKey[r.status])}</span>
                </span>
                <span style={ui.small}>{s && family.systemKey[s.system] ? t(family.systemKey[s.system]) : '—'}{r.notes ? ` · ${r.notes}` : ''}</span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {family.asksHeight && !assign && <label style={field}>{t(family.msg.height)}<input style={{ ...input, width: 120 }} inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} /></label>}
          <span style={{ ...ui.small, flex: 1 }}>{selected && selected.status !== 'approved' ? t('walltype.notApproved') : ''}</span>
          {assign ? (
            <>
              <button type="button" style={{ ...ghostBtn, height: 34, opacity: !selected || busy ? 0.5 : 1 }} disabled={!selected || busy} onClick={() => void use(selected, 'element')}>{t('surface.assignElement')}</button>
              <button type="button" style={{ ...ui.button, opacity: !selected || busy ? 0.5 : 1 }} disabled={!selected || busy} onClick={() => void use(selected, 'item')}>{t('surface.assignItem', { name: assign.itemName, count: assign.count })}</button>
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
