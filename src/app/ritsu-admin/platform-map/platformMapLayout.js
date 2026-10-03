// Geometry shared by the editor and its checks. Coordinates are in canvas space.
const CLEARANCE = 22
const LANE_GAP = 12
const close = (a, b) => Math.abs(a - b) < 0.1
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

export function cardsOverlap(a, b, gap = 0) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y
}

export function separateCards(rects, pinnedId, gap = 64) {
  const ordered = [...rects].sort((a, b) => Number(b.id === pinnedId) - Number(a.id === pinnedId))
  const placed = []
  for (const rect of ordered) {
    const next = { ...rect }
    let collisions = placed.filter((other) => cardsOverlap(next, other, gap))
    while (collisions.length) {
      next.y = Math.max(...collisions.map((other) => other.y + other.height + gap))
      collisions = placed.filter((other) => cardsOverlap(next, other, gap))
    }
    placed.push(next)
  }
  return new Map(placed.map(({ id, x, y }) => [id, { x, y }]))
}

export function arrangeCards(nodes, edges, sizes = new Map()) {
  const measured = (node) => sizes.get(node.id) || { width: 180, height: 120 }
  const details = nodes.filter((node) => node.type === 'detail')
  if (details.length) {
    // Keep the ancestry above a compact Inputs / Process / Outputs flow.
    const columns = [nodes.filter((node) => node.type === 'platform' || ['inputs', 'pages'].includes(node.detailType)), nodes.filter((node) => node.type === 'workspace' || node.detailType === 'process'), nodes.filter((node) => node.type === 'module' || ['outputs', 'data'].includes(node.detailType))]
    const xs = [60]
    for (let i = 1; i < 3; i += 1) xs.push(xs[i - 1] + Math.max(180, ...columns[i - 1].map((node) => measured(node).width)) + 180)
    const ancestors = nodes.filter((node) => node.type !== 'detail')
    const flowTop = 60 + Math.max(120, ...ancestors.map((node) => measured(node).height)) + 110
    const firstRowHeight = Math.max(120, ...details.filter((node) => ['inputs', 'outputs'].includes(node.detailType)).map((node) => measured(node).height))
    const secondRowHeight = Math.max(120, ...details.filter((node) => ['pages', 'data'].includes(node.detailType)).map((node) => measured(node).height))
    const positions = new Map()
    columns.forEach((column, index) => column.forEach((node) => {
      let y = 60
      if (['inputs', 'outputs'].includes(node.detailType)) y = flowTop
      if (['pages', 'data'].includes(node.detailType)) y = flowTop + firstRowHeight + 110
      if (node.detailType === 'process') y = flowTop + (firstRowHeight + 110 + secondRowHeight - measured(node).height) / 2
      positions.set(node.id, { x: xs[index], y })
    }))
    return separateCards(nodes.map((node) => ({ id: node.id, ...measured(node), ...positions.get(node.id) })))
  }
  const modules = nodes.filter((node) => node.type === 'module')
  const workspace = nodes.find((node) => node.type === 'workspace')
  if (workspace && modules.length > 1 && nodes.some((node) => node.type === 'platform')) {
    // Wrap large workspaces into rows instead of shrinking a seven-card column.
    const count = Math.min(4, modules.length), positions = new Map()
    const width = Math.max(180, ...nodes.map((node) => measured(node).width))
    const rowTop = 60 + Math.max(120, ...nodes.filter((node) => node.type !== 'module').map((node) => measured(node).height)) + 110
    const rowHeight = Math.max(120, ...modules.map((node) => measured(node).height)) + 110
    nodes.filter((node) => node.type !== 'module').forEach((node) => positions.set(node.id, { x: node.type === 'platform' ? 60 : 60 + (width + 150) * (count - 1) / 2, y: 60 }))
    modules.forEach((node, index) => positions.set(node.id, { x: 60 + index % count * (width + 150), y: rowTop + Math.floor(index / count) * rowHeight }))
    return positions
  }
  // Collapse cycles before assigning columns; technical navigation can be cyclic.
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const next = new Map(nodes.map((node) => [node.id, []]))
  for (const edge of edges) if (byId.has(edge.source) && byId.has(edge.target)) next.get(edge.source).push(edge.target)
  let serial = 0
  const stack = [], active = new Set(), indices = new Map(), low = new Map(), groups = [], groupOf = new Map()
  function visit(id) {
    indices.set(id, serial); low.set(id, serial); serial += 1; stack.push(id); active.add(id)
    for (const target of next.get(id)) {
      if (!indices.has(target)) { visit(target); low.set(id, Math.min(low.get(id), low.get(target))) }
      else if (active.has(target)) low.set(id, Math.min(low.get(id), indices.get(target)))
    }
    if (indices.get(id) !== low.get(id)) return
    const group = []
    let member
    do { member = stack.pop(); active.delete(member); groupOf.set(member, groups.length); group.push(member) } while (member !== id)
    groups.push(group)
  }
  nodes.forEach((node) => { if (!indices.has(node.id)) visit(node.id) })
  const rank = groups.map(() => 0)
  for (let pass = 0; pass < groups.length; pass += 1) {
    for (const edge of edges) {
      const from = groupOf.get(edge.source), to = groupOf.get(edge.target)
      if (from !== undefined && to !== undefined && from !== to) rank[to] = Math.max(rank[to], rank[from] + 1)
    }
  }
  // Side inputs (such as Pages) sit beside the input of the process they feed.
  for (let group = 0; group < groups.length; group += 1) {
    const ids = groups[group]
    if (ids.some((id) => byId.get(id).type === 'platform') || edges.some((edge) => ids.includes(edge.target) && !ids.includes(edge.source))) continue
    const targets = edges.filter((edge) => ids.includes(edge.source) && !ids.includes(edge.target)).map((edge) => rank[groupOf.get(edge.target)])
    if (targets.length) rank[group] = Math.max(rank[group], Math.min(...targets) - 1)
  }
  const columns = new Map()
  nodes.forEach((node) => {
    const column = rank[groupOf.get(node.id)]
    if (!columns.has(column)) columns.set(column, [])
    columns.get(column).push(node)
  })
  const order = new Map(nodes.map((node, index) => [node.id, index]))
  // Barycentric ordering reduces crossings between neighboring columns.
  for (let pass = 0; pass < 4; pass += 1) {
    for (const column of [...columns.keys()].sort((a, b) => pass % 2 ? b - a : a - b)) {
      const peers = columns.get(column)
      const score = (node) => {
        const related = edges.filter((edge) => pass % 2 ? edge.source === node.id : edge.target === node.id).map((edge) => order.get(pass % 2 ? edge.target : edge.source)).filter(Number.isFinite)
        return related.length ? related.reduce((sum, value) => sum + value, 0) / related.length : order.get(node.id)
      }
      peers.sort((a, b) => score(a) - score(b))
      peers.forEach((node, index) => order.set(node.id, index))
    }
  }
  const size = (node) => sizes.get(node.id) || { width: 180, height: 120 }
  const heights = [...columns.values()].map((peers) => peers.reduce((sum, node) => sum + size(node).height, 0) + Math.max(0, peers.length - 1) * 92)
  const totalHeight = Math.max(120, ...heights)
  const positions = new Map()
  let x = 60
  for (const column of [...columns.keys()].sort((a, b) => a - b)) {
    const peers = columns.get(column)
    let y = 60 + (totalHeight - (peers.reduce((sum, node) => sum + size(node).height, 0) + Math.max(0, peers.length - 1) * 92)) / 2
    for (const node of peers) { positions.set(node.id, { x, y }); y += size(node).height + 92 }
    x += Math.max(...peers.map((node) => size(node).width)) + 180
  }
  return positions
}

