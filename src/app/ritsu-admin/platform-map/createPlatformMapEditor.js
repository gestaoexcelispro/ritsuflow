import { ClassicPreset, NodeEditor } from 'rete'
import { AreaExtensions, AreaPlugin } from 'rete-area-plugin'
import { ReactPlugin, Presets } from 'rete-react-plugin'
import { getDOMSocketPosition } from 'rete-render-utils'
import { createRoot } from 'react-dom/client'
import { platformMapNodes } from './platformMapData'
import { getTechnicalGraph } from './platformMapModel'
import { getVisibleGraph } from './platformMapGraph'
import { arrangeCards, separateCards, routeConnections, connectionPaths } from './platformMapLayout'

export async function createPlatformMapEditor(container, {
  onSelect, onOpen, onPositionsChange, positions, dragEnabled = true,
  focusId = 'ritsuflow', view = 'flow', technicalFocusId, filter = 'All', graphPage = 0, signal,
} = {}) {
  const editor = new NodeEditor()
  const area = new AreaPlugin(container)
  const render = new ReactPlugin({ createRoot })
  const nativeWatcher = getDOMSocketPosition()
  const sockets = new Map(), listeners = new Set(), nodeMap = new Map()
  let revision = 0, routedRevision = -1, paths = new Map(), routePoints = new Map()
  let ready = false, destroyed = false, frame = null, selectTimer = null, moving = false, initialFit = false
  let canDrag = dragEnabled, gesture = null, release = null
  const technical = view === 'technical' && platformMapNodes.some((node) => node.id === focusId && node.type === 'module')
  const graph = technical ? getTechnicalGraph(focusId, technicalFocusId || focusId, filter, graphPage, 8) : getVisibleGraph(focusId)
  const socketKey = (id, side, key) => JSON.stringify([id, side, key])
  const checkCancelled = () => {
    if (destroyed || signal?.aborted) { const error = new Error('Editor cancelled'); error.name = 'AbortError'; throw error }
  }
  const rects = () => graph.nodes.map((item) => {
    const node = nodeMap.get(item.id), nodeView = area.nodeViews.get(node?.id)
    return { id: item.id, x: nodeView?.position.x || 0, y: nodeView?.position.y || 0, width: nodeView?.element.firstElementChild?.offsetWidth || 180, height: nodeView?.element.firstElementChild?.offsetHeight || 120 }
  })
  const socketPoint = (id, side, key) => {
    const offset = sockets.get(socketKey(id, side, key)), position = area.nodeViews.get(id)?.position
    return offset && position ? { x: position.x + offset.x, y: position.y + offset.y } : null
  }
  // Keep Rete's native socket subscriptions and connection component. Only the
  // connectionpath signal changes; every original connection remains in Rete.
  const watcher = {
    attach(scope) { nativeWatcher.attach(scope) },
    listen(id, side, key, change) {
      const listener = { id, side, key, change }
      listeners.add(listener)
      const unlisten = nativeWatcher.listen(id, side, key, (point) => {
        if (destroyed) return
        const position = area.nodeViews.get(id)?.position
        if (position) {
          const value = { x: point.x - position.x, y: point.y - position.y }
          const old = sockets.get(socketKey(id, side, key))
          if (!old || Math.abs(old.x - value.x) > 0.1 || Math.abs(old.y - value.y) > 0.1) { sockets.set(socketKey(id, side, key), value); revision += 1; if (ready) scheduleRoutes() }
        }
        change(point)
      })
      return () => { listeners.delete(listener); unlisten() }
    },
  }
  function updateRoutes() {
    if (routedRevision === revision) return
    const connections = editor.getConnections().map((edge) => ({
      id: edge.id, source: editor.getNode(edge.source)?.meta.id, target: editor.getNode(edge.target)?.meta.id, output: edge.sourceOutput,
      start: socketPoint(edge.source, 'output', edge.sourceOutput), end: socketPoint(edge.target, 'input', edge.targetInput),
    })).filter((edge) => edge.start && edge.end)
    routePoints = routeConnections(rects(), connections)
    paths = connectionPaths(routePoints)
    routedRevision = revision
  }
  render.addPreset(Presets.classic.setup({ socketPositionWatcher: watcher }))
  render.addPipe((context) => {
    if (context.type === 'connectionpath' && !destroyed) {
      updateRoutes()
      const path = paths.get(context.data.payload.id)
      if (path) return { ...context, data: { ...context.data, path } }
    }
    return context
  })
  area.use(render)
  editor.use(area)
  const rendered = new Set(), waiting = new Map()
  let resizeFrame = null
  const resizeObserver = new ResizeObserver(() => {
    if (!ready || destroyed || resizeFrame !== null) return
    resizeFrame = requestAnimationFrame(() => { resizeFrame = null; fit().catch((error) => { if (error.name !== 'AbortError') console.error('Platform map resize failed', error) }) })
  })
  area.addPipe((context) => {
    if (context.type === 'rendered' && context.data.type === 'node') {
      rendered.add(context.data.payload.id)
      waiting.get(context.data.payload.id)?.()
    }
    if (context.type === 'nodetranslate' && ready && !moving && (!canDrag || (gesture && !gesture.moved))) return
    if (context.type === 'nodetranslated' || context.type === 'noderesized') { revision += 1; if (ready && !moving) scheduleRoutes() }
    return context
  })
  function refreshRoutes() {
    if (destroyed) return
    updateRoutes()
    // A dragged card can obstruct an unrelated connection, so refresh every
    // native subscription, including connections that do not touch that card.
    for (const listener of listeners) {
      const point = socketPoint(listener.id, listener.side, listener.key)
      if (point) listener.change(point)
    }
  }
  function scheduleRoutes() {
    if (frame !== null) return
    frame = requestAnimationFrame(() => {
      frame = null; refreshRoutes()
      if (!initialFit && paths.size === graph.edges.length) {
        initialFit = true
        fit().catch((error) => { if (error.name !== 'AbortError') console.error('Platform map fit failed', error) })
      }
    })
  }
  const remember = () => onPositionsChange?.(Object.fromEntries(rects().map(({ id, x, y }) => [id, { x, y }])))
  async function moveCards(placements) {
    moving = true
    try {
      for (const [id, position] of placements) {
        checkCancelled()
        const node = nodeMap.get(id), current = area.nodeViews.get(node?.id)?.position
        if (node && (!current || current.x !== position.x || current.y !== position.y)) await area.translate(node.id, position)
      }
    } finally { moving = false }
    refreshRoutes(); remember()
  }
  async function settle(pinnedId) {
    if (!ready || destroyed) return
    try { await moveCards(separateCards(rects(), pinnedId)) } catch (error) { if (error.name !== 'AbortError') console.error('Platform map spacing failed', error) }
  }
  async function fit() {
    checkCancelled(); refreshRoutes()
    const cards = rects(), points = [...routePoints.values()].flat()
    const left = Math.min(...cards.map((card) => card.x), ...points.map((point) => point.x)) - 24
    const right = Math.max(...cards.map((card) => card.x + card.width), ...points.map((point) => point.x)) + 24
    const top = Math.min(...cards.map((card) => card.y), ...points.map((point) => point.y)) - 24
    const bottom = Math.max(...cards.map((card) => card.y + card.height), ...points.map((point) => point.y)) + 24
    const width = container.clientWidth, height = container.clientHeight
    const scale = Math.min(Math.max(100, width - 60) / (right - left), Math.max(100, height - 175) / (bottom - top), 1)
    area.area.transform.x = width / 2 - (left + right) / 2 * scale
    area.area.transform.y = 130 + Math.max(100, height - 175) / 2 - (top + bottom) / 2 * scale
    await area.area.zoom(scale, 0, 0)
  }
  async function arrange() {
    checkCancelled()
    const sizes = new Map(rects().map((rect) => [rect.id, rect]))
    await moveCards(arrangeCards(graph.nodes, graph.edges, sizes))
    await fit()
  }
  const nodeForEvent = (event) => {
    const element = event.target instanceof Element ? event.target.closest('[data-pm-node]') : null
    return element && container.contains(element) ? editor.getNode(element.dataset.pmNode) : null
  }
  function pointerDown(event) {
    if (event.button !== 0) return
    clearTimeout(selectTimer)
    const node = nodeForEvent(event)
    gesture = node ? { id: node.id, pointer: event.pointerId, x: event.clientX, y: event.clientY, moved: false } : null
  }
  function pointerMove(event) {
    if (!gesture || gesture.pointer !== event.pointerId) return
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) >= 5) {
      gesture.moved = true
      if (canDrag) area.nodeViews.get(gesture.id)?.element.classList.add('pmDragging')
    }
  }
  function pointerUp(event) {
    if (!gesture || gesture.pointer !== event.pointerId) return
    const current = gesture
    release = { id: current.id, moved: current.moved || event.type === 'pointercancel', time: Date.now() }
    area.nodeViews.get(current.id)?.element.classList.remove('pmDragging')
    gesture = null
    if (current.moved && canDrag) queueMicrotask(() => settle(editor.getNode(current.id)?.meta.id))
  }
  function click(event) {
    const node = nodeForEvent(event)
    if (!node || event.button !== 0 || (release?.id === node.id && release.moved && Date.now() - release.time < 500)) return
    clearTimeout(selectTimer)
    if (event.detail === 1) selectTimer = setTimeout(() => { if (!destroyed) onSelect?.(node.meta) }, 350)
  }
  function doubleClick(event) {
    const node = nodeForEvent(event)
    clearTimeout(selectTimer)
    if (node && event.button === 0 && !(release?.id === node.id && release.moved && Date.now() - release.time < 500)) { event.stopPropagation(); onOpen?.(node.meta) }
  }
  function keyDown(event) {
    const node = nodeForEvent(event)
    if (!node) return
    if (event.key === 'Enter') { event.preventDefault(); onOpen?.(node.meta) }
    if (event.key === ' ') { event.preventDefault(); onSelect?.(node.meta) }
  }
  container.addEventListener('pointerdown', pointerDown, true)
  window.addEventListener('pointermove', pointerMove, true)
  window.addEventListener('pointerup', pointerUp, true)
  window.addEventListener('pointercancel', pointerUp, true)
  container.addEventListener('click', click, true)
  container.addEventListener('dblclick', doubleClick, true)
  container.addEventListener('keydown', keyDown)
  const accumulating = AreaExtensions.accumulateOnCtrl()
  function setDragEnabled(value) {
    canDrag = value
    for (const nodeView of area.nodeViews.values()) nodeView.element.classList.toggle('pmDraggable', value)
  }
  function destroy() {
    if (destroyed) return
    destroyed = true; clearTimeout(selectTimer)
    if (frame !== null) cancelAnimationFrame(frame)
    if (resizeFrame !== null) cancelAnimationFrame(resizeFrame)
    resizeObserver.disconnect()
    waiting.forEach((resolve) => resolve()); waiting.clear()
    container.removeEventListener('pointerdown', pointerDown, true)
    window.removeEventListener('pointermove', pointerMove, true)
    window.removeEventListener('pointerup', pointerUp, true)
    window.removeEventListener('pointercancel', pointerUp, true)
    container.removeEventListener('click', click, true)
    container.removeEventListener('dblclick', doubleClick, true)
    container.removeEventListener('keydown', keyDown)
    signal?.removeEventListener('abort', destroy)
    accumulating.destroy(); listeners.clear()
    // Navigation can dispose the editor during React's effect cleanup. Unmount
    // its independent React roots after that commit has finished.
    queueMicrotask(() => area.destroy())
  }
  signal?.addEventListener('abort', destroy, { once: true })
  try {
    const socket = new ClassicPreset.Socket('architecture')
    for (const item of graph.nodes) {
      checkCancelled()
      const node = new ClassicPreset.Node(item.label)
      node.meta = item
      node.addInput('in', new ClassicPreset.Input(socket, technical ? 'IN' : '', true))
      const types = technical ? [...new Set(graph.edges.filter((edge) => edge.source === item.id).map((edge) => edge.type))] : ['flow']
      for (const type of types) node.addOutput(type, new ClassicPreset.Output(socket, technical ? type : '', true))
      nodeMap.set(item.id, node)
      await editor.addNode(node)
      const element = area.nodeViews.get(node.id).element
      element.dataset.pmNode = node.id
      element.dataset.pmArchitectureId = item.id
      element.tabIndex = 0; element.setAttribute('role', 'button')
      element.setAttribute('aria-label', item.label + '. Double-click or press Enter to open. Hold and drag to move.')
      element.title = 'Click for details · Hold and drag to move · Double-click to open'
    }
    checkCancelled()
    await Promise.all(editor.getNodes().map((node) => rendered.has(node.id) ? Promise.resolve() : new Promise((resolve) => waiting.set(node.id, resolve))))
    checkCancelled(); waiting.clear()
    const sizes = new Map(rects().map((rect) => [rect.id, rect]))
    const placements = arrangeCards(graph.nodes, graph.edges, sizes)
    for (const [id, value] of Object.entries(positions || {})) if (placements.has(id) && Number.isFinite(value?.x) && Number.isFinite(value?.y) && Math.abs(value.x) < 100000 && Math.abs(value.y) < 100000) placements.set(id, { x: value.x, y: value.y })
    await moveCards(separateCards(rects().map((rect) => ({ ...rect, ...placements.get(rect.id) }))))
    for (const edge of graph.edges) {
      checkCancelled()
      const source = nodeMap.get(edge.source), target = nodeMap.get(edge.target)
      if (!source || !target) throw new Error('Missing connection endpoint: ' + edge.id)
      const connection = new ClassicPreset.Connection(source, technical ? edge.type : 'flow', target, 'in')
      connection.meta = edge
      await editor.addConnection(connection)
      const element = area.connectionViews.get(connection.id)?.element
      if (element) { element.dataset.pmConnection = edge.id; element.dataset.pmSource = edge.source; element.dataset.pmTarget = edge.target }
      revision += 1
    }
    AreaExtensions.selectableNodes(area, AreaExtensions.selector(), { accumulating })
    // Reparenting a picked node cancels browser click/double-click delivery.
    // Bring it forward with z-index while keeping its DOM element in place.
    let layer = 1
    for (const nodeView of area.nodeViews.values()) nodeView.element.style.zIndex = '1'
    for (const connectionView of area.connectionViews.values()) connectionView.element.style.zIndex = '0'
    area.addPipe((context) => {
      if (context.type === 'nodepicked') { const element = area.nodeViews.get(context.data.id)?.element; if (element) element.style.zIndex = String(++layer) }
      return context
    })
    setDragEnabled(canDrag); ready = true; resizeObserver.observe(container)
    await fit(); checkCancelled(); scheduleRoutes()
    return { destroy, arrange, fit, setDragEnabled }
  } catch (error) { destroy(); throw error }
}
