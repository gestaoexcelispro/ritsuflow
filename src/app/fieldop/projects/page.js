'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import styles from './projects.module.css'

export default function FieldOpProjectsPage() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data, error: loadError } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
      if (!active) return
      if (loadError) { setError(loadError.message); setProjects([]) }
      else { setError(''); setProjects(data || []) }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const visibleProjects = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return projects
    return projects.filter((p) => [p.project_id, p.name, p.client, p.client_name, p.city, p.state_region, p.status].filter(Boolean).join(' ').toLowerCase().includes(q))
  }, [projects, search])

  const date = (value) => {
    if (!value) return '—'
    const d = new Date(`${String(value).slice(0, 10)}T12:00:00`)
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
  }
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))

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
        <div className={styles.pageTitle}>Projects</div>
        <label className={styles.search}>⌕ <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects, clients, or locations..." /><kbd>Ctrl K</kbd></label>
        <div className={styles.user}><button>♧<em>3</em></button><b>EF</b><div><strong>Eduardo Freitas</strong><span>Operations Manager</span></div><span>⌄</span></div>
      </header>

      <div className={styles.content}>
        <section className={styles.projectsPanel}>
          <div className={styles.panelHead}>
            <div><h1>Projects</h1><p>Projects from RitsuFlow. Configure field operations and daily reporting for each project.</p></div>
            <div className={styles.filters}><span>⌕ {search || 'Search projects...'}</span><button>All Statuses⌄</button><button>All Clients⌄</button></div>
          </div>
          <div className={styles.tableWrap}>
            <table><thead><tr><th>Project ID</th><th>Project</th><th>Client</th><th>Location</th><th>Phase</th><th>Start Date</th><th>End Date</th><th>Contract Value</th><th>Status</th><th>FieldOp Setup</th><th>Actions</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan="11" className={styles.message}>Loading projects...</td></tr>}
                {!loading && error && <tr><td colSpan="11" className={styles.message}>Unable to load projects: {error}</td></tr>}
                {!loading && !error && visibleProjects.length === 0 && <tr><td colSpan="11" className={styles.message}>No projects found.</td></tr>}
                {!loading && !error && visibleProjects.map((p) => {
                  const location = [p.city, p.state_region].filter(Boolean).join(', ') || '—'
                  const status = p.status || 'planning'
                  const phase = p.phase || status
                  return <tr key={p.id}>
                    <td><b>{p.project_id || '—'}</b></td>
                    <td><div className={styles.projectName}><i>{(p.name || 'P').charAt(0).toUpperCase()}</i><span><b>{p.name || 'Untitled Project'}</b><small>{p.code || '—'}</small></span></div></td>
                    <td>{p.client || p.client_name || '—'}</td><td>{location}</td><td><span className={styles.phase}>{phase}</span></td>
                    <td>{date(p.planned_start_date || p.start_date)}</td><td>{date(p.planned_end_date || p.end_date)}</td><td>{money(p.contract_value)}</td>
                    <td><span className={String(status).toLowerCase().includes('risk') || String(status).toLowerCase().includes('hold') ? styles.attention : styles.ok}>{status}</span></td>
                    <td><span className={styles.setupPending}>○ Not configured</span></td>
                    <td><Link className={styles.configureProject} href={`/fieldop/projects/${p.id}`}>Configure</Link></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
          <footer className={styles.tableFooter}><span>Showing {visibleProjects.length} of {projects.length} {projects.length === 1 ? 'project' : 'projects'}</span><span>‹　<b>1</b>　›</span></footer>
        </section>
      </div>
    </section>
  </main>
}
