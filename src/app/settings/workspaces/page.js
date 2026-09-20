'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import styles from './workspaces.module.css'

const supabase = createClient()

const WORKSPACES = [
  { key: 'projects', icon: '🏢', name: 'Projects', description: 'Core project environment for project setup, location structure, project records and organization-wide project access.', core: true },
  { key: 'precon', icon: '⚙️', name: 'PreCon', description: 'Planning environment for pre-planning, Master Plan, Lookahead, constraints, Weekly Planning and production readiness.' },
  { key: 'fieldop', icon: '👷', name: 'FieldOp', description: 'Field execution environment for Daily Reports, operational visibility, workforce and timekeeping.' },
  { key: 'ritsucad', icon: '📐', name: 'RitsuCAD', description: 'Drawing and takeoff environment for PDF/CAD-style measurement, quantities and project visual analysis.' },
]

function normalizedKey(value = '') {
  const key = String(value).toLowerCase().replaceAll('_', '').replaceAll('-', '').replaceAll(' ', '')
  if (key.includes('precon')) return 'precon'
  if (key.includes('fieldop') || key.includes('field')) return 'fieldop'
  if (key.includes('ritsucad') || key.includes('cad')) return 'ritsucad'
  if (key.includes('project')) return 'projects'
  return String(value).toLowerCase()
}

export default function WorkspaceAccessPage() {
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
        if (alive) setError(err?.message || 'Unable to load workspace provisioning.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [router])

  const statusByKey = useMemo(() => {
    const map = new Map()
    for (const item of modules) map.set(normalizedKey(item.module_key), item)
    return map
  }, [modules])

  const cards = WORKSPACES.map((workspace) => {
    const record = statusByKey.get(workspace.key)
    const enabled = workspace.core ? record?.is_enabled !== false : Boolean(record?.is_enabled)
    return { ...workspace, record, enabled }
  })
  const activeCount = cards.filter((item) => item.enabled).length

  if (loading) return <main className={styles.loading}>Loading workspace access...</main>

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brand}><Image src="/logo-white.png" alt="RitsuFlow" width={180} height={65} priority /></div>
        <div className={styles.headerTitle}><h1>Workspace Access</h1><p>Organization workspace provisioning and availability</p></div>
        <Link className={styles.backButton} href="/settings">← Return to Settings</Link>
      </header>

      <section className={styles.content}>
        {error && <div className={styles.error}>{error}</div>}

        <section className={styles.summary}>
          <article><small>ORGANIZATION</small><strong>{organization?.name || '—'}</strong><span>{organization?.organization_number || organization?.slug || '—'}</span></article>
          <article><small>PROVISIONED WORKSPACES</small><strong>{activeCount}</strong><span>of {WORKSPACES.length} available</span></article>
          <article><small>ACCESS MODEL</small><strong>Organization</strong><span>Sets the maximum workspace scope</span></article>
          <article><small>USER ASSIGNMENT</small><strong>Controlled</strong><span>Users can only receive provisioned workspaces</span></article>
        </section>

        <section className={styles.intro}>
          <div><span>RITSUFLOW CONFIGURATION</span><h2>Organization Workspace Provisioning</h2><p>This page defines the RitsuFlow environments available to the organization. Individual user access is assigned separately in Users & Access and can never exceed this provisioned scope.</p></div>
          <div className={styles.flow}><b>Provisioning</b><i>→</i><b>Organization</b><i>→</i><b>User</b><i>→</i><b>Project</b></div>
        </section>

        <section className={styles.workspaceGrid}>
          {cards.map((workspace) => (
            <article className={`${styles.workspaceCard} ${workspace.enabled ? styles.enabled : styles.disabled}`} key={workspace.key}>
              <div className={styles.cardTop}>
                <div className={styles.icon}>{workspace.icon}</div>
                <div className={styles.statusBlock}>
                  <span className={workspace.enabled ? styles.activePill : styles.inactivePill}>{workspace.enabled ? '● Active' : '○ Not Provisioned'}</span>
                  {workspace.core && <small>Core workspace</small>}
                </div>
              </div>
              <h3>{workspace.name}</h3>
              <p>{workspace.description}</p>
              <div className={styles.details}>
                <div><span>Organization Status</span><b>{workspace.enabled ? 'Enabled' : 'Unavailable'}</b></div>
                <div><span>User Assignment</span><b>{workspace.enabled ? 'Available' : 'Blocked'}</b></div>
                <div><span>Commercial Control</span><b>Platform Provisioned</b></div>
              </div>
              <div className={styles.cardFooter}>{workspace.enabled ? 'Users may be assigned access according to their role and project scope.' : 'This workspace must be provisioned before it can be assigned to users.'}</div>
            </article>
          ))}
        </section>

        <div className={styles.rule}>
          <b>🔒 Provisioning rule</b>
          <span>Workspace Access defines the maximum RitsuFlow environment available to this organization. Organization administrators can view provisioning, but commercial activation is controlled by the RitsuFlow platform provisioning layer. User workspace assignments remain subordinate to this configuration.</span>
        </div>

        <div className={styles.architecture}>
          <b>Access architecture</b>
          <span><strong>Workspace Provisioning</strong> determines what the organization has. <strong>Users & Access</strong> determines which provisioned workspaces a person receives. <strong>Project Access</strong> determines where that person can work. <strong>Roles & Permissions</strong> determines what that person can do.</span>
        </div>
      </section>
    </main>
  )
}
