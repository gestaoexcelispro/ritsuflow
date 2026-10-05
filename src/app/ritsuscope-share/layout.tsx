'use client'

import type { ReactNode } from 'react'
import { LanguageProvider } from '@/lib/i18n/LanguageProvider'
import { useRitsuScopeBody } from '../ritsuscope/useRitsuScopeBody'

/** Public 3D share links (no sign-in). */
export default function RitsuScopeShareLayout({ children }: { children: ReactNode }) {
  useRitsuScopeBody()
  return <LanguageProvider>{children}</LanguageProvider>
}
