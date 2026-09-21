'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export default function RitsuCadRibbonBridge() {
  const [fileSection, setFileSection] = useState(null)

  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const initialize = () => {
      if (cancelled) return
      attempts += 1

      const toolbar = document.querySelector('[class*="cadToolbar"]')
      const firstSection = toolbar?.querySelector('[class*="toolbarSection"]') || null
      if (firstSection) setFileSection(firstSection)

      // page.js currently initializes the inspector as open. Close only the
      // initial instance; after that the user's ribbon actions own panel state.
      const inspector = document.querySelector('[class*="_inspector__"]')
      if (inspector) {
        const buttons = Array.from(inspector.querySelectorAll('button'))
        const close = buttons.find((button) => {
          const title = (button.getAttribute('title') || '').toLowerCase()
          const label = (button.getAttribute('aria-label') || '').toLowerCase()
          const text = (button.textContent || '').trim().toLowerCase()
          return title.includes('close') || label.includes('close') || text === '×'
        })
        close?.click()
      }

      if (!firstSection && attempts < 80) {
        window.setTimeout(initialize, 50)
      }
    }

    initialize()
    return () => { cancelled = true }
  }, [])

  if (!fileSection) return null

  return createPortal(
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('ritsucad:open-project-drawing'))}
      title="Open a PDF drawing stored in a RitsuFlow project"
      style={{
        height: 40,
        minHeight: 40,
        minWidth: 86,
        padding: '0 10px',
        border: '1px solid #b9cbd5',
        borderRadius: 6,
        background: '#ffffff',
        color: '#173e52',
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
      <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1 }}>▣</span>
      <span>Project Drawing</span>
    </button>,
    fileSection
  )
}
