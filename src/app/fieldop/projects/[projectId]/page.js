'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import styles from './setup.module.css'

const tabs = ['Overview', 'Activities', 'Locations', 'Workforce', 'Daily Report Settings']

export default function FieldOpProjectSetupPage() {
  const { projectId } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('Overview')

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const { data } = await supabase.from('projects').select('*').eq('id', projectId).maybeSingle()
      if (alive) { setProject(data || null); setLoading(false) }
    }
    if (projectId) load()
    return () => { alive = false }
  }, [projectId])

  const location = project ? [project.city, project.state_region].filter(Boolean).join(', ') || project.location || '—' : '—'
  const projectName = project?.name || project?.project_name || 'Project'

  return <main className={styles.shell}>
    <aside className={styles.sidebar}>
      <Link href="/fieldop" className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={150} height={55} priority /></Link>
      <div className={styles.navTitle}>FIELD OPERATIONS</div>
      <nav>
        <Link href="/fieldop"><i>⌂</i>Portfolio Overview</Link>
        <Link href="/fieldop/projects" className={styles.active}><i>▣</i>Projects</Link>
        <Link href="/dashboard/field-management/workforce"><i>♙</i>Workforce</Link>
        <Link href="/dashboard/projects/operations"><i>⌖</i>Operations</Link>
        <Link href="/dashboard/projects/constraints"><i>△</i>Occurrences</Link>
        <Link href="/fieldop/reports/daily"><i>▤</i>Reports</Link>
        <Link href="/settings"><i>⚙</i>Settings</Link>
      </nav>
      <Link href="/workspaces" className={styles.workspaceReturn}>← <span>Workspaces</span></Link>
    </aside>

    <section className={styles.main}>
      <header className={styles.topbar}>
        <div><div className={styles.crumb}><Link href="/fieldop/projects">Projects</Link><span>/</span>{loading ? 'Loading...' : projectName}</div><strong>Daily Report Setup</strong></div>
        <div className={styles.search}>⌕ <span>Search project setup...</span><kbd>Ctrl K</kbd></div>
        <div className={styles.user}><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div></div>
      </header>

      <div className={styles.content}>
        <section className={styles.projectHeader}>
          <div className={styles.projectIcon}>{projectName.charAt(0).toUpperCase()}</div>
          <div><h1>{projectName}</h1><p>{project?.project_id || '—'} · {project?.client || project?.client_name || '—'} · {location}</p></div>
          <span className={styles.status}>○ FieldOp setup in progress</span>
        </section>

        <div className={styles.tabs}>{tabs.map(tab => <button key={tab} className={activeTab === tab ? styles.tabActive : ''} onClick={() => setActiveTab(tab)}>{tab}</button>)}</div>

        {activeTab === 'Overview' && <section className={styles.grid}>
          <article className={styles.card}><div className={styles.cardHead}><div><h2>Project Information</h2><p>Read-only information from the canonical RitsuFlow project.</p></div><span>RITSUFLOW</span></div><dl><div><dt>Project ID</dt><dd>{project?.project_id || '—'}</dd></div><div><dt>Client</dt><dd>{project?.client || project?.client_name || '—'}</dd></div><div><dt>Location</dt><dd>{location}</dd></div><div><dt>Phase</dt><dd>{project?.phase || project?.status || '—'}</dd></div></dl></article>
          <article className={styles.card}><div className={styles.cardHead}><div><h2>Daily Report Readiness</h2><p>Configure the information FieldOp will use to structure daily reporting.</p></div></div><div className={styles.steps}><button onClick={() => setActiveTab('Activities')}><b>1</b><span><strong>Activities</strong><small>Bring activities from Project Scope or add field-specific activities manually.</small></span><em>Configure →</em></button><button onClick={() => setActiveTab('Locations')}><b>2</b><span><strong>Locations</strong><small>Use the project Location Structure for field reporting.</small></span><em>Configure →</em></button><button onClick={() => setActiveTab('Workforce')}><b>3</b><span><strong>Workforce</strong><small>Define the people and crews available to the project.</small></span><em>Configure →</em></button><button onClick={() => setActiveTab('Daily Report Settings')}><b>4</b><span><strong>Daily Report Settings</strong><small>Define report behavior and project-specific requirements.</small></span><em>Configure →</em></button></div></article>
        </section>}

        {activeTab === 'Activities' && <section className={styles.workspace}><div><h2>Activities</h2><p>Choose which activities are available for field execution and Daily Reports.</p></div><div className={styles.actions}><Link href={`/projects/${projectId}/scope`}>View Project Scope</Link><button>+ Add Manual Activity</button><button className={styles.primary}>Import from Project Scope</button></div><div className={styles.empty}><b>No FieldOp activities configured yet.</b><span>Import existing activities from RitsuFlow Scope Management or add a field-specific activity manually.</span></div></section>}
        {activeTab === 'Locations' && <section className={styles.workspace}><div><h2>Locations</h2><p>FieldOp will use the canonical project Location Structure. Location selection will be configured here.</p></div><div className={styles.empty}><b>Location setup is next.</b><span>No duplicate location hierarchy will be created in FieldOp.</span></div></section>}
        {activeTab === 'Workforce' && <section className={styles.workspace}><div><h2>Workforce</h2><p>Configure project crews and workers available for Daily Reports and Operations.</p></div><div className={styles.empty}><b>Workforce setup is not configured yet.</b></div></section>}
        {activeTab === 'Daily Report Settings' && <section className={styles.workspace}><div><h2>Daily Report Settings</h2><p>Configure project-specific Daily Report behavior without changing the canonical project record.</p></div><div className={styles.empty}><b>Daily Report settings are not configured yet.</b></div></section>}
      </div>
    </section>
  </main>
}
