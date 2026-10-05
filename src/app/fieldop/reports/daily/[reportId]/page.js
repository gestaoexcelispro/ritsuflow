'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/client'
import { useT } from '../../../../../lib/i18n/useT'
import { useLanguage } from '../../../../../lib/i18n/LanguageProvider'
import { FieldOpShell, PageHeader, Badge, Empty, Segments, Icon, ui, reportTone } from '../../../ui'
import GeneralSection from './GeneralSection'
import ProductionSection from './ProductionSection'
import WorkforceSection from './WorkforceSection'
import WeatherSection from './WeatherSection'
import SafetySection from './SafetySection'
import NotesSection from './NotesSection'
import MaterialsSection from './MaterialsSection'
import EquipmentSection from './EquipmentSection'
import IssuesSection from './IssuesSection'
import AttachmentsSection from './AttachmentsSection'
import ApprovalSection from './ApprovalSection'
import styles from '../daily-reports.module.css'
import { submitReport } from './submit'

// The report is filled in four steps. Each section names the Daily Report Settings switch
// that can hide it (null = always shown).
const GROUPS = [
  ['day', [['general', null], ['weather', 'capture_weather'], ['workforce', 'capture_workforce']]],
  ['work', [['production', 'capture_progress'], ['materials', 'capture_materials'], ['equipment', 'capture_equipment']]],
  ['site', [['safety', 'capture_occurrences'], ['issues', 'capture_occurrences'], ['notes', 'capture_general_notes'], ['attachments', 'capture_photos']]],
  ['approval', [['approval', null]]],
]
const EMPTY_SUMMARY = { workers: 0, minutes: 0, production: 0, weather: 0, materials: 0, equipment: 0, issues: 0, openIssues: 0, notes: 0, attachments: 0, safety: null }

