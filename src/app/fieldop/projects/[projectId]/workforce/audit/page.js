'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import AttendanceAuditPage from '../../../../../dashboard/field-management/workforce/attendance/audit/page'

export default function FieldOpProjectWorkforceAuditPage() {
  const { projectId } = useParams()

  return (
    <main style={{ minHeight: '100vh', background: '#f6f8fa', color: '#0f172a' }}>
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, padding:'18px 28px', borderBottom:'1px solid #e2e8f0', background:'#fff' }}>
        <div>
          <div style={{ fontSize:12, fontWeight:800, letterSpacing:'.08em', color:'#64748b' }}>FIELD OPERATIONS / WORKFORCE</div>
          <h1 style={{ margin:'5px 0 0', fontSize:24, color:'#061b2f' }}>Audit Trail</h1>
        </div>
        <nav style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <Link href={`/fieldop/projects/${projectId}/workforce`} style={linkStyle}>Live Attendance</Link>
          <Link href={`/fieldop/projects/${projectId}/workforce/timecards`} style={linkStyle}>Timecards</Link>
          <Link href={`/fieldop/projects/${projectId}/workforce/exceptions`} style={linkStyle}>Exceptions</Link>
          <Link href={`/fieldop/projects/${projectId}`} style={linkStyle}>← Project Setup</Link>
        </nav>
      </header>
      <section style={{ padding:'26px 28px 40px' }}>
        <AttendanceAuditPage projectId={projectId} projectLocked />
      </section>
    </main>
  )
}

const linkStyle={padding:'9px 13px',border:'1px solid #cbd5e1',borderRadius:8,background:'#fff',color:'#082a4a',fontWeight:800,textDecoration:'none'}
