'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/client'
import styles from '../daily-reports.module.css'

const tabs=['Overview','General','Weather','Workforce','Production','Materials','Equipment','Safety','Issues','Notes','Attachments','Approval']

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
   {active==='Overview'?<><div className={styles.hero}><div><h2>Daily Report Overview</h2><p>Field execution for {report.report_date}. This workspace is native to FieldOp.</p></div></div><div className={styles.sectionGrid}><article className={styles.sectionCard}><h3>Workforce</h3><p>Crews, workers and labor hours will be connected here without duplicate field entry.</p></article><article className={styles.sectionCard}><h3>Production</h3><p>Installed quantities will connect project, location, work package and labor effort.</p></article><article className={styles.sectionCard}><h3>Field Evidence</h3><p>Photos, notes, safety observations and issues will support traceability.</p></article></div></>:<section className={styles.panel}><div className={styles.panelHead}><h3>{active}</h3><span>FieldOp Daily Report</span></div><div className={styles.empty}>The new {active} workflow will be developed here from current field-use requirements. No legacy Daily Report UI is being reused.</div></section>}
  </section>
 </main>
}