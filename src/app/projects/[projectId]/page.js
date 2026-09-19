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

      if (queryError) {
        setError(queryError.message || 'Unable to load this project.')
      } else if (!data) {
        setError('Project not found or you do not have access to it.')
      } else {
        setProject(data)
      }

      setLoading(false)
    }

    loadProject()
    return () => { active = false }
  }, [projectId])

  return (
    <main style={{ minHeight: '100vh', background: '#f3f7f9', color: '#082f43' }}>
      <header style={{ height: 82, background: '#062f43', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 28, color: '#fff' }}>
        <Link href="/workspaces" style={{ display: 'flex', alignItems: 'center', paddingRight: 28, borderRight: '1px solid rgba(255,255,255,.18)' }}>
          <Image src="/logo-white.png" alt="RitsuFlow" width={150} height={55} priority />
        </Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 24, fontWeight: 800 }}>Project</div>
          <div style={{ fontSize: 12, opacity: .78 }}>Shared project record</div>
        </div>
        <Link href="/projects" style={navButton}>← Return to Projects</Link>
        <Link href="/precon" style={{ ...navButton, background: '#2f86ee', borderColor: '#2f86ee' }}>Go to PreCon</Link>
        <Link href="/fieldop" style={{ ...navButton, background: '#12a85d', borderColor: '#12a85d' }}>Go to FieldOp</Link>
      </header>

      <section style={{ maxWidth: 1500, margin: '0 auto', padding: '28px' }}>
        {loading && <div style={panel}><h2 style={{ margin: 0 }}>Loading project...</h2></div>}

        {!loading && error && (
          <div style={panel}>
            <h2 style={{ marginTop: 0 }}>Unable to open project</h2>
            <p>{error}</p>
            <Link href="/projects" style={{ color: '#087f8c', fontWeight: 700 }}>Return to Projects →</Link>
          </div>
        )}

        {!loading && project && (
          <>
            <div style={{ ...panel, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 24 }}>
              <div>
                <div style={{ color: '#08a69b', fontSize: 13, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase' }}>Project Overview</div>
                <h1 style={{ margin: '8px 0 4px', fontSize: 36 }}>{project.name}</h1>
                <div style={{ color: '#607784' }}>{project.client_name || 'Client not defined'}</div>
              </div>
              <div style={{ padding: '8px 14px', borderRadius: 999, background: '#e2f7ee', color: '#087747', fontWeight: 800, textTransform: 'capitalize' }}>{project.status || 'planning'}</div>
            </div>

            <div style={grid}>
              <Info title="Project Information">
                <Row label="Project ID" value={project.id} />
                <Row label="Project Code" value={project.code} />
                <Row label="Contract Number" value={project.contract_number} />
                <Row label="Client" value={project.client_name} />
              </Info>

              <Info title="Project Address">
                <Row label="Address" value={project.address_line} />
                <Row label="Neighborhood" value={project.neighborhood} />
                <Row label="City" value={project.city} />
                <Row label="State" value={project.state_region} />
                <Row label="ZIP Code" value={project.postal_code} />
                <Row label="Country" value={project.country_code} />
              </Info>

              <Info title="Contract & Financials">
                <Row label="Contract Value" value={money(project.contract_value, project.currency_code || 'BRL')} />
                <Row label="Currency" value={project.currency_code} />
              </Info>

              <Info title="Schedule">
                <Row label="Planned Start" value={project.planned_start_date} />
                <Row label="Planned Finish" value={project.planned_finish_date} />
              </Info>
            </div>

            <div style={{ ...panel, marginTop: 18 }}>
              <h2 style={{ margin: '0 0 8px' }}>One Project. One Source of Truth.</h2>
              <p style={{ margin: 0, color: '#607784', lineHeight: 1.6 }}>This is the shared project record used by Projects, PreCon and FieldOp. Module-specific planning and field data should reference this Project ID rather than create duplicate projects.</p>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

function Info({ title, children }) {
  return <section style={panel}><h2 style={{ margin: '0 0 18px', fontSize: 20 }}>{title}</h2>{children}</section>
}

function Row({ label, value }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '145px 1fr', gap: 18, padding: '10px 0', borderBottom: '1px solid #e5edf1' }}><span style={{ color: '#718691', fontSize: 13 }}>{label}</span><strong style={{ overflowWrap: 'anywhere' }}>{value || '—'}</strong></div>
}

const navButton = { color: '#fff', textDecoration: 'none', border: '1px solid rgba(255,255,255,.22)', borderRadius: 9, padding: '11px 15px', fontWeight: 800, fontSize: 13 }
const panel = { background: '#fff', border: '1px solid #d7e2e7', borderRadius: 14, padding: 24, boxShadow: '0 2px 8px rgba(7,47,67,.03)' }
const grid = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, marginTop: 18 }
