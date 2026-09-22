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
        [class*="applicationHeader"] { height:54px !important; min-height:54px !important; background:#073a4f !important; border-bottom:1px solid #0d5369 !important; color:#fff !important; box-shadow:none !important; }
        [class*="applicationHeader"] * { color:inherit; }
        [class*="headerLeft"] { padding-left:228px !important; }
        [class*="headerDrawingName"] { color:#fff !important; font-weight:900 !important; }

        [class*="cadToolbar"] { height:72px !important; min-height:72px !important; padding:5px 8px 3px !important; align-items:stretch !important; background:#fbfcfd !important; border-bottom:1px solid #cfdbe4 !important; overflow-x:auto !important; overflow-y:hidden !important; scrollbar-width:none !important; }
        [class*="cadToolbar"]::-webkit-scrollbar { display:none !important; }
        [class*="toolbarSection"] { position:relative !important; flex:0 0 auto !important; align-items:flex-end !important; padding:17px 5px 1px !important; gap:2px !important; }
        [class*="toolbarSection"]::before { position:absolute; top:3px; left:7px; color:#496579; font-size:8px; line-height:1; font-weight:900; letter-spacing:.08em; white-space:nowrap; }
        [class*="toolbarSection"]:nth-of-type(1)::before { content:'FILE'; }
        [class*="toolbarSection"]:nth-of-type(2)::before { content:'VIEW'; }
        [class*="toolbarSection"]:nth-of-type(3)::before { content:'DRAW'; }
        [class*="toolbarSection"]:nth-of-type(4)::before { content:'MEASURE · TAKEOFF'; }
        [class*="toolbarSection"]:nth-of-type(5)::before { content:'EDIT · SETUP'; }

        /* Native sections stay first; Smart Takeoff is explicitly inserted before Edit/Setup. */
        [class*="cadToolbar"] > [class*="toolbarSection"]:nth-of-type(5) { order:9 !important; }
        [class*="cadToolbar"] > [data-ritsucad-smart-takeoff="true"] { order:8 !important; }
        [class*="cadToolbar"] > [data-ritsucad-project-data="true"] { order:10 !important; }

        [class*="toolbarDivider"] { height:44px !important; margin:18px 6px 1px !important; background:#d5e0e8 !important; }
        [class*="toolbarButton"], [class*="toolbarButtonWide"], [class*="toolbarIconButton"], [class*="importButton"] { height:45px !important; min-height:45px !important; }
        [class*="toolbarButton"], [class*="toolbarIconButton"] { min-width:51px !important; padding-left:6px !important; padding-right:6px !important; }
        [class*="toolbarButtonWide"], [class*="importButton"] { padding-left:12px !important; padding-right:12px !important; }
        [class*="cadToolbar"] button:disabled { opacity:.30 !important; filter:saturate(.4) !important; }

        [data-ritsucad-smart-takeoff="true"] { min-width:315px; }

        [class*="cadArea"] { position:relative !important; min-width:0 !important; background:#919eaa !important; }
        [class*="viewport"] { min-width:0 !important; width:auto !important; background-color:#919eaa !important; }
        [class*="emptyViewport"] { display:none !important; }

        [class*="_inspector__"] { position:absolute !important; z-index:64 !important; top:10px !important; right:10px !important; bottom:auto !important; width:300px !important; min-width:300px !important; max-width:300px !important; max-height:calc(100% - 20px) !important; border:1px solid #cbd7e1 !important; border-radius:10px !important; background:#fff !important; box-shadow:-5px 8px 24px rgba(15,23,42,.14) !important; overflow:hidden !important; }
        [class*="_inspectorBody__"] { max-height:calc(100vh - 210px) !important; overflow-y:auto !important; }

        [class*="_toolRail__"] { position:absolute !important; z-index:75 !important; top:-72px !important; right:8px !important; height:72px !important; width:auto !important; min-width:0 !important; display:flex !important; flex-direction:row !important; align-items:flex-end !important; gap:2px !important; padding:18px 0 4px !important; border:0 !important; background:transparent !important; overflow:visible !important; }
        [class*="_toolRail__"]::before { content:'PROJECT DATA · PANELS'; position:absolute; top:4px; left:4px; color:#496579; font-size:8px; line-height:1; font-weight:900; letter-spacing:.07em; white-space:nowrap; }
        [class*="_toolRail__"]::after { content:''; position:absolute; left:-7px; top:19px; width:1px; height:44px; background:#d5e0e8; }
        [class*="_railButton__"], [class*="_railButtonActive__"] { width:51px !important; min-width:51px !important; height:45px !important; min-height:45px !important; padding:3px 4px !important; border-radius:7px !important; flex:0 0 51px !important; }
        [class*="_railButton__"] span, [class*="_railButtonActive__"] span { max-width:47px !important; font-size:7px !important; }

        @media (max-width:1250px) { [class*="headerLeft"] { padding-left:210px !important; } }
        @media (max-width:1100px) { [class*="headerLeft"] { padding-left:195px !important; } [class*="_inspector__"] { right:8px !important; width:276px !important; min-width:276px !important; max-width:276px !important; } }
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
