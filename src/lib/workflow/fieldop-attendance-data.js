// FieldOp attendance adapter for the visual workflow.
// Existing FieldOp attendance tables and RPCs remain the source of truth.

export async function loadWorkflowOpenAttendanceSession(supabase, { projectId, workerId }) {
  if (!projectId || !workerId) return null;

  const { data, error } = await supabase
    .from('field_attendance_sessions')
    .select('id, project_id, worker_id, check_in_at, check_out_at, status, worked_minutes')
    .eq('project_id', projectId)
    .eq('worker_id', workerId)
    .is('check_out_at', null)
    .order('check_in_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function workflowCheckIn(supabase, { projectId, workerId, latitude, longitude, accuracy }) {
  if (!projectId || !workerId) {
    throw new Error('Project and Worker are required for check-in.');
  }

  const { data, error } = await supabase.rpc('field_worker_check_in', {
    p_project_id: projectId,
    p_worker_id: workerId,
    p_latitude: latitude ?? null,
    p_longitude: longitude ?? null,
    p_accuracy_m: accuracy ?? null,
  });

  if (error) throw error;
  return data;
}

export function buildWorkflowAttendanceContext(session) {
  if (!session) return {};

  return {
    attendance_session_id: session.id,
    checked_in_at: session.check_in_at,
  };
}
