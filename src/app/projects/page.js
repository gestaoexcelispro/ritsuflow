'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useT } from '../../lib/i18n/useT'
import { useLanguage } from '../../lib/i18n/LanguageProvider'
import { AppShell, Panel, Stats, Stat, Badge, Empty, Notice, ui } from '../fieldop/ui'

const STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived']
const TONE = { active: 'ok', planning: 'info', on_hold: 'warn' }

export default function ProjectsPage() {
  const t = useT('projects')
  const { language } = useLanguage()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [client, setClient] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data, error: loadError } = await supabase.from('projects').select('*').eq('stage', 'contract').order('created_at', { ascending: true })
      if (!active) return
      if (loadError) { setError(loadError.message); setProjects([]) } else { setError(''); setProjects(data || []) }
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'medium' }), [language])
  const date = (value) => {
    if (!value) return '—'
    const d = new Date(`${String(value).slice(0, 10)}T12:00:00`)
    return Number.isNaN(d.getTime()) ? '—' : dateFormat.format(d)
  }
  const money = (value, currency) => {
    try { return new Intl.NumberFormat(language, { style: 'currency', currency: currency || 'BRL', maximumFractionDigits: 0 }).format(Number(value || 0)) }
    catch { return `${currency || ''} ${Number(value || 0).toFixed(0)}` }
  }
  const statusOf = (p) => (STATUSES.includes(p.status) ? p.status : 'planning')
  const clientOf = (p) => p.client_name || p.client || ''

  const clients = useMemo(() => [...new Set(projects.map(clientOf).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [projects])
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => {
      if (status && statusOf(p) !== status) return false
      if (client && clientOf(p) !== client) return false
      if (!q) return true
      return [p.project_id, p.name, p.code, clientOf(p), p.city, p.state_region].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [projects, search, status, client])
  const count = (s) => projects.filter((p) => statusOf(p) === s).length

  return <AppShell module="projects" active="all">
    <Stats>
      <Stat label={t('list.statTotal')} value={projects.length} />
      <Stat label={t('status.active')} value={count('active')} tone="ok" />
      <Stat label={t('status.planning')} value={count('planning')} />
      <Stat label={t('status.on_hold')} value={count('on_hold')} tone={count('on_hold') ? 'warn' : undefined} />
    </Stats>
    <Notice>{error && t('list.error', { error })}</Notice>
    <Panel body={false} title={t('list.showing', { shown: shown.length, total: projects.length })}
      actions={<>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('list.search')} aria-label={t('list.search')} style={{ width: 240 }} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('list.colStatus')} style={{ width: 170 }}>
          <option value="">{t('list.allStatuses')}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        {clients.length > 1 && <select value={client} onChange={(e) => setClient(e.target.value)} aria-label={t('list.colClient')} style={{ width: 190 }}>
          <option value="">{t('list.allClients')}</option>
          {clients.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>}
      </>}>
      {loading ? <Empty title={t('list.loading')} />
        : projects.length === 0 ? <Empty title={t('list.emptyTitle')} text={t('list.emptyText')} action={<Link className={ui.btnPrimary} href="/projects/new">{t('list.newProject')}</Link>} />
          : shown.length === 0 ? <Empty title={t('list.noMatch')} />
            : <div className={ui.tableWrap}><table className={`${ui.table} ${ui.cards}`}>
              <thead><tr><th>{t('list.colProject')}</th><th>{t('list.colClient')}</th><th>{t('list.colLocation')}</th><th>{t('list.colDates')}</th><th>{t('list.colValue')}</th><th>{t('list.colStatus')}</th><th>{t('list.colUpdated')}</th><th /></tr></thead>
              <tbody>{shown.map((p) => <tr key={p.id}>
                <td data-label=""><span><Link className={ui.rowLink} href={`/projects/${p.id}`}>{p.name || t('list.untitled')}</Link><span className={ui.sub}>{[p.project_id, p.code].filter(Boolean).join(' · ') || '—'}</span></span></td>
                <td data-label={t('list.colClient')}>{clientOf(p) || '—'}</td>
                <td data-label={t('list.colLocation')}>{[p.city, p.state_region].filter(Boolean).join(', ') || '—'}</td>
                <td data-label={t('list.colDates')} style={{ whiteSpace: 'nowrap' }}>{date(p.planned_start_date || p.start_date)} → {date(p.planned_finish_date || p.planned_end_date || p.end_date)}</td>
                <td data-label={t('list.colValue')} style={{ whiteSpace: 'nowrap' }}>{money(p.contract_value, p.currency_code)}</td>
                <td data-label={t('list.colStatus')}><Badge tone={TONE[statusOf(p)]}>{t(`status.${statusOf(p)}`)}</Badge></td>
                <td data-label={t('list.colUpdated')}>{p.updated_at ? date(p.updated_at) : '—'}</td>
                <td data-label="" style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <Link className={`${ui.btn} ${ui.small}`} href={`/projects/${p.id}`}>{t('list.open')}</Link>{' '}
                  <Link className={`${ui.btn} ${ui.small}`} href={`/projects/${p.id}/scope`}>{t('list.scope')}</Link>
                </td>
              </tr>)}</tbody>
            </table></div>}
    </Panel>
  </AppShell>
}