export function segmentHitsCard(a, b, rect, padding = 0) {
  const left = rect.x - padding, right = rect.x + rect.width + padding
  const top = rect.y - padding, bottom = rect.y + rect.height + padding
  if (close(a.y, b.y)) return a.y > top && a.y < bottom && Math.max(a.x, b.x) > left && Math.min(a.x, b.x) < right
  if (close(a.x, b.x)) return a.x > left && a.x < right && Math.max(a.y, b.y) > top && Math.min(a.y, b.y) < bottom
  return true
}

function crossing(a, b, c, d, inclusive = false) {
  const horizontal = close(a.y, b.y), otherHorizontal = close(c.y, d.y)
  if (horizontal === otherHorizontal) return null
  const h1 = horizontal ? a : c, h2 = horizontal ? b : d
  const v1 = horizontal ? c : a, v2 = horizontal ? d : b
  const margin = inclusive ? -0.1 : 0.1
  if (v1.x > Math.min(h1.x, h2.x) + margin && v1.x < Math.max(h1.x, h2.x) - margin && h1.y > Math.min(v1.y, v2.y) + margin && h1.y < Math.max(v1.y, v2.y) - margin) return { x: v1.x, y: h1.y }
  return null
}

function usageCost(a, b, used) {
  let cost = 0
  for (const [c, d] of used) {
    if (crossing(a, b, c, d, true)) cost += 900
    else if ((close(a.x, b.x) && close(c.x, d.x) && close(a.x, c.x)) || (close(a.y, b.y) && close(c.y, d.y) && close(a.y, c.y))) {
      const axis = close(a.x, b.x) ? 'y' : 'x'
      cost += Math.max(0, Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis])) - Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]))) * 18
    }
  }
  return cost
}

