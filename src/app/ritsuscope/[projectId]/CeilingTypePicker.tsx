'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { LAYER_PALETTE } from '@/lib/takeoff/ifc/importIfcModel'
import { CEILING_CATEGORY, ceilingSpecOf, layerFromCeilingType } from '@/lib/takeoff/ceilingTypes'
import { COUNTRIES, WALL_TYPE_COLUMNS } from '@/lib/takeoff/wallTypes'
import { ui } from '../ui'
import { ceilingDbError, systemKey, type CeilingTypeRow } from './CeilingTypesLibrary'
import { statusColor, statusKey } from './WallTypesLibrary'

type Props = {
  projectId: string
  projectCountry: string | null
  layerCount: number
  /** Default ceiling height (m): just below the walls drawn so far. */
  defaultHeight: number
  onClose: () => void
  /** Called with the new takeoff item (layer) id. */
  onCreated: (layerId: string) => Promise<void> | void
  onOpenLibrary: () => void
}

/** Pick a ceiling type from the library; creates a ceiling item from it, ready to draw. */
export default function CeilingTypePicker({ projectId, projectCountry, layerCount, defaultHeight, onClose, onCreated, onOpenLibrary }: Props) {
  const t = useTakeoffT()
  const { language, formatNumber } = useLanguage()
  const [rows, setRows] = useState<CeilingTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState<string>(projectCountry || 'all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [height, setHeight] = useState(formatNumber(defaultHeight, 2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    createClient().from('takeoff_wall_types').select(WALL_TYPE_COLUMNS).eq('category', CEILING_CATEGORY).order('code').then(({ data, error: e }) => {
      if (!alive) return
      if (e) setError(ceilingDbError(e.message) ? t('ceiling.needsMigration') : t('workspace.error', { message: e.message }))
      setRows(((data || []) as CeilingTypeRow[]).map(x => ({ ...x, framing: x.framing || {} })))
      setLoading(false)
    })
    return () => { alive = false }
  }, [t])

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

  async function use(pick: CeilingTypeRow | null = selected) {
    if (!pick) return
    const h = parseLocaleNumber(height)
    if (!(h > 0)) { setError(t('ceiling.heightInvalid')); return }
    setBusy(true)
    setError('')
    const row = layerFromCeilingType(pick, { projectId, color: LAYER_PALETTE[layerCount % LAYER_PALETTE.length], sortOrder: (layerCount + 1) * 10, elevationM: h })
    const { data, error: e } = await createClient().from('takeoff_layers').insert(row).select('id').single()
    setBusy(false)
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    await onCreated(data.id)
  }

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={dialog} onClick={e => e.stopPropagation()} role="dialog" aria-label={t('ceiling.pickTitle')}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong style={{ fontSize: 14, color: '#173441', flex: 1 }}>{t('ceiling.pickTitle')}</strong>
          <button type="button" style={ghostBtn} onClick={onOpenLibrary}>{t('ceiling.openLibrary')}</button>
          <button type="button" style={ghostBtn} onClick={onClose}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select style={{ ...input, width: 170 }} value={country} onChange={e => setCountry(e.target.value)} aria-label={t('walltype.country')}>
            <option value="all">{t('walltype.allCountries')}</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
          </select>
          <input style={{ ...input, flex: 1, minWidth: 180 }} placeholder={t('walltype.search')} value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
        {error && <div style={ui.error}>{error}</div>}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {loading ? (
            <div style={ui.small}>{t('workspace.loading')}</div>
          ) : visible.length === 0 ? (
            <div style={{ ...ui.small, padding: 12 }}>{t('ceiling.pickEmpty')}</div>
          ) : visible.map(r => {
            const active = r.id === selectedId
            const s = ceilingSpecOf(r.framing)
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
                <span style={ui.small}>{s ? t(systemKey[s.system]) : '—'}{r.notes ? ` · ${r.notes}` : ''}</span>
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <label style={field}>{t('ceiling.height')}<input style={{ ...input, width: 120 }} inputMode="decimal" value={height} onChange={e => setHeight(e.target.value)} /></label>
          <span style={{ ...ui.small, flex: 1 }}>{selected && selected.status !== 'approved' ? t('walltype.notApproved') : ''}</span>
          <button type="button" style={{ ...ui.button, opacity: !selected || busy ? 0.5 : 1 }} disabled={!selected || busy} onClick={() => void use()}>{t('walltype.use')}</button>
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
