'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/client'
import { useT } from '../../../../../lib/i18n/useT'
import { useLanguage } from '../../../../../lib/i18n/LanguageProvider'
import LanguageSelector from '../../../../../components/LanguageSelector'
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

// Each tab and the Daily Report Settings switch that controls it (null = always shown).
const TABS = [
  ['overview', null],
  ['general', null],
  ['weather', 'capture_weather'],
  ['workforce', 'capture_workforce'],
  ['production', 'capture_progress'],
  ['materials', 'capture_materials'],
  ['equipment', 'capture_equipment'],
  ['safety', 'capture_occurrences'],
  ['issues', 'capture_occurrences'],
  ['notes', 'capture_general_notes'],
  ['attachments', 'capture_photos'],
  ['approval', null],
]
const BUILT = ['overview', 'general', 'weather', 'workforce', 'production', 'materials', 'equipment', 'safety', 'issues', 'notes', 'attachments', 'approval']

export default function FieldOpDailyReportWorkspace() {
  const { reportId } = useParams()
  const supabase = useMemo(() => createClient(), [])
  const t = useT('fieldopReports')
  const { language } = useLanguage()
  const [report, setReport] = useState(null)
  const [settings, setSettings] = useState(null)
  const [summary, setSummary] = useState({ workers: 0, minutes: 0, production: 0, weather: 0, materials: 0, equipment: 0, openIssues: 0, notes: 0, attachments: 0, safety: null })
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState('overview')
  const [error, setError] = useState('')

  const loadSummary = useCallback(async (current) => {
    if (!current) return
    const count = (table, extra) => {
      let q = supabase.from(table).select('id', { count: 'exact', head: true }).eq('daily_report_id', current.id)
      if (extra) q = extra(q)
      return q
    }
    const [sessions, production, weather, materials, equipment, issues, notes, attachments, safety] = await Promise.all([
      supabase.from('field_attendance_sessions').select('worker_id,worked_minutes,check_in_at,check_out_at,status').eq('project_id', current.projects.id).eq('work_date', current.report_date).neq('status', 'cancelled'),
      count('daily_report_production'),
      count('daily_report_weather'),
      count('daily_report_materials'),
      count('daily_report_equipment'),
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
      openIssues: issues.count || 0, notes: notes.count || 0, attachments: attachments.count || 0,
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

  // Refresh the overview counts whenever the user comes back to it.
  useEffect(() => { if (active === 'overview' && report) loadSummary(report) }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleTabs = useMemo(() => TABS.filter(([, setting]) => !setting || !settings || settings[setting] !== false).map(([key]) => key), [settings])
  const hiddenSomething = visibleTabs.length < TABS.length

  if (loading) return <main className={styles.page}><div className={styles.empty}>{t('report.loading')}</div></main>
  if (error || !report) return <main className={styles.page}><div className={styles.empty}><strong>{t('report.unavailable')}</strong><p>{error}</p><Link href="/fieldop/reports/daily">{t('report.backToList')}</Link></div></main>

  const locked = report.status === 'approved'
  const reportDate = new Intl.DateTimeFormat(language, { dateStyle: 'full' }).format(new Date(`${report.report_date}T12:00:00`))
  const number = `DR-${String(report.report_number || 0).padStart(4, '0')}`
  const sectionProps = { report, supabase, t, language, locked, reportDate }
  const overviewCards = [
    ['general', report.work_start_time ? `${report.work_start_time.slice(0, 5)} – ${report.work_end_time?.slice(0, 5) || '…'}` : t('overview.notFilled')],
    ['weather', summary.weather ? t('overview.weather', { count: summary.weather }) : t('overview.notFilled')],
    ['workforce', t('overview.workforce', { workers: summary.workers, hours: (summary.minutes / 60).toFixed(1) })],
    ['production', t('overview.production', { count: summary.production })],
    ['materials', t('overview.items', { count: summary.materials })],
    ['equipment', t('overview.items', { count: summary.equipment })],
    ['safety', summary.safety ? t(`safety.status.${summary.safety}`) : t('overview.notFilled')],
    ['issues', t('overview.openIssues', { count: summary.openIssues })],
    ['notes', t('overview.items', { count: summary.notes })],
    ['attachments', t('overview.items', { count: summary.attachments })],
    ['approval', t('overview.status', { status: t(`status.${report.status}`) })],
  ]
  const refresh = (patch) => { const next = { ...report, ...(patch || {}) }; setReport(next); loadSummary(next) }

  return <main className={styles.page}>
    <header className={styles.header}>
      <Image className={styles.logo} src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority />
      <div className={styles.headerTitle}><span className={styles.eyebrow}>{t('report.eyebrow')}</span><h1>{number}</h1></div>
      <div className={styles.headerActions}>
        <LanguageSelector compact dark />
        <Link className={styles.headerButton} href="/fieldop">{t('common.backToFieldOp')}</Link>
        <Link className={styles.secondaryButton} href="/fieldop/reports/daily">{t('common.reports')}</Link>
      </div>
    </header>
    <section className={styles.reportMeta}>
      <strong>{[report.projects?.code, report.projects?.name].filter(Boolean).join(' · ')}</strong>
      <span>{reportDate}</span>
      <span>{report.projects?.client_name || ''}</span>
      <span className={styles.badge}>{t(`status.${report.status}`)}</span>
    </section>
    <nav className={styles.tabs}>{visibleTabs.map((tab) => <button key={tab} type="button" onClick={() => setActive(tab)} className={`${styles.tab} ${active === tab ? styles.tabActive : ''}`}>{t(`tab.${tab}`)}</button>)}</nav>
    <section className={styles.workspace}>
      {locked && active !== 'approval' && <div className={styles.error} style={{ marginBottom: 12 }}>{t('report.locked')}</div>}

      {active === 'overview' && <>
        <div className={styles.hero}><div><h2>{t('overview.title')}</h2><p>{t('overview.text', { date: reportDate })}</p></div></div>
        <div className={styles.sectionGrid}>
          {overviewCards.filter(([tab]) => visibleTabs.includes(tab)).map(([tab, text]) => <article key={tab} className={styles.sectionCard} onClick={() => setActive(tab)} style={{ cursor: 'pointer' }}><h3>{t(`tab.${tab}`)}</h3><p>{text}</p><small>{t('overview.open')}</small></article>)}
        </div>
        {hiddenSomething && <p style={{ color: '#64748b', marginTop: 12 }}>{t('overview.hiddenTabs')}</p>}
      </>}
      {active === 'general' && <GeneralSection {...sectionProps} onSaved={(patch) => refresh(patch)} />}
      {active === 'production' && <ProductionSection {...sectionProps} onSaved={() => refresh()} />}
      {active === 'workforce' && <WorkforceSection {...sectionProps} />}
      {active === 'weather' && <WeatherSection {...sectionProps} />}
      {active === 'safety' && <SafetySection {...sectionProps} />}
      {active === 'notes' && <NotesSection {...sectionProps} />}
      {active === 'materials' && <MaterialsSection {...sectionProps} />}
      {active === 'equipment' && <EquipmentSection {...sectionProps} />}
      {active === 'issues' && <IssuesSection {...sectionProps} />}
      {active === 'attachments' && <AttachmentsSection {...sectionProps} />}
      {active === 'approval' && <ApprovalSection {...sectionProps} approvalRequired={settings?.require_approval === true} onChanged={(patch) => refresh(patch)} />}
      {!BUILT.includes(active) && <section className={styles.panel}><div className={styles.panelHead}><h3>{t(`tab.${active}`)}</h3></div><div className={styles.empty}>{t('placeholder.text', { section: t(`tab.${active}`) })}</div></section>}
    </section>
  </main>
}
