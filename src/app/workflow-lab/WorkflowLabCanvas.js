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
      AreaExtensions.selectableNodes(area, AreaExtensions.selector(), { accumulating: AreaExtensions.accumulateOnCtrl() });
      AreaExtensions.simpleNodesOrder(area);

      const makeNode = (title, input, output, controls = []) => {
        const node = new ClassicPreset.Node(title);
        if (input) node.addInput("in", new ClassicPreset.Input(flow, input));
        controls.forEach(([key, value]) => node.addControl(key, new ClassicPreset.InputControl("text", { initial: value, readonly: true })));
        if (output) node.addOutput("out", new ClassicPreset.Output(flow, output));
        return node;
      };

      const location = makeNode("01 · LOCATION SELECTED", null, "Location", [["location", "Room 1 · Building A · Level 1"]]);
      const drawing = makeNode("02 · DRAWING ASSIGNED", "Location", "Drawing", [["drawing", "Floor Plan · Page 1"]]);
      const calibration = makeNode("03 · SCALE CALIBRATION", "Drawing", "Calibrated", [["scale", "Calibration available ✓"]]);
      const mapping = makeNode("04 · MAP LOCATION", "Calibrated", "Mapped", [["geometry", "Polygon geometry saved ✓"]]);
      const areaNode = makeNode("05 · AREA CALCULATED", "Mapped", "Area", [["area", "25.99 m²"]]);
      const appearance = makeNode("06 · APPEARANCE", "Area", "Appearance", [["color", "Color · Location style"], ["opacity", "Transparency · 35%"], ["tag", "Location tag · ON"]]);
      const printArea = makeNode("07 · PRINT AREA", "Appearance", "Print Area", [["state", "Report viewport configured"]]);
      const report = makeNode("08 · LOCATION REPORT", "Print Area", "Report", [["state", "A4 location picture / PDF"]]);
      const qr = makeNode("09 · QR / LOCATION SIGN", "Report", "Sign", [["state", "Field identification ready"]]);

      const readiness = new ClassicPreset.Node("10 · LOCATION READINESS");
      readiness.addInput("in", new ClassicPreset.Input(flow, "Sign"));
      readiness.addControl("check", new ClassicPreset.InputControl("text", { initial: "Drawing ✓  Scale ✓  Map ✓  Area ✓  Print ✓  QR ✓", readonly: true }));
      readiness.addOutput("ready", new ClassicPreset.Output(flow, "Ready"));
      readiness.addOutput("action", new ClassicPreset.Output(flow, "Action Required"));

      const fieldOp = makeNode("11 · FIELDOP READY", "Ready", null, [["state", "Location operational ✓"]]);
      const action = makeNode("ACTION REQUIRED", "Action Required", null, [["state", "Complete missing Location setup"]]);

      const nodes = [location, drawing, calibration, mapping, areaNode, appearance, printArea, report, qr, readiness, fieldOp, action];
      for (const node of nodes) await editor.addNode(node);

      const positions = [
        [location, 40, 170], [drawing, 340, 170], [calibration, 640, 170], [mapping, 940, 170],
        [areaNode, 1240, 170], [appearance, 1540, 170], [printArea, 1840, 170], [report, 2140, 170],
        [qr, 2440, 170], [readiness, 2740, 170], [fieldOp, 3070, 70], [action, 3070, 330],
      ];
      for (const [node, x, y] of positions) await area.translate(node.id, { x, y });

      const chain = [location, drawing, calibration, mapping, areaNode, appearance, printArea, report, qr];
      for (let i = 0; i < chain.length - 1; i++) {
        await editor.addConnection(new ClassicPreset.Connection(chain[i], "out", chain[i + 1], "in"));
      }
      await editor.addConnection(new ClassicPreset.Connection(qr, "out", readiness, "in"));
      await editor.addConnection(new ClassicPreset.Connection(readiness, "ready", fieldOp, "in"));
      await editor.addConnection(new ClassicPreset.Connection(readiness, "action", action, "in"));

      await AreaExtensions.zoomAt(area, editor.getNodes());
      if (!destroyed) setStatus("Full Location Map lifecycle ready");
    }

    createEditor().catch((error) => {
      console.error("Workflow Lab initialization failed", error);
      if (!destroyed) setStatus(`Initialization failed: ${error?.message || "Unknown error"}`);
    });
    return () => { destroyed = true; if (area) area.destroy(); };
  }, []);

  return (
    <div className="canvas-shell">
      <div className="canvas-toolbar">
        <div><strong>Location Map Workflow — Full Lifecycle Prototype</strong><span className="hint">Drag nodes · pan background · wheel to zoom</span></div>
        <span className="status">Milestone 5 · {status}</span>
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
