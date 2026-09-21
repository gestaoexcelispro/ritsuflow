'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/client'
import styles from '../daily-reports.module.css'

const tabs=['Overview','General','Weather','Workforce','Production','Materials','Equipment','Safety','Issues','Notes','Attachments','Approval']

function GeneralSection({report,supabase,onSaved}){
 const [start,setStart]=useState(report.work_start_time||'')
 const [end,setEnd]=useState(report.work_end_time||'')
 const [notes,setNotes]=useState(report.general_notes||'')
 const [saving,setSaving]=useState(false)
 const [message,setMessage]=useState('')

 async function save(event){
  event.preventDefault();setSaving(true);setMessage('')
  const {data,error}=await supabase.from('daily_reports').update({work_start_time:start||null,work_end_time:end||null,general_notes:notes.trim()||null}).eq('id',report.id).select('id,work_start_time,work_end_time,general_notes').single()
  if(error)setMessage(error.message)
  else {setMessage('General information saved.');onSaved(data)}
  setSaving(false)
 }

 return <section className={styles.panel}>
  <div className={styles.panelHead}><div><h3>General</h3><p>Core information for this field day. Project and report identity are inherited automatically.</p></div><span>{report.status}</span></div>
  <form onSubmit={save} style={{display:'grid',gap:18}}>
   <div style={{display:'grid',gridTemplateColumns:'repeat(4,minmax(0,1fr))',gap:14}}>
    <label style={{display:'grid',gap:7}}><b>Project</b><input value={report.projects?.name||''} disabled /></label>
    <label style={{display:'grid',gap:7}}><b>Project code</b><input value={report.projects?.code||'—'} disabled /></label>
    <label style={{display:'grid',gap:7}}><b>Report date</b><input value={report.report_date||''} disabled /></label>
    <label style={{display:'grid',gap:7}}><b>Report number</b><input value={`DR-${String(report.report_number||0).padStart(4,'0')}`} disabled /></label>
    <label style={{display:'grid',gap:7}}><b>Work start</b><input type="time" value={start} onChange={e=>setStart(e.target.value)} /></label>
    <label style={{display:'grid',gap:7}}><b>Work end</b><input type="time" value={end} onChange={e=>setEnd(e.target.value)} /></label>
    <label style={{display:'grid',gap:7}}><b>Client</b><input value={report.projects?.client_name||'—'} disabled /></label>
    <label style={{display:'grid',gap:7}}><b>Status</b><input value={report.status||'draft'} disabled /></label>
   </div>
   <label style={{display:'grid',gap:7}}><b>General notes</b><textarea rows={7} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Record relevant field context that does not belong to a more specific Daily Report section." /></label>
   <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:12}}>{message&&<span>{message}</span>}<button className={styles.primaryButton} type="submit" disabled={saving}>{saving?'Saving...':'Save General'}</button></div>
  </form>
 </section>
}

export default function FieldOpDailyReportWorkspace(){
 const {reportId}=useParams();const supabase=useMemo(()=>createClient(),[]);const [report,setReport]=useState(null);const [loading,setLoading]=useState(true);const [active,setActive]=useState('Overview');const [error,setError]=useState('')
 useEffect(()=>{async function load(){setLoading(true);const {data,error}=await supabase.from('daily_reports').select('id,report_number,report_date,status,work_start_time,work_end_time,general_notes,projects(id,code,name,client_name)').eq('id',reportId).single();if(error)setError(error.message);else setReport(data);setLoading(false)}if(reportId)load()},[reportId,supabase])
 if(loading)return <main className={styles.page}><div className={styles.empty}>Loading Daily Report...</div></main>
 if(error||!report)return <main className={styles.page}><div className={styles.empty}><strong>Daily Report unavailable.</strong><p>{error}</p><Link href="/fieldop/reports/daily">Return to Daily Reports</Link></div></main>
 return <main className={styles.page}>
  <header className={styles.header}><Image className={styles.logo} src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/><div className={styles.headerTitle}><span className={styles.eyebrow}>FIELDOP · DAILY REPORT</span><h1>DR-{String(report.report_number||0).padStart(4,'0')}</h1></div><div className={styles.headerActions}><button className={styles.headerButton} type="button" aria-label="Notifications">♧</button><Link className={styles.headerButton} href="/fieldop">← Return to Workspace</Link><Link className={styles.secondaryButton} href="/fieldop/reports/daily">Reports</Link></div></header>
  <section className={styles.reportMeta}><strong>{report.projects?.code?`${report.projects.code} · `:''}{report.projects?.name||'Project'}</strong><span>{report.report_date}</span><span>{report.projects?.client_name||''}</span><span className={styles.badge}>{report.status}</span></section>
  <nav className={styles.tabs}>{tabs.map(tab=><button key={tab} type="button" onClick={()=>setActive(tab)} className={`${styles.tab} ${active===tab?styles.tabActive:''}`}>{tab}</button>)}</nav>
  <section className={styles.workspace}>
   {active==='Overview'&&<><div className={styles.hero}><div><h2>Daily Report Overview</h2><p>Field execution for {report.report_date}. This workspace is native to FieldOp.</p></div></div><div className={styles.sectionGrid}><article className={styles.sectionCard}><h3>Workforce</h3><p>Crews, workers and labor hours will be connected here without duplicate field entry.</p></article><article className={styles.sectionCard}><h3>Production</h3><p>Installed quantities will connect project, location, work package and labor effort.</p></article><article className={styles.sectionCard}><h3>Field Evidence</h3><p>Photos, notes, safety observations and issues will support traceability.</p></article></div></>}
   {active==='General'&&<GeneralSection report={report} supabase={supabase} onSaved={data=>setReport(current=>({...current,...data}))}/>} 
   {!['Overview','General'].includes(active)&&<section className={styles.panel}><div className={styles.panelHead}><h3>{active}</h3><span>FieldOp Daily Report</span></div><div className={styles.empty}>The new {active} workflow will be developed here from current field-use requirements. No legacy Daily Report UI is being reused.</div></section>}
  </section>
 </main>
}