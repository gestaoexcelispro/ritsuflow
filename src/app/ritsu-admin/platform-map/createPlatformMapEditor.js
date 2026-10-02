import { ClassicPreset, NodeEditor } from 'rete'
import { AreaExtensions, AreaPlugin } from 'rete-area-plugin'
import { ReactPlugin, Presets } from 'rete-react-plugin'
import { createRoot } from 'react-dom/client'
import { platformMapNodes, platformMapEdges } from './platformMapData'

const workspaceX = {
  projects: 80,
  precon: 560,
  fieldop: 1040,
}

function getNodePosition(item) {
  if (item.id === 'ritsuflow') return { x: 560, y: 40 }

  if (item.type === 'workspace') {
    return { x: workspaceX[item.id] ?? 560, y: 270 }
  }

  if (item.type === 'module') {
    const siblings = platformMapNodes.filter(
      (node) => node.type === 'module' && node.workspace === item.workspace
    )
    const index = siblings.findIndex((node) => node.id === item.id)

    return {
      x: workspaceX[item.workspace] ?? 560,
      y: 520 + index * 190,
    }
  }

  return { x: 560, y: 520 }
}

export async function createPlatformMapEditor(container) {
  const editor = new NodeEditor()
  const area = new AreaPlugin(container)
  const render = new ReactPlugin({ createRoot })

  render.addPreset(Presets.classic.setup())
  area.use(render)
  editor.use(area)

  const socket = new ClassicPreset.Socket('architecture')
  const nodeMap = new Map()

  for (const item of platformMapNodes) {
    const node = new ClassicPreset.Node(item.label)
    node.meta = item
    node.addInput('in', new ClassicPreset.Input(socket, ''))
    node.addOutput('out', new ClassicPreset.Output(socket, ''))
    await editor.addNode(node)
    nodeMap.set(item.id, node)
  }

  for (const edge of platformMapEdges) {
    const source = nodeMap.get(edge.source)
    const target = nodeMap.get(edge.target)
    if (!source || !target) continue
    await editor.addConnection(new ClassicPreset.Connection(source, 'out', target, 'in'))
  }

  for (const item of platformMapNodes) {
    const node = nodeMap.get(item.id)
    if (!node) continue
    await area.translate(node.id, getNodePosition(item))
  }

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  })
  AreaExtensions.simpleNodesOrder(area)
  await AreaExtensions.zoomAt(area, editor.getNodes())

  return () => {
    area.destroy()
  }
}
