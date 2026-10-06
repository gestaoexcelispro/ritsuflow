'use client'

import Link from 'next/link'
import { useT } from '@/lib/i18n/useT'
import { ui } from './ui'

/** Commercial home: the bids list (next step). For now it points to the Library. */
export default function CommercialHome() {
  const t = useT('commercial')
  return (
    <section style={ui.page}>
      <header style={ui.header}>
        <div style={ui.eyebrow}>{t('module').toUpperCase()}</div>
        <h1 style={ui.title}>{t('nav.bids')}</h1>
      </header>
      <div style={ui.empty}>
        <Link href="/commercial/library" style={{ ...ui.button, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>{t('nav.library')}</Link>
      </div>
    </section>
  )
}
