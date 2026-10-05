'use client'

import type { ReactNode } from 'react'
import { useRitsuScopeBody } from '../ritsuscope/useRitsuScopeBody'

/** Public 3D share links (no sign-in). The language comes from the root LanguageProvider. */
export default function RitsuScopeShareLayout({ children }: { children: ReactNode }) {
  useRitsuScopeBody()
  return <>{children}</>
}
