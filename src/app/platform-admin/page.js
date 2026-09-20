'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import styles from './platform-admin.module.css'

const supabase = createClient()
const WORKSPACES = [
  ['projects','Projects','Core project environment'],
  ['precon','PreCon','Planning and production readiness'],
  ['fieldop','FieldOp','Field execution and workforce'],
  ['ritsucad','RitsuCAD','Drawing and takeoff environment'],
]

const emptyForm = {
  commercial_status:'active', plan_name:'Commercial', active_project_limit:1,
  contract_start:'', renewal_end_date:'', commercial_reference:'', notes:'',
  projects:true, precon:false, fieldop:false, ritsucad:false,
}

export default function PlatformAdminPage(){
  const router=useRouter()
  const [loading,setLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [organizations,setOrganizations]=useState([])
  const [selectedId,setSelectedId]=useState('')
  const [form,setForm]=useState(emptyForm)
  const [error,setError]=useState('')
  const [success,setSuccess]=useState('')
  const [query,setQuery]=useState('')

  async function loadOrganizations(preferredId=''){
    const {data,error}=await supabase.rpc('get_platform_commercial_organizations')
    if(error) throw error
    const rows=data||[]
    setOrganizations(rows)
    const id=preferredId || selectedId || rows[0]?.organization_id || ''
    if(id){setSelectedId(id);await loadOrganization(id)}
  }

  async function loadOrganization(id){
    setError('');setSuccess('')
    const {data,error}=await supabase.rpc('get_platform_commercial_organization',{p_organization_id:id})
    if(error) throw error
    const w=data?.workspaces||{}
    setForm({
      commercial_status:data?.commercial_status||'active',
      plan_name:data?.plan_name||'Commercial',
      active_project_limit:Number(data?.active_project_limit??1),
      contract_start:data?.contract_start||'',
      renewal_end_date:data?.renewal_end_date||'',
      commercial_reference:data?.commercial_reference||'',
      notes:data?.notes||'',
      projects:w.projects!==false,
      precon:Boolean(w.precon),fieldop:Boolean(w.fieldop),ritsucad:Boolean(w.ritsucad),
    })
  }

  useEffect(()=>{let alive=true;(async()=>{try{
    const {data:auth}=await supabase.auth.getUser()
    if(!auth?.user){router.replace('/login');return}
    if(alive) await loadOrganizations()
  }catch(err){if(alive)setError(err?.message||'Platform Owner access required.')}
  finally{if(alive)setLoading(false)}})();return()=>{alive=false}},[router])

  async function selectOrganization(id){
    try{setSelectedId(id);setLoading(true);await loadOrganization(id)}
    catch(err){setError(err?.message||'Unable to load organization.')}
    finally{setLoading(false)}
  }

  async function save(){
    try{
      setSaving(true);setError('');setSuccess('')
      const {error}=await supabase.rpc('set_platform_commercial_entitlements',{
        p_organization_id:selectedId,
        p_commercial_status:form.commercial_status,
        p_plan_name:form.plan_name,
        p_active_project_limit:Number(form.active_project_limit),
        p_contract_start:form.contract_start||null,
        p_renewal_end_date:form.renewal_end_date||null,
        p_commercial_reference:form.commercial_reference||null,
        p_notes:form.notes||null,
        p_projects:true,p_precon:form.precon,p_fieldop:form.fieldop,p_ritsucad:form.ritsucad,
      })
      if(error) throw error
      await loadOrganizations(selectedId)
      setSuccess('Commercial entitlements saved successfully.')
    }catch(err){setError(err?.message||'Unable to save commercial entitlements.')}
    finally{setSaving(false)}
  }

  const filtered=useMemo(()=>organizations.filter(o=>`${o.organization_name} ${o.organization_number||''}`.toLowerCase().includes(query.toLowerCase())),[organizations,query])
  const selected=organizations.find(o=>o.organization_id===selectedId)
  if(loading && !organizations.length)return <main className={styles.loading}>Loading Platform Administration...</main>

  return <main className={styles.page}>
    <header className={styles.header}>
      <div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority/></div>
      <div><h1>Platform Administration</h1><p>RitsuFlow commercial provisioning console</p></div>
      <button onClick={()=>router.push('/workspaces')}>← Back to RitsuFlow</button>
    </header>
    <section className={styles.body}>
      <aside className={styles.sidebar}>
        <div className={styles.sideTitle}><span>PLATFORM OWNER</span><h2>Organizations</h2><p>Select an organization to manage its commercial agreement.</p></div>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search organizations..."/>
        <div className={styles.orgList}>{filtered.map(o=><button key={o.organization_id} onClick={()=>selectOrganization(o.organization_id)} className={selectedId===o.organization_id?styles.selected:''}>
          <div><b>{o.organization_name}</b><span>{o.organization_number||'No organization number'}</span></div><small>{o.commercial_status}</small>
        </button>)}</div>
      </aside>

      <section className={styles.content}>
        {error&&<div className={styles.error}>{error}</div>}{success&&<div className={styles.success}>{success}</div>}
        {!selected?<div className={styles.empty}>Select an organization.</div>:<>
          <div className={styles.titleRow}><div><span>COMMERCIAL ACCOUNT</span><h2>{selected.organization_name}</h2><p>{selected.organization_number||selected.organization_id}</p></div><div className={styles.badge}>Platform Controlled</div></div>

          <div className={styles.grid}>
            <article className={styles.card}><div className={styles.cardHead}><div><span>AGREEMENT</span><h3>Commercial Terms</h3></div></div>
              <label>Commercial Status<select value={form.commercial_status} onChange={e=>setForm({...form,commercial_status:e.target.value})}><option value="trial">Trial</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></label>
              <label>Plan Name<input value={form.plan_name} onChange={e=>setForm({...form,plan_name:e.target.value})}/></label>
              <label>Commercial Reference<input value={form.commercial_reference} onChange={e=>setForm({...form,commercial_reference:e.target.value})} placeholder="Contract / proposal reference"/></label>
              <div className={styles.two}><label>Contract Start<input type="date" value={form.contract_start} onChange={e=>setForm({...form,contract_start:e.target.value})}/></label><label>Renewal / End Date<input type="date" value={form.renewal_end_date} onChange={e=>setForm({...form,renewal_end_date:e.target.value})}/></label></div>
            </article>

            <article className={styles.card}><div className={styles.cardHead}><div><span>PROJECT CAPACITY</span><h3>Active Project Allowance</h3></div></div>
              <label>Active Project Limit<input type="number" min="0" value={form.active_project_limit} onChange={e=>setForm({...form,active_project_limit:e.target.value})}/></label>
              <div className={styles.rule}><b>Commercial rule</b><p>The organization may operate up to this number of concurrent active projects. Closing a project releases one capacity slot while preserving the project as read-only history.</p></div>
              <div className={styles.license}><span>License Basis</span><b>Active Projects</b></div>
            </article>
          </div>

          <article className={styles.card}><div className={styles.cardHead}><div><span>PRODUCT ENTITLEMENTS</span><h3>Workspace Entitlements</h3><p>Define the maximum RitsuFlow products this organization has commercially purchased or been granted.</p></div></div>
            <div className={styles.workspaces}>{WORKSPACES.map(([key,name,text])=><label key={key} className={form[key]?styles.on:''}><div><input type="checkbox" checked={Boolean(form[key])} disabled={key==='projects'} onChange={e=>setForm({...form,[key]:e.target.checked})}/><span><b>{name}</b><small>{text}</small></span></div><strong>{form[key]?'Entitled':'Not Entitled'}</strong></label>)}</div>
          </article>

          <article className={styles.card}><div className={styles.cardHead}><div><span>INTERNAL</span><h3>Commercial Notes</h3></div></div><textarea rows="4" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Internal commercial notes..."/></article>

          <div className={styles.footer}><div><b>Platform Owner authority</b><span>Changes made here define the commercial ceiling for the organization. Customer administrators cannot increase these values.</span></div><button disabled={saving} onClick={save}>{saving?'Saving...':'Save Commercial Entitlements'}</button></div>
        </>}
      </section>
    </section>
  </main>
}
