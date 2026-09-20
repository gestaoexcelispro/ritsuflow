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

export default function LicenseSubscriptionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [organization, setOrganization] = useState(null)
  const [modules, setModules] = useState([])
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
        setOrganization(org)
        setModules(orgModules || [])
      } catch (err) {
        if (alive) setError(err?.message || 'Unable to load commercial configuration.')
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

  if (loading) return <main className={styles.loading}>Loading license & subscription...</main>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority /></div>
        <div className={styles.headerTitle}><h1>License & Subscription</h1><p>Commercial plan, capacity and organization entitlements</p></div>
        <Link className={styles.backButton} href="/settings">← Return to Settings</Link>
      </header>

      <section className={styles.content}>
        {error && <div className={styles.error}>{error}</div>}

        <section className={styles.summary}>
          <article><small>ORGANIZATION</small><strong>{organization?.name || '—'}</strong><span>{organization?.organization_number || organization?.slug || '—'}</span></article>
          <article><small>SUBSCRIPTION</small><strong className={styles.active}>Active</strong><span>Commercial access enabled</span></article>
          <article><small>COMMERCIAL MODEL</small><strong>Active Projects</strong><span>Capacity is based on concurrent active projects</span></article>
          <article><small>WORKSPACES</small><strong>{enabledKeys.size}</strong><span>of {WORKSPACES.length} currently provisioned</span></article>
        </section>

        <section className={styles.intro}>
          <div><span>COMMERCIAL ADMINISTRATION</span><h2>Organization Entitlements</h2><p>This page is the commercial source of truth for the RitsuFlow environments and project capacity available to the organization.</p></div>
          <div className={styles.flow}><b>Commercial</b><i>→</i><b>Provisioning</b><i>→</i><b>Organization</b><i>→</i><b>User</b></div>
        </section>

        <section className={styles.columns}>
          <article className={styles.panel}>
            <div className={styles.panelTitle}><div><small>SUBSCRIPTION</small><h3>Commercial Plan</h3></div><span className={styles.activePill}>● Active</span></div>
            <div className={styles.rows}>
              <div><span>Plan</span><b>Commercial</b></div>
              <div><span>Billing Status</span><b>Active</b></div>
              <div><span>License Basis</span><b>Active Projects</b></div>
              <div><span>User Seats</span><b>Not license-limited</b></div>
            </div>
            <p className={styles.help}>Users are controlled through Users & Access. Commercial capacity is determined by active projects and provisioned workspaces.</p>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelTitle}><div><small>PROJECT CAPACITY</small><h3>Active Project Allowance</h3></div><span className={styles.controlled}>Platform Controlled</span></div>
            <div className={styles.capacity}><div><span>Active Projects</span><strong>—</strong></div><div><span>Project Limit</span><strong>—</strong></div><div><span>Available</span><strong>—</strong></div></div>
            <p className={styles.help}>The capacity fields will be connected to the commercial provisioning record. Closing a project releases commercial capacity; closed projects remain available in read-only mode for visualization and reporting.</p>
          </article>
        </section>

        <section className={styles.workspacePanel}>
          <div className={styles.sectionTitle}><div><small>ENTITLEMENTS</small><h3>Provisioned Workspaces</h3></div><Link href="/settings/workspaces">View Workspace Access →</Link></div>
          <div className={styles.workspaceGrid}>
            {WORKSPACES.map((workspace) => {
              const enabled = enabledKeys.has(workspace.key)
              return <article key={workspace.key} className={enabled ? styles.workspaceEnabled : styles.workspaceDisabled}>
                <div className={styles.workspaceIcon}>{workspace.icon}</div>
                <div><b>{workspace.name}</b><span>{workspace.text}</span></div>
                <strong>{enabled ? '● Provisioned' : '○ Not Provisioned'}</strong>
              </article>
            })}
          </div>
        </section>

        <div className={styles.rule}><b>🔒 Commercial control</b><span>Organization administrators can view commercial entitlements but cannot grant themselves additional project capacity or workspaces. Changes are controlled by the RitsuFlow platform provisioning layer.</span></div>
        <div className={styles.architecture}><b>Commercial architecture</b><span><strong>License & Subscription</strong> defines what the organization purchased. <strong>Workspace Access</strong> exposes the provisioned environments. <strong>Users & Access</strong> assigns those environments to people. <strong>Project Access</strong> determines where they can work.</span></div>
      </section>
    </main>
  )
}
