'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function DailyReportDashboardBridgeLayout({ children }) {
  const params = useParams();
  const router = useRouter();
  const reportId = params?.reportId;

  useEffect(() => {
    if (!reportId) {
      return;
    }

    router.replace(`/daily-report/${reportId}`);
  }, [reportId, router]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: '#f4f7fa',
        color: '#1f2937',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          display: 'grid',
          gap: '8px',
          textAlign: 'center',
        }}
      >
        <strong>Opening Daily Report Workspace...</strong>
        <span style={{ fontSize: '0.85rem', color: '#667085' }}>
          Preparing the standalone workspace.
        </span>
      </div>

      <div style={{ display: 'none' }}>{children}</div>
    </div>
  );
}
