// Daily Report projection adapter for the FieldOp workflow.
// Field execution events are the operational source; daily_report_production remains
// the canonical Daily Report production table.

export async function loadWorkflowDailyReportProductionProjection(
  supabase,
  { projectId, reportDate }
) {
  if (!projectId || !reportDate) return [];

  const dayStart = `${reportDate}T00:00:00`;
  const nextDay = new Date(`${reportDate}T00:00:00`);
  nextDay.setDate(nextDay.getDate() + 1);

  const { data, error } = await supabase
    .from('field_execution_events')
    .select(`
      id,
      project_id,
      location_id,
      project_service_id,
      location_scope_item_id,
      actual_quantity,
      unit,
      status,
      started_at,
      finished_at,
      locations(name),
      project_services(service_code, service_name, unit)
    `)
    .eq('project_id', projectId)
    .eq('status', 'completed')
    .gte('finished_at', dayStart)
    .lt('finished_at', nextDay.toISOString())
    .order('finished_at', { ascending: true });

  if (error) throw error;

  const grouped = new Map();
  for (const event of data || []) {
    const key = `${event.location_id}:${event.project_service_id}`;
    const current = grouped.get(key) || {
      locationId: event.location_id,
      projectServiceId: event.project_service_id,
      locationScopeItemId: event.location_scope_item_id,
      locationName: event.locations?.name || '',
      serviceCode: event.project_services?.service_code || '',
      serviceName: event.project_services?.service_name || '',
      unit: event.unit || event.project_services?.unit || '',
      actualQuantity: 0,
      executionEventIds: [],
    };

    current.actualQuantity += Number(event.actual_quantity || 0);
    current.executionEventIds.push(event.id);
    grouped.set(key, current);
  }

  return Array.from(grouped.values());
}

export function buildDailyReportProductionRows(projection, { reportId, createdBy }) {
  if (!reportId) throw new Error('Daily Report is required for production projection.');

  return (projection || []).map((item) => ({
    daily_report_id: reportId,
    location_id: item.locationId,
    project_service_id: item.projectServiceId,
    location_name: item.locationName || null,
    service_code: item.serviceCode || null,
    service_name: item.serviceName || null,
    unit: item.unit || null,
    actual_quantity: Number(item.actualQuantity || 0),
    source: 'fieldop_execution',
    notes: item.executionEventIds?.length
      ? `Projected from ${item.executionEventIds.length} FieldOp execution event${item.executionEventIds.length === 1 ? '' : 's'}.`
      : null,
    created_by: createdBy || null,
  }));
}
