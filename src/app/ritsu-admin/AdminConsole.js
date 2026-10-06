'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import PlatformMapCanvas from './platform-map/PlatformMapCanvas'
import { mapFilters } from './platform-map/platformMapModel'
import PlatformReports from './reports/PlatformReports'
import styles from './ritsu-admin.module.css'

const supabase = createClient()

export default function AdminConsole({ view = 'map', initialNodeId, children }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [authorizationError, setAuthorizationError] = useState('')
  const [authorizationAttempt, setAuthorizationAttempt] = useState(0)
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const reports = view === 'reports'
  const organizations = view === 'organizations'
  const map = !reports && !organizations
  const title = reports ? 'Reports' : organizations ? 'Organizations' : 'Platform Map'
  const subtitle = reports
    ? 'Architecture coverage, verified dependencies & implementation gaps'
    : organizations
      ? 'Customer organizations, licenses and enabled modules'
      : 'RitsuFlow architecture & system flow'

  useEffect(() => {
    let active = true
    async function authorize() {
      setChecking(true); setAuthorizationError('')
      try {
        const { data, error } = await supabase.auth.getUser()
        if (!active) return
        if (error && error.name !== 'AuthSessionMissingError') throw error
        if (!data?.user) { router.replace('/login'); return }
        const { data: role, error: roleError } = await supabase.from('platform_user_roles')
          .select('role,is_active').eq('user_id', data.user.id)
          .eq('role', 'platform_owner').eq('is_active', true).maybeSingle()
        if (!active) return
        if (roleError) throw roleError
        if (!role) { router.replace('/workspaces'); return }
        setChecking(false)
      } catch (error) {
        if (active) { setAuthorizationError('Unable to verify your platform-owner access. Please retry.'); setChecking(false) }
      }
    }
    authorize()
    return () => { active = false }
  }, [router, authorizationAttempt])

  if (checking) return <main className={styles.loading}>Authorizing Ritsu Admin...</main>
  if (authorizationError) return <main className={styles.loading}><div className={styles.authorizationError}><p role="alert">{authorizationError}</p><button type="button" onClick={() => setAuthorizationAttempt((attempt) => attempt + 1)}>Retry authorization</button></div></main>

  return <main className={styles.page}>
    <aside className={styles.sidebar}>
      <div className={styles.brand}>RitsuFlow™</div>
      <nav aria-label="Workspaces">
        <Link href="/projects">Projects</Link><Link href="/dashboard">PreCon</Link><Link href="/fieldop">FieldOp</Link>
        <Link href="/ritsu-admin" className={styles.active}>⚙ Ritsu Admin</Link>
      </nav>
      <nav className={styles.subnav} aria-label="Ritsu Admin">
        <Link href="/ritsu-admin" className={map ? styles.subnavActive : ''} aria-current={map ? 'page' : undefined}>Platform Map</Link>
        <Link href="/ritsu-admin/reports" className={reports ? styles.subnavActive : ''} aria-current={reports ? 'page' : undefined}>Reports</Link>
        <Link href="/ritsu-admin/organizations" className={organizations ? styles.subnavActive : ''} aria-current={organizations ? 'page' : undefined}>Organizations</Link>
        <span>System Status · Coming Soon</span><span>Feature Flags · Coming Soon</span><span>Audit Log · Coming Soon</span>
      </nav>
      <Link href="/workspaces" className={styles.back}>← Workspaces</Link>
    </aside>
    <section className={styles.workspace}>
      <header className={styles.header}>
        <div><h1>{title}</h1><p>{subtitle}</p></div>
        <div className={styles.headerActions}><Link href={map ? '/ritsu-admin/reports' : '/ritsu-admin'}>{map ? 'Reports' : 'Platform Map'}</Link><span className={styles.ownerBadge}>🔒 Platform Owner</span></div>
      </header>
      {organizations ? children : reports ? <PlatformReports /> : <>
        <div className={styles.toolbar}>
          <div className={styles.filters} role="group" aria-label="Inventory node types">{mapFilters.map((item) => <button type="button" key={item} aria-pressed={filter === item} className={filter === item ? styles.selected : ''} onClick={() => setFilter(item)}>{item}</button>)}</div>
          <div className={styles.searchBox}><input type="search" aria-label="Search architecture inventory" placeholder="Search nodes, routes, data..." value={query} onChange={(event) => setQuery(event.target.value)} />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</div>
        </div>
        <div className={styles.canvas}><PlatformMapCanvas key={initialNodeId || 'root'} query={query} filter={filter} initialNodeId={initialNodeId} /></div>
      </>}
    </section>
  </main>
}
