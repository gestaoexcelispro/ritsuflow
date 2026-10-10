'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { currentOrganizationId } from '@/lib/commercial/library'
import { useT } from '@/lib/i18n/useT'
import { AppShell, Icon, ui as shell } from '../fieldop/ui'
import { CommercialAccessProvider, NEW_BID_EVENT, type CommercialAccess } from './license'

const screen = { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f4f7f8', color: '#536d78', font: '600 14px Arial, sans-serif' } as const

/** Commercial workspace, in the standard RitsuFlow frame (same header and tab bar as Projects and FieldOp). */
export default function CommercialLayout({ children }: { children: ReactNode }) {
  const t = useT('commercial')
  const router = useRouter()
  const pathname = usePathname() || ''
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
      const isLicensed = !licensed.error && licensed.data === true
      // What the database would allow; before the permissions function exists, the license decides.
      const perms = await supabase.rpc('commercial_permissions', { p_organization_id: organizationId })
      if (!active) return
      const p = (perms.error ? null : perms.data) as { edit_library?: boolean; create_bids?: boolean } | null
      setAccess({
        licensed: isLicensed, isPlatformOwner: Boolean(owner.data), organizationId,
        canEditLibrary: isLicensed && (p ? p.edit_library === true : true),
        canCreateBids: isLicensed && (p ? p.create_bids === true : true),
      })
    })
    return () => { active = false }
  }, [router])

  if (!access) return <main style={screen}>{t('loading')}</main>

  const newBid = () => {
    if (pathname === '/commercial') window.dispatchEvent(new Event(NEW_BID_EVENT))
    else router.push('/commercial#new')
  }
  const action = access.canCreateBids
    ? <button type="button" className={shell.btnPrimary} onClick={newBid}><Icon name="plus" size={18} />{t('bids.new')}</button>
    : false

  return (
    <CommercialAccessProvider value={access}>
      <AppShell module="commercial" projectId={undefined} active={pathname.startsWith('/commercial/library') ? 'library' : 'bids'} action={action} bare>
        {!access.licensed && (
          <div role="status" style={{ margin: '16px 32px 0', padding: '10px 14px', borderRadius: 8, background: '#fff4e8', color: '#6e3610', fontSize: 13 }}>
            {t('license.readOnly')}
          </div>
        )}
        {children}
      </AppShell>
    </CommercialAccessProvider>
  )
}
