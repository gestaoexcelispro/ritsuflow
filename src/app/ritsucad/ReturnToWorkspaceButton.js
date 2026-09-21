'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

export default function ReturnToWorkspaceButton() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')

  // RitsuCAD can still be opened globally from the Workspace sidebar. In that
  // case there is no active project to return to, so the Projects workspace is
  // the safest destination. Project-document and location-mapping sessions keep
  // projectId in the URL and return directly to that project's record/workspace.
  const href = projectId
    ? `/projects/${encodeURIComponent(projectId)}`
    : '/projects'

  return (
    <Link
      href={href}
      title={projectId ? 'Return to Project Workspace' : 'Return to Projects'}
      style={{
        position: 'fixed',
        top: 6,
        left: 10,
        zIndex: 120,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        height: 32,
        padding: '0 12px',
        border: '1px solid #b9cad6',
        borderRadius: 7,
        background: '#ffffff',
        color: '#173f52',
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1,
        textDecoration: 'none',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 15, lineHeight: 1 }}>←</span>
      <span>Return to Workspace</span>
    </Link>
  )
}
