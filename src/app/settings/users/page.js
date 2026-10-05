'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import { AppShell, Badge, Empty, Icon, Notice, Stat, Stats, ui } from '../../fieldop/ui'
import { useT } from '../../../lib/i18n/useT'
import { useLanguage } from '../../../lib/i18n/LanguageProvider'
import styles from './users.module.css'

const supabase = createClient()
const INCLUDED_PROJECT_CAPACITY = 10
const BLANK = { fullName: '', email: '', jobTitle: '', role: 'user', projectAccessMode: 'selected_projects', projectIds: [], workspaceAccess: ['projects'] }
const WORKSPACES = ['projects', 'precon', 'fieldop', 'ritsuscope']
const ROLES = ['admin', 'manager', 'user']
const STATUS_TONE = { active: 'ok', invited: 'info', suspended: 'warn', disabled: 'bad', removed: 'bad' }
const initialsOf = (text) => String(text || '?').split(/\s+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join('').toUpperCase()
const titleCase = (v) => String(v || '').replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())

/** Label + control. Module-level so inputs keep focus while typing. */
function Field({ label, wide, children }) {
  return <label className={`${ui.field} ${wide ? styles.wide : ''}`}><span className={ui.fieldLabel}>{label}</span>{children}</label>
}

export default function UsersAccess() {
  const t = useT('settings')
  const { language } = useLanguage()
  const router = useRouter()
  const fileRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [org, setOrg] = useState(null)
  const [members, setMembers] = useState([])
  const [projects, setProjects] = useState([])
  const [enabledModules, setEnabledModules] = useState([])
  const [message, setMessage] = useState({ tone: 'ok', text: '' })
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [resendingId, setResendingId] = useState(null)
  const [form, setForm] = useState(BLANK)
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const [modalError, setModalError] = useState('')
  const [currentUserId, setCurrentUserId] = useState(null)
  const [currentUserIsPlatformOwner, setCurrentUserIsPlatformOwner] = useState(false)
  const say = (text, tone = 'ok') => setMessage({ text, tone })

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.replace('/login'); return }
    setCurrentUserId(user.id)
    const [{ data: isPlatformOwner, error: platformError }, { data: mine, error: me }] = await Promise.all([
      supabase.rpc('is_platform_owner'),
      supabase.from('organization_members').select('organization_id,role,status').eq('user_id', user.id).eq('status', 'active'),
    ])
    if (platformError) console.error('Platform Owner status could not be loaded.', platformError)
    setCurrentUserIsPlatformOwner(isPlatformOwner === true)
    if (me) throw me
    const membership = mine?.find((x) => ['owner', 'admin'].includes(x.role)) || mine?.[0]
    if (!membership?.organization_id) throw new Error(t('users.errNoCompany'))
    const oid = membership.organization_id
    const [{ data: o, error: oe }, { data: ms, error: mE }, { data: ps, error: pE }, { data: prs, error: prE }, { data: mods }] = await Promise.all([
      supabase.from('organizations').select('id,name,slug,organization_number,owner_user_id').eq('id', oid).single(),
      supabase.from('organization_members').select('organization_id,user_id,role,status,joined_at,project_access_mode').eq('organization_id', oid).order('joined_at'),
      supabase.from('user_profiles').select('user_id,full_name,email,job_title,avatar_path,workspace_access'),
      supabase.from('projects').select('id,project_id,code,name,status').eq('organization_id', oid).order('name'),
      supabase.from('organization_modules').select('module_key,is_enabled').eq('organization_id', oid).eq('is_enabled', true),
    ])
    if (oe) throw oe; if (mE) throw mE; if (pE) throw pE; if (prE) throw prE
    const pm = new Map((ps || []).map((p) => [p.user_id, p]))
    setOrg(o); setMembers((ms || []).map((m) => ({ ...m, profile: pm.get(m.user_id) || null }))); setProjects(prs || []); setEnabledModules((mods || []).map((x) => x.module_key))
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load().catch((e) => say(e.message, 'bad')).finally(() => setLoading(false)) }, [load])
  useEffect(() => () => { if (preview && !preview.startsWith('http')) URL.revokeObjectURL(preview) }, [preview])

  const filtered = useMemo(() => { const q = search.toLowerCase(); return members.filter((m) => !q || [m.profile?.full_name, m.profile?.email, m.profile?.job_title, m.role, m.status].join(' ').toLowerCase().includes(q)) }, [members, search])
  const activeUsers = members.filter((m) => m.status === 'active').length
  const activeProjects = projects.filter((p) => String(p.status || '').toLowerCase() === 'active').length
  const capacityLeft = Math.max(0, INCLUDED_PROJECT_CAPACITY - activeProjects)
  const allowed = (k) => !enabledModules.length || k === 'projects' || enabledModules.some((m) => String(m).toLowerCase().includes(k))
  const avatarUrl = (p) => (p ? supabase.storage.from('user-avatars').getPublicUrl(p).data.publicUrl : '')
  const isProtected = (m) => currentUserIsPlatformOwner && m?.user_id === currentUserId
  const roleLabel = (r) => (['owner', 'admin', 'manager', 'user', 'viewer'].includes(r) ? t(`users.role.${r}`) : titleCase(r))
  const statusLabel = (s) => (['active', 'invited', 'suspended', 'disabled', 'removed'].includes(s) ? t(`users.status.${s}`) : titleCase(s))
  const accessLabel = (a) => t(`users.access.${a === 'all_projects' ? 'all' : 'selected'}`)
  const date = (v) => (v ? new Intl.DateTimeFormat(language, { dateStyle: 'medium' }).format(new Date(v)) : '—')

  function resetPhoto() { setPhoto(null); if (preview && !preview.startsWith('http')) URL.revokeObjectURL(preview); setPreview('') }
  function close() { setModal(null); resetPhoto(); setForm(BLANK); setModalError('') }
  function add() { setForm(BLANK); setModalError(''); setModal({ mode: 'add' }) }
  async function edit(m) {
    if (isProtected(m)) { say(t('users.errProtectedEdit'), 'warn'); return }
    const p = m.profile
    let projectIds = []
    if (m.project_access_mode === 'selected_projects') { const { data } = await supabase.from('project_members').select('project_id').eq('user_id', m.user_id); projectIds = (data || []).map((x) => x.project_id) }
    const savedWorkspaces = Array.isArray(p?.workspace_access) && p.workspace_access.length ? p.workspace_access : ['projects']
    setForm({ fullName: p?.full_name || '', email: p?.email || '', jobTitle: p?.job_title || '', role: m.role || 'user', projectAccessMode: m.project_access_mode || 'selected_projects', projectIds, workspaceAccess: savedWorkspaces })
    setPreview(avatarUrl(p?.avatar_path)); setModalError(''); setModal({ mode: 'edit', member: m })
  }
  function choosePhoto(e) {
    const f = e.target.files?.[0]; if (!f) return
    if (f.size > 5 * 1024 * 1024) return setModalError(t('users.errPhotoSize'))
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) return setModalError(t('users.errPhotoType'))
    if (preview && !preview.startsWith('http')) URL.revokeObjectURL(preview)
    setPhoto(f); setPreview(URL.createObjectURL(f)); setModalError('')
  }
  async function resendInvitation(m) {
    if (!org?.id || m.status !== 'invited' || resendingId) return
    say(''); setResendingId(m.user_id)
    try {
      const r = await fetch('/api/administration/users/resend-invitation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId: org.id, userId: m.user_id }) })
      const result = await r.json()
      if (!r.ok) throw new Error(result.error || t('users.errResend'))
      say(m.profile?.email ? t('users.resentTo', { email: m.profile.email }) : t('users.resent'))
    } catch (e) { say(e.message, 'bad') } finally { setResendingId(null) }
  }
  async function submit(e) {
    e.preventDefault(); setModalError('')
    if (!org?.id) return
    if (!form.workspaceAccess.length) return setModalError(t('users.errWorkspace'))
    if (form.role === 'admin' && form.projectAccessMode !== 'all_projects') return setModalError(t('users.errAdminAll'))
    if (form.role === 'user' && form.projectAccessMode !== 'selected_projects') return setModalError(t('users.errUserSelected'))
    if (form.projectAccessMode === 'selected_projects' && !form.projectIds.length) return setModalError(t('users.errProject'))
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const ext = photo?.name.split('.').pop()?.toLowerCase()
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }
      const body = JSON.stringify({ ...form, organizationId: org.id, avatarExt: photo ? ext : null })
      let doneMessage
      if (modal.mode === 'add') {
        const r = await fetch('/api/settings/users/invite', { method: 'POST', headers, body }); const result = await r.json()
        if (!r.ok) throw new Error(result.error || t('users.errInvite'))
        if (photo && result.avatarUpload) { const { error } = await supabase.storage.from('user-avatars').uploadToSignedUrl(result.avatarUpload.path, result.avatarUpload.token, photo, { contentType: photo.type, upsert: true }); if (error) throw new Error(t('users.errInvitePhoto', { message: error.message })) }
        doneMessage = t('users.invited', { email: result.user.email })
      } else {
        const r = await fetch(`/api/settings/users/${modal.member.user_id}`, { method: 'PATCH', headers, body }); const result = await r.json()
        if (!r.ok) throw new Error(result.error || t('users.errUpdate'))
        if (photo && result.avatarUpload) { const { error } = await supabase.storage.from('user-avatars').uploadToSignedUrl(result.avatarUpload.path, result.avatarUpload.token, photo, { contentType: photo.type, upsert: true }); if (error) throw new Error(t('users.errUpdatePhoto', { message: error.message })) }
        doneMessage = t('users.updated', { name: form.fullName })
      }
      close(); say(doneMessage); await load()
    } catch (err) { setModalError(err.message) } finally { setBusy(false) }
  }
  async function remove() {
    const m = modal?.member; if (!m || !org) return
    if (isProtected(m)) { setModalError(t('users.errProtectedRemove')); return }
    const name = m.profile?.full_name || m.profile?.email || t('users.thisUser')
    if (!window.confirm(t('users.confirmRemove', { name, company: org.name }))) return
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const r = await fetch(`/api/settings/users/${m.user_id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify({ organizationId: org.id }) })
      const result = await r.json()
      if (!r.ok) throw new Error(result.error || t('users.errRemove'))
      close(); say(t('users.removed', { name, company: org.name })); await load()
    } catch (e) { setModalError(e.message) } finally { setBusy(false) }
  }
  const setRole = (role) => setForm((f) => ({ ...f, role, projectAccessMode: role === 'admin' ? 'all_projects' : role === 'user' ? 'selected_projects' : f.projectAccessMode, projectIds: role === 'admin' ? [] : f.projectIds }))
  const toggleIn = (key, value) => setForm((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }))

  return <AppShell module="settings" active="users" action={<button type="button" className={ui.btnPrimary} disabled={!org} onClick={add}><Icon name="plus" size={18} />{t('users.add')}</button>}>
    {loading ? <p className={styles.muted}>{t('loading')}</p> : <div className={styles.stack}>
      {message.text && <Notice tone={message.tone}>{message.text}</Notice>}
      {currentUserIsPlatformOwner && <Notice tone="warn">{t('users.ownerProtection')}</Notice>}
      <Stats>
        <Stat label={t('users.statCompany')} value={<span className={styles.company}>{org?.name || '—'}</span>} hint={org?.organization_number || org?.slug} />
        <Stat label={t('users.statActive')} value={activeUsers} hint={t('users.unlimited')} />
        <Stat label={t('users.statProjects')} value={activeProjects} hint={t('users.projectsHint')} />
        <Stat label={t('users.statCapacity')} value={`${activeProjects} / ${INCLUDED_PROJECT_CAPACITY}`} hint={t('users.capacityHint', { count: capacityLeft })} tone={capacityLeft === 0 ? 'warn' : undefined} />
      </Stats>

      <section className={ui.panel}>
        <div className={styles.head}>
          <div><h2>{t('users.listTitle')}</h2><p>{t('users.listText')}</p></div>
          <label className={styles.search}><Icon name="search" size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('users.search')} aria-label={t('users.search')} /></label>
        </div>
        {!filtered.length ? <Empty title={t('users.empty')} /> : <div className={ui.tableWrap}><table className={`${ui.table} ${ui.phoneCards}`}>
          <thead><tr><th>{t('users.colUser')}</th><th>{t('users.colEmail')}</th><th>{t('users.colJob')}</th><th>{t('users.colRole')}</th><th>{t('users.colStatus')}</th><th>{t('users.colAccess')}</th><th>{t('users.colJoined')}</th><th /></tr></thead>
          <tbody>{filtered.map((m) => {
            const p = m.profile, a = avatarUrl(p?.avatar_path), protectedUser = isProtected(m)
            const note = protectedUser ? t('users.protectedOwner') : m.user_id === org?.owner_user_id ? t('users.primaryAdmin') : m.status === 'invited' ? t('users.awaiting') : ''
            return <tr key={m.user_id}>
              <td data-label=""><div className={styles.person}>{a ? <img src={a} alt="" /> : <b>{initialsOf(p?.full_name || p?.email)}</b>}<span><strong>{p?.full_name || t('users.unnamed')}</strong>{note && <small>{note}</small>}</span></div></td>
              <td data-label={t('users.colEmail')}>{p?.email || '—'}</td>
              <td data-label={t('users.colJob')}>{p?.job_title || '—'}</td>
              <td data-label={t('users.colRole')}>{protectedUser ? t('users.platformOwner') : roleLabel(m.role)}</td>
              <td data-label={t('users.colStatus')}><Badge tone={STATUS_TONE[m.status]}>{statusLabel(m.status)}</Badge></td>
              <td data-label={t('users.colAccess')}>{protectedUser ? t('users.protected') : accessLabel(m.project_access_mode)}</td>
              <td data-label={t('users.colJoined')}>{date(m.joined_at)}</td>
              <td data-label=""><div className={styles.rowActions}>
                {m.status === 'invited' && <button type="button" className={`${ui.btn} ${ui.small}`} disabled={resendingId === m.user_id} onClick={() => resendInvitation(m)}>{resendingId === m.user_id ? t('users.sending') : t('users.resend')}</button>}
                {protectedUser ? <span className={styles.lock} title={t('users.protected')}><Icon name="shield" size={18} /></span> : <button type="button" className={`${ui.btn} ${ui.small}`} onClick={() => edit(m)} aria-label={t('users.editAria', { name: p?.full_name || p?.email || '' })}>{t('users.edit')}</button>}
              </div></td>
            </tr>
          })}</tbody>
        </table></div>}
      </section>
      <p className={styles.note}><b>{t('users.noteTitle')}</b> {t('users.noteText')}</p>
    </div>}

    {modal && <div className={styles.overlay} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close() }}>
      <form className={styles.dialog} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
        <header className={styles.dialogHead}>
          <div><h2 id="user-dialog-title">{modal.mode === 'edit' ? t('users.editTitle') : t('users.addTitle')}</h2><p>{modal.mode === 'edit' ? t('users.editText', { company: org?.name }) : t('users.addText', { company: org?.name })}</p></div>
          <button type="button" className={styles.close} onClick={close} aria-label={t('users.close')}><Icon name="close" /></button>
        </header>
        <div className={styles.dialogBody}>
          <section className={styles.photoRow}>
            <div className={styles.avatar}>{preview ? <img src={preview} alt="" /> : <span>{form.fullName ? initialsOf(form.fullName) : '·'}</span>}</div>
            <div><b>{t('users.photo')} <em>{t('users.optional')}</em></b><button type="button" className={`${ui.btn} ${ui.small}`} onClick={() => fileRef.current?.click()}>{t('users.uploadPhoto')}</button><input ref={fileRef} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={choosePhoto} /><small>{t('users.photoHint')}</small></div>
          </section>
          <div className={styles.grid}>
            <Field label={`${t('users.fullName')} *`}><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
            <Field label={`${t('users.colEmail')} *`}><input required type="email" disabled={modal.mode === 'edit'} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            <Field label={t('users.colJob')}><input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder={t('users.jobPlaceholder')} /></Field>
            <Field label={`${t('users.colRole')} *`}><select value={form.role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{t(`users.role.${r}`)}</option>)}</select></Field>
          </div>
          <div className={styles.access}>
            <fieldset className={styles.fieldset}>
              <legend>{t('users.workspaceTitle')} *</legend>
              <p>{t('users.workspaceText')}</p>
              {WORKSPACES.map((k) => <label key={k} className={`${styles.option} ${!allowed(k) ? styles.optionOff : ''}`}><input type="checkbox" checked={form.workspaceAccess.includes(k)} disabled={!allowed(k)} onChange={() => toggleIn('workspaceAccess', k)} /><b>{t(`users.workspace.${k}`)}</b>{!allowed(k) && <small>{t('users.notInPlan')}</small>}</label>)}
            </fieldset>
            <fieldset className={styles.fieldset}>
              <legend>{t('users.projectTitle')} *</legend>
              <p>{t('users.projectText')}</p>
              <label className={styles.option}><input type="radio" disabled={form.role === 'user'} checked={form.projectAccessMode === 'all_projects'} onChange={() => setForm({ ...form, projectAccessMode: 'all_projects', projectIds: [] })} /><span><b>{t('users.access.all')}</b><small>{t('users.access.allHint')}</small></span></label>
              <label className={styles.option}><input type="radio" disabled={form.role === 'admin'} checked={form.projectAccessMode === 'selected_projects'} onChange={() => setForm({ ...form, projectAccessMode: 'selected_projects' })} /><span><b>{t('users.access.selected')}</b><small>{t('users.access.selectedHint')}</small></span></label>
              {form.projectAccessMode === 'selected_projects' && <div className={styles.projectList}>
                {projects.map((p) => <label key={p.id} className={styles.option}><input type="checkbox" checked={form.projectIds.includes(p.id)} onChange={() => toggleIn('projectIds', p.id)} /><span><b>{p.name}</b><small>{p.project_id || p.code || ''}</small></span></label>)}
                {!projects.length && <small className={styles.muted}>{t('users.noProjects')}</small>}
              </div>}
            </fieldset>
          </div>
          <div className={styles.policy}><b>{modal.mode === 'add' ? t('users.policyTitle') : t('users.accessTitle')}</b><span>{modal.mode === 'add' ? t('users.policyText') : t('users.accessText', { company: org?.name })}</span></div>
          {modalError && <Notice>{modalError}</Notice>}
        </div>
        <footer className={styles.dialogFoot}>
          {modal.mode === 'edit' && <button type="button" className={ui.btnDanger} disabled={busy} onClick={remove}>{t('users.remove')}</button>}
          <span className={styles.spacer} />
          <button type="button" className={ui.btn} disabled={busy} onClick={close}>{t('users.cancel')}</button>
          <button type="submit" className={ui.btnPrimary} disabled={busy}>{busy ? t('users.saving') : modal.mode === 'edit' ? t('users.save') : t('users.sendInvite')}</button>
        </footer>
      </form>
    </div>}
  </AppShell>
}
