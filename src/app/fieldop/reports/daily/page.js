'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase/client'
import styles from './daily-reports.module.css'

export default function FieldOpDailyReportsPage(){
 const supabase=useMemo(()=>createClient(),[])
 const [reports,setReports]=useState([])
 const [loading,setLoading]=useState(true)

 useEffect(()=>{let alive=true;async function load(){setLoading(true);const {data,error}=await supabase.from('daily_reports').select('id,report_number,report_date,status,created_at,projects(id,code,name)').order('report_date',{ascending:false}).limit(100);if(!alive)return;if(error){console.error('FieldOp Daily Reports:',error);setReports([])}else setReports(data||[]);setLoading(false)}load();return()=>{alive=false}},[supabase])

 const today=new Date().toISOString().slice(0,10)
 const todayCount=reports.filter(r=>r.report_date===today).length
 const drafts=reports.filter(r=>r.status==='draft').length
 const submitted=reports.filter(r=>['submitted','reviewed'].includes(r.status)).length
 const approved=reports.filter(r=>r.status==='approved').length

 return <main className={styles.page}>
  <header className={styles.header}>
   <Image className={styles.logo} src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/>
   <div className={styles.headerTitle}><span className={styles.eyebrow}>FIELDOP · REPORTS</span><h1>Daily Reports</h1></div>
   <div className={styles.headerActions}><Link className={styles.headerButton} href="/fieldop">← FieldOp</Link><Link className={styles.primaryButton} href="/fieldop/reports/daily/new">+ New Daily Report</Link></div>
  </header>
  <div className={styles.content}>
   <section className={styles.hero}><div><h2>Daily Reports</h2><p>Capture field reality and connect execution to production control.</p></div><Link className={styles.primaryButton} href="/fieldop/reports/daily/new">+ Create Daily Report</Link></section>
   <section className={styles.cards}><div className={styles.card}><span>Today</span><strong>{todayCount}</strong></div><div className={styles.card}><span>Draft</span><strong>{drafts}</strong></div><div className={styles.card}><span>In Review</span><strong>{submitted}</strong></div><div className={styles.card}><span>Approved</span><strong>{approved}</strong></div></section>
   <section className={styles.panel}><div className={styles.panelHead}><h3>Report History</h3><span>{reports.length} reports</span></div>
    {loading?<div className={styles.empty}>Loading Daily Reports...</div>:reports.length===0?<div className={styles.empty}><strong>No Daily Reports yet.</strong><p>Create the first field record from FieldOp.</p></div>:<table className={styles.table}><thead><tr><th>Report</th><th>Project</th><th>Date</th><th>Status</th><th>Created</th></tr></thead><tbody>{reports.map(r=><tr key={r.id}><td><Link className={styles.reportLink} href={`/fieldop/reports/daily/${r.id}`}>DR-{String(r.report_number||0).padStart(4,'0')}</Link></td><td>{r.projects?.code?`${r.projects.code} · `:''}{r.projects?.name||'Project'}</td><td>{r.report_date}</td><td><span className={styles.badge}>{r.status||'draft'}</span></td><td>{r.created_at?new Date(r.created_at).toLocaleString():'—'}</td></tr>)}</tbody></table>}
   </section>
  </div>
 </main>
}