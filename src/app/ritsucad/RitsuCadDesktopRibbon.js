'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

const TABS = ['Home','Insert','Draw','Takeoff','Location','Annotate','View','Manage']

const RIBBON = {
  Home: [
    { name:'Navigate', items:[['⌖','Select','key:v'],['✋','Pan','key:h'],['⌕','Zoom','key:z'],['▣','Fit Page','key:f'],['↔','Fit Width','key:w']] },
    { name:'Panels', items:[['▱','Layers','event:ritsucad:open-layers'],['▤','Properties','event:ritsucad:open-properties']] },
    { name:'Edit', items:[['↶','Undo','event:ritsucad:undo'],['↷','Redo','event:ritsucad:redo']] }
  ],
  Insert: [
    { name:'Drawing', items:[['□','New Drawing','header:New Drawing'],['↓','Import PDF','header:Import PDF']] },
    { name:'Sources', items:[['▤','Drawings','header:Drawings'],['▣','Project Drawing','header:Project Drawing']] }
  ],
  Draw: [
    { name:'Draw', items:[['╱','Line','key:1'],['⌁','Polyline','key:2'],['▭','Rectangle','key:3'],['⬠','Polygon','key:4'],['○','Circle','key:5']] },
    { name:'Drawing Aids', items:[['⌗','Snapping','event:ritsucad:toggle-snap'],['▱','Layers','event:ritsucad:open-layers']] }
  ],
  Takeoff: [
    { name:'Smart Takeoff', items:[['▥','Architecture','smart:Architectural'],['▰','Structural','smart:Structural'],['⌁','MEP','smart:MEP'],['△','Geometry','smart:Geometry']] },
    { name:'Data', items:[['▦','Takeoff Data','event:ritsucad:open-takeoff-context']] }
  ],
  Location: [
    { name:'Structure', items:[['⌘','Location Tree','location']] },
    { name:'Boundary', items:[['⬡','Map Boundary','location'],['✎','Edit Boundary','event:ritsucad:edit-location-boundary']] },
    { name:'Display', items:[['◉','Show/Hide','event:ritsucad:toggle-location-boundaries'],['□','Isolate','event:ritsucad:isolate-location'],['⌕','Zoom to Location','event:ritsucad:zoom-location']] },
    { name:'Selection', items:[['×','Clear Selection','key:escape']] }
  ],
  Annotate: [
    { name:'Markup', items:[['T','Text','event:ritsucad:annotate-text'],['☁','Cloud','event:ritsucad:annotate-cloud'],['➜','Arrow','event:ritsucad:annotate-arrow'],['▢','Box','event:ritsucad:annotate-box']] },
    { name:'Properties', items:[['▤','Properties','event:ritsucad:open-properties']] }
  ],
  View: [
    { name:'Navigate', items:[['⌖','Select','key:v'],['✋','Pan','key:h'],['⌕','Zoom','key:z']] },
    { name:'Fit', items:[['▣','Fit Page','key:f'],['↔','Fit Width','key:w']] },
    { name:'Display', items:[['▤','Drawing Views','event:ritsucad:open-drawing-views-command'],['▱','Layers','event:ritsucad:open-layers']] }
  ],
  Manage: [
    { name:'Setup', items:[['⌇','Calibrate','event:ritsucad:calibrate'],['⌗','Snapping','event:ritsucad:toggle-snap']] },
    { name:'Drawing', items:[['▱','Layers','event:ritsucad:open-layers'],['▤','Properties','event:ritsucad:open-properties']] },
    { name:'Views', items:[['▦','Drawing Views','event:ritsucad:open-drawing-views-command'],['✓','Save View','event:ritsucad:save-drawing-view']] }
  ]
}

