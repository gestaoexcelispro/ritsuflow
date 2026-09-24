import { Suspense } from 'react'
import LocationMappingPanel from './LocationMappingPanel'
import DrawingLocationPanel from './DrawingLocationPanel'
import TakeoffContextPanel from './TakeoffContextPanel'
import TakeoffPersistenceBridge from './TakeoffPersistenceBridge'
import RitsuCadProjectLauncher from './RitsuCadProjectLauncher'
import RitsuCadProjectContext from './RitsuCadProjectContext'
import RitsuCadRibbonBridge from './RitsuCadRibbonBridge'
import RitsuCadDesktopRibbon from './RitsuCadDesktopRibbon'
import RitsuCadCommandBridge from './RitsuCadCommandBridge'
import RitsuCadCalibrationModalBridge from './RitsuCadCalibrationModalBridge'
import RitsuCadEditSetupHeaderBridge from './RitsuCadEditSetupHeaderBridge'
import RitsuCadDrawingViewsPanel from './RitsuCadDrawingViewsPanel'
import RitsuCadDrawingViewBridge from './RitsuCadDrawingViewBridge'
import RitsuCadLogoBridge from './RitsuCadLogoBridge'
import RitsuCadLegacyShellCleanup from './RitsuCadLegacyShellCleanup'
import WallSettingsBridge from './WallSettingsBridge'

export const metadata={title:'RitsuCAD™ | RitsuFlow',description:'RitsuFlow construction CAD, drawing markup, measurement, takeoff, and project location mapping workspace.'}

export default function RitsuCadLayout({children}){
 return <div style={{width:'100%',height:'100vh',minWidth:0,minHeight:0,margin:0,overflow:'hidden',background:'#dfe6ec'}}>
  <style>{`[class*="backButton"]{display:none!important}[data-ritsucad-approved-shell="true"],[class*="cadToolbar"]{display:none!important}[class*="applicationHeader"] [class*="headerMetric"]{display:none!important}.ritsucadHeaderFileTitle,.ritsucadHeaderEditTitle,.ritsucadHeaderFileSlot,.ritsucadHeaderEditSlot,.ritsucadHeaderFileGroup,.ritsucadHeaderEditGroup{display:none!important}`}</style>
  {children}
  <Suspense fallback={null}>
   <RitsuCadLogoBridge />
   <RitsuCadRibbonBridge />
   <RitsuCadDesktopRibbon />
   <RitsuCadProjectContext />
   <RitsuCadCommandBridge />
   <RitsuCadCalibrationModalBridge />
   <RitsuCadEditSetupHeaderBridge />
   <WallSettingsBridge />
   <RitsuCadProjectLauncher />
   <RitsuCadDrawingViewsPanel />
   <RitsuCadDrawingViewBridge />
   <LocationMappingPanel />
   <DrawingLocationPanel />
   <TakeoffContextPanel />
   <TakeoffPersistenceBridge />
   <RitsuCadLegacyShellCleanup />
  </Suspense>
 </div>
}
