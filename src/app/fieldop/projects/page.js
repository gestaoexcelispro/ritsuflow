'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { useT } from '../../../lib/i18n/useT'
import { useLanguage } from '../../../lib/i18n/LanguageProvider'
import { FieldOpSidebar, FieldOpUser } from '../FieldOpChrome'
import styles from './projects.module.css'

const STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived']
const STATUS_STYLE = {
  active: { background: '#e2f7ed', color: '#11864c' },
  planning: { background: '#e6f0ff', color: '#1d5fb8' },
  on_hold: { background: '#fff4dc', color: '#946200' },
  completed: { background: '#eef2f4', color: '#4b6170' },
  archived: { background: '#eef2f4', color: '#7a8b95' },
}

/** Which of the four FieldOp setup parts each project has: activities, locations, workforce, report settings. */
async function loadSetupProgress(projectIds) {
  const progress = new Map(projectIds.map((id) => [id, new Set()]))
  if (!projectIds.length) return progress
  const [activities, locations, assignments, manualWorkers, settings] = await Promise.all([
    supabase.from('fieldop_project_activities').select('project_id').in('project_id', projectIds).eq('is_active', true),
    supabase.from('fieldop_project_locations').select('project_id').in('project_id', projectIds).eq('is_active', true),
    supabase.from('field_project_assignments').select('project_id').in('project_id', projectIds).eq('status', 'active'),
    supabase.from('fieldop_manual_workers').select('project_id').in('project_id', projectIds).eq('status', 'active'),
    supabase.from('fieldop_daily_report_settings').select('project_id').in('project_id', projectIds),
  ])
  const mark = (result, part) => (result.data || []).forEach((row) => progress.get(row.project_id)?.add(part))
  mark(activities, 'activities')
  mark(locations, 'locations')
  mark(assignments, 'workforce')
  mark(manualWorkers, 'workforce')
  mark(settings, 'settings')
  return progress
}

export default function FieldOpProjectsPage() {
  const t = useT('fieldopSetup')
  const tf = useT('fieldop')
  const { language } = useLanguage()
  const [projects, setProjects] = useState([])
  const [setup, setSetup] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data, error: loadError } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
      if (!active) return
      if (loadError) { setError(loadError.message); setProjects([]); setLoading(false); return }
      setError('')
      setProjects(data || [])
      const progress = await loadSetupProgress((data || []).map((project) => project.id))
      if (!active) return
      setSetup(progress)
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    return projects.filter((project) => {
      if (statusFilter && project.status !== statusFilter) return false
      if (!query) return true
      return [project.project_id, project.name, project.code, project.client_name, project.city, project.state_region, project.status ? tf(`status.${project.status}`) : '']
        .filter(Boolean).join(' ').toLowerCase().includes(query)
    })
  }, [projects, search, statusFilter, tf])

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'short' }), [language])
  const date = (value) => {
    if (!value) return '—'
    const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? '—' : dateFormat.format(parsed)
  }
  const money = (value, currency) => {
    try {
      return new Intl.NumberFormat(language, { style: 'currency', currency: currency || 'BRL' }).format(Number(value || 0))
    } catch {
      return `${currency || ''} ${Number(value || 0).toFixed(2)}`
    }
  }

  function setupCell(projectId) {
    const done = setup.get(projectId)?.size || 0
    if (done === 4) return <span className={styles.setupPending} style={{ color: '#11864c', background: '#e2f7ed' }}>{t('list.setupReady')}</span>
    if (done > 0) return <span className={styles.setupPending}>{t('list.setupPartial', { done })}</span>
    return <span className={styles.setupPending}>{t('list.setupNone')}</span>
  }

  return <main className={styles.shell}>
    <FieldOpSidebar styles={styles} active="projects" />

    <section className={styles.main}>
      <header className={styles.topbar}>
        <div className={styles.pageTitle}>{t('list.title')}</div>
        <label className={styles.search}>⌕ <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('list.search')} /></label>
        <FieldOpUser styles={styles} />
      </header>

      <div className={styles.content}>
        <section className={styles.projectsPanel}>
          <div className={styles.panelHead}>
            <div><h1>{t('list.title')}</h1><p>{t('list.text')}</p></div>
            <div className={styles.filters}>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t('list.colStatus')} style={{ border: '1px solid #d5e0e6', borderRadius: 6, padding: '6px 9px', background: '#fff', color: '#425d6d', font: 'inherit' }}>
                <option value="">{t('list.allStatuses')}</option>
                {STATUSES.map((status) => <option key={status} value={status}>{tf(`status.${status}`)}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr>
                <th>{t('list.colProjectId')}</th><th>{t('list.colProject')}</th><th>{t('list.colClient')}</th><th>{t('list.colLocation')}</th>
                <th>{t('list.colStart')}</th><th>{t('list.colEnd')}</th><th>{t('list.colValue')}</th><th>{t('list.colStatus')}</th><th>{t('list.colSetup')}</th><th>{t('list.colActions')}</th>
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan="10" className={styles.message}>{t('list.loading')}</td></tr>}
                {!loading && error && <tr><td colSpan="10" className={styles.message}>{t('list.error', { error })}</td></tr>}
                {!loading && !error && visibleProjects.length === 0 && <tr><td colSpan="10" className={styles.message}>{t('list.empty')}</td></tr>}
                {!loading && !error && visibleProjects.map((project) => {
                  const location = [project.city, project.state_region].filter(Boolean).join(', ') || '—'
                  const status = project.status || 'planning'
                  const configured = (setup.get(project.id)?.size || 0) > 0
                  return <tr key={project.id}>
                    <td><b>{project.project_id || '—'}</b></td>
                    <td><div className={styles.projectName}><i>{(project.name || 'P').charAt(0).toUpperCase()}</i><span><b>{project.name || tf('projects.untitled')}</b><small>{project.code || '—'}</small></span></div></td>
                    <td>{project.client_name || '—'}</td>
                    <td>{location}</td>
                    <td>{date(project.planned_start_date)}</td>
                    <td>{date(project.planned_finish_date)}</td>
                    <td>{money(project.contract_value, project.currency_code)}</td>
                    <td><span className={styles.ok} style={STATUS_STYLE[status]}>{tf(`status.${status}`)}</span></td>
                    <td>{setupCell(project.id)}</td>
                    <td><Link className={styles.configureProject} href={`/fieldop/projects/${project.id}`}>{configured ? t('list.open') : t('list.configure')}</Link></td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
          <footer className={styles.tableFooter}><span>{t('list.showing', { shown: visibleProjects.length, total: projects.length })}</span></footer>
        </section>
      </div>
    </section>
  </main>
}
