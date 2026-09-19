import { supabase } from './supabase'

export async function getCurrentHistoryActor(){
  const { data: { user } } = await supabase.auth.getUser()
  if(!user) return { userId:null, name:'RitsuFlow User' }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name,display_name,email')
    .eq('user_id',user.id)
    .maybeSingle()

  return {
    userId:user.id,
    name:profile?.full_name || profile?.display_name || profile?.email || user.email || 'RitsuFlow User'
  }
}

export async function logProjectHistory({projectId,actionType,actionLabel,description='',entityType=null,entityId=null,metadata={}}){
  if(!projectId) return { error:new Error('Project ID is required for project history.') }
  const actor=await getCurrentHistoryActor()
  if(!actor.userId) return { error:new Error('A signed-in user is required to write project history.') }

  return supabase.from('project_history').insert({
    project_id:projectId,
    action_type:actionType,
    action_label:actionLabel,
    description:description || null,
    entity_type:entityType,
    entity_id:entityId ? String(entityId) : null,
    performed_by:actor.userId,
    performed_by_name:actor.name,
    metadata:metadata || {}
  })
}
