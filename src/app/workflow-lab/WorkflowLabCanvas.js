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
      const flow = new ClassicPreset.Socket("ritsuflow-flow");
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

      const location = new ClassicPreset.Node("LOCATION · Room 1");
      location.addControl("building", new ClassicPreset.InputControl("text", { initial: "Building A", readonly: true }));
      location.addControl("level", new ClassicPreset.InputControl("text", { initial: "Level 1", readonly: true }));
      location.addOutput("location", new ClassicPreset.Output(flow, "Location"));

      const drawing = new ClassicPreset.Node("DRAWING ASSIGNED");
      drawing.addInput("location", new ClassicPreset.Input(flow, "Location"));
      drawing.addControl("drawing", new ClassicPreset.InputControl("text", { initial: "Floor Plan · Page 1", readonly: true }));
      drawing.addOutput("drawing", new ClassicPreset.Output(flow, "Drawing"));

      const calibration = new ClassicPreset.Node("SCALE CALIBRATED");
      calibration.addInput("drawing", new ClassicPreset.Input(flow, "Drawing"));
      calibration.addControl("state", new ClassicPreset.InputControl("text", { initial: "✓ Ready", readonly: true }));
      calibration.addOutput("calibrated", new ClassicPreset.Output(flow, "Calibrated"));

      const mapping = new ClassicPreset.Node("LOCATION MAPPED");
      mapping.addInput("calibrated", new ClassicPreset.Input(flow, "Calibrated"));
      mapping.addControl("area", new ClassicPreset.InputControl("text", { initial: "Area · 25.99 m²", readonly: true }));
      mapping.addOutput("mapped", new ClassicPreset.Output(flow, "Mapped"));

      const readiness = new ClassicPreset.Node("LOCATION READINESS");
      readiness.addInput("mapped", new ClassicPreset.Input(flow, "Mapped"));
      readiness.addControl("check", new ClassicPreset.InputControl("text", { initial: "Mapping ✓  Area ✓  Print Area ?", readonly: true }));
      readiness.addOutput("ready", new ClassicPreset.Output(flow, "Ready"));
      readiness.addOutput("action", new ClassicPreset.Output(flow, "Action Required"));

      const fieldOp = new ClassicPreset.Node("FIELDOP READY");
      fieldOp.addInput("ready", new ClassicPreset.Input(flow, "Ready"));
      fieldOp.addControl("state", new ClassicPreset.InputControl("text", { initial: "Location operational", readonly: true }));

      const action = new ClassicPreset.Node("ACTION REQUIRED");
      action.addInput("action", new ClassicPreset.Input(flow, "Action Required"));
      action.addControl("state", new ClassicPreset.InputControl("text", { initial: "Complete missing setup", readonly: true }));

      const nodes = [location, drawing, calibration, mapping, readiness, fieldOp, action];
      for (const node of nodes) await editor.addNode(node);

      await area.translate(location.id, { x: 40, y: 180 });
      await area.translate(drawing.id, { x: 340, y: 180 });
      await area.translate(calibration.id, { x: 640, y: 180 });
      await area.translate(mapping.id, { x: 940, y: 180 });
      await area.translate(readiness.id, { x: 1240, y: 180 });
      await area.translate(fieldOp.id, { x: 1560, y: 70 });
      await area.translate(action.id, { x: 1560, y: 320 });

      const connections = [
        new ClassicPreset.Connection(location, "location", drawing, "location"),
        new ClassicPreset.Connection(drawing, "drawing", calibration, "drawing"),
        new ClassicPreset.Connection(calibration, "calibrated", mapping, "calibrated"),
        new ClassicPreset.Connection(mapping, "mapped", readiness, "mapped"),
        new ClassicPreset.Connection(readiness, "ready", fieldOp, "ready"),
        new ClassicPreset.Connection(readiness, "action", action, "action"),
      ];
      for (const edge of connections) await editor.addConnection(edge);

      await AreaExtensions.zoomAt(area, editor.getNodes());
      if (!destroyed) setStatus("Construction workflow ready");
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
          <strong>Location Map Workflow — Construction Prototype</strong>
          <span className="hint">Drag nodes · pan background · wheel to zoom</span>
        </div>
        <span className="status">Milestone 4 · {status}</span>
      </div>
      <div className="canvas-area" ref={containerRef} />
      <style jsx>{`
        .canvas-shell { height: 100%; display: flex; flex-direction: column; }
        .canvas-toolbar { min-height: 56px; padding: 0 18px; border-bottom: 1px solid #eaecf0; display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 13px; background: #fff; }
        .canvas-toolbar > div { display: flex; align-items: baseline; gap: 12px; }
        .hint, .status { color: #667085; font-size: 12px; }
        .canvas-area { position: relative; flex: 1; min-height: 0; overflow: hidden; background-color: #fafafa; background-image: radial-gradient(#d0d5dd 1px, transparent 1px); background-size: 20px 20px; }
        .canvas-area :global(.rete-node) { font-family: inherit; }
      `}</style>
    </div>
  );
}
