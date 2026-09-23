import { Suspense } from 'react'
import LocationMappingPanel from './LocationMappingPanel'
import TakeoffContextPanel from './TakeoffContextPanel'
import TakeoffPersistenceBridge from './TakeoffPersistenceBridge'
import RitsuCadProjectLauncher from './RitsuCadProjectLauncher'
import RitsuCadRibbonBridge from './RitsuCadRibbonBridge'
import RitsuCadEditSetupHeaderBridge from './RitsuCadEditSetupHeaderBridge'
import RitsuCadDrawingViewsPanel from './RitsuCadDrawingViewsPanel'
import RitsuCadDrawingViewBridge from './RitsuCadDrawingViewBridge'
import ReturnToWorkspaceButton from './ReturnToWorkspaceButton'
import WallSettingsBridge from './WallSettingsBridge'

export const metadata = { title:'RitsuCAD™ | RitsuFlow', description:'RitsuFlow construction CAD, drawing markup, measurement, takeoff, and project location mapping workspace.' }

export default function RitsuCadLayout({ children }) {
  return <div style={{width:'100%',height:'100vh',minWidth:0,minHeight:0,margin:0,overflow:'hidden',background:'#dfe6ec'}}>
    <style>{`
      [class*="backButton"]{display:none!important}[class*="applicationHeader"]{height:48px!important;min-height:48px!important;background:#fff!important;border-bottom:1px solid #d4dee7!important}[class*="headerLeft"]{padding-left:218px!important}[class*="headerDrawingName"]{color:#425a70!important;font-weight:900!important}[class*="cadToolbar"]{height:66px!important;min-height:66px!important;padding:4px 8px 3px!important;align-items:stretch!important;background:#fbfcfd!important;border-bottom:1px solid #cfdbe4!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}[class*="cadToolbar"]::-webkit-scrollbar{display:none!important}[class*="toolbarSection"]{position:relative!important;flex:0 0 auto!important;align-items:flex-end!important;padding:15px 4px 1px!important;gap:1px!important}[class*="toolbarSection"]::before{position:absolute;top:2px;left:6px;color:#496579;font-size:8px;line-height:1;font-weight:900;letter-spacing:.07em;white-space:nowrap}[class*="toolbarDivider"]{height:41px!important;margin:16px 5px 1px!important;background:#d5e0e8!important}[class*="toolbarButton"],[class*="toolbarButtonWide"],[class*="toolbarIconButton"],[class*="importButton"]{height:42px!important;min-height:42px!important}[class*="toolbarButton"],[class*="toolbarIconButton"]{min-width:49px!important;padding-left:6px!important;padding-right:6px!important}[class*="toolbarButtonWide"],[class*="importButton"]{padding-left:11px!important;padding-right:11px!important}[class*="cadToolbar"] button:disabled{opacity:.30!important;filter:saturate(.4)!important}[class*="cadArea"]{position:relative!important;min-width:0!important;background:#919eaa!important}[class*="viewport"]{min-width:0!important;width:auto!important;background-color:#919eaa!important}[class*="emptyViewport"]{display:none!important}[class*="_inspector__"]{position:absolute!important;z-index:64!important;top:10px!important;right:10px!important;bottom:auto!important;width:300px!important;min-width:300px!important;max-width:300px!important;max-height:calc(100% - 20px)!important;border:1px solid #cbd7e1!important;border-radius:9px!important;background:#fff!important;box-shadow:-5px 8px 24px rgba(15,23,42,.14)!important;overflow:hidden!important}[class*="_inspectorBody__"]{max-height:calc(100vh - 200px)!important;overflow-y:auto!important}[class*="_toolRail__"]{position:absolute!important;z-index:75!important;top:-66px!important;right:8px!important;height:66px!important;width:auto!important;min-width:0!important;display:flex!important;flex-direction:row!important;align-items:flex-end!important;gap:2px!important;padding:16px 0 3px!important;border:0!important;background:transparent!important;overflow:visible!important}[class*="_toolRail__"]::before{content:'PANELS · AIDS';position:absolute;top:3px;left:4px;color:#496579;font-size:8px;line-height:1;font-weight:900;letter-spacing:.07em;white-space:nowrap}[class*="_toolRail__"]::after{content:'';position:absolute;left:-7px;top:17px;width:1px;height:41px;background:#d5e0e8}[class*="_railButton__"],[class*="_railButtonActive__"]{width:49px!important;min-width:49px!important;height:42px!important;min-height:42px!important;padding:3px 4px!important;border-radius:6px!important;flex:0 0 49px!important}[class*="_railButton__"] span,[class*="_railButtonActive__"] span{max-width:45px!important;font-size:7px!important}

      /* Sidebar housekeeping: FILE, DRAW, MEASURE and EDIT/SETUP remain mounted
         as command sources but are not rendered in the sidebar. */
      [data-ritsucad-approved-shell="true"] > [data-ritsucad-file-source="true"][class*="toolbarSection"],
      [data-ritsucad-approved-shell="true"] > [class*="toolbarSection"]:nth-of-type(3),
      [data-ritsucad-approved-shell="true"] > [class*="toolbarSection"]:nth-of-type(4),
      [data-ritsucad-approved-shell="true"] > [data-ritsucad-edit-setup-source="true"] {
        display:none!important;
      }
      [data-ritsucad-approved-shell="true"] > [class*="toolbarSection"]:nth-of-type(2)::before{content:'VIEW'!important}

      /* Header command groups: titles are intentionally hidden. */
      .ritsucadHeaderFileTitle,.ritsucadHeaderEditTitle{display:none!important}

      /* Scale and Zoom already remain available in the full-width status bar. */
      [class*="applicationHeader"] [class*="headerMetric"]{display:none!important}

      .ritsucadHeaderEditSlot{display:contents}
      .ritsucadHeaderEditGroup{display:flex;align-items:center;gap:5px;height:48px;padding:0 8px;margin-right:2px;border-right:1px solid rgba(255,255,255,.22)}
      .ritsucadHeaderEditButton{height:40px;min-width:48px;max-width:72px;padding:3px 6px;border:1px solid rgba(255,255,255,.28);border-radius:6px;background:rgba(255,255,255,.08);color:#fff;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;font:inherit;font-weight:800;cursor:pointer}
      .ritsucadHeaderEditButton:hover{background:rgba(255,255,255,.16)}
      .ritsucadHeaderEditButton:disabled{opacity:.45;cursor:default}
      .ritsucadHeaderEditButton>span{font-size:14px;line-height:1}
      .ritsucadHeaderEditButton>small{font-size:7px;line-height:1;white-space:nowrap}

      @media(max-width:1250px){[class*="headerLeft"]{padding-left:205px!important}.ritsucadHeaderEditButton{min-width:42px;padding:3px 4px}.ritsucadHeaderEditButton>small{font-size:6px}}
      @media(max-width:1100px){[class*="headerLeft"]{padding-left:195px!important}[class*="_inspector__"]{right:8px!important;width:276px!important;min-width:276px!important;max-width:276px!important}}
    `}</style>
    <Suspense fallback={null}><ReturnToWorkspaceButton /></Suspense>
    {children}
    <Suspense fallback={null}>
      <RitsuCadRibbonBridge />
      <RitsuCadEditSetupHeaderBridge />
      <WallSettingsBridge />
      <RitsuCadProjectLauncher />
      <RitsuCadDrawingViewsPanel />
      <RitsuCadDrawingViewBridge />
      <LocationMappingPanel />
      <TakeoffContextPanel />
      <TakeoffPersistenceBridge />
    </Suspense>
  </div>
}
