import { Suspense } from 'react'
import LocationMappingPanel from './LocationMappingPanel'
import TakeoffContextPanel from './TakeoffContextPanel'
import TakeoffPersistenceBridge from './TakeoffPersistenceBridge'
import RitsuCadProjectLauncher from './RitsuCadProjectLauncher'
import ReturnToWorkspaceButton from './ReturnToWorkspaceButton'

export const metadata = {
  title: 'RitsuCAD™ | RitsuFlow',
  description: 'RitsuFlow construction CAD, drawing markup, measurement, takeoff, and project location mapping workspace.',
}

export default function RitsuCadLayout({ children }) {
  return (
    <div style={{ width: '100%', height: '100vh', minWidth: 0, minHeight: 0, margin: 0, overflow: 'hidden', background: '#dfe6ec' }}>
      <style>{`
        /* RITSUCAD WORKSPACE UI v4 — one ribbon, clean canvas */
        [class*="backButton"] { display: none !important; }
        [class*="headerLeft"] { padding-left: 218px !important; }
        [class*="applicationHeader"] { height: 48px !important; min-height: 48px !important; }

        /* MAIN RIBBON */
        [class*="cadToolbar"] {
          height: 62px !important;
          min-height: 62px !important;
          padding: 3px 292px 2px 6px !important;
          align-items: stretch !important;
          background: #fbfcfd !important;
          border-bottom: 1px solid #cfdbe4 !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          scrollbar-width: none !important;
        }
        [class*="cadToolbar"]::-webkit-scrollbar { display: none !important; }
        [class*="toolbarSection"] {
          position: relative !important;
          flex: 0 0 auto !important;
          align-items: flex-end !important;
          padding: 13px 2px 1px !important;
          gap: 0 !important;
        }
        [class*="toolbarSection"]::before {
          position: absolute; top: 1px; left: 5px;
          color: #5c7488; font-size: 8px; line-height: 1;
          font-weight: 900; letter-spacing: .06em; white-space: nowrap;
        }
        [class*="toolbarSection"]:nth-of-type(1)::before { content: 'FILE'; }
        [class*="toolbarSection"]:nth-of-type(2)::before { content: 'VIEW'; }
        [class*="toolbarSection"]:nth-of-type(3)::before { content: 'DRAW'; }
        [class*="toolbarSection"]:nth-of-type(4)::before { content: 'MEASURE · TAKEOFF'; }
        [class*="toolbarSection"]:nth-of-type(5)::before { content: 'EDIT · SETUP'; }
        [class*="toolbarDivider"] {
          height: 38px !important; margin: 14px 3px 1px !important;
          background: #d5e0e8 !important;
        }
        [class*="toolbarButton"], [class*="toolbarButtonWide"],
        [class*="toolbarIconButton"], [class*="importButton"] {
          height: 40px !important; min-height: 40px !important;
        }
        [class*="toolbarButton"] {
          min-width: 42px !important; padding-left: 3px !important; padding-right: 3px !important;
        }
        [class*="toolbarButton"] span { font-size: 7px !important; }
        [class*="toolbarIconButton"] { width: 32px !important; min-width: 32px !important; padding: 0 !important; }
        [class*="toolbarButtonWide"] { min-width: 72px !important; padding: 0 6px !important; }
        [class*="importButton"] { padding-left: 9px !important; padding-right: 9px !important; }
        [class*="cadToolbar"] button:disabled { opacity: .30 !important; filter: saturate(.4) !important; }

        /* MOVE THE EXISTING RIGHT RAIL INTO THE RIBBON.
           No duplicated controls: these are the same functional buttons. */
        [class*="_toolRail__"] {
          position: fixed !important;
          z-index: 76 !important;
          top: 61px !important;
          right: 8px !important;
          bottom: auto !important;
          left: auto !important;
          display: flex !important;
          flex-direction: row !important;
          align-items: flex-end !important;
          width: auto !important;
          min-width: 0 !important;
          height: 45px !important;
          min-height: 45px !important;
          padding: 0 !important;
          gap: 1px !important;
          border: 0 !important;
          background: transparent !important;
          box-shadow: none !important;
        }
        [class*="_toolRail__"]::before {
          content: 'PANELS · AIDS';
          position: absolute;
          top: -10px;
          left: 4px;
          color: #5c7488;
          font-size: 8px;
          line-height: 1;
          font-weight: 900;
          letter-spacing: .06em;
          white-space: nowrap;
        }
        [class*="railButton"] {
          width: 39px !important;
          min-width: 39px !important;
          height: 40px !important;
          min-height: 40px !important;
          padding: 2px !important;
          border-radius: 6px !important;
        }
        [class*="railButton"] span { max-width: 37px !important; font-size: 6.5px !important; }

        /* CANVAS */
        [class*="cadArea"] { position: relative !important; min-width: 0 !important; }
        [class*="viewport"] { min-width: 0 !important; width: 100% !important; }

        /* Floating panels appear only when requested; they no longer reserve canvas width. */
        [class*="_inspector__"] {
          position: absolute !important;
          z-index: 64 !important;
          top: 8px !important;
          right: 8px !important;
          bottom: auto !important;
          width: 292px !important;
          min-width: 292px !important;
          max-width: 292px !important;
          max-height: calc(100% - 16px) !important;
          border: 1px solid #cbd7e1 !important;
          border-radius: 9px !important;
          background: #fff !important;
          box-shadow: -5px 7px 22px rgba(15,23,42,.14) !important;
          overflow: hidden !important;
        }
        [class*="_inspectorBody__"] { max-height: calc(100vh - 190px) !important; overflow-y: auto !important; }

        /* EMPTY STATE */
        [class*="emptyViewport"] {
          width: 390px !important;
          max-width: calc(100% - 48px) !important;
          min-height: 0 !important;
          padding: 28px 30px 34px !important;
          overflow: visible !important;
        }
        [class*="emptyViewport"] h2, [class*="emptyViewport"] h3 {
          margin-top: 12px !important; margin-bottom: 8px !important;
        }
        [class*="emptyViewport"] [class*="emptyActions"] { gap: 10px !important; padding-bottom: 30px !important; }

        @media (max-width: 1450px) {
          [class*="cadToolbar"] { padding-right: 8px !important; }
          [class*="_toolRail__"] {
            position: absolute !important;
            top: 6px !important;
            right: 6px !important;
          }
        }
        @media (max-width: 1250px) { [class*="headerLeft"] { padding-left: 205px !important; } }
        @media (max-width: 1100px) {
          [class*="headerLeft"] { padding-left: 195px !important; }
          [class*="_inspector__"] { width: 276px !important; min-width: 276px !important; max-width: 276px !important; }
        }
      `}</style>

      <Suspense fallback={null}><ReturnToWorkspaceButton /></Suspense>
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
