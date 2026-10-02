'use client'

import { useEffect, useRef, useState } from 'react'
import { createPlatformMapEditor } from './createPlatformMapEditor'
import { getPlatformMapNode } from './platformMapData'

function List({ title, items }) {
  if (!items?.length) return null
  return <section className="pmInspectorSection"><h4>{title}</h4>{items.map((item) => <div className="pmInspectorItem" key={item}>{item}</div>)}</section>
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
      else if (node.type === 'workspace') setFocusId(node.id)
    }
    createPlatformMapEditor(containerRef.current, { onSelect, focusId }).then((cleanup) => {
      if (cancelled) cleanup?.()
      else dispose = cleanup
    })
    return () => { cancelled = true; dispose?.() }
  }, [focusId])

  const focus = getPlatformMapNode(focusId)

  return <div className="pmShell">
    <div className="pmMapNav">
      <button className={focusId === 'ritsuflow' ? 'active' : ''} onClick={() => { setFocusId('ritsuflow'); setSelected(null) }}>RitsuFlow</button>
      {focusId !== 'ritsuflow' && <><span>›</span><button className="active">{focus?.label}</button></>}
      <small>{focusId === 'ritsuflow' ? 'Select a workspace to explore its modules' : 'Select a module to inspect how it works'}</small>
    </div>
    <div ref={containerRef} className="pmReteCanvas" />
    {selected && <aside className="pmInspector">
      <div className="pmInspectorHeader"><div><span className="pmType">{selected.type}</span><h2>{selected.label}</h2><p>{selected.subtitle}</p></div><button onClick={() => setSelected(null)} aria-label="Close inspector">×</button></div>
      <div className="pmInspectorBody">
        <section className="pmPurpose"><h4>Purpose</h4><p>{selected.purpose || selected.subtitle}</p></section>
        {(selected.inputs?.length || selected.process?.length || selected.outputs?.length) && <div className="pmFlowGrid"><List title="Inputs" items={selected.inputs} /><List title="Process" items={selected.process} /><List title="Outputs" items={selected.outputs} /></div>}
        <List title="Related Modules" items={selected.related} /><List title="Data Layer" items={selected.data} /><List title="Key Pages" items={selected.pages} />
      </div>
    </aside>}
  </div>
}
