"use client";

import { useEffect, useRef, useState } from "react";
import { NodeEditor, ClassicPreset } from "rete";
import { AreaPlugin, AreaExtensions } from "rete-area-plugin";
import { ConnectionPlugin, Presets as ConnectionPresets } from "rete-connection-plugin";
import { ReactPlugin, Presets as ReactPresets } from "rete-react-plugin";
import { createRoot } from "react-dom/client";

export default function WorkflowLabCanvas() {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("Starting Rete.js...");

  useEffect(() => {
    if (!containerRef.current) return;

    let destroyed = false;
    let area;

    async function createEditor() {
      const socket = new ClassicPreset.Socket("ritsuflow-flow");
      const editor = new NodeEditor();
      area = new AreaPlugin(containerRef.current);
      const connection = new ConnectionPlugin();
      const render = new ReactPlugin({ createRoot });

      connection.addPreset(ConnectionPresets.classic.setup());
      render.addPreset(ReactPresets.classic.setup());

      editor.use(area);
      area.use(connection);
      area.use(render);

      AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
        accumulating: AreaExtensions.accumulateOnCtrl(),
      });
      AreaExtensions.simpleNodesOrder(area);

      const location = new ClassicPreset.Node("Location Created");
      location.addOutput("flow", new ClassicPreset.Output(socket, "Location"));

      const mapping = new ClassicPreset.Node("Check Mapping");
      mapping.addInput("in", new ClassicPreset.Input(socket, "Location"));
      mapping.addOutput("ready", new ClassicPreset.Output(socket, "Ready"));

      const fieldOp = new ClassicPreset.Node("FieldOp Ready");
      fieldOp.addInput("in", new ClassicPreset.Input(socket, "Ready"));

      await editor.addNode(location);
      await editor.addNode(mapping);
      await editor.addNode(fieldOp);

      await area.translate(location.id, { x: 80, y: 190 });
      await area.translate(mapping.id, { x: 410, y: 190 });
      await area.translate(fieldOp.id, { x: 740, y: 190 });

      await editor.addConnection(
        new ClassicPreset.Connection(location, "flow", mapping, "in")
      );
      await editor.addConnection(
        new ClassicPreset.Connection(mapping, "ready", fieldOp, "in")
      );

      await AreaExtensions.zoomAt(area, editor.getNodes());

      if (!destroyed) setStatus("Interactive canvas ready");
    }

    createEditor().catch((error) => {
      console.error("Workflow Lab initialization failed", error);
      if (!destroyed) setStatus(`Initialization failed: ${error?.message || "Unknown error"}`);
    });

    return () => {
      destroyed = true;
      if (area) area.destroy();
    };
  }, []);

  return (
    <div className="canvas-shell">
      <div className="canvas-toolbar">
        <div>
          <strong>Location Map Workflow — Prototype</strong>
          <span className="hint">Drag nodes · pan background · wheel to zoom</span>
        </div>
        <span className="status">Milestone 3 · {status}</span>
      </div>

      <div className="canvas-area" ref={containerRef} />

      <style jsx>{`
        .canvas-shell {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        .canvas-toolbar {
          min-height: 56px;
          padding: 0 18px;
          border-bottom: 1px solid #eaecf0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          font-size: 13px;
          background: #ffffff;
        }
        .canvas-toolbar > div {
          display: flex;
          align-items: baseline;
          gap: 12px;
        }
        .hint,
        .status {
          color: #667085;
          font-size: 12px;
        }
        .canvas-area {
          position: relative;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          background-color: #fafafa;
          background-image: radial-gradient(#d0d5dd 1px, transparent 1px);
          background-size: 20px 20px;
        }
        .canvas-area :global(.rete-node) {
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}
