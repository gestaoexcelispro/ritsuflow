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
           RITSUCAD WORKSPACE UI v2
           Canvas first. Controls are compact and contextual.
        ===================================================== */

        [class*="backButton"] {
          display: none !important;
        }

        [class*="headerLeft"] {
          padding-left: 218px !important;
        }

        [class*="applicationHeader"] {
          height: 48px !important;
          min-height: 48px !important;
        }

        /* =====================================================
           FEATURE-GROUPED RIBBON
        ===================================================== */

        [class*="cadToolbar"] {
          height: 76px !important;
          min-height: 76px !important;
          padding: 5px 10px 4px !important;
          align-items: stretch !important;
          background: #fbfcfd !important;
          border-bottom: 1px solid #cfdbe4 !important;
        }

        [class*="toolbarSection"] {
          position: relative !important;
          align-items: flex-end !important;
          padding: 17px 5px 1px !important;
          gap: 2px !important;
        }

        [class*="toolbarSection"]::before {
          position: absolute;
          top: 1px;
          left: 7px;
          color: #48657d;
          font-size: 9px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .035em;
          white-space: nowrap;
        }

        [class*="toolbarSection"]:nth-of-type(1)::before {
          content: 'FILE';
        }

        [class*="toolbarSection"]:nth-of-type(2)::before {
          content: 'NAVIGATE';
        }

        [class*="toolbarSection"]:nth-of-type(3)::before {
          content: 'DRAW';
        }

        [class*="toolbarSection"]:nth-of-type(4)::before {
          content: 'MEASURE / TAKEOFF';
        }

        [class*="toolbarSection"]:nth-of-type(5)::before {
          content: 'SETUP / HISTORY';
        }

        [class*="toolbarDivider"] {
          height: 52px !important;
          margin: 12px 7px 2px !important;
          background: #d5e0e8 !important;
        }

        [class*="toolbarButton"] {
          height: 48px !important;
        }

        [class*="toolbarButtonWide"] {
          height: 48px !important;
        }

        [class*="toolbarIconButton"] {
          height: 48px !important;
        }

        [class*="importButton"] {
          height: 48px !important;
        }

        /* =====================================================
           MAXIMIZED CAD + CONTEXTUAL INSPECTOR
           Important: target the actual CSS-module class only,
           not inspectorHeader/inspectorBody descendants.
        ===================================================== */

        [class*="cadArea"] {
          position: relative !important;
        }

        [class*="_inspector__"] {
          position: absolute !important;
          z-index: 64 !important;
          top: 8px !important;
          right: 60px !important;
          bottom: 8px !important;
          width: 310px !important;
          min-width: 310px !important;
          max-width: 310px !important;
          border: 1px solid #cbd7e1 !important;
          border-radius: 10px !important;
          background: #ffffff !important;
          box-shadow: -8px 8px 28px rgba(15, 23, 42, 0.16) !important;
          overflow: hidden !important;
        }

        [class*="_toolRail__"] {
          flex: 0 0 52px !important;
          width: 52px !important;
          min-width: 52px !important;
          z-index: 66 !important;
        }

        [class*="viewport"] {
          min-width: 0 !important;
          width: auto !important;
        }

        /* Welcome card remains centered in the usable CAD surface. */
        [class*="emptyViewport"] {
          max-width: 430px !important;
        }

        @media (max-width: 1250px) {
          [class*="cadToolbar"] {
            overflow-x: auto !important;
          }

          [class*="headerLeft"] {
            padding-left: 205px !important;
          }
        }

        @media (max-width: 1100px) {
          [class*="headerLeft"] {
            padding-left: 195px !important;
          }

          [class*="_inspector__"] {
            right: 56px !important;
            width: 292px !important;
            min-width: 292px !important;
            max-width: 292px !important;
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