class MinHeap {
  items = []
  push(item) {
    const items = this.items
    items.push(item)
    let i = items.length - 1
    while (i > 0) { const parent = Math.floor((i - 1) / 2); if (items[parent].priority <= item.priority) break; items[i] = items[parent]; i = parent }
    items[i] = item
  }
  pop() {
    const items = this.items, first = items[0], last = items.pop()
    if (items.length) {
      let i = 0
      while (i * 2 + 1 < items.length) { let child = i * 2 + 1; if (child + 1 < items.length && items[child + 1].priority < items[child].priority) child += 1; if (items[child].priority >= last.priority) break; items[i] = items[child]; i = child }
      items[i] = last
    }
    return first
  }
}

function simplify(points) {
  const result = []
  for (const point of points) {
    if (result.length && distance(result[result.length - 1], point) < 0.1) continue
    while (result.length >= 2) {
      const a = result[result.length - 2], b = result[result.length - 1]
      if (!((close(a.x, b.x) && close(b.x, point.x)) || (close(a.y, b.y) && close(b.y, point.y)))) break
      result.pop()
    }
    result.push(point)
  }
  return result
}

function findRoute(start, end, grid, used) {
  const { xs, ys, blocked, neighbors } = grid
  const width = xs.length
  const index = (point) => ys.indexOf(point.y) * width + xs.indexOf(point.x)
  const first = index(start), last = index(end)
  const pointAt = (index) => ({ x: xs[index % width], y: ys[Math.floor(index / width)] })
  const costs = new Map(), previous = new Map(), queue = new MinHeap()
  const firstState = first * 3
  costs.set(firstState, 0); queue.push({ state: firstState, cost: 0, priority: distance(start, end) })
  while (queue.items.length) {
    const current = queue.pop()
    if (current.cost !== costs.get(current.state)) continue
    const position = Math.floor(current.state / 3), direction = current.state % 3
    if (position === last) {
      const points = []
      let state = current.state
      while (state !== undefined) { points.push(pointAt(Math.floor(state / 3))); state = previous.get(state) }
      return simplify(points.reverse())
    }
    const a = pointAt(position)
    for (const target of neighbors[position]) {
      if (blocked[target]) continue
      const b = pointAt(target), nextDirection = close(a.y, b.y) ? 1 : 2
      const state = target * 3 + nextDirection
      const cost = current.cost + distance(a, b) + (direction && direction !== nextDirection ? 30 : 0) + usageCost(a, b, used)
      if (cost >= (costs.get(state) ?? Infinity)) continue
      costs.set(state, cost); previous.set(state, current.state)
      queue.push({ state, cost, priority: cost + distance(b, end) })
    }
  }
  return null
}

