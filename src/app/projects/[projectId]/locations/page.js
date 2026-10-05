import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'
import StandaloneLocationWorkspace from './StandaloneLocationWorkspace'
import { buildRitsuScopeSpatial } from './ritsuscopeSpatial'
import { AppShell } from '../../../fieldop/ui'
import ContinueToPrecon from '../../ContinueToPrecon'

export const dynamic = 'force-dynamic'

export default async function LocationBreakdownPage({ params, searchParams }) {
  const { projectId } = await params
  const query = await searchParams
  if (query?.view === 'map') redirect(`/projects/${projectId}/location-map`)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [projectResult, locationsResult, activitiesResult, allocationsResult, zonesResult, sheetsResult, levelsResult] = await Promise.all([
    supabase.from('projects').select('id, project_id, code, name').eq('id', projectId).maybeSingle(),
    supabase.from('locations').select('id, project_id, parent_id, name, location_type, environment_type, sequence_number, qr_token, created_at, updated_at').eq('project_id', projectId).order('sequence_number', { ascending: true }),
    supabase.from('fieldop_project_activities').select('id, project_id, source, scope_item_id, activity_name, unit, quantity, notes, is_active, created_at, scope_item:project_scopes(id, scope_code, scope_name, item_type, unit, quantity, notes)').eq('project_id', projectId).eq('is_active', true).order('created_at', { ascending: true }),
    supabase.from('location_service_quantities').select('id, project_id, location_id, service_id, quantity, source_scope_item_id, created_at, updated_at').eq('project_id', projectId),
    // RitsuScope: the outlines drawn for each location, their sheets (scale, level) and the levels linked as floors.
    supabase.from('takeoff_zones').select('id, name, location_id, points, source_id, zone_kind').eq('project_id', projectId).not('location_id', 'is', null),
    supabase.from('takeoff_sources').select('id, name, scale_pt_per_m, level_id').eq('project_id', projectId).eq('kind', 'pdf_page'),
    supabase.from('takeoff_levels').select('id, name, elevation_m, location_id').eq('project_id', projectId),
  ])

  const project = projectResult.data
  if (!project) redirect('/projects')

  const scopeItems = (activitiesResult.data || []).map((activity, index) => {
    const scope = activity.scope_item || null
    const fromProjectScope = activity.source === 'scope'
    return {
      id: activity.id,
      project_id: projectId,
      project_work_package_id: activity.scope_item_id || null,
      service_code: fromProjectScope ? (scope?.scope_code || '') : '',
      service_name: fromProjectScope ? (scope?.scope_name || activity.activity_name || '') : (activity.activity_name || ''),
      unit: fromProjectScope ? (scope?.unit || activity.unit || '') : (activity.unit || ''),
      scope_quantity: fromProjectScope ? (scope?.quantity ?? activity.quantity) : activity.quantity,
      sequence_number: index + 1,
      is_active: activity.is_active !== false,
      source_scope_item_id: activity.scope_item_id || null,
      scope_name: fromProjectScope ? (scope?.scope_name || '') : '',
      source: activity.source,
      notes: activity.notes || null,
    }
  })

  const loadError = projectResult.error || locationsResult.error || activitiesResult.error || allocationsResult.error
  const locations = locationsResult.data || []
  // RitsuScope data is optional here: without it the page works as before.
  const spatial = buildRitsuScopeSpatial({ zones: zonesResult.data || [], sources: sheetsResult.data || [], levels: levelsResult.data || [] })

  return (
    <AppShell module="projects" active="locations" projectId={projectId} bare action={<ContinueToPrecon projectId={projectId} />}>
      <StandaloneLocationWorkspace
        projectId={project.id}
        projectName={project.name}
        projectCode={project.project_id || project.code || ''}
        userId={user.id}
        initialLocations={locations}
        scopeItems={scopeItems}
        allocations={allocationsResult.data || []}
        spatial={spatial}
        loadError={loadError?.message || ''}
      />
    </AppShell>
  )
}
