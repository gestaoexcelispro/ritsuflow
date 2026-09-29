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
    if (!event.location_id || !event.project_service_id) continue;

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

async function loadScopeQuantity(supabase, locationId, projectServiceId) {
  const { data, error } = await supabase
    .from('location_service_quantities')
    .select('id, quantity')
    .eq('location_id', locationId)
    .eq('service_id', projectServiceId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function loadPreviousCumulative(
  supabase,
  { locationId, projectServiceId, reportDate }
) {
  const { data, error } = await supabase
    .from('daily_report_production')
    .select(`
      actual_quantity,
      daily_reports!inner(report_date)
    `)
    .eq('location_id', locationId)
    .eq('project_service_id', projectServiceId)
    .lt('daily_reports.report_date', reportDate);

  if (error) throw error;

  return (data || []).reduce(
    (total, item) => total + (Number(item.actual_quantity) || 0),
    0
  );
}

function productionStatus({ actualQuantity, cumulativeQuantity, scopeQuantity }) {
  if (scopeQuantity !== null && cumulativeQuantity >= scopeQuantity) return 'completed';
  if (actualQuantity > 0) return 'in_progress';
  return 'not_started';
}

// Materializes the FieldOp projection into the existing Daily Report production model.
// Re-running the sync is idempotent for FieldOp-generated rows: the same
// location + service + report row is updated instead of duplicated.
export async function syncWorkflowProductionToDailyReport(
  supabase,
  { reportId, projectId, reportDate, createdBy }
) {
  if (!reportId || !projectId || !reportDate) {
    throw new Error('Report, project and report date are required for FieldOp synchronization.');
  }

  const projection = await loadWorkflowDailyReportProductionProjection(
    supabase,
    { projectId, reportDate }
  );

  const rows = buildDailyReportProductionRows(projection, {
    reportId,
    createdBy,
  });

  const synchronized = [];

  for (const row of rows) {
    const scope = await loadScopeQuantity(
      supabase,
      row.location_id,
      row.project_service_id
    );

    const previousCumulative = await loadPreviousCumulative(supabase, {
      locationId: row.location_id,
      projectServiceId: row.project_service_id,
      reportDate,
    });

    const actualQuantity = Number(row.actual_quantity || 0);
    const cumulativeQuantity = previousCumulative + actualQuantity;
    const scopeQuantity =
      scope?.quantity === null || scope?.quantity === undefined
        ? null
        : Number(scope.quantity);

    if (scopeQuantity !== null && cumulativeQuantity > scopeQuantity) {
      throw new Error(
        `${row.service_name || 'Production'} at ${row.location_name || 'location'} exceeds the configured scope quantity.`
      );
    }

    const payload = {
      ...row,
      location_service_quantity_id: scope?.id || null,
      cumulative_quantity: cumulativeQuantity,
      production_status: productionStatus({
        actualQuantity,
        cumulativeQuantity,
        scopeQuantity,
      }),
    };

    const { data: existing, error: existingError } = await supabase
      .from('daily_report_production')
      .select('id, planned_quantity, variance_reason, variance_notes')
      .eq('daily_report_id', reportId)
      .eq('location_id', row.location_id)
      .eq('project_service_id', row.project_service_id)
      .eq('source', 'fieldop_execution')
      .maybeSingle();

    if (existingError) throw existingError;

    let result;
    if (existing?.id) {
      result = await supabase
        .from('daily_report_production')
        .update(payload)
        .eq('id', existing.id)
        .select('id')
        .single();
    } else {
      result = await supabase
        .from('daily_report_production')
        .insert(payload)
        .select('id')
        .single();
    }

    if (result.error) throw result.error;
    synchronized.push(result.data.id);
  }

  return {
    projectedCount: projection.length,
    synchronizedCount: synchronized.length,
    productionIds: synchronized,
  };
}
