'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import {
  CEILING_CATEGORY,
  CEILING_SYSTEMS,
  STANDARD_CEILINGS,
  ceilingLines,
  ceilingSpecOf,
  isModular,
  isMonolithic,
  type CeilingLabels,
  type CeilingSpec,
  type CeilingSystem,
} from '@/lib/takeoff/ceilingTypes'
import { COUNTRIES, WALL_TYPE_COLUMNS, type WallTypeRow, type WallTypeStatus } from '@/lib/takeoff/wallTypes'
import { ui } from '../ui'
import { statusColor, statusKey } from './WallTypesLibrary'

/** A ceiling type is a wall-type row with category 'ceiling' and its build-up in framing.ceiling. */
export type CeilingTypeRow = Omit<WallTypeRow, 'category'> & { category: string }

export const systemKey: Record<CeilingSystem, TakeoffMessageKey> = {
  suspended: 'ceiling.system.suspended',
  direct: 'ceiling.system.direct',
  self: 'ceiling.system.self',
  grid: 'ceiling.system.grid',
  clipin: 'ceiling.system.clipin',
  pvc: 'ceiling.system.pvc',
  open: 'ceiling.system.open',
}

/** Translated words for the ceiling material lines. */
export function useCeilingLabels(): CeilingLabels {
  const t = useTakeoffT()
  return useMemo(() => ({
    hangers: t('ceiling.mat.hangers'),
    brackets: t('ceiling.mat.brackets'),
    perimeterAngle: t('ceiling.mat.perimeterAngle'),
    perimeterTrack: t('ceiling.mat.perimeterTrack'),
    mainTee: t('ceiling.mat.mainTee'),
    crossTee: t('ceiling.mat.crossTee'),
    shortTee: t('ceiling.mat.shortTee'),
    carrier: t('ceiling.mat.carrier'),
    frame: t('ceiling.mat.frame'),
    perimeterTrim: t('ceiling.mat.perimeterTrim'),
    screws: t('ceiling.mat.screws'),
    sheets: t('ceiling.mat.sheets'),
    pieces: t('ceiling.mat.pieces'),
  }), [t])
}

/** Missing-migration errors read as a hint instead of a raw constraint message. */
export const ceilingDbError = (message: string) => /category/i.test(message) && /check|constraint/i.test(message)

type Props = { projectId: string; projectCountry: string | null; onChanged?: () => Promise<void> | void }

type Form = {
  code: string; name: string; scope: 'library' | 'project'; status: WallTypeStatus; country: string
  system: CeilingSystem; profile: string; spacing: string; hanger: string; board: string; layers: string
  tile: string; tileW: string; tileL: string; insulation: string; thickness: string; color: string; notes: string
}

