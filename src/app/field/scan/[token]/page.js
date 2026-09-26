import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'

export const dynamic = 'force-dynamic'

function buildBreadcrumb(location, locations, projectName) {
  const map = new Map((locations || []).map((item) => [item.id, item]))
  const names = []
  const visited = new Set()
  let current = location

  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    names.unshift(current.name)
    current = current.parent_id ? map.get(current.parent_id) : null
  }

  return [projectName, ...names].filter(Boolean).join(' / ')
}

export default async function FieldLocationScanPage({ params }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/field/scan/${token}`)}`)
  }

  const { data: location, error: locationError } = await supabase
    .from('locations')
    .select('id, project_id, parent_id, name, location_type, environment_type, qr_token')
    .eq('qr_token', token)
    .maybeSingle()

  if (locationError || !location) {
    return (
      <main style={shell}>
        <section style={card}>
          <div style={eyebrow}>RITSUFLOW FIELDOP</div>
          <h1 style={title}>Location QR unavailable</h1>
          <p style={copy}>This QR code is invalid, inactive, or you do not have access to its project.</p>
          <Link href="/workspaces" style={primaryButton}>Return to RitsuFlow</Link>
        </section>
      </main>
    )
  }

  const [projectResult, hierarchyResult, activitiesResult, allocationsResult] = await Promise.all([
    supabase.from('projects').select('id, project_id, code, name').eq('id', location.project_id).maybeSingle(),
    supabase.from('locations').select('id, parent_id, name').eq('project_id', location.project_id),
    supabase
      .from('fieldop_project_activities')
      .select('id, activity_name, unit, quantity, source, scope_item_id, is_active, scope_item:project_scopes(id, scope_code, scope_name, unit, quantity)')
      .eq('project_id', location.project_id)
      .eq('is_active', true),
    supabase
      .from('location_service_quantities')
      .select('service_id, quantity')
      .eq('project_id', location.project_id)
      .eq('location_id', location.id),
  ])

  const project = projectResult.data
  if (!project) redirect('/workspaces')

  const allocationByService = new Map((allocationsResult.data || []).map((item) => [item.service_id, item.quantity]))
  const availableActivities = (activitiesResult.data || [])
    .filter((activity) => allocationByService.has(activity.id))
    .map((activity) => ({
      id: activity.id,
      name: activity.source === 'scope' ? (activity.scope_item?.scope_name || activity.activity_name) : activity.activity_name,
      code: activity.source === 'scope' ? (activity.scope_item?.scope_code || '') : '',
      unit: activity.source === 'scope' ? (activity.scope_item?.unit || activity.unit || '') : (activity.unit || ''),
      allocatedQuantity: allocationByService.get(activity.id),
    }))

  const breadcrumb = buildBreadcrumb(location, hierarchyResult.data || [], project.name)

  return (
    <main style={shell}>
      <section style={card}>
        <div style={eyebrow}>RITSUFLOW FIELDOP · LOCATION HUB</div>
        <div style={projectLine}>{project.project_id || project.code || 'Project'} · {project.name}</div>
        <h1 style={title}>{location.name}</h1>
        <p style={breadcrumbStyle}>{breadcrumb}</p>

        <div style={identityBox}>
          <div style={confirmedRow}>
            <span style={confirmedDot} />
            <span style={identityLabel}>PHYSICAL LOCATION CONFIRMED</span>
          </div>
          <strong style={identityValue}>{location.name}</strong>
          <span style={identityMeta}>{location.environment_type || location.location_type || 'Production location'}</span>
        </div>

        <div style={sectionHeader}>
          <div>
            <span style={identityLabel}>WORK AVAILABLE HERE</span>
            <h2 style={sectionTitle}>Allocated activities</h2>
          </div>
          <span style={countBadge}>{availableActivities.length}</span>
        </div>

        {availableActivities.length ? (
          <div style={activityList}>
            {availableActivities.map((activity, index) => (
              <div key={activity.id} style={{ ...activityRow, ...(index === availableActivities.length - 1 ? activityRowLast : {}) }}>
                <div>
                  <strong style={activityName}>{activity.name}</strong>
                  {activity.code ? <span style={activityCode}>{activity.code}</span> : null}
                </div>
                <strong style={activityQuantity}>{Number(activity.allocatedQuantity || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} {activity.unit}</strong>
              </div>
            ))}
          </div>
        ) : (
          <div style={emptyState}>No FieldOp activity is currently allocated to this location.</div>
        )}

        <div style={sectionHeader}>
          <div>
            <span style={identityLabel}>FIELD ACTIONS</span>
            <h2 style={sectionTitle}>What are you doing here?</h2>
          </div>
        </div>

        <div style={actionGrid}>
          <div style={actionCardActive}>
            <span style={actionIcon}>01</span>
            <strong style={actionTitle}>View Location Scope</strong>
            <span style={actionCopy}>Review the activities and quantities assigned to this physical location.</span>
          </div>
          <div style={actionCardPlanned}>
            <span style={actionIconMuted}>02</span>
            <strong style={actionTitle}>Report Production</strong>
            <span style={actionCopy}>Record installed quantities against work allocated to this location.</span>
            <span style={comingSoon}>NEXT WORKFLOW</span>
          </div>
          <div style={actionCardPlanned}>
            <span style={actionIconMuted}>03</span>
            <strong style={actionTitle}>Daily Report</strong>
            <span style={actionCopy}>Capture field notes, labor, equipment and conditions with location context.</span>
            <span style={comingSoon}>PLANNED</span>
          </div>
          <div style={actionCardPlanned}>
            <span style={actionIconMuted}>04</span>
            <strong style={actionTitle}>Issue / Constraint</strong>
            <span style={actionCopy}>Create a field issue already linked to the scanned location.</span>
            <span style={comingSoon}>PLANNED</span>
          </div>
        </div>

        <div style={contextNotice}>
          <strong style={contextNoticeTitle}>Location context is active</strong>
          <span>Actions started from this hub will inherit this location instead of asking the field user to select it again.</span>
        </div>

        <div style={footerActions}>
          <Link href={`/projects/${project.id}/locations`} style={primaryButton}>Open Location Breakdown</Link>
          <Link href="/workspaces" style={secondaryButton}>Exit FieldOp</Link>
        </div>
      </section>
    </main>
  )
}

