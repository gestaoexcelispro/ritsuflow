'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

/** Name and company role of the signed-in user. */
export function useFieldOpUser() {
  const [user, setUser] = useState({ name: '', role: '' })
  useEffect(() => {
    let alive = true
    async function load() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser || !alive) return
      const [profile, member] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', authUser.id).maybeSingle(),
        supabase.from('organization_members').select('role').eq('user_id', authUser.id).eq('status', 'active').limit(1).maybeSingle(),
      ])
      if (!alive) return
      setUser({ name: profile.data?.full_name || authUser.email || '', role: member.data?.role || '' })
    }
    load()
    return () => { alive = false }
  }, [])
  return user
}
