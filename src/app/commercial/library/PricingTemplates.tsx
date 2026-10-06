'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { parseLocaleNumber } from '@/lib/takeoff/calibration'
import { COUNTRIES } from '@/lib/takeoff/wallTypes'
import { APPLIES_TO, METHODS, TEMPLATE_COLUMNS, currencyOf, newLine, type TemplateRow } from '@/lib/commercial/library'
import { applyPricing, PricingError, type AppliesTo, type LineMethod, type PricingLine } from '@/lib/commercial/pricing'
import { formatMoney, formatPct, toInput } from '@/lib/commercial/format'
import { useCommercialAccess } from '../license'
import { ui } from '../ui'

type EditLine = { key: string; label: string; applies_to: AppliesTo; method: LineMethod; rate: string }
type Draft = { id: string | null; name: string; isDefault: boolean; notes: string; lines: EditLine[]; standard: boolean }

/** Sample direct cost for the preview: 100,000 split 60% material, 40% labor. */
const SAMPLE = { material: 60000, labor: 40000, equipment: 0, subcontract: 0 }

/** Library → Pricing templates: the add-on lines that turn direct cost into a selling price. */
export default function PricingTemplates() {
  const t = useT('commercial')
  const { language, numberFormat } = useLanguage()
  const { licensed, isPlatformOwner, organizationId } = useCommercialAccess()
  const [country, setCountry] = useState('BR')
  const [rows, setRows] = useState<TemplateRow[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const { data, error: e } = await createClient().from('commercial_pricing_templates').select(TEMPLATE_COLUMNS).eq('country_code', country).order('name')
    if (e) { setError(t('error.load', { message: e.message })); return }
    setError(''); setRows((data || []) as TemplateRow[])
  }, [country, t])

  useEffect(() => { void load(); setDraft(null) }, [load])

  const companyRows = rows.filter(r => r.organization_id)
  const standardRows = rows.filter(r => !r.organization_id)

  function open(r: TemplateRow, copy: boolean) {
    setMessage('')
    setDraft({
      id: copy ? null : r.id,
      name: copy ? `${r.name} (${t('templates.copySuffix')})` : r.name,
      isDefault: copy ? companyRows.length === 0 : r.is_default,
      notes: r.notes || '',
      standard: !copy && !r.organization_id,
      lines: r.lines.map(l => ({ key: l.key, label: l.label, applies_to: l.applies_to, method: l.method, rate: toInput(l.rate, numberFormat) })),
    })
  }

  const canEdit = !!draft && licensed && (!draft.standard || isPlatformOwner)

  const parsed: PricingLine[] = useMemo(() => (draft?.lines || []).map(l => ({
    key: l.key, label: l.label, applies_to: l.applies_to, method: l.method, rate: l.rate.trim() ? parseLocaleNumber(l.rate) : 0,
  })), [draft])

  const preview = useMemo(() => {
    try { return { result: applyPricing(SAMPLE, parsed.map(l => ({ ...l, rate: Number.isFinite(l.rate) ? l.rate : 0 }))), problem: '' } }
    catch (e) { return { result: null, problem: e instanceof PricingError ? e.message : String(e) } }
  }, [parsed])

  function setLine(i: number, patch: Partial<EditLine>) {
    if (!draft) return
    setDraft({ ...draft, lines: draft.lines.map((l, n) => (n === i ? { ...l, ...patch } : l)) })
  }

  function move(i: number, by: -1 | 1) {
    if (!draft) return
    const j = i + by
    if (j < 0 || j >= draft.lines.length) return
    const lines = [...draft.lines]
    ;[lines[i], lines[j]] = [lines[j], lines[i]]
    setDraft({ ...draft, lines })
  }

  async function save() {
    if (!draft) return
    if (!draft.name.trim()) { setError(t('templates.errName')); return }
    if (parsed.some(l => !l.label.trim())) { setError(t('templates.errLabel')); return }
    if (parsed.some(l => !Number.isFinite(l.rate) || l.rate < 0)) { setError(t('templates.errRate')); return }
    if (preview.problem) { setError(t('templates.errTaxes')); return }
    if (!draft.standard && !organizationId) { setError(t('error.noCompany')); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const owner = draft.standard ? null : organizationId
    // Only one default per company and country: clear the others first.
    if (draft.isDefault) {
      let q = supabase.from('commercial_pricing_templates').update({ is_default: false }).eq('country_code', country).eq('is_default', true)
      q = owner ? q.eq('organization_id', owner) : q.is('organization_id', null)
      if (draft.id) q = q.neq('id', draft.id)
      const { error: e } = await q
      if (e) { setSaving(false); setError(t('error.save', { message: e.message })); return }
    }
    const payload = { organization_id: owner, country_code: country, name: draft.name.trim(), is_default: draft.isDefault, notes: draft.notes.trim() || null, lines: parsed }
    const res = draft.id
      ? await supabase.from('commercial_pricing_templates').update(payload).eq('id', draft.id).select('id').single()
      : await supabase.from('commercial_pricing_templates').insert(payload).select('id').single()
    setSaving(false)
    if (res.error) {
      setError(/duplicate key/i.test(res.error.message) ? t('templates.errDuplicate') : t('error.save', { message: res.error.message }))
      return
    }
    setMessage(t('templates.saved')); setDraft(d => (d ? { ...d, id: res.data.id as string } : d)); void load()
  }

  async function remove() {
    if (!draft?.id || !window.confirm(t('templates.confirmDelete'))) return
    const { error: e } = await createClient().from('commercial_pricing_templates').delete().eq('id', draft.id)
    if (e) { setError(t('error.save', { message: e.message })); return }
    setDraft(null); setMessage(t('templates.deleted')); void load()
  }

  const currency = currencyOf(country)
  const card = (r: TemplateRow) => (
    <li key={r.id}>
      <button type="button" onClick={() => open(r, false)} aria-pressed={draft?.id === r.id} style={{
        width: '100%', textAlign: 'left', padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
        border: draft?.id === r.id ? '2px solid #0b7f75' : '1px solid #dfe7ea', background: draft?.id === r.id ? '#f3fbfa' : '#fff', color: '#173441',
      }}>
        <strong style={{ display: 'block', fontSize: 13 }}>{r.name}</strong>
        <span style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
          <span style={r.organization_id ? ui.chipTeal : ui.chip}>{r.organization_id ? t('templates.company') : t('templates.standard')}</span>
          {r.is_default && <span style={ui.chipOrange}>{t('templates.default')}</span>}
          <span style={ui.chip}>{t('templates.lineCount', { count: r.lines.length })}</span>
        </span>
      </button>
    </li>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={ui.toolbar}>
        <label style={{ ...ui.label, flexDirection: 'row', alignItems: 'center' }}>{t('field.country')}
          <select value={country} onChange={e => setCountry(e.target.value)} style={ui.input}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{language === 'pt-BR' ? c.name['pt-BR'] : c.name['en-US']}</option>)}
          </select>
        </label>
        <span style={{ flex: 1 }} />
        {licensed && <button type="button" style={ui.button} onClick={() => { setMessage(''); setDraft({ id: null, name: '', isDefault: companyRows.length === 0, notes: '', standard: false, lines: [newLine(0)] }) }}>{t('templates.add')}</button>}
      </div>

      {error && <div role="alert" style={ui.error}>{error}</div>}
      {message && <div role="status" style={ui.notice}>{message}</div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}>
        <aside style={{ flex: '1 1 240px', maxWidth: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={ui.small}>{t('templates.yours')}</div>
          {companyRows.length ? <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>{companyRows.map(card)}</ul>
            : <div style={{ ...ui.small, padding: '8px 0' }}>{t('templates.noneYet')}</div>}
          <div style={ui.small}>{t('templates.standards')}</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>{standardRows.map(card)}</ul>
        </aside>

        {draft ? (
          <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ ...ui.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {draft.standard && !isPlatformOwner && (
                <div style={ui.notice}>
                  {t('templates.standardNote')}{' '}
                  {licensed && <button type="button" style={{ ...ui.buttonSmall, marginLeft: 6 }} onClick={() => { const r = rows.find(x => x.id === draft.id); if (r) open(r, true) }}>{t('templates.copy')}</button>}
                </div>
              )}
              <div style={ui.formGrid}>
                <label style={{ ...ui.label, gridColumn: 'span 2' }}>{t('field.name')}
                  <input value={draft.name} disabled={!canEdit} onChange={e => setDraft({ ...draft, name: e.target.value })} style={ui.input} />
                </label>
                <label style={{ ...ui.label, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'end', minHeight: 38 }}>
                  <input type="checkbox" checked={draft.isDefault} disabled={!canEdit} onChange={e => setDraft({ ...draft, isDefault: e.target.checked })} style={{ width: 18, height: 18, accentColor: '#0b7f75' }} />
                  {t('templates.makeDefault')}
                </label>
              </div>

              <div style={ui.tableWrap}>
                <table style={{ ...ui.table, minWidth: 640 }}>
                  <thead>
                    <tr>
                      <th style={ui.th}>#</th>
                      <th style={ui.th}>{t('templates.line')}</th>
                      <th style={ui.th}>{t('templates.appliesTo')}</th>
                      <th style={ui.th}>{t('templates.method')}</th>
                      <th style={{ ...ui.th, ...ui.num }}>{t('templates.rate')}</th>
                      <th style={ui.th} />
                    </tr>
                  </thead>
                  <tbody>
                    {draft.lines.map((l, i) => (
                      <tr key={l.key}>
                        <td style={{ ...ui.td, color: '#4f6670' }}>{i + 1}</td>
                        <td style={ui.td}><input aria-label={t('templates.line')} value={l.label} disabled={!canEdit} onChange={e => setLine(i, { label: e.target.value })} style={{ ...ui.input, width: '100%' }} /></td>
                        <td style={ui.td}>
                          <select aria-label={t('templates.appliesTo')} value={l.applies_to} disabled={!canEdit || l.method === 'divisor'} onChange={e => setLine(i, { applies_to: e.target.value as AppliesTo })} style={ui.input}>
                            {APPLIES_TO.map(a => <option key={a} value={a}>{t(`applies.${a}`)}</option>)}
                          </select>
                        </td>
                        <td style={ui.td}>
                          <select aria-label={t('templates.method')} value={l.method} disabled={!canEdit} onChange={e => setLine(i, { method: e.target.value as LineMethod, ...(e.target.value === 'divisor' ? { applies_to: 'subtotal' as AppliesTo } : {}) })} style={ui.input}>
                            {METHODS.map(m => <option key={m} value={m}>{t(`method.${m}`)}</option>)}
                          </select>
                        </td>
                        <td style={{ ...ui.td, ...ui.num }}><input aria-label={t('templates.rate')} inputMode="decimal" value={l.rate} disabled={!canEdit} onChange={e => setLine(i, { rate: e.target.value })} style={{ ...ui.input, width: 90, textAlign: 'right' }} /></td>
                        <td style={{ ...ui.td, whiteSpace: 'nowrap' }}>
                          {canEdit && <>
                            <button type="button" aria-label={t('templates.moveUp')} style={{ ...ui.buttonSmall, marginRight: 4 }} disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                            <button type="button" aria-label={t('templates.moveDown')} style={{ ...ui.buttonSmall, marginRight: 4 }} disabled={i === draft.lines.length - 1} onClick={() => move(i, 1)}>↓</button>
                            <button type="button" aria-label={t('action.delete')} style={ui.buttonSmall} onClick={() => setDraft({ ...draft, lines: draft.lines.filter((_, n) => n !== i) })}>✕</button>
                          </>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {canEdit && <button type="button" style={{ ...ui.buttonGhost, alignSelf: 'flex-start' }} onClick={() => setDraft({ ...draft, lines: [...draft.lines, newLine(draft.lines.length)] })}>{t('templates.addLine')}</button>}
              <p style={{ ...ui.small, margin: 0 }}>{t('templates.rulesNote')}</p>
              <label style={ui.label}>{t('field.notes')}<input value={draft.notes} disabled={!canEdit} onChange={e => setDraft({ ...draft, notes: e.target.value })} style={ui.input} /></label>
              {canEdit && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  <button type="button" disabled={saving} onClick={save} style={ui.button}>{saving ? t('action.saving') : t('action.save')}</button>
                  <button type="button" onClick={() => setDraft(null)} style={ui.buttonGhost}>{t('action.cancel')}</button>
                  <span style={{ flex: 1 }} />
                  {draft.id && <button type="button" onClick={remove} style={ui.buttonDanger}>{t('action.delete')}</button>}
                </div>
              )}
            </div>

            <section aria-label={t('templates.preview')} style={{ ...ui.card, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <strong style={{ fontSize: 14, color: '#173441' }}>{t('templates.previewTitle', { direct: formatMoney(100000, currency, numberFormat), material: formatMoney(60000, currency, numberFormat) })}</strong>
              {preview.result ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                    {preview.result.steps.filter(s => s.method === 'percent').map(s => (
                      <div key={s.key} style={{ padding: 10, borderRadius: 8, background: '#f2f7f8' }}>
                        <div style={{ fontSize: 11, color: '#3f5862' }}>+ {s.label || '—'} ({formatPct(s.rate, numberFormat)})</div>
                        <strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(s.subtotal, currency, numberFormat)}</strong>
                      </div>
                    ))}
                    {preview.result.taxOnPricePct > 0 && (
                      <div style={{ padding: 10, borderRadius: 8, background: '#f2f7f8' }}>
                        <div style={{ fontSize: 11, color: '#3f5862' }}>÷ (1 − {formatPct(preview.result.taxOnPricePct, numberFormat)})</div>
                        <strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{formatMoney(preview.result.price, currency, numberFormat)}</strong>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'baseline', fontSize: 13 }}>
                    <span>{t('templates.price')} <strong style={{ fontSize: 18, color: '#075a53' }}>{formatMoney(preview.result.price, currency, numberFormat)}</strong></span>
                    <span>{t('templates.markup')} <strong>{formatPct(preview.result.markupPct, numberFormat)}</strong></span>
                  </div>
                </>
              ) : <div role="alert" style={ui.error}>{t('templates.errTaxes')}</div>}
            </section>
          </div>
        ) : (
          <div style={{ ...ui.empty, flex: '999 1 560px' }}>{t('templates.pick')}</div>
        )}
      </div>
    </div>
  )
}
