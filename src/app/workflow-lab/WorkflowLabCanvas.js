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
  const [opacity, setOpacity] = useState(35);
  const [tagVisible, setTagVisible] = useState(true);
  const [printAreaReady, setPrintAreaReady] = useState(true);

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
      editor.use(area); area.use(connection); area.use(render);
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
      const appearance = makeNode("06 · APPEARANCE · CONFIGURABLE", "Area", "Appearance", [["note", "Use configuration panel →"]]);
      const printArea = makeNode("07 · PRINT AREA · CONFIGURABLE", "Appearance", "Print Area", [["note", "Use configuration panel →"]]);
      const report = makeNode("08 · LOCATION REPORT", "Print Area", "Report", [["state", "A4 location picture / PDF"]]);
      const qr = makeNode("09 · QR / LOCATION SIGN", "Report", "Sign", [["state", "Field identification ready"]]);
      const readiness = new ClassicPreset.Node("10 · LOCATION READINESS");
      readiness.addInput("in", new ClassicPreset.Input(flow, "Sign"));
      readiness.addControl("check", new ClassicPreset.InputControl("text", { initial: "Evaluated in Milestone 7", readonly: true }));
      readiness.addOutput("ready", new ClassicPreset.Output(flow, "Ready"));
      readiness.addOutput("action", new ClassicPreset.Output(flow, "Action Required"));
      const fieldOp = makeNode("11 · FIELDOP READY", "Ready", null, [["state", "Location operational"]]);
      const action = makeNode("ACTION REQUIRED", "Action Required", null, [["state", "Complete missing Location setup"]]);
      const nodes = [location,drawing,calibration,mapping,areaNode,appearance,printArea,report,qr,readiness,fieldOp,action];
      for (const node of nodes) await editor.addNode(node);
      const positions = [[location,40,170],[drawing,340,170],[calibration,640,170],[mapping,940,170],[areaNode,1240,170],[appearance,1540,170],[printArea,1840,170],[report,2140,170],[qr,2440,170],[readiness,2740,170],[fieldOp,3070,70],[action,3070,330]];
      for (const [node,x,y] of positions) await area.translate(node.id,{x,y});
      const chain=[location,drawing,calibration,mapping,areaNode,appearance,printArea,report,qr];
      for(let i=0;i<chain.length-1;i++) await editor.addConnection(new ClassicPreset.Connection(chain[i],"out",chain[i+1],"in"));
      await editor.addConnection(new ClassicPreset.Connection(qr,"out",readiness,"in"));
      await editor.addConnection(new ClassicPreset.Connection(readiness,"ready",fieldOp,"in"));
      await editor.addConnection(new ClassicPreset.Connection(readiness,"action",action,"in"));
      await AreaExtensions.zoomAt(area, editor.getNodes());
      if (!destroyed) setStatus("Configuration controls ready");
    }
    createEditor().catch((error)=>{ console.error("Workflow Lab initialization failed",error); if(!destroyed)setStatus(`Initialization failed: ${error?.message||"Unknown error"}`); });
    return()=>{destroyed=true;if(area)area.destroy();};
  },[]);

  return <div className="shell">
    <div className="toolbar"><div><strong>Location Map Workflow — Configuration Prototype</strong><span>Drag · pan · zoom</span></div><span>Milestone 6 · {status}</span></div>
    <div className="workspace"><div className="canvas" ref={containerRef}/><aside>
      <div className="eyebrow">NODE CONFIGURATION</div><h3>Appearance</h3>
      <label>Transparency <b>{opacity}%</b></label><input type="range" min="0" max="100" value={opacity} onChange={e=>setOpacity(Number(e.target.value))}/>
      <label className="check"><input type="checkbox" checked={tagVisible} onChange={e=>setTagVisible(e.target.checked)}/> Show Location Tag</label>
      <div className="preview" style={{opacity:Math.max(.12,1-opacity/100)}}>ROOM 1</div>
      <div className="divider"/><h3>Print Area</h3>
      <label className="check"><input type="checkbox" checked={printAreaReady} onChange={e=>setPrintAreaReady(e.target.checked)}/> Print area configured</label>
      <div className="summary"><div>Transparency <b>{opacity}%</b></div><div>Tag <b>{tagVisible?"ON":"OFF"}</b></div><div>Print Area <b>{printAreaReady?"READY":"MISSING"}</b></div></div>
      <p>Prototype state only. Nothing is written to Supabase or Location Map.</p>
    </aside></div>
    <style jsx>{`
      .shell{height:100%;display:flex;flex-direction:column}.toolbar{min-height:56px;padding:0 18px;border-bottom:1px solid #eaecf0;display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:12px;background:#fff}.toolbar>div{display:flex;align-items:baseline;gap:12px}.toolbar span{color:#667085}.workspace{display:flex;flex:1;min-height:0}.canvas{position:relative;flex:1;min-width:0;overflow:hidden;background-color:#fafafa;background-image:radial-gradient(#d0d5dd 1px,transparent 1px);background-size:20px 20px}aside{width:280px;padding:20px;border-left:1px solid #eaecf0;background:#fff;overflow:auto;color:#344054}aside h3{margin:5px 0 16px;color:#101828}.eyebrow{font-size:10px;font-weight:800;letter-spacing:.12em;color:#98a2b3}label{display:flex;justify-content:space-between;gap:12px;font-size:12px;margin:12px 0}.check{justify-content:flex-start;align-items:center}input[type=range]{width:100%}.preview{margin:18px 0;padding:26px 12px;border:2px solid #475467;border-radius:8px;background:#667085;color:white;text-align:center;font-weight:800;transition:opacity .15s}.divider{height:1px;background:#eaecf0;margin:22px 0}.summary{margin-top:18px;padding:12px;border-radius:8px;background:#f9fafb;font-size:11px}.summary div{display:flex;justify-content:space-between;margin:6px 0}aside p{margin-top:16px;color:#98a2b3;font-size:10px;line-height:1.5}.canvas :global(.rete-node){font-family:inherit}
    `}</style>
  </div>;
}
