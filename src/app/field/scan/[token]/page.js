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
          <Link href="/workspaces" style={button}>Return to RitsuFlow</Link>
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
        <div style={eyebrow}>RITSUFLOW FIELDOP · LOCATION</div>
        <div style={projectLine}>{project.project_id || project.code || 'Project'} · {project.name}</div>
        <h1 style={title}>{location.name}</h1>
        <p style={breadcrumbStyle}>{breadcrumb}</p>

        <div style={identityBox}>
          <span style={identityLabel}>PHYSICAL LOCATION CONFIRMED</span>
          <strong style={identityValue}>{location.name}</strong>
          <span style={identityMeta}>{location.environment_type || location.location_type || 'Production location'}</span>
        </div>

        <div style={sectionHeader}>
          <div>
            <span style={identityLabel}>AVAILABLE FIELDOP SCOPE</span>
            <h2 style={sectionTitle}>Activities allocated here</h2>
          </div>
          <span style={countBadge}>{availableActivities.length}</span>
        </div>

        {availableActivities.length ? (
          <div style={activityList}>
            {availableActivities.map((activity) => (
              <div key={activity.id} style={activityRow}>
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

        <div style={notice}>This QR establishes location context only. Worker identity, production reporting and field actions will be added as separate authenticated FieldOp workflows.</div>
        <Link href={`/projects/${project.id}/locations`} style={button}>Open Location Breakdown</Link>
      </section>
    </main>
  )
}

const shell = { minHeight: '100vh', background: '#edf4f6', padding: '28px 18px', boxSizing: 'border-box', fontFamily: 'Arial,sans-serif', color: '#082f43' }
const card = { width: '100%', maxWidth: 720, margin: '0 auto', background: '#fff', border: '1px solid #d7e3e8', borderRadius: 18, padding: 28, boxSizing: 'border-box', boxShadow: '0 16px 40px rgba(7,47,67,.08)' }
const eyebrow = { fontSize: 10, fontWeight: 900, letterSpacing: '.14em', color: '#008f84' }
const projectLine = { marginTop: 16, fontSize: 11, color: '#6d8290', fontWeight: 700 }
const title = { margin: '6px 0 0', fontSize: 30, lineHeight: 1.1 }
const copy = { margin: '12px 0 22px', color: '#607888', fontSize: 14, lineHeight: 1.6 }
const breadcrumbStyle = { margin: '8px 0 22px', color: '#718594', fontSize: 12, lineHeight: 1.5 }
const identityBox = { display: 'flex', flexDirection: 'column', gap: 5, padding: 18, borderRadius: 12, background: '#effaf8', border: '1px solid #cbe9e4' }
const identityLabel = { fontSize: 9, fontWeight: 900, letterSpacing: '.12em', color: '#008f84' }
const identityValue = { fontSize: 18 }
const identityMeta = { fontSize: 11, color: '#607888' }
const sectionHeader = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginTop: 28, marginBottom: 12 }
const sectionTitle = { margin: '4px 0 0', fontSize: 18 }
const countBadge = { minWidth: 32, height: 32, borderRadius: 16, display: 'grid', placeItems: 'center', background: '#073b58', color: '#fff', fontWeight: 900, fontSize: 12 }
const activityList = { border: '1px solid #e0e8ec', borderRadius: 12, overflow: 'hidden' }
const activityRow = { minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '10px 14px', borderBottom: '1px solid #e8eef1' }
const activityName = { display: 'block', fontSize: 13 }
const activityCode = { display: 'block', marginTop: 3, fontSize: 9, color: '#718594', fontWeight: 800 }
const activityQuantity = { whiteSpace: 'nowrap', fontSize: 12 }
const emptyState = { padding: 20, border: '1px dashed #d3e0e6', borderRadius: 10, color: '#718594', textAlign: 'center', fontSize: 12 }
const notice = { marginTop: 22, padding: 14, borderRadius: 10, background: '#f6f9fa', color: '#607888', fontSize: 11, lineHeight: 1.55 }
const button = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: 42, marginTop: 20, padding: '0 16px', borderRadius: 9, background: '#073b58', color: '#fff', textDecoration: 'none', fontWeight: 850, fontSize: 12 }
