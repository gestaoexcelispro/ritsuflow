'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import styles from './workforce.module.css'

const nav=[['⌂','Portfolio Overview','/fieldop'],['□','Projects','/fieldop/projects'],['♙','Workforce','/fieldop/workforce'],['⌖','Operations','#'],['△','Occurrences','#'],['▥','Reports','/fieldop/reports/daily'],['⚙','Settings','#']]

export default function FieldOpWorkforcePage(){
  const [sessions,setSessions]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [query,setQuery]=useState('')

  useEffect(()=>{
    let alive=true
    async function load(){
      setLoading(true);setError('')
      try{
        const {data,error}=await supabase
          .from('field_attendance_sessions')
          .select('*')
          .is('check_out_at',null)
          .order('check_in_at',{ascending:false})
        if(error)throw error
        if(alive)setSessions(data||[])
      }catch(e){
        console.error('FieldOp live attendance:',e)
        if(alive){setSessions([]);setError('Live attendance could not be loaded.')}
      }finally{if(alive)setLoading(false)}
    }
    load()
    return()=>{alive=false}
  },[])

  const rows=useMemo(()=>sessions.map(session=>({
    ...session,
    worker:session.worker_name||session.worker_display_name||session.field_worker_name||session.worker_id||'Worker',
    project:session.project_name||session.project_id||'—',
    location:session.location_name||session.location||session.field_location_name||'—',
    workPackage:session.work_package_code||session.work_package||session.activity_name||'—',
  })),[sessions])

  const filtered=useMemo(()=>{
    const q=query.trim().toLowerCase()
    if(!q)return rows
    return rows.filter(row=>[row.worker,row.project,row.location,row.workPackage].some(value=>String(value||'').toLowerCase().includes(q)))
  },[rows,query])

  const now=Date.now()
  const longSessions=rows.filter(row=>row.check_in_at&&now-new Date(row.check_in_at).getTime()>10*60*60*1000).length
  const projectsOnSite=new Set(rows.map(row=>row.project_id).filter(Boolean)).size
  const locationsActive=new Set(rows.map(row=>row.location_id||row.location).filter(Boolean)).size

  function hoursOnSite(value){
    if(!value)return '—'
    const hours=Math.max(0,(Date.now()-new Date(value).getTime())/3600000)
    return `${hours.toFixed(1)} h`
  }

  function checkInTime(value){
    if(!value)return '—'
    return new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(new Date(value))
  }

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/></div>
      <div className={styles.navTitle}>FIELD OPERATIONS</div>
      <nav>{nav.map(([icon,label,href])=><Link key={label} className={label==='Workforce'?styles.active:''} href={href}><i>{icon}</i>{label}</Link>)}</nav>
      <Link href="/workspaces" className={styles.workspaceReturn}>← <span>Workspaces</span></Link>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}>
        <div className={styles.search}>⌕ <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search workers, projects, locations..."/></div>
        <div className={styles.user}><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div></div>
      </header>

      <div className={styles.content}>
        <section className={styles.heading}>
          <div><span>FIELDOP / WORKFORCE</span><h1>Workforce Command Center</h1><p>Live field presence connected to projects, locations and execution.</p></div>
          <div className={styles.actions}><Link href="/dashboard/field-management/workforce">Worker Registry</Link><Link href="/dashboard/field-management/workforce/assignments">Project Assignments</Link></div>
        </section>

        <section className={styles.kpis}>
          <article><span>♙</span><div><small>Workers On Site</small><strong>{rows.length}</strong><em>live attendance</em></div></article>
          <article><span>▣</span><div><small>Projects With Presence</small><strong>{projectsOnSite}</strong><em>active now</em></div></article>
          <article><span>⌖</span><div><small>Active Locations</small><strong>{locationsActive}</strong><em>field locations</em></div></article>
          <article><span>!</span><div><small>Long Open Sessions</small><strong>{longSessions}</strong><em>over 10 hours</em></div></article>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHead}><div><h2>Live Attendance</h2><p>Who is currently checked in across FieldOp projects.</p></div><span>{filtered.length} on site</span></div>
          {error&&<div className={styles.error}>{error}</div>}
          {loading?<div className={styles.empty}><b>Loading live attendance...</b></div>:filtered.length===0?<div className={styles.empty}><b>No workers are currently checked in.</b><span>Live attendance will appear here when field check-ins begin.</span></div>:
          <div className={styles.tableWrap}><table><thead><tr><th>Worker</th><th>Project</th><th>Location</th><th>Work Package</th><th>Check-In</th><th>Hours On Site</th><th>Status</th></tr></thead><tbody>{filtered.map((row,index)=><tr key={row.id||index}><td><strong>{row.worker}</strong><small>{row.field_id||row.employee_number||''}</small></td><td>{row.project}</td><td>{row.location}</td><td>{row.workPackage}</td><td>{checkInTime(row.check_in_at)}</td><td>{hoursOnSite(row.check_in_at)}</td><td><span className={styles.live}>● On Site</span></td></tr>)}</tbody></table></div>}
        </section>

        <section className={styles.flow}><b>FIELD EXECUTION FLOW</b><div><span>LOCATION</span><i>→</i><span>PEOPLE</span><i>→</i><span>WORK PACKAGE</span><i>→</i><span>EXECUTION</span><i>→</i><span>DAILY REPORT</span></div></section>
      </div>
    </section>
  </main>
}
