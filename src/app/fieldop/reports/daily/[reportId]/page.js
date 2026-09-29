'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function FieldOpDailyReportWorkspace() {
  const { reportId } = useParams();
  const router = useRouter();

  useEffect(() => {
    if (!reportId) return;

    router.replace(`/dashboard/projects/daily-reports/${reportId}`);
  }, [reportId, router]);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '32px',
        background: '#f8fafc',
        color: '#061b2f',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <strong>Opening Daily Report...</strong>
        <p style={{ marginTop: '8px', color: '#64748b' }}>
          FieldOp and Projects now use the same Daily Report workspace.
        </p>
      </div>
    </main>
  );
}