export function routeConnections(rects, connections) {
  if (!connections.length) return new Map()
  const byId = new Map(rects.map((rect) => [rect.id, rect]))
  const slots = new Map()
  const prepared = connections.map((connection) => {
    const source = byId.get(connection.source), target = byId.get(connection.target)
    const key = connection.source + ':' + (connection.output || 'flow')
    const slot = slots.get(key) || 0; slots.set(key, slot + 1)
    const targetKey = connection.target + ':input'
    const targetSlot = slots.get(targetKey) || 0; slots.set(targetKey, targetSlot + 1)
    const inRow = (rect, y) => y > rect.y - CLEARANCE && y < rect.y + rect.height + CLEARANCE
    const sourceLimit = Math.min(Infinity, ...rects.filter((rect) => rect.id !== connection.source && rect.x > connection.start.x && inRow(rect, connection.start.y)).map((rect) => rect.x - CLEARANCE - 2))
    const targetLimit = Math.max(-Infinity, ...rects.filter((rect) => rect.id !== connection.target && rect.x + rect.width < connection.end.x && inRow(rect, connection.end.y)).map((rect) => rect.x + rect.width + CLEARANCE + 2))
    const fromX = Math.min(sourceLimit, Math.max(connection.start.x, (source?.x || 0) + (source?.width || 0)) + CLEARANCE + 8 + slot * LANE_GAP)
    const toX = Math.max(targetLimit, Math.min(connection.end.x, target?.x ?? connection.end.x) - CLEARANCE - 8 - targetSlot * LANE_GAP)
    return { ...connection, from: { x: fromX, y: connection.start.y }, to: { x: toX, y: connection.end.y } }
  })
  const xValues = [], yValues = []
  for (const rect of rects) { xValues.push(rect.x - CLEARANCE - 8, rect.x + rect.width + CLEARANCE + 8); yValues.push(rect.y - CLEARANCE - 8, rect.y + rect.height + CLEARANCE + 8) }
  for (const edge of prepared) { xValues.push(edge.from.x, edge.to.x); yValues.push(edge.from.y, edge.to.y, edge.from.y - LANE_GAP, edge.from.y + LANE_GAP, edge.to.y - LANE_GAP, edge.to.y + LANE_GAP) }
  const left = Math.min(...xValues), right = Math.max(...xValues), top = Math.min(...yValues), bottom = Math.max(...yValues)
  for (let i = 1; i <= Math.min(prepared.length, 12); i += 1) { xValues.push(left - i * LANE_GAP, right + i * LANE_GAP); yValues.push(top - i * LANE_GAP, bottom + i * LANE_GAP) }
  const xs = [...new Set(xValues)].sort((a, b) => a - b), ys = [...new Set(yValues)].sort((a, b) => a - b)
  const blocked = [], neighbors = Array.from({ length: xs.length * ys.length }, () => [])
  for (let y = 0; y < ys.length; y += 1) for (let x = 0; x < xs.length; x += 1) {
    const index = y * xs.length + x, a = { x: xs[x], y: ys[y] }
    blocked[index] = rects.some((rect) => a.x > rect.x - CLEARANCE && a.x < rect.x + rect.width + CLEARANCE && a.y > rect.y - CLEARANCE && a.y < rect.y + rect.height + CLEARANCE)
    if (blocked[index]) continue
    for (const [tx, ty] of [[x - 1, y], [x, y - 1]]) {
      if (tx < 0 || ty < 0) continue
      const other = ty * xs.length + tx, b = { x: xs[tx], y: ys[ty] }
      if (!blocked[other] && !rects.some((rect) => segmentHitsCard(a, b, rect, CLEARANCE))) { neighbors[index].push(other); neighbors[other].push(index) }
    }
  }
  const routes = new Map(), used = []
  // Short direct edges get their lanes first; longer edges take the free space.
  for (const edge of [...prepared].sort((a, b) => distance(a.from, a.to) - distance(b.from, b.to))) {
    const route = findRoute(edge.from, edge.to, { xs, ys, blocked, neighbors }, used)
    // Retain a visible path even during the transient overlap of a manual drag.
    const points = simplify([edge.start, ...(route || [edge.from, { x: edge.from.x, y: top - 36 }, { x: edge.to.x, y: top - 36 }, edge.to]), edge.end])
    routes.set(edge.id, points)
    for (let i = 1; i < points.length; i += 1) used.push([points[i - 1], points[i]])
  }
  return routes
}

export function connectionPaths(routes) {
  const paths = new Map(), earlier = []
  for (const [id, points] of routes) {
    let path = 'M ' + points[0].x + ' ' + points[0].y
    for (let i = 1; i < points.length; i += 1) {
      const a = points[i - 1], b = points[i], horizontal = close(a.y, b.y)
      const axis = horizontal ? 'x' : 'y', sign = Math.sign(b[axis] - a[axis])
      const bridges = earlier.map(([c, d]) => crossing(a, b, c, d)).filter((point) => point && distance(a, point) > 12 && distance(b, point) > 12).sort((c, d) => sign * (c[axis] - d[axis]))
      let last = a
      for (const point of bridges) {
        if (distance(last, point) < 12) continue
        const before = { ...point, [axis]: point[axis] - sign * 6 }, after = { ...point, [axis]: point[axis] + sign * 6 }
        const control = horizontal ? { x: point.x, y: point.y - 12 } : { x: point.x + 12, y: point.y }
        path += ` L ${before.x} ${before.y} Q ${control.x} ${control.y} ${after.x} ${after.y}`
        last = after
      }
      path += ' L ' + b.x + ' ' + b.y
    }
    paths.set(id, path)
    for (let i = 1; i < points.length; i += 1) earlier.push([points[i - 1], points[i]])
  }
  return paths
}
