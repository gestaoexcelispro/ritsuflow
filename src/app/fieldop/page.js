'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { FieldOpShell, Panel, Stats, Stat, Badge, Empty, Icon, ui, reportTone } from './ui'
import { useT } from '../../lib/i18n/useT'
import { useLanguage } from '../../lib/i18n/LanguageProvider'

// Project statuses that count as ongoing, in chart order, with their colors.
const ONGOING = [
  { status: 'active', color: 'var(--fo-ok)', tone: 'ok' },
  { status: 'planning', color: 'var(--fo-info)', tone: 'info' },
  { status: 'on_hold', color: '#e0a43a', tone: 'warn' },
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
  const [todayByProject, setTodayByProject] = useState(new Map())
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
        safe(supabase.from('projects').select('id,name,code,project_id,city,state_region,status,updated_at').eq('stage', 'contract').in('status', ONGOING_STATUSES).order('updated_at', { ascending: false }), empty),
        safe(supabase.from('field_attendance_sessions').select('worker_id').eq('status', 'open'), empty),
        safe(supabase.from('field_execution_events').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'), empty),
        safe(supabase.from('daily_report_issues').select('id', { count: 'exact', head: true }).in('status', OPEN_ISSUE_STATUSES), empty),
        safe(supabase.from('daily_reports').select('id,status,project_id').eq('report_date', localDateKey()), empty),
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
      setTodayByProject(new Map(todayReports.map((report) => [report.project_id, report])))
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

  const timeOnly = useMemo(() => new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' }), [language])

  function activityText(item) {
    const name = item.name || t('activity.unknownWorker')
    if (item.kind === 'check_in') return t('activity.checkIn', { name })
    if (item.kind === 'check_out') return t('activity.checkOut', { name })
    if (item.kind === 'manual_adjustment') return t('activity.adjustment', { name })
    if (item.kind === 'session_cancelled') return t('activity.cancelled', { name })
    return t('activity.report', { number: String(item.number || 0).padStart(4, '0') })
  }

  const newReportHref = projects.length === 1 ? `/fieldop/reports/daily/new?projectId=${projects[0].id}` : '/fieldop/reports/daily/new'

  const tone = (status) => ONGOING.find((item) => item.status === status)?.tone
  const location = (project) => [project.city, project.state_region].filter(Boolean).join(', ') || '—'

  return <FieldOpShell active="portfolio" action={<Link className={ui.btnPrimary} href={newReportHref}><Icon name="plus" size={18} />{t('nav.newReport')}</Link>}>
    <Stats>
      <Stat label={t('kpi.ongoing')} value={projects.length} hint={t('kpi.ongoingDetail', { active: counts.active, planning: counts.planning, onHold: counts.on_hold })} />
      <Stat label={t('kpi.workers')} value={kpis.workers} hint={t('kpi.workersDetail')} tone={kpis.workers ? 'ok' : undefined} />
      <Stat label={t('kpi.operations')} value={kpis.operations} hint={t('kpi.operationsDetail')} />
      <Stat label={t('kpi.occurrences')} value={kpis.occurrences} hint={kpis.occurrences ? t('kpi.occurrencesDetail') : t('kpi.occurrencesNone')} tone={kpis.occurrences ? 'bad' : undefined} />
      <Stat label={t('kpi.reports')} value={kpis.reportsSubmitted + kpis.reportsDraft} hint={t('kpi.reportsDetail', { submitted: kpis.reportsSubmitted, drafts: kpis.reportsDraft })} />
    </Stats>

    <div className={ui.split}>
      <Panel body={false} title={t('projects.title')} text={t('projects.subtitle')}
        actions={<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('projects.search')} aria-label={t('projects.search')} style={{ width: 220 }} />}>
        {loading ? <Empty title={t('common.loading')} />
          : projects.length === 0 ? <Empty title={t('projects.emptyTitle')} text={t('projects.emptyText')} action={<Link className={ui.btnPrimary} href="/fieldop/projects">{t('projects.viewAll')}</Link>} />
            : visibleProjects.length === 0 ? <Empty title={t('projects.noMatch')} />
              : <div className={ui.tableWrap}><table className={`${ui.table} ${ui.cards}`}>
                <thead><tr><th>{t('projects.colProject')}</th><th>{t('projects.colLocation')}</th><th>{t('projects.colStatus')}</th><th>{t('projects.colToday')}</th><th /></tr></thead>
                <tbody>{visibleProjects.map((project) => {
                  const today = todayByProject.get(project.id)
                  return <tr key={project.id}>
                    <td data-label=""><span><Link className={ui.rowLink} href={`/fieldop/projects/${project.id}`}>{project.name || t('projects.untitled')}</Link><span className={ui.sub}>{project.project_id || project.code || ''}</span></span></td>
                    <td data-label={t('projects.colLocation')}>{location(project)}</td>
                    <td data-label={t('projects.colStatus')}><Badge tone={tone(project.status)}>{t(`status.${project.status}`)}</Badge></td>
                    <td data-label={t('projects.colToday')}>{today
                      ? <Link href={`/fieldop/reports/daily/${today.id}`} style={{ textDecoration: 'none' }}><Badge tone={reportTone(today.status)}>{t(`reportStatus.${today.status}`)}</Badge></Link>
                      : <Link className={`${ui.btn} ${ui.small}`} href={`/fieldop/reports/daily/new?projectId=${project.id}`}>{t('projects.startReport')}</Link>}</td>
                    <td data-label="" style={{ textAlign: 'right' }}><Link className={`${ui.btn} ${ui.small}`} href={`/fieldop/projects/${project.id}`}>{t('projects.openProject')}</Link></td>
                  </tr>
                })}</tbody>
              </table></div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 20px', borderTop: '1px solid var(--fo-line-soft)', color: 'var(--fo-muted)', fontSize: 14 }}>
          <span>{t('projects.showing', { shown: visibleProjects.length, total: projects.length })}</span>
          <Link href="/fieldop/projects" className={ui.btnGhost}>{t('projects.viewAll')}</Link>
        </div>
      </Panel>

      <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
        <Panel title={t('chart.title')}>
          <div className={ui.stack} role="img" aria-label={ONGOING.map(({ status }) => `${t(`status.${status}`)} ${counts[status]}`).join(', ')}>
            {projects.length ? ONGOING.filter(({ status }) => counts[status]).map(({ status, color }) => <i key={status} style={{ flex: counts[status], background: color }} />) : <i style={{ flex: 1, background: 'var(--fo-line-soft)' }} />}
          </div>
          <ul className={ui.legend}>{ONGOING.map(({ status, color }) => <li key={status}><i style={{ background: color }} />{t(`status.${status}`)}<b>{counts[status]}</b></li>)}</ul>
        </Panel>
        <Panel body={false} title={t('activity.title')} text={t('activity.period')}>
          {activity.length === 0
            ? <Empty title={loading ? t('common.loading') : t('activity.empty')} />
            : <ul className={ui.feed}>{activity.map((item) => {
              const row = <><time>{timeOnly.format(new Date(item.at))}</time><span>{activityText(item)}{item.project && <small>{item.project}</small>}</span></>
              return <li key={item.id}>{item.href ? <Link href={item.href}>{row}</Link> : <div>{row}</div>}</li>
            })}</ul>}
        </Panel>
      </div>
    </div>
  </FieldOpShell>
}