export default function RitsuCadDesktopRibbon(){
  const [host,setHost]=useState(null)
  const [tab,setTab]=useState('Home')
  const [command,setCommand]=useState('')
  const router=useRouter(), pathname=usePathname(), params=useSearchParams()
  const hasProject=Boolean(params.get('projectId')&&params.get('documentId'))

  useEffect(()=>{
    let cancelled=false
    const find=()=>{
      if(cancelled)return
      const header=document.querySelector('[class*="applicationHeader"]')
      let node=header?.parentElement||document.querySelector('[class*="cadArea"]')?.parentElement||null, root=null
      while(node){
        try{if(node.querySelector(':scope > [class*="cadArea"]')){root=node;break}}catch{}
        node=node.parentElement
      }
      if(root){setHost(root);return}
      setTimeout(find,50)
    }
    find()
    return()=>{cancelled=true}
  },[])

  const groups=useMemo(()=>RIBBON[tab]||[],[tab])

  function run(action,label){
    setCommand(label?.toUpperCase()||'')
    if(action==='location'){
      if(!hasProject)return
      const p=new URLSearchParams(params.toString())
      p.set('mode','location-mapping')
      router.replace(`${pathname}?${p.toString()}`,{scroll:false})
      return
    }
    if(action.startsWith('header:')){
      const wanted=action.slice(7).trim().toLowerCase()
      const header=document.querySelector('[class*="applicationHeader"]')
      const buttons=[...(header?.querySelectorAll('button')||[])]
      const target=buttons.find(button=>{
        const text=(button.innerText||button.textContent||'').replace(/\s+/g,' ').trim().toLowerCase()
        const title=(button.getAttribute('title')||'').trim().toLowerCase()
        const aria=(button.getAttribute('aria-label')||'').trim().toLowerCase()
        return text===wanted||text.includes(wanted)||title===wanted||title.includes(wanted)||aria===wanted||aria.includes(wanted)
      })
      if(target){target.click();return}
      console.warn(`[RitsuCAD] Header action not found: ${action.slice(7)}`)
      return
    }
    if(action.startsWith('key:')){
      const key=action.slice(4)
      document.dispatchEvent(new KeyboardEvent('keydown',{key,code:key.length===1?`Key${key.toUpperCase()}`:key,bubbles:true}))
      return
    }
    if(action.startsWith('event:')){window.dispatchEvent(new Event(action.slice(6)));return}
    if(action.startsWith('smart:'))window.dispatchEvent(new CustomEvent('ritsucad:open-smart-group',{detail:{group:action.slice(6)}}))
  }

  function submitCommand(e){
    e.preventDefault()
    const value=command.trim().toLowerCase()
    const aliases={line:'key:1',pline:'key:2',polyline:'key:2',rectangle:'key:3',polygon:'key:4',circle:'key:5',zoom:'key:z',pan:'key:h',select:'key:v',calibrate:'event:ritsucad:calibrate',layers:'event:ritsucad:open-layers',properties:'event:ritsucad:open-properties',location:'location'}
    if(aliases[value])run(aliases[value],value)
    setCommand('')
  }

  if(!host)return null

  return createPortal(<>
    <style>{CSS}</style>
    <section className="rfDesktopRibbon" data-ritsucad-desktop-ribbon="true">
      <nav className="rfRibbonTabs">
        <div className="rfRibbonTabList">{TABS.map(t=><button key={t} type="button" className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
      </nav>
      <div className="rfRibbonCommands">
        <div className="rfRibbonGroups">
          {groups.map((group,groupIndex)=><div className="rfCommandGroup" key={`${tab}-${group.name}-${groupIndex}`}>
            <div className="rfCommandItems">{group.items.map(([icon,label,action],i)=><button key={`${tab}-${group.name}-${label}-${i}`} type="button" disabled={(tab==='Location'||action==='location')&&!hasProject} onClick={()=>run(action,label)} title={label}><span>{icon}</span><strong>{label}</strong></button>)}</div>
            <small>{group.name}</small>
          </div>)}
        </div>
        <a className="rfRibbonBrand" href="/dashboard" aria-label="Return to RitsuFlow" title="Return to RitsuFlow"><img src="/logo.png" alt="RitsuFlow" /></a>
      </div>
    </section>
    <div className="rfDrawingTabs" data-ritsucad-drawing-tabs="true"><button className="active">Current Drawing <span>×</span></button><button title="New drawing tab">＋</button></div>
    <form className="rfCommandLine" data-ritsucad-command-line="true" onSubmit={submitCommand}><strong>Command:</strong><input value={command} onChange={e=>setCommand(e.target.value)} placeholder="Type a command (e.g. LINE, PLINE, AREA, CALIBRATE, LOCATION, ZOOM)..." aria-label="RitsuCAD command"/></form>
    <div className="rfModelBar" data-ritsucad-model-bar="true"><div><button className="active">Model</button><button>Layout1</button><button>Layout2</button><button>＋</button></div><div className="rfStatus"><span>X: —</span><span>Y: —</span><button>SNAP</button><button>ORTHO</button><button>GRID</button><span>Scale —</span><span>Units —</span></div></div>
  </>,host)
}

const CSS=`
[data-ritsucad-approved-shell="true"],[class*="cadToolbar"]{display:none!important}
.ritsucadHeaderEditSlot,.ritsucadHeaderEditGroup,.ritsucadHeaderFileSlot,.ritsucadHeaderFileGroup{display:none!important}
[class*="application"]:has([data-ritsucad-desktop-ribbon="true"]){position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;max-width:none!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;background:#919eaa!important}
[class*="application"]:has([data-ritsucad-desktop-ribbon="true"])>[class*="applicationHeader"]{display:none!important}
[class*="application"]:has([data-ritsucad-desktop-ribbon="true"])>[class*="cadArea"]{position:fixed!important;z-index:1!important;top:160px!important;left:0!important;right:0!important;bottom:76px!important;width:100vw!important;height:auto!important;max-width:none!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;display:block!important;background:#919eaa!important;overflow:hidden!important}
[class*="application"]:has([data-ritsucad-desktop-ribbon="true"])>[class*="cadArea"]>[class*="viewport"]{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;min-width:0!important;margin:0!important;background:#919eaa!important}
.rfDesktopRibbon,.rfDrawingTabs,.rfCommandLine,.rfModelBar{box-sizing:border-box!important;left:0!important;right:0!important;width:100vw!important;max-width:none!important;margin:0!important;font-family:inherit}
.rfDesktopRibbon{position:fixed!important;z-index:95!important;top:0!important;height:126px!important;display:flex!important;flex-direction:column!important;background:#eef3f6;border-bottom:1px solid #9eafb9;color:#123b50;overflow:hidden}
.rfRibbonTabs{height:34px;flex:0 0 34px;display:flex;align-items:stretch;padding:0 18px;border-bottom:1px solid #c9d5dc;background:#fff;overflow:hidden}.rfRibbonTabList{display:flex;align-items:flex-end;gap:2px;min-width:0}.rfRibbonTabs button{height:34px;min-width:78px;padding:0 16px;border:0;border-bottom:3px solid transparent;background:transparent;color:#244b60;font:inherit;font-size:11px;font-weight:850;cursor:pointer}.rfRibbonTabs button:hover{background:#e9f1f4}.rfRibbonTabs button.active{color:#008f88;border-bottom-color:#00a59d;background:#f4fbfb}
.rfRibbonCommands{height:92px;flex:0 0 92px;display:flex;align-items:stretch;justify-content:space-between;padding:4px 12px 3px;overflow:hidden}.rfRibbonGroups{display:flex;align-items:stretch;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}.rfRibbonGroups::-webkit-scrollbar{display:none}.rfRibbonBrand{flex:0 0 170px;display:flex;align-items:center;justify-content:center;margin:-4px -12px -3px 12px;padding:8px 18px;border-left:1px solid #bdcbd3;background:#eef3f6;text-decoration:none;overflow:hidden}.rfRibbonBrand:hover{background:#e3ecef}.rfRibbonBrand img{display:block;width:auto;height:auto;max-width:138px;max-height:52px;object-fit:contain}
.rfCommandGroup{display:flex;flex:0 0 auto;flex-direction:column;align-items:stretch;padding:0 6px;border-right:1px solid #bdcbd3}.rfCommandGroup:first-child{padding-left:0}.rfCommandGroup:last-child{border-right:0}.rfCommandItems{display:flex;flex:1;align-items:stretch}.rfCommandGroup small{text-align:center;color:#607986;font-size:9px;line-height:14px;white-space:nowrap}.rfCommandItems button{min-width:72px;height:70px;padding:5px 8px;border:0;background:transparent;color:#173f52;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;font:inherit;cursor:pointer}.rfCommandItems button:hover{background:#dcebed}.rfCommandItems button:disabled{opacity:.35}.rfCommandItems button>span{height:28px;font-size:24px;line-height:28px;color:#075f78}.rfCommandItems button>strong{font-size:9px;white-space:nowrap}
.rfDrawingTabs{position:fixed!important;z-index:94!important;top:126px!important;height:34px!important;display:flex;align-items:flex-end;padding:0 12px;background:#e8eef2;border-bottom:1px solid #b7c6ce}.rfDrawingTabs button{height:30px;padding:0 14px;border:1px solid transparent;background:transparent;color:#254a5d;font:inherit;font-size:10px;font-weight:750}.rfDrawingTabs button.active{background:#fff;border-color:#b7c6ce;border-bottom-color:#fff}.rfDrawingTabs span{margin-left:16px;color:#7c909b}
.rfCommandLine{position:fixed!important;z-index:96!important;bottom:34px!important;height:42px!important;display:flex;align-items:center;gap:10px;padding:5px 14px;background:#f6f8fa;border-top:1px solid #c4d0d6}.rfCommandLine strong{font-size:10px;color:#173f52}.rfCommandLine input{flex:1;height:28px;padding:0 10px;border:1px solid #b9c8d0;border-radius:3px;background:#fff;color:#173f52;font:inherit;font-size:10px;outline:none}.rfCommandLine input:focus{border-color:#00a59d;box-shadow:0 0 0 1px #00a59d}
.rfModelBar{position:fixed!important;z-index:97!important;bottom:0!important;height:34px!important;display:flex;align-items:center;justify-content:space-between;background:#083f59;color:#fff;padding:0 10px}.rfModelBar>div:first-child{height:100%;display:flex;align-items:center}.rfModelBar button{height:28px;padding:0 13px;border:0;background:transparent;color:#d8e7ed;font:inherit;font-size:9px}.rfModelBar button.active{background:#0b607c;color:#fff;border-bottom:2px solid #18c2b7}.rfStatus{display:flex;align-items:center;height:100%;gap:6px;font-size:9px}.rfStatus span{padding:0 5px;color:#d8e7ed}.rfStatus button{height:24px;padding:0 8px;border:1px solid #39738a;border-radius:3px}.rfStatus button:hover{background:#0b607c}
@media(max-width:1000px){.rfRibbonTabs{padding-left:8px}.rfRibbonTabs button{min-width:58px;padding:0 9px}.rfRibbonBrand{flex-basis:120px;padding:8px 10px}.rfRibbonBrand img{max-width:100px;max-height:44px}.rfCommandItems button{min-width:62px;padding:5px}.rfStatus span:nth-child(-n+2){display:none}}
`