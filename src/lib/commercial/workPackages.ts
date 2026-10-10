// The company's work package catalog (Settings → Work packages), used to tag estimate lines.
import type { createClient } from '@/lib/supabase/client'

type Supabase = ReturnType<typeof createClient>

export type WorkPackage = { id: string; code: string; description: string; is_active: boolean }

/** Active packages first, then by code. An empty list when the catalog can't be read. */
export async function loadWorkPackages(supabase: Supabase, organizationId: string): Promise<WorkPackage[]> {
  const { data, error } = await supabase.rpc('get_organization_work_package_catalog', { target_organization_id: organizationId })
  if (error) return []
  return ((data || []) as WorkPackage[]).map(w => ({ id: w.id, code: w.code, description: w.description, is_active: w.is_active !== false }))
}
