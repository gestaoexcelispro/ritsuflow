'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import LanguageSelector from '@/components/LanguageSelector'
import { useT } from '@/lib/i18n/useT'

/** Commercial page frame: RitsuFlow logo (back to the workspaces), module name, sections and language. */
export default function CommercialShell({ children }: { children: ReactNode }) {
  const t = useT('commercial')
  const path = usePathname() || ''
  const link = (href: string, label: string, on: boolean) => (
    <Link href={href} aria-current={on ? 'page' : undefined} style={{
      padding: '8px 12px', borderRadius: 7, fontSize: 13, fontWeight: on ? 800 : 600, textDecoration: 'none',
      color: on ? '#075a53' : '#3f5862', background: on ? '#e3f3f1' : 'transparent',
    }}>{label}</Link>
  )
  return (
    <div style={{ minHeight: '100vh', background: '#f4f7f8' }}>
      <header style={{ minHeight: 56, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, padding: '4px 32px', background: '#fff', borderBottom: '1px solid #dfe7ea' }}>
        <Link href="/workspaces" title="RitsuFlow" style={{ display: 'flex', alignItems: 'center' }}>
          <Image src="/ritsu-logo.png" alt="RitsuFlow" width={92} height={46} priority style={{ display: 'block', height: 46, width: 'auto' }} />
        </Link>
        <span style={{ width: 1, height: 26, background: '#e2eaed' }} />
        <strong style={{ fontSize: 15, color: '#173441', letterSpacing: '.02em' }}>{t('module')}</strong>
        <nav aria-label={t('nav.label')} style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
          {link('/commercial', t('nav.bids'), path === '/commercial' || /^\/commercial\/(?!library)/.test(path))}
          {link('/commercial/library', t('nav.library'), path.startsWith('/commercial/library'))}
        </nav>
        <span style={{ flex: 1 }} />
        <LanguageSelector compact />
      </header>
      {children}
    </div>
  )
}
