// Read-only adapter for FieldOp worker/project assignment context.
// Existing FieldOp tables remain the source of truth.

export async function loadWorkflowProjectAssignments(supabase, projectId) {
  if (!projectId) return [];

  const { data, error } = await supabase
    .from('field_project_assignments')
    .select(`
      id,
      project_id,
      worker_id,
      company_id,
      trade_id,
      role_id,
      crew_id,
      field_workers(id, employee_code, first_name, last_name, status),
      field_companies(id, name),
      field_trades(id, code, name),
      field_roles(id, name),
      field_crews(id, name)
    `)
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function buildWorkflowAssignmentContext(assignment) {
  if (!assignment) return {};

  return {
    assignment_id: assignment.id,
    worker_id: assignment.worker_id,
  };
}

export function getWorkflowWorkerLabel(assignment) {
  const worker = assignment?.field_workers;
  if (!worker) return 'Unknown worker';

  const name = [worker.first_name, worker.last_name].filter(Boolean).join(' ').trim();
  return worker.employee_code ? `${worker.employee_code} · ${name || 'Worker'}` : (name || 'Worker');
}
