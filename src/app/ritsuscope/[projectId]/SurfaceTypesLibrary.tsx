'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { COUNTRIES, WALL_TYPE_COLUMNS, type WallTypeRow, type WallTypeStatus } from '@/lib/takeoff/wallTypes'
import { ui } from '../ui'
import { familyDbError, type SpecField, type SurfaceFamily, type SurfaceLabels } from './surfaceFamilies'
import { statusColor, statusKey } from './WallTypesLibrary'

/** A ceiling or floor type is a wall-type row with its own category and the build-up in framing[specKey]. */
export type SurfaceTypeRow = Omit<WallTypeRow, 'category'> & { category: string }

/** Translated words for the ceiling and floor material lines. */
export function useSurfaceLabels(): SurfaceLabels {
  const t = useTakeoffT()
  return useMemo(() => ({
    ceiling: {
      hangers: t('ceiling.mat.hangers'), brackets: t('ceiling.mat.brackets'), perimeterAngle: t('ceiling.mat.perimeterAngle'),
      perimeterTrack: t('ceiling.mat.perimeterTrack'), mainTee: t('ceiling.mat.mainTee'), crossTee: t('ceiling.mat.crossTee'),
      shortTee: t('ceiling.mat.shortTee'), carrier: t('ceiling.mat.carrier'), frame: t('ceiling.mat.frame'),
      perimeterTrim: t('ceiling.mat.perimeterTrim'), screws: t('ceiling.mat.screws'), sheets: t('ceiling.mat.sheets'), pieces: t('ceiling.mat.pieces'),
    },
    floor: {
      pieces: t('ceiling.mat.pieces'), grout: t('floortype.mat.grout'), primer: t('floortype.mat.primer'), weldRod: t('floortype.mat.weldRod'),
      pedestals: t('floortype.mat.pedestals'), underlay: t('floortype.mat.underlay'), mortar: t('floortype.mat.mortar'),
    },
  }), [t])
}

const shows = (f: SpecField, system: string) => f.systems === 'all' || f.systems.includes(system)

type Props = { family: SurfaceFamily; projectId: string; projectCountry: string | null; onChanged?: () => Promise<void> | void }

type Form = { code: string; name: string; scope: 'library' | 'project'; status: WallTypeStatus; country: string; system: string; thickness: string; color: string; notes: string; spec: Record<string, string> }

