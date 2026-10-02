import { ClassicPreset, NodeEditor } from 'rete'
import { AreaExtensions, AreaPlugin } from 'rete-area-plugin'
import { ReactPlugin, Presets } from 'rete-react-plugin'
import { createRoot } from 'react-dom/client'
import { platformMapNodes, platformMapEdges } from './platformMapData'

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

  const positions = {
    ritsuflow: { x: 440, y: 80 },
    projects: { x: 80, y: 330 },
    precon: { x: 440, y: 330 },
    fieldop: { x: 800, y: 330 },
  }

  for (const item of platformMapNodes) {
    const node = nodeMap.get(item.id)
    const position = positions[item.id]
    if (node && position) await area.translate(node.id, position)
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
