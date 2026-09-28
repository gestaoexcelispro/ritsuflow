"use client";

import dynamic from "next/dynamic";

const WorkflowLabCanvas = dynamic(() => import("./WorkflowLabCanvas"), {
  ssr: false,
  loading: () => (
    <div className="workflow-lab-loading">Loading Workflow Lab...</div>
  ),
});

export default function WorkflowLabPage() {
  return (
    <main className="workflow-lab-page">
      <header className="workflow-lab-header">
        <div>
          <div className="workflow-lab-eyebrow">RitsuFlow™ Experimental</div>
          <h1>Workflow Lab</h1>
          <p>
            Isolated Rete.js proof of concept. No Supabase writes and no production
            workflow execution.
          </p>
        </div>
        <div className="workflow-lab-badge">LAB</div>
      </header>

      <section className="workflow-lab-stage">
        <WorkflowLabCanvas />
      </section>

      <style jsx>{`
        .workflow-lab-page {
          min-height: 100vh;
          padding: 24px;
          background: #f5f7fa;
          color: #172033;
        }
        .workflow-lab-header {
          max-width: 1500px;
          margin: 0 auto 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
        }
        .workflow-lab-eyebrow {
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #667085;
        }
        h1 {
          margin: 4px 0 4px;
          font-size: 30px;
        }
        p {
          margin: 0;
          color: #667085;
          font-size: 14px;
        }
        .workflow-lab-badge {
          border: 1px solid #d0d5dd;
          border-radius: 999px;
          padding: 8px 14px;
          background: white;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }
        .workflow-lab-stage {
          max-width: 1500px;
          height: calc(100vh - 145px);
          min-height: 560px;
          margin: 0 auto;
          overflow: hidden;
          border: 1px solid #d0d5dd;
          border-radius: 14px;
          background: white;
          box-shadow: 0 8px 28px rgba(16, 24, 40, 0.08);
        }
        .workflow-lab-loading {
          height: 100%;
          display: grid;
          place-items: center;
          color: #667085;
          font-size: 14px;
        }
      `}</style>
    </main>
  );
}