const shell = { minHeight: '100vh', background: '#edf4f6', padding: '28px 18px', boxSizing: 'border-box', fontFamily: 'Arial,sans-serif', color: '#082f43' }
const card = { width: '100%', maxWidth: 760, margin: '0 auto', background: '#fff', border: '1px solid #d7e3e8', borderRadius: 18, padding: 28, boxSizing: 'border-box', boxShadow: '0 16px 40px rgba(7,47,67,.08)' }
const eyebrow = { fontSize: 10, fontWeight: 900, letterSpacing: '.14em', color: '#008f84' }
const projectLine = { marginTop: 16, fontSize: 11, color: '#6d8290', fontWeight: 700 }
const title = { margin: '6px 0 0', fontSize: 30, lineHeight: 1.1 }
const copy = { margin: '12px 0 22px', color: '#607888', fontSize: 14, lineHeight: 1.6 }
const breadcrumbStyle = { margin: '8px 0 22px', color: '#718594', fontSize: 12, lineHeight: 1.5 }
const identityBox = { display: 'flex', flexDirection: 'column', gap: 5, padding: 18, borderRadius: 12, background: '#effaf8', border: '1px solid #cbe9e4' }
const confirmedRow = { display: 'flex', alignItems: 'center', gap: 7 }
const confirmedDot = { width: 7, height: 7, borderRadius: '50%', background: '#008f84', flex: '0 0 auto' }
const identityLabel = { fontSize: 9, fontWeight: 900, letterSpacing: '.12em', color: '#008f84' }
const identityValue = { fontSize: 18 }
const identityMeta = { fontSize: 11, color: '#607888' }
const sectionHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 28, marginBottom: 12 }
const sectionTitle = { margin: '4px 0 0', fontSize: 18 }
const countBadge = { minWidth: 32, height: 32, borderRadius: 16, display: 'grid', placeItems: 'center', background: '#073b58', color: '#fff', fontWeight: 900, fontSize: 12 }
const activityList = { border: '1px solid #e0e8ec', borderRadius: 12, overflow: 'hidden' }
const activityRow = { minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 14px', borderBottom: '1px solid #e8eef1' }
const activityRowLast = { borderBottom: 0 }
const activityName = { display: 'block', fontSize: 13 }
const activityCode = { display: 'block', marginTop: 3, fontSize: 9, color: '#718594', fontWeight: 800 }
const activityQuantity = { whiteSpace: 'nowrap', fontSize: 12 }
const emptyState = { padding: 20, border: '1px dashed #d3e0e6', borderRadius: 10, color: '#718594', textAlign: 'center', fontSize: 12 }
const actionGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 10 }
const actionCardBase = { minHeight: 138, padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 7, boxSizing: 'border-box' }
const actionCardActive = { ...actionCardBase, border: '1px solid #b9ddd8', background: '#f3fbfa' }
const actionCardPlanned = { ...actionCardBase, border: '1px solid #e0e8ec', background: '#f8fafb' }
const actionIcon = { width: 28, height: 28, display: 'grid', placeItems: 'center', borderRadius: 8, background: '#008f84', color: '#fff', fontSize: 9, fontWeight: 900 }
const actionIconMuted = { ...actionIcon, background: '#dce6ea', color: '#5f7684' }
const actionTitle = { fontSize: 13 }
const actionCopy = { color: '#607888', fontSize: 11, lineHeight: 1.45 }
const comingSoon = { marginTop: 'auto', fontSize: 8, fontWeight: 900, letterSpacing: '.1em', color: '#7b8d98' }
const contextNotice = { marginTop: 22, padding: 14, borderRadius: 10, background: '#f2f7f9', color: '#607888', fontSize: 11, lineHeight: 1.55, display: 'flex', flexDirection: 'column', gap: 3 }
const contextNoticeTitle = { color: '#173f53', fontSize: 11 }
const footerActions = { display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }
const primaryButton = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: 42, padding: '0 16px', borderRadius: 9, background: '#073b58', color: '#fff', textDecoration: 'none', fontWeight: 850, fontSize: 12 }
const secondaryButton = { ...primaryButton, background: '#edf3f6', color: '#173f53' }
