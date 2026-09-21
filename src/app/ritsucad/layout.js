import { Suspense } from 'react'
import LocationMappingPanel from './LocationMappingPanel'
import TakeoffContextPanel from './TakeoffContextPanel'
import TakeoffPersistenceBridge from './TakeoffPersistenceBridge'
import RitsuCadProjectLauncher from './RitsuCadProjectLauncher'
import ReturnToWorkspaceButton from './ReturnToWorkspaceButton'

export const metadata = {
  title: 'RitsuCAD™ | RitsuFlow',
  description:
    'RitsuFlow construction CAD, drawing markup, measurement, takeoff, and project location mapping workspace.',
}

export default function RitsuCadLayout({ children }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        minWidth: 0,
        minHeight: 0,
        margin: 0,
        overflow: 'hidden',
        background: '#dfe6ec',
      }}
    >
      <style>{`
        /* =====================================================
           RITSUCAD WORKSPACE UI v3
           Compact CAD chrome. Drawing surface gets priority.
        ===================================================== */

        [class*="backButton"] { display: none !important; }

        [class*="headerLeft"] {
          padding-left: 218px !important;
        }

        [class*="applicationHeader"] {
          height: 48px !important;
          min-height: 48px !important;
        }

        /* =====================================================
           COMPACT FEATURE RIBBON
           Existing CAD commands are preserved. We only reshape
           their presentation so the ribbon behaves like CAD UI.
        ===================================================== */

        [class*="cadToolbar"] {
          height: 62px !important;
          min-height: 62px !important;
          padding: 3px 8px 2px !important;
          align-items: stretch !important;
          background: #fbfcfd !important;
          border-bottom: 1px solid #cfdbe4 !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scrollbar-width: thin;
        }

        [class*="toolbarSection"] {
          position: relative !important;
          flex: 0 0 auto !important;
          align-items: flex-end !important;
          padding: 13px 4px 1px !important;
          gap: 1px !important;
        }

        [class*="toolbarSection"]::before {
          position: absolute;
          top: 1px;
          left: 6px;
          color: #5c7488;
          font-size: 8px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .06em;
          white-space: nowrap;
        }

        [class*="toolbarSection"]:nth-of-type(1)::before { content: 'FILE'; }
        [class*="toolbarSection"]:nth-of-type(2)::before { content: 'VIEW'; }
        [class*="toolbarSection"]:nth-of-type(3)::before { content: 'DRAW'; }
        [class*="toolbarSection"]:nth-of-type(4)::before { content: 'MEASURE · TAKEOFF'; }
        [class*="toolbarSection"]:nth-of-type(5)::before { content: 'EDIT · SETUP'; }

        [class*="toolbarDivider"] {
          height: 39px !important;
          margin: 14px 5px 1px !important;
          background: #d5e0e8 !important;
        }

        [class*="toolbarButton"],
        [class*="toolbarButtonWide"],
        [class*="toolbarIconButton"],
        [class*="importButton"] {
          height: 40px !important;
          min-height: 40px !important;
        }

        [class*="toolbarButton"],
        [class*="toolbarIconButton"] {
          min-width: 48px !important;
          padding-left: 6px !important;
          padding-right: 6px !important;
        }

        [class*="toolbarButtonWide"],
        [class*="importButton"] {
          padding-left: 10px !important;
          padding-right: 10px !important;
        }

        /* Disabled tools remain available but recede visually. */
        [class*="cadToolbar"] button:disabled {
          opacity: .32 !important;
          filter: saturate(.45) !important;
        }

        /* =====================================================
           CANVAS-FIRST WORKSPACE
        ===================================================== */

        [class*="cadArea"] {
          position: relative !important;
          min-width: 0 !important;
        }

        [class*="viewport"] {
          min-width: 0 !important;
          width: auto !important;
        }

        /* Inspector becomes a smaller floating palette instead of
           permanently stealing a large portion of the CAD surface. */
        [class*="_inspector__"] {
          position: absolute !important;
          z-index: 64 !important;
          top: 8px !important;
          right: 58px !important;
          bottom: auto !important;
          width: 292px !important;
          min-width: 292px !important;
          max-width: 292px !important;
          max-height: calc(100% - 16px) !important;
          border: 1px solid #cbd7e1 !important;
          border-radius: 9px !important;
          background: #ffffff !important;
          box-shadow: -5px 7px 22px rgba(15, 23, 42, 0.14) !important;
          overflow: hidden !important;
        }

        [class*="_inspectorBody__"] {
          max-height: calc(100vh - 190px) !important;
          overflow-y: auto !important;
        }

        [class*="_toolRail__"] {
          flex: 0 0 50px !important;
          width: 50px !important;
          min-width: 50px !important;
          z-index: 66 !important;
        }

        /* =====================================================
           EMPTY DRAWING STATE
           Keep it compact and stop external project launcher from
           visually colliding with the native Import PDF action.
        ===================================================== */

        [class*="emptyViewport"] {
          width: 390px !important;
          max-width: calc(100% - 48px) !important;
          min-height: 0 !important;
          padding: 28px 30px 30px !important;
          overflow: visible !important;
        }

        [class*="emptyViewport"] h2,
        [class*="emptyViewport"] h3 {
          margin-top: 12px !important;
          margin-bottom: 8px !important;
        }

        /* RitsuCadProjectLauncher is mounted after the CAD page and uses
           a fixed/absolute CTA. Give the native empty card extra breathing
           room so all three entry paths read as separate actions. */
        [class*="emptyViewport"] [class*="emptyActions"] {
          gap: 10px !important;
          padding-bottom: 26px !important;
        }

        @media (max-width: 1250px) {
          [class*="headerLeft"] { padding-left: 205px !important; }
        }

        @media (max-width: 1100px) {
          [class*="headerLeft"] { padding-left: 195px !important; }

          [class*="_inspector__"] {
            right: 54px !important;
            width: 276px !important;
            min-width: 276px !important;
            max-width: 276px !important;
          }
        }
      `}</style>

      <Suspense fallback={null}>
        <ReturnToWorkspaceButton />
      </Suspense>

      {children}

      <Suspense fallback={null}>
        <RitsuCadProjectLauncher />
        <LocationMappingPanel />
        <TakeoffContextPanel />
        <TakeoffPersistenceBridge />
      </Suspense>
    </div>
  )
}
