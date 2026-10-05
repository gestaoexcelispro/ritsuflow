'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '../../../../lib/supabase/client'
import { useT } from '../../../../lib/i18n/useT'
import { useLanguage } from '../../../../lib/i18n/LanguageProvider'
import LanguageSelector from '../../../../components/LanguageSelector'
import styles from './daily-reports.module.css'

const localDateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function FieldOpDailyReportsPage() {
  const supabase = useMemo(() => createClient(), [])
  const t = useT('fieldopReports')
  const { language } = useLanguage()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('daily_reports').select('id,report_number,report_date,status,created_at,projects(id,code,name)').order('report_date', { ascending: false }).limit(100)
      if (!alive) return
      if (error) { console.error('FieldOp Daily Reports:', error); setReports([]) } else setReports(data || [])
      setLoading(false)
    }
    load()
    return () => { alive = false }
  }, [supabase])

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'medium' }), [language])
  const dateTimeFormat = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }), [language])
  const reportDate = (value) => (value ? dateFormat.format(new Date(`${value}T12:00:00`)) : '—')

  // "Today" is the local date, not UTC (after 21:00 in Brazil UTC is already tomorrow).
  const today = localDateKey()
  const todayCount = reports.filter((r) => r.report_date === today).length
  const drafts = reports.filter((r) => r.status === 'draft').length
  const inReview = reports.filter((r) => ['submitted', 'reviewed'].includes(r.status)).length
  const approved = reports.filter((r) => r.status === 'approved').length

  return <main className={styles.page}>
    <header className={styles.header}>
      <Image className={styles.logo} src="/logo-white.png" alt="RitsuFlow" width={160} height={58} priority />
      <div className={styles.headerTitle}><span className={styles.eyebrow}>{t('list.eyebrow')}</span><h1>{t('list.title')}</h1></div>
      <div className={styles.headerActions}>
        <LanguageSelector compact dark />
        <Link className={styles.headerButton} href="/fieldop">{t('common.backToFieldOp')}</Link>
        <Link className={styles.primaryButton} href="/fieldop/reports/daily/new">{t('list.newReport')}</Link>
      </div>
    </header>
    <div className={styles.content}>
      <section className={styles.hero}><div><h2>{t('list.title')}</h2><p>{t('list.heroText')}</p></div><Link className={styles.primaryButton} href="/fieldop/reports/daily/new">{t('list.create')}</Link></section>
      <section className={styles.cards}>
        <div className={styles.card}><span>{t('list.cardToday')}</span><strong>{todayCount}</strong></div>
        <div className={styles.card}><span>{t('list.cardDraft')}</span><strong>{drafts}</strong></div>
        <div className={styles.card}><span>{t('list.cardReview')}</span><strong>{inReview}</strong></div>
        <div className={styles.card}><span>{t('list.cardApproved')}</span><strong>{approved}</strong></div>
      </section>
      <section className={styles.panel}>
        <div className={styles.panelHead}><h3>{t('list.history')}</h3><span>{t('list.count', { count: reports.length })}</span></div>
        {loading
          ? <div className={styles.empty}>{t('list.loading')}</div>
          : reports.length === 0
            ? <div className={styles.empty}><strong>{t('list.emptyTitle')}</strong><p>{t('list.emptyText')}</p></div>
            : <table className={styles.table}>
              <thead><tr><th>{t('list.colReport')}</th><th>{t('list.colProject')}</th><th>{t('list.colDate')}</th><th>{t('list.colStatus')}</th><th>{t('list.colCreated')}</th></tr></thead>
              <tbody>{reports.map((r) => <tr key={r.id}>
                <td><Link className={styles.reportLink} href={`/fieldop/reports/daily/${r.id}`}>DR-{String(r.report_number || 0).padStart(4, '0')}</Link></td>
                <td>{[r.projects?.code, r.projects?.name].filter(Boolean).join(' · ') || '—'}</td>
                <td>{reportDate(r.report_date)}</td>
                <td><span className={styles.badge}>{t(`status.${r.status || 'draft'}`)}</span></td>
                <td>{r.created_at ? dateTimeFormat.format(new Date(r.created_at)) : '—'}</td>
              </tr>)}</tbody>
            </table>}
      </section>
    </div>
  </main>
}
