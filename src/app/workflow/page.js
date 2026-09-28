'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ClassicPreset, NodeEditor } from 'rete';
import { AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { ReactPlugin, Presets } from 'rete-react-plugin';
import { createRoot } from 'react-dom/client';

import { createClient } from '../../lib/supabase/client';
import { FIELDOP_NODE_DEFINITIONS, FIELDOP_NODE_TYPES, FIELDOP_V1_FLOW } from '../../lib/workflow/fieldop-workflow-domain';
import { buildWorkflowLocationContext, buildWorkflowProjectContext, loadWorkflowLocations, loadWorkflowProjects } from '../../lib/workflow/fieldop-workflow-data';
import { buildWorkflowAssignmentContext, getWorkflowWorkerLabel, loadWorkflowProjectAssignments } from '../../lib/workflow/fieldop-assignment-data';
import { createLocationQrPayload } from '../../lib/workflow/location-qr';
import styles from './workflow.module.css';

const socket = new ClassicPreset.Socket('fieldop-flow');

function makeNode(type) {
  const definition = FIELDOP_NODE_DEFINITIONS[type];
  const node = new ClassicPreset.Node(definition?.label || type);
  node.meta = { type, kind: definition?.kind || 'context' };
  if (type !== FIELDOP_NODE_TYPES.PROJECT) node.addInput('in', new ClassicPreset.Input(socket, 'Flow'));
  if (type !== FIELDOP_NODE_TYPES.DAILY_REPORT) node.addOutput('out', new ClassicPreset.Output(socket, 'Flow'));
  return node;
}

async function createFieldOpEditor(container) {
  const editor = new NodeEditor();
  const area = new AreaPlugin(container);
  const connection = new ConnectionPlugin();
  const render = new ReactPlugin({ createRoot });
  render.addPreset(Presets.classic.setup());
  connection.addPreset(ConnectionPresets.classic.setup());
  editor.use(area); area.use(connection); area.use(render);
  const nodes = FIELDOP_V1_FLOW.map(makeNode);
  for (const node of nodes) await editor.addNode(node);
  for (let i = 0; i < nodes.length - 1; i += 1) await editor.addConnection(new ClassicPreset.Connection(nodes[i], 'out', nodes[i + 1], 'in'));
  for (let i = 0; i < nodes.length; i += 1) await area.translate(nodes[i].id, { x: 80 + (i % 3) * 330, y: 70 + Math.floor(i / 3) * 210 });
  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), { accumulating: AreaExtensions.accumulateOnCtrl() });
  AreaExtensions.simpleNodesOrder(area);
  setTimeout(() => AreaExtensions.zoomAt(area, editor.getNodes()), 50);
  return () => area.destroy();
}