/** Settings → Ceiling types: the company's ceiling build-ups (CL01, CL02…), drawn as ceiling areas. */
export default function CeilingTypesLibrary({ projectId, projectCountry, onChanged }: Props) {
  const t = useTakeoffT()
  const { language, formatNumber } = useLanguage()
  const labels = useCeilingLabels()
  const [rows, setRows] = useState<CeilingTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState<string>(projectCountry || 'all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const n = (v: number | null | undefined) => (v == null ? '' : formatNumber(v, 3).replace(/[.,]?0+$/, ''))
  const fail = (m: string) => setError(ceilingDbError(m) ? t('ceiling.needsMigration') : t('workspace.error', { message: m }))

  const load = useCallback(async () => {
    const { data, error: e } = await createClient().from('takeoff_wall_types').select(WALL_TYPE_COLUMNS).eq('category', CEILING_CATEGORY).order('code')
    if (e) fail(e.message)
    setRows(((data || []) as CeilingTypeRow[]).map(x => ({ ...x, framing: x.framing || {}, boards: [] })))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { void load() }, [load])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter(r => r.project_id == null || r.project_id === projectId)
      .filter(r => country === 'all' || r.country_code === country)
      .filter(r => !q || [r.code, r.name, r.notes].filter(Boolean).join(' ').toLowerCase().includes(q))
      .sort((a, b) => `${a.code || ''} ${a.name}`.localeCompare(`${b.code || ''} ${b.name}`, undefined, { numeric: true }))
  }, [rows, search, country, projectId])
  const selected = rows.find(r => r.id === selectedId) || null

  useEffect(() => {
    if (!selected) { setForm(null); return }
    const s: CeilingSpec = ceilingSpecOf(selected.framing) || { system: 'suspended' }
    const color = (selected.framing as { color?: unknown })?.color
    setForm({
      code: selected.code || '', name: selected.name, scope: selected.project_id ? 'project' : 'library', status: selected.status, country: selected.country_code,
      system: s.system, profile: s.profile || '', spacing: n(s.spacing_m), hanger: n(s.hanger_m), board: s.board || '', layers: s.layers ? String(s.layers) : '',
      tile: s.tile || '', tileW: n(s.tile_w_m), tileL: n(s.tile_l_m), insulation: s.insulation || '', thickness: n(selected.thickness_m),
      color: typeof color === 'string' ? color : '#7C3AED', notes: selected.notes || '',
    })
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, rows])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))
  const num = (v: string) => { const x = parseLocaleNumber(v); return v.trim() && x > 0 ? x : undefined }

  function specOf(f: Form): CeilingSpec {
    const spec: CeilingSpec = { system: f.system }
    if (f.profile.trim()) spec.profile = f.profile.trim()
    if (num(f.spacing)) spec.spacing_m = num(f.spacing)
    if (num(f.hanger)) spec.hanger_m = num(f.hanger)
    if (f.board.trim()) spec.board = f.board.trim()
    if (num(f.layers)) spec.layers = Math.round(num(f.layers)!)
    if (f.tile.trim()) spec.tile = f.tile.trim()
    if (num(f.tileW)) spec.tile_w_m = num(f.tileW)
    if (num(f.tileL)) spec.tile_l_m = num(f.tileL)
    if (f.insulation.trim()) spec.insulation = f.insulation.trim()
    return spec
  }

  async function create() {
    setBusy(true)
    setError('')
    const used = new Set(rows.map(r => (r.code || '').toUpperCase()))
    let k = rows.length + 1
    while (used.has(`CL${String(k).padStart(2, '0')}`)) k++
    const { data, error: e } = await createClient().from('takeoff_wall_types').insert({
      code: `CL${String(k).padStart(2, '0')}`, name: t('ceiling.newName'), category: CEILING_CATEGORY, status: 'draft',
      country_code: country === 'all' ? projectCountry || 'BR' : country, thickness_m: 0.0125,
      framing: { ceiling: STANDARD_CEILINGS[0].spec, color: '#7C3AED' },
    }).select('id').single()
    setBusy(false)
    if (e || !data) { fail(e?.message || ''); return }
    await load()
    setSelectedId(data.id)
    await onChanged?.()
  }

  /** Adds CL01…CL13 for this country, skipping codes that already exist. */
  async function addStandard() {
    const cc = country === 'all' ? projectCountry || 'BR' : country
    const have = new Set(rows.filter(r => r.country_code === cc && r.project_id == null).map(r => (r.code || '').toUpperCase()))
    const missing = STANDARD_CEILINGS.filter(c => !have.has(c.code))
    if (!missing.length) { setMessage(t('ceiling.standardAll')); return }
    setBusy(true)
    setError('')
    const { error: e } = await createClient().from('takeoff_wall_types').insert(missing.map(c => ({
      code: c.code, name: c.name, category: CEILING_CATEGORY, status: 'draft', country_code: cc, thickness_m: c.thickness_m,
      framing: { ceiling: c.spec, color: '#7C3AED' }, notes: c.notes[language] || c.notes['pt-BR'],
    })))
    setBusy(false)
    if (e) { fail(e.message); return }
    setMessage(t('ceiling.standardAdded', { count: missing.length }))
    await load()
    await onChanged?.()
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!selected || !form) return
    if (!form.name.trim()) { setError(t('layer.nameRequired')); return }
    setBusy(true)
    setError('')
    const { error: e } = await createClient().from('takeoff_wall_types').update({
      code: form.code.trim() || null, name: form.name.trim(), category: CEILING_CATEGORY, status: form.status, country_code: form.country,
      project_id: form.scope === 'project' ? projectId : null, thickness_m: num(form.thickness) ?? null,
      framing: { ...(selected.framing || {}), ceiling: specOf(form), color: form.color }, notes: form.notes.trim() || null,
    }).eq('id', selected.id)
    setBusy(false)
    if (e) { setError(/duplicate|unique/i.test(e.message) ? t('walltype.duplicateExists') : t('workspace.error', { message: e.message })); return }
    setMessage(t('ceiling.saved'))
    await load()
    await onChanged?.()
  }

  async function duplicate() {
    if (!selected) return
    const { id: _id, ...rest } = selected
    void _id
    const { data, error: e } = await createClient().from('takeoff_wall_types').insert({ ...rest, code: selected.code ? `${selected.code}-B` : null, name: `${selected.name} (2)`, status: 'draft' }).select('id').single()
    if (e || !data) { fail(e?.message || ''); return }
    await load()
    setSelectedId(data.id)
  }

  async function remove() {
    if (!selected || !window.confirm(t('ceiling.confirmDelete', { name: selected.code || selected.name }))) return
    const { error: e } = await createClient().from('takeoff_wall_types').delete().eq('id', selected.id)
    if (e) { fail(e.message); return }
    setSelectedId(null)
    await load()
    await onChanged?.()
  }

  // Materials for 100 m² of ceiling with 40 m of edges, so the build-up can be checked at a glance.
  const preview = form ? ceilingLines(specOf(form), 100, 40, labels) : []
  const mono = form ? isMonolithic(form.system) : false
  const modular = form ? isModular(form.system) : false

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={ui.panelTitle}>{t('ceiling.title')}</h2>
        <p style={{ ...ui.small, margin: '4px 0 0' }}>{t('ceiling.subtitle')}</p>
      </div>
      {error && <div style={ui.error}>{error}</div>}
      {message && <div style={ui.small}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '340px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={ui.panel}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select style={{ ...input, width: 160 }} value={country} onChange={e => setCountry(e.target.value)} aria-label={t('walltype.country')}>
              <option value="all">{t('walltype.allCountries')}</option>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
            </select>
          </div>
          <input style={input} placeholder={t('walltype.search')} value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ ...ui.button, flex: 1 }} disabled={busy} onClick={() => void create()}>+ {t('ceiling.new')}</button>
            <button type="button" style={{ ...ghostBtn, flex: 1 }} disabled={busy} onClick={() => void addStandard()} title={t('ceiling.standardHint')}>{t('ceiling.addStandard')}</button>
          </div>
          {loading ? <div style={ui.small}>{t('workspace.loading')}</div> : visible.length === 0 ? (
            <div style={ui.small}>{t('ceiling.empty')}</div>
          ) : visible.map(r => {
            const active = r.id === selectedId
            const s = ceilingSpecOf(r.framing)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => { setSelectedId(r.id); setMessage('') }}
                style={{ ...ui.listItem, width: '100%', font: 'inherit', textAlign: 'left', cursor: 'pointer', background: active ? '#edf9f7' : '#fff', borderColor: active ? '#69c9c0' : '#edf1f2' }}
              >
                <strong>{r.code ? `${r.code} – ${r.name}` : r.name}</strong>
                <span style={ui.small}>
                  {s ? t(systemKey[s.system]) : '—'}
                  {r.project_id ? ` · ${t('walltype.scope.project')}` : ''}
                  {' · '}<span style={{ color: statusColor[r.status], fontWeight: 700 }}>{t(statusKey[r.status])}</span>
                </span>
              </button>
            )
          })}
        </aside>

        <div style={{ minWidth: 0 }}>
          {!form || !selected ? (
            <div style={ui.viewer}>{t('ceiling.select')}</div>
          ) : (
            <form onSubmit={save} style={{ ...ui.panel, gap: 12 }}>
              <div style={grid}>
                <label style={field}>{t('walltype.code')}<input style={input} value={form.code} onChange={e => set('code', e.target.value)} placeholder="CL01" /></label>
                <label style={{ ...field, gridColumn: 'span 2' }}>{t('walltype.name')}<input style={input} value={form.name} onChange={e => set('name', e.target.value)} /></label>
                <label style={field}>{t('ceiling.system')}
                  <select style={input} value={form.system} onChange={e => set('system', e.target.value as CeilingSystem)}>
                    {CEILING_SYSTEMS.map(s => <option key={s} value={s}>{t(systemKey[s])}</option>)}
                  </select>
                </label>
                <label style={field}>{t('walltype.country')}
                  <select style={input} value={form.country} onChange={e => set('country', e.target.value)}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
                  </select>
                </label>
                <label style={field}>{t('walltype.scope')}
                  <select style={input} value={form.scope} onChange={e => set('scope', e.target.value as Form['scope'])}>
                    <option value="library">{t('walltype.scope.library')}</option>
                    <option value="project">{t('walltype.scope.project')}</option>
                  </select>
                </label>
                <label style={field}>{t('recipes.status')}
                  <select style={input} value={form.status} onChange={e => set('status', e.target.value as WallTypeStatus)}>
                    {(['draft', 'review', 'approved'] as WallTypeStatus[]).map(s => <option key={s} value={s}>{t(statusKey[s])}</option>)}
                  </select>
                </label>
                <label style={field}>{t('ceiling.color')}<input type="color" style={{ ...input, padding: 2 }} value={form.color} onChange={e => set('color', e.target.value)} /></label>
              </div>

              <h3 style={subTitle}>{t('ceiling.buildUp')}</h3>
              <div style={grid}>
                {mono && <label style={field}>{t('ceiling.profile')}<input style={input} value={form.profile} placeholder="Perfil F530" onChange={e => set('profile', e.target.value)} /></label>}
                {(mono || form.system === 'pvc') && <label style={field}>{t('ceiling.spacing')}<input style={input} inputMode="decimal" value={form.spacing} placeholder="0,6" onChange={e => set('spacing', e.target.value)} /></label>}
                {(form.system === 'suspended' || form.system === 'direct' || modular || form.system === 'open') && (
                  <label style={field}>{t(form.system === 'direct' ? 'ceiling.bracketSpacing' : 'ceiling.hangerSpacing')}<input style={input} inputMode="decimal" value={form.hanger} placeholder="1,2" onChange={e => set('hanger', e.target.value)} /></label>
                )}
                {mono && <label style={field}>{t('ceiling.board')}<input style={input} value={form.board} placeholder="Chapa ST 12,5 mm" onChange={e => set('board', e.target.value)} /></label>}
                {mono && <label style={field}>{t('ceiling.layers')}<input style={input} inputMode="numeric" value={form.layers} placeholder="1" onChange={e => set('layers', e.target.value)} /></label>}
                {!mono && <label style={field}>{t('ceiling.tile')}<input style={input} value={form.tile} onChange={e => set('tile', e.target.value)} /></label>}
                {modular && <label style={field}>{t('ceiling.tileW')}<input style={input} inputMode="decimal" value={form.tileW} placeholder="0,625" onChange={e => set('tileW', e.target.value)} /></label>}
                {modular && <label style={field}>{t('ceiling.tileL')}<input style={input} inputMode="decimal" value={form.tileL} placeholder="0,625" onChange={e => set('tileL', e.target.value)} /></label>}
                <label style={field}>{t('ceiling.insulation')}<input style={input} value={form.insulation} placeholder={t('ceiling.insulationNone')} onChange={e => set('insulation', e.target.value)} /></label>
                <label style={field}>{t('ceiling.thickness')}<input style={input} inputMode="decimal" value={form.thickness} placeholder="0,0125" onChange={e => set('thickness', e.target.value)} /></label>
              </div>

              <h3 style={subTitle}>{t('ceiling.preview')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {preview.map(l => (
                  <div key={`${l.mat}|${l.unit}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, color: '#294955', padding: '3px 0', borderBottom: '1px solid #f0f4f5' }}>
                    <span>{l.mat}</span><strong>{formatNumber(l.qty, l.unit === 'un' || l.unit === labels.sheets ? 0 : 1)} {l.unit}</strong>
                  </div>
                ))}
                <span style={ui.small}>{t('ceiling.previewHint')}</span>
              </div>

              <label style={field}>{t('recipes.notes')}<textarea style={{ ...input, height: 70, padding: 8 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="submit" style={ui.button} disabled={busy}>{t('walltype.save')}</button>
                <button type="button" style={ghostBtn} disabled={busy} onClick={() => void duplicate()}>{t('walltype.duplicate')}</button>
                <button type="button" style={{ ...ghostBtn, color: '#c94a4a', borderColor: '#efcaca' }} disabled={busy} onClick={() => void remove()}>{t('walltype.delete')}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 } as const
const field = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: 10, fontWeight: 700, color: '#607681' } as const
const input = { height: 32, padding: '0 8px', border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12, background: '#fff', boxSizing: 'border-box', width: '100%' } as const
const subTitle = { margin: '4px 0 0', fontSize: 11, fontWeight: 800, color: '#173441', textTransform: 'uppercase', letterSpacing: '.05em' } as const
const ghostBtn = { height: 32, padding: '0 12px', border: '1px solid #d3dfe2', borderRadius: 7, background: '#fff', color: '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const
