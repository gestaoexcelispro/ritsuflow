'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/i18n/useT'
import { FieldOpShell, Stats, Stat, Panel, Badge, Empty, Notice, Icon, ui } from '../fieldop/ui'

const initialFormData = { companyEmployeeNumber: '', firstName: '', middleName: '', lastName: '', companyId: '', tradeId: '', roleId: '', status: 'active' }

export default function WorkforceRegistryPage() {
  const t = useT('fieldopWorkforce')
  const [workers, setWorkers] = useState([])
  const [companies, setCompanies] = useState([])
  const [trades, setTrades] = useState([])
  const [roles, setRoles] = useState([])
  const [users, setUsers] = useState([])
  const [organizationId, setOrganizationId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [formError, setFormError] = useState('')
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(initialFormData)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const [w, c, tr, r] = await Promise.all([
        supabase.from('field_workers').select('id,organization_id,field_id,company_employee_number,first_name,middle_name,last_name,status,user_id,default_company_id,default_trade_id,default_role_id,field_companies:default_company_id(id,name),field_trades:default_trade_id(id,name),field_roles:default_role_id(id,name)').order('field_id'),
        supabase.from('field_companies').select('id,organization_id,name,status').eq('status', 'active').order('name'),
        supabase.from('field_trades').select('id,organization_id,name,status').eq('status', 'active').order('name'),
        supabase.from('field_roles').select('id,organization_id,name,status').eq('status', 'active').order('name'),
      ])
      const first = [w, c, tr, r].find((x) => x.error)
      if (first?.error) throw first.error
      const ws = w.data || []
      setWorkers(ws); setCompanies(c.data || []); setTrades(tr.data || []); setRoles(r.data || [])
      const org = ws[0]?.organization_id || c.data?.[0]?.organization_id || tr.data?.[0]?.organization_id || r.data?.[0]?.organization_id || null
      setOrganizationId(org)
      if (!org) { setError(t('registry.errOrg')); return }

      // Company users who can be linked to a worker (names are visible to company admins).
      const { data: members } = await supabase.from('organization_members').select('user_id,status').eq('organization_id', org).in('status', ['active', 'invited'])
      const ids = (members || []).map((m) => m.user_id)
      if (ids.length) {
        const { data: profiles } = await supabase.from('user_profiles').select('user_id,full_name,email').in('user_id', ids)
        const byId = new Map((profiles || []).map((p) => [p.user_id, p]))
        setUsers(ids.map((id) => ({ id, label: byId.get(id)?.full_name ? `${byId.get(id).full_name} · ${byId.get(id).email || ''}` : (byId.get(id)?.email || id) })).sort((a, b) => a.label.localeCompare(b.label)))
      } else setUsers([])
    } catch (e) { setError(e?.message || t('registry.errLoad')) }
    finally { setLoading(false) }
  }, [t])

  useEffect(() => { load() }, [load])

  const active = useMemo(() => workers.filter((x) => x.status === 'active').length, [workers])
  const inactive = workers.length - active
  const userLabel = useMemo(() => new Map(users.map((u) => [u.id, u.label])), [users])
  const linkedUserIds = useMemo(() => new Set(workers.map((w) => w.user_id).filter(Boolean)), [workers])
  const name = (w) => [w.first_name, w.middle_name, w.last_name].filter(Boolean).join(' ') || '—'

  function close() { if (saving) return; setOpen(false); setFormError(''); setForm(initialFormData) }

  async function addWorker(e) {
    e.preventDefault(); setFormError('')
    if (!organizationId) return setFormError(t('registry.errOrgRequired'))
    if (!form.firstName.trim() || !form.lastName.trim()) return setFormError(t('registry.errNames'))
    setSaving(true)
    try {
      const { error: insertError } = await supabase.from('field_workers').insert({ organization_id: organizationId, company_employee_number: form.companyEmployeeNumber.trim() || null, first_name: form.firstName.trim(), middle_name: form.middleName.trim() || null, last_name: form.lastName.trim(), default_company_id: form.companyId || null, default_trade_id: form.tradeId || null, default_role_id: form.roleId || null, status: form.status })
      if (insertError) throw insertError
      close(); await load()
    } catch (err) { setFormError(err?.message || t('registry.errAdd')) }
    finally { setSaving(false) }
  }

  async function linkUser(worker, userId) {
    setLinking(worker.id); setError(''); setNotice('')
    const { error: updateError } = await supabase.from('field_workers').update({ user_id: userId || null }).eq('id', worker.id)
    if (updateError) setError(updateError.message)
    else {
      setNotice(userId ? t('registry.linked', { worker: name(worker), user: userLabel.get(userId) || userId }) : t('registry.unlinked', { worker: name(worker) }))
      await load()
    }
    setLinking(null)
  }

  const orgCompanies = companies.filter((x) => !organizationId || x.organization_id === organizationId)
  const orgTrades = trades.filter((x) => !organizationId || x.organization_id === organizationId)
  const orgRoles = roles.filter((x) => !organizationId || x.organization_id === organizationId)
  const columns = [t('registry.colFieldId'), t('registry.colWorker'), t('registry.colEmployee'), t('registry.colCompany'), t('registry.colTrade'), t('registry.colRole'), t('registry.colStatus'), t('registry.colUser')]

  const addButton = <button type="button" className={ui.btnPrimary} onClick={() => { setForm(initialFormData); setFormError(''); setOpen(true) }}><Icon name="plus" size={18} />{t('registry.add')}</button>

  return <FieldOpShell active="workforce" action={addButton}>
    <Stats>
      <Stat label={t('registry.metricTotal')} value={workers.length} />
      <Stat label={t('registry.metricActive')} value={active} tone="ok" />
      <Stat label={t('registry.metricInactive')} value={inactive} />
    </Stats>
    <div style={{ display: 'grid', gap: 12, marginBottom: error || notice ? 12 : 0 }}>
      <Notice>{error}</Notice>
      <Notice tone="ok">{notice}</Notice>
    </div>
    <Panel body={false} title={t('registry.title')}
      actions={<Link href="/fieldop/projects" className={ui.btn}>{t('registry.fieldopProjects')}</Link>}>
      {loading
        ? <Empty title={t('registry.loading')} />
        : workers.length === 0
          ? <Empty title={t('registry.empty')} action={addButton} />
          : <div className={ui.tableWrap}><table className={`${ui.table} ${ui.cards}`}>
            <thead><tr>{columns.map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>{workers.map((w) => <tr key={w.id}>
              <td data-label={columns[0]}>{w.field_id || '—'}</td>
              <td data-label=""><strong>{name(w)}</strong></td>
              <td data-label={columns[2]}>{w.company_employee_number || '—'}</td>
              <td data-label={columns[3]}>{w.field_companies?.name || '—'}</td>
              <td data-label={columns[4]}>{w.field_trades?.name || '—'}</td>
              <td data-label={columns[5]}>{w.field_roles?.name || '—'}</td>
              <td data-label={columns[6]}><Badge tone={w.status === 'active' ? 'ok' : undefined}>{w.status === 'active' ? t('registry.statusActive') : t('registry.statusInactive')}</Badge></td>
              <td data-label={columns[7]}>
                <select title={t('registry.userHint')} value={w.user_id || ''} disabled={linking === w.id} onChange={(e) => linkUser(w, e.target.value)} style={{ minWidth: 200, maxWidth: 280 }}>
                  <option value="">{t('registry.noUser')}</option>
                  {w.user_id && !userLabel.has(w.user_id) && <option value={w.user_id}>{w.user_id}</option>}
                  {users.filter((u) => u.id === w.user_id || !linkedUserIds.has(u.id)).map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                </select>
              </td>
            </tr>)}</tbody>
          </table></div>}
    </Panel>
    {open && <div style={backdrop}><form style={modal} onSubmit={addWorker}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '20px 22px', borderBottom: '1px solid var(--fo-line-soft)' }}>
        <div><h2 style={{ margin: 0 }}>{t('registry.formTitle')}</h2><p style={{ margin: '6px 0 0', color: 'var(--fo-muted)' }}>{t('registry.formText')}</p></div>
        <button type="button" onClick={close} style={{ border: 0, background: 'transparent', fontSize: 24, cursor: 'pointer' }}>×</button>
      </header>
      {formError && <div style={{ margin: '16px 22px 0', padding: 10, borderRadius: 8, background: 'var(--fo-bad-wash)', color: 'var(--fo-bad)' }}>{formError}</div>}
      <div style={{ padding: 22, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Field label={t('registry.firstName')} value={form.firstName} required onChange={(v) => setForm({ ...form, firstName: v })} />
        <Field label={t('registry.middleName')} value={form.middleName} onChange={(v) => setForm({ ...form, middleName: v })} />
        <Field label={t('registry.lastName')} value={form.lastName} required onChange={(v) => setForm({ ...form, lastName: v })} />
        <Field label={t('registry.employeeNumber')} value={form.companyEmployeeNumber} onChange={(v) => setForm({ ...form, companyEmployeeNumber: v })} />
        <Select label={t('registry.defaultCompany')} notSet={t('registry.notSet')} value={form.companyId} onChange={(v) => setForm({ ...form, companyId: v })} options={orgCompanies} />
        <Select label={t('registry.defaultTrade')} notSet={t('registry.notSet')} value={form.tradeId} onChange={(v) => setForm({ ...form, tradeId: v })} options={orgTrades} />
        <Select label={t('registry.defaultRole')} notSet={t('registry.notSet')} value={form.roleId} onChange={(v) => setForm({ ...form, roleId: v })} options={orgRoles} />
        <label style={fieldLabel}>{t('registry.status')}<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}><option value="active">{t('registry.statusActive')}</option><option value="inactive">{t('registry.statusInactive')}</option></select></label>
      </div>
      <footer style={{ padding: '16px 22px', borderTop: '1px solid var(--fo-line-soft)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" className={ui.btn} onClick={close}>{t('registry.cancel')}</button>
        <button className={ui.btnPrimary} disabled={saving}>{saving ? t('registry.saving') : t('registry.submit')}</button>
      </footer>
    </form></div>}
  </FieldOpShell>
}

const backdrop = { position: 'fixed', inset: 0, background: 'rgba(6,38,55,.55)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 20 }
const modal = { width: 'min(720px,100%)', maxHeight: '90vh', overflow: 'auto', background: 'var(--fo-surface)', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }
const fieldLabel = { display: 'grid', gap: 6, fontSize: 14, fontWeight: 600 }
const input = {}
function Field({ label, value, onChange, required }) { return <label style={fieldLabel}>{label}<input style={input} value={value} required={required} onChange={(e) => onChange(e.target.value)} /></label> }
function Select({ label, notSet, value, onChange, options }) { return <label style={fieldLabel}>{label}<select style={input} value={value} onChange={(e) => onChange(e.target.value)}><option value="">{notSet}</option>{options.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label> }
