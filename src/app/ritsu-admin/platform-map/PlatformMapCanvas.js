'use client'

import { useEffect, useRef, useState } from 'react'
import { createPlatformMapEditor } from './createPlatformMapEditor'
import { getPlatformMapNode, platformMapNodes } from './platformMapData'

function List({ title, items }) {
  if (!items?.length) return null
  return <section className="pmInspectorSection"><h4>{title}</h4>{items.map((item) => <div className="pmInspectorItem" key={item}>{item}</div>)}</section>
}


function RelatedModules({ items, onNavigate }) {
  if (!items?.length) return null
  return <section className="pmInspectorSection"><h4>Related Modules</h4>{items.map((label) => {
    const matches = platformMapNodes.filter((node) => node.label === label && (node.type === 'module' || node.type === 'workspace'))
    const target = matches.length === 1 ? matches[0] : null
    return target
      ? <button type="button" className="pmInspectorItem" key={label} onClick={() => onNavigate(target)}
          aria-label={`Explore ${label}`}
          style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
          {label}<span aria-hidden="true" style={{ float: 'right' }}>›</span>
        </button>
      : <div className="pmInspectorItem" key={label}>{label}</div>
  })}</section>
}


function ApplicationPages({ module }) {
  const implementation = module?.implementation
  if (!implementation) return null
  const sourceBase = `https://github.com/gestaoexcelispro/ritsuflow/blob/${implementation.sourceRef}/`

  return <section className="pmInspectorSection">
    <h4>Application Pages</h4>
    <span className={implementation.status === 'mapped' ? 'pmPageStatus pmPageStatusMapped' : 'pmPageStatus'}>
      {implementation.status === 'mapped' ? 'Pages mapped' : 'No dedicated page found'}
    </span>
    <p className="pmPageNote">{implementation.note}</p>
    {implementation.routes.map((route) => <div className="pmPageCard" key={route.href}>
      <strong>{route.label}</strong>
      <code>{route.href}</code>
      <div className="pmPageActions">
        <a href={route.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${route.label} in a new tab`}>Open page</a>
        <a href={sourceBase + route.sourcePath} target="_blank" rel="noopener noreferrer" aria-label={`View source for ${route.label} on GitHub`}>View source</a>
      </div>
      <small>{route.sourcePath}</small>
    </div>)}
  </section>
}

export default function PlatformMapCanvas() {
  const containerRef = useRef(null)
  const [selected, setSelected] = useState(null)
  const [focusId, setFocusId] = useState('ritsuflow')

  useEffect(() => {
    if (!containerRef.current) return
    let dispose
    let cancelled = false
    const onSelect = (node) => {
      setSelected(node)
      if (node.id === 'ritsuflow') setFocusId('ritsuflow')
      else if (node.type === 'workspace' || node.type === 'module') setFocusId(node.id)
    }
    createPlatformMapEditor(containerRef.current, { onSelect, focusId }).then((cleanup) => {
      if (cancelled) cleanup?.()
      else dispose = cleanup
    })
    return () => { cancelled = true; dispose?.() }
  }, [focusId])

  const focus = getPlatformMapNode(focusId)
  const workspace = focus?.type === 'module' ? getPlatformMapNode(focus.workspace) : focus?.type === 'workspace' ? focus : null

  const selectedParent = selected?.type === 'detail' ? getPlatformMapNode(selected.parent) : null

  const navigateToNode = (node) => { setFocusId(node.id); setSelected(node) }

  const goRoot = () => { setFocusId('ritsuflow'); setSelected(null) }
  const goWorkspace = () => { if (workspace) { setFocusId(workspace.id); setSelected(workspace) } }

  return <div className="pmShell">
    <div className="pmMapNav">
      <button className={focusId === 'ritsuflow' ? 'active' : ''} onClick={goRoot}>RitsuFlow</button>
      {workspace && <><span>›</span><button className={focus?.type === 'workspace' ? 'active' : ''} onClick={goWorkspace}>{workspace.label}</button></>}
      {focus?.type === 'module' && <><span>›</span><button className="active">{focus.label}</button></>}
      <small>{focusId === 'ritsuflow' ? 'Select a workspace to explore its modules' : focus?.type === 'workspace' ? 'Select a module to inspect how it works' : 'Module architecture: inputs, process, outputs, pages and data'}</small>
    </div>
    <div ref={containerRef} className="pmReteCanvas" />
    {selected && <aside className="pmInspector">
      <div className="pmInspectorHeader"><div><span className="pmType">{selected.type}</span><h2>{selected.label}</h2><p>{selected.subtitle}</p></div><button onClick={() => setSelected(null)} aria-label="Close inspector">×</button></div>
      <div className="pmInspectorBody">
        {selected.type === 'detail' ? <>
          <section className="pmPurpose"><h4>Module</h4><p>{selectedParent?.label || focus?.label}</p></section>
          <List title={selected.label} items={selected.items} />
          {selected.detailType === 'pages' && <ApplicationPages module={selectedParent} />}
        </> : <>
        <section className="pmPurpose"><h4>Purpose</h4><p>{selected.purpose || selected.subtitle}</p></section>
        {(selected.inputs?.length || selected.process?.length || selected.outputs?.length) && <div className="pmFlowGrid"><List title="Inputs" items={selected.inputs} /><List title="Process" items={selected.process} /><List title="Outputs" items={selected.outputs} /></div>}
        <ApplicationPages module={selected} />
        <RelatedModules items={selected.related} onNavigate={navigateToNode} /><List title="Data Layer" items={selected.data} /><List title="Key Pages" items={selected.pages} />
        </>}
      </div>
    </aside>}
  </div>
}
