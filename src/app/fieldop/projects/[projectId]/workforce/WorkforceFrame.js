'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../../lib/supabase'
import { useT } from '../../../../../lib/i18n/useT'
import { useLanguage } from '../../../../../lib/i18n/LanguageProvider'
import { FieldOpShell, PageHeader } from '../../../ui'
import styles from '../setup.module.css'


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

  return <FieldOpShell active="workforce" projectId={projectId}>
    <PageHeader back={{ href: `/fieldop/projects/${projectId}`, label: projectName || t('frame.backToSetup') }} title={t(`tab.${active}`)} subtitle={projectName ? `${t('frame.workforce')} · ${projectName}` : t('frame.workforce')} />
    <nav className={styles.tabs} style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }} aria-label={t('frame.workforce')}>
      {TABS.map((tab) => <Link key={tab.key} href={`/fieldop/projects/${projectId}/workforce${tab.path}`} aria-current={active === tab.key ? 'page' : undefined} className={active === tab.key ? styles.tabActive : ''}>{t(`tab.${tab.key}`)}</Link>)}
    </nav>
    <div style={{ display: 'grid', gap: 18 }}>{children}</div>
  </FieldOpShell>
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
