'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { AppShell, Badge, Empty, Icon, Notice, Stat, Stats, ui } from '../../fieldop/ui'
import { useT } from '../../../lib/i18n/useT'
import styles from './work-packages.module.css'

const supabase = createClient()
const BLANK = { code: '', description: '' }

// Codes are three letters (A–Z); Master Plan and Lookahead show them in the planning grid.
const cleanCode = (value) => String(value || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)

const textOn = (hex) => {
  const value = String(hex || '').replace('#', '')
  if (value.length !== 6) return '#000000'
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16))
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#000000' : '#ffffff'
}

/** Label + control. Module-level so inputs keep focus while typing. */
function Field({ label, hint, children }) {
  return <label className={ui.field}><span className={ui.fieldLabel}>{label}</span>{children}{hint && <span className={styles.hint}>{hint}</span>}</label>
}

export default function WorkPackagesSettings() {
  const t = useT('settings')
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState(null)
  const [canEdit, setCanEdit] = useState(false)
  const [items, setItems] = useState([])
  const [message, setMessage] = useState({ tone: 'ok', text: '' })
  const [modal, setModal] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [modalError, setModalError] = useState('')
  const [busy, setBusy] = useState(false)
  const say = (text, tone = 'ok') => setMessage({ text, tone })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    const { data: mine, error: me } = await supabase.from('organization_members').select('organization_id,role,status,organizations(id,name)').eq('user_id', user.id).eq('status', 'active')
    if (me) throw me
    const membership = mine?.find((x) => ['owner', 'admin'].includes(x.role)) || mine?.[0]
    if (!membership?.organization_id) throw new Error(t('workPackages.errNoCompany'))
    setOrg(membership.organizations || { id: membership.organization_id, name: '' })
    setCanEdit(['owner', 'admin'].includes(membership.role))
    const { data, error } = await supabase.rpc('get_organization_work_package_catalog', { target_organization_id: membership.organization_id })
    if (error) throw error
    setItems(data || [])
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch((e) => say(e.message, 'bad')).finally(() => setLoading(false)) }, [load])

  const sorted = useMemo(() => [...items].sort((a, b) => (a.is_active === b.is_active ? String(a.code).localeCompare(String(b.code)) : a.is_active ? -1 : 1)), [items])
  const active = items.filter((item) => item.is_active).length

  function openAdd() { setForm(BLANK); setModalError(''); setModal({ mode: 'add' }) }
  function openEdit(item) { setForm({ code: item.code || '', description: item.description || '' }); setModalError(''); setModal({ mode: 'edit', item }) }
  function close() { if (!busy) setModal(null) }

  async function save(event) {
    event.preventDefault()
    const code = cleanCode(form.code)
    const description = form.description.trim()
    if (code.length !== 3) { setModalError(t('workPackages.errCode')); return }
    if (!description) { setModalError(t('workPackages.errDescription')); return }
    if (items.some((item) => item.code === code && item.id !== modal.item?.id)) { setModalError(t('workPackages.errDuplicate', { code })); return }
    setBusy(true); setModalError('')
    try {
      const { error } = modal.mode === 'add'
        ? await supabase.rpc('register_organization_work_package', { target_organization_id: org.id, target_code: code, target_description: description })
        : await supabase.rpc('update_organization_work_package', { target_work_package_id: modal.item.id, target_code: code, target_description: description })
      if (error) throw error
      await load()
      say(t(modal.mode === 'add' ? 'workPackages.added' : 'workPackages.updated', { code }))
      setModal(null)
    } catch (error) {
      setModalError(error.message)
    } finally { setBusy(false) }
  }

  async function toggle(item) {
    setBusy(true)
    try {
      const { error } = await supabase.rpc('set_organization_work_package_active', { target_work_package_id: item.id, target_is_active: !item.is_active })
      if (error) throw error
      await load()
      say(t(item.is_active ? 'workPackages.deactivated' : 'workPackages.activated', { code: item.code }))
    } catch (error) { say(error.message, 'bad') } finally { setBusy(false) }
  }

  const action = canEdit && <button type="button" className={ui.btnPrimary} disabled={!org} onClick={openAdd}><Icon name="plus" size={18} />{t('workPackages.addShort')}</button>

  return <AppShell module="settings" active="workPackages" action={action}>
    {loading ? <p className={styles.muted}>{t('loading')}</p> : <div className={styles.stack}>
      {message.text && <Notice tone={message.tone}>{message.text}</Notice>}
      {!canEdit && org && <Notice tone="warn">{t('workPackages.readOnly')}</Notice>}
      <Stats>
        <Stat label={t('workPackages.statActive')} value={active} hint={org?.name} />
        <Stat label={t('workPackages.statInactive')} value={items.length - active} hint={t('workPackages.statInactiveHint')} />
      </Stats>

      <section className={ui.panel}>
        <div className={styles.head}><div><h2>{t('workPackages.listTitle')}</h2><p>{t('workPackages.listText')}</p></div></div>
        {!sorted.length ? <Empty title={t('workPackages.empty')} text={t('workPackages.emptyText')} action={action} /> : <div className={ui.tableWrap}><table className={`${ui.table} ${ui.phoneCards}`}>
          <thead><tr><th>{t('workPackages.colCode')}</th><th>{t('workPackages.colDescription')}</th><th>{t('workPackages.colStatus')}</th><th /></tr></thead>
          <tbody>{sorted.map((item) => <tr key={item.id} className={item.is_active ? undefined : styles.inactive}>
            <td data-label=""><span className={styles.package}><span className={styles.code} style={{ background: item.color || '#64748b', color: textOn(item.color) }}>{item.code}</span></span></td>
            <td data-label={t('workPackages.colDescription')}>{item.description}</td>
            <td data-label={t('workPackages.colStatus')}><Badge tone={item.is_active ? 'ok' : undefined}>{t(item.is_active ? 'workPackages.active' : 'workPackages.inactive')}</Badge></td>
            <td data-label="">{canEdit && <div className={styles.rowActions}>
              <button type="button" className={`${ui.btn} ${ui.small}`} disabled={busy} onClick={() => openEdit(item)}>{t('workPackages.edit')}</button>
              <button type="button" className={`${ui.btnGhost} ${ui.small}`} disabled={busy} onClick={() => toggle(item)}>{t(item.is_active ? 'workPackages.deactivate' : 'workPackages.activate')}</button>
            </div>}</td>
          </tr>)}</tbody>
        </table></div>}
      </section>
      <p className={styles.note}>{t('workPackages.note')}</p>
    </div>}

    {modal && <div className={styles.overlay} role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <form className={styles.dialog} role="dialog" aria-modal="true" aria-label={t(modal.mode === 'add' ? 'workPackages.addTitle' : 'workPackages.editTitle')} onSubmit={save}>
        <div className={styles.dialogHead}>
          <div><h2>{t(modal.mode === 'add' ? 'workPackages.addTitle' : 'workPackages.editTitle')}</h2><p>{t('workPackages.dialogText')}</p></div>
          <button type="button" className={styles.close} onClick={close} aria-label={t('workPackages.cancel')}><Icon name="close" size={20} /></button>
        </div>
        <div className={styles.dialogBody}>
          {modalError && <Notice>{modalError}</Notice>}
          <Field label={t('workPackages.colCode')} hint={t('workPackages.codeHint')}>
            <input className={styles.codeInput} value={form.code} maxLength={3} autoFocus onChange={(e) => setForm((f) => ({ ...f, code: cleanCode(e.target.value) }))} />
          </Field>
          <Field label={t('workPackages.colDescription')}>
            <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </Field>
        </div>
        <div className={styles.dialogFoot}>
          <button type="button" className={ui.btn} onClick={close} disabled={busy}>{t('workPackages.cancel')}</button>
          <button type="submit" className={ui.btnPrimary} disabled={busy}>{t(modal.mode === 'add' ? 'workPackages.add' : 'workPackages.save')}</button>
        </div>
      </form>
    </div>}
  </AppShell>
}
