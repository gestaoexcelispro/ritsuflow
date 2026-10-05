'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../../lib/supabase'
import { useT } from '../../../../../lib/i18n/useT'
import { useLanguage } from '../../../../../lib/i18n/LanguageProvider'
import { FieldOpSidebar, FieldOpUser } from '../../../FieldOpChrome'
import styles from '../setup.module.css'

// Same look as the setup page tabs (which are buttons there; links here).
const tabLink = { padding: '10px 16px', borderRadius: 7, fontWeight: 700, textDecoration: 'none' }

const TABS = [
  { key: 'live', path: '' },
  { key: 'timecards', path: '/timecards' },
  { key: 'exceptions', path: '/exceptions' },
  { key: 'audit', path: '/audit' },
]

/** FieldOp frame for the four Workforce screens: sidebar, breadcrumb, user and the screen tabs. */
export default function WorkforceFrame({ projectId, active, children }) {
  const t = useT('fieldopWorkforce')
  const [projectName, setProjectName] = useState('')

  useEffect(() => {
    let alive = true
    if (!projectId) return undefined
    supabase.from('projects').select('name,code').eq('id', projectId).maybeSingle().then(({ data }) => {
      if (alive) setProjectName(data?.name || data?.code || '')
    })
    return () => { alive = false }
  }, [projectId])

  return <main className={styles.shell}>
    <FieldOpSidebar styles={styles} active="workforce" projectId={projectId} />
    <section className={styles.main}>
      <header className={styles.topbar}>
        <div>
          <div className={styles.crumb}><Link href={`/fieldop/projects/${projectId}`}>{projectName || '…'}</Link><span>/</span>{t('frame.workforce')}</div>
          <strong>{t(`tab.${active}`)}</strong>
        </div>
        <FieldOpUser styles={styles} />
      </header>
      <div className={styles.content}>
        <div className={styles.tabs} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
          {TABS.map((tab) => <Link key={tab.key} href={`/fieldop/projects/${projectId}/workforce${tab.path}`} className={active === tab.key ? styles.tabActive : ''} style={{ ...tabLink, ...(active === tab.key ? {} : { color: '#526b79' }) }}>{t(`tab.${tab.key}`)}</Link>)}
          <Link href={`/fieldop/projects/${projectId}`} style={{ ...tabLink, marginLeft: 'auto', color: '#526b79' }}>{t('frame.backToSetup')}</Link>
        </div>
        <div style={{ display: 'grid', gap: 18, marginTop: 14 }}>{children}</div>
      </div>
    </section>
  </main>
}

/** Formatting and label helpers shared by the Workforce screens, in the chosen language. */
export function useWorkforceFormat() {
  const t = useT('fieldopWorkforce')
  const { language } = useLanguage()
  return useMemo(() => {
    const timeFormat = new Intl.DateTimeFormat(language, { hour: '2-digit', minute: '2-digit' })
    const dateFormat = new Intl.DateTimeFormat(language, { dateStyle: 'short' })
    const dateTimeFormat = new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' })
    const label = (prefix, value, fallback = '—') => {
      if (!value) return fallback
      const key = `${prefix}.${value}`
      const text = t(key)
      return text === key ? String(value).replaceAll('_', ' ') : text
    }
    return {
      t,
      time: (value) => (value ? timeFormat.format(new Date(value)) : '—'),
      date: (value) => (value ? dateFormat.format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : '—'),
      dateTime: (value) => (value ? dateTimeFormat.format(new Date(value)) : '—'),
      minutes: (value) => {
        const number = Number(value)
        if (value === null || value === undefined || !Number.isFinite(number)) return '—'
        const total = Math.max(0, Math.floor(number))
        return `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`
      },
      workerName: (worker) => (worker ? [worker.first_name, worker.middle_name, worker.last_name].filter(Boolean).join(' ').trim() || t('common.unnamedWorker') : t('common.unknownWorker')),
      label,
    }
  }, [t, language])
}

export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
