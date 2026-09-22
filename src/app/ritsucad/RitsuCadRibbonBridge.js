'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { createSmartTakeoffMetadata, getSmartTakeoffGroups } from './smartTakeoff'

export default function RitsuCadRibbonBridge() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [fileSection, setFileSection] = useState(null)
  const [header, setHeader] = useState(null)
  const [toolbar, setToolbar] = useState(null)
  const [activeSmartTakeoff, setActiveSmartTakeoff] = useState(null)
  const [openGroup, setOpenGroup] = useState(null)
  const smartMenuRef = useRef(null)

  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const viewId = searchParams.get('viewId')
  const mappingMode = searchParams.get('mode') === 'location-mapping'
  const hasProjectDrawing = Boolean(projectId && documentId)
  const smartGroups = getSmartTakeoffGroups()

  useEffect(() => {
    let cancelled = false
    let observer = null
    const sync = () => {
      if (cancelled) return
      const t = document.querySelector('[class*="cadToolbar"]')
      const f = t?.querySelector('[class*="toolbarSection"]') || null
      const h = document.querySelector('[class*="applicationHeader"]')
      setToolbar((current) => (current === t ? current : t))
      setFileSection((current) => (current === f ? current : f))
      setHeader((current) => (current === h ? current : h))
    }
    sync()
    observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => { cancelled = true; observer?.disconnect() }
  }, [pathname])

  useEffect(() => {
    const close = (event) => {
      if (smartMenuRef.current && !smartMenuRef.current.contains(event.target)) setOpenGroup(null)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  useEffect(() => {
    let cancelled = false
    let attempts = 0
    let closed = false
    const run = () => {
      if (cancelled || closed) return
      attempts += 1
      const inspector = document.querySelector('[class*="_inspector__"]')
      if (inspector) {
        const close = Array.from(inspector.querySelectorAll('button')).find((button) => {
          const title = (button.getAttribute('title') || '').toLowerCase()
          const label = (button.getAttribute('aria-label') || '').toLowerCase()
          const text = (button.textContent || '').trim().toLowerCase()
          return title.includes('close') || label.includes('close') || text === '×'
        })
        if (close) { close.click(); closed = true; return }
      }
      if (attempts < 120) window.setTimeout(run, 50)
    }
    run()
    return () => { cancelled = true }
  }, [pathname, documentId])

  useEffect(() => {
    return () => {
      delete window.__RITSUCAD_ACTIVE_SMART_TAKEOFF__
    }
  }, [])

  function openLocationMapping() {
    if (!hasProjectDrawing) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('mode', 'location-mapping')
    window.dispatchEvent(new Event('ritsucad:close-takeoff-context'))
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function openTakeoffContext() {
    if (!hasProjectDrawing) return
    const params = new URLSearchParams(searchParams.toString())
    params.delete('mode')
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    window.setTimeout(() => window.dispatchEvent(new Event('ritsucad:open-takeoff-context')), 0)
  }

  function activateSmartTakeoff(item) {
    if (!hasProjectDrawing) return

    const metadata = createSmartTakeoffMetadata(item.id)
    window.__RITSUCAD_ACTIVE_SMART_TAKEOFF__ = metadata

    setActiveSmartTakeoff(item.id)
    setOpenGroup(null)

    window.dispatchEvent(new CustomEvent('ritsucad:smart-takeoff-selected', {
      detail: { ...item, metadata },
    }))

    const shortcutByTool = { line: 'l', polyline: 'p', area: 'a', rectangle: 'r', count: 'c' }
    const key = shortcutByTool[item.measurementTool]
    if (key) document.dispatchEvent(new KeyboardEvent('keydown', { key, code: `Key${key.toUpperCase()}`, bubbles: true }))
  }

  function clickNativeFileAction(match) {
    if (!fileSection) return
    const button = Array.from(fileSection.querySelectorAll('button')).find((candidate) => {
      const haystack = `${candidate.textContent || ''} ${candidate.title || ''} ${candidate.getAttribute('aria-label') || ''}`.toLowerCase()
      return match(haystack)
    })
    button?.click()
  }

  const headerFileActions = header
    ? createPortal(
        <div data-ritsucad-header-file-actions="true">
          <span className="ritsucad-header-file-label">FILE</span>
          <button type="button" onClick={() => clickNativeFileAction((text) => text.includes('import pdf'))} title="Import PDF">
            <span aria-hidden="true">↓</span><span>Import PDF</span>
          </button>
          <button type="button" onClick={() => clickNativeFileAction((text) => text.includes('drawing'))} title="Open drawings">
            <span aria-hidden="true">▤</span><span>Drawings</span>
          </button>
          {!hasProjectDrawing ? <button type="button" onClick={() => window.dispatchEvent(new Event('ritsucad:open-project-drawing'))} title="Open a PDF drawing stored in a RitsuFlow project"><span aria-hidden="true">▣</span><span>Project Drawing</span></button> : null}
        </div>, header)
    : null

  const smartTakeoffSection = toolbar
    ? createPortal(
        <div ref={smartMenuRef} data-ritsucad-smart-takeoff="true" style={{ order: 8, position: 'relative', flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: 3, padding: '15px 7px 1px 12px', marginLeft: 5, borderLeft: '1px solid #d5e0e8' }}>
          <span style={{ position: 'absolute', top: 2, left: 12, color: '#496579', fontSize: 8, lineHeight: 1, fontWeight: 900, letterSpacing: '.07em', whiteSpace: 'nowrap' }}>SMART TAKEOFF</span>
          {smartGroups.map((group) => {
            const selected = group.items.find((item) => item.id === activeSmartTakeoff)
            return (
              <div key={group.name} style={{ position: 'relative' }}>
                <CategoryButton label={group.name === 'Architectural' ? 'Architecture' : group.name} icon={groupIcon(group.name)} disabled={!hasProjectDrawing} active={Boolean(selected)} onClick={() => hasProjectDrawing && setOpenGroup((current) => current === group.name ? null : group.name)} />
                {openGroup === group.name && hasProjectDrawing ? (
                  <div style={{ position: 'absolute', zIndex: 1000, top: 45, left: 0, minWidth: 170, padding: 5, border: '1px solid #bfd0da', borderRadius: 7, background: '#fff', boxShadow: '0 8px 24px rgba(15,54,75,.18)' }}>
                    {group.items.map((item) => (
                      <button key={item.id} type="button" onClick={() => activateSmartTakeoff(item)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', border: 0, borderRadius: 5, background: activeSmartTakeoff === item.id ? '#e8faf8' : '#fff', color: activeSmartTakeoff === item.id ? '#007f79' : '#173e52', font: 'inherit', fontSize: 11, fontWeight: 800, textAlign: 'left', cursor: 'pointer' }}>
                        <span style={{ width: 18, textAlign: 'center', fontSize: 14 }}>{smartIcon(item.id)}</span><span style={{ flex: 1 }}>{item.label}</span><span style={{ color: '#78909c', fontSize: 9 }}>{item.measurementTool}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>, toolbar)
    : null

  const projectDataSection = toolbar && hasProjectDrawing
    ? createPortal(
        <div data-ritsucad-project-data="true" style={{ order: 10, position: 'relative', flex: '0 0 auto', display: 'flex', alignItems: 'flex-end', gap: 2, padding: '15px 5px 1px 12px', marginLeft: 5, borderLeft: '1px solid #d5e0e8' }}>
          <span style={{ position: 'absolute', top: 2, left: 12, color: '#496579', fontSize: 8, lineHeight: 1, fontWeight: 900, letterSpacing: '.07em', whiteSpace: 'nowrap' }}>PROJECT DATA</span>
          <RibbonButton icon="▤" label="Views" onClick={() => window.dispatchEvent(new Event('ritsucad:open-drawing-views-command'))} title="Open saved drawing views" />
          <RibbonButton icon="✓" label={viewId ? 'Save View' : 'Save As'} onClick={() => window.dispatchEvent(new Event('ritsucad:save-drawing-view'))} title={viewId ? 'Save the current drawing view' : 'Save the current geometry as a drawing view'} />
          <RibbonButton icon="⌖" label="Locations" active={mappingMode} onClick={openLocationMapping} title="Map existing LBS locations on this drawing" />
          <RibbonButton icon="▦" label="Takeoff" onClick={openTakeoffContext} title="Open project takeoff context" />
        </div>, toolbar)
    : null

  return <>{headerFileActions}{smartTakeoffSection}{projectDataSection}</>
}

function groupIcon(group) { return { Architectural: '⌂', Structural: '▰', MEP: '⌁', Geometry: '△' }[group] || '•' }
function smartIcon(type) { const icons = { wall: '▥', floor: '▱', ceiling: '⌂', door: '◧', window: '⊞', baseboard: '━', painting: '▨', slab: '▰', beam: '▬', column: '▮', footing: '▣', pipe: '⌁', duct: '▭', fixture: '⊕', equipment: '⚙', 'generic-linear': '╱', 'generic-area': '△', 'generic-count': '#' }; return icons[type] || '•' }

function CategoryButton({ icon, label, onClick, disabled, active }) {
  return <button type="button" disabled={disabled} onClick={onClick} title={disabled ? 'Open a project drawing to use Smart Takeoff' : `${label} Smart Takeoff`} style={{ height: 42, minWidth: 74, padding: '3px 7px', border: active ? '1px solid #73d1cc' : '1px solid #b9cbd5', borderRadius: 6, background: active ? '#e8faf8' : '#fff', color: disabled ? '#b9c4ca' : active ? '#007f79' : '#173e52', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, font: 'inherit', fontSize: 7, lineHeight: 1.05, fontWeight: 800, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? .58 : 1, whiteSpace: 'nowrap' }}><span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span><span>{label} ▾</span></button>
}

function RibbonButton({ icon, label, onClick, title, active = false, wide = false }) {
  return <button type="button" onClick={onClick} title={title} style={{ height: 42, minHeight: 42, minWidth: wide ? 86 : 52, padding: '3px 6px', border: active ? '1px solid #73d1cc' : '1px solid #b9cbd5', borderRadius: 6, background: active ? '#e8faf8' : '#fff', color: active ? '#007f79' : '#173e52', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, font: 'inherit', fontSize: 7, lineHeight: 1.05, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}><span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span><span>{label}</span></button>
}
