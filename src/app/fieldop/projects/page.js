'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { useT } from '../../../lib/i18n/useT'
import { useLanguage } from '../../../lib/i18n/LanguageProvider'
import { FieldOpShell, Panel, Badge, Empty, Notice, ui } from '../ui'

const STATUSES = ['planning', 'active', 'on_hold', 'completed', 'archived']
const STATUS_TONE = { active: 'ok', planning: 'info', on_hold: 'warn' }

/** Which of the four FieldOp setup parts each project has: activities, locations, workforce, report settings. */
async function loadSetupProgress(projectIds) {
  const progress = new Map(projectIds.map((id) => [id, new Set()]))
  if (!projectIds.length) return progress
  const [activities, locations, assignments, manualWorkers, settings] = await Promise.all([
    supabase.from('fieldop_project_activities').select('project_id').in('project_id', projectIds).eq('is_active', true),
    supabase.from('fieldop_project_locations').select('project_id').in('project_id', projectIds).eq('is_active', true),
    supabase.from('field_project_assignments').select('project_id').in('project_id', projectIds).eq('status', 'active'),
    supabase.from('fieldop_manual_workers').select('project_id').in('project_id', projectIds).eq('status', 'active'),
    supabase.from('fieldop_daily_report_settings').select('project_id').in('project_id', projectIds),
  ])
  const mark = (result, part) => (result.data || []).forEach((row) => progress.get(row.project_id)?.add(part))
  mark(activities, 'activities')
  mark(locations, 'locations')
  mark(assignments, 'workforce')
  mark(manualWorkers, 'workforce')
  mark(settings, 'settings')
  return progress
}

export default function FieldOpProjectsPage() {
  const t = useT('fieldopSetup')
  const tf = useT('fieldop')
  const { language } = useLanguage()
  const [projects, setProjects] = useState([])
  const [setup, setSetup] = useState(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      const { data, error: loadError } = await supabase.from('projects').select('*').order('created_at', { ascending: true })
      if (!active) return
      if (loadError) { setError(loadError.message); setProjects([]); setLoading(false); return }
      setError('')
      setProjects(data || [])
      const progress = await loadSetupProgress((data || []).map((project) => project.id))
      if (!active) return
      setSetup(progress)
      setLoading(false)
    }
    load()
    return () => { active = false }
  }, [])

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase()
    return projects.filter((project) => {
      if (statusFilter && project.status !== statusFilter) return false
      if (!query) return true
      return [project.project_id, project.name, project.code, project.client_name, project.city, project.state_region, project.status ? tf(`status.${project.status}`) : '']
        .filter(Boolean).join(' ').toLowerCase().includes(query)
    })
  }, [projects, search, statusFilter, tf])

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'short' }), [language])
  const date = (value) => {
    if (!value) return '—'
    const parsed = new Date(`${String(value).slice(0, 10)}T12:00:00`)
    return Number.isNaN(parsed.getTime()) ? '—' : dateFormat.format(parsed)
  }
  const money = (value, currency) => {
    try {
      return new Intl.NumberFormat(language, { style: 'currency', currency: currency || 'BRL' }).format(Number(value || 0))
    } catch {
      return `${currency || ''} ${Number(value || 0).toFixed(2)}`
    }
  }

  // Setup progress: four parts (activities, locations, workforce, report settings).
  function setupCell(projectId) {
    const done = setup.get(projectId)?.size || 0
    return <span style={{ display: 'grid', gap: 6, minWidth: 120 }}>
      <span style={{ fontSize: 14, color: done === 4 ? 'var(--fo-ok)' : 'var(--fo-muted)', fontWeight: done === 4 ? 600 : 400 }}>{done === 4 ? t('list.setupReady') : done > 0 ? t('list.setupPartial', { done }) : t('list.setupNone')}</span>
      <span className={ui.stack} style={{ height: 6 }}>{[0, 1, 2, 3].map((i) => <i key={i} style={{ flex: 1, background: i < done ? 'var(--fo-teal-ink)' : 'var(--fo-line-soft)' }} />)}</span>
    </span>
  }

  return <FieldOpShell active="projects">
    <Notice>{error && t('list.error', { error })}</Notice>
    <Panel body={false} title={t('list.showing', { shown: visibleProjects.length, total: projects.length })}
      actions={<>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('list.search')} aria-label={t('list.search')} style={{ width: 220 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label={t('list.colStatus')} style={{ width: 180 }}>
          <option value="">{t('list.allStatuses')}</option>
          {STATUSES.map((status) => <option key={status} value={status}>{tf(`status.${status}`)}</option>)}
        </select>
      </>}>
      {loading ? <Empty title={t('list.loading')} />
        : visibleProjects.length === 0 ? <Empty title={t('list.empty')} />
          : <div className={ui.tableWrap}><table className={`${ui.table} ${ui.cards}`}>
            <thead><tr><th>{t('list.colProject')}</th><th>{t('list.colClient')}</th><th>{t('list.colLocation')}</th><th>{t('list.colEnd')}</th><th>{t('list.colValue')}</th><th>{t('list.colStatus')}</th><th>{t('list.colSetup')}</th><th /></tr></thead>
            <tbody>{visibleProjects.map((project) => {
              const location = [project.city, project.state_region].filter(Boolean).join(', ') || '—'
              const status = project.status || 'planning'
              const configured = (setup.get(project.id)?.size || 0) > 0
              return <tr key={project.id}>
                <td data-label=""><span><Link className={ui.rowLink} href={`/fieldop/projects/${project.id}`}>{project.name || tf('projects.untitled')}</Link><span className={ui.sub}>{[project.project_id, project.code].filter(Boolean).join(' · ') || '—'}</span></span></td>
                <td data-label={t('list.colClient')}>{project.client_name || '—'}</td>
                <td data-label={t('list.colLocation')}>{location}</td>
                <td data-label={t('list.colEnd')}><span>{date(project.planned_finish_date)}<span className={ui.sub}>{t('list.colStart')}: {date(project.planned_start_date)}</span></span></td>
                <td data-label={t('list.colValue')} style={{ whiteSpace: 'nowrap' }}>{money(project.contract_value, project.currency_code)}</td>
                <td data-label={t('list.colStatus')}><Badge tone={STATUS_TONE[status]}>{tf(`status.${status}`)}</Badge></td>
                <td data-label={t('list.colSetup')}>{setupCell(project.id)}</td>
                <td data-label=""><Link className={`${configured ? ui.btn : ui.btnPrimary} ${ui.small}`} href={`/fieldop/projects/${project.id}`}>{configured ? t('list.open') : t('list.configure')}</Link></td>
              </tr>
            })}</tbody>
          </table></div>}
    </Panel>
  </FieldOpShell>
}
