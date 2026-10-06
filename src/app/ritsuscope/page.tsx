'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import RitsuScopeShell from './RitsuScopeShell'
import { createClient } from '@/lib/supabase/client'
import { useTakeoffT } from '@/lib/i18n/useTakeoffT'
import { ui } from './ui'

type Project = { id: string; project_code: string | null; name: string; stage?: string | null }
type Counted = { project_id: string }

function countBy(rows: Counted[] | null) {
  const map = new Map<string, number>()
  for (const row of rows || []) map.set(row.project_id, (map.get(row.project_id) || 0) + 1)
  return map
}

export default function TakeoffListPage() {
  const t = useTakeoffT()
  const [projects, setProjects] = useState<Project[]>([])
  const [sources, setSources] = useState<Map<string, number>>(new Map())
  const [layers, setLayers] = useState<Map<string, number>>(new Map())
  const [elements, setElements] = useState<Map<string, number>>(new Map())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const [p, s, l, e] = await Promise.all([
        supabase.from('projects').select('id, project_code:code, name, stage').neq('status', 'archived').order('name'),
        supabase.from('takeoff_sources').select('project_id'),
        supabase.from('takeoff_layers').select('project_id'),
        supabase.from('takeoff_elements').select('project_id'),
      ])
      if (cancelled) return
      const failure = p.error || s.error || l.error || e.error
      if (failure) setError(`${t('list.error')} ${failure.message}`)
      else {
        setProjects((p.data || []) as Project[])
        setSources(countBy(s.data as Counted[]))
        setLayers(countBy(l.data as Counted[]))
        setElements(countBy(e.data as Counted[]))
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [t])

  const rows = useMemo(() => projects.map(project => ({
    ...project,
    sources: sources.get(project.id) || 0,
    layers: layers.get(project.id) || 0,
    elements: elements.get(project.id) || 0,
  })), [projects, sources, layers, elements])

  return (
    <RitsuScopeShell>
      <section style={ui.page}>
        <header style={ui.header}>
          <div style={ui.eyebrow}>{t('list.eyebrow')}</div>
          <h1 style={ui.title}>{t('list.title')}</h1>
          <p style={ui.subtitle}>{t('list.subtitle')}</p>
        </header>

        {error && <div style={ui.error}>{error}</div>}

        {loading ? (
          <div style={ui.muted}>{t('list.loading')}</div>
        ) : rows.length === 0 && !error ? (
          <div style={ui.empty}>{t('list.empty')}</div>
        ) : (
          <div style={ui.table}>
            <div style={{ ...ui.row, ...ui.tableHead }}>
              <span>{t('list.col.project')}</span>
              <span>{t('list.col.sources')}</span>
              <span>{t('list.col.layers')}</span>
              <span>{t('list.col.elements')}</span>
              <span />
            </div>
            {rows.map(row => (
              <div key={row.id} style={ui.row}>
                <div>
                  <strong>{row.name}</strong>
                  {row.project_code && <small style={ui.code}>{row.project_code}</small>}
                  {row.stage === 'bid' && <small style={{ ...ui.code, background: '#fff4e8', color: '#8a4413' }}>{t('list.bid')}</small>}
                </div>
                <span>{row.sources}</span>
                <span>{row.layers}</span>
                <span>{row.elements}</span>
                <Link href={`/ritsuscope/${row.id}`} style={ui.linkButton}>{t('list.open')}</Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </RitsuScopeShell>
  )
}
