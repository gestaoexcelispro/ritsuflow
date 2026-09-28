// Read-only Project Work Package adapter for the FieldOp workflow.
// project_work_packages is the project-scoped source of truth.

export async function loadWorkflowProjectWorkPackages(supabase, projectId) {
  if (!projectId) return [];

  const { data, error } = await supabase
    .from('project_work_packages')
    .select(`
      id,
      project_id,
      code,
      description,
      color,
      is_active
    `)
    .eq('project_id', projectId)
    .eq('is_active', true)
    .order('code', { ascending: true });

  if (error) throw error;
  return data || [];
}

export function buildWorkflowWorkPackageContext(workPackage) {
  if (!workPackage) return {};

  return {
    work_package_id: workPackage.id,
  };
}

export function getWorkflowWorkPackageLabel(workPackage) {
  if (!workPackage) return 'Unknown Work Package';

  const code = String(workPackage.code || '').trim();
  const description = String(workPackage.description || '').trim();

  if (code && description) return `${code} · ${description}`;
  return code || description || 'Work Package';
}
