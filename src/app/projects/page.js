'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import styles from './projects.module.css'
import { AppShell } from '../fieldop/ui'

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

 return <AppShell module="projects" active="all">
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
         <td>{updated}</td><td><div className={styles.rowActions}><Link className={styles.openProject} href={`/projects/${p.id}`}>◉ Open Project</Link><Link className={styles.scopeProject} href={`/projects/${p.id}/scope`}>▤ Scope Management</Link></div></td>
        </tr>
       })}
      </tbody>
     </table>
    </div>
    <footer className={styles.tableFooter}><span>Showing {projects.length} of {projects.length} {projects.length===1?'project':'projects'}</span><span>‹　<b>1</b>　›</span></footer>
   </section>
  </div>
 </AppShell>
}
