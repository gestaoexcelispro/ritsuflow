'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import AttendancePage from '../../../../dashboard/field-management/workforce/attendance/page'

export default function FieldOpProjectWorkforcePage() {
  const { projectId } = useParams()

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fa', color: '#0f172a' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '18px 28px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.08em', color: '#64748b' }}>
            FIELD OPERATIONS / WORKFORCE
          </div>
          <h1 style={{ margin: '5px 0 0', fontSize: 24, color: '#061b2f' }}>Live Attendance</h1>
        </div>

        <Link
          href={`/fieldop/projects/${projectId}`}
          style={{
            padding: '9px 13px',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            background: '#fff',
            color: '#082a4a',
            fontWeight: 800,
            textDecoration: 'none',
          }}
        >
          ← Project Setup
        </Link>
      </header>

      <section style={{ padding: '26px 28px 40px' }}>
        <div
          style={{
            marginBottom: 18,
            padding: '12px 14px',
            border: '1px solid #bae6fd',
            borderRadius: 10,
            background: '#f0f9ff',
            color: '#075985',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          Native FieldOp workforce migration is active. This route currently reuses the proven attendance engine while we move the operational views into the FieldOp project context without breaking existing workforce controls.
        </div>

        <AttendancePage />
      </section>
    </main>
  )
}
