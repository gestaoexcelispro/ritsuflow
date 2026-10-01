'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import styles from './workforce.module.css'

const nav=[['⌂','Portfolio Overview','/fieldop'],['□','Projects','/fieldop/projects'],['♙','Workforce','/fieldop/workforce'],['⌖','Operations','#'],['△','Occurrences','#'],['▥','Reports','/fieldop/reports/daily'],['⚙','Settings','#']]
const tabs=['Live Attendance','Worker Registry']
const initialForm={companyEmployeeNumber:'',firstName:'',middleName:'',lastName:'',companyId:'',tradeId:'',roleId:'',status:'active'}

export default function FieldOpWorkforcePage(){
  const [activeTab,setActiveTab]=useState('Live Attendance')
  const [sessions,setSessions]=useState([])
  const [workers,setWorkers]=useState([])
  const [companies,setCompanies]=useState([])
  const [trades,setTrades]=useState([])
  const [roles,setRoles]=useState([])
  const [organizationId,setOrganizationId]=useState(null)
  const [loading,setLoading]=useState(true)
  const [registryLoading,setRegistryLoading]=useState(true)
  const [saving,setSaving]=useState(false)
  const [error,setError]=useState('')
  const [registryError,setRegistryError]=useState('')
  const [formError,setFormError]=useState('')
  const [query,setQuery]=useState('')
  const [showAddWorker,setShowAddWorker]=useState(false)
  const [form,setForm]=useState(initialForm)

  useEffect(()=>{
    let alive=true
    async function load(){
      setLoading(true);setError('')
      try{
        const {data,error}=await supabase.from('field_attendance_sessions').select('*').is('check_out_at',null).order('check_in_at',{ascending:false})
        if(error)throw error
        if(alive)setSessions(data||[])
      }catch(e){console.error('FieldOp live attendance:',e);if(alive){setSessions([]);setError('Live attendance could not be loaded.')}}
      finally{if(alive)setLoading(false)}
    }
    load();return()=>{alive=false}
  },[])

  const loadRegistry=useCallback(async()=>{
    setRegistryLoading(true);setRegistryError('')
    try{
      const [workersResult,companiesResult,tradesResult,rolesResult]=await Promise.all([
        supabase.from('field_workers').select('id,organization_id,field_id,company_employee_number,first_name,middle_name,last_name,status,field_companies:default_company_id(id,name),field_trades:default_trade_id(id,name),field_roles:default_role_id(id,name)').order('field_id',{ascending:true}),
        supabase.from('field_companies').select('id,organization_id,name,status').eq('status','active').order('name',{ascending:true}),
        supabase.from('field_trades').select('id,organization_id,name,status').eq('status','active').order('name',{ascending:true}),
        supabase.from('field_roles').select('id,organization_id,name,status').eq('status','active').order('name',{ascending:true}),
      ])
      const firstError=workersResult.error||companiesResult.error||tradesResult.error||rolesResult.error
      if(firstError)throw firstError
      const loadedWorkers=workersResult.data||[],loadedCompanies=companiesResult.data||[],loadedTrades=tradesResult.data||[],loadedRoles=rolesResult.data||[]
      setWorkers(loadedWorkers);setCompanies(loadedCompanies);setTrades(loadedTrades);setRoles(loadedRoles)
      const org=loadedWorkers[0]?.organization_id||loadedCompanies[0]?.organization_id||loadedTrades[0]?.organization_id||loadedRoles[0]?.organization_id||null
      setOrganizationId(org)
      if(!org)setRegistryError('Unable to determine the active organization for FieldOp Workforce.')
    }catch(e){console.error('FieldOp workforce registry:',e);setWorkers([]);setCompanies([]);setTrades([]);setRoles([]);setRegistryError(e?.message||'Unable to load the workforce registry.')}
    finally{setRegistryLoading(false)}
  },[])

  useEffect(()=>{loadRegistry()},[loadRegistry])

  const rows=useMemo(()=>sessions.map(session=>({...session,worker:session.worker_name||session.worker_display_name||session.field_worker_name||session.worker_id||'Worker',project:session.project_name||session.project_id||'—',location:session.location_name||session.location||session.field_location_name||'—',workPackage:session.work_package_code||session.work_package||session.activity_name||'—'})),[sessions])
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return rows;return rows.filter(row=>[row.worker,row.project,row.location,row.workPackage].some(value=>String(value||'').toLowerCase().includes(q)))},[rows,query])
  const filteredWorkers=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return workers;return workers.filter(worker=>[worker.field_id,worker.company_employee_number,worker.first_name,worker.middle_name,worker.last_name,worker.field_companies?.name,worker.field_trades?.name,worker.field_roles?.name].some(value=>String(value||'').toLowerCase().includes(q)))},[workers,query])
  const longSessions=rows.filter(row=>row.check_in_at&&Date.now()-new Date(row.check_in_at).getTime()>10*60*60*1000).length
  const projectsOnSite=new Set(rows.map(row=>row.project_id).filter(Boolean)).size
  const locationsActive=new Set(rows.map(row=>row.location_id||row.location).filter(Boolean)).size
  const activeWorkers=workers.filter(worker=>worker.status==='active').length

  function workerName(worker){return [worker.first_name,worker.middle_name,worker.last_name].filter(Boolean).join(' ')}
  function hoursOnSite(value){if(!value)return '—';return `${Math.max(0,(Date.now()-new Date(value).getTime())/3600000).toFixed(1)} h`}
  function checkInTime(value){if(!value)return '—';return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date(value))}
  function openAddWorker(){setForm(initialForm);setFormError('');setShowAddWorker(true)}
  function closeAddWorker(){if(saving)return;setShowAddWorker(false);setFormError('');setForm(initialForm)}
  function changeForm(e){const {name,value}=e.target;setForm(current=>({...current,[name]:value}))}

  async function addWorker(e){
    e.preventDefault();setFormError('')
    if(!organizationId)return setFormError('The active organization could not be determined.')
    if(!form.firstName.trim())return setFormError('First Name is required.')
    if(!form.lastName.trim())return setFormError('Last Name is required.')
    if(!form.companyId)return setFormError('Company is required.')
    if(!form.tradeId)return setFormError('Trade is required.')
    if(!form.roleId)return setFormError('Role is required.')
    setSaving(true)
    try{
      const {error}=await supabase.from('field_workers').insert({organization_id:organizationId,company_employee_number:form.companyEmployeeNumber.trim()||null,first_name:form.firstName.trim(),middle_name:form.middleName.trim()||null,last_name:form.lastName.trim(),default_company_id:form.companyId,default_trade_id:form.tradeId,default_role_id:form.roleId,status:form.status})
      if(error)throw error
      closeAddWorker();await loadRegistry()
    }catch(err){setFormError(err?.message||'Unable to register the worker.')}
    finally{setSaving(false)}
  }

  return <main className={styles.shell}>
    <aside className={styles.sidebar}><div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/></div><div className={styles.navTitle}>FIELD OPERATIONS</div><nav>{nav.map(([icon,label,href])=><Link key={label} className={label==='Workforce'?styles.active:''} href={href}><i>{icon}</i>{label}</Link>)}</nav><Link href="/workspaces" className={styles.workspaceReturn}>← <span>Workspaces</span></Link></aside>
    <section className={styles.main}>
      <header className={styles.topbar}><div className={styles.search}>⌕ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search workers, projects, locations..."/></div><div className={styles.user}><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div></div></header>
      <div className={styles.content}>
        <section className={styles.heading}><div><span>FIELDOP / WORKFORCE</span><h1>Workforce</h1><p>People, assignments and live field presence in one operational workspace.</p></div>{activeTab==='Worker Registry'&&<button className={styles.primaryAction} onClick={openAddWorker}>+ Add Worker</button>}</section>
        <div className={styles.tabs}>{tabs.map(tab=><button key={tab} className={activeTab===tab?styles.tabActive:''} onClick={()=>setActiveTab(tab)}>{tab}</button>)}</div>

        {activeTab==='Live Attendance'&&<>
          <section className={styles.kpis}><article><span>♙</span><div><small>Workers On Site</small><strong>{rows.length}</strong><em>live attendance</em></div></article><article><span>▣</span><div><small>Projects With Presence</small><strong>{projectsOnSite}</strong><em>active now</em></div></article><article><span>⌖</span><div><small>Active Locations</small><strong>{locationsActive}</strong><em>field locations</em></div></article><article><span>!</span><div><small>Long Open Sessions</small><strong>{longSessions}</strong><em>over 10 hours</em></div></article></section>
          <section className={styles.panel}><div className={styles.panelHead}><div><h2>Live Attendance</h2><p>Who is currently checked in across FieldOp projects.</p></div><span>{filtered.length} on site</span></div>{error&&<div className={styles.error}>{error}</div>}{loading?<div className={styles.empty}><b>Loading live attendance...</b></div>:filtered.length===0?<div className={styles.empty}><b>No workers are currently checked in.</b><span>Live attendance will appear here when field check-ins begin.</span></div>:<div className={styles.tableWrap}><table><thead><tr><th>Worker</th><th>Project</th><th>Location</th><th>Work Package</th><th>Check-In</th><th>Hours On Site</th><th>Status</th></tr></thead><tbody>{filtered.map((row,index)=><tr key={row.id||index}><td><strong>{row.worker}</strong><small>{row.field_id||row.employee_number||''}</small></td><td>{row.project}</td><td>{row.location}</td><td>{row.workPackage}</td><td>{checkInTime(row.check_in_at)}</td><td>{hoursOnSite(row.check_in_at)}</td><td><span className={styles.live}>● On Site</span></td></tr>)}</tbody></table></div>}</section>
        </>}

        {activeTab==='Worker Registry'&&<>
          <section className={styles.kpis}><article><span>♙</span><div><small>Total Workers</small><strong>{workers.length}</strong><em>organization registry</em></div></article><article><span>✓</span><div><small>Active</small><strong>{activeWorkers}</strong><em>available workforce</em></div></article><article><span>○</span><div><small>Inactive</small><strong>{workers.length-activeWorkers}</strong><em>inactive records</em></div></article><article><span>▣</span><div><small>Companies</small><strong>{companies.length}</strong><em>active companies</em></div></article></section>
          <section className={styles.panel}><div className={styles.panelHead}><div><h2>Worker Registry</h2><p>Canonical organization workforce used by FieldOp projects and attendance.</p></div><span>{filteredWorkers.length} workers</span></div>{registryError&&<div className={styles.error}>{registryError}</div>}{registryLoading?<div className={styles.empty}><b>Loading workforce...</b></div>:filteredWorkers.length===0?<div className={styles.empty}><b>No workers registered.</b><span>Add the first worker to start the FieldOp workforce registry.</span></div>:<div className={styles.tableWrap}><table><thead><tr><th>Field ID</th><th>Employee No.</th><th>Worker</th><th>Company</th><th>Trade</th><th>Role</th><th>Status</th></tr></thead><tbody>{filteredWorkers.map(worker=><tr key={worker.id}><td><strong>{worker.field_id||'—'}</strong></td><td>{worker.company_employee_number||'—'}</td><td><strong>{workerName(worker)||'—'}</strong></td><td>{worker.field_companies?.name||'—'}</td><td>{worker.field_trades?.name||'—'}</td><td>{worker.field_roles?.name||'—'}</td><td><span className={worker.status==='active'?styles.live:styles.inactive}>{worker.status==='active'?'Active':'Inactive'}</span></td></tr>)}</tbody></table></div>}</section>
        </>}
        <section className={styles.flow}><b>FIELD EXECUTION FLOW</b><div><span>LOCATION</span><i>→</i><span>PEOPLE</span><i>→</i><span>WORK PACKAGE</span><i>→</i><span>EXECUTION</span><i>→</i><span>DAILY REPORT</span></div></section>
      </div>
    </section>

    {showAddWorker&&<div className={styles.modalBackdrop}><section className={styles.modal}><header><div><h2>Add Worker</h2><p>Create a worker directly in the canonical FieldOp registry.</p></div><button onClick={closeAddWorker} aria-label="Close">×</button></header><form onSubmit={addWorker}><div className={styles.formGrid}><label><span>Company Employee Number</span><input name="companyEmployeeNumber" value={form.companyEmployeeNumber} onChange={changeForm}/></label><label><span>First Name *</span><input name="firstName" value={form.firstName} onChange={changeForm}/></label><label><span>Middle Name</span><input name="middleName" value={form.middleName} onChange={changeForm}/></label><label><span>Last Name *</span><input name="lastName" value={form.lastName} onChange={changeForm}/></label><label><span>Company *</span><select name="companyId" value={form.companyId} onChange={changeForm}><option value="">Select company</option>{companies.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Trade *</span><select name="tradeId" value={form.tradeId} onChange={changeForm}><option value="">Select trade</option>{trades.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Role *</span><select name="roleId" value={form.roleId} onChange={changeForm}><option value="">Select role</option>{roles.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label><span>Status</span><select name="status" value={form.status} onChange={changeForm}><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div>{formError&&<div className={styles.error}>{formError}</div>}<footer><button type="button" onClick={closeAddWorker} disabled={saving}>Cancel</button><button className={styles.primaryAction} type="submit" disabled={saving}>{saving?'Saving...':'Register Worker'}</button></footer></form></section></div>}
  </main>
}
