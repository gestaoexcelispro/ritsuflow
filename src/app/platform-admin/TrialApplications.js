'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '../../lib/supabase/client'
import styles from './platform-admin.module.css'

const supabase = createClient()
const STATUSES = [['new', 'New'], ['contacted', 'Contacted'], ['accepted', 'Accepted'], ['declined', 'Declined']]
const COUNTRIES = { BR: 'Brazil', US: 'United States', other: 'Other' }
const ROLES = { estimator: 'Estimator', planner: 'Planner / PM', site_manager: 'Site manager', owner: 'Owner / director', other: 'Other' }
const INTERESTS = { estimating: 'Takeoff & estimating', planning: 'Lean planning', field: 'Field control' }
const LANGUAGES = { 'en-US': 'EN', 'pt-BR': 'PT', es: 'ES' }
const COLUMNS = 'id, created_at, name, email, company, country, role, active_projects, interests, language, status, notes'

const when = (iso) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso))

/** Platform Admin → applications sent from the landing page's trial form (public.trial_applications). */
export default function TrialApplications() {
  const [rows, setRows] = useState([])
  const [filter, setFilter] = useState('open')
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from('trial_applications').select(COLUMNS).order('created_at', { ascending: false }).limit(1000)
    setLoading(false)
    if (e) { setError(e.message); return }
    setError(''); setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function patch(row, change) {
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, ...change } : r)))
    const { error: e } = await supabase.from('trial_applications').update(change).eq('id', row.id)
    if (e) { setError(`Could not save: ${e.message}`); load() }
  }

  const counts = useMemo(() => Object.fromEntries(STATUSES.map(([k]) => [k, rows.filter((r) => r.status === k).length])), [rows])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter((r) => (filter === 'all' || (filter === 'open' ? ['new', 'contacted'].includes(r.status) : r.status === filter))
      && (!q || [r.name, r.email, r.company].join(' ').toLowerCase().includes(q)))
  }, [rows, filter, query])

  return (
    <section className={`${styles.organizations} ${styles.trials}`} aria-labelledby="trial-title">
      <div className={styles.listHead}>
        <div>
          <h2 id="trial-title">Trial applications {counts.new > 0 && <span className={styles.newCount}>{counts.new} new</span>}</h2>
          <p>Sent from the &quot;Apply for the trial&quot; form on ritsuflow.com. Change the status as you follow up.</p>
        </div>
        <div className={styles.actions}>
          <select value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Show">
            <option value="open">Open (new + contacted)</option>
            <option value="all">All ({rows.length})</option>
            {STATUSES.map(([k, label]) => <option key={k} value={k}>{label} ({counts[k] || 0})</option>)}
          </select>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or company..." aria-label="Search applications" />
          <button type="button" onClick={load}>Refresh</button>
        </div>
      </div>
      {error && <div className={styles.error} style={{ margin: '12px 20px 0' }}>{error}</div>}
      <div className={styles.tableWrap}>
        <table>
          <thead>
            <tr><th>Received</th><th>Applicant</th><th>Company</th><th>Country</th><th>Role</th><th>Projects</th><th>Wants to try</th><th>Lang.</th><th>Status</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: 'nowrap' }}>{when(r.created_at)}</td>
                <td><b>{r.name}</b><small><a href={`mailto:${r.email}`}>{r.email}</a></small></td>
                <td>{r.company}</td>
                <td>{COUNTRIES[r.country] || r.country}</td>
                <td>{ROLES[r.role] || r.role}</td>
                <td>{r.active_projects}</td>
                <td><div className={styles.tags}>{(r.interests || []).map((k) => <span key={k}>{INTERESTS[k] || k}</span>)}</div></td>
                <td>{LANGUAGES[r.language] || r.language}</td>
                <td>
                  <select className={`${styles.statusSelect} ${styles['trial_' + r.status] || ''}`} value={r.status} aria-label={`Status of ${r.name}`} onChange={(e) => patch(r, { status: e.target.value })}>
                    {STATUSES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                  </select>
                </td>
                <td>
                  <input key={`${r.id}-${r.notes || ''}`} className={styles.noteInput} defaultValue={r.notes || ''} placeholder="Add a note" aria-label={`Notes on ${r.name}`}
                    onBlur={(e) => { const v = e.target.value.trim() || null; if (v !== (r.notes || null)) patch(r, { notes: v }) }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && !shown.length && <div className={styles.empty}>{rows.length ? 'No applications match this filter.' : 'No applications yet.'}</div>}
      {loading && <div className={styles.empty}>Loading applications…</div>}
    </section>
  )
}
