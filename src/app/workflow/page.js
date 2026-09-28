'use client';

import { useEffect, useRef, useState } from 'react';
import { ClassicPreset, NodeEditor } from 'rete';
import { AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { ReactPlugin, Presets, ReactArea2D } from 'rete-react-plugin';
import { createRoot } from 'react-dom/client';

import {
  FIELDOP_NODE_DEFINITIONS,
  FIELDOP_NODE_TYPES,
  FIELDOP_V1_FLOW,
} from '../../lib/workflow/fieldop-workflow-domain';

import styles from './workflow.module.css';

const socket = new ClassicPreset.Socket('fieldop-flow');

function makeNode(type) {
  const definition = FIELDOP_NODE_DEFINITIONS[type];
  const node = new ClassicPreset.Node(definition?.label || type);

  node.meta = {
    type,
    kind: definition?.kind || 'context',
  };

  if (type !== FIELDOP_NODE_TYPES.PROJECT) {
    node.addInput('in', new ClassicPreset.Input(socket, 'Flow'));
  }

  if (type !== FIELDOP_NODE_TYPES.DAILY_REPORT) {
    node.addOutput('out', new ClassicPreset.Output(socket, 'Flow'));
  }

  return node;
}

async function createFieldOpEditor(container) {
  const editor = new NodeEditor();
  const area = new AreaPlugin(container);
  const connection = new ConnectionPlugin();
  const render = new ReactPlugin({ createRoot });

  render.addPreset(Presets.classic.setup());
  connection.addPreset(ConnectionPresets.classic.setup());

  editor.use(area);
  area.use(connection);
  area.use(render);

  const nodes = FIELDOP_V1_FLOW.map(makeNode);

  for (const node of nodes) {
    await editor.addNode(node);
  }

  for (let index = 0; index < nodes.length - 1; index += 1) {
    await editor.addConnection(
      new ClassicPreset.Connection(nodes[index], 'out', nodes[index + 1], 'in')
    );
  }

  const columns = 3;
  const xGap = 330;
  const yGap = 210;

  for (let index = 0; index < nodes.length; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    await area.translate(nodes[index].id, {
      x: 80 + column * xGap,
      y: 70 + row * yGap,
    });
  }

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  });

  AreaExtensions.simpleNodesOrder(area);

  setTimeout(() => {
    AreaExtensions.zoomAt(area, editor.getNodes());
  }, 50);

  return () => area.destroy();
}

export default function WorkflowPage() {
  const containerRef = useRef(null);
  const [status, setStatus] = useState('Loading workflow editor...');

  useEffect(() => {
    if (!containerRef.current) return undefined;

    let dispose;
    let cancelled = false;

    createFieldOpEditor(containerRef.current)
      .then((cleanup) => {
        if (cancelled) {
          cleanup();
          return;
        }

        dispose = cleanup;
        setStatus('FieldOp workflow prototype');
      })
      .catch((error) => {
        console.error('Rete workflow initialization failed:', error);
        setStatus('Workflow editor could not be initialized.');
      });

    return () => {
      cancelled = true;
      if (dispose) dispose();
    };
  }, []);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>RitsuFlow Workflow Lab</div>
          <h1>Projects + FieldOp</h1>
          <p>
            Visual orchestration prototype. Existing RitsuFlow modules remain the source of truth.
          </p>
        </div>

        <div className={styles.status}>{status}</div>
      </header>

      <section className={styles.legend}>
        <strong>v1 flow</strong>
        <span>Project</span>
        <span>Location</span>
        <span>Location QR</span>
        <span>Assignment</span>
        <span>Check In</span>
        <span>Work Package</span>
        <span>Execution</span>
        <span>Check Out</span>
        <span>Daily Report</span>
      </section>

      <section className={styles.canvasShell}>
        <div ref={containerRef} className={styles.canvas} />
      </section>
    </main>
  );
}
