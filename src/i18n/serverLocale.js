import { DEFAULT_LOCALE, normalizeLocale } from './config'

export async function resolveOrganizationLocale(supabase, userId) {
  if (!supabase || !userId) return DEFAULT_LOCALE

  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('role,status,organizations(default_locale)')
    .eq('user_id', userId)
    .eq('status', 'active')

  if (error) {
    console.error('Organization locale could not be resolved.', error)
    return DEFAULT_LOCALE
  }

  const membership = memberships?.find(item => ['owner', 'admin'].includes(item.role)) || memberships?.[0]
  return normalizeLocale(membership?.organizations?.default_locale)
}
