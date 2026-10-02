import { ClassicPreset, NodeEditor } from 'rete'
import { AreaExtensions, AreaPlugin } from 'rete-area-plugin'
import { ReactPlugin, Presets } from 'rete-react-plugin'
import { createRoot } from 'react-dom/client'
import { platformMapNodes, platformMapEdges } from './platformMapData'

function detailNodes(focus) {
  const groups = [
    ['inputs', 'Inputs', focus.inputs],
    ['process', 'Process', focus.process],
    ['outputs', 'Outputs', focus.outputs],
    ['pages', 'Pages', focus.pages],
    ['data', 'Data', focus.data],
  ]
  return groups.filter(([, , items]) => items?.length).map(([suffix, label, items]) => ({
    id: `${focus.id}-${suffix}`,
    label,
    subtitle: items.join(' • '),
    type: 'detail',
    parent: focus.id,
    items,
  }))
}

function getVisibleGraph(focusId) {
  if (!focusId || focusId === 'ritsuflow') {
    const ids = new Set(['ritsuflow', 'projects', 'precon', 'fieldop'])
    return { nodes: platformMapNodes.filter((node) => ids.has(node.id)), edges: platformMapEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) }
  }
  const focus = platformMapNodes.find((node) => node.id === focusId)
  if (focus?.type === 'workspace') {
    const ids = new Set(['ritsuflow', focus.id, ...platformMapNodes.filter((node) => node.workspace === focus.id).map((node) => node.id)])
    return { nodes: platformMapNodes.filter((node) => ids.has(node.id)), edges: platformMapEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) }
  }
  if (focus?.type === 'module') {
    const base = platformMapNodes.filter((node) => ['ritsuflow', focus.workspace, focus.id].includes(node.id))
    const details = detailNodes(focus)
    return { nodes: [...base, ...details], edges: [
      { id: `root-${focus.workspace}`, source: 'ritsuflow', target: focus.workspace },
      { id: `workspace-${focus.id}`, source: focus.workspace, target: focus.id },
      ...details.map((node) => ({ id: `${focus.id}-${node.id}`, source: focus.id, target: node.id })),
    ] }
  }
  return getVisibleGraph('ritsuflow')
}

function getPosition(item, focusId, nodes) {
  const focus = platformMapNodes.find((node) => node.id === focusId)
  if (!focus || focusId === 'ritsuflow') {
    if (item.id === 'ritsuflow') return { x: 520, y: 80 }
    return { x: { projects: 120, precon: 520, fieldop: 920 }[item.id] || 520, y: 390 }
  }
  if (focus.type === 'workspace') {
    if (item.id === 'ritsuflow') return { x: 100, y: 80 }
    if (item.id === focusId) return { x: 520, y: 80 }
    const modules = nodes.filter((node) => node.type === 'module')
    const index = modules.findIndex((node) => node.id === item.id)
    return { x: 180 + (index % 3) * 350, y: 390 + Math.floor(index / 3) * 220 }
  }
  if (focus.type === 'module') {
    if (item.id === 'ritsuflow') return { x: 80, y: 70 }
    if (item.id === focus.workspace) return { x: 370, y: 70 }
    if (item.id === focus.id) return { x: 660, y: 70 }
    const details = nodes.filter((node) => node.type === 'detail')
    const index = details.findIndex((node) => node.id === item.id)
    return { x: 120 + index * 260, y: 390 }
  }
  return { x: 500, y: 400 }
}

export async function createPlatformMapEditor(container, { onSelect, focusId = 'ritsuflow' } = {}) {
  const editor = new NodeEditor()
  const area = new AreaPlugin(container)
  const render = new ReactPlugin({ createRoot })
  render.addPreset(Presets.classic.setup())
  area.use(render)
  editor.use(area)
  const graph = getVisibleGraph(focusId)
  const socket = new ClassicPreset.Socket('architecture')
  const nodeMap = new Map()
  for (const item of graph.nodes) {
    const node = new ClassicPreset.Node(item.label)
    node.meta = item
    node.addInput('in', new ClassicPreset.Input(socket, ''))
    node.addOutput('out', new ClassicPreset.Output(socket, ''))
    await editor.addNode(node)
    nodeMap.set(item.id, node)
  }
  for (const edge of graph.edges) {
    const source = nodeMap.get(edge.source)
    const target = nodeMap.get(edge.target)
    if (source && target) await editor.addConnection(new ClassicPreset.Connection(source, 'out', target, 'in'))
  }
  for (const item of graph.nodes) {
    const node = nodeMap.get(item.id)
    if (node) await area.translate(node.id, getPosition(item, focusId, graph.nodes))
  }
  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), { accumulating: AreaExtensions.accumulateOnCtrl() })
  AreaExtensions.simpleNodesOrder(area)
  area.addPipe((context) => {
    if (context.type === 'nodepicked') {
      const node = editor.getNode(context.data.id)
      if (node?.meta) onSelect?.(node.meta)
    }
    return context
  })
  await AreaExtensions.zoomAt(area, editor.getNodes())
  return () => area.destroy()
}
