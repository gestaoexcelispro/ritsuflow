'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from '../fieldop/ui'
import { usePreconProjectId } from './preconProject'

// PreCon pages and the tab that marks each one as active.
const TABS = [
  ['/dashboard/planning/master-plan', 'masterPlan'],
  ['/dashboard/planning/pull-planning', 'pull'],
  ['/dashboard/planning/lookahead', 'lookahead'],
  ['/dashboard/planning/constraints', 'constraints'],
  ['/dashboard/planning/weekly-planning', 'weekly'],
]

function activeTab(pathname) {
  const match = TABS.find(([href]) => pathname === href || pathname.startsWith(`${href}/`))
  if (match) return match[1]
  return pathname === '/dashboard' ? 'overview' : undefined
}

export default function PreconLayout({ children }) {
  const pathname = usePathname() || ''
  const projectId = usePreconProjectId()

  // Full-height planning pages manage their own frame (precon.module.css .frame).
  const bare = pathname.startsWith('/dashboard/planning/master-plan')

  return <AppShell module="precon" active={activeTab(pathname)} projectId={projectId} action={false} bare={bare}>
    {children}
  </AppShell>
}
