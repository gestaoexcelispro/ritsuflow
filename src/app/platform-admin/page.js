'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import styles from './platform-admin.module.css'

const supabase=createClient()
const WORKSPACES=[['projects','Projects'],['precon','PreCon'],['fieldop','FieldOp'],['ritsucad','RitsuCAD']]

export default function PlatformAdminPage(){
 const router=useRouter()
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false)
 const [organizations,setOrganizations]=useState([]),[selected,setSelected]=useState(null)
 const [query,setQuery]=useState(''),[error,setError]=useState(''),[success,setSuccess]=useState('')
 const [form,setForm]=useState(null)

 async function loadOrganizations(){
  const {data,error}=await supabase.rpc('get_platform_commercial_organizations')
  if(error)throw error
  setOrganizations(data||[])
 }
 async function openOrganization(id){
  try{
   setError('');setSuccess('')
   const {data,error}=await supabase.rpc('get_platform_commercial_organization',{p_organization_id:id})
   if(error)throw error
   const w=data?.workspaces||{}
   setSelected(data)
   setForm({commercial_status:data?.commercial_status||'active',active_project_limit:Number(data?.active_project_limit??1),contract_start:data?.contract_start||'',renewal_end_date:data?.renewal_end_date||'',commercial_reference:data?.commercial_reference||'',notes:data?.notes||'',projects:true,precon:Boolean(w.precon),fieldop:Boolean(w.fieldop),ritsucad:Boolean(w.ritsucad)})
  }catch(err){setError(err?.message||'Unable to load organization.')}
 }
 useEffect(()=>{let alive=true;(async()=>{try{const {data}=await supabase.auth.getUser();if(!data?.user){router.replace('/login');return}if(alive)await loadOrganizations()}catch(err){if(alive)setError(err?.message||'Platform Owner access required.')}finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[router])

 const filtered=useMemo(()=>organizations.filter(o=>`${o.organization_name||''} ${o.organization_number||''}`.toLowerCase().includes(query.toLowerCase())),[organizations,query])
 const counts=useMemo(()=>({total:organizations.length,active:organizations.filter(o=>o.commercial_status==='active').length,trial:organizations.filter(o=>o.commercial_status==='trial').length,inactive:organizations.filter(o=>['suspended','expired','cancelled'].includes(o.commercial_status)).length}),[organizations])

 async function save(){
  try{
   setSaving(true);setError('');setSuccess('')
   const {error}=await supabase.rpc('set_platform_commercial_entitlements',{p_organization_id:selected.organization_id,p_commercial_status:form.commercial_status,p_plan_name:'Commercial',p_active_project_limit:Number(form.active_project_limit),p_contract_start:form.contract_start||null,p_renewal_end_date:form.renewal_end_date||null,p_commercial_reference:form.commercial_reference||null,p_notes:form.notes||null,p_projects:true,p_precon:form.precon,p_fieldop:form.fieldop,p_ritsucad:form.ritsucad})
   if(error)throw error
   await loadOrganizations();await openOrganization(selected.organization_id);setSuccess('Organization license updated successfully.')
  }catch(err){setError(err?.message||'Unable to save organization license.')}finally{setSaving(false)}
 }
 if(loading)return <main className={styles.loading}>Loading Platform Administration...</main>
 return <main className={styles.page}>
  <header className={styles.header}><div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority/></div><div><h1>Platform Administration</h1><p>Manage customer organizations and their licenses</p></div><button onClick={()=>router.push('/workspaces')}>← Back to RitsuFlow</button></header>
  <section className={styles.content}>
   {error&&<div className={styles.error}>{error}</div>}{success&&<div className={styles.success}>{success}</div>}
   <section className={styles.summary}><article><small>TOTAL ORGANIZATIONS</small><strong>{counts.total}</strong><span>Customer organizations</span></article><article><small>ACTIVE</small><strong className={styles.green}>{counts.active}</strong><span>Licensed and active</span></article><article><small>TRIAL</small><strong className={styles.blue}>{counts.trial}</strong><span>In trial period</span></article><article><small>SUSPENDED / EXPIRED</small><strong className={styles.red}>{counts.inactive}</strong><span>Not active</span></article></section>
   <section className={styles.organizations}><div className={styles.listHead}><div><h2>Organizations</h2><p>View and manage customer organizations and their commercial license.</p></div><div className={styles.actions}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search organizations..."/><button disabled title="Organization onboarding will be connected in the next step">+ Add Organization</button></div></div>
    <div className={styles.tableWrap}><table><thead><tr><th>Organization</th><th>Status</th><th>Active Projects</th><th>Project Limit</th><th>Workspaces Included</th><th>Contract Period</th><th>Actions</th></tr></thead><tbody>{filtered.map(o=><tr key={o.organization_id}><td><b>{o.organization_name}</b><small>{o.organization_number||'—'}</small></td><td><span className={`${styles.status} ${styles[o.commercial_status]||''}`}>● {o.commercial_status||'—'}</span></td><td>{o.active_projects??0}</td><td>{o.active_project_limit??'—'}</td><td><div className={styles.tags}>{WORKSPACES.filter(([key])=>key==='projects'||o.workspaces?.[key]).map(([key,name])=><span key={key}>{name}</span>)}</div></td><td>{o.contract_start||'—'} → {o.renewal_end_date||'—'}</td><td><button className={styles.manage} onClick={()=>openOrganization(o.organization_id)}>Manage</button></td></tr>)}</tbody></table></div>
    {!filtered.length&&<div className={styles.empty}>No organizations found.</div>}
   </section>
  </section>
  {selected&&form&&<div className={styles.overlay} onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}><section className={styles.modal}><div className={styles.modalHead}><div><small>MANAGE ORGANIZATION</small><h2>{selected.organization_name}</h2><p>{selected.organization_number||selected.organization_id}</p></div><button onClick={()=>setSelected(null)}>×</button></div><div className={styles.modalGrid}>
   <article><h3>Commercial License</h3><label>Status<select value={form.commercial_status} onChange={e=>setForm({...form,commercial_status:e.target.value})}><option value="trial">Trial</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select></label><label>Active Project Limit<input type="number" min="0" value={form.active_project_limit} onChange={e=>setForm({...form,active_project_limit:e.target.value})}/></label><div className={styles.two}><label>Contract Start<input type="date" value={form.contract_start} onChange={e=>setForm({...form,contract_start:e.target.value})}/></label><label>Contract End<input type="date" value={form.renewal_end_date} onChange={e=>setForm({...form,renewal_end_date:e.target.value})}/></label></div><label>Contract Reference<input value={form.commercial_reference} onChange={e=>setForm({...form,commercial_reference:e.target.value})}/></label></article>
   <article><h3>Workspaces Included</h3><div className={styles.workspaceList}>{WORKSPACES.map(([key,name])=><label key={key}><input type="checkbox" checked={Boolean(form[key])} disabled={key==='projects'} onChange={e=>setForm({...form,[key]:e.target.checked})}/><span><b>{name}</b><small>{key==='projects'?'Core workspace (required)':'Included in customer license'}</small></span></label>)}</div><label>Internal Notes<textarea rows="4" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></article>
  </div><div className={styles.modalFooter}><span>Customer administrators can view these limits but cannot increase them.</span><div><button className={styles.cancel} onClick={()=>setSelected(null)}>Cancel</button><button className={styles.save} disabled={saving} onClick={save}>{saving?'Saving...':'Save Changes'}</button></div></div></section></div>}
 </main>
}
