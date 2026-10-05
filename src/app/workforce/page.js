'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/i18n/useT'
import LanguageSelector from '../../components/LanguageSelector'

const initialFormData = { companyEmployeeNumber: '', firstName: '', middleName: '', lastName: '', companyId: '', tradeId: '', roleId: '', status: 'active' }
const card = { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14 }
const btn = { minHeight: 38, padding: '0 14px', border: '1px solid #cbd5e1', borderRadius: 9, background: '#fff', color: '#082a4a', fontWeight: 800, cursor: 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }
const primary = { ...btn, background: '#08aa96', borderColor: '#078c7c', color: '#fff' }

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

  return <main style={{ minHeight: '100vh', background: '#f6f8fa', color: '#0f172a' }}>
    <header style={{ padding: '20px 28px', background: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.12em', color: '#64748b' }}>{t('registry.eyebrow')}</div>
        <h1 style={{ margin: '5px 0 0', fontSize: 25, color: '#061b2f' }}>{t('registry.title')}</h1>
        <p style={{ margin: '6px 0 0', color: '#64748b' }}>{t('registry.text')}</p>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <LanguageSelector compact />
        <Link href="/fieldop/projects" style={btn}>{t('registry.fieldopProjects')}</Link>
        <button style={primary} onClick={() => { setForm(initialFormData); setFormError(''); setOpen(true) }}>{t('registry.add')}</button>
      </div>
    </header>
    <section style={{ padding: '26px 28px 40px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 }}>
        <Metric label={t('registry.metricTotal')} value={workers.length} />
        <Metric label={t('registry.metricActive')} value={active} />
        <Metric label={t('registry.metricInactive')} value={inactive} />
      </div>
      {error && <div style={{ padding: 12, border: '1px solid #fecaca', borderRadius: 9, background: '#fef2f2', color: '#991b1b' }}>{error}</div>}
      {notice && <div style={{ padding: 12, border: '1px solid #bbf7d0', borderRadius: 9, background: '#f0fdf4', color: '#166534' }}>{notice}</div>}
      <section style={{ ...card, overflow: 'hidden' }}>
        {loading
          ? <div style={empty}>{t('registry.loading')}</div>
          : workers.length === 0
            ? <div style={empty}>{t('registry.empty')}</div>
            : <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f8fafc' }}>{columns.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>{workers.map((w) => <tr key={w.id} style={{ borderTop: '1px solid #e2e8f0' }}>
                <td style={td}>{w.field_id || '—'}</td>
                <td style={td}><strong>{name(w)}</strong></td>
                <td style={td}>{w.company_employee_number || '—'}</td>
                <td style={td}>{w.field_companies?.name || '—'}</td>
                <td style={td}>{w.field_trades?.name || '—'}</td>
                <td style={td}>{w.field_roles?.name || '—'}</td>
                <td style={td}><strong style={{ color: w.status === 'active' ? '#047857' : '#64748b' }}>{w.status === 'active' ? t('registry.statusActive') : t('registry.statusInactive')}</strong></td>
                <td style={td}>
                  <select title={t('registry.userHint')} value={w.user_id || ''} disabled={linking === w.id} onChange={(e) => linkUser(w, e.target.value)} style={{ ...input, height: 34, maxWidth: 280 }}>
                    <option value="">{t('registry.noUser')}</option>
                    {w.user_id && !userLabel.has(w.user_id) && <option value={w.user_id}>{w.user_id}</option>}
                    {users.filter((u) => u.id === w.user_id || !linkedUserIds.has(u.id)).map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                  </select>
                </td>
              </tr>)}</tbody>
            </table></div>}
      </section>
    </section>
    {open && <div style={backdrop}><form style={modal} onSubmit={addWorker}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '20px 22px', borderBottom: '1px solid #e2e8f0' }}>
        <div><h2 style={{ margin: 0 }}>{t('registry.formTitle')}</h2><p style={{ margin: '6px 0 0', color: '#64748b' }}>{t('registry.formText')}</p></div>
        <button type="button" onClick={close} style={{ border: 0, background: 'transparent', fontSize: 24, cursor: 'pointer' }}>×</button>
      </header>
      {formError && <div style={{ margin: '16px 22px 0', padding: 10, borderRadius: 8, background: '#fef2f2', color: '#991b1b' }}>{formError}</div>}
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
      <footer style={{ padding: '16px 22px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" style={btn} onClick={close}>{t('registry.cancel')}</button>
        <button style={primary} disabled={saving}>{saving ? t('registry.saving') : t('registry.submit')}</button>
      </footer>
    </form></div>}
  </main>
}

const th = { padding: '11px 14px', color: '#64748b', fontSize: 11, fontWeight: 800, textAlign: 'left', textTransform: 'uppercase', whiteSpace: 'nowrap' }
const td = { padding: '13px 14px', color: '#475569', fontSize: 13, whiteSpace: 'nowrap' }
const empty = { padding: 36, color: '#64748b', textAlign: 'center' }
const backdrop = { position: 'fixed', inset: 0, background: 'rgba(6,27,47,.48)', display: 'grid', placeItems: 'center', zIndex: 50, padding: 20 }
const modal = { width: 'min(720px,100%)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,.25)' }
const fieldLabel = { display: 'grid', gap: 6, fontSize: 12, fontWeight: 800, color: '#475569' }
const input = { height: 40, border: '1px solid #cbd5e1', borderRadius: 8, padding: '0 10px', background: '#fff', color: '#0f172a' }
function Metric({ label, value }) { return <div style={{ ...card, padding: 17 }}><div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{label}</div><div style={{ marginTop: 6, fontSize: 24, fontWeight: 850, color: '#061b2f' }}>{value}</div></div> }
function Field({ label, value, onChange, required }) { return <label style={fieldLabel}>{label}<input style={input} value={value} required={required} onChange={(e) => onChange(e.target.value)} /></label> }
function Select({ label, notSet, value, onChange, options }) { return <label style={fieldLabel}>{label}<select style={input} value={value} onChange={(e) => onChange(e.target.value)}><option value="">{notSet}</option>{options.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label> }
