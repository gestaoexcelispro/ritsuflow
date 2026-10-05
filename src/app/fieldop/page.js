'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import styles from './fieldop.module.css'
import { FieldOpSidebar, FieldOpUser } from './FieldOpChrome'
import { useT } from '../../lib/i18n/useT'
import { useLanguage } from '../../lib/i18n/LanguageProvider'

// Project statuses that count as ongoing, in chart order, with their colors.
const ONGOING = [
  { status: 'active', color: '#1eae61', pill: { background: '#e2f7ed', color: '#11864c' } },
  { status: 'planning', color: '#3b82f6', pill: { background: '#e6f0ff', color: '#1d5fb8' } },
  { status: 'on_hold', color: '#ffb31a', pill: { background: '#fff4dc', color: '#946200' } },
]
const ONGOING_STATUSES = ONGOING.map((item) => item.status)
const SUBMITTED_STATUSES = ['submitted', 'reviewed', 'approved']
const OPEN_ISSUE_STATUSES = ['open', 'in_progress']

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function workerName(worker) {
  return [worker?.first_name, worker?.last_name].filter(Boolean).join(' ').trim()
}

/** Runs a query and returns its data, or a fallback when it fails (missing permission, etc.). */
async function safe(query, fallback) {
  try {
    const result = await query
    if (result.error) {
      console.warn('FieldOp portfolio:', result.error.message)
      return fallback
    }
    return result
  } catch (error) {
    console.warn('FieldOp portfolio:', error)
    return fallback
  }
}

