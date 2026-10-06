'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import { COUNTRIES } from '@/lib/takeoff/wallTypes'
import { createBid } from '@/lib/commercial/bids'
import { CURRENCIES, TEMPLATE_COLUMNS, currencyOf, type TemplateRow } from '@/lib/commercial/library'
import { useCommercialAccess } from './license'
import { ui } from './ui'

/** New bid: four fields, then straight into the bid workspace. */
export default function NewBidDialog({ onClose }: { onClose: () => void }) {
  const t = useT('commercial')
  const router = useRouter()
  const { language } = useLanguage()
  const { organizationId } = useCommercialAccess()
  const [name, setName] = useState('')
  const [client, setClient] = useState('')
  const [country, setCountry] = useState('BR')
  const [currency, setCurrency] = useState('BRL')
  const [dueDate, setDueDate] = useState('')
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [templateId, setTemplateId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    createClient().from('commercial_pricing_templates').select(TEMPLATE_COLUMNS).eq('country_code', country).then(({ data }) => {
      if (!active) return
      const list = ((data || []) as TemplateRow[]).sort((a, b) =>
        Number(!!b.organization_id) - Number(!!a.organization_id) || Number(b.is_default) - Number(a.is_default) || a.name.localeCompare(b.name))
      setTemplates(list)
      setTemplateId(list[0]?.id || '')
    })
    return () => { active = false }
  }, [country])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const chosen = useMemo(() => templates.find(x => x.id === templateId) || null, [templates, templateId])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError(t('newBid.errName')); return }
    if (!organizationId) { setError(t('error.noCompany')); return }
    setSaving(true); setError('')
    const supabase = createClient()
    const { data: auth } = await supabase.auth.getUser()
    if (!auth?.user) { setSaving(false); return }
    const res = await createBid(supabase, {
      organizationId, userId: auth.user.id, name, client, country, currency, dueDate,
      templateId: chosen?.id ?? null, templateLines: chosen?.lines ?? [],
    })
    if ('error' in res) { setSaving(false); setError(t('error.save', { message: res.error })); return }
    router.push(`/commercial/${res.projectId}`)
  }

  return (
    <div role="presentation" onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(23,52,65,.35)', display: 'grid', placeItems: 'center', padding: 16 }}>
      <form role="dialog" aria-modal="true" aria-labelledby="new-bid-title" onSubmit={submit}
        style={{ width: '100%', maxWidth: 640, background: '#fff', borderRadius: 14, boxShadow: '0 18px 50px rgba(23,52,65,.25)', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h2 id="new-bid-title" style={{ margin: 0, fontSize: 20, color: '#173441' }}>{t('newBid.title')}</h2>
          <p style={{ ...ui.subtitle, marginTop: 4 }}>{t('newBid.subtitle')}</p>
        </div>
        <div style={ui.formGrid}>
          <label style={{ ...ui.label, gridColumn: '1 / -1' }}>{t('newBid.name')}
            <input value={name} onChange={e => setName(e.target.value)} autoFocus required style={ui.input} />
          </label>
          <label style={ui.label}>{t('newBid.client')}<input value={client} onChange={e => setClient(e.target.value)} style={ui.input} /></label>
          <label style={ui.label}>{t('newBid.due')}<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={ui.input} /></label>
          <label style={ui.label}>{t('field.country')}
            <select value={country} onChange={e => { setCountry(e.target.value); setCurrency(currencyOf(e.target.value)) }} style={ui.input}>
              {COUNTRIES.map(c => <option key={c.code} value={c.code}>{language === 'pt-BR' ? c.name['pt-BR'] : c.name['en-US']}</option>)}
            </select>
          </label>
          <label style={ui.label}>{t('field.currency')}
            <select value={currency} onChange={e => setCurrency(e.target.value)} style={ui.input}>
              {[...new Set([...CURRENCIES, currency])].map(c => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ ...ui.label, gridColumn: '1 / -1' }}>{t('newBid.template')}
            <select value={templateId} onChange={e => setTemplateId(e.target.value)} style={ui.input}>
              {templates.length === 0 && <option value="">{t('newBid.noTemplate')}</option>}
              {templates.map(x => (
                <option key={x.id} value={x.id}>
                  {x.name} · {x.organization_id ? t('templates.company') : t('templates.standard')}{x.is_default ? ` · ${t('templates.default')}` : ''}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p style={{ ...ui.notice, margin: 0 }}>{t('newBid.later')}</p>
        {error && <div role="alert" style={ui.error}>{error}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" onClick={onClose} style={ui.buttonGhost}>{t('action.cancel')}</button>
          <button type="submit" disabled={saving} style={ui.button}>{saving ? t('newBid.creating') : t('newBid.create')}</button>
        </div>
      </form>
    </div>
  )
}
