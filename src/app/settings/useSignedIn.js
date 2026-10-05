'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

/** Redirects to the login page when nobody is signed in; returns true once the page can render. */
export function useSignedIn() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    let active = true
    supabase.auth.getUser().then(({ data }) => { if (!active) return; if (!data?.user) router.replace('/login'); else setReady(true) })
    return () => { active = false }
  }, [router])
  return ready
}
