'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import styles from './license.module.css'

const supabase = createClient()

const WORKSPACES = [
  { key: 'projects', icon: '🏢', name: 'Projects', text: 'Core project environment' },
  { key: 'precon', icon: '⚙️', name: 'PreCon', text: 'Planning and production readiness' },
  { key: 'fieldop', icon: '👷', name: 'FieldOp', text: 'Field execution and workforce' },
  { key: 'ritsucad', icon: '📐', name: 'RitsuCAD', text: 'Drawing and takeoff environment' },
]

function normalizedKey(value = '') {
  const key = String(value).toLowerCase().replaceAll('_', '').replaceAll('-', '').replaceAll(' ', '')
  if (key.includes('precon')) return 'precon'
  if (key.includes('fieldop') || key.includes('field')) return 'fieldop'
  if (key.includes('ritsucad') || key.includes('cad')) return 'ritsucad'
  if (key.includes('project')) return 'projects'
  return String(value).toLowerCase()
}

export default function CommercialAdministrationPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [organization, setOrganization] = useState(null)
  const [modules, setModules] = useState([])
  const [membershipRole, setMembershipRole] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (!user) {
          router.replace('/login')
          return
        }

        const { data: memberships, error: membershipError } = await supabase
          .from('organization_members')
          .select('organization_id,role,status')
          .eq('user_id', user.id)
          .eq('status', 'active')
        if (membershipError) throw membershipError

        const membership = memberships?.find((item) => ['owner', 'admin'].includes(item.role)) || memberships?.[0]
        if (!membership?.organization_id) throw new Error('No organization is connected to this account.')

        const [{ data: org, error: orgError }, { data: orgModules, error: moduleError }] = await Promise.all([
          supabase.from('organizations').select('id,name,slug,organization_number').eq('id', membership.organization_id).single(),
          supabase.from('organization_modules').select('module_key,is_enabled,enabled_at,disabled_at').eq('organization_id', membership.organization_id),
        ])
        if (orgError) throw orgError
        if (moduleError) throw moduleError
        if (!alive) return
        setMembershipRole(membership.role || '')
        setOrganization(org)
        setModules(orgModules || [])
      } catch (err) {
        if (alive) setError(err?.message || 'Unable to load commercial administration.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [router])

  const enabledKeys = useMemo(() => {
    const result = new Set(['projects'])
    modules.forEach((item) => {
      if (item.is_enabled) result.add(normalizedKey(item.module_key))
    })
    return result
  }, [modules])

  if (loading) return <main className={styles.loading}>Loading commercial administration...</main>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority /></div>
        <div className={styles.headerTitle}><h1>Commercial Administration</h1><p>Contract, project capacity and workspace entitlements</p></div>
        <Link className={styles.backButton} href="/settings">← Return to Settings</Link>
      </header>

      <section className={styles.content}>
        {error && <div className={styles.error}>{error}</div>}

        <section className={styles.summary}>
          <article><small>ORGANIZATION</small><strong>{organization?.name || '—'}</strong><span>{organization?.organization_number || organization?.slug || '—'}</span></article>
          <article><small>COMMERCIAL STATUS</small><strong className={styles.active}>Active</strong><span>Organization commercially enabled</span></article>
          <article><small>LICENSE BASIS</small><strong>Active Projects</strong><span>Concurrent active-project capacity</span></article>
          <article><small>WORKSPACE ENTITLEMENTS</small><strong>{enabledKeys.size}</strong><span>of {WORKSPACES.length} currently entitled</span></article>
        </section>

        <section className={styles.intro}>
          <div><span>PLATFORM COMMERCIAL CONTROL</span><h2>Organization Commercial Entitlements</h2><p>This is the commercial source of truth for what this organization is entitled to use in RitsuFlow. Commercial entitlement is established before organization provisioning, user assignment and project access.</p></div>
          <div className={styles.flow}><b>Commercial</b><i>→</i><b>Provisioning</b><i>→</i><b>Organization</b><i>→</i><b>User</b><i>→</i><b>Project</b></div>
        </section>

        <section className={styles.columns}>
          <article className={styles.panel}>
            <div className={styles.panelTitle}><div><small>COMMERCIAL AGREEMENT</small><h3>Subscription & Contract</h3></div><span className={styles.activePill}>● Active</span></div>
            <div className={styles.rows}>
              <div><span>Commercial Status</span><b>Active</b></div>
              <div><span>Commercial Plan</span><b>Commercial</b></div>
              <div><span>License Basis</span><b>Active Projects</b></div>
              <div><span>User Licensing</span><b>Unlimited by seat</b></div>
              <div><span>Contract Start</span><b>—</b></div>
              <div><span>Renewal / End Date</span><b>—</b></div>
              <div><span>Commercial Reference</span><b>—</b></div>
            </div>
            <p className={styles.help}>Contract dates, commercial reference and lifecycle status will be stored in the commercial provisioning record. User quantity does not determine the license charge.</p>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelTitle}><div><small>PROJECT CAPACITY</small><h3>Active Project Allowance</h3></div><span className={styles.controlled}>Platform Controlled</span></div>
            <div className={styles.capacity}><div><span>Active Projects</span><strong>—</strong></div><div><span>Project Limit</span><strong>—</strong></div><div><span>Available</span><strong>—</strong></div></div>
            <div className={styles.capacityRule}><b>Capacity rule</b><span>A project consumes one commercial allowance while Active. Project closeout releases that capacity. Closed projects remain permanently available in read-only mode for visualization, search, reports and exports.</span></div>
            <p className={styles.help}>The project limit is granted commercially by the RitsuFlow Platform Operator. Organization administrators cannot increase their own allowance.</p>
          </article>
        </section>

        <section className={styles.workspacePanel}>
          <div className={styles.sectionTitle}><div><small>COMMERCIAL ENTITLEMENTS</small><h3>Workspace Entitlements</h3><p>These entitlements determine the maximum environments that may subsequently be provisioned to the organization.</p></div><Link href="/settings/workspaces">View Organization Provisioning →</Link></div>
          <div className={styles.workspaceGrid}>
            {WORKSPACES.map((workspace) => {
              const enabled = enabledKeys.has(workspace.key)
              return <article key={workspace.key} className={enabled ? styles.workspaceEnabled : styles.workspaceDisabled}>
                <div className={styles.workspaceIcon}>{workspace.icon}</div>
                <div><b>{workspace.name}</b><span>{workspace.text}</span></div>
                <strong>{enabled ? '● Commercially Entitled' : '○ Not Entitled'}</strong>
              </article>
            })}
          </div>
        </section>

        <section className={styles.controlPanel}>
          <div><small>CONTROL AUTHORITY</small><h3>Platform Operator Control</h3><p>Commercial status, project allowance and workspace entitlements are platform-controlled values. Customer organization administrators may view their commercial configuration but cannot grant themselves additional capacity or products.</p></div>
          <div className={styles.controlFacts}><span><b>Current organization role</b>{membershipRole || '—'}</span><span><b>Customer self-upgrade</b>Blocked</span><span><b>Provisioning authority</b>RitsuFlow Platform Operator</span></div>
        </section>

        <div className={styles.rule}><b>🔒 Commercial boundary</b><span>Commercial Administration determines what was purchased or granted. Workspace Access must never exceed these entitlements. Users & Access must never exceed Workspace Access. Project Access must never exceed the user's assigned scope.</span></div>
        <div className={styles.architecture}><b>Governance chain</b><span><strong>Commercial Administration</strong> defines contractual entitlement → <strong>Workspace Access</strong> provisions entitled environments → <strong>Users & Access</strong> assigns environments → <strong>Project Access</strong> defines project scope → <strong>Roles & Permissions</strong> defines permitted actions.</span></div>
      </section>
    </main>
  )
}
