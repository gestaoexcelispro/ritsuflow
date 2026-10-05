'use client'

import type { ReactNode } from 'react'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'

/** Public 3D share links (no sign-in). */
export default function RitsuScopeShareLayout({ children }: { children: ReactNode }) {
  return <LanguageProvider>{children}</LanguageProvider>
}
