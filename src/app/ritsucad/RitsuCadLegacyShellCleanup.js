'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import RitsuCadProjectPanel from './RitsuCadProjectPanel'

export default function RitsuCadLegacyShellCleanup() {
  const searchParams = useSearchParams()
  const hasProjectContext = Boolean(searchParams.get('projectId'))
  const [homeGroup, setHomeGroup] = useState(null)

  useEffect(() => {
    let frame = 0
    const sync = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const ribbon = document.querySelector('[data-ritsucad-desktop-ribbon="true"]')
        const activeTab = ribbon?.querySelector('.rfRibbonTabList button.active')
        const firstGroup = ribbon?.querySelector('.rfRibbonGroups .rfCommandGroup:first-child .rfCommandItems')
        const target = activeTab?.textContent?.trim() === 'Home' ? firstGroup : null
        setHomeGroup((current) => current === target && current?.isConnected ? current : target)
      })
    }

    sync()
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [])

  return (
    <>
      <style>{`
        /* RitsuCAD desktop shell: the legacy left toolbar/sidebar is retired.
           Keep the native toolbar in the DOM because bridge components reuse its
           actions, but never allow it to participate in desktop layout. */
        [data-ritsucad-approved-shell="true"],
        [class*="cadToolbar"] {
          display: none !important;
          width: 0 !important;
          min-width: 0 !important;
          max-width: 0 !important;
          height: 0 !important;
          min-height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: 0 !important;
          overflow: hidden !important;
        }

        [class*="application"]:has([data-ritsucad-approved-shell="true"]) {
          grid-template-columns: minmax(0, 1fr) !important;
        }

        [class*="application"]:has([data-ritsucad-approved-shell="true"]) > [class*="applicationHeader"] {
          grid-column: 1 !important;
        }

        [class*="application"]:has([data-ritsucad-approved-shell="true"]) > [class*="cadArea"] {
          grid-column: 1 !important;
          width: 100% !important;
          min-width: 0 !important;
        }

        .rfOpenProjectCommand {
          min-width: 72px;
          height: 70px;
          padding: 5px 8px;
          border: 0;
          background: transparent;
          color: #173f52;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          font: inherit;
          cursor: pointer;
        }
        .rfOpenProjectCommand:hover { background: #dcebed; }
        .rfOpenProjectCommand > span { height: 28px; font-size: 24px; line-height: 28px; color: #075f78; }
        .rfOpenProjectCommand > strong { font-size: 9px; font-weight: 850; white-space: nowrap; }
      `}</style>

      <RitsuCadProjectPanel />

      {!hasProjectContext && homeGroup ? createPortal(
        <button
          type="button"
          className="rfOpenProjectCommand"
          title="Open a RitsuFlow project drawing"
          onClick={() => window.dispatchEvent(new Event('ritsucad:open-project-drawing'))}
        >
          <span>▣</span>
          <strong>Open Project</strong>
        </button>,
        homeGroup
      ) : null}
    </>
  )
}