export default function FieldOpPage() {
  const router = useRouter()
  const t = useT('fieldop')
  const { language } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState([])
  const [kpis, setKpis] = useState({ workers: 0, operations: 0, occurrences: 0, reportsSubmitted: 0, reportsDraft: 0 })
  const [activity, setActivity] = useState([])
  const [search, setSearch] = useState('')

  useEffect(() => {
    let alive = true

    async function load() {
      setLoading(true)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        router.replace('/login?next=/fieldop')
        return
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const empty = { data: [], count: 0 }

      const [projectsResult, sessionsResult, operationsResult, issuesResult, todayReportsResult, eventsResult, newReportsResult] = await Promise.all([
        safe(supabase.from('projects').select('id,name,code,project_id,city,state_region,status,updated_at').in('status', ONGOING_STATUSES).order('updated_at', { ascending: false }), empty),
        safe(supabase.from('field_attendance_sessions').select('worker_id').eq('status', 'open'), empty),
        safe(supabase.from('field_execution_events').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'), empty),
        safe(supabase.from('daily_report_issues').select('id', { count: 'exact', head: true }).in('status', OPEN_ISSUE_STATUSES), empty),
        safe(supabase.from('daily_reports').select('id,status').eq('report_date', localDateKey()), empty),
        safe(supabase.from('field_attendance_events').select('id,event_type,event_at,worker_id,project_id').gte('event_at', since).order('event_at', { ascending: false }).limit(15), empty),
        safe(supabase.from('daily_reports').select('id,report_number,created_at,project_id').gte('created_at', since).order('created_at', { ascending: false }).limit(10), empty),
      ])
      if (!alive) return

      const projectRows = projectsResult.data || []
      const projectNames = new Map(projectRows.map((project) => [project.id, project.name || project.code || '']))

      // Worker names for the activity feed.
      const events = eventsResult.data || []
      const workerIds = [...new Set(events.map((event) => event.worker_id).filter(Boolean))]
      const workersResult = workerIds.length
        ? await safe(supabase.from('field_workers').select('id,first_name,last_name').in('id', workerIds), empty)
        : empty
      if (!alive) return
      const workerNames = new Map((workersResult.data || []).map((worker) => [worker.id, workerName(worker)]))

      const feed = [
        ...events.map((event) => ({ id: `e-${event.id}`, kind: event.event_type, at: event.event_at, name: workerNames.get(event.worker_id) || '', project: projectNames.get(event.project_id) || '' })),
        ...(newReportsResult.data || []).map((report) => ({ id: `r-${report.id}`, kind: 'report', at: report.created_at, number: report.report_number, href: `/fieldop/reports/daily/${report.id}`, project: projectNames.get(report.project_id) || '' })),
      ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8)

      const todayReports = todayReportsResult.data || []
      setProjects(projectRows)
      setKpis({
        workers: new Set((sessionsResult.data || []).map((session) => session.worker_id)).size,
        operations: operationsResult.count || 0,
        occurrences: issuesResult.count || 0,
        reportsSubmitted: todayReports.filter((report) => SUBMITTED_STATUSES.includes(report.status)).length,
        reportsDraft: todayReports.filter((report) => report.status === 'draft').length,
      })
      setActivity(feed)
      setLoading(false)
    }

    load()
    return () => { alive = false }
  }, [router])

  const counts = useMemo(() => Object.fromEntries(ONGOING.map(({ status }) => [status, projects.filter((project) => project.status === status).length])), [projects])

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return projects
    return projects.filter((project) => [project.name, project.code, project.project_id, project.city, project.state_region, t(`status.${project.status}`)]
      .filter(Boolean).join(' ').toLowerCase().includes(query))
  }, [projects, search, t])

  // Donut slices from the real status counts.
  const donut = useMemo(() => {
    const total = projects.length
    if (!total) return '#e3e9ed'
    let start = 0
    const slices = ONGOING.map(({ status, color }) => {
      const end = start + (counts[status] / total) * 100
      const slice = `${color} ${start}% ${end}%`
      start = end
      return slice
    })
    return `conic-gradient(${slices.join(',')})`
  }, [projects.length, counts])

  const dateTime = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }), [language])
  const timeOnly = useMemo(() => new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }), [language])

  function activityText(item) {
    const name = item.name || t('activity.unknownWorker')
    if (item.kind === 'check_in') return t('activity.checkIn', { name })
    if (item.kind === 'check_out') return t('activity.checkOut', { name })
    if (item.kind === 'manual_adjustment') return t('activity.adjustment', { name })
    if (item.kind === 'session_cancelled') return t('activity.cancelled', { name })
    return t('activity.report', { number: String(item.number || 0).padStart(4, '0') })
  }

  function createDailyReport() {
    if (projects.length === 1) {
      router.push(`/fieldop/reports/daily/new?projectId=${projects[0].id}`)
      return
    }
    router.push('/fieldop/reports/daily/new')
  }

  const pill = (status) => ONGOING.find((item) => item.status === status)?.pill || {}
  const location = (project) => [project.city, project.state_region].filter(Boolean).join(', ') || '—'

  return <main className={styles.shell}>
    <FieldOpSidebar styles={styles} active="portfolio" showTagline />
    <section className={styles.main}>
      <header className={styles.topbar}>
        <div className={styles.search}>⌕ <span>{t('topbar.search')}</span><kbd>Ctrl K</kbd></div>
        <FieldOpUser styles={styles} />
      </header>
      <div className={styles.content}>
        <section className={styles.kpis}>
          <div><i>▥</i><span>{t('kpi.ongoing')}<strong>{projects.length}</strong><small>{t('kpi.ongoingDetail', { active: counts.active, planning: counts.planning, onHold: counts.on_hold })}</small></span></div>
          <div><i>♙</i><span>{t('kpi.workers')}<strong>{kpis.workers}</strong><small>{t('kpi.workersDetail')}</small></span></div>
          <div><i>♟</i><span>{t('kpi.operations')}<strong>{kpis.operations}</strong><small>{t('kpi.operationsDetail')}</small></span></div>
          <div><i className={styles.red}>!</i><span>{t('kpi.occurrences')}<strong>{kpis.occurrences}</strong><small>{kpis.occurrences ? t('kpi.occurrencesDetail') : t('kpi.occurrencesNone')}</small></span></div>
          <div><i>▤</i><span>{t('kpi.reports')}<strong>{kpis.reportsSubmitted + kpis.reportsDraft}</strong><small>{t('kpi.reportsDetail', { submitted: kpis.reportsSubmitted, drafts: kpis.reportsDraft })}</small></span></div>
        </section>
        <section className={styles.dashboard}>
          <div className={styles.projectsPanel}>
            <div className={styles.panelHead}>
              <div><h2>{t('projects.title')}</h2><p>{t('projects.subtitle')}</p></div>
              <label className={styles.filters}>⌕ <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('projects.search')} aria-label={t('projects.search')} style={{ border: 0, outline: 'none', background: 'transparent', font: 'inherit', color: '#203945', width: 150 }} /></label>
            </div>
            <div className={styles.tableWrap}><table>
              <thead><tr><th>{t('projects.colProject')}</th><th>{t('projects.colLocation')}</th><th>{t('projects.colStatus')}</th><th>{t('projects.colUpdated')}</th></tr></thead>
              <tbody>{visibleProjects.map((project) => <tr key={project.id} onClick={() => router.push(`/fieldop/projects/${project.id}`)} style={{ cursor: 'pointer' }}>
                <td><Link href={`/fieldop/projects/${project.id}`} style={{ color: 'inherit', textDecoration: 'none' }}><b>{project.name || t('projects.untitled')}</b></Link><small>{project.project_id || project.code || ''}</small></td>
                <td>{location(project)}</td>
                <td><span className={styles.ok} style={pill(project.status)}>{t(`status.${project.status}`)}</span></td>
                <td>{project.updated_at ? dateTime.format(new Date(project.updated_at)) : '—'}</td>
              </tr>)}</tbody>
            </table></div>
            {loading && <div style={{ padding: 24, textAlign: 'center', color: '#6b7e89' }}>{t('common.loading')}</div>}
            {!loading && projects.length === 0 && <div style={{ display: 'grid', placeItems: 'center', minHeight: 220, textAlign: 'center' }}><div><h2>{t('projects.emptyTitle')}</h2><p>{t('projects.emptyText')}</p></div></div>}
            {!loading && projects.length > 0 && visibleProjects.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#6b7e89' }}>{t('projects.noMatch')}</div>}
            <Link href="/fieldop/projects" className={styles.viewAll}>{t('projects.viewAll')}</Link>
          </div>
          <aside className={styles.rightCol}>
            <div className={styles.statusCard}>
              <h2>{t('chart.title')}</h2>
              <div className={styles.statusBody}>
                <div className={styles.donut} style={{ background: donut }}><strong>{projects.length}</strong><span>{t('chart.projects')}</span></div>
                <ul>{ONGOING.map(({ status, color }) => <li key={status}><i style={{ background: color }} />{t(`status.${status}`)} <b>{counts[status]}</b></li>)}</ul>
              </div>
            </div>
            <div className={styles.activity}>
              <div className={styles.activityHead}><h2>{t('activity.title')} <small>{t('activity.period')}</small></h2></div>
              {activity.length === 0
                ? <div style={{ padding: '24px', textAlign: 'center' }}>{loading ? t('common.loading') : t('activity.empty')}</div>
                : activity.map((item) => {
                  const row = <><time>{timeOnly.format(new Date(item.at))}</time><i>{item.kind === 'report' ? '▤' : item.kind === 'check_out' ? '↤' : '↦'}</i><span>{activityText(item)}{item.project && <small>{item.project}</small>}</span></>
                  return item.href
                    ? <Link key={item.id} href={item.href} className={styles.activityRow} style={{ color: 'inherit', textDecoration: 'none' }}>{row}</Link>
                    : <div key={item.id} className={styles.activityRow}>{row}</div>
                })}
            </div>
          </aside>
        </section>
        <section className={styles.callout}><i>◯</i><div><b>{t('callout.title')}</b><span>{t('callout.text')}</span></div><button type="button" onClick={createDailyReport}>▤ &nbsp; {t('callout.button')}</button></section>
      </div>
    </section>
  </main>
}
