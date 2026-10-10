'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { AppShell, Icon, Notice, Panel, ui } from '../../fieldop/ui'
import { useT } from '../../../lib/i18n/useT'
import { useLanguage } from '../../../lib/i18n/LanguageProvider'
import { LANGUAGE_OPTIONS } from '../../../lib/i18n/settings'
import styles from './company.module.css'

const supabase = createClient()
const EMPTY = { name: '', legal_name: '', tax_id: '', email: '', phone: '', website: '', address_line: '', address_line_2: '', city: '', state_region: '', postal_code: '', country_code: 'BR', default_currency: 'BRL', timezone: 'America/Sao_Paulo', unit_system: 'metric', date_format: 'DD/MM/YYYY', default_locale: 'en-US', logo_url: '', slug: '', organization_type: 'customer', organization_number: '', created_at: null, updated_at: null }
const CURRENCIES = ['BRL', 'USD', 'CAD', 'EUR']
const TIMEZONES = ['America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto', 'UTC']
const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
const MODULE_KEYS = ['project_setup', 'planning', 'daily_reports', 'workforce', 'production_control']
function loadScript(src, id) { return new Promise((resolve, reject) => { if (document.getElementById(id)) { resolve(); return } const s = document.createElement('script'); s.id = id; s.src = src; s.async = true; s.defer = true; s.onload = resolve; s.onerror = reject; document.head.appendChild(s) }) }

/** Label + control. Module-level so inputs keep focus while typing. */
function Field({ label, hint, wide, children }) {
  return <label className={`${ui.field} ${wide ? styles.wide : ''}`}><span className={ui.fieldLabel}>{label}</span>{children}{hint && <small className={ui.fieldHint}>{hint}</small>}</label>
}

