'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { useT } from '../../../lib/i18n/useT'
import { AppShell, Badge, Empty, Icon, Notice, Segments, Stat, Stats, ui } from '../../fieldop/ui'
import { Dialog } from '../../fieldop/ui/dialogs'
import { suggestWorkPackageCode } from './suggestCode'
import styles from './work-packages.module.css'

const supabase = createClient()
const CODE = /^[A-Z]{3}$/
// codeEdited: the user typed their own code, so the description stops overwriting it.
const EMPTY_FORM = { id: null, code: '', description: '', codeEdited: false }

/** Label + control. Module level so inputs keep focus while typing. */
function Field({ label, hint, children }) {
  return <label className={ui.field}><span className={ui.fieldLabel}>{label}</span>{children}{hint && <small className={ui.fieldHint}>{hint}</small>}</label>
}

/**
 * Company work package catalog: 3-letter codes, descriptions and colors used by every project's
 * Master Plan and Lookahead. Projects choose which packages they use inside Master Plan.
 */
export default function WorkPackagesSettings() {
  const t = useT('settings')
  const router = useRouter()
  const [organization, setOrganization] = useState(null)
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('active')
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [message, setMessage] = useState({ tone: 'ok', text: '' })
  const say = (text, tone = 'ok') => setMessage({ text, tone })

  const loadPackages = useCallback(async (organizationId) => {
    const { data, error } = await supabase.rpc('get_organization_work_package_catalog', { target_organization_id: organizationId })
    if (error) { say(t('workPackages.loadError', { message: error.message }), 'bad'); return }
    setPackages(data || [])
  }, [t])

  useEffect(() => {
    let active = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      const { data: members, error } = await supabase.from('organization_members').select('organization_id,role,organizations(id,name)').eq('user_id', user.id).eq('status', 'active')
      if (!active) return
      if (error) { say(error.message, 'bad'); setLoading(false); return }
      const membership = members?.find((x) => ['owner', 'admin'].includes(x.role)) || members?.[0]
      const org = membership?.organizations
      if (!org) { say(t('company.noCompany'), 'warn'); setLoading(false); return }
      setOrganization(org)
      await loadPackages(org.id)
      if (active) setLoading(false)
    })()
    return () => { active = false }
  }, [router, t, loadPackages])

  const counts = useMemo(() => ({
    active: packages.filter((p) => p.is_active).length,
    inactive: packages.filter((p) => !p.is_active).length,
  }), [packages])
  const visible = packages.filter((p) => (filter === 'all' ? true : filter === 'active' ? p.is_active : !p.is_active))

  const openForm = (pkg) => { setFormError(''); setForm(pkg ? { id: pkg.id, code: pkg.code, description: pkg.description, codeEdited: true } : EMPTY_FORM) }

  // New packages get their code from the description; existing codes only change when edited by hand.
  const changeDescription = (description) => setForm((f) => ({
    ...f,
    description,
    code: f.codeEdited ? f.code : suggestWorkPackageCode(description, packages.filter((p) => p.id !== f.id).map((p) => p.code)),
  }))
  const changeCode = (value) => {
    const code = value.toUpperCase().replace(/[^A-Z]/g, '')
    setForm((f) => ({ ...f, code, codeEdited: code !== '' || Boolean(f.id) }))
  }

  async function save(event) {
    event.preventDefault()
    const code = form.code.trim().toUpperCase()
    const description = form.description.trim()
    if (!CODE.test(code)) { setFormError(t('workPackages.errCode')); return }
    if (!description) { setFormError(t('workPackages.errDescription')); return }
    if (packages.some((p) => p.code === code && p.id !== form.id)) { setFormError(t('workPackages.errDuplicate', { code })); return }
    setSaving(true)
    const { error } = form.id
      ? await supabase.rpc('update_organization_work_package', { target_work_package_id: form.id, target_code: code, target_description: description })
      : await supabase.rpc('register_organization_work_package', { target_organization_id: organization.id, target_code: code, target_description: description })
    setSaving(false)
    if (error) { setFormError(error.message); return }
    setForm(null)
    say(form.id ? t('workPackages.updated', { code }) : t('workPackages.added', { code }))
    await loadPackages(organization.id)
  }

  async function toggleActive(pkg) {
    const { error } = await supabase.rpc('set_organization_work_package_active', { target_work_package_id: pkg.id, target_is_active: !pkg.is_active })
    if (error) { say(error.message, 'bad'); return }
    say(pkg.is_active ? t('workPackages.deactivated', { code: pkg.code }) : t('workPackages.activated', { code: pkg.code }))
    await loadPackages(organization.id)
  }

  const action = <button type="button" className={ui.btnPrimary} disabled={!organization} onClick={() => openForm(null)}><Icon name="plus" size={18} />{t('workPackages.add')}</button>

  return <AppShell module="settings" active="workPackages" action={action}>
    <div className={styles.page}>
      {message.text && <Notice tone={message.tone}>{message.text}</Notice>}
      <p className={styles.intro}>{t('workPackages.intro')}</p>
      <Stats>
        <Stat label={t('workPackages.statActive')} value={loading ? '—' : counts.active} hint={t('workPackages.statActiveHint')} />
        <Stat label={t('workPackages.statInactive')} value={loading ? '—' : counts.inactive} hint={t('workPackages.statInactiveHint')} />
      </Stats>

      <div className={styles.toolbar}>
        <Segments
          items={[{ value: 'active', label: t('workPackages.filterActive') }, { value: 'inactive', label: t('workPackages.filterInactive') }, { value: 'all', label: t('workPackages.filterAll') }]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {loading ? <p className={styles.muted}>{t('loading')}</p>
        : !visible.length ? <Empty title={t('workPackages.empty')} text={filter === 'active' ? t('workPackages.emptyText') : undefined} />
          : <div className={`${ui.panel} ${ui.tableWrap}`}><table className={`${ui.table} ${ui.phoneCards}`}>
            <thead><tr><th>{t('workPackages.colCode')}</th><th>{t('workPackages.colDescription')}</th><th>{t('workPackages.colStatus')}</th><th /></tr></thead>
            <tbody>{visible.map((pkg) => <tr key={pkg.id}>
              <td data-label=""><span className={styles.code}><span className={styles.swatch} style={{ backgroundColor: pkg.color || '#64748b' }} /><strong>{pkg.code}</strong></span></td>
              <td data-label={t('workPackages.colDescription')}>{pkg.description}</td>
              <td data-label={t('workPackages.colStatus')}><Badge tone={pkg.is_active ? 'ok' : undefined}>{pkg.is_active ? t('workPackages.active') : t('workPackages.inactive')}</Badge></td>
              <td data-label=""><div className={styles.rowActions}>
                <button type="button" className={`${ui.btnGhost} ${ui.small}`} onClick={() => openForm(pkg)}>{t('workPackages.edit')}</button>
                <button type="button" className={`${ui.btn} ${ui.small}`} onClick={() => toggleActive(pkg)}>{pkg.is_active ? t('workPackages.deactivate') : t('workPackages.activate')}</button>
              </div></td>
            </tr>)}</tbody>
          </table></div>}
    </div>

    {form && <Dialog
      size="small"
      as="form"
      onSubmit={save}
      title={form.id ? t('workPackages.editTitle') : t('workPackages.addTitle')}
      text={t('workPackages.formText')}
      onClose={() => setForm(null)}
      footer={<>
        <button type="button" className={ui.btn} onClick={() => setForm(null)}>{t('workPackages.cancel')}</button>
        <button type="submit" className={ui.btnPrimary} disabled={saving}>{saving ? t('workPackages.saving') : t('workPackages.save')}</button>
      </>}
    >
      {formError && <Notice>{formError}</Notice>}
      <Field label={t('workPackages.fieldDescription')}>
        <input value={form.description} autoFocus onChange={(e) => changeDescription(e.target.value)} />
      </Field>
      <Field label={t('workPackages.fieldCode')} hint={form.id ? t('workPackages.fieldCodeHintEdit') : t('workPackages.fieldCodeHint')}>
        <input value={form.code} maxLength={3} className={styles.codeInput} onChange={(e) => changeCode(e.target.value)} />
      </Field>
    </Dialog>}
  </AppShell>
}
