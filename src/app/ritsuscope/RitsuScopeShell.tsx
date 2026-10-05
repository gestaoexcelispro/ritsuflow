'use client'

import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { useLanguage } from '@/lib/i18n/LanguageProvider'

/** RitsuScope page frame: RitsuFlow logo (back to the workspaces), module name and language. */
export default function RitsuScopeShell({ children }: { children: ReactNode }) {
  const { language, setLanguage } = useLanguage()
  return (
    <div style={{ minHeight: '100vh', background: '#f4f7f8' }}>
      <header style={{ height: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '0 20px', background: '#fff', borderBottom: '1px solid #dfe7ea' }}>
        <Link href="/workspaces" title="RitsuFlow" style={{ display: 'flex', alignItems: 'center' }}>
          <Image src="/ritsu-logo.png" alt="RitsuFlow" width={92} height={46} priority style={{ display: 'block', height: 46, width: 'auto' }} />
        </Link>
        <span style={{ width: 1, height: 26, background: '#e2eaed' }} />
        <strong style={{ fontSize: 15, color: '#173441', letterSpacing: '.02em' }}>RitsuScope</strong>
        <span style={{ flex: 1 }} />
        <select value={language} onChange={e => setLanguage(e.target.value as typeof language)} aria-label="Language" style={{ height: 30, border: '1px solid #d6e0e3', borderRadius: 7, fontSize: 12, background: '#fff' }}>
          <option value="pt-BR">Português</option>
          <option value="en-US">English</option>
        </select>
      </header>
      {children}
    </div>
  )
}
