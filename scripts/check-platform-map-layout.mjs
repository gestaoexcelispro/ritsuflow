import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const directory = new URL('../src/app/ritsu-admin/platform-map/', import.meta.url)
const read = (name) => readFile(new URL(name, directory), 'utf8')
const url = (source) => 'data:text/javascript;charset=utf-8,' + encodeURIComponent(source)
const inventoryUrl = url(await read('platformMapInventory.js'))
const dataUrl = url((await read('platformMapData.js')).replace("'./platformMapInventory'", JSON.stringify(inventoryUrl)))
const { platformMapNodes } = await import(dataUrl)
const graphUrl = url((await read('platformMapGraph.js')).replace("'./platformMapData'", JSON.stringify(dataUrl)))
const { getVisibleGraph } = await import(graphUrl)
const modelUrl = url((await read('platformMapModel.js')).replace("'./platformMapData'", JSON.stringify(dataUrl)).replace("'./platformMapInventory'", JSON.stringify(inventoryUrl)))
const { getTechnicalGraph } = await import(modelUrl)
const { arrangeCards, cardsOverlap, separateCards, segmentHitsCard, routeConnections, connectionPaths } = await import(url(await read('platformMapLayout.js')))
let checks = 0
function check(name, condition) { assert.ok(condition, name); checks += 1 }
function geometry(graph, positions) {
  const sizes = new Map(graph.nodes.map((node, index) => {
    const outputs = [...new Set(graph.edges.filter((edge) => edge.source === node.id).map((edge) => edge.type || 'flow'))]
    return [node.id, { width: index % 3 ? 180 : 230, height: 100 + Math.max(1, outputs.length) * 36 }]
  }))
  const placement = positions || arrangeCards(graph.nodes, graph.edges, sizes)
  const rects = graph.nodes.map((node) => ({ id: node.id, ...sizes.get(node.id), ...placement.get(node.id) }))
  const byId = new Map(rects.map((rect) => [rect.id, rect]))
  const connections = graph.edges.map((edge) => {
    const source = byId.get(edge.source), target = byId.get(edge.target)
    const ports = [...new Set(graph.edges.filter((other) => other.source === edge.source).map((other) => other.type || 'flow'))]
    return { ...edge, output: edge.type || 'flow', start: { x: source.x + source.width + 12, y: source.y + 48 + ports.indexOf(edge.type || 'flow') * 36 }, end: { x: target.x - 12, y: target.y + target.height - 28 } }
  })
  return { rects, connections, placement }
}
function verifyGraph(name, graph, positions) {
  const { rects, connections, placement } = geometry(graph, positions)
  check(name + ': every card has a finite position', rects.every((rect) => Number.isFinite(rect.x) && Number.isFinite(rect.y)))
  check(name + ': cards have clear spacing', rects.every((rect, index) => rects.slice(index + 1).every((other) => !cardsOverlap(rect, other, 32))))
  const routes = routeConnections(rects, connections), paths = connectionPaths(routes)
  check(name + ': no connection was lost', routes.size === graph.edges.length && graph.edges.every((edge) => routes.has(edge.id) && paths.get(edge.id)?.startsWith('M ')))
  for (const connection of connections) {
    const points = routes.get(connection.id)
    assert.deepEqual(points[0], connection.start, name + ': source attached')
    assert.deepEqual(points.at(-1), connection.end, name + ': target attached')
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1], b = points[i]
      assert.ok(a.x === b.x || a.y === b.y, name + ': orthogonal segment')
      for (const rect of rects) {
        if ((i === 1 && rect.id === connection.source) || (i === points.length - 1 && rect.id === connection.target)) continue
        assert.ok(!segmentHitsCard(a, b, rect, 8), name + ': ' + connection.id + ' crosses ' + rect.id)
      }
    }
  }
  checks += 3
  return { rects, connections, placement, routes }
}

for (const node of platformMapNodes) verifyGraph('Flow ' + node.id, getVisibleGraph(node.id))
const flowExample = getVisibleGraph('master-plan')
check('The screenshot flow retains all seven relationships', flowExample.edges.length === 7 && flowExample.edges.some((edge) => edge.source === 'master-plan-pages' && edge.target === 'master-plan-process') && flowExample.edges.some((edge) => edge.source === 'master-plan-process' && edge.target === 'master-plan-data'))
for (const module of platformMapNodes.filter((node) => node.type === 'module')) {
  for (const filter of ['All', 'Pages', 'Database', 'APIs']) {
    const first = getTechnicalGraph(module.id, module.id, filter, 0, 8)
    for (const page of new Set([0, first.pages - 1])) verifyGraph('Technical ' + module.id + ' ' + filter + ' ' + page, getTechnicalGraph(module.id, module.id, filter, page, 8))
  }
}
const original = verifyGraph('Before dragging', flowExample)
const dragged = original.rects.map((rect) => rect.id === 'master-plan-process' ? { ...rect, ...original.placement.get('master-plan-pages') } : rect)
const settled = separateCards(dragged, 'master-plan-process')
assert.deepEqual(settled.get('master-plan-process'), original.placement.get('master-plan-pages'), 'The dragged card keeps the requested position')
verifyGraph('After dragging onto a card', flowExample, settled)
checks += 1
const obstaclePositions = new Map(original.placement)
obstaclePositions.set('master-plan-pages', { x: original.placement.get('master-plan-process').x + 250, y: original.placement.get('master-plan-process').y - 20 })
const moved = geometry(flowExample, separateCards(geometry(flowExample, obstaclePositions).rects, 'master-plan-pages'))
const rerouted = routeConnections(moved.rects, moved.connections)
check('Moving a card also reroutes unrelated connections', JSON.stringify(original.routes.get('master-plan-outputs')) !== JSON.stringify(rerouted.get('master-plan-outputs')))
verifyGraph('After obstructing another connection', flowExample, separateCards(geometry(flowExample, obstaclePositions).rects, 'master-plan-pages'))
const cyclic = { nodes: [{ id: 'a', type: 'module' }, { id: 'b', type: 'page' }, { id: 'c', type: 'component' }], edges: [{ id: 'ab', source: 'a', target: 'b' }, { id: 'bc', source: 'b', target: 'c' }, { id: 'cb', source: 'c', target: 'b' }] }
verifyGraph('Cyclic technical navigation', cyclic)
const bridges = connectionPaths(new Map([['horizontal', [{ x: 0, y: 50 }, { x: 100, y: 50 }]], ['vertical', [{ x: 50, y: 0 }, { x: 50, y: 100 }]]]))
check('Unavoidable crossings use a visible bridge and retain both lines', bridges.size === 2 && bridges.get('vertical').includes(' Q ') && bridges.get('vertical').endsWith('L 50 100'))
console.log('Platform map geometry checks passed: ' + checks)
