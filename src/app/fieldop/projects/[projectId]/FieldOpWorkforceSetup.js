'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../../../lib/supabase'

function workerName(worker) {
  if (!worker) return '—'
  return [worker.first_name, worker.middle_name, worker.last_name].filter(Boolean).join(' ') || worker.field_id || '—'
}

function label(value) {
  if (!value) return '—'
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

export default function FieldOpWorkforceSetup({ projectId, onCountChange }) {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function loadAssignments() {
    if (!projectId) return
    setLoading(true)
    setError('')
    try {
      const { data, error: queryError } = await supabase
        .from('field_project_assignments')
        .select(`
          id, project_id, worker_id, start_date, end_date, status,
          field_workers:worker_id (id, field_id, first_name, middle_name, last_name, status),
          field_companies:company_id (id, name),
          field_trades:trade_id (id, name),
          field_roles:role_id (id, name),
          field_crews:crew_id (id, name)
        `)
        .eq('project_id', projectId)
        .in('status', ['active', 'scheduled'])
        .order('start_date', { ascending: true })

      if (queryError) throw queryError
      const rows = data || []
      setAssignments(rows)
      onCountChange?.(rows.filter((item) => item.status === 'active').length)
    } catch (err) {
      setAssignments([])
      onCountChange?.(0)
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAssignments() }, [projectId])

  const counts = useMemo(() => ({
    active: assignments.filter((item) => item.status === 'active').length,
    scheduled: assignments.filter((item) => item.status === 'scheduled').length,
    crews: new Set(assignments.map((item) => item.field_crews?.id).filter(Boolean)).size,
  }), [assignments])

  return <section style={{ marginTop: 12, minHeight: 430, background: '#fff', border: '1px solid #d6e0e5', borderRadius: 10, padding: 17 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 17 }}>Workforce</h2>
        <p style={{ margin: '5px 0', color: '#6b7e89' }}>Workers available to FieldOp come from the canonical Project Assignments registry.</p>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Link href="/dashboard/field-management/workforce" style={buttonStyle}>View Workforce Registry</Link>
        <Link href="/dashboard/field-management/workforce/assignments" style={primaryStyle}>Manage Project Assignments</Link>
      </div>
    </div>

    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(130px, 1fr))', gap: 10, marginTop: 18, maxWidth: 560 }}>
      <Metric label="Active Workers" value={counts.active} />
      <Metric label="Scheduled" value={counts.scheduled} />
      <Metric label="Crews" value={counts.crews} />
    </div>

    {error && <div style={{ marginTop: 18, border: '1px solid #f0c6c6', background: '#fff4f4', color: '#a43c3c', padding: '10px 12px', borderRadius: 7 }}>{error}</div>}

    {loading ? <div style={emptyStyle}>Loading project workforce...</div> : assignments.length === 0 ? <div style={emptyStyle}>
      <strong style={{ color: '#385365' }}>No workers are assigned to this project yet.</strong>
      <span>Use Project Assignments to connect registered field workers to this project. FieldOp will read those assignments automatically.</span>
      <Link href="/dashboard/field-management/workforce/assignments" style={{ ...primaryStyle, marginTop: 8 }}>Create Project Assignment</Link>
    </div> : <div style={{ marginTop: 18, border: '1px solid #dfe7eb', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ background: '#edf3f5', color: '#45606f', textAlign: 'left' }}><th style={th}>Worker</th><th style={th}>Company</th><th style={th}>Trade</th><th style={th}>Role</th><th style={th}>Crew</th><th style={th}>Status</th></tr></thead>
        <tbody>{assignments.map((item) => <tr key={item.id} style={{ borderTop: '1px solid #e3eaed' }}>
          <td style={td}><strong>{workerName(item.field_workers)}</strong><small style={{ display: 'block', color: '#7a8b95', marginTop: 2 }}>{item.field_workers?.field_id || '—'}</small></td>
          <td style={td}>{item.field_companies?.name || '—'}</td>
          <td style={td}>{item.field_trades?.name || '—'}</td>
          <td style={td}>{item.field_roles?.name || '—'}</td>
          <td style={td}>{item.field_crews?.name || '—'}</td>
          <td style={td}><span style={{ display: 'inline-block', borderRadius: 999, padding: '4px 8px', background: item.status === 'active' ? '#e6f8ef' : '#fff5dc', color: item.status === 'active' ? '#147a50' : '#9a6a00', fontWeight: 700 }}>{label(item.status)}</span></td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>
}

function Metric({ label: metricLabel, value }) {
  return <div style={{ border: '1px solid #dfe7eb', borderRadius: 8, padding: '11px 13px', background: '#fafcfd' }}><small style={{ color: '#71838e' }}>{metricLabel}</small><strong style={{ display: 'block', marginTop: 3, fontSize: 20, color: '#17384a' }}>{value}</strong></div>
}

const buttonStyle = { height: 32, border: '1px solid #cbd9df', borderRadius: 7, background: '#fff', padding: '0 11px', color: '#36586b', textDecoration: 'none', display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: 13 }
const primaryStyle = { ...buttonStyle, borderColor: '#0aa695', background: '#0aa695', color: '#fff' }
const emptyStyle = { minHeight: 260, display: 'grid', placeContent: 'center', justifyItems: 'center', textAlign: 'center', gap: 7, color: '#748590' }
const th = { padding: '10px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.03em' }
const td = { padding: '11px 12px', color: '#294b5d' }
