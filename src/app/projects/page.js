'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import styles from './projects.module.css'

export default function ProjectsPage(){
 const [projects,setProjects]=useState([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')

 useEffect(()=>{
  let active=true
  async function loadProjects(){
   setLoading(true)
   const {data,error}=await supabase.from('projects').select('*').order('created_at',{ascending:false})
   if(!active)return
   if(error){setError(error.message);setProjects([])}else{setError('');setProjects(data||[])}
   setLoading(false)
  }
  loadProjects()
  return()=>{active=false}
 },[])

 const activeProjects=useMemo(()=>projects.filter(p=>!['completed','cancelled','archived'].includes(String(p.status||'').toLowerCase())),[projects])
 const onTrack=activeProjects.filter(p=>['on track','on_track','active'].includes(String(p.status||'').toLowerCase())).length
 const attention=activeProjects.filter(p=>['attention','at risk','at_risk','delayed'].includes(String(p.status||'').toLowerCase())).length
 const locations=new Set(activeProjects.map(p=>[p.city,p.state_region].filter(Boolean).join(', ')).filter(Boolean)).size

 return <main className={styles.shell}>
  <header className={styles.topbar}>
   <Link href="/workspaces" className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/></Link>
   <div className={styles.pageTitle}>Projects</div>
   <div className={styles.search}>⌕ <span>Search projects, locations, or people...</span><kbd>Ctrl K</kbd></div>
   <nav className={styles.moduleNav} aria-label="Workspace navigation">
    <Link href="/workspaces" className={styles.returnWorkspace}>← Return to Workspaces</Link>
    <Link href="/precon" className={`${styles.moduleButton} ${styles.preconButton}`}>▣ Go to PreCon</Link>
    <Link href="/fieldop" className={`${styles.moduleButton} ${styles.fieldopButton}`}>⌂ Go to FieldOp</Link>
   </nav>
   <div className={styles.user}><button className={styles.alert}>♧<em>3</em></button><button className={styles.newProject}>＋ New Project</button><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div><span>⌄</span></div>
  </header>

  <div className={styles.content}>
   <section className={styles.kpis}>
    <div><span>Active Projects</span><strong>{activeProjects.length}</strong><small>Across {locations} {locations===1?'location':'locations'}</small></div>
    <div><span>On Track</span><strong className={styles.green}>{onTrack}</strong><small>{activeProjects.length?Math.round(onTrack/activeProjects.length*100):0}% of active projects</small></div>
    <div><span>Need Attention</span><strong className={styles.amber}>{attention}</strong><small>Projects requiring action</small></div>
    <div><span>Workers On Site</span><strong>0</strong><small>Field data will populate here</small></div>
   </section>

   <section className={styles.projectsPanel}>
    <div className={styles.panelHead}>
     <div><h2>All Projects</h2><p>Shared project portfolio across the RitsuFlow production system.</p></div>
     <div className={styles.filters}><span>⌕ Search projects...</span><button>All Statuses⌄</button><button>All Phases⌄</button></div>
    </div>
    <div className={styles.tableWrap}>
     <table><thead><tr><th>Project</th><th>Location</th><th>Project Manager</th><th>Phase</th><th>Workers</th><th>Operations</th><th>Today’s Progress</th><th>Open Issues</th><th>Status</th><th>Last Update</th><th></th></tr></thead>
      <tbody>
       {loading&&<tr><td colSpan="11" style={{textAlign:'center',padding:'48px'}}>Loading projects...</td></tr>}
       {!loading&&error&&<tr><td colSpan="11" style={{textAlign:'center',padding:'48px'}}>Unable to load projects: {error}</td></tr>}
       {!loading&&!error&&projects.length===0&&<tr><td colSpan="11" style={{textAlign:'center',padding:'64px 24px'}}><b style={{display:'block',fontSize:'18px',marginBottom:'8px'}}>No projects registered yet.</b><span>Create your first shared RitsuFlow project using + New Project.</span></td></tr>}
       {!loading&&!error&&projects.map(p=>{
        const location=[p.city,p.state_region].filter(Boolean).join(', ')||'—'
        const status=p.status||'—'
        const updated=p.updated_at?new Date(p.updated_at).toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'}):'—'
        return <tr key={p.id}>
         <td><div className={styles.projectName}><i>{(p.name||'P').charAt(0).toUpperCase()}</i><span><b>{p.name||'Untitled Project'}</b><small>{p.code||'—'}</small></span></div></td>
         <td>⌖ {location}</td><td>—</td><td><span className={styles.phase}>—</span></td>
         <td><b>0</b><small> on site</small></td><td><b>0</b> underway</td>
         <td><b>0%</b><div className={styles.progress}><span style={{width:'0%'}}/></div></td>
         <td>0</td><td><span className={String(status).toLowerCase()==='attention'?styles.attention:styles.ok}>{status}</span></td>
         <td>{updated}</td><td><Link className={styles.openProject} href={`/projects/${p.id}`}>Open Project →</Link></td>
        </tr>
       })}
      </tbody>
     </table>
    </div>
    <footer className={styles.tableFooter}><span>Showing {projects.length} {projects.length===1?'project':'projects'}</span><span>One shared project source for PreCon and FieldOp</span></footer>
   </section>
  </div>
 </main>
}
