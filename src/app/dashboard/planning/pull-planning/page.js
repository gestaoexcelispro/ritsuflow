'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useT } from '../../../../lib/i18n/useT'
import { listPlans, loadProjects } from '../../../../lib/pull/data'
import { readPreconProjectId, rememberPreconProjectId } from '../../preconProject'
import { Badge, Empty, Icon, Notice, PageHeader, Panel, Segments, Stat, Stats, ui } from '../../../fieldop/ui'
import { PULL_BASE, STATUS_TONE, errorText, todayIso, useFormatDate } from './shared'
import styles from './pull.module.css'

export default function PullPlansPage() {
  const t = useT('precon')
  const formatDate = useFormatDate()
  const [projects, setProjects] = useState(null)
  const [projectId, setProjectId] = useState('')
  const [plans, setPlans] = useState(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    loadProjects().then((rows) => {
      if (!alive) return
      setProjects(rows)
      const wanted = readPreconProjectId()
      const pick = rows.find((p) => p.id === wanted)?.id || rows[0]?.id || ''
      setProjectId(pick)
      if (pick && pick !== wanted) rememberPreconProjectId(pick)
    }).catch((e) => alive && setError(errorText(e)))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!projectId) { setPlans([]); return undefined }
    let alive = true
    setPlans(null)
    listPlans(projectId).then((rows) => alive && setPlans(rows)).catch((e) => { if (alive) { setError(errorText(e)); setPlans([]) } })
    return () => { alive = false }
  }, [projectId])

  const today = todayIso()
  const summary = useMemo(() => {
    const list = plans || []
    const next = list.filter((p) => p.status !== 'archived' && p.milestone_date >= today).sort((a, b) => a.milestone_date.localeCompare(b.milestone_date))[0]
    return {
      next,
      inSession: list.filter((p) => p.status === 'in_session').length,
      agreed: list.reduce((n, p) => n + p.agreedCount, 0),
      handoffs: list.reduce((n, p) => n + p.handoffCount, 0),
    }
  }, [plans, today])

  const visible = (plans || []).filter((p) => filter === 'all' || p.status === filter)
  const newHref = projectId ? `${PULL_BASE}/new?projectId=${projectId}` : `${PULL_BASE}/new`

  const choose = (id) => { setProjectId(id); rememberPreconProjectId(id) }

  return <>
    <PageHeader
      title={t('pull.title')}
      subtitle={t('pull.subtitle')}
      actions={<>
        <label className={ui.field} style={{ minWidth: 240 }}>
          <span className={ui.fieldLabel}>{t('pull.project')}</span>
          <select value={projectId} onChange={(e) => choose(e.target.value)} disabled={!projects?.length}>
            {(projects || []).map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} · ${p.name}` : p.name}</option>)}
          </select>
        </label>
        {projectId && <Link className={ui.btnPrimary} href={newHref} style={{ alignSelf: 'flex-end' }}><Icon name="plus" size={18} />{t('pull.newPlan')}</Link>}
      </>}
    />
    <Notice>{error}</Notice>

    {projects && !projects.length && <Panel><Empty title={t('pull.noProjects')} text={t('pull.noProjectsText')} /></Panel>}

    {projectId && <>
      <Stats>
        <Stat label={t('pull.statNext')} value={summary.next ? formatDate(summary.next.milestone_date) : '—'} hint={summary.next?.milestone_name || t('pull.statNextNone')} />
        <Stat label={t('pull.statInSession')} value={plans ? summary.inSession : '…'} hint={t('pull.statPlans', { count: plans?.length || 0 })} />
        <Stat label={t('pull.statHandoffs')} value={plans ? `${summary.agreed} / ${summary.handoffs}` : '…'} hint={t('pull.statHandoffsHint')} />
      </Stats>

      <Panel
        title={t('pull.listTitle')}
        text={t('pull.listText')}
        body={false}
        actions={<Segments value={filter} onChange={setFilter} items={['all', 'in_session', 'agreed', 'draft', 'archived'].map((value) => ({ value, label: value === 'all' ? t('pull.filterAll') : t(`pull.status.${value}`) }))} />}
      >
        {!plans && <Empty text={t('pull.loading')} />}
        {plans && !plans.length && <Empty title={t('pull.empty')} text={t('pull.emptyText')} action={<Link className={ui.btnPrimary} href={newHref}><Icon name="plus" size={18} />{t('pull.newPlan')}</Link>} />}
        {plans && plans.length > 0 && !visible.length && <Empty text={t('pull.emptyFilter')} />}
        {visible.length > 0 && <div className={ui.tableWrap}>
          <table className={`${ui.table} ${ui.cards}`}>
            <thead><tr>
              <th>{t('pull.colPlan')}</th><th>{t('pull.colMilestone')}</th><th>{t('pull.colSession')}</th>
              <th>{t('pull.colParticipants')}</th><th>{t('pull.colHandoffs')}</th><th>{t('pull.colBuffer')}</th><th>{t('pull.colStatus')}</th>
            </tr></thead>
            <tbody>
              {visible.map((plan) => <tr key={plan.id}>
                <td data-label="">
                  <Link className={ui.rowLink} href={`${PULL_BASE}/${plan.id}`}>{plan.name}</Link>
                  <span className={ui.sub}>{plan.milestone_name}</span>
                </td>
                <td data-label={t('pull.colMilestone')}><strong>{formatDate(plan.milestone_date)}</strong></td>
                <td data-label={t('pull.colSession')}>{plan.session_date ? formatDate(plan.session_date) : t('pull.notScheduled')}</td>
                <td data-label={t('pull.colParticipants')}>
                  <span className={styles.dots}>{plan.participants.slice(0, 8).map((p) => <i key={p.id} style={{ background: p.color }} />)}</span>
                  <span className={ui.sub} style={{ display: 'inline', marginLeft: 8 }}>{t('pull.tradesCount', { count: plan.participants.length })}</span>
                </td>
                <td data-label={t('pull.colHandoffs')}>
                  <div className={styles.meter}>
                    <span>{t('pull.ofCount', { done: plan.agreedCount, total: plan.handoffCount })}</span>
                    <i><b style={{ width: `${plan.handoffCount ? Math.round((plan.agreedCount / plan.handoffCount) * 100) : 0}%` }} /></i>
                  </div>
                </td>
                <td data-label={t('pull.colBuffer')}>{plan.buffer_days ? t('pull.workingDays', { count: plan.buffer_days }) : '—'}</td>
                <td data-label={t('pull.colStatus')}><Badge tone={STATUS_TONE[plan.status]}>{t(`pull.status.${plan.status}`)}</Badge></td>
              </tr>)}
            </tbody>
          </table>
        </div>}
      </Panel>
    </>}
  </>
}
