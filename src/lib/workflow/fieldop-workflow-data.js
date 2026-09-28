// Read-only data adapter for the FieldOp visual workflow.
// Existing RitsuFlow Projects tables remain the source of truth.

export async function loadWorkflowProjects(supabase) {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      id,
      organization_id,
      code,
      name,
      status
    `)
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function loadWorkflowLocations(supabase, projectId) {
  if (!projectId) return [];

  const { data, error } = await supabase
    .from('locations')
    .select(`
      id,
      project_id,
      parent_id,
      name,
      code,
      level,
      sort_order
    `)
    .eq('project_id', projectId)
    .order('level', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function buildWorkflowProjectContext(project) {
  if (!project) return {};

  return {
    project_id: project.id,
    organization_id: project.organization_id,
  };
}

export function buildWorkflowLocationContext(location) {
  if (!location) return {};

  return {
    location_id: location.id,
  };
}
