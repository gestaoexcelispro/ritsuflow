'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getSmartTakeoffGroups } from './smartTakeoff'

export default function RitsuCadRibbonBridge() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [fileSection, setFileSection] = useState(null)
  const [toolbar, setToolbar] = useState(null)
  const [activeSmartTakeoff, setActiveSmartTakeoff] = useState(null)

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
      setToolbar((current) => (current === t ? current : t))
      setFileSection((current) => (current === f ? current : f))
    }

    sync()
    observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      cancelled = true
      observer?.disconnect()
    }
  }, [pathname])

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
        if (close) {
          close.click()
          closed = true
          return
        }
      }
      if (attempts < 120) window.setTimeout(run, 50)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [pathname, documentId])

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
    setActiveSmartTakeoff(item.id)

    // Native CAD listens to the same keyboard shortcuts already used by
    // Linear/Polyline/Area/Count. This keeps Smart Takeoff above, rather
    // than inside, the geometry engine.
    const shortcutByTool = {
      line: 'l',
      polyline: 'p',
      area: 'a',
      rectangle: 'r',
      count: 'c',
    }

    window.dispatchEvent(
      new CustomEvent('ritsucad:smart-takeoff-selected', {
        detail: item,
      })
    )

    const key = shortcutByTool[item.measurementTool]
    if (key) {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key,
          code: `Key${key.toUpperCase()}`,
          bubbles: true,
        })
      )
    }
  }

  const smartTakeoffSection = toolbar && hasProjectDrawing
    ? createPortal(
        <div
          data-ritsucad-smart-takeoff="true"
          style={{
            position: 'relative',
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 7,
            padding: '15px 7px 1px 12px',
            marginLeft: 5,
            borderLeft: '1px solid #d5e0e8',
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 2,
              left: 12,
              color: '#496579',
              fontSize: 8,
              lineHeight: 1,
              fontWeight: 900,
              letterSpacing: '.07em',
              whiteSpace: 'nowrap',
            }}
          >
            SMART TAKEOFF
          </span>

          {smartGroups.map((group) => (
            <div key={group.name} style={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
              {group.items.map((item) => (
                <RibbonButton
                  key={item.id}
                  icon={smartIcon(item.id)}
                  label={item.label}
                  active={activeSmartTakeoff === item.id}
                  onClick={() => activateSmartTakeoff(item)}
                  title={`${group.name} · ${item.label} · ${item.measurementTool}`}
                />
              ))}
            </div>
          ))}
        </div>,
        toolbar
      )
    : null

  const projectDataSection = toolbar && hasProjectDrawing
    ? createPortal(
        <div
          data-ritsucad-project-data="true"
          style={{
            position: 'relative',
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            padding: '15px 5px 1px 12px',
            marginLeft: 5,
            borderLeft: '1px solid #d5e0e8',
          }}
        >
          <span style={{ position: 'absolute', top: 2, left: 12, color: '#496579', fontSize: 8, lineHeight: 1, fontWeight: 900, letterSpacing: '.07em', whiteSpace: 'nowrap' }}>
            PROJECT DATA
          </span>
          <RibbonButton icon="▤" label="Views" onClick={() => window.dispatchEvent(new Event('ritsucad:open-drawing-views-command'))} title="Open saved drawing views" />
          <RibbonButton icon="✓" label={viewId ? 'Save View' : 'Save As'} onClick={() => window.dispatchEvent(new Event('ritsucad:save-drawing-view'))} title={viewId ? 'Save the current drawing view' : 'Save the current geometry as a drawing view'} />
          <RibbonButton icon="⌖" label="Locations" active={mappingMode} onClick={openLocationMapping} title="Map existing LBS locations on this drawing" />
          <RibbonButton icon="▦" label="Takeoff" onClick={openTakeoffContext} title="Open project takeoff context" />
        </div>,
        toolbar
      )
    : null

  const projectDrawingButton = fileSection && !hasProjectDrawing
    ? createPortal(
        <RibbonButton icon="▣" label="Project Drawing" onClick={() => window.dispatchEvent(new Event('ritsucad:open-project-drawing'))} title="Open a PDF drawing stored in a RitsuFlow project" wide />,
        fileSection
      )
    : null

  return <>{projectDrawingButton}{smartTakeoffSection}{projectDataSection}</>
}

function smartIcon(type) {
  const icons = {
    wall: '▥', floor: '▱', ceiling: '⌂', door: '◧', window: '⊞', baseboard: '━', painting: '▨',
    slab: '▰', beam: '▬', column: '▮', footing: '▣', pipe: '⌁', duct: '▭', fixture: '⊕', equipment: '⚙',
    'generic-linear': '╱', 'generic-area': '△', 'generic-count': '#',
  }
  return icons[type] || '•'
}

function RibbonButton({ icon, label, onClick, title, active = false, wide = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        height: 42,
        minHeight: 42,
        minWidth: wide ? 86 : 52,
        padding: '3px 6px',
        border: active ? '1px solid #73d1cc' : '1px solid #b9cbd5',
        borderRadius: 6,
        background: active ? '#e8faf8' : '#fff',
        color: active ? '#007f79' : '#173e52',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        font: 'inherit',
        fontSize: 7,
        lineHeight: 1.05,
        fontWeight: 800,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>{icon}</span>
      <span>{label}</span>
    </button>
  )
}
