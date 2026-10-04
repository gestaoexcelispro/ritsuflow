'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'

/** RitsuScope workspace: signed-in users only (like the other RitsuFlow workspaces), with its own language settings. */
export default function RitsuScopeLayout({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true
    createClient().auth.getUser().then(({ data }) => {
      if (!active) return
      if (!data?.user) { router.replace('/login'); return }
      setReady(true)
    })
    return () => { active = false }
  }, [router])

  if (!ready) return <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7f8', color: '#536d78', font: '600 14px Arial, sans-serif' }}>Loading RitsuScope…</main>
  return <LanguageProvider>{children}</LanguageProvider>
}