export default function WorkflowPage() {
  const containerRef = useRef(null);
  const supabaseRef = useRef(null);
  const [status, setStatus] = useState('Loading workflow editor...');
  const [projects, setProjects] = useState([]);
  const [locations, setLocations] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedLocationId, setSelectedLocationId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [dataError, setDataError] = useState('');
  if (!supabaseRef.current) supabaseRef.current = createClient();

  useEffect(() => {
    if (!containerRef.current) return undefined;
    let dispose; let cancelled = false;
    createFieldOpEditor(containerRef.current).then((cleanup) => { if (cancelled) return cleanup(); dispose = cleanup; setStatus('FieldOp workflow prototype'); }).catch((error) => { console.error('Rete workflow initialization failed:', error); setStatus('Workflow editor could not be initialized.'); });
    return () => { cancelled = true; if (dispose) dispose(); };
  }, []);

  useEffect(() => {
    let active = true;
    loadWorkflowProjects(supabaseRef.current).then((rows) => { if (active) { setProjects(rows); setDataError(''); } }).catch((error) => { console.error(error); if (active) setDataError('Projects could not be loaded.'); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setSelectedLocationId(''); setSelectedAssignmentId(''); setLocations([]); setAssignments([]);
    if (!selectedProjectId) return undefined;
    Promise.all([
      loadWorkflowLocations(supabaseRef.current, selectedProjectId),
      loadWorkflowProjectAssignments(supabaseRef.current, selectedProjectId),
    ]).then(([locationRows, assignmentRows]) => {
      if (!active) return;
      setLocations(locationRows); setAssignments(assignmentRows); setDataError('');
    }).catch((error) => { console.error('Workflow project context could not be loaded:', error); if (active) setDataError('Project locations or workers could not be loaded.'); });
    return () => { active = false; };
  }, [selectedProjectId]);

  const selectedProject = projects.find((row) => row.id === selectedProjectId) || null;
  const selectedLocation = locations.find((row) => row.id === selectedLocationId) || null;
  const selectedAssignment = assignments.find((row) => row.id === selectedAssignmentId) || null;
  const workflowContext = { ...buildWorkflowProjectContext(selectedProject), ...buildWorkflowLocationContext(selectedLocation), ...buildWorkflowAssignmentContext(selectedAssignment) };
  const locationQrPayload = selectedProjectId && selectedLocationId ? createLocationQrPayload({ projectId: selectedProjectId, locationId: selectedLocationId }) : '';

  return (
    <main className={styles.page}>
      <header className={styles.header}><div><div className={styles.eyebrow}>RitsuFlow Workflow Lab</div><h1>Projects + FieldOp</h1><p>Visual orchestration prototype. Existing RitsuFlow modules remain the source of truth.</p></div><div className={styles.status}>{status}</div></header>
      <section className={styles.contextPanel}>
        <div className={styles.contextField}><label htmlFor="workflow-project">Project</label><select id="workflow-project" value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}><option value="">Select a project</option>{projects.map((row) => <option key={row.id} value={row.id}>{row.code ? `${row.code} · ` : ''}{row.name}</option>)}</select></div>
        <div className={styles.contextField}><label htmlFor="workflow-location">Location</label><select id="workflow-location" value={selectedLocationId} disabled={!selectedProjectId} onChange={(e) => setSelectedLocationId(e.target.value)}><option value="">{selectedProjectId ? 'Select a location' : 'Select a project first'}</option>{locations.map((row) => <option key={row.id} value={row.id}>{row.code ? `${row.code} · ` : ''}{row.name}</option>)}</select></div>
        <div className={styles.contextField}><label htmlFor="workflow-worker">Assigned worker</label><select id="workflow-worker" value={selectedAssignmentId} disabled={!selectedProjectId} onChange={(e) => setSelectedAssignmentId(e.target.value)}><option value="">{selectedProjectId ? 'Select an assigned worker' : 'Select a project first'}</option>{assignments.map((row) => <option key={row.id} value={row.id}>{getWorkflowWorkerLabel(row)}</option>)}</select></div>
      </section>
      {dataError ? <div className={styles.dataError}>{dataError}</div> : null}
      {locationQrPayload ? <section className={styles.qrPanel}><div className={styles.qrGraphic}><QRCodeSVG value={locationQrPayload} size={132} level="M" marginSize={2} /></div><div className={styles.qrCopy}><span>Location QR · v1</span><h2>{selectedLocation?.name}</h2><p>{selectedProject?.name}</p><small>Location identifies the place. The selected active assignment identifies the worker separately.</small></div></section> : null}
      <section className={styles.legend}><strong>v1 flow</strong><span>Project</span><span>Location</span><span>Location QR</span><span>Assignment</span><span>Check In</span><span>Work Package</span><span>Execution</span><span>Check Out</span><span>Daily Report</span></section>
      <section className={styles.contextCode}><span>Active workflow context</span><code>{JSON.stringify(workflowContext)}</code></section>
      <section className={styles.canvasShell}><div ref={containerRef} className={styles.canvas} /></section>
    </main>
  );
}