export default function CompanySettings() {
  const t = useT('settings')
  const { language } = useLanguage()
  const router = useRouter()
  const fileRef = useRef(null)
  const [form, setForm] = useState(EMPTY)
  const [organizationId, setOrganizationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ tone: 'ok', text: '' })
  const [license, setLicense] = useState(null)
  const [platformRole, setPlatformRole] = useState(null)
  const say = (text, tone = 'ok') => setMessage({ text, tone })
  const fmtDate = (v) => (v ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(v)) : '—')
  const roleText = (r) => (r ? String(r).replaceAll('_', ' ') : '—')

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: members, error } = await supabase.from('organization_members').select('organization_id,role,status,organizations(*)').eq('user_id', user.id).eq('status', 'active')
      if (!active) return
      if (error) { say(error.message, 'bad'); setLoading(false); return }
      const membership = members?.find((x) => ['owner', 'admin'].includes(x.role)) || members?.[0]
      const org = membership?.organizations
      if (!org) { say(t('company.noCompany'), 'warn'); setLoading(false); return }
      setOrganizationId(org.id); setForm({ ...EMPTY, ...org })
      const [{ data: roles }, { data: licenseRows }] = await Promise.all([
        supabase.from('platform_user_roles').select('role,is_active').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
        supabase.rpc('get_platform_organizations'),
      ])
      if (roles) setPlatformRole(roles.role)
      if (Array.isArray(licenseRows)) { const row = licenseRows.find((x) => x.organization_id === org.id); if (row) setLicense(row) }
      setLoading(false)
    })().catch((e) => { if (active) { say(e.message, 'bad'); setLoading(false) } })
    return () => { active = false }
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps

  const isPlatformOperator = form.organization_type === 'platform_operator'
  const change = (e) => setForm((v) => ({ ...v, [e.target.name]: e.target.value }))

  async function persistLogo(file) {
    if (!organizationId || !file) return
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'].includes(file.type)) throw new Error(t('company.errLogoType'))
    if (file.size > 5 * 1024 * 1024) throw new Error(t('company.errLogoSize'))
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${organizationId}/logo-${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage.from('company-assets').upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type })
    if (uploadError) throw new Error(t('company.errLogoUpload', { message: uploadError.message || '' }))
    const { data } = supabase.storage.from('company-assets').getPublicUrl(path)
    const url = data?.publicUrl
    if (!url) throw new Error(t('company.errLogoUpload', { message: 'public URL' }))
    const { error: updateError } = await supabase.from('organizations').update({ logo_url: url }).eq('id', organizationId)
    if (updateError) throw new Error(t('company.errLogoSave', { message: updateError.message || '' }))
    setForm((v) => ({ ...v, logo_url: url }))
    return url
  }
  async function uploadComputer(e) {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); say('')
    try { await persistLogo(file); say(t('company.logoUploaded')) } catch (err) { say(err.message || t('company.errLogoUpload', { message: '' }), 'bad') } finally { setUploading(false); e.target.value = '' }
  }
  async function importDrive() {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_API_KEY
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_DRIVE_CLIENT_ID
    if (!apiKey || !clientId) { say(t('company.driveNotConfigured'), 'warn'); return }
    setUploading(true); say('')
    try {
      await Promise.all([loadScript('https://apis.google.com/js/api.js', 'google-api-js'), loadScript('https://accounts.google.com/gsi/client', 'google-identity-js')])
      await new Promise((resolve, reject) => window.gapi.load('picker', { callback: resolve, onerror: reject }))
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId, scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: async (tokenResponse) => {
          try {
            if (tokenResponse.error) throw new Error(tokenResponse.error)
            const view = new window.google.picker.View(window.google.picker.ViewId.DOCS_IMAGES)
            const picker = new window.google.picker.PickerBuilder().setDeveloperKey(apiKey).setOAuthToken(tokenResponse.access_token).addView(view).setLocale(language).setCallback(async (data) => {
              if (data.action === window.google.picker.Action.PICKED) {
                try {
                  const doc = data.docs[0]
                  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(doc.id)}?alt=media`, { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } })
                  if (!response.ok) throw new Error(t('company.errDriveDownload'))
                  const blob = await response.blob()
                  await persistLogo(new File([blob], doc.name || 'company-logo', { type: blob.type || doc.mimeType || 'image/png' }))
                  say(t('company.logoImported'))
                } catch (err) { say(err.message || t('company.errDrive'), 'bad') } finally { setUploading(false) }
              } else if (data.action === window.google.picker.Action.CANCEL) setUploading(false)
            }).build()
            picker.setVisible(true)
          } catch (err) { setUploading(false); say(err.message || t('company.errDrive'), 'bad') }
        },
      })
      tokenClient.requestAccessToken({ prompt: 'consent' })
    } catch (err) { setUploading(false); say(err.message || t('company.errDrive'), 'bad') }
  }
  async function save(e) {
    e.preventDefault(); if (!organizationId) return
    setSaving(true); say('')
    const payload = { name: form.name.trim(), legal_name: form.legal_name || null, tax_id: form.tax_id || null, email: form.email || null, phone: form.phone || null, website: form.website || null, address_line: form.address_line || null, address_line_2: form.address_line_2 || null, city: form.city || null, state_region: form.state_region || null, postal_code: form.postal_code || null, country_code: form.country_code || null, default_currency: form.default_currency, timezone: form.timezone, unit_system: form.unit_system, date_format: form.date_format, default_locale: form.default_locale, logo_url: form.logo_url || null }
    const { data, error } = await supabase.from('organizations').update(payload).eq('id', organizationId).select('*').single()
    setSaving(false)
    if (error) say(error.message, 'bad'); else { setForm((v) => ({ ...v, ...data })); say(t('company.saved')) }
  }
  const modules = useMemo(() => license?.enabled_modules || [], [license])
  const saveButton = <button type="submit" form="company-form" className={ui.btnPrimary} disabled={saving || !organizationId}>{saving ? t('company.saving') : t('company.save')}</button>

  return <AppShell module="settings" active="company" action={saveButton}>
    {loading ? <p className={styles.muted}>{t('loading')}</p> : <form id="company-form" onSubmit={save} className={styles.stack}>
      {message.text && <Notice tone={message.tone}>{message.text}</Notice>}
      {isPlatformOperator && <Notice tone="warn">{t('company.operatorBadge', { role: roleText(platformRole) })}</Notice>}
      <div className={styles.columns}>
        <Panel title={t('company.identityTitle')} text={t('company.identityText')}>
          <div className={styles.grid}>
            <Field wide label={t('company.name')}><input required name="name" value={form.name} onChange={change} /></Field>
            <Field wide label={t('company.legalName')}><input name="legal_name" value={form.legal_name || ''} onChange={change} /></Field>
            <Field label={t('company.taxId')}><input name="tax_id" value={form.tax_id || ''} onChange={change} placeholder={t('company.taxIdPlaceholder')} /></Field>
            <Field label={t('company.slug')} hint={t('company.slugHint')}><input value={form.slug || ''} disabled /></Field>
            <Field label={t('company.type')}><input value={isPlatformOperator ? t('company.typeOperator') : t('company.typeCustomer')} disabled /></Field>
            <Field label={t('company.orgId')} hint={t('company.orgIdHint')}><input value={form.organization_number || '—'} disabled /></Field>
          </div>
        </Panel>
        <Panel title={t('company.contactTitle')} text={t('company.contactText')}>
          <div className={styles.grid}>
            <Field label={t('company.email')}><input type="email" name="email" value={form.email || ''} onChange={change} /></Field>
            <Field label={t('company.phone')}><input name="phone" value={form.phone || ''} onChange={change} /></Field>
            <Field wide label={t('company.website')}><input name="website" value={form.website || ''} onChange={change} placeholder="https://" /></Field>
            <Field label={t('company.address1')}><input name="address_line" value={form.address_line || ''} onChange={change} /></Field>
            <Field label={t('company.address2')}><input name="address_line_2" value={form.address_line_2 || ''} onChange={change} /></Field>
            <Field label={t('company.city')}><input name="city" value={form.city || ''} onChange={change} /></Field>
            <Field label={t('company.state')}><input name="state_region" value={form.state_region || ''} onChange={change} /></Field>
            <Field label={t('company.postal')}><input name="postal_code" value={form.postal_code || ''} onChange={change} /></Field>
            <Field label={t('company.country')}><input name="country_code" maxLength="2" value={form.country_code || ''} onChange={change} placeholder="BR, US, CA…" /></Field>
          </div>
        </Panel>
        <Panel title={t('company.brandingTitle')} text={t('company.brandingText')}>
          <div className={styles.logoRow}>
            <div className={styles.logoBox}>{form.logo_url ? <img src={form.logo_url} alt={t('company.logoAlt')} /> : <span><Icon name="building" size={28} />{t('company.noLogo')}</span>}</div>
            <div className={styles.logoActions}>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={uploadComputer} hidden />
              <button type="button" className={`${ui.btn} ${ui.small}`} disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? t('company.working') : t('company.uploadComputer')}</button>
              <button type="button" className={`${ui.btn} ${ui.small}`} disabled={uploading} onClick={importDrive}>{t('company.importDrive')}</button>
              <small className={ui.fieldHint}>{t('company.logoHint')}</small>
            </div>
          </div>
          <h3 className={styles.sub}>{t('company.regionalTitle')}</h3>
          <div className={styles.grid}>
            <Field label={t('company.currency')}><select name="default_currency" value={form.default_currency} onChange={change}>{[...new Set([...CURRENCIES, form.default_currency])].map((c) => <option key={c} value={c}>{c} — {t(`company.currencyName.${CURRENCIES.includes(c) ? c : 'OTHER'}`)}</option>)}</select></Field>
            <Field label={t('company.units')}><select name="unit_system" value={form.unit_system} onChange={change}><option value="metric">{t('loc.metric')}</option><option value="imperial">{t('loc.imperial')}</option></select></Field>
            <Field label={t('company.timezone')}><select name="timezone" value={form.timezone} onChange={change}>{[...new Set([...TIMEZONES, form.timezone])].map((z) => <option key={z} value={z}>{t(`company.tz.${TIMEZONES.includes(z) ? z.replace('/', '_') : 'OTHER'}`, { zone: z })}</option>)}</select></Field>
            <Field label={t('company.dateFormat')}><select name="date_format" value={form.date_format} onChange={change}>{DATE_FORMATS.map((f) => <option key={f} value={f}>{t(`company.dateFormatOption.${f.replaceAll('/', '_').replaceAll('-', '_')}`)}</option>)}</select></Field>
            <Field wide label={t('company.language')} hint={t('company.languageHint')}><select name="default_locale" value={form.default_locale} onChange={change}>{LANGUAGE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          </div>
        </Panel>
      </div>

      {isPlatformOperator ? <Panel title={t('company.operatorTitle')} text={t('company.operatorText')} actions={<span className={styles.readOnly}>{t('company.platformControlled')}</span>}>
        <dl className={styles.facts}>
          <div><dt>{t('company.orgRole')}</dt><dd>{t('company.typeOperator')}</dd></div>
          <div><dt>{t('company.yourPlatformRole')}</dt><dd>{roleText(platformRole)}</dd></div>
          <div><dt>{t('company.commercialFunction')}</dt><dd>{t('company.licenseProvider')}</dd></div>
          <div><dt>{t('company.customerData')}</dt><dd>{t('company.tenantIsolated')}</dd></div>
        </dl>
      </Panel> : <Panel title={t('company.licenseTitle')} text={t('company.licenseText')} actions={<span className={styles.readOnly}>{t('company.provisioningControlled')}</span>}>
        <dl className={styles.facts}>
          <div><dt>{t('company.plan')}</dt><dd>{license?.plan_code || '—'}</dd></div>
          <div><dt>{t('company.licenseStatus')}</dt><dd>{license?.license_status || '—'}</dd></div>
          <div><dt>{t('company.seatLimit')}</dt><dd>{license?.seat_limit ?? '—'}</dd></div>
          <div><dt>{t('company.seatsUsed')}</dt><dd>{license?.seats_used ?? '—'}</dd></div>
          <div><dt>{t('company.starts')}</dt><dd>{fmtDate(license?.starts_at)}</dd></div>
          <div><dt>{t('company.expires')}</dt><dd>{fmtDate(license?.expires_at)}</dd></div>
          <div className={styles.wide}><dt>{t('company.modules')}</dt><dd className={styles.chips}>{modules.length ? modules.map((m) => <span key={m}>{MODULE_KEYS.includes(m) ? t(`company.module.${m}`) : m}</span>) : '—'}</dd></div>
        </dl>
      </Panel>}

      <Panel title={t('company.adminTitle')} text={t('company.adminText')}>
        <dl className={styles.facts}>
          <div><dt>{isPlatformOperator ? t('company.yourPlatformRole') : t('company.primaryAdmin')}</dt><dd>{isPlatformOperator ? roleText(platformRole) : (license?.primary_admin_name || '—')}<small>{isPlatformOperator ? '' : (license?.primary_admin_email || '')}</small></dd></div>
          <div><dt>{t('company.createdAt')}</dt><dd>{fmtDate(form.created_at)}</dd></div>
          <div><dt>{t('company.updatedAt')}</dt><dd>{fmtDate(form.updated_at)}</dd></div>
          <div><dt>{t('company.dataIsolation')}</dt><dd>{t('company.isolated')}</dd></div>
        </dl>
      </Panel>
    </form>}
  </AppShell>
}
