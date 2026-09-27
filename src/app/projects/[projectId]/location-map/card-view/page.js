import { redirect } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/server'
import LocationCardViewEditor from '../../locations/LocationCardViewEditor'

export const dynamic = 'force-dynamic'

export default async function LocationCardViewPage({ params }) {
  const { projectId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [projectResult, locationsResult] = await Promise.all([
    supabase.from('projects').select('id, project_id, code, name').eq('id', projectId).maybeSingle(),
    supabase.from('locations').select('id, name, location_type').eq('project_id', projectId).order('sequence_number', { ascending: true }),
  ])
  if (!projectResult.data) redirect('/projects')

  return <LocationCardViewEditor project={projectResult.data} locations={locationsResult.data || []} userId={user.id} />
}
