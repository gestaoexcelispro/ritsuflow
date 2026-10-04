'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import type { TakeoffMessageKey } from '@/lib/i18n/messages/takeoff.pt-BR'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { COUNTRIES } from '@/lib/takeoff/wallTypes'
import { MATERIAL_CATEGORIES, MATERIAL_COLUMNS, type MaterialCategory, type MaterialRow } from '@/lib/takeoff/systemRecipes'
import { ui } from '../ui'
import { statusColor, statusKey } from './WallTypesLibrary'

type Props = { projectCountry: string | null; onChanged?: () => Promise<void> | void }

type Form = { country: string; code: string; name: string; category: MaterialCategory; unit: string; packSize: string; packName: string; manufacturer: string; supplier: string; notes: string; status: MaterialRow['status'] }

export const materialCategoryKey: Record<MaterialCategory, TakeoffMessageKey> = {
  board: 'material.cat.board', stud: 'material.cat.stud', track: 'material.cat.track', screw: 'material.cat.screw', compound: 'material.cat.compound',
  tape: 'material.cat.tape', insulation: 'material.cat.insulation', profile: 'material.cat.profile', accessory: 'material.cat.accessory', other: 'material.cat.other',
}

/** Page size of the list: the catalog can hold thousands of products, filtered on the server. */
const PAGE = 200

