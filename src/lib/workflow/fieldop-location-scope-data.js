// Read-only Location Scope Item adapter for the FieldOp workflow.
// location_scope_items is the spatial project-scope source of truth.

export async function loadWorkflowLocationScopeItems(
  supabase,
  { projectId, locationId, workPackageId }
) {
  if (!projectId || !locationId) return [];

  let query = supabase
    .from('location_scope_items')
    .select(`
      id,
      project_id,
      location_id,
      project_service_id,
      planned_quantity,
      project_services!inner(
        id,
        project_id,
        project_work_package_id,
        service_code,
        service_name,
        unit,
        is_active
      )
    `)
    .eq('project_id', projectId)
    .eq('location_id', locationId)
    .eq('project_services.is_active', true);

  if (workPackageId) {
    query = query.eq(
      'project_services.project_work_package_id',
      workPackageId
    );
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data || []).sort((first, second) =>
    getWorkflowLocationScopeItemLabel(first).localeCompare(
      getWorkflowLocationScopeItemLabel(second)
    )
  );
}

export function buildWorkflowLocationScopeContext(locationScopeItem) {
  if (!locationScopeItem) return {};

  return {
    location_scope_item_id: locationScopeItem.id,
    project_service_id: locationScopeItem.project_service_id,
  };
}

export function getWorkflowLocationScopeItemLabel(locationScopeItem) {
  const scopeItem = locationScopeItem?.project_services;
  if (!scopeItem) return 'Unknown Scope Item';

  const code = String(scopeItem.service_code || '').trim();
  const name = String(scopeItem.service_name || '').trim();
  const unit = String(scopeItem.unit || '').trim();
  const quantity = locationScopeItem.planned_quantity;

  const identity = code && name ? `${code} · ${name}` : code || name || 'Scope Item';
  const quantityLabel = quantity === null || quantity === undefined
    ? ''
    : ` · ${quantity}${unit ? ` ${unit}` : ''}`;

  return `${identity}${quantityLabel}`;
}
