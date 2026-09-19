'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

const money = (value, currency = 'BRL') => {
  if (value === null || value === undefined || value === '') return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(value) || 0)
  } catch {
    return String(value)
  }
}

const dateValue = (value) => {
  if (!value) return '—'
  const raw = String(value).slice(0, 10)
  const [year, month, day] = raw.split('-')
  return year && month && day ? `${day}/${month}/${year}` : String(value)
}

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params?.projectId
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!projectId) return
    let active = true

    async function loadProject() {
      setLoading(true)
      setError('')
      const { data, error: queryError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .maybeSingle()

      if (!active) return
      if (queryError) setError(queryError.message || 'Unable to load this project.')
      else if (!data) setError('Project not found or you do not have access to it.')
      else setProject(data)
      setLoading(false)
    }

    loadProject()
    return () => { active = false }
  }, [projectId])

  return (
    <main style={shell}>
      <header style={header}>
        <Link href="/workspaces" style={brand}>
          <Image src="/logo-white.png" alt="RitsuFlow" width={138} height={50} priority />
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Project</div>
          <div style={{ fontSize: 11, opacity: .76 }}>Shared project record</div>
        </div>
        <Link href="/projects" style={navButton}>← Return to Projects</Link>
        <Link href="/precon" style={{ ...navButton, background: '#2f86ee', borderColor: '#2f86ee' }}>Go to PreCon</Link>
        <Link href="/fieldop" style={{ ...navButton, background: '#12a85d', borderColor: '#12a85d' }}>Go to FieldOp</Link>
      </header>

      <section style={content}>
        {loading && <div style={panel}><strong>Loading project...</strong></div>}

        {!loading && error && (
          <div style={panel}>
            <h2 style={{ marginTop: 0 }}>Unable to open project</h2>
            <p>{error}</p>
            <Link href="/projects" style={{ color: '#087f8c', fontWeight: 700 }}>Return to Projects →</Link>
          </div>
        )}

        {!loading && project && (
          <>
            <section style={overview}>
              <div style={{ minWidth: 0 }}>
                <div style={eyebrow}>Project Overview</div>
                <div style={identityLine}>
                  <h1 style={projectName}>{project.name || 'Untitled Project'}</h1>
                  <span style={identityDot}>•</span>
                  <strong style={projectNumber}>{project.project_id || 'Project ID pending'}</strong>
                  <span style={identityDot}>•</span>
                  <span>{project.client_name || 'Client not defined'}</span>
                  <span style={identityDot}>•</span>
                  <span>{[project.city, project.state_region].filter(Boolean).join(', ') || 'Location not defined'}</span>
                </div>
              </div>
              <span style={statusPill}>{project.status || 'planning'}</span>
            </section>

            <div style={grid}>
              <Info title="Project Information">
                <Row label="Project ID" value={project.project_id} />
                <Row label="Project Code" value={project.code} />
                <Row label="Contract No." value={project.contract_number} />
                <Row label="Client" value={project.client_name} />
              </Info>

              <Info title="Project Address">
                <Row label="Address" value={[project.address_line, project.address_number].filter(Boolean).join(', ')} />
                <Row label="Neighborhood" value={project.neighborhood} />
                <Row label="City / State" value={[project.city, project.state_region].filter(Boolean).join(', ')} />
                <Row label="ZIP / Country" value={[project.postal_code, project.country_code].filter(Boolean).join(' · ')} />
              </Info>

              <Info title="Contract & Financials">
                <Row label="Contract Value" value={money(project.contract_value, project.currency_code || 'BRL')} />
                <Row label="Material Value" value={project.material_included ? money(project.material_value, project.currency_code || 'BRL') : 'Not included'} />
                <Row label="Retainage" value={project.has_retainage ? `${project.retainage_percent ?? '—'}% · ${money(project.retainage_value, project.currency_code || 'BRL')}` : 'No'} />
                <Row label="Payment" value={project.has_retainage ? `${project.retainage_payment_days ?? '—'} days · ${dateValue(project.probable_retainage_payment_date)}` : '—'} />
              </Info>

              <Info title="Schedule">
                <Row label="Planned Start" value={dateValue(project.planned_start_date)} />
                <Row label="Contractual Term" value={project.contractual_term_days ? `${project.contractual_term_days} days` : '—'} />
                <Row label="Planned End" value={dateValue(project.planned_finish_date)} />
                <Row label="Status" value={project.status} />
              </Info>
            </div>

            <section style={successPanel}>
              <div>
                <div style={successTitle}>Success Criteria</div>
                <div style={successText}>{project.success_criteria || 'Success criteria not defined yet.'}</div>
              </div>
              <div style={sourceTruth}>One Project · One Source of Truth</div>
            </section>
          </>
        )}
      </section>
    </main>
  )
}

function Info({ title, children }) {
  return <section style={panel}><h2 style={cardTitle}>{title}</h2>{children}</section>
}

function Row({ label, value }) {
  const display = value === null || value === undefined || value === '' ? '—' : value
  return (
    <div style={row}>
      <span style={rowLabel}>{label}</span>
      <strong style={rowValue}>{display}</strong>
    </div>
  )
}

const shell = { minHeight: '100vh', background: '#f3f7f9', color: '#082f43' }
const header = { height: 72, background: '#062f43', display: 'flex', alignItems: 'center', padding: '0 22px', gap: 14, color: '#fff' }
const brand = { display: 'flex', alignItems: 'center', paddingRight: 20, marginRight: 4, borderRight: '1px solid rgba(255,255,255,.18)' }
const content = { width: '100%', maxWidth: 1760, margin: '0 auto', padding: '18px 22px' }
const navButton = { color: '#fff', textDecoration: 'none', border: '1px solid rgba(255,255,255,.22)', borderRadius: 9, padding: '10px 14px', fontWeight: 800, fontSize: 13, whiteSpace: 'nowrap' }
const panel = { background: '#fff', border: '1px solid #d7e2e7', borderRadius: 12, padding: '16px 18px', boxShadow: '0 2px 8px rgba(7,47,67,.025)', minWidth: 0 }
const overview = { ...panel, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18, padding: '14px 18px' }
const eyebrow = { color: '#08a69b', fontSize: 11, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 5 }
const identityLine = { display: 'flex', alignItems: 'baseline', gap: 9, flexWrap: 'wrap', color: '#607784', fontSize: 13 }
const projectName = { margin: 0, fontSize: 26, lineHeight: 1.1, color: '#082f43' }
const projectNumber = { color: '#087f8c', fontSize: 13 }
const identityDot = { color: '#a7b7bf' }
const statusPill = { padding: '7px 13px', borderRadius: 999, background: '#e2f7ee', color: '#087747', fontWeight: 800, textTransform: 'capitalize', whiteSpace: 'nowrap' }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 12 }
const cardTitle = { margin: '0 0 8px', fontSize: 17, lineHeight: 1.2 }
const row = { display: 'grid', gridTemplateColumns: '105px minmax(0, 1fr)', gap: 10, alignItems: 'center', minHeight: 34, padding: '5px 0', borderBottom: '1px solid #e5edf1' }
const rowLabel = { color: '#718691', fontSize: 11.5, lineHeight: 1.25 }
const rowValue = { fontSize: 12.5, lineHeight: 1.25, overflowWrap: 'anywhere' }
const successPanel = { ...panel, marginTop: 12, padding: '13px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20 }
const successTitle = { fontSize: 14, fontWeight: 800, marginBottom: 3 }
const successText = { color: '#607784', fontSize: 12.5, lineHeight: 1.35 }
const sourceTruth = { color: '#087f8c', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }
