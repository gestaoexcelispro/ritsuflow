'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { useT } from '../../../../lib/i18n/useT'
import { useLanguage } from '../../../../lib/i18n/LanguageProvider'
import { AppShell, PageHeader, Panel, Stats, Stat, Badge, Empty, Notice, Segments, ui } from '../../../fieldop/ui'
import styles from './history.module.css'

// Which area of the project an audited action belongs to (from the entity type).
const MODULES = ['scope', 'documents', 'team', 'schedule', 'financials', 'settings', 'reports', 'general']
function moduleOf(entityType) {
  const x = String(entityType || 'general').toLowerCase()
  if (x.includes('scope')) return 'scope'
  if (x.includes('document')) return 'documents'
  if (x.includes('team') || x.includes('member')) return 'team'
  if (x.includes('schedule') || x.includes('planning')) return 'schedule'
  if (x.includes('financial') || x.includes('contract')) return 'financials'
  if (x.includes('setting') || x.includes('project')) return 'settings'
  if (x.includes('report')) return 'reports'
  return 'general'
}
function actionOf(value) {
  const x = String(value || '').toLowerCase()
  if (x.includes('delete') || x.includes('remove')) return 'deleted'
  if (x.includes('add') || x.includes('create') || x.includes('upload') || x.includes('invite')) return 'added'
  if (x.includes('generate')) return 'generated'
  return 'updated'
}
const ACTION_TONE = { added: 'ok', deleted: 'bad', generated: 'info' }
function detail(item) {
  const changes = item?.metadata?.changes
  if (changes && typeof changes === 'object') {
    const first = Object.entries(changes)[0]
    if (first) {
      const [key, value] = first
      if (value && typeof value === 'object' && ('from' in value || 'to' in value)) return `${key}: ${value.from ?? '—'} → ${value.to ?? '—'}`
      return `${key}: ${String(value ?? '—')}`
    }
  }
  return item.description || '—'
}

export default function ProjectHistoryLog() {
  const { projectId } = useParams()
  const t = useT('projects')
  const { language } = useLanguage()
  const [project, setProject] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!projectId) return undefined
    let active = true
    ;(async () => {
      setLoading(true)
      const [p, h] = await Promise.all([
        supabase.from('projects').select('id,name,project_id,client_name').eq('id', projectId).maybeSingle(),
        supabase.from('project_history').select('*').eq('project_id', projectId).order('created_at', { ascending: false }),
      ])
      if (!active) return
      if (p.error || h.error) setError(p.error?.message || h.error?.message)
      else { setProject(p.data); setItems(h.data || []) }
      setLoading(false)
    })()
    return () => { active = false }
  }, [projectId])

  const when = useMemo(() => new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeStyle: 'short' }), [language])
  const counts = useMemo(() => items.reduce((acc, i) => { const m = moduleOf(i.entity_type); acc[m] = (acc[m] || 0) + 1; return acc }, {}), [items])
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items.filter((i) => (filter === 'all' || moduleOf(i.entity_type) === filter)
      && (!q || [i.action_label, i.description, i.performed_by_name, i.entity_type, detail(i)].join(' ').toLowerCase().includes(q)))
  }, [items, filter, search])

  const printButton = <button type="button" className={ui.btnPrimary} onClick={() => window.print()}>{t('history.print')}</button>

  return <AppShell module="projects" active="history" projectId={projectId} action={printButton}>
    <div className={styles.printHead}>
      <div><h1>{t('history.title')}</h1><p>{[project?.project_id, project?.name, project?.client_name].filter(Boolean).join(' · ')}</p></div>
      <p>{t('history.generated', { date: when.format(new Date()) })}</p>
    </div>
    <div className={styles.noPrint}>
      <PageHeader title={t('history.title')} subtitle={[project?.project_id, project?.name].filter(Boolean).join(' · ')} />
    </div>
    <Notice>{error}</Notice>
    <div className={styles.noPrint}>
      <Stats>
        <Stat label={t('history.total')} value={items.length} />
        {['scope', 'documents', 'team', 'settings'].map((m) => <Stat key={m} label={t(`history.module.${m}`)} value={counts[m] || 0} />)}
      </Stats>
    </div>
    <Panel body={false} title={t('history.showing', { shown: rows.length, total: items.length })}
      actions={<span className={styles.noPrint} style={{ display: 'flex', gap: 8 }}><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('history.search')} aria-label={t('history.search')} style={{ width: 240 }} /></span>}>
      <div className={styles.noPrint} style={{ padding: '12px 20px', borderBottom: '1px solid var(--fo-line-soft)', overflowX: 'auto' }}>
        <Segments value={filter} onChange={setFilter} items={['all', ...MODULES].map((m) => ({ value: m, label: m === 'all' ? t('history.all') : `${t(`history.module.${m}`)}${counts[m] ? ` · ${counts[m]}` : ''}` }))} />
      </div>
      {loading ? <Empty title={t('history.loading')} />
        : rows.length === 0 ? <Empty title={items.length ? t('history.noMatch') : t('history.empty')} />
          : <div className={ui.tableWrap}><table className={`${ui.table} ${ui.cards} ${styles.printTable}`}>
            <thead><tr><th>{t('history.colWhen')}</th><th>{t('history.colUser')}</th><th>{t('history.colModule')}</th><th>{t('history.colAction')}</th><th>{t('history.colDescription')}</th><th>{t('history.colDetails')}</th></tr></thead>
            <tbody>{rows.map((i) => {
              const action = actionOf(i.action_type || i.action_label)
              return <tr key={i.id}>
                <td data-label="" style={{ whiteSpace: 'nowrap' }}><strong>{i.action_label || t('history.activity')}</strong><span className={ui.sub}>{when.format(new Date(i.created_at))}</span></td>
                <td data-label={t('history.colUser')}>{i.performed_by_name || 'RitsuFlow'}</td>
                <td data-label={t('history.colModule')}><span className={styles.module}>{t(`history.module.${moduleOf(i.entity_type)}`)}</span></td>
                <td data-label={t('history.colAction')}><Badge tone={ACTION_TONE[action]}>{t(`history.action.${action}`)}</Badge></td>
                <td data-label={t('history.colDescription')}>{i.description || '—'}</td>
                <td data-label={t('history.colDetails')} style={{ wordBreak: 'break-word' }}>{detail(i)}</td>
              </tr>
            })}</tbody>
          </table></div>}
    </Panel>
  </AppShell>
}
