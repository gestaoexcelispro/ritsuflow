'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPlatformMapEditor } from './createPlatformMapEditor'
import { getPlatformMapNode, platformMapNodes } from './platformMapData'
import {
  getArchitectureNode, getNodeModule, getRelationships, getTechnicalGraph,
  nodeTypeLabels, searchArchitecture, sourceUrl,
} from './platformMapModel'

function List({ title, items }) {
  if (!items?.length) return null
  return <section className="pmInspectorSection"><h4>{title}</h4>{items.map((item) => <div className="pmInspectorItem" key={item}>{item}</div>)}</section>
}
function SourceLink({ item, children = 'View source' }) {
  const href = sourceUrl(item)
  return href ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : null
}
function RelatedModules({ items, onNavigate }) {
  if (!items?.length) return null
  return <section className="pmInspectorSection"><h4>Related Modules</h4>{items.map((label) => {
    const matches = platformMapNodes.filter((node) => node.label === label && ['module', 'workspace'].includes(node.type))
    return matches.length === 1
      ? <button type="button" className="pmInspectorItem pmNodeButton" key={label} onClick={() => onNavigate(matches[0])}>Explore {label} <span aria-hidden="true">›</span></button>
      : <div className="pmInspectorItem" key={label}>{label}</div>
  })}</section>
}
function ApplicationPages({ module, onNavigate }) {
  const implementation = module?.implementation
  if (!implementation) return null
  const labels = { mapped: 'Pages mapped', embedded: 'Embedded implementation', 'no-route': 'No dedicated page found' }
  return <section className="pmInspectorSection">
    <h4>Application Pages</h4>
    <span className={implementation.status === 'no-route' ? 'pmPageStatus' : 'pmPageStatus pmPageStatusMapped'}>{labels[implementation.status]}</span>
    <p className="pmPageNote">{implementation.note}</p>
    {implementation.routes.map((route) => <div className="pmPageCard" key={route.href}>
      <strong>{route.label}</strong><code>{route.href}</code>
      <div className="pmPageActions">
        {!route.dynamic && !/\[/.test(route.href) && <a href={route.href} target="_blank" rel="noopener noreferrer">Open page</a>}
        <SourceLink item={{ ...route, sourceRef: implementation.sourceRef }} />
        <button type="button" onClick={() => onNavigate(getArchitectureNode('source:' + route.sourcePath))}>Explore dependencies</button>
      </div>
      {(route.dynamic || /\[/.test(route.href)) && <small>Open through a project or report record; this route requires an ID.</small>}
      <small>{route.sourcePath}</small>
    </div>)}
    {!!implementation.components?.length && <><h4>Components</h4>{implementation.components.map((component) => <button type="button" className="pmInspectorItem pmNodeButton" key={component.sourcePath} onClick={() => onNavigate(getArchitectureNode('source:' + component.sourcePath))}>{component.label} <span aria-hidden="true">›</span></button>)}</>}
    {!!implementation.apis?.length && <><h4>API Handlers</h4>{implementation.apis.map((api) => <div className="pmRpcCard" key={api.href}>
      <code>{api.methods.join(' / ')} {api.href}</code><p>{api.note}</p><small>{api.auth}</small>
      <div className="pmPageActions"><SourceLink item={{ ...api, sourceRef: implementation.sourceRef }} /><button type="button" onClick={() => onNavigate(getArchitectureNode('source:' + api.sourcePath))}>Explore handler</button></div>
    </div>)}</>}
  </section>
}
function DatabaseDependencies({ database, onNavigate }) {
  if (!database) return null
  const operationLabels = { select: 'Read', insert: 'Insert', upsert: 'Upsert', update: 'Update', delete: 'Delete', upload: 'Upload', remove: 'Remove', getPublicUrl: 'Public URL', createSignedUrl: 'Signed URL' }
  const evidence = (operation) => ({ ...operation, sourcePath: operation.sourcePath || database.sourcePath, sourceRef: database.sourceRef })
  return <section className="pmInspectorSection">
    <h4>Data Dependencies</h4>
    <span className="pmPageStatus pmPageStatusMapped">Source and schema verified</span>
    <p className="pmPageNote">Verified on {database.verifiedOn}. Direct accesses from audited pages, components and handlers are shown below. RPC internals are outside this snapshot.</p>
    <table className="pmDependencyTable"><caption>Tables and views</caption><thead><tr><th scope="col">Data source</th><th scope="col">Access</th></tr></thead>
      <tbody>{database.dataSources.map((source) => <tr key={source.name}>
        <td><button type="button" className="pmTextButton" onClick={() => onNavigate(getArchitectureNode('db:' + source.schema + '.' + source.name))}><code>{source.schema}.{source.name}</code></button><small>{source.kind} · {source.purpose}</small></td>
        <td><div className="pmDbOperations">{source.operations.map((operation) => <a key={operation.method + ':' + (operation.sourcePath || '') + ':' + operation.line} href={sourceUrl(evidence(operation))} target="_blank" rel="noopener noreferrer" title={evidence(operation).sourcePath + ':' + operation.line}>{operationLabels[operation.method] || operation.method}</a>)}</div></td>
      </tr>)}</tbody>
    </table>
    {!!database.storage?.length && <section className="pmInspectorSection"><h4>Storage Buckets</h4>{database.storage.map((bucket) => <div className="pmRpcCard" key={bucket.name}>
      <button type="button" className="pmTextButton" onClick={() => onNavigate(getArchitectureNode('storage:' + bucket.name))}><code>{bucket.name}</code></button><p>{bucket.purpose}</p><small>{bucket.public ? 'Public bucket' : 'Private bucket'}</small>
      <div className="pmDbOperations">{(bucket.operations || []).map((operation) => <a key={operation.method + operation.sourcePath} href={sourceUrl(evidence(operation))} target="_blank" rel="noopener noreferrer">{operationLabels[operation.method] || operation.method}</a>)}</div>
    </div>)}</section>}
    {!!database.functions.length && <section className="pmInspectorSection"><h4>RPC Functions</h4>{database.functions.map((fn) => <div className="pmRpcCard" key={fn.name}>
      <button type="button" className="pmTextButton" onClick={() => onNavigate(getArchitectureNode('rpc:' + fn.schema + '.' + fn.name))}><code>{fn.schema}.{fn.name}</code></button><p>{fn.purpose}</p>
      <small>Parameters: <code>{fn.arguments}</code></small><small>Returns: <code>{fn.returns}</code></small>
      <div className="pmPageActions">{(fn.calls || [{ sourcePath: fn.sourcePath || database.sourcePath, line: fn.line }]).map((call) => <SourceLink key={call.sourcePath + call.line} item={evidence(call)}>Call site · L{call.line}</SourceLink>)}</div>
    </div>)}</section>}
  </section>
}
function Relationships({ node, moduleId, onNavigate }) {
  const edges = getRelationships(node.id, moduleId)
  if (!edges.length) return <p className="pmPageNote">No direct relationships were found in this audited scope.</p>
  return <section className="pmInspectorSection"><h4>Relationships</h4>{edges.map((edge) => {
    const outgoing = edge.source === node.id
    const related = getArchitectureNode(outgoing ? edge.target : edge.source)
    return <div className="pmRelationCard" key={edge.id}>
      <span className="pmRelationType">{outgoing ? edge.type : edge.type + ' BY'}</span>
      <button type="button" className="pmTextButton" onClick={() => onNavigate(related)}>{related?.label}</button>
      <div className="pmPageActions">{edge.evidence.map((item) => <SourceLink key={item.sourcePath + item.line + (item.method || '')} item={item}>{item.method || 'Source'} · L{item.line}</SourceLink>)}</div>
    </div>
  })}</section>
}
function TechnicalInspector({ node, moduleId, onNavigate }) {
  return <>
    <section className="pmPurpose"><h4>Implementation</h4><p>{node.purpose || 'Verified architecture inventory item.'}</p></section>
    {!!node.routes?.length && <List title="Routes" items={node.routes} />}
    {node.routes?.some((route) => /\[/.test(route)) && <p className="pmPageNote">This route requires a project or report ID.</p>}
    {node.sourcePath && <div className="pmPageCard"><code>{node.sourcePath}</code><div className="pmPageActions"><SourceLink item={node} /></div></div>}
    {!!node.methods?.length && <List title="HTTP methods" items={node.methods} />}
    {node.auth && <p className="pmPageNote">{node.auth}</p>}
    {node.type === 'rpc' && <div className="pmRpcCard"><small>Parameters: <code>{node.arguments}</code></small><small>Returns: <code>{node.returns}</code></small><p>Function signature verified; internal database access has not been traced.</p></div>}
    {node.type === 'storage' && <p className="pmPageNote">{node.public ? 'Public' : 'Private'} storage bucket.</p>}
    {!!node.moduleIds?.length && <section className="pmInspectorSection"><h4>Used by modules</h4>{node.moduleIds.map((id) => <button type="button" className="pmInspectorItem pmNodeButton" key={id} onClick={() => onNavigate(getArchitectureNode(id))}>{getArchitectureNode(id)?.label} <span aria-hidden="true">›</span></button>)}</section>}
    <Relationships node={node} moduleId={moduleId} onNavigate={onNavigate} />
  </>
}

export default function PlatformMapCanvas({ query = '', filter = 'All', initialNodeId }) {
  const initial = getArchitectureNode(initialNodeId)
  const initialModule = getNodeModule(initial)
  const containerRef = useRef(null)
  const previousFilter = useRef(filter)
  const [selected, setSelected] = useState(initial)
  const [focusId, setFocusId] = useState(initialModule?.id || (initial?.type === 'workspace' ? initial.id : 'ritsuflow'))
  const [view, setView] = useState(initial && !['platform', 'workspace', 'module'].includes(initial.type) ? 'technical' : 'flow')
  const [technicalFocusId, setTechnicalFocusId] = useState(initial?.id || initialModule?.id)
  const [graphPage, setGraphPage] = useState(0)
  const [resultPage, setResultPage] = useState(0)
  const [showResults, setShowResults] = useState(false)
  const [editorError, setEditorError] = useState('')
  const [loading, setLoading] = useState(true)
  const focus = getPlatformMapNode(focusId)
  const workspace = focus?.type === 'module' ? getPlatformMapNode(focus.workspace) : focus?.type === 'workspace' ? focus : null
  const inventoryActive = !!query.trim() || filter !== 'All'
  const results = useMemo(() => searchArchitecture(query, filter), [query, filter])
  const technicalGraph = useMemo(() => focus?.type === 'module' ? getTechnicalGraph(focusId, technicalFocusId || focusId, filter, graphPage, 8) : null, [focus, focusId, technicalFocusId, filter, graphPage])

  function navigateToNode(node) {
    if (!node) return
    setSelected(node); setGraphPage(0); setShowResults(false)
    if (['platform', 'workspace'].includes(node.type)) { setFocusId(node.id); setView('flow'); setTechnicalFocusId(null); return }
    if (node.type === 'module') { setFocusId(node.id); setTechnicalFocusId(node.id); if (['Pages', 'Database', 'APIs'].includes(filter)) setView('technical'); return }
    if (node.type === 'detail') return
    const module = getNodeModule(node, focusId)
    if (module) { setFocusId(module.id); setView('technical'); setTechnicalFocusId(node.id) }
  }
  useEffect(() => { setResultPage(0); setShowResults(inventoryActive) }, [query, filter, inventoryActive])
  useEffect(() => {
    if (previousFilter.current === filter) return
    previousFilter.current = filter
    setGraphPage(0)
    if (focus?.type === 'module' && ['Pages', 'Database', 'APIs'].includes(filter)) { setView('technical'); setTechnicalFocusId(focusId) }
  }, [filter, focusId, focus?.type])
  useEffect(() => {
    if (!containerRef.current) return
    const controller = new AbortController()
    const host = document.createElement('div')
    host.className = 'pmEditorHost'
    containerRef.current.appendChild(host)
    let dispose
    setLoading(true); setEditorError('')
    createPlatformMapEditor(host, { onSelect: navigateToNode, focusId, view, technicalFocusId, filter, graphPage, signal: controller.signal })
      .then((cleanup) => {
        if (controller.signal.aborted) cleanup?.()
        else { dispose = cleanup; setLoading(false) }
      }).catch((error) => {
        if (!controller.signal.aborted) { setEditorError('The map could not be rendered. Change focus to retry.'); setLoading(false); console.error('Platform map render failed', error) }
      })
    return () => { controller.abort(); dispose?.(); host.remove() }
  }, [focusId, view, technicalFocusId, filter, graphPage])

  const selectedParent = selected?.type === 'detail' ? getPlatformMapNode(selected.parent) : null
  const goRoot = () => { setFocusId('ritsuflow'); setSelected(null); setView('flow'); setTechnicalFocusId(null); setGraphPage(0) }
  const resultPages = Math.max(1, Math.ceil(results.length / 8))
  const showTechnical = focus?.type === 'module' && view === 'technical'
  return <div className="pmShell">
    <div className="pmMapNav">
      <button type="button" className={focusId === 'ritsuflow' ? 'active' : ''} onClick={goRoot}>RitsuFlow</button>
      {workspace && <><span>›</span><button type="button" className={focus?.type === 'workspace' ? 'active' : ''} onClick={() => navigateToNode(workspace)}>{workspace.label}</button></>}
      {focus?.type === 'module' && <><span>›</span><button type="button" className="active" onClick={() => { setTechnicalFocusId(focus.id); setGraphPage(0); setSelected(focus) }}>{focus.label}</button></>}
      <small>{showTechnical ? 'Select a page, component or dependency to trace access' : focusId === 'ritsuflow' ? 'Select a workspace to explore its modules' : focus?.type === 'workspace' ? 'Select a module to inspect how it works' : 'Inputs → Process → Outputs'}</small>
    </div>
    <div className="pmMapControls">
      {focus?.type === 'module' && <div className="pmViewSwitch">
        <button type="button" aria-pressed={view === 'flow'} className={view === 'flow' ? 'active' : ''} onClick={() => { setView('flow'); setGraphPage(0) }}>Flow</button>
        <button type="button" aria-pressed={view === 'technical'} className={view === 'technical' ? 'active' : ''} onClick={() => { setView('technical'); setTechnicalFocusId(focusId); setGraphPage(0) }}>Technical</button>
      </div>}
      {inventoryActive && <button type="button" className="pmInventoryToggle" aria-expanded={showResults} onClick={() => setShowResults(!showResults)}>Inventory · {results.length} matches</button>}
      {showTechnical && <div className="pmGraphPagination">
        <button type="button" disabled={!technicalGraph?.page} onClick={() => setGraphPage(Math.max(0, graphPage - 1))} aria-label="Previous graph items">‹</button>
        <span>{(technicalGraph?.page || 0) + 1} / {technicalGraph?.pages || 1}</span>
        <button type="button" disabled={(technicalGraph?.page || 0) >= (technicalGraph?.pages || 1) - 1} onClick={() => setGraphPage(graphPage + 1)} aria-label="Next graph items">›</button>
        <small>{technicalGraph?.total || 0} related items</small>
      </div>}
    </div>
    {inventoryActive && showResults && <aside className="pmSearchResults" aria-label="Architecture search results">
      <div className="pmSearchHeading"><strong>{filter === 'All' ? 'Search results' : filter}</strong><span>{results.length} matches</span></div>
      {!results.length && <p>No matching inventory items. Try another name, route or data source.</p>}
      {results.slice(resultPage * 8, (resultPage + 1) * 8).map((node) => <button type="button" key={node.id} onClick={() => navigateToNode(node)}>
        <strong>{node.label}</strong><small>{nodeTypeLabels[node.type]}{node.moduleIds.length ? ' · ' + node.moduleIds.map((id) => getArchitectureNode(id)?.label).join(', ') : ''}</small>
      </button>)}
      {resultPages > 1 && <div className="pmResultPagination"><button type="button" disabled={!resultPage} onClick={() => setResultPage(resultPage - 1)}>Previous</button><span>{resultPage + 1} / {resultPages}</span><button type="button" disabled={resultPage >= resultPages - 1} onClick={() => setResultPage(resultPage + 1)}>Next</button></div>}
    </aside>}
    <div ref={containerRef} className="pmReteCanvas" aria-label={showTechnical ? 'Technical dependency graph' : 'Platform flow map'} />
    {(loading || editorError) && <div className="pmCanvasNotice" role="status">{editorError || 'Loading map…'}</div>}
    {showTechnical && <div className="pmGraphLegend">CONTAINS · DEPENDS ON · ROUTES TO · CONSUMES · READS · WRITES · TRIGGERS <small>Relationship labels appear at the source ports. Source evidence is in the inspector.</small></div>}
    {selected && <aside className="pmInspector" aria-label="Node inspector">
      <div className="pmInspectorHeader"><div><span className="pmType">{nodeTypeLabels[selected.type] || selected.type}</span><h2>{selected.label}</h2><p>{selected.subtitle || selected.schema}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close inspector">×</button></div>
      <div className="pmInspectorBody">
        {selected.type === 'detail' ? <>
          <section className="pmPurpose"><h4>Module</h4><p>{selectedParent?.label || focus?.label}</p></section>
          {selected.detailType === 'data' && selectedParent?.database ? <DatabaseDependencies database={selectedParent.database} onNavigate={navigateToNode} /> : <List title={selected.label} items={selected.items} />}
          {selected.detailType === 'pages' && <ApplicationPages module={selectedParent} onNavigate={navigateToNode} />}
        </> : ['platform', 'workspace', 'module'].includes(selected.type) ? <>
          <section className="pmPurpose"><h4>Purpose</h4><p>{selected.purpose || selected.subtitle}</p></section>
          {(selected.inputs?.length || selected.process?.length || selected.outputs?.length) && <div className="pmFlowGrid"><List title="Inputs" items={selected.inputs} /><List title="Process" items={selected.process} /><List title="Outputs" items={selected.outputs} /></div>}
          <ApplicationPages module={selected} onNavigate={navigateToNode} />
          <RelatedModules items={selected.related} onNavigate={navigateToNode} />
          {selected.database ? <DatabaseDependencies database={selected.database} onNavigate={navigateToNode} /> : <List title="Data Layer" items={selected.data} />}
        </> : <TechnicalInspector node={selected} moduleId={focusId} onNavigate={navigateToNode} />}
      </div>
    </aside>}
  </div>
}
