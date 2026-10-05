'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

export const WORKSPACE_KEYS = ['projects', 'precon', 'fieldop', 'ritsuscope']

/** organization_modules keys vary ("ritsucad", "field_op"…); this maps them to the four workspaces. */
export function workspaceKey(value = '') {
  const key = String(value).toLowerCase().replaceAll('_', '').replaceAll('-', '').replaceAll(' ', '')
  if (key.includes('ritsuscope') || key.includes('ritsucad') || key.includes('cad')) return 'ritsuscope'
  if (key.includes('precon')) return 'precon'
  if (key.includes('fieldop') || key.includes('field')) return 'fieldop'
  if (key.includes('project')) return 'projects'
  return String(value).toLowerCase()
}

/** The signed-in user's company, their role in it, and its module rows. */
export function useOrgModules(errorMessage) {
  const router = useRouter()
  const [state, setState] = useState({ loading: true, organization: null, modules: [], role: '', error: '' })
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const user = auth?.user
        if (!user) { router.replace('/login'); return }
        const { data: memberships, error: membershipError } = await supabase.from('organization_members').select('organization_id,role,status').eq('user_id', user.id).eq('status', 'active')
        if (membershipError) throw membershipError
        const membership = memberships?.find((item) => ['owner', 'admin'].includes(item.role)) || memberships?.[0]
        if (!membership?.organization_id) throw new Error(errorMessage)
        const [{ data: org, error: orgError }, { data: orgModules, error: moduleError }] = await Promise.all([
          supabase.from('organizations').select('id,name,slug,organization_number').eq('id', membership.organization_id).single(),
          supabase.from('organization_modules').select('module_key,is_enabled,enabled_at,disabled_at').eq('organization_id', membership.organization_id),
        ])
        if (orgError) throw orgError
        if (moduleError) throw moduleError
        if (alive) setState({ loading: false, organization: org, modules: orgModules || [], role: membership.role || '', error: '' })
      } catch (err) {
        if (alive) setState((s) => ({ ...s, loading: false, error: err?.message || errorMessage }))
      }
    })()
    return () => { alive = false }
  }, [router]) // eslint-disable-line react-hooks/exhaustive-deps
  return state
}
