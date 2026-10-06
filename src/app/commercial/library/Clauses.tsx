'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { COUNTRIES } from '@/lib/takeoff/wallTypes'
import { CLAUSE_COLUMNS, CLAUSE_KINDS, type ClauseKind, type ClauseRow } from '@/lib/commercial/clauses'
import { useCommercialAccess } from '../license'
import { ui } from '../ui'

type Form = { id: string | null; kind: ClauseKind; body: string; country: string; active: boolean }

/** Library → Clauses: ready-made inclusions, exclusions and conditions for proposals. */
export default function Clauses() {
  const t = useT('commercial')
  const { language } = useLanguage()
  const { canEditLibrary, isPlatformOwner, organizationId } = useCommercialAccess()
  const [rows, setRows] = useState<ClauseRow[]>([])
  const [kind, setKind] = useState<ClauseKind>('exclusion')
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error: e } = await createClient().from('commercial_clauses').select(CLAUSE_COLUMNS).order('sort_order').order('created_at')
    setLoading(false)
    if (e) { setError(t('error.load', { message: e.message })); return }
    setError(''); setRows((data || []) as ClauseRow[])
  }, [t])

  useEffect(() => { void load() }, [load])

  const list = useMemo(() => rows.filter(r => r.kind === kind), [rows, kind])
  const countryName = (code: string | null) => {
    if (!code) return t('clauses.allCountries')
    const c = COUNTRIES.find(x => x.code === code)
    return c ? (language === 'pt-BR' ? c.name['pt-BR'] : c.name['en-US']) : code
  }
  const canEditRow = (r: ClauseRow) => canEditLibrary && (r.organization_id ? true : isPlatformOwner)

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    const body = form.body.trim()
    if (!body) { setError(t('clauses.errBody')); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const patch = { kind: form.kind, body, country_code: form.country || null, is_active: form.active }
    const res = form.id
      ? await supabase.from('commercial_clauses').update(patch).eq('id', form.id)
      : await supabase.from('commercial_clauses').insert({ ...patch, organization_id: organizationId, sort_order: rows.filter(r => r.kind === form.kind).length + 1 })
    setSaving(false)
    if (res.error) { setError(t('error.save', { message: res.error.message })); return }
    setForm(null); setKind(form.kind); void load()
  }

  async function remove(r: ClauseRow) {
    if (!window.confirm(t('clauses.confirmRemove'))) return
    const { error: e } = await createClient().from('commercial_clauses').delete().eq('id', r.id)
    if (e) { setError(t('error.save', { message: e.message })); return }
    void load()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={ui.toolbar}>
        <div role="group" aria-label={t('clauses.kind')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {CLAUSE_KINDS.map(k => (
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} style={kind === k ? ui.button : ui.buttonGhost}>
              {t(`clauses.kinds.${k}`)} <span style={{ opacity: 0.7 }}>({rows.filter(r => r.kind === k).length})</span>
            </button>
          ))}
        </div>
        <span style={{ flex: 1 }} />
        {canEditLibrary && <button type="button" style={ui.button} onClick={() => setForm({ id: null, kind, body: '', country: '', active: true })}>{t('clauses.add')}</button>}
      </div>
      <p style={{ ...ui.small, margin: 0 }}>{t('clauses.hint')}</p>
      {error && <div role="alert" style={ui.error}>{error}</div>}

      {form && (
        <form onSubmit={save} style={{ ...ui.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={ui.formGrid}>
            <label style={ui.label}>{t('clauses.kind')}
              <select value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as ClauseKind })} style={ui.input}>
                {CLAUSE_KINDS.map(k => <option key={k} value={k}>{t(`clauses.kinds.${k}`)}</option>)}
              </select>
            </label>
            <label style={ui.label}>{t('field.country')}
              <select value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} style={ui.input}>
                <option value="">{t('clauses.allCountries')}</option>
                {COUNTRIES.map(c => <option key={c.code} value={c.code}>{countryName(c.code)}</option>)}
              </select>
            </label>
          </div>
          <label style={ui.label}>{t('clauses.body')}
            <textarea rows={3} value={form.body} autoFocus onChange={e => setForm({ ...form, body: e.target.value })}
              style={{ ...ui.input, height: 'auto', padding: 10, fontFamily: 'inherit', lineHeight: 1.45, resize: 'vertical' }} />
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#294955' }}>
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#0b7f75' }} />
            {t('clauses.active')}
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={() => setForm(null)} style={ui.buttonGhost}>{t('action.cancel')}</button>
            <button type="submit" disabled={saving} style={ui.button}>{t('action.save')}</button>
          </div>
        </form>
      )}

      {loading ? <div style={ui.muted}>{t('loading')}</div> : list.length === 0 ? <div style={ui.empty}>{t('clauses.empty')}</div> : (
        <div style={ui.tableWrap}>
          <table style={{ ...ui.table, minWidth: 640 }}>
            <thead>
              <tr>
                <th style={ui.th}>{t('clauses.body')}</th>
                <th style={ui.th}>{t('field.country')}</th>
                <th style={ui.th}>{t('clauses.origin')}</th>
                <th style={ui.th} />
              </tr>
            </thead>
            <tbody>
              {list.map(r => (
                <tr key={r.id} style={r.is_active ? undefined : { opacity: 0.55 }}>
                  <td style={{ ...ui.td, whiteSpace: 'pre-wrap' }}>{r.body}{!r.is_active && <span style={{ ...ui.chip, marginLeft: 8 }}>{t('clauses.inactive')}</span>}</td>
                  <td style={ui.td}>{countryName(r.country_code)}</td>
                  <td style={ui.td}><span style={r.organization_id ? ui.chipTeal : ui.chip}>{r.organization_id ? t('templates.company') : t('templates.standard')}</span></td>
                  <td style={{ ...ui.td, whiteSpace: 'nowrap', textAlign: 'right' }}>
                    {canEditRow(r) && <>
                      <button type="button" style={ui.buttonSmall} onClick={() => setForm({ id: r.id, kind: r.kind, body: r.body, country: r.country_code || '', active: r.is_active })}>{t('action.edit')}</button>
                      <button type="button" style={{ ...ui.buttonSmall, marginLeft: 6 }} aria-label={t('action.delete')} onClick={() => void remove(r)}>✕</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
