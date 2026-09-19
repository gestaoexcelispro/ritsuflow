'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import styles from './projects.module.css'

export default function ProjectsPage(){
 const [projects,setProjects]=useState([])
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')

 useEffect(()=>{
  let active=true
  async function loadProjects(){
   setLoading(true)
   const {data,error}=await supabase.from('projects').select('*').order('created_at',{ascending:true})
   if(!active)return
   if(error){setError(error.message);setProjects([])}else{setError('');setProjects(data||[])}
   setLoading(false)
  }
  loadProjects()
  return()=>{active=false}
 },[])

 function money(value){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(Number(value||0))}
 function date(value){if(!value)return'—';const d=new Date(`${String(value).slice(0,10)}T12:00:00`);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('pt-BR')}

 return <main className={styles.shell}>
  <header className={styles.topbar}>
   <Link href="/workspaces" className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority/></Link>
   <div className={styles.titleBlock}><div className={styles.pageTitle}>Projects</div><span>Manage your construction projects and central information.</span></div>
   <div className={styles.search}>⌕ <span>Search projects, clients, or locations...</span><kbd>Ctrl K</kbd></div>
   <div className={styles.headerActions}>
    <Link href="/workspaces" className={styles.returnButton}>← Return to Workspaces</Link>
    <Link href="/precon" className={styles.preconButton}>▣ Go to PreCon</Link>
    <Link href="/fieldop" className={styles.fieldopButton}>⌂ Go to FieldOp</Link>
   </div>
   <div className={styles.user}><button className={styles.alert}>♧<em>3</em></button><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div><span>⌄</span></div>
  </header>

  <nav className={styles.workspaceNav} aria-label="Project workspace navigation">
   <Link href="/workspaces">⌂ Overview</Link>
   <Link href="/projects" className={styles.navActive}>▣ Projects</Link>
   <Link href="/scope-management">⌘ Scope Management</Link>
   <Link href="/project-setup">⚙ Project Setup</Link>
   <Link href="/location-structure">⌖ Location Structure</Link>
   <span className={styles.navDivider}/>
   <Link href="/reports">▤ Reports</Link>
   <Link href="/projects/new" className={styles.newProject}>＋ New Project</Link>
  </nav>

  <div className={styles.content}>
   <section className={styles.projectsPanel}>
    <div className={styles.panelHead}>
     <div><h2>All Projects</h2><p>Centralize and manage your project information, access scope, documents, team and key details.</p></div>
     <div className={styles.filters}><span>⌕ Search projects...</span><button>All Statuses⌄</button><button>All Clients⌄</button></div>
    </div>
    <div className={styles.tableWrap}>
     <table><thead><tr><th>Project ID</th><th>Project</th><th>Client</th><th>Location</th><th>Phase</th><th>Start Date</th><th>End Date</th><th>Contract Value</th><th>Status</th><th>Last Update</th><th>Actions</th></tr></thead>
      <tbody>
       {loading&&<tr><td colSpan="11" className={styles.message}>Loading projects...</td></tr>}
       {!loading&&error&&<tr><td colSpan="11" className={styles.message}>Unable to load projects: {error}</td></tr>}
       {!loading&&!error&&projects.length===0&&<tr><td colSpan="11" className={styles.message}><b>No projects registered yet.</b><span>Create your first project using + New Project.</span></td></tr>}
       {!loading&&!error&&projects.map(p=>{
        const location=[p.city,p.state_region].filter(Boolean).join(', ')||'—'
        const status=p.status||'Planning'
        const updated=p.updated_at?new Date(p.updated_at).toLocaleDateString('pt-BR'):'—'
        const phase=p.phase||p.status||'Planning'
        return <tr key={p.id}>
         <td><b>{p.project_id||'—'}</b></td>
         <td><div className={styles.projectName}><i>{(p.name||'P').charAt(0).toUpperCase()}</i><span><b>{p.name||'Untitled Project'}</b><small>{p.code||'—'}</small></span></div></td>
         <td>{p.client||p.client_name||'—'}</td><td>⌖ {location}</td><td><span className={styles.phase}>{phase}</span></td>
         <td>{date(p.planned_start_date||p.start_date)}</td><td>{date(p.planned_end_date||p.end_date)}</td><td>{money(p.contract_value)}</td>
         <td><span className={String(status).toLowerCase().includes('hold')?styles.attention:styles.ok}>{status}</span></td>
         <td>{updated}</td><td><Link className={styles.openProject} href={`/projects/${p.id}`}>◉ Open Project</Link></td>
        </tr>
       })}
      </tbody>
     </table>
    </div>
    <footer className={styles.tableFooter}><span>Showing {projects.length} of {projects.length} {projects.length===1?'project':'projects'}</span><span>‹　<b>1</b>　›</span></footer>
   </section>
  </div>
 </main>
}