/** Settings → Materials: the products the company buys, by country. Wall types and recipes point here. */
export default function MaterialsCatalog({ projectCountry, onChanged }: Props) {
  const t = useTakeoffT()
  const { language, numberFormat } = useLanguage()
  const [rows, setRows] = useState<MaterialRow[]>([])
  const [total, setTotal] = useState(0)
  const [country, setCountry] = useState<string>(projectCountry || 'BR')
  const [category, setCategory] = useState<MaterialCategory | 'all'>('all')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [missing, setMissing] = useState(false)

  const num = useCallback((v: number | null | undefined) => (v == null ? '' : String(v).replace('.', numberFormat === 'pt-BR' ? ',' : '.')), [numberFormat])

  const load = useCallback(async () => {
    let q = createClient().from('takeoff_materials').select(MATERIAL_COLUMNS, { count: 'exact' }).eq('country_code', country).order('category').order('name').limit(PAGE)
    if (category !== 'all') q = q.eq('category', category)
    const s = search.trim()
    if (s) { const v = s.replace(/[%,()]/g, ' '); q = q.or(`name.ilike.%${v}%,code.ilike.%${v}%,supplier.ilike.%${v}%`) }
    const { data, count, error: e } = await q
    if (e) {
      if (/does not exist|schema cache/i.test(e.message)) setMissing(true)
      else setError(t('workspace.error', { message: e.message }))
      return
    }
    setMissing(false)
    setRows((data || []) as MaterialRow[])
    setTotal(count ?? (data || []).length)
  }, [country, category, search, t])

  useEffect(() => { const h = setTimeout(() => void load(), 200); return () => clearTimeout(h) }, [load])

  const selected = rows.find(r => r.id === selectedId) || null
  useEffect(() => {
    if (!selected) { setForm(null); return }
    setForm({
      country: selected.country_code, code: selected.code || '', name: selected.name, category: selected.category, unit: selected.unit,
      packSize: num(selected.pack_size), packName: selected.pack_name || '', manufacturer: selected.manufacturer || '', supplier: selected.supplier || '', notes: selected.notes || '', status: selected.status,
    })
  }, [selected, num])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))

  async function create() {
    setError('')
    setMessage('')
    const name = `${t('material.newName')} ${new Date().toLocaleTimeString(language)}`
    const { data, error: e } = await createClient().from('takeoff_materials')
      .insert({ country_code: country, name, category: category === 'all' ? 'other' : category, unit: 'un', status: 'draft' })
      .select('id').single()
    if (e || !data) { setError(t('workspace.error', { message: e?.message || '' })); return }
    setSearch('')
    await load()
    setSelectedId(data.id)
  }

  /** Creates catalog products for the material names already typed in recipes (not yet in the catalog). */
  async function importFromRecipes() {
    setError('')
    setMessage('')
    const supabase = createClient()
    const [r, m] = await Promise.all([
      supabase.from('takeoff_recipes').select('lines, country_code, maker'),
      supabase.from('takeoff_materials').select('name').eq('country_code', country),
    ])
    if (r.error || m.error) { setError(t('workspace.error', { message: (r.error || m.error)!.message })); return }
    const have = new Set((m.data || []).map(x => String(x.name).toLowerCase()))
    const toAdd = new Map<string, { name: string; unit: string; pack_size: number | null; pack_name: string | null; code: string | null; manufacturer: string | null }>()
    for (const rec of r.data || []) {
      if (rec.country_code && rec.country_code !== country) continue
      for (const l of (rec.lines || []) as { mat?: string; unit?: string; packSize?: number; packName?: string; code?: string }[]) {
        const name = (l.mat || '').trim()
        if (!name || have.has(name.toLowerCase()) || toAdd.has(name.toLowerCase())) continue
        toAdd.set(name.toLowerCase(), { name, unit: l.unit || 'un', pack_size: l.packSize || null, pack_name: l.packName || null, code: l.code || null, manufacturer: rec.maker || null })
      }
    }
    if (!toAdd.size) { setMessage(t('material.importNone')); return }
    const guess = (n: string): MaterialCategory =>
      /chapa|board|placa/i.test(n) ? 'board' : /montante|stud/i.test(n) ? 'stud' : /guia|track/i.test(n) ? 'track' : /parafuso|screw/i.test(n) ? 'screw'
        : /massa|compound|rejunte/i.test(n) ? 'compound' : /fita|tape/i.test(n) ? 'tape' : /lã|la de|wool|insul|isol/i.test(n) ? 'insulation' : 'other'
    const { error: e } = await supabase.from('takeoff_materials').insert([...toAdd.values()].map(x => ({ ...x, country_code: country, category: guess(x.name), status: 'draft' })))
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    await load()
    setMessage(t('material.imported', { count: toAdd.size }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form || !selected) return
    setError('')
    setMessage('')
    if (!form.name.trim() || !form.unit.trim()) { setError(t('material.required')); return }
    const pack = form.packSize.trim() ? parseLocaleNumber(form.packSize) : null
    if (pack != null && !(pack > 0)) { setError(t('walltype.invalidNumber')); return }
    setSaving(true)
    const { error: e } = await createClient().from('takeoff_materials').update({
      country_code: form.country, code: form.code.trim() || null, name: form.name.trim(), category: form.category, unit: form.unit.trim(),
      pack_size: pack, pack_name: form.packName.trim() || null, manufacturer: form.manufacturer.trim() || null, supplier: form.supplier.trim() || null, notes: form.notes.trim() || null, status: form.status,
    }).eq('id', selected.id)
    setSaving(false)
    if (e) { setError(/duplicate key|unique/i.test(e.message) ? t('material.duplicate') : t('workspace.error', { message: e.message })); return }
    await load()
    await onChanged?.()
    setMessage(t('material.saved'))
  }

  async function remove() {
    if (!selected || !window.confirm(t('material.deleteConfirm', { name: selected.name }))) return
    const { error: e } = await createClient().from('takeoff_materials').delete().eq('id', selected.id)
    if (e) { setError(t('workspace.error', { message: e.message })); return }
    setSelectedId(null)
    await load()
    setMessage(t('material.deleted'))
  }

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <h2 style={ui.panelTitle}>{t('material.title')}</h2>
        <p style={{ ...ui.small, margin: '4px 0 0' }}>{t('material.subtitle')}</p>
      </div>
      {missing && <div style={ui.error}>{t('material.notReady')}</div>}
      {error && <div style={ui.error}>{error}</div>}
      {message && <div style={ui.small}>{message}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0,1fr)', gap: 16, alignItems: 'start' }}>
        <aside style={ui.panel}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select style={{ ...input, width: 160 }} value={country} onChange={e => setCountry(e.target.value)} aria-label={t('walltype.country')}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
            </select>
            <select style={{ ...input, width: 160 }} value={category} onChange={e => setCategory(e.target.value as MaterialCategory | 'all')} aria-label={t('material.category')}>
              <option value="all">{t('walltype.allCategories')}</option>
              {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{t(materialCategoryKey[c])}</option>)}
            </select>
          </div>
          <input style={input} placeholder={t('material.search')} value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ display: 'flex', gap: 6 }}>
            <button type="button" style={{ ...ui.button, flex: 1 }} disabled={missing} onClick={() => void create()}>+ {t('material.new')}</button>
            <button type="button" style={ghostBtn} disabled={missing} title={t('material.importHint')} onClick={() => void importFromRecipes()}>{t('material.import')}</button>
          </div>
          <div style={ui.small}>{total > rows.length ? t('material.showing', { shown: rows.length, total }) : t('material.count', { count: total })}</div>
          {rows.length === 0 ? (
            <div style={ui.small}>{t('material.empty')}</div>
          ) : rows.map(m => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setSelectedId(m.id); setMessage('') }}
              style={{ ...ui.listItem, width: '100%', font: 'inherit', textAlign: 'left', cursor: 'pointer', background: m.id === selectedId ? '#edf9f7' : '#fff', borderColor: m.id === selectedId ? '#69c9c0' : '#edf1f2' }}
            >
              <strong>{m.name}</strong>
              <span style={ui.small}>
                {t(materialCategoryKey[m.category])} · {m.unit}{m.pack_size ? ` · ${num(m.pack_size)} ${m.unit}/${m.pack_name || t('material.pack')}` : ''}
                {m.supplier ? ` · ${m.supplier}` : ''}{m.code ? ` ${m.code}` : ''}
                {' · '}<span style={{ color: statusColor[m.status], fontWeight: 700 }}>{t(statusKey[m.status])}</span>
              </span>
            </button>
          ))}
        </aside>

        <div style={{ minWidth: 0 }}>
          {!form || !selected ? (
            <div style={ui.viewer}>{t('material.select')}</div>
          ) : (
            <form onSubmit={save} style={{ ...ui.panel, gap: 12 }}>
              <div style={grid}>
                <label style={{ ...field, gridColumn: 'span 2' }}>{t('material.name')}<input style={input} value={form.name} onChange={e => set('name', e.target.value)} /></label>
                <label style={field}>{t('material.code')}<input style={input} value={form.code} onChange={e => set('code', e.target.value)} /></label>
                <label style={field}>{t('material.category')}
                  <select style={input} value={form.category} onChange={e => set('category', e.target.value as MaterialCategory)}>
                    {MATERIAL_CATEGORIES.map(c => <option key={c} value={c}>{t(materialCategoryKey[c])}</option>)}
                  </select>
                </label>
                <label style={field}>{t('material.unit')}<input style={input} value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="m², m, un, kg" /></label>
                <label style={field}>{t('material.packSize')}<input style={input} inputMode="decimal" value={form.packSize} onChange={e => set('packSize', e.target.value)} /></label>
                <label style={field}>{t('material.packName')}<input style={input} value={form.packName} onChange={e => set('packName', e.target.value)} placeholder={t('material.packPlaceholder')} /></label>
                <label style={field}>{t('material.manufacturer')}<input style={input} value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} /></label>
                <label style={field}>{t('material.supplier')}<input style={input} value={form.supplier} onChange={e => set('supplier', e.target.value)} /></label>
                <label style={field}>{t('walltype.country')}
                  <select style={input} value={form.country} onChange={e => set('country', e.target.value)}>
                    {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name[language]}</option>)}
                  </select>
                </label>
                <label style={field}>{t('recipes.status')}
                  <select style={input} value={form.status} onChange={e => set('status', e.target.value as MaterialRow['status'])}>
                    {(['draft', 'review', 'approved'] as const).map(s => <option key={s} value={s}>{t(statusKey[s])}</option>)}
                  </select>
                </label>
              </div>
              <label style={field}>{t('recipes.notes')}<textarea style={{ ...input, height: 56, padding: 8 }} value={form.notes} onChange={e => set('notes', e.target.value)} /></label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="submit" style={{ ...ui.button, opacity: saving ? 0.6 : 1 }} disabled={saving}>{t('material.save')}</button>
                <span style={{ flex: 1 }} />
                <button type="button" style={{ ...ghostBtn, color: '#c94a4a', borderColor: '#efcaca' }} onClick={() => void remove()}>{t('material.delete')}</button>
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
const ghostBtn = { height: 32, padding: '0 12px', border: '1px solid #d3dfe2', borderRadius: 7, background: '#fff', color: '#294955', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const
