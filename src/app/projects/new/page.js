'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import styles from './new-project.module.css'

const initial={name:'',code:'',client_name:'',contract_number:'',status:'planning',postal_code:'',address_line:'',address_number:'',neighborhood:'',city:'',state_region:'',country_code:'BR',contract_value:'',currency_code:'BRL',has_retainage:false,retainage_percent:'',retainage_payment_days:'',material_included:false,material_value:'',planned_start_date:'',contractual_term_days:'',success_criteria:''}
const money=(value,currency='BRL')=>value?new Intl.NumberFormat('en-US',{style:'currency',currency}).format(Number(value)||0):'—'
const addDays=(date,days)=>{if(!date||!days)return'';const d=new Date(`${date}T12:00:00`);d.setDate(d.getDate()+Number(days));return d.toISOString().slice(0,10)}

export default function NewProjectPage(){
 const router=useRouter()
 const [step,setStep]=useState(1)
 const [form,setForm]=useState(initial)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState('')
 const [cepStatus,setCepStatus]=useState('')
 const set=(key,value)=>setForm(v=>({...v,[key]:value}))
 const plannedEnd=useMemo(()=>addDays(form.planned_start_date,form.contractual_term_days),[form.planned_start_date,form.contractual_term_days])
 const retainageValue=useMemo(()=>form.has_retainage&&form.contract_value&&form.retainage_percent?(Number(form.contract_value)*Number(form.retainage_percent)/100):0,[form.has_retainage,form.contract_value,form.retainage_percent])
 const probableRetainageDate=useMemo(()=>form.has_retainage?addDays(plannedEnd,form.retainage_payment_days):'',[form.has_retainage,plannedEnd,form.retainage_payment_days])

 async function lookupCep(raw){
  const cep=String(raw||'').replace(/\D/g,'')
  if((form.country_code||'BR').toUpperCase()!=='BR'){setCepStatus('Automatic CEP lookup is currently available for Brazil.');return}
  if(!cep){setCepStatus('');return}
  if(cep.length!==8){setCepStatus('Enter a valid 8-digit Brazilian CEP.');return}
  setCepStatus('Looking up CEP...')
  try{
   const response=await fetch(`https://viacep.com.br/ws/${cep}/json/`)
   if(!response.ok)throw new Error('CEP lookup failed.')
   const data=await response.json()
   if(data.erro)throw new Error('CEP not found.')
   setForm(v=>({...v,postal_code:data.cep||raw,address_line:data.logradouro||v.address_line,neighborhood:data.bairro||v.neighborhood,city:data.localidade||v.city,state_region:data.uf||v.state_region,country_code:'BR'}))
   setCepStatus('Address found. Review the information and enter the building/street number.')
  }catch(e){setCepStatus(e.message||'Unable to look up this CEP. You can enter the address manually.')}
 }

 async function createProject(){
  setError('');setSaving(true)
  try{
   const {data:{user},error:userError}=await supabase.auth.getUser()
   if(userError||!user)throw new Error('You must be signed in to create a project.')
   const {data:membership,error:membershipError}=await supabase.from('organization_members').select('organization_id').eq('user_id',user.id).eq('status','active').limit(1).maybeSingle()
   if(membershipError)throw membershipError
   if(!membership?.organization_id)throw new Error('No active organization membership was found for your account.')
   const payload={organization_id:membership.organization_id,created_by:user.id,name:form.name.trim(),code:form.code.trim()||null,client_name:form.client_name.trim()||null,contract_number:form.contract_number.trim()||null,status:form.status,planned_start_date:form.planned_start_date||null,planned_finish_date:plannedEnd||null,address_line:[form.address_line.trim(),form.address_number.trim()].filter(Boolean).join(', ')||null,neighborhood:form.neighborhood.trim()||null,city:form.city.trim()||null,state_region:form.state_region.trim()||null,postal_code:form.postal_code.trim()||null,country_code:form.country_code.trim().toUpperCase()||null,contract_value:form.contract_value?Number(form.contract_value):null,currency_code:form.currency_code.trim().toUpperCase()||'BRL'}
   const {data,error}=await supabase.from('projects').insert(payload).select('id').single()
   if(error)throw error
   router.push(`/projects/${data.id}`)
  }catch(e){setError(e.message||'Unable to create project.');setSaving(false)}
 }
 function next(){if(step===1&&!form.name.trim()){setError('Project Name is required.');return}setError('');setStep(s=>Math.min(5,s+1))}
 const steps=[['1','Project Information','Identity and client'],['2','Project Address','ZIP and location'],['3','Contract & Retainage','Commercial terms'],['4','Schedule & Success','Dates and client success'],['5','Review & Create','Confirm shared project']]
 const descriptions=['Create the single project record shared by the RitsuFlow modules.','Enter the Brazilian CEP and RitsuFlow will automatically fill the available address information.','Define contract value, material composition and retainage conditions.','Define the contractual timeline and what successful delivery means to the client.','Review the project before creating the shared record.']
 return <main className={styles.shell}>
  <header className={styles.topbar}><Link href="/projects" className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/></Link><div><b>New Project</b><span>Shared project registration</span></div><Link href="/projects" className={styles.cancel}>Cancel</Link></header>
  <section className={styles.workspace}>
   <aside className={styles.steps}>{steps.map(([n,label,small])=><button key={n} className={step===Number(n)?styles.active:step>Number(n)?styles.done:''} onClick={()=>Number(n)<step&&setStep(Number(n))}><i>{step>Number(n)?'✓':n}</i><span>{label}<small>{small}</small></span></button>)}</aside>
   <div className={styles.formArea}>
    <div className={styles.heading}><span>STEP {step} OF 5</span><h1>{steps[step-1][1]}</h1><p>{descriptions[step-1]}</p></div>
    <div className={styles.card}>
     {step===1&&<div className={styles.grid}><label className={styles.wide}>Project Name *<input value={form.name} onChange={e=>set('name',e.target.value)} placeholder="e.g. Central Medical Pavilion"/></label><label>Client<input value={form.client_name} onChange={e=>set('client_name',e.target.value)} placeholder="Client / Owner"/></label><label>Project Code / Contract Number<input value={form.contract_number} onChange={e=>set('contract_number',e.target.value)} placeholder="e.g. CTR-2026-001"/></label><label>Status<select value={form.status} onChange={e=>set('status',e.target.value)}><option value="planning">Planning</option><option value="preconstruction">Preconstruction</option><option value="ongoing">Ongoing</option><option value="completed">Completed</option><option value="archived">Archived</option></select></label><div className={styles.note}><b>One project. One source of truth.</b><span>This project record will be shared by Projects, PreCon, FieldOp and other licensed RitsuFlow modules.</span></div></div>}
     {step===2&&<div className={styles.grid}><label>ZIP Code<input value={form.postal_code} maxLength={9} onChange={e=>{const value=e.target.value;set('postal_code',value);if(value.replace(/\D/g,'').length===8)lookupCep(value)}} onBlur={e=>lookupCep(e.target.value)} placeholder="e.g. 84010-380"/></label><label>Country<input value={form.country_code} onChange={e=>set('country_code',e.target.value.toUpperCase())} placeholder="BR"/></label><label className={styles.wide}>Address<input value={form.address_line} onChange={e=>set('address_line',e.target.value)} placeholder="Automatically filled through ZIP code"/></label><label>Number<input value={form.address_number} onChange={e=>set('address_number',e.target.value)} placeholder="Building / street number"/></label><label>Neighborhood<input value={form.neighborhood} onChange={e=>set('neighborhood',e.target.value)} placeholder="Automatically filled when available"/></label><label>City<input value={form.city} onChange={e=>set('city',e.target.value)} placeholder="Automatically filled"/></label><label>State<input value={form.state_region} onChange={e=>set('state_region',e.target.value)} placeholder="Automatically filled"/></label><div className={styles.note}><b>ZIP-code lookup</b><span>{cepStatus||'Enter an 8-digit Brazilian CEP. Address, neighborhood, city and state will be filled automatically when available. All fields remain editable.'}</span></div></div>}
     {step===3&&<div className={styles.grid}><label>Contract Value<input type="number" min="0" step="0.01" value={form.contract_value} onChange={e=>set('contract_value',e.target.value)}/></label><label>Currency<select value={form.currency_code} onChange={e=>set('currency_code',e.target.value)}><option value="BRL">BRL</option><option value="USD">USD</option><option value="CAD">CAD</option></select></label><label className={styles.switchRow}><span>Is there retainage?<small>Capture withheld contract value and release terms.</small></span><input type="checkbox" checked={form.has_retainage} onChange={e=>set('has_retainage',e.target.checked)}/></label>{form.has_retainage&&<><label>Retainage (%)<input type="number" min="0" max="100" step="0.01" value={form.retainage_percent} onChange={e=>set('retainage_percent',e.target.value)}/></label><label>Retainage Value<input value={money(retainageValue,form.currency_code)} readOnly/></label><label>Retainage Payment Criteria (days)<input type="number" min="0" value={form.retainage_payment_days} onChange={e=>set('retainage_payment_days',e.target.value)} placeholder="X days after completion and client acceptance"/></label><label>Probable Retainage Payment Date<input type="date" value={probableRetainageDate} readOnly/></label></>}<label className={styles.switchRow}><span>Is material included in this contract value?<small>Separate material value from the total contract when applicable.</small></span><input type="checkbox" checked={form.material_included} onChange={e=>set('material_included',e.target.checked)}/></label>{form.material_included&&<label>Material Value<input type="number" min="0" step="0.01" value={form.material_value} onChange={e=>set('material_value',e.target.value)}/></label>}</div>}
     {step===4&&<div className={styles.grid}><label>Planned Start Date<input type="date" value={form.planned_start_date} onChange={e=>set('planned_start_date',e.target.value)}/></label><label>Contractual Term (calendar days)<input type="number" min="0" value={form.contractual_term_days} onChange={e=>set('contractual_term_days',e.target.value)} placeholder="e.g. 180"/></label><label>Planned End Date<input type="date" value={plannedEnd} readOnly/></label><label>Probable Retainage Payment Date<input type="date" value={probableRetainageDate} readOnly/></label><label className={styles.wide}>Client Success Criteria<textarea value={form.success_criteria} onChange={e=>set('success_criteria',e.target.value)} placeholder="What does successful project delivery mean to the client?" rows={6}/></label></div>}
     {step===5&&<div className={styles.review}><div><span>Project</span><b>{form.name||'—'}</b><small>{form.contract_number||'No contract number'}</small></div><div><span>Client</span><b>{form.client_name||'—'}</b></div><div><span>Location</span><b>{[form.city,form.state_region,form.country_code].filter(Boolean).join(', ')||'—'}</b><small>{[form.address_line,form.address_number].filter(Boolean).join(', ')}</small></div><div><span>Contract Value</span><b>{money(form.contract_value,form.currency_code)}</b><small>{form.material_included?`Material: ${money(form.material_value,form.currency_code)}`:'Material not identified as included'}</small></div><div><span>Retainage</span><b>{form.has_retainage?`${form.retainage_percent||0}% · ${money(retainageValue,form.currency_code)}`:'No retainage'}</b><small>{probableRetainageDate?`Probable payment: ${probableRetainageDate}`:''}</small></div><div><span>Planned Schedule</span><b>{form.planned_start_date||'—'} → {plannedEnd||'—'}</b><small>{form.contractual_term_days?`${form.contractual_term_days} calendar days`:''}</small></div><div className={styles.reviewWide}><span>Client Success Criteria</span><b>{form.success_criteria||'Not defined'}</b></div><p>This creates one shared Project ID. PreCon and FieldOp will reference this same project instead of creating separate project records.</p></div>}
     {error&&<div className={styles.error}>{error}</div>}
    </div>
    <footer className={styles.actions}><button disabled={step===1||saving} onClick={()=>setStep(s=>s-1)}>← Back</button><span>Project data can be completed or updated after creation.</span>{step<5?<button className={styles.primary} onClick={next}>Continue →</button>:<button className={styles.primary} disabled={saving} onClick={createProject}>{saving?'Creating...':'Create Project'}</button>}</footer>
   </div>
  </section>
 </main>
}
