'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase/client'
import { useT } from '../../lib/i18n/useT'
import { useLanguage } from '../../lib/i18n/LanguageProvider'
import { Badge, Empty, Icon, Notice, Stat, Stats, ui } from '../fieldop/ui'
import styles from './overview.module.css'

const supabase = createClient()

const PROJECT_TONE = { active: 'ok', planning: 'info', on_hold: 'warn' }
const OPEN_CONSTRAINT = ['open', 'in_progress']
const RECENT_WEEKS = 4

const countBy = (rows, key = 'project_id') => rows.reduce((map, row) => map.set(row[key], (map.get(row[key]) || 0) + 1), new Map())

export default function PreconOverviewPage() {
  const t = useT('precon')
  const { numberFormat } = useLanguage()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      const [projects, scenarios, lookaheads, constraints, weeks] = await Promise.all([
        supabase.from('projects').select('id, project_id, code, name, status').eq('stage', 'contract').neq('status', 'archived').order('name'),
        supabase.from('master_plan_scenarios').select('project_id, is_baseline'),
        supabase.from('lookahead_plans').select('project_id'),
        supabase.from('constraints').select('project_id, blocking').in('status', OPEN_CONSTRAINT),
        supabase.from('weekly_plan_performance').select('project_id, week_start_date, ppc_percent').eq('ppc_is_final', true).order('week_start_date', { ascending: false }),
      ])
      if (!alive) return
      const failed = [projects, scenarios, lookaheads, constraints, weeks].find((result) => result.error)
      if (failed) setError(failed.error.message)
      setData({
        projects: projects.data || [],
        scenarios: scenarios.data || [],
        lookaheads: lookaheads.data || [],
        constraints: constraints.data || [],
        weeks: (weeks.data || []).filter((week) => week.ppc_percent != null),
      })
    }
    load()
    return () => { alive = false }
  }, [])

  const percent = useMemo(() => new Intl.NumberFormat(numberFormat, { style: 'percent', maximumFractionDigits: 0 }), [numberFormat])
  const ppcText = (value) => (value == null ? '—' : percent.format(Number(value) / 100))

  const summary = useMemo(() => {
    if (!data) return null
    const recent = data.weeks.slice(0, RECENT_WEEKS)
    const lastPpc = new Map()
    data.weeks.forEach((week) => { if (!lastPpc.has(week.project_id)) lastPpc.set(week.project_id, week.ppc_percent) })
    return {
      active: data.projects.filter((project) => project.status === 'active').length,
      baselines: new Set(data.scenarios.filter((s) => s.is_baseline).map((s) => s.project_id)),
      scenarios: countBy(data.scenarios),
      lookaheads: countBy(data.lookaheads),
      constraints: countBy(data.constraints),
      blocking: data.constraints.filter((c) => c.blocking).length,
      ppc: recent.length ? recent.reduce((sum, week) => sum + Number(week.ppc_percent), 0) / recent.length : null,
      lastPpc,
    }
  }, [data])

  if (!data) return <p className={styles.loading}>{t('overview.loading')}</p>

  return <>
    {error && <Notice>{t('overview.loadError', { message: error })}</Notice>}
    <Stats>
      <Stat label={t('overview.statProjects')} value={data.projects.length} hint={t('overview.statProjectsHint', { count: summary.active })} />
      <Stat label={t('overview.statScenarios')} value={data.scenarios.length} hint={t('overview.statScenariosHint', { count: summary.baselines.size })} />
      <Stat label={t('overview.statConstraints')} value={data.constraints.length} hint={t('overview.statConstraintsHint', { count: summary.blocking })} tone={summary.blocking ? 'warn' : undefined} />
      <Stat label={t('overview.statPpc')} value={ppcText(summary.ppc)} hint={t('overview.statPpcHint', { count: RECENT_WEEKS })} />
    </Stats>

    {!data.projects.length
      ? <Empty title={t('overview.empty')} text={t('overview.emptyText')} action={<Link className={ui.btnPrimary} href="/projects/new"><Icon name="plus" size={18} />{t('overview.newProject')}</Link>} />
      : <div className={`${ui.panel} ${ui.tableWrap}`}><table className={`${ui.table} ${ui.phoneCards}`}>
        <thead><tr>
          <th>{t('overview.colProject')}</th><th>{t('overview.colStatus')}</th><th>{t('overview.colMasterPlan')}</th>
          <th>{t('overview.colLookahead')}</th><th>{t('overview.colConstraints')}</th><th>{t('overview.colPpc')}</th><th />
        </tr></thead>
        <tbody>{data.projects.map((project) => {
          const scenarios = summary.scenarios.get(project.id) || 0
          const open = summary.constraints.get(project.id) || 0
          const code = project.code || project.project_id
          return <tr key={project.id}>
            <td data-label=""><div className={styles.project}><strong>{project.name}</strong>{code && <small>{code}</small>}</div></td>
            <td data-label={t('overview.colStatus')}><Badge tone={PROJECT_TONE[project.status]}>{t(`status.${project.status || 'planning'}`)}</Badge></td>
            <td data-label={t('overview.colMasterPlan')}><span className={styles.cell}>
              {scenarios ? scenarios : <span className={styles.muted}>{t('overview.notStarted')}</span>}
              {summary.baselines.has(project.id) && <Badge tone="ok">{t('overview.baseline')}</Badge>}
            </span></td>
            <td data-label={t('overview.colLookahead')}>{summary.lookaheads.get(project.id) || <span className={styles.muted}>—</span>}</td>
            <td data-label={t('overview.colConstraints')}>{open ? <Badge tone="warn">{open}</Badge> : <span className={styles.muted}>0</span>}</td>
            <td data-label={t('overview.colPpc')}>{ppcText(summary.lastPpc.get(project.id))}</td>
            <td data-label=""><div className={styles.rowAction}>
              <Link className={`${ui.btn} ${ui.small}`} href={`/dashboard/planning/master-plan?projectId=${project.id}`}>{t('overview.open')}<Icon name="right" size={16} /></Link>
            </div></td>
          </tr>
        })}</tbody>
      </table></div>}
  </>
}
