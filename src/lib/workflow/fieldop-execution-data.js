// FieldOp execution-event adapter for the visual workflow.
// field_execution_events is the source of truth for actual production events.

import { syncWorkflowProductionToDailyReport } from './fieldop-daily-report-data';

const EXECUTION_SELECT = `
  id,
  project_id,
  location_id,
  assignment_id,
  worker_id,
  attendance_session_id,
  work_package_id,
  location_scope_item_id,
  project_service_id,
  actual_quantity,
  unit,
  status,
  started_at,
  finished_at,
  notes
`;

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function syncCompletedExecutionToExistingDailyReport(supabase, execution) {
  if (!execution?.project_id) return null;

  const reportDate = getLocalDateKey();

  const { data: report, error: reportError } = await supabase
    .from('daily_reports')
    .select('id, project_id, report_date, status')
    .eq('project_id', execution.project_id)
    .eq('report_date', reportDate)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (reportError) throw reportError;
  if (!report) return null;

  const { data: userData } = await supabase.auth.getUser();

  return syncWorkflowProductionToDailyReport(supabase, {
    reportId: report.id,
    projectId: report.project_id,
    reportDate: report.report_date,
    createdBy: userData?.user?.id || null,
  });
}

export async function loadWorkflowOpenExecution(
  supabase,
  { attendanceSessionId, locationScopeItemId }
) {
  if (!attendanceSessionId || !locationScopeItemId) return null;

  const { data, error } = await supabase
    .from('field_execution_events')
    .select(EXECUTION_SELECT)
    .eq('attendance_session_id', attendanceSessionId)
    .eq('location_scope_item_id', locationScopeItemId)
    .eq('status', 'in_progress')
    .is('finished_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function startWorkflowExecution(
  supabase,
  {
    projectId,
    locationId,
    assignmentId,
    workerId,
    attendanceSessionId,
    workPackageId,
    locationScopeItemId,
    projectServiceId,
    unit = null,
    notes = null,
  }
) {
  const required = {
    projectId,
    locationId,
    assignmentId,
    workerId,
    attendanceSessionId,
    workPackageId,
    locationScopeItemId,
    projectServiceId,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    throw new Error(`Execution context is incomplete: ${missing.join(', ')}.`);
  }

  const { data, error } = await supabase
    .from('field_execution_events')
    .insert({
      project_id: projectId,
      location_id: locationId,
      assignment_id: assignmentId,
      worker_id: workerId,
      attendance_session_id: attendanceSessionId,
      work_package_id: workPackageId,
      location_scope_item_id: locationScopeItemId,
      project_service_id: projectServiceId,
      actual_quantity: 0,
      unit: unit || null,
      status: 'in_progress',
      notes: notes || null,
    })
    .select(EXECUTION_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function updateWorkflowExecutionQuantity(
  supabase,
  { executionId, actualQuantity }
) {
  if (!executionId) throw new Error('Execution event is required.');

  const quantity = Number(actualQuantity);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Actual quantity must be zero or greater.');
  }

  const { data, error } = await supabase
    .from('field_execution_events')
    .update({ actual_quantity: quantity, updated_at: new Date().toISOString() })
    .eq('id', executionId)
    .select(EXECUTION_SELECT)
    .single();

  if (error) throw error;
  return data;
}

export async function finishWorkflowExecution(
  supabase,
  { executionId, actualQuantity, notes = null }
) {
  if (!executionId) throw new Error('Execution event is required.');

  const quantity = Number(actualQuantity);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Actual quantity must be zero or greater.');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('field_execution_events')
    .update({
      actual_quantity: quantity,
      status: 'completed',
      finished_at: now,
      updated_at: now,
      ...(notes ? { notes } : {}),
    })
    .eq('id', executionId)
    .select(EXECUTION_SELECT)
    .single();

  if (error) throw error;

  // Daily Report synchronization is intentionally best-effort. The completed
  // execution event remains the source of truth even when today's report does
  // not exist yet or a report synchronization error occurs.
  try {
    await syncCompletedExecutionToExistingDailyReport(supabase, data);
  } catch (syncError) {
    console.warn(
      'FieldOp execution completed, but Daily Report synchronization was deferred:',
      syncError
    );
  }

  return data;
}

export function buildWorkflowExecutionContext(execution) {
  if (!execution) return {};

  return {
    execution_event_id: execution.id,
    execution_status: execution.status,
    actual_quantity: execution.actual_quantity,
  };
}
