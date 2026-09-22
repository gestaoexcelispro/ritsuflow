import { Suspense } from 'react'
import LocationMappingPanel from './LocationMappingPanel'
import TakeoffContextPanel from './TakeoffContextPanel'
import TakeoffPersistenceBridge from './TakeoffPersistenceBridge'
import RitsuCadProjectLauncher from './RitsuCadProjectLauncher'
import RitsuCadRibbonBridge from './RitsuCadRibbonBridge'
import RitsuCadDrawingViewsPanel from './RitsuCadDrawingViewsPanel'
import RitsuCadDrawingViewBridge from './RitsuCadDrawingViewBridge'
import ReturnToWorkspaceButton from './ReturnToWorkspaceButton'

export const metadata = {
  title: 'RitsuCAD™ | RitsuFlow',
  description: 'RitsuFlow construction CAD, drawing markup, measurement, takeoff, and project location mapping workspace.',
}

export default function RitsuCadLayout({ children }) {
  return (
    <div className="ritsucad-shell">
      <style>{`
        .ritsucad-shell { width:100%; height:100vh; min-width:0; min-height:0; margin:0; overflow:hidden; background:#dfe6ec; }
        [class*="backButton"] { display:none !important; }
        [class*="applicationHeader"] { position:relative !important; height:54px !important; min-height:54px !important; background:#073a4f !important; border-bottom:1px solid #0d5369 !important; color:#fff !important; box-shadow:none !important; }
        [class*="applicationHeader"] * { color:inherit; }
        [class*="headerLeft"] { padding-left:228px !important; }
        [class*="headerDrawingName"] { color:#fff !important; font-weight:900 !important; }

        [data-ritsucad-header-file-actions="true"] {
          position:absolute !important;
          z-index:90 !important;
          top:3px !important;
          right:276px !important;
          height:48px !important;
          display:flex !important;
          align-items:center !important;
          gap:4px !important;
          padding:0 10px !important;
          border-left:1px solid rgba(255,255,255,.16) !important;
          border-right:1px solid rgba(255,255,255,.16) !important;
        }
        .ritsucad-header-file-label { margin-right:2px !important; font-size:8px !important; font-weight:900 !important; letter-spacing:.09em !important; opacity:.88 !important; }
        [data-ritsucad-header-file-actions="true"] button {
          height:43px !important;
          min-width:58px !important;
          padding:2px 7px !important;
          border:0 !important;
          border-radius:6px !important;
          background:transparent !important;
          color:#fff !important;
          display:inline-flex !important;
          flex-direction:column !important;
          align-items:center !important;
          justify-content:center !important;
          gap:1px !important;
          font:inherit !important;
          font-size:8px !important;
          line-height:1 !important;
          font-weight:800 !important;
          cursor:pointer !important;
          white-space:nowrap !important;
        }
        [data-ritsucad-header-file-actions="true"] button:hover { background:rgba(255,255,255,.09) !important; }
        [data-ritsucad-header-file-actions="true"] button > span:first-child { font-size:17px !important; line-height:17px !important; }

        [class*="cadToolbar"] {
          position:absolute !important;
          z-index:70 !important;
          top:54px !important;
          left:0 !important;
          bottom:28px !important;
          width:248px !important;
          height:auto !important;
          min-height:0 !important;
          padding:6px 10px 10px !important;
          display:flex !important;
          flex-direction:column !important;
          align-items:stretch !important;
          gap:0 !important;
          background:#fbfcfd !important;
          border-right:1px solid #cfdbe4 !important;
          border-bottom:0 !important;
          overflow-x:hidden !important;
          overflow-y:auto !important;
          scrollbar-width:thin !important;
        }

        [class*="cadToolbar"] > [class*="toolbarSection"]:nth-of-type(1) { position:absolute !important; width:1px !important; height:1px !important; padding:0 !important; margin:0 !important; overflow:hidden !important; clip:rect(0 0 0 0) !important; clip-path:inset(50%) !important; white-space:nowrap !important; border:0 !important; }

        [class*="toolbarSection"] {
          position:relative !important;
          flex:0 0 auto !important;
          width:100% !important;
          min-width:0 !important;
          display:grid !important;
          grid-template-columns:repeat(3,minmax(0,1fr)) !important;
          align-items:start !important;
          gap:3px !important;
          padding:25px 0 8px !important;
          border-bottom:1px solid #dce5eb !important;
        }
        [class*="toolbarSection"]::before { position:absolute; top:8px; left:5px; color:#496579; font-size:9px; line-height:1; font-weight:900; letter-spacing:.08em; white-space:nowrap; }
        [class*="toolbarSection"]:nth-of-type(2)::before { content:'VIEW'; }
        [class*="toolbarSection"]:nth-of-type(3)::before { content:'DRAW'; }
        [class*="toolbarSection"]:nth-of-type(4)::before { content:'MEASURE · TAKEOFF'; }
        [class*="toolbarSection"]:nth-of-type(5)::before { content:'EDIT · SETUP'; }

        [class*="cadToolbar"] > [class*="toolbarSection"]:nth-of-type(2) { order:2 !important; }
        [class*="cadToolbar"] > [class*="toolbarSection"]:nth-of-type(3) { order:3 !important; }
        [class*="cadToolbar"] > [class*="toolbarSection"]:nth-of-type(4) { order:4 !important; }
        [class*="cadToolbar"] > [data-ritsucad-smart-takeoff="true"] { order:5 !important; }
        [class*="cadToolbar"] > [class*="toolbarSection"]:nth-of-type(5) { order:6 !important; }
        [class*="cadToolbar"] > [data-ritsucad-project-data="true"] { order:7 !important; }

        [class*="toolbarDivider"] { display:none !important; }
        [class*="toolbarButton"], [class*="toolbarButtonWide"], [class*="toolbarIconButton"], [class*="importButton"] { width:100% !important; min-width:0 !important; height:48px !important; min-height:48px !important; padding:3px 4px !important; }
        [class*="toolbarButtonWide"], [class*="importButton"] { grid-column:span 2 !important; }
        [class*="cadToolbar"] button:disabled { opacity:.30 !important; filter:saturate(.4) !important; }

        [data-ritsucad-smart-takeoff="true"] { position:relative !important; flex:0 0 auto !important; min-width:0 !important; width:100% !important; display:grid !important; grid-template-columns:repeat(2,minmax(0,1fr)) !important; align-items:start !important; gap:4px !important; padding:27px 0 9px !important; margin:0 !important; border-left:0 !important; border-bottom:1px solid #dce5eb !important; }
        [data-ritsucad-smart-takeoff="true"] > span:first-child { top:9px !important; left:5px !important; font-size:9px !important; }
        [data-ritsucad-smart-takeoff="true"] > div { width:100% !important; }
        [data-ritsucad-smart-takeoff="true"] > div > button { width:100% !important; min-width:0 !important; }
        [data-ritsucad-smart-takeoff="true"] > div > div { top:44px !important; left:0 !important; min-width:190px !important; }

        [data-ritsucad-project-data="true"] { position:relative !important; flex:0 0 auto !important; width:100% !important; display:grid !important; grid-template-columns:repeat(4,minmax(0,1fr)) !important; align-items:start !important; gap:3px !important; padding:27px 0 9px !important; margin:0 !important; border-left:0 !important; border-bottom:1px solid #dce5eb !important; }
        [data-ritsucad-project-data="true"] > span:first-child { top:9px !important; left:5px !important; font-size:9px !important; }
        [data-ritsucad-project-data="true"] button { width:100% !important; min-width:0 !important; padding-left:2px !important; padding-right:2px !important; }

        [class*="cadArea"] { position:relative !important; min-width:0 !important; margin-left:248px !important; width:calc(100% - 248px) !important; background:#919eaa !important; }
        [class*="viewport"] { min-width:0 !important; width:auto !important; background-color:#919eaa !important; }
        [class*="emptyViewport"] { display:none !important; }

        [class*="_inspector__"] { position:absolute !important; z-index:64 !important; top:10px !important; right:10px !important; bottom:auto !important; width:300px !important; min-width:300px !important; max-width:300px !important; max-height:calc(100% - 20px) !important; border:1px solid #cbd7e1 !important; border-radius:10px !important; background:#fff !important; box-shadow:-5px 8px 24px rgba(15,23,42,.14) !important; overflow:hidden !important; }
        [class*="_inspectorBody__"] { max-height:calc(100vh - 150px) !important; overflow-y:auto !important; }

        /* The CAD environment no longer has a floating right-side tool rail.
           Properties, Layers and Drawings are docked into the footer; SNAP/ORTHO/GRID
           already have native footer controls, so their duplicate rail buttons are hidden. */
        [class*="_toolRail__"] {
          position:fixed !important;
          z-index:95 !important;
          right:430px !important;
          bottom:0 !important;
          top:auto !important;
          left:auto !important;
          width:auto !important;
          min-width:0 !important;
          height:28px !important;
          min-height:28px !important;
          display:flex !important;
          flex-direction:row !important;
          align-items:center !important;
          gap:2px !important;
          padding:0 5px !important;
          border:0 !important;
          background:#052c49 !important;
          overflow:visible !important;
        }
        [class*="_toolRail__"]::before, [class*="_toolRail__"]::after, [class*="_railDivider__"] { display:none !important; }
        [class*="_toolRail__"] > button:nth-of-type(4),
        [class*="_toolRail__"] > button:nth-of-type(5),
        [class*="_toolRail__"] > button:nth-of-type(6) { display:none !important; }
        [class*="_railButton__"], [class*="_railButtonActive__"] {
          width:auto !important;
          min-width:0 !important;
          height:22px !important;
          min-height:22px !important;
          padding:0 7px !important;
          border-radius:4px !important;
          flex:0 0 auto !important;
          flex-direction:row !important;
          gap:4px !important;
          border:1px solid transparent !important;
          background:transparent !important;
          color:#b7c7d3 !important;
        }
        [class*="_railButtonActive__"] { border-color:#4ad9ca !important; background:rgba(20,184,166,.16) !important; color:#7ff2e7 !important; }
        [class*="_railButton__"]:hover:not(:disabled) { background:rgba(255,255,255,.08) !important; color:#fff !important; }
        [class*="_railButton__"] svg, [class*="_railButtonActive__"] svg { width:13px !important; height:13px !important; }
        [class*="_railButton__"] span, [class*="_railButtonActive__"] span { max-width:none !important; font-size:7px !important; line-height:1 !important; color:inherit !important; }

        @media (max-width:1250px) {
          [class*="headerLeft"] { padding-left:210px !important; }
          [data-ritsucad-header-file-actions="true"] { right:248px !important; }
          [class*="cadToolbar"] { width:224px !important; }
          [class*="cadArea"] { margin-left:224px !important; width:calc(100% - 224px) !important; }
          [class*="_toolRail__"] { right:360px !important; }
        }
        @media (max-width:900px) {
          [data-ritsucad-header-file-actions="true"] { right:210px !important; }
          [data-ritsucad-header-file-actions="true"] .ritsucad-header-file-label { display:none !important; }
          [class*="cadToolbar"] { width:204px !important; }
          [class*="cadArea"] { margin-left:204px !important; width:calc(100% - 204px) !important; }
          [class*="_inspector__"] { right:8px !important; width:276px !important; min-width:276px !important; max-width:276px !important; }
          [class*="_toolRail__"] { right:300px !important; }
        }
      `}</style>

      <Suspense fallback={null}><ReturnToWorkspaceButton /></Suspense>
      {children}
      <Suspense fallback={null}>
        <RitsuCadRibbonBridge />
        <RitsuCadProjectLauncher />
        <RitsuCadDrawingViewsPanel />
        <RitsuCadDrawingViewBridge />
        <LocationMappingPanel />
        <TakeoffContextPanel />
        <TakeoffPersistenceBridge />
      </Suspense>
    </div>
  )
}