/** Settings → Ceiling types / Floor types: the company's build-ups (CL01…, FL01…), drawn as areas. */
export default function SurfaceTypesLibrary({ family, projectId, projectCountry, onChanged }: Props) {
  const t = useTakeoffT()
  const { language, formatNumber } = useLanguage()
  const labels = useSurfaceLabels()
  const [rows, setRows] = useState<SurfaceTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [country, setCountry] = useState<string>(projectCountry || 'all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const fmt = (v: unknown) => (typeof v === 'number' ? formatNumber(v, 3).replace(/([.,]\d*?)0+$/, '$1').replace(/[.,]$/, '') : typeof v === 'string' ? v : '')
  const fail = (m: string) => setError(familyDbError(m) ? t(family.msg.needsMigration) : t('workspace.error', { message: m }))

  const load = useCallback(async () => {
    const { data, error: e } = await createClient().from('takeoff_wall_types').select(WALL_TYPE_COLUMNS).eq('category', family.category).order('code')
    if (e) fail(e.message)
    setRows(((data || []) as SurfaceTypeRow[]).map(x => ({ ...x, framing: x.framing || {}, boards: [] })))
    setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.category])
  useEffect(() => { setSelectedId(null); setLoading(true); void load() }, [load])

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
    const s = family.specOf(selected.framing) || { system: family.systems[0] }
    const color = (selected.framing as { color?: unknown })?.color
    const spec: Record<string, string> = {}
    for (const f of family.fields) spec[f.key] = fmt(s[f.key])
    setForm({
      code: selected.code || '', name: selected.name, scope: selected.project_id ? 'project' : 'library', status: selected.status,
      country: selected.country_code, system: s.system, thickness: fmt(selected.thickness_m), color: typeof color === 'string' ? color : family.color,
      notes: selected.notes || '', spec,
    })
    setError('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, rows])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))
  const setSpec = (k: string, v: string) => setForm(f => (f ? { ...f, spec: { ...f.spec, [k]: v } } : f))
  const num = (v: string, zero = false) => { const x = parseLocaleNumber(v); return v.trim() && Number.isFinite(x) && (zero ? x >= 0 : x > 0) ? x : undefined }

  /** Build-up from the form: only the fields that apply to the chosen system. */
  function specOf(f: Form): Record<string, unknown> {
    const spec: Record<string, unknown> = { system: f.system }
    for (const field of family.fields) {
      if (!shows(field, f.system)) continue
      const raw = f.spec[field.key] || ''
      if (field.type === 'text') { if (raw.trim()) spec[field.key] = raw.trim(); continue }
      const v = num(raw, field.allowZero)
      if (v !== undefined) spec[field.key] = field.type === 'int' ? Math.max(1, Math.round(v)) : v
    }
    return spec
  }

  /** Form build-up merged over the stored one, so settings the form doesn't show (imperial units, grid sizes…) are kept. */
  function fullSpec(f: Form): Record<string, unknown> {
    const prev = (selected && family.specOf(selected.framing)) || {}
    const hidden = Object.fromEntries(Object.entries(prev).filter(([k]) => k !== 'system' && !family.fields.some(x => x.key === k)))
    return { ...hidden, ...specOf(f) }
  }

  async function create() {
    setBusy(true)
    setError('')
    const used = new Set(rows.map(r => (r.code || '').toUpperCase()))
    let k = rows.length + 1
    const code = () => `${family.codePrefix}${String(k).padStart(2, '0')}`
    while (used.has(code())) k++
    const { data, error: e } = await createClient().from('takeoff_wall_types').insert({
      code: code(), name: t(family.msg.newName), category: family.category, status: 'draft',
      country_code: country === 'all' ? projectCountry || 'BR' : country, thickness_m: family.defaultThickness,
      framing: { [family.specKey]: family.standard[0].spec, color: family.color },
    }).select('id').single()
    setBusy(false)
    if (e || !data) { fail(e?.message || ''); return }
    await load()
    setSelectedId(data.id)
    await onChanged?.()
  }

  /** Adds the standard list for this country, skipping codes that already exist. */
  async function addStandard() {
    const cc = country === 'all' ? projectCountry || 'BR' : country
    const have = new Set(rows.filter(r => r.country_code === cc && r.project_id == null).map(r => (r.code || '').toUpperCase()))
    const missing = family.standard.filter(c => !have.has(c.code))
    if (!missing.length) { setMessage(t(family.msg.standardAll)); return }
    setBusy(true)
    setError('')
    const { error: e } = await createClient().from('takeoff_wall_types').insert(missing.map(c => ({
      code: c.code, name: c.name, category: family.category, status: 'draft', country_code: cc, thickness_m: c.thickness_m,
      framing: { [family.specKey]: c.spec, color: family.color }, notes: c.notes[language as 'pt-BR' | 'en-US'] || c.notes['pt-BR'],
    })))
    setBusy(false)
    if (e) { fail(e.message); return }
    setMessage(t(family.msg.standardAdded, { count: missing.length }))
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
      code: form.code.trim() || null, name: form.name.trim(), category: family.category, status: form.status, country_code: form.country,
      project_id: form.scope === 'project' ? projectId : null, thickness_m: num(form.thickness) ?? null,
      framing: { ...(selected.framing || {}), [family.specKey]: fullSpec(form), color: form.color }, notes: form.notes.trim() || null,
    }).eq('id', selected.id)
    setBusy(false)
    if (e) { setError(/duplicate|unique/i.test(e.message) ? t('walltype.duplicateExists') : t('workspace.error', { message: e.message })); return }
    setMessage(t(family.msg.saved))
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
    if (!selected || !window.confirm(t(family.msg.confirmDelete, { name: selected.code || selected.name }))) return
    const { error: e } = await createClient().from('takeoff_wall_types').delete().eq('id', selected.id)
    if (e) { fail(e.message); return }
    setSelectedId(null)
    await load()
    await onChanged?.()
  }

  // Materials for 100 m² with 40 m of edges, so the build-up can be checked at a glance.
  const preview = form ? family.lines(fullSpec(form) as { system: string }, 100, 40, labels) : []

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={ui.panelTitle}>{t(family.msg.title)}</h2>
        <p style={{ ...ui.small, margin: '4px 0 0' }}>{t(family.msg.subtitle)}</p>
      </div>
      {error && <div style={ui.error}>{error}</div>}
      {message && <div style={ui.small}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '340px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={ui.panel}>
          <select style={{ ...input, width: 160 }} value={country} onChange={e => setCountry(e.target.value)} aria-label={t('walltype.country')}>
            <option value="all">{t('walltype.allCountries')}</option>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
          </select>
          <input style={input} placeholder={t('walltype.search')} value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={{ ...ui.button, flex: 1 }} disabled={busy} onClick={() => void create()}>+ {t(family.msg.new)}</button>
            <button type="button" style={{ ...ghostBtn, flex: 1 }} disabled={busy} onClick={() => void addStandard()} title={t(family.msg.standardHint)}>{t(family.msg.addStandard)}</button>
          </div>
          {loading ? <div style={ui.small}>{t('workspace.loading')}</div> : visible.length === 0 ? (
            <div style={ui.small}>{t(family.msg.empty)}</div>
          ) : visible.map(r => {
            const active = r.id === selectedId
            const s = family.specOf(r.framing)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => { setSelectedId(r.id); setMessage('') }}
                style={{ ...ui.listItem, width: '100%', font: 'inherit', textAlign: 'left', cursor: 'pointer', background: active ? '#edf9f7' : '#fff', borderColor: active ? '#69c9c0' : '#edf1f2' }}
              >
                <strong>{r.code ? `${r.code} – ${r.name}` : r.name}</strong>
                <span style={ui.small}>
                  {s && family.systemKey[s.system] ? t(family.systemKey[s.system]) : '—'}
                  {r.project_id ? ` · ${t('walltype.scope.project')}` : ''}
                  {' · '}<span style={{ color: statusColor[r.status], fontWeight: 700 }}>{t(statusKey[r.status])}</span>
                </span>
              </button>
            )
          })}
        </aside>

        <div style={{ minWidth: 0 }}>
          {!form || !selected ? (
            <div style={ui.viewer}>{t(family.msg.select)}</div>
          ) : (
            <form onSubmit={save} style={{ ...ui.panel, gap: 12 }}>
              <div style={grid}>
                <label style={field}>{t('walltype.code')}<input style={input} value={form.code} onChange={e => set('code', e.target.value)} placeholder={`${family.codePrefix}01`} /></label>
                <label style={{ ...field, gridColumn: 'span 2' }}>{t('walltype.name')}<input style={input} value={form.name} onChange={e => set('name', e.target.value)} /></label>
                <label style={field}>{t('ceiling.system')}
                  <select style={input} value={form.system} onChange={e => set('system', e.target.value)}>
                    {family.systems.map(s => <option key={s} value={s}>{t(family.systemKey[s])}</option>)}
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
                <label style={field}>{t('ceiling.thickness')}<input style={input} inputMode="decimal" value={form.thickness} onChange={e => set('thickness', e.target.value)} /></label>
              </div>

              <h3 style={subTitle}>{t('ceiling.buildUp')}</h3>
              <div style={grid}>
                {family.fields.filter(f => shows(f, form.system)).map(f => (
                  <label key={f.key} style={field}>
                    {t(typeof f.label === 'function' ? f.label(form.system) : f.label)}
                    <input style={input} inputMode={f.type === 'text' ? undefined : 'decimal'} value={form.spec[f.key] || ''} placeholder={f.placeholder} onChange={e => setSpec(f.key, e.target.value)} />
                  </label>
                ))}
              </div>

              <h3 style={subTitle}>{t(family.msg.preview)}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {preview.map(l => (
                  <div key={`${l.mat}|${l.unit}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 11, color: '#294955', padding: '3px 0', borderBottom: '1px solid #f0f4f5' }}>
                    <span>{l.mat}</span><strong>{formatNumber(l.qty, Number.isInteger(l.qty) ? 0 : 2)} {l.unit}</strong>
                  </div>
                ))}
                <span style={ui.small}>{t(family.msg.previewHint)}</span>
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
