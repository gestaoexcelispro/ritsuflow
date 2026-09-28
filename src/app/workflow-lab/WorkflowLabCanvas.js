"use client";

export default function WorkflowLabCanvas() {
  return (
    <div className="canvas-shell">
      <div className="canvas-toolbar">
        <strong>Location Map Workflow — Prototype</strong>
        <span>Milestone 2 · shell only</span>
      </div>

      <div className="canvas-area">
        <div className="placeholder">
          <div className="placeholder-title">Rete.js canvas boundary ready</div>
          <div className="placeholder-copy">
            The interactive node editor will be mounted here in Milestone 3.
          </div>
          <div className="flow-preview" aria-label="Prototype workflow preview">
            <div className="preview-node">Location Created</div>
            <div className="preview-arrow">→</div>
            <div className="preview-node">Check Mapping</div>
            <div className="preview-arrow">→</div>
            <div className="preview-node">FieldOp Ready</div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .canvas-shell {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .canvas-toolbar {
          min-height: 52px;
          padding: 0 18px;
          border-bottom: 1px solid #eaecf0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          font-size: 13px;
        }
        .canvas-toolbar span {
          color: #667085;
          font-size: 12px;
        }
        .canvas-area {
          position: relative;
          flex: 1;
          overflow: hidden;
          background-color: #fafafa;
          background-image: radial-gradient(#d0d5dd 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px;
          text-align: center;
        }
        .placeholder-title {
          font-size: 22px;
          font-weight: 800;
          color: #172033;
        }
        .placeholder-copy {
          margin-top: 6px;
          color: #667085;
          font-size: 14px;
        }
        .flow-preview {
          margin-top: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .preview-node {
          min-width: 160px;
          padding: 18px 20px;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          background: white;
          box-shadow: 0 4px 12px rgba(16, 24, 40, 0.08);
          font-size: 13px;
          font-weight: 700;
        }
        .preview-arrow {
          color: #98a2b3;
          font-size: 24px;
        }
      `}</style>
    </div>
  );
}
