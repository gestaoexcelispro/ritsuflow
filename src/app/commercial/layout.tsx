'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { currentOrganizationId } from '@/lib/commercial/library'
import { useT } from '@/lib/i18n/useT'
import { CommercialAccessProvider, type CommercialAccess } from './license'
import CommercialShell from './CommercialShell'

const screen = { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7f8', color: '#536d78', font: '600 14px Arial, sans-serif' } as const

/** Commercial workspace: signed-in users only; the license decides whether they can change things. */
export default function CommercialLayout({ children }: { children: ReactNode }) {
  const t = useT('commercial')
  const router = useRouter()
  const [access, setAccess] = useState<CommercialAccess | null>(null)

  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return
      const user = data?.user
      if (!user) { router.replace('/login'); return }
      const [licensed, owner, organizationId] = await Promise.all([
        supabase.rpc('has_workspace_access', { p_workspace_key: 'commercial' }),
        supabase.from('platform_user_roles').select('role').eq('user_id', user.id).eq('role', 'platform_owner').eq('is_active', true).maybeSingle(),
        currentOrganizationId(supabase),
      ])
      if (!active) return
      setAccess({ licensed: !licensed.error && licensed.data === true, isPlatformOwner: Boolean(owner.data), organizationId })
    })
    return () => { active = false }
  }, [router])

  if (!access) return <main style={screen}>{t('loading')}</main>
  return (
    <CommercialAccessProvider value={access}>
      <CommercialShell>
        {!access.licensed && (
          <div role="status" style={{ maxWidth: 1240, margin: '16px auto 0', padding: '10px 14px', borderRadius: 8, background: '#fff4e8', color: '#6e3610', fontSize: 13 }}>
            {t('license.readOnly')}
          </div>
        )}
        {children}
      </CommercialShell>
    </CommercialAccessProvider>
  )
}
