'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase/client'
import { useT } from '../../../../lib/i18n/useT'
import { useLanguage } from '../../../../lib/i18n/LanguageProvider'
import { FieldOpShell, PageHeader, Panel, Stats, Stat, Badge, Empty, Segments, Icon, ui, reportTone } from '../../ui'

const localDateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const FILTERS = ['all', 'draft', 'submitted', 'reviewed', 'approved']

export default function FieldOpDailyReportsPage() {
  const supabase = useMemo(() => createClient(), [])
  const t = useT('fieldopReports')
  const { language } = useLanguage()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [projectId, setProjectId] = useState('all')

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('daily_reports').select('id,report_number,report_date,status,created_at,projects(id,code,name)').order('report_date', { ascending: false }).limit(200)
      if (!alive) return
      if (error) { console.error('FieldOp Daily Reports:', error); setReports([]) } else setReports(data || [])
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [supabase])

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }), [language])
  const reportDate = (value) => (value ? dateFormat.format(new Date(`${value}T12:00:00`)) : '—')

  // "Today" is the local date, not UTC (after 21:00 in Brazil UTC is already tomorrow).
  const today = localDateKey()
  const projects = useMemo(() => [...new Map(reports.filter((r) => r.projects).map((r) => [r.projects.id, r.projects])).values()], [reports])
  const inProject = projectId === 'all' ? reports : reports.filter((r) => r.projects?.id === projectId)
  const shown = filter === 'all' ? inProject : inProject.filter((r) => r.status === filter)
  const count = (status) => inProject.filter((r) => r.status === status).length
  const awaiting = count('submitted') + count('reviewed')
  const newHref = projectId === 'all' ? '/fieldop/reports/daily/new' : `/fieldop/reports/daily/new?projectId=${projectId}`

  return <FieldOpShell active="reports">
    <PageHeader title={t('list.title')} subtitle={t('list.heroText')}
      actions={<Link className={ui.btnPrimary} href={newHref}><Icon name="plus" size={18} />{t('list.newReport')}</Link>} />

    <Stats>
      <Stat label={t('list.cardToday')} value={inProject.filter((r) => r.report_date === today).length} hint={t('list.cardTodayHint')} />
      <Stat label={t('list.cardDraft')} value={count('draft')} />
      <Stat label={t('list.cardReview')} value={awaiting} tone={awaiting ? 'warn' : undefined} hint={awaiting ? t('list.cardReviewHint') : undefined} />
      <Stat label={t('list.cardApproved')} value={count('approved')} tone="ok" />
    </Stats>

    <Panel body={false} title={t('list.history')} text={t('list.count', { count: shown.length })}
      actions={projects.length > 1 && <select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ minWidth: 220 }} aria-label={t('list.colProject')}>
        <option value="all">{t('list.allProjects')}</option>
        {projects.map((p) => <option key={p.id} value={p.id}>{[p.code, p.name].filter(Boolean).join(' · ')}</option>)}
      </select>}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--fo-line-soft)', overflowX: 'auto' }}>
        <Segments value={filter} onChange={setFilter} items={FILTERS.map((f) => ({ value: f, label: f === 'all' ? t('list.filterAll') : t(`status.${f}`) }))} />
      </div>
      {loading
        ? <Empty title={t('list.loading')} />
        : shown.length === 0
          ? <Empty title={reports.length ? t('list.emptyFiltered') : t('list.emptyTitle')} text={reports.length ? null : t('list.emptyText')}
            action={!reports.length && <Link className={ui.btnPrimary} href={newHref}>{t('list.create')}</Link>} />
          : <div className={ui.tableWrap}><table className={`${ui.table} ${ui.cards}`}>
            <thead><tr><th>{t('list.colReport')}</th><th>{t('list.colDate')}</th><th>{t('list.colProject')}</th><th>{t('list.colStatus')}</th></tr></thead>
            <tbody>{shown.map((r) => <tr key={r.id}>
              <td data-label=""><span><Link className={ui.rowLink} href={`/fieldop/reports/daily/${r.id}`}>DR-{String(r.report_number || 0).padStart(4, '0')}</Link>{r.report_date === today && <span className={ui.sub}>{t('list.todayTag')}</span>}</span></td>
              <td data-label={t('list.colDate')}>{reportDate(r.report_date)}</td>
              <td data-label={t('list.colProject')}><span>{r.projects?.name || '—'}{r.projects?.code && <span className={ui.sub}>{r.projects.code}</span>}</span></td>
              <td data-label={t('list.colStatus')}><Badge tone={reportTone(r.status)}>{t(`status.${r.status || 'draft'}`)}</Badge></td>
            </tr>)}</tbody>
          </table></div>}
    </Panel>
  </FieldOpShell>
}
