import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'

const directory = new URL('../src/app/ritsu-admin/platform-map/', import.meta.url)
const read = (name) => readFile(new URL(name, directory), 'utf8')
const moduleUrl = (source) => 'data:text/javascript;charset=utf-8,' + encodeURIComponent(source)
const inventoryUrl = moduleUrl(await read('platformMapInventory.js'))
const dataUrl = moduleUrl((await read('platformMapData.js')).replace("'./platformMapInventory'", JSON.stringify(inventoryUrl)))
const modelUrl = moduleUrl((await read('platformMapModel.js')).replace("'./platformMapData'", JSON.stringify(dataUrl)).replace("'./platformMapInventory'", JSON.stringify(inventoryUrl)))
const model = await import(modelUrl)
const { platformMapInventory: inventory } = await import(inventoryUrl)
let checks = 0
function check(name, condition) { assert.ok(condition, name); checks += 1 }

const ids = new Set(model.architectureNodes.map((node) => node.id))
check('Architecture node IDs are unique', ids.size === model.architectureNodes.length)
check('Every edge has existing endpoints', model.architectureEdges.every((edge) => ids.has(edge.source) && ids.has(edge.target)))
check('Technical relationships have source evidence', model.architectureEdges.filter((edge) => edge.type !== 'CONTAINS').every((edge) => edge.evidence.length && edge.evidence.every((item) => item.sourcePath && item.sourceRef && item.line > 0)))
check('Pull Planning is mapped to its routes', model.getCoverageRows().some((row) => row.id === 'pull-planning' && row.status === 'mapped' && row.routeCount >= 3))
check('Team is an embedded implementation', model.getCoverageRows().some((row) => row.id === 'project-team' && row.status === 'embedded' && row.routeCount && row.componentCount))
check('Unimplemented modules remain explicit gaps', ['pre-planning', 'precon-reports'].every((id) => model.getCoverageRows().some((row) => row.id === id && row.status === 'no-route' && row.gaps.length)))
check('Lookahead RPC uses the audited overload', model.getArchitectureNode('rpc:public.delete_lookahead_manual_sheet_row').arguments === 'target_lookahead_plan_id uuid, target_sheet_row_id uuid')
check('Location QR has a traced API call', model.architectureEdges.some((edge) => edge.source === 'source:src/app/projects/[projectId]/locations/StandaloneLocationWorkspace.js' && edge.target === 'source:src/app/api/projects/[projectId]/locations/[locationId]/qr/route.js' && edge.type === 'CONSUMES'))
check('The QR API has a verified write target', model.architectureEdges.some((edge) => edge.source === 'source:src/app/api/projects/[projectId]/locations/[locationId]/qr/route.js' && edge.target === 'db:public.locations' && edge.type === 'WRITES'))
check('Navigation is recorded separately from data access', model.architectureEdges.some((edge) => edge.type === 'ROUTES TO' && edge.evidence.length))
check('Storage is not represented as a table', model.getArchitectureNode('storage:project-documents')?.type === 'storage' && !model.getArchitectureNode('db:public.project-documents'))
check('Project document bucket writes are mapped', model.architectureEdges.some((edge) => edge.source === 'source:src/app/projects/[projectId]/ProjectDocuments.js' && edge.target === 'storage:project-documents' && edge.type === 'WRITES'))
check('Attachment storage fallback is explicit', model.getArchitectureNode('storage:daily-report-attachments')?.purpose.includes('record-dependent'))
const attendance = model.searchArchitecture('attendance', 'Database')
check('Database search only returns database object types', attendance.length && attendance.every((node) => ['table', 'view', 'rpc', 'storage'].includes(node.type)))
check('Workspace filters retain only matching module ownership', model.getDependencyRows('fieldop').every((node) => node.moduleIds.every((id) => model.getArchitectureNode(id).workspace === 'fieldop')))
check('A focused handler survives type filtering', model.getTechnicalGraph('location-structure', 'source:src/app/api/projects/[projectId]/locations/[locationId]/qr/route.js', 'Database').nodes.some((node) => node.id === 'source:src/app/api/projects/[projectId]/locations/[locationId]/qr/route.js'))

for (const module of model.architectureModules) {
  for (const filter of ['All', 'Pages', 'Database', 'APIs']) {
    const first = model.getTechnicalGraph(module.id, module.id, filter, 0, 8)
    const visible = new Set()
    for (let page = 0; page < first.pages; page += 1) {
      const graph = model.getTechnicalGraph(module.id, module.id, filter, page, 8)
      const present = new Set(graph.nodes.map((node) => node.id))
      check('Valid graph page: ' + module.id + ' / ' + filter + ' / ' + page, graph.page === page && graph.edges.every((edge) => present.has(edge.source) && present.has(edge.target)))
      graph.nodes.filter((node) => model.matchesFilter(node, filter) && node.id !== module.id).forEach((node) => visible.add(node.id))
    }
    const expected = model.architectureNodes.filter((node) => node.type !== 'module' && node.moduleIds.includes(module.id) && model.matchesFilter(node, filter))
    check('Pagination does not lose matching inventory: ' + module.id + ' / ' + filter, expected.every((node) => visible.has(node.id)))
  }
}
assert.equal(model.csvCell('a,"b"\nc'), '"a,""b""\nc"')
assert.equal(model.csvCell('=1+2'), '"\'=1+2"')
checks += 2
check('Coverage CSV respects the gap filter', model.reportCsv('coverage', 'all', '', { onlyGaps: true }).split('\r\n').length === model.getCoverageRows().filter((row) => row.gaps.length).length + 2)
check('Dependency CSV respects the API filter', model.reportCsv('dependencies', 'all', '', { dependencyType: 'api' }).split('\r\n').length === model.getDependencyRows().filter((row) => row.type === 'api').length + 2)
check('Summary counts unique shared dependencies', model.getReportSummary().tables === model.architectureNodes.filter((node) => ['table', 'view'].includes(node.type)).length)
check('Every recorded gap belongs to an existing module', inventory.gaps.every((gap) => model.getArchitectureNode(gap.moduleId)?.type === 'module'))

const root = new URL('../', import.meta.url)
const paths = new Set(model.architectureNodes.filter((node) => node.sourcePath).map((node) => node.sourcePath))
await Promise.all([...paths].map((path) => access(new URL(path, root))))
checks += paths.size
console.log('Platform architecture checks passed: ' + checks)