export default function FieldOpDailyReportWorkspace() {
  const { reportId } = useParams()
  const supabase = useMemo(() => createClient(), [])
  const t = useT('fieldopReports')
  const { language } = useLanguage()
  const [report, setReport] = useState(null)
  const [settings, setSettings] = useState(null)
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(true)
  const [active, setActiveTab] = useState('overview')
  const [error, setError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [perms, setPerms] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState(null)

  // Leaving a section (or the page) with unsaved changes asks first.
  const setActive = (tab) => {
    if (tab === active) return
    if (dirty && !window.confirm(t('unsaved.confirm'))) return
    setDirty(false); setNotice(null); setActiveTab(tab)
  }
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const loadSummary = useCallback(async (current) => {
    if (!current) return
    const count = (table, extra) => {
      let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('daily_report_id', current.id)
      if (extra) q = extra(q)
      return q
    }
    const [sessions, production, weather, materials, equipment, issues, openIssues, notes, attachments, safety] = await Promise.all([
      supabase.from('field_attendance_sessions').select('worker_id,worked_minutes,check_in_at,check_out_at,status').eq('project_id', current.projects.id).eq('work_date', current.report_date).neq('status', 'cancelled'),
      count('daily_report_production'),
      count('daily_report_weather'),
      count('daily_report_materials'),
      count('daily_report_equipment'),
      count('daily_report_issues'),
      count('daily_report_issues', (q) => q.in('status', ['open', 'in_progress'])),
      count('daily_report_notes'),
      count('daily_report_attachments'),
      supabase.from('daily_report_safety').select('overall_status').eq('daily_report_id', current.id).maybeSingle(),
    ])
    const list = sessions.data || []
    const minutes = list.reduce((sum, s) => sum + (s.worked_minutes ?? Math.max(0, Math.floor((new Date(s.check_out_at || Date.now()) - new Date(s.check_in_at)) / 60000))), 0)
    setSummary({
      workers: new Set(list.map((s) => s.worker_id)).size, minutes, production: production.count || 0,
      weather: weather.count || 0, materials: materials.count || 0, equipment: equipment.count || 0,
      issues: issues.count || 0, openIssues: openIssues.count || 0, notes: notes.count || 0, attachments: attachments.count || 0,
      safety: safety.data?.overall_status || null,
    })
  }, [supabase])

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error: loadError } = await supabase.from('daily_reports').select('id,report_number,report_date,status,work_start_time,work_end_time,general_notes,projects(id,code,name,client_name,organization_id)').eq('id', reportId).single()
      if (loadError) { setError(loadError.message); setLoading(false); return }
      setReport(data)
      const { data: settingsRow } = await supabase.from('fieldop_daily_report_settings').select('*').eq('project_id', data.projects.id).maybeSingle()
      setSettings(settingsRow || null)
      await loadSummary(data)
      setLoading(false)
    }
    if (reportId) load()
  }, [reportId, supabase, loadSummary])

  // Which workflow actions the signed-in user may take (shows the header Submit button).
  useEffect(() => {
    if (!report?.id) return
    supabase.rpc('fieldop_daily_report_permissions', { p_daily_report_id: report.id }).then(({ data }) => setPerms(data || null))
  }, [report?.id, report?.status, supabase])

  // Keep the checklist current: recount whenever the user moves to another section.
  useEffect(() => { if (report) loadSummary(report) }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => GROUPS
    .map(([group, sections]) => [group, sections.filter(([, setting]) => !setting || !settings || settings[setting] !== false).map(([key]) => key)])
    .filter(([, sections]) => sections.length), [settings])

  if (loading) return <FieldOpShell active="reports"><Empty title={t('report.loading')} /></FieldOpShell>
  if (error || !report) return <FieldOpShell active="reports"><Empty title={t('report.unavailable')} text={error} action={<a className={ui.btn} href="/fieldop/reports/daily">{t('report.backToList')}</a>} /></FieldOpShell>

  const locked = report.status === 'approved'
  const reportDate = new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(new Date(`${report.report_date}T12:00:00`))
  const number = `DR-${String(report.report_number || 0).padStart(4, '0')}`
  const sectionProps = { report, supabase, t, language, locked, reportDate, onDirty: setDirty }

  async function submitFromHeader() {
    if (dirty && !window.confirm(t('unsaved.confirmSubmit'))) return
    setSubmitting(true); setNotice(null)
    const { error: submitError } = await submitReport(supabase, report.id)
    if (submitError) setNotice({ tone: 'bad', text: t('common.error', { message: submitError.message }) })
    else { setDirty(false); setNotice({ tone: 'ok', text: t('approval.done', { status: t('status.submitted') }) }); refresh({ status: 'submitted' }) }
    setSubmitting(false)
  }
  const refresh = (patch) => { const next = { ...report, ...(patch || {}) }; setReport(next); loadSummary(next) }

  // What each section shows in the checklist: whether it has entries, and a short count.
  const state = {
    general: { done: Boolean(report.work_start_time || report.general_notes) },
    weather: { done: summary.weather > 0, count: summary.weather || null },
    workforce: { done: summary.workers > 0, count: summary.workers || null },
    production: { done: summary.production > 0, count: summary.production || null },
    materials: { done: summary.materials > 0, count: summary.materials || null },
    equipment: { done: summary.equipment > 0, count: summary.equipment || null },
    safety: { done: Boolean(summary.safety) },
    issues: { done: summary.issues > 0, count: summary.openIssues ? t('rail.open', { count: summary.openIssues }) : null, warn: summary.openIssues > 0 },
    notes: { done: summary.notes > 0, count: summary.notes || null },
    attachments: { done: summary.attachments > 0, count: summary.attachments || null },
    approval: { done: report.status === 'approved' },
  }
  const content = groups.flatMap(([, sections]) => sections).filter((key) => key !== 'approval')
  const filled = content.filter((key) => state[key].done).length
  const pct = content.length ? Math.round((filled / content.length) * 100) : 0
  const activeGroup = groups.find(([, sections]) => sections.includes(active))?.[0] || null

  const overviewText = {
    general: report.work_start_time ? `${report.work_start_time.slice(0, 5)} – ${report.work_end_time?.slice(0, 5) || '…'}` : t('overview.notFilled'),
    weather: summary.weather ? t('overview.weather', { count: summary.weather }) : t('overview.notFilled'),
    workforce: t('overview.workforce', { workers: summary.workers, hours: (summary.minutes / 60).toFixed(1) }),
    production: t('overview.production', { count: summary.production }),
    materials: t('overview.items', { count: summary.materials }),
    equipment: t('overview.items', { count: summary.equipment }),
    safety: summary.safety ? t(`safety.status.${summary.safety}`) : t('overview.notFilled'),
    issues: t('overview.openIssues', { count: summary.openIssues }),
    notes: t('overview.items', { count: summary.notes }),
    attachments: t('overview.items', { count: summary.attachments }),
    approval: t(`status.${report.status}`),
  }

  const renderStep = (id, linked) => {
    const s = state[id]
    return <button key={id} type="button" onClick={() => setActive(id)} aria-current={active === id ? 'step' : undefined}
      className={[styles.step, active === id && styles.stepOn, linked && styles.stepLinked].filter(Boolean).join(' ')}>
      <span className={[styles.mark, s.done && styles.markDone].filter(Boolean).join(' ')}>{s.done && <Icon name="check" size={12} strokeWidth={3} />}</span>
      {t(`tab.${id}`)}
      {s.count != null && <span className={[styles.count, s.warn && styles.countWarn].filter(Boolean).join(' ')}>{s.count}</span>}
    </button>
  }

  return <FieldOpShell active="reports" projectId={report.projects?.id}>
    <PageHeader
      back={{ href: '/fieldop/reports/daily', label: t('common.reports') }}
      title={`${number} · ${report.projects?.name || ''}`}
      meta={<><span>{reportDate}</span><Badge tone={reportTone(report.status)}>{t(`status.${report.status}`)}</Badge></>}
      actions={report.status === 'draft' && perms?.submit && <button type="button" className={ui.btnPrimary} disabled={submitting} onClick={submitFromHeader}>{submitting ? t('common.saving') : t('approval.submitted')}</button>}
    />
    {notice && <div className={notice.tone === 'ok' ? styles.lockNote : styles.error} style={notice.tone === 'ok' ? { background: 'var(--fo-ok-wash)', color: 'var(--fo-ok)' } : undefined} role="status">{notice.text}</div>}

    <div className={styles.workspace}>
      <nav className={styles.rail} aria-label={t('rail.label')}>
        <div className={styles.railProgress}>
          <strong>{t('rail.progress', { filled, total: content.length })}</strong>
          <span>{t('rail.progressHint')}</span>
          <div className={styles.bar}><i style={{ width: `${pct}%` }} /></div>
        </div>
        <button type="button" className={[styles.step, active === 'overview' && styles.stepOn].filter(Boolean).join(' ')} onClick={() => setActive('overview')}>
          <span className={styles.mark} style={{ borderStyle: 'dashed' }} />{t('tab.overview')}
        </button>
        {groups.map(([group, sections]) => <div key={group} className={styles.group}>
          <div className={styles.groupName}>{t(`group.${group}`)}</div>
          {sections.map((id, i) => renderStep(id, i > 0 && state[sections[i - 1]].done && state[id].done))}
        </div>)}
      </nav>

      <div style={{ minWidth: 0 }}>
        <div className={styles.stepper}>
          <div className={styles.railProgress} style={{ padding: 0, border: 0, margin: 0 }}>
            <strong>{t('rail.progress', { filled, total: content.length })}</strong>
            <div className={styles.bar}><i style={{ width: `${pct}%` }} /></div>
          </div>
          <div className={styles.stepperGroups}>
            <Segments value={activeGroup || 'overview'} onChange={(g) => setActive(g === 'overview' ? 'overview' : groups.find(([name]) => name === g)[1][0])}
              items={[{ value: 'overview', label: t('tab.overview') }, ...groups.map(([g, sections]) => ({ value: g, label: g === 'approval' ? t(`group.${g}`) : `${t(`group.${g}`)} ${sections.filter((s) => state[s].done).length}/${sections.length}` }))]} />
          </div>
          {activeGroup && groups.find(([g]) => g === activeGroup)[1].length > 1 && <div className={styles.stepperGroups}>
            <Segments value={active} onChange={setActive} items={groups.find(([g]) => g === activeGroup)[1].map((id) => ({ value: id, label: `${state[id].done ? '✓ ' : ''}${t(`tab.${id}`)}` }))} />
          </div>}
        </div>

        {locked && active !== 'approval' && <div className={styles.lockNote}>{t('report.locked')}</div>}

        {active === 'overview' && <div style={{ display: 'grid', gap: 18 }}>
          {groups.map(([group, sections]) => <section key={group}>
            <h2 style={{ margin: '0 0 10px', fontSize: 17, fontWeight: 600 }}>{t(`group.${group}`)}</h2>
            <div className={styles.sectionGrid}>
              {sections.map((id) => <button type="button" key={id} className={styles.sectionCard} onClick={() => setActive(id)}>
                <h3><span className={[styles.mark, state[id].done && styles.markDone].filter(Boolean).join(' ')}>{state[id].done && <Icon name="check" size={12} strokeWidth={3} />}</span>{t(`tab.${id}`)}</h3>
                <p>{overviewText[id]}</p>
              </button>)}
            </div>
          </section>)}
        </div>}
        {active === 'general' && <GeneralSection {...sectionProps} onSaved={(patch) => refresh(patch)} />}
        {active === 'weather' && <WeatherSection {...sectionProps} />}
        {active === 'workforce' && <WorkforceSection {...sectionProps} />}
        {active === 'production' && <ProductionSection {...sectionProps} onSaved={() => refresh()} />}
        {active === 'materials' && <MaterialsSection {...sectionProps} />}
        {active === 'equipment' && <EquipmentSection {...sectionProps} />}
        {active === 'safety' && <SafetySection {...sectionProps} />}
        {active === 'issues' && <IssuesSection {...sectionProps} />}
        {active === 'notes' && <NotesSection {...sectionProps} />}
        {active === 'attachments' && <AttachmentsSection {...sectionProps} />}
        {active === 'approval' && <ApprovalSection {...sectionProps} approvalRequired={settings?.require_approval === true} onChanged={(patch) => refresh(patch)} />}
      </div>
    </div>
  </FieldOpShell>
}
