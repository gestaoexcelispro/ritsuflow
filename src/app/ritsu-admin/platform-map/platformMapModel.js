import { platformMapNodes, platformMapEdges } from './platformMapData'
import { platformMapInventory } from './platformMapInventory'

export const architectureAudit = platformMapInventory.audit
export const architectureGaps = platformMapInventory.gaps
export const nodeTypeLabels = { platform: 'Platform', workspace: 'Workspace', module: 'Module', page: 'Page', component: 'Component', api: 'API', table: 'Table', view: 'View', rpc: 'RPC', storage: 'Storage' }
export const mapFilters = ['All', 'Workspaces', 'Modules', 'Pages', 'Database', 'APIs']
const sourceId = (path) => 'source:' + path
const databaseId = (item) => 'db:' + item.schema + '.' + item.name
const rpcId = (item) => 'rpc:' + item.schema + '.' + item.name
const storageId = (item) => 'storage:' + item.name
const nodes = new Map(platformMapNodes.map((node) => [node.id, { ...node, moduleIds: node.type === 'module' ? [node.id] : [] }]))
const edges = new Map()
function addNode(item, moduleId) {
  const existing = nodes.get(item.id)
  if (existing) {
    if (moduleId && !existing.moduleIds.includes(moduleId)) existing.moduleIds.push(moduleId)
    if (item.routes) existing.routes = [...new Set([...(existing.routes || []), ...item.routes])]
    return existing
  }
  const node = { ...item, moduleIds: moduleId ? [moduleId] : [] }
  nodes.set(node.id, node)
  return node
}
function addEdge(source, target, type, moduleId, evidence) {
  if (source === target) return
  const id = [source, type, target, moduleId || ''].join('|')
  let edge = edges.get(id)
  if (!edge) { edge = { id, source, target, type, moduleId, evidence: [] }; edges.set(id, edge) }
  if (evidence && !edge.evidence.some((item) => item.sourcePath === evidence.sourcePath && item.line === evidence.line && item.method === evidence.method)) edge.evidence.push(evidence)
}
for (const edge of platformMapEdges) addEdge(edge.source, edge.target, 'CONTAINS')
for (const module of platformMapNodes.filter((node) => node.type === 'module')) {
  const implementation = module.implementation
  if (implementation) {
    for (const route of implementation.routes) {
      addNode({ id: sourceId(route.sourcePath), label: route.label, type: 'page', sourcePath: route.sourcePath, sourceRef: implementation.sourceRef, routes: [route.href], dynamic: route.dynamic, purpose: 'Application entry point: ' + route.href }, module.id)
      addEdge(module.id, sourceId(route.sourcePath), 'CONTAINS', module.id)
    }
    for (const component of implementation.components || []) {
      addNode({ id: sourceId(component.sourcePath), label: component.label, type: 'component', sourcePath: component.sourcePath, sourceRef: implementation.sourceRef, purpose: 'Component present in the audited source.' }, module.id)
      addEdge(module.id, sourceId(component.sourcePath), 'CONTAINS', module.id)
    }
    for (const api of implementation.apis || []) {
      addNode({ id: sourceId(api.sourcePath), label: api.label, type: 'api', sourcePath: api.sourcePath, sourceRef: implementation.sourceRef, routes: [api.href], methods: api.methods, auth: api.auth, purpose: api.note }, module.id)
      addEdge(module.id, sourceId(api.sourcePath), 'CONTAINS', module.id)
      for (const call of api.consumers) addEdge(sourceId(call.sourcePath), sourceId(api.sourcePath), 'CONSUMES', module.id, { ...call, sourceRef: implementation.sourceRef })
    }
  }
  const database = module.database
  if (!database) continue
  const evidence = (item) => ({ ...item, sourcePath: item.sourcePath || database.sourcePath, sourceRef: database.sourceRef })
  const ensureSource = (path) => {
    if (!nodes.has(sourceId(path))) addNode({ id: sourceId(path), label: path.split('/').pop().replace(/\.js$/, ''), type: /\/route\.js$/.test(path) ? 'api' : /\/page\.js$/.test(path) ? 'page' : 'component', sourcePath: path, sourceRef: database.sourceRef }, module.id)
  }
  for (const table of database.dataSources) {
    addNode({ id: databaseId(table), label: table.name, type: table.kind === 'table' ? 'table' : 'view', schema: table.schema, purpose: table.purpose, verifiedOn: database.verifiedOn }, module.id)
    for (const operation of table.operations) {
      const call = evidence(operation)
      ensureSource(call.sourcePath)
      addEdge(sourceId(call.sourcePath), databaseId(table), operation.method === 'select' ? 'READS' : 'WRITES', module.id, call)
    }
  }
  for (const fn of database.functions) {
    addNode({ id: rpcId(fn), label: fn.name, type: 'rpc', schema: fn.schema, arguments: fn.arguments, returns: fn.returns, purpose: fn.purpose, verifiedOn: database.verifiedOn }, module.id)
    for (const entry of fn.calls || [{ sourcePath: fn.sourcePath || database.sourcePath, line: fn.line }]) {
      const call = evidence(entry)
      ensureSource(call.sourcePath)
      addEdge(sourceId(call.sourcePath), rpcId(fn), 'TRIGGERS', module.id, call)
    }
  }
  for (const bucket of database.storage || []) {
    addNode({ id: storageId(bucket), label: bucket.name, type: 'storage', public: bucket.public, purpose: bucket.purpose, verifiedOn: database.verifiedOn }, module.id)
    for (const operation of bucket.operations || []) {
      const call = evidence(operation)
      ensureSource(call.sourcePath)
      addEdge(sourceId(call.sourcePath), storageId(bucket), ['upload', 'update', 'remove'].includes(operation.method) ? 'WRITES' : 'READS', module.id, call)
    }
  }
}
for (const link of platformMapInventory.sourceLinks) {
  const source = nodes.get(sourceId(link.sourcePath))
  const target = nodes.get(sourceId(link.targetPath))
  if (!source || !target) continue
  for (const moduleId of source.moduleIds) addEdge(source.id, target.id, link.type, moduleId, { sourcePath: link.sourcePath, sourceRef: architectureAudit.sourceRef, line: link.line })
}
export const architectureNodes = [...nodes.values()]
export const architectureEdges = [...edges.values()]
export const architectureModules = architectureNodes.filter((node) => node.type === 'module')
export const architectureWorkspaces = architectureNodes.filter((node) => node.type === 'workspace')
export function getArchitectureNode(id) { return nodes.get(id) || null }
export function sourceUrl(item) {
  if (!item?.sourcePath) return null
  return 'https://github.com/gestaoexcelispro/ritsuflow/blob/' + (item.sourceRef || architectureAudit.sourceRef) + '/' + item.sourcePath + (item.line ? '#L' + item.line : '')
}
export function matchesFilter(node, filter = 'All') {
  if (filter === 'Workspaces') return node.type === 'workspace'
  if (filter === 'Modules') return node.type === 'module'
  if (filter === 'Pages') return ['page', 'component'].includes(node.type)
  if (filter === 'Database') return ['table', 'view', 'rpc', 'storage'].includes(node.type)
  if (filter === 'APIs') return node.type === 'api'
  return true
}
export function searchArchitecture(query = '', filter = 'All', workspace = 'all') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return architectureNodes.filter((node) => {
    if (!matchesFilter(node, filter)) return false
    if (workspace !== 'all' && node.id !== workspace && !node.moduleIds.some((id) => getArchitectureNode(id)?.workspace === workspace)) return false
    const owners = node.moduleIds.map((id) => getArchitectureNode(id)?.label || '').join(' ')
    const haystack = [node.label, node.type, node.schema, node.sourcePath, node.purpose, ...(node.routes || []), owners].filter(Boolean).join(' ').toLowerCase()
    return words.every((word) => haystack.includes(word))
  }).sort((a, b) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id))
}
export function getNodeModule(node, preferredModuleId) {
  if (node?.type === 'module') return node
  const preferred = getArchitectureNode(preferredModuleId)
  if (preferred?.type === 'module' && node?.moduleIds.includes(preferred.id)) return preferred
  return getArchitectureNode(node?.moduleIds?.[0])
}
export function getRelationships(nodeId, moduleId) {
  return architectureEdges.filter((edge) => (edge.source === nodeId || edge.target === nodeId) && (!moduleId || !edge.moduleId || edge.moduleId === moduleId))
}
export function getTechnicalGraph(moduleId, focusId = moduleId, filter = 'All', page = 0, pageSize = 10) {
  const module = getArchitectureNode(moduleId)
  if (module?.type !== 'module') return { nodes: [], edges: [], total: 0, pages: 1 }
  const focus = getArchitectureNode(focusId) || module
  const related = focus.id === moduleId
    ? architectureNodes.filter((node) => node.type !== 'module' && node.moduleIds.includes(moduleId))
    : getRelationships(focus.id, moduleId).flatMap((edge) => [getArchitectureNode(edge.source), getArchitectureNode(edge.target)]).filter((node) => node && node.id !== focus.id && node.id !== moduleId && !['platform', 'workspace'].includes(node.type))
  const byId = new Map(related.map((node) => [node.id, node]))
  const ordered = [...byId.values()].filter((node) => matchesFilter(node, filter)).sort((a, b) => {
    const order = { page: 0, component: 1, api: 2, table: 3, view: 4, rpc: 5, storage: 6 }
    return (order[a.type] ?? 7) - (order[b.type] ?? 7) || a.label.localeCompare(b.label)
  })
  const pages = Math.max(1, Math.ceil(ordered.length / pageSize))
  const currentPage = Math.min(Math.max(0, page), pages - 1)
  const visible = ordered.slice(currentPage * pageSize, (currentPage + 1) * pageSize)
  const selected = new Map([module, focus, ...visible].map((node) => [node.id, node]))
  // Keep the caller of a selected database object as context, even when a type filter is active.
  if (focus.id === moduleId) {
    for (const node of visible) {
      if (!['table', 'view', 'rpc', 'storage'].includes(node.type)) continue
      const caller = architectureEdges.find((edge) => edge.target === node.id && edge.moduleId === moduleId)
      if (caller) selected.set(caller.source, getArchitectureNode(caller.source))
    }
  }
  const ids = new Set(selected.keys())
  const visibleEdges = architectureEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target) && (!edge.moduleId || edge.moduleId === moduleId))
  // Source access is proven at the caller; module membership is also recorded for context.
  for (const node of selected.values()) {
    if (node.id === moduleId || visibleEdges.some((edge) => edge.source === moduleId && edge.target === node.id) || !['page', 'component', 'api'].includes(node.type)) continue
    visibleEdges.push({ id: moduleId + '|CONTAINS|' + node.id, source: moduleId, target: node.id, type: 'CONTAINS', moduleId, evidence: [] })
  }
  return { nodes: [...selected.values()], edges: visibleEdges, total: ordered.length, pages, page: currentPage }
}
export function getCoverageRows(workspace = 'all', query = '') {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return architectureModules.filter((module) => (workspace === 'all' || module.workspace === workspace) && words.every((word) => (module.label + ' ' + getArchitectureNode(module.workspace).label).toLowerCase().includes(word))).map((module) => ({
    ...module,
    routeCount: module.implementation?.routes.length || 0,
    componentCount: module.implementation?.components?.length || 0,
    apiCount: module.implementation?.apis?.length || 0,
    dataCount: module.database?.dataSources.length || 0,
    rpcCount: module.database?.functions.length || 0,
    storageCount: module.database?.storage?.length || 0,
    gaps: architectureGaps.filter((gap) => gap.moduleId === module.id),
    status: module.implementation?.status || 'unmapped'
  }))
}
export function getReportSummary(workspace = 'all') {
  const rows = getCoverageRows(workspace)
  const ids = new Set(rows.map((row) => row.id))
  const included = architectureNodes.filter((node) => node.moduleIds.some((id) => ids.has(id)))
  const count = (types) => included.filter((node) => types.includes(node.type)).length
  return { modules: rows.length, mapped: rows.filter((row) => ['mapped', 'embedded'].includes(row.status)).length, dataMapped: rows.filter((row) => !!row.database).length, pages: count(['page']), components: count(['component']), apis: count(['api']), tables: count(['table', 'view']), rpcs: count(['rpc']), storage: count(['storage']), gaps: architectureGaps.filter((gap) => ids.has(gap.moduleId)).length }
}
export function getDependencyRows(workspace = 'all', query = '') {
  return searchArchitecture(query, 'All', workspace).filter((node) => ['table', 'view', 'rpc', 'storage', 'api'].includes(node.type)).map((node) => {
    const moduleIds = node.moduleIds.filter((id) => workspace === 'all' || getArchitectureNode(id)?.workspace === workspace)
    const access = architectureEdges.filter((edge) => edge.target === node.id && moduleIds.includes(edge.moduleId) && edge.type !== 'CONTAINS')
    return { ...node, moduleIds, access }
  })
}
export function csvCell(value) {
  let text = String(value ?? '')
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text
  return '"' + text.replace(/"/g, '""') + '"'
}
export function reportCsv(tab, workspace = 'all', query = '', { onlyGaps = false, dependencyType = 'all' } = {}) {
  let header, rows
  if (tab === 'dependencies') {
    header = ['Name', 'Type', 'Modules', 'Relationships', 'Verified on']
    rows = getDependencyRows(workspace, query).filter((node) => dependencyType === 'all' || (dependencyType === 'database' ? ['table', 'view'].includes(node.type) : node.type === dependencyType)).map((node) => [node.schema ? node.schema + '.' + node.label : node.label, node.type, node.moduleIds.map((id) => getArchitectureNode(id).label).join('; '), [...new Set(node.access.map((edge) => edge.type))].join('; '), architectureAudit.verifiedOn])
  } else if (tab === 'gaps') {
    header = ['Workspace', 'Module', 'Gap', 'Detail', 'Source']
    const allowed = new Set(getCoverageRows(workspace).map((row) => row.id))
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    rows = architectureGaps.filter((gap) => allowed.has(gap.moduleId) && words.every((word) => (gap.title + ' ' + gap.detail + ' ' + getArchitectureNode(gap.moduleId).label).toLowerCase().includes(word))).map((gap) => {
      const module = getArchitectureNode(gap.moduleId)
      return [getArchitectureNode(module.workspace).label, module.label, gap.title, gap.detail, sourceUrl(gap) || 'Audited route inventory']
    })
  } else {
    header = ['Workspace', 'Module', 'Implementation', 'Pages', 'Components', 'APIs', 'Tables / views', 'RPCs', 'Storage', 'Gaps', 'Verified on']
    rows = getCoverageRows(workspace, query).filter((row) => !onlyGaps || row.gaps.length).map((row) => [getArchitectureNode(row.workspace).label, row.label, row.status, row.routeCount, row.componentCount, row.apiCount, row.dataCount, row.rpcCount, row.storageCount, row.gaps.length, architectureAudit.verifiedOn])
  }
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
