'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const TABS=['Home','Draw','Takeoff','Location','Annotate','View','Manage']

const COMMANDS={
 Home:[['⌖','Select','key:v'],['✋','Pan','key:h'],['⌕','Zoom','key:z'],['▣','Fit Page','key:f'],['↔','Fit Width','key:w'],['▱','Layers','event:ritsucad:open-layers'],['▤','Properties','event:ritsucad:open-properties']],
 Draw:[['╱','Line','key:1'],['⌁','Polyline','key:2'],['▭','Rectangle','key:3'],['⬠','Polygon','key:4'],['○','Circle','key:5'],['▱','Layers','event:ritsucad:open-layers'],['⌗','Snapping','event:ritsucad:toggle-snap']],
 Takeoff:[['▥','Architecture','smart:Architectural'],['▰','Structural','smart:Structural'],['⌁','MEP','smart:MEP'],['△','Geometry','smart:Geometry'],['▦','Takeoff Data','event:ritsucad:open-takeoff-context']],
 Location:[['⌘','Location Tree','location'],['⬡','Map Boundary','location'],['✎','Edit Boundary','event:ritsucad:edit-location-boundary'],['◉','Show/Hide','event:ritsucad:toggle-location-boundaries'],['□','Isolate','event:ritsucad:isolate-location'],['⌕','Zoom to Location','event:ritsucad:zoom-location'],['×','Clear Selection','key:escape']],
 Annotate:[['T','Text','event:ritsucad:annotate-text'],['☁','Cloud','event:ritsucad:annotate-cloud'],['➜','Arrow','event:ritsucad:annotate-arrow'],['▢','Box','event:ritsucad:annotate-box'],['▤','Properties','event:ritsucad:open-properties']],
 View:[['⌖','Select','key:v'],['✋','Pan','key:h'],['⌕','Zoom','key:z'],['▣','Fit Page','key:f'],['↔','Fit Width','key:w'],['▤','Drawing Views','event:ritsucad:open-drawing-views-command'],['▱','Layers','event:ritsucad:open-layers']],
 Manage:[['⌇','Calibrate','event:ritsucad:calibrate'],['▱','Layers','event:ritsucad:open-layers'],['▤','Properties','event:ritsucad:open-properties'],['⌗','Snapping','event:ritsucad:toggle-snap'],['▦','Drawing Views','event:ritsucad:open-drawing-views-command'],['✓','Save View','event:ritsucad:save-drawing-view']]
}

export default function RitsuCadDesktopRibbon(){
 const [host,setHost]=useState(null),[tab,setTab]=useState('Home')
 const router=useRouter(),pathname=usePathname(),params=useSearchParams()
 const hasProject=Boolean(params.get('projectId')&&params.get('documentId'))
 useEffect(()=>{let cancelled=false;const find=()=>{if(cancelled)return;const h=document.querySelector('[class*="application"]');if(h){setHost(h);return}setTimeout(find,50)};find();return()=>{cancelled=true}},[])
 const commands=useMemo(()=>COMMANDS[tab]||[],[tab])
 function run(action){
  if(action==='location'){if(!hasProject)return;const p=new URLSearchParams(params.toString());p.set('mode','location-mapping');router.replace(`${pathname}?${p.toString()}`,{scroll:false});return}
  if(action.startsWith('key:')){const key=action.slice(4);document.dispatchEvent(new KeyboardEvent('keydown',{key,code:key.length===1?`Key${key.toUpperCase()}`:key,bubbles:true}));return}
  if(action.startsWith('event:')){window.dispatchEvent(new Event(action.slice(6)));return}
  if(action.startsWith('smart:')){window.dispatchEvent(new CustomEvent('ritsucad:open-smart-group',{detail:{group:action.slice(6)}}))}
 }
 if(!host)return null
 return createPortal(<><style>{CSS}</style><section className="rfDesktopRibbon" data-ritsucad-desktop-ribbon="true"><nav className="rfRibbonTabs">{TABS.map(t=><button key={t} type="button" className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</nav><div className="rfRibbonCommands">{commands.map(([icon,label,action],i)=><button key={`${tab}-${label}-${i}`} type="button" disabled={(tab==='Location'||action==='location')&&!hasProject} onClick={()=>run(action)} title={label}><span>{icon}</span><strong>{label}</strong></button>)}</div></section></>,host)
}

const CSS=`
[class*="application"]:has([data-ritsucad-desktop-ribbon="true"]){display:grid!important;grid-template-columns:minmax(0,1fr)!important;grid-template-rows:65px 108px minmax(0,1fr)!important}
[class*="application"]:has([data-ritsucad-desktop-ribbon="true"])>[class*="applicationHeader"]{grid-column:1!important;grid-row:1!important}
[class*="application"]:has([data-ritsucad-desktop-ribbon="true"])>[data-ritsucad-approved-shell="true"]{display:none!important}
[class*="application"]:has([data-ritsucad-desktop-ribbon="true"])>[class*="cadArea"]{grid-column:1!important;grid-row:3!important;width:100%!important;min-width:0!important;min-height:0!important}
.rfDesktopRibbon{grid-column:1;grid-row:2;z-index:84;display:flex;flex-direction:column;min-width:0;background:#f8fafc;border-bottom:1px solid #cbd8df;box-shadow:0 2px 7px rgba(18,52,70,.07);font-family:inherit;color:#123b50}
.rfRibbonTabs{height:34px;display:flex;align-items:flex-end;gap:2px;padding:0 16px;border-bottom:1px solid #dce5ea;background:#fff}
.rfRibbonTabs button{height:34px;min-width:72px;padding:0 16px;border:0;border-bottom:3px solid transparent;background:transparent;color:#244b60;font:inherit;font-size:11px;font-weight:850;cursor:pointer}
.rfRibbonTabs button:hover{background:#f2f7f9}.rfRibbonTabs button.active{color:#008f88;border-bottom-color:#00a59d;background:#f5fbfb}
.rfRibbonCommands{height:74px;display:flex;align-items:stretch;gap:2px;padding:5px 14px 6px;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin}
.rfRibbonCommands button{position:relative;min-width:74px;height:62px;padding:5px 9px;border:0;border-right:1px solid #dbe4e9;background:transparent;color:#173f52;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font:inherit;cursor:pointer}
.rfRibbonCommands button:hover{background:#eaf6f6;border-radius:5px}.rfRibbonCommands button:disabled{opacity:.35;cursor:default}.rfRibbonCommands button>span{height:25px;font-size:22px;line-height:25px;color:#0a5870}.rfRibbonCommands button>strong{font-size:9px;line-height:1.05;white-space:nowrap}
@media(max-width:1000px){.rfRibbonTabs button{min-width:58px;padding:0 9px}.rfRibbonCommands button{min-width:64px;padding:5px 6px}}
`
