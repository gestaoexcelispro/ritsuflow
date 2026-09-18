'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import styles from './new-project.module.css'

const initial={name:'',code:'',client_name:'',proposal_number:'',contract_number:'',status:'planning',planned_start_date:'',planned_finish_date:'',address_line:'',neighborhood:'',city:'',state_region:'',postal_code:'',country_code:'US',contract_value:'',currency_code:'USD',latitude:'',longitude:'',geofence_radius_m:'100',geofence_enabled:false,max_gps_accuracy_m:'50'}

export default function NewProjectPage(){
 const router=useRouter()
 const [step,setStep]=useState(1)
 const [form,setForm]=useState(initial)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const set=(key,value)=>setForm(v=>({...v,[key]:value}))

 async function createProject(){
  setError('');setSaving(true)
  try{
   const {data:{user},error:userError}=await supabase.auth.getUser()
   if(userError||!user)throw new Error('You must be signed in to create a project.')
   const {data:membership,error:membershipError}=await supabase.from('organization_members').select('organization_id').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle()
   if(membershipError)throw membershipError
   if(!membership?.organization_id)throw new Error('No active organization membership was found for your account.')
   const payload={organization_id:membership.organization_id,created_by:user.id,name:form.name.trim(),code:form.code.trim()||null,client_name:form.client_name.trim()||null,proposal_number:form.proposal_number.trim()||null,contract_number:form.contract_number.trim()||null,status:form.status,planned_start_date:form.planned_start_date||null,planned_finish_date:form.planned_finish_date||null,address_line:form.address_line.trim()||null,neighborhood:form.neighborhood.trim()||null,city:form.city.trim()||null,state_region:form.state_region.trim()||null,postal_code:form.postal_code.trim()||null,country_code:form.country_code.trim().toUpperCase()||null,contract_value:form.contract_value?Number(form.contract_value):null,currency_code:form.currency_code.trim().toUpperCase()||'USD',latitude:form.latitude?Number(form.latitude):null,longitude:form.longitude?Number(form.longitude):null,geofence_radius_m:form.geofence_radius_m?Number(form.geofence_radius_m):null,geofence_enabled:form.geofence_enabled,max_gps_accuracy_m:form.max_gps_accuracy_m?Number(form.max_gps_accuracy_m):null}
   const {data,error}=await supabase.from('projects').insert(payload).select('id').single()
   if(error)throw error
   router.push(`/projects/${data.id}`)
  }catch(e){setError(e.message||'Unable to create project.');setSaving(false)}
 }

 function next(){if(step===1&&!form.name.trim()){setError('Project Name is required.');return}setError('');setStep(s=>Math.min(4,s+1))}

 return <main className={styles.shell}>
  <header className={styles.topbar}><Link href="/projects" className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/></Link><div><b>New Project</b><span>Shared project registration</span></div><Link href="/projects" className={styles.cancel}>Cancel</Link></header>
  <section className={styles.workspace}>
   <aside className={styles.steps}>{[['1','Project Information'],['2','Location & Site'],['3','Commercial & Dates'],['4','Review & Create']].map(([n,label])=><button key={n} className={step===Number(n)?styles.active:step>Number(n)?styles.done:''} onClick={()=>Number(n)<step&&setStep(Number(n))}><i>{step>Number(n)?'✓':n}</i><span>{label}<small>{n==='1'?'Identity and lifecycle':n==='2'?'Address and field setup':n==='3'?'Contract and schedule':'Confirm shared project'}</small></span></button>)}</aside>
   <div className={styles.formArea}>
    <div className={styles.heading}><span>STEP {step} OF 4</span><h1>{step===1?'Project Information':step===2?'Location & Site':step===3?'Commercial & Dates':'Review & Create'}</h1><p>{step===1?'Create the shared project record used by PreCon, FieldOp and RitsuCAD.':step===2?'Define where the project is located and prepare the site for field validation.':step===3?'Capture the key commercial references and planned project dates.':'Review the information before creating the project.'}</p></div>
    <div className={styles.card}>
     {step===1&&<div className={styles.grid}><label className={styles.wide}>Project Name *<input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Central Medical Pavilion"/></label><label>Project Code<input value={form.code} onChange={e=>set('code',e.target.value)} placeholder="e.g. PRJ-001"/></label><label>Client<input value={form.client_name} onChange={e=>set('client_name',e.target.value)} placeholder="Client / Owner"/></label><label>Status<select value={form.status} onChange={e=>set('status',e.target.value)}><option value="planning">Planning</option><option value="preconstruction">Preconstruction</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label><div className={styles.note}><b>Project lifecycle</b><span>Only projects marked <strong>Ongoing</strong> will appear in the FieldOp Portfolio Overview.</span></div></div>}
     {step===2&&<div className={styles.grid}><label className={styles.wide}>Address<input value={form.address_line} onChange={e=>set('address_line',e.target.value)} placeholder="Street address"/></label><label>Neighborhood<input value={form.neighborhood} onChange={e=>set('neighborhood',e.target.value)}/></label><label>City<input value={form.city} onChange={e=>set('city',e.target.value)}/></label><label>State / Region<input value={form.state_region} onChange={e=>set('state_region',e.target.value)}/></label><label>Postal Code<input value={form.postal_code} onChange={e=>set('postal_code',e.target.value)}/></label><label>Country Code<input value={form.country_code} onChange={e=>set('country_code',e.target.value)} maxLength={2}/></label><label>Latitude<input type="number" step="any" value={form.latitude} onChange={e=>set('latitude',e.target.value)}/></label><label>Longitude<input type="number" step="any" value={form.longitude} onChange={e=>set('longitude',e.target.value)}/></label><label>Geofence Radius (m)<input type="number" value={form.geofence_radius_m} onChange={e=>set('geofence_radius_m',e.target.value)}/></label><label>Max GPS Accuracy (m)<input type="number" value={form.max_gps_accuracy_m} onChange={e=>set('max_gps_accuracy_m',e.target.value)}/></label><label className={styles.check}><input type="checkbox" checked={form.geofence_enabled} onChange={e=>set('geofence_enabled',e.target.checked)}/> Enable project geofence</label></div>}
     {step===3&&<div className={styles.grid}><label>Proposal Number<input value={form.proposal_number} onChange={e=>set('proposal_number',e.target.value)}/></label><label>Contract Number<input value={form.contract_number} onChange={e=>set('contract_number',e.target.value)}/></label><label>Contract Value<input type="number" min="0" step="0.01" value={form.contract_value} onChange={e=>set('contract_value',e.target.value)}/></label><label>Currency<input value={form.currency_code} onChange={e=>set('currency_code',e.target.value)} maxLength={3}/></label><label>Planned Start<input type="date" value={form.planned_start_date} onChange={e=>set('planned_start_date',e.target.value)}/></label><label>Planned Finish<input type="date" value={form.planned_finish_date} onChange={e=>set('planned_finish_date',e.target.value)}/></label></div>}
     {step===4&&<div className={styles.review}><div><span>Project</span><b>{form.name||'—'}</b><small>{form.code||'No code'}</small></div><div><span>Client</span><b>{form.client_name||'—'}</b></div><div><span>Lifecycle</span><b>{form.status}</b></div><div><span>Location</span><b>{[form.city,form.state_region,form.country_code].filter(Boolean).join(', ')||'—'}</b></div><div><span>Planned Dates</span><b>{form.planned_start_date||'—'} → {form.planned_finish_date||'—'}</b></div><div><span>Field Geofence</span><b>{form.geofence_enabled?'Enabled':'Disabled'}</b></div><p>This creates one shared project record. PreCon and FieldOp will reference this same project ID.</p></div>}
     {error&&<div className={styles.error}>{error}</div>}
    </div>
    <footer className={styles.actions}><button disabled={step===1||saving} onClick={()=>setStep(s=>s-1)}>← Back</button><span>Project data can be completed or updated after creation.</span>{step<4?<button className={styles.primary} onClick={next}>Continue →</button>:<button className={styles.primary} disabled={saving} onClick={createProject}>{saving?'Creating...':'Create Project'}</button>}</footer>
   </div>
  </section>
 </main>
}
