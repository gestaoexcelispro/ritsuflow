'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { useRitsuScopeBody } from './useRitsuScopeBody'
import { RitsuScopeLicenseProvider } from './license'

const screen = { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7f8', color: '#536d78', font: '600 14px Arial, sans-serif' } as const

/**
 * RitsuScope workspace: every signed-in RitsuFlow user can open it. Sheets, levels and zoning
 * (the Location Breakdown tools) are included for every company; the takeoff tools need the
 * RitsuScope license, read here once and shared through RitsuScopeLicenseProvider.
 */
export default function RitsuScopeLayout({ children }: { children: ReactNode }) {
  useRitsuScopeBody()
  const router = useRouter()
  const [licensed, setLicensed] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return
      if (!data?.user) { router.replace('/login'); return }
      const { data: allowed, error } = await supabase.rpc('has_workspace_access', { p_workspace_key: 'ritsuscope' })
      if (!active) return
      setLicensed(!error && allowed === true)
    })
    return () => { active = false }
  }, [router])

  if (licensed === null) return <main style={screen}>Loading RitsuScope…</main>
  return (
    <RitsuScopeLicenseProvider licensed={licensed}>
      <LanguageProvider>{children}</LanguageProvider>
    </RitsuScopeLicenseProvider>
  )
}
