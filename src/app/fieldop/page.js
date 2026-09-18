'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import styles from './fieldop.module.css'

const nav=[['⌂','Portfolio Overview','/fieldop'],['□','Projects','/projects'],['♙','Workforce','#'],['⌖','Operations','#'],['△','Occurrences','#'],['▥','Reports','#'],['⚙','Settings','#']]

export default function FieldOpPage(){
 const [projects,setProjects]=useState([])
 const [loading,setLoading]=useState(true)

 useEffect(()=>{
  let alive=true
  async function load(){
   setLoading(true)
   const {data,error}=await supabase.from('projects').select('*').order('created_at',{ascending:false})
   if(!alive)return
   if(error){console.error('FieldOp portfolio projects:',error);setProjects([])}
   else setProjects(data||[])
   setLoading(false)
  }
  load()
  return()=>{alive=false}
 },[])

 const ongoing=useMemo(()=>projects.filter(p=>{
  const s=String(p.status||'').trim().toLowerCase()
  return !['completed','complete','closed','cancelled','canceled','archived'].includes(s)
 }),[projects])

 const onTrack=ongoing.filter(p=>String(p.status||'').toLowerCase().replaceAll('_',' ')==='on track').length
 const attention=ongoing.filter(p=>['attention','need attention','needs attention','at risk'].includes(String(p.status||'').toLowerCase().replaceAll('_',' '))).length

 return <main className={styles.shell}>
  <aside className={styles.sidebar}>
   <div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/><div><b>FieldOp</b><span>Execute. Capture. Measure.</span></div></div>
   <div className={styles.navTitle}>FIELD OPERATIONS</div>
   <nav>{nav.map(([icon,label,href],i)=><Link key={label} className={i===0?styles.active:''} href={href}><i>{icon}</i>{label}</Link>)}</nav>
   <Link href="/workspaces" className={styles.workspaceReturn}>← <span>Workspaces</span></Link>
  </aside>
  <section className={styles.main}>
   <header className={styles.topbar}><div className={styles.search}>⌕ <span>Search projects, locations, or people...</span><kbd>Ctrl K</kbd></div><div className={styles.user}><button>♧<em>3</em></button><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div><span>⌄</span></div></header>
   <div className={styles.content}>
    <section className={styles.kpis}>
     <div><i>▥</i><span>Ongoing Projects<strong>{ongoing.length}</strong><small>{onTrack} on track | {attention} attention</small></span></div>
     <div><i>♙</i><span>Workers On Site<strong>0</strong><small>Field data will populate here</small></span></div>
     <div><i>♟</i><span>Operations in Progress<strong>0</strong><small>work packages</small></span></div>
     <div><i className={styles.red}>!</i><span>Open Occurrences<strong>0</strong><small>No open occurrences</small></span></div>
     <div><i>▤</i><span>Today’s Daily Reports<strong>0</strong><small>submitted today</small></span></div>
    </section>
    <section className={styles.dashboard}>
     <div className={styles.projectsPanel}><div className={styles.panelHead}><div><h2>Ongoing Projects</h2><p>Live field operations for projects currently in progress.</p></div><div className={styles.filters}>⌕ Search projects...</div></div>
      <div className={styles.tableWrap}><table><thead><tr><th>Project</th><th>Location</th><th>Status</th><th>Last Update</th></tr></thead><tbody>{ongoing.map(p=><tr key={p.id}><td><b>{p.name||p.project_name||'Untitled Project'}</b><small>{p.code||p.project_code||''}</small></td><td>{p.location||p.city||'—'}</td><td><span className={styles.ok}>{p.status||'Ongoing'}</span></td><td>{p.updated_at?new Date(p.updated_at).toLocaleString():'—'}</td></tr>)}</tbody></table></div>
      {!loading&&ongoing.length===0&&<div style={{display:'grid',placeItems:'center',minHeight:220,textAlign:'center'}}><div><h2>No ongoing projects.</h2><p>Create a project in the shared Projects workspace. When it becomes active, it will appear here.</p></div></div>}
      <Link href="/projects" className={styles.viewAll}>View Projects →</Link>
     </div>
     <aside className={styles.rightCol}><div className={styles.statusCard}><h2>Ongoing Projects by Status</h2><div className={styles.statusBody}><div className={styles.donut}><strong>{ongoing.length}</strong><span>Projects</span></div><ul><li><i/>On Track <b>{onTrack}</b></li><li><i/>Attention <b>{attention}</b></li></ul></div></div>
      <div className={styles.activity}><div className={styles.activityHead}><h2>Field Activity <small>(Last 24 Hours)</small></h2></div><div style={{padding:'24px',textAlign:'center'}}>No field activity yet.</div></div>
     </aside>
    </section>
    <section className={styles.callout}><i>◯</i><div><b>Safer sites. Higher productivity. Stronger projects.</b><span>Field reality connected to planning. That’s RitsuFlow.</span></div><button>▤ &nbsp; Create Daily Report</button></section>
   </div>
  </section>
 </main>
}
