'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { useRitsuScopeBody } from './useRitsuScopeBody'

const screen = { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7f8', color: '#536d78', font: '600 14px Arial, sans-serif' } as const

/**
 * RitsuScope workspace: signed-in users whose company license includes RitsuScope
 * (the platform owner always gets in), with its own language settings.
 */
export default function RitsuScopeLayout({ children }: { children: ReactNode }) {
  useRitsuScopeBody()
  const router = useRouter()
  const [state, setState] = useState<'checking' | 'ready' | 'unlicensed'>('checking')

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return
      if (!data?.user) { router.replace('/login'); return }
      const { data: allowed, error } = await supabase.rpc('has_workspace_access', { p_workspace_key: 'ritsuscope' })
      if (!active) return
      setState(!error && allowed === true ? 'ready' : 'unlicensed')
    })
    return () => { active = false }
  }, [router])

  if (state === 'checking') return <main style={screen}>Loading RitsuScope…</main>
  if (state === 'unlicensed') return (
    <main style={screen}>
      <div style={{ maxWidth: 420, padding: 28, borderRadius: 14, background: '#fff', boxShadow: '0 10px 30px rgba(16,32,57,.12)', textAlign: 'center', color: '#102039' }}>
        <div style={{ fontSize: 34, marginBottom: 8 }}>📏</div>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>RitsuScope is not included in your license</h1>
        <p style={{ fontWeight: 400, color: '#46556b', lineHeight: 1.45, margin: '0 0 18px' }}>
          Your company&apos;s RitsuFlow license does not include RitsuScope, or the license is not active. Contact your company administrator to add it.
        </p>
        <Link href="/workspaces" style={{ display: 'inline-block', padding: '10px 18px', borderRadius: 8, background: '#e0782a', color: '#fff', textDecoration: 'none', fontWeight: 800 }}>← Back to workspaces</Link>
      </div>
    </main>
  )
  return <LanguageProvider>{children}</LanguageProvider>
}
