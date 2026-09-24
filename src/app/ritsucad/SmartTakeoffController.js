'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSmartTakeoffMetadata, getSmartTakeoffGroups } from './smartTakeoff'

const TOOL_KEYS = {
  polyline: '2',
  area: 'A',
  count: 'C',
  rectangle: 'R',
}

function normalizeGroupId(value) {
  const text = String(value || '').trim().toLowerCase()
  if (text === 'architecture') return 'architectural'
  return text
}

function groupMatches(group, requested) {
  return normalizeGroupId(group?.name) === normalizeGroupId(requested)
}

function activateNativeTool(measurementTool) {
  const key = TOOL_KEYS[measurementTool]
  if (!key) return false
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key,
    code: key.length === 1 && /[0-9]/.test(key) ? `Digit${key}` : `Key${key.toUpperCase()}`,
    bubbles: true,
  }))
  return true
}

export default function SmartTakeoffController() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const documentId = searchParams.get('documentId')
  const mappingMode = searchParams.get('mode') === 'location-mapping'
  const groups = useMemo(() => getSmartTakeoffGroups(), [])
  const [openGroup, setOpenGroup] = useState(null)

  useEffect(() => {
    if (!projectId || !documentId || mappingMode) return undefined

    function openSmartGroup(event) {
      const requested = event.detail?.group || event.detail?.discipline || event.detail?.id
      const group = groups.find((candidate) => groupMatches(candidate, requested))
      if (!group) return
      setOpenGroup(group)
    }

    window.addEventListener('ritsucad:open-smart-group', openSmartGroup)
    return () => window.removeEventListener('ritsucad:open-smart-group', openSmartGroup)
  }, [projectId, documentId, mappingMode, groups])

  if (!openGroup) return null

  function selectItem(item) {
    // Wall owns a richer settings workflow. Dispatch the normal selection event;
    // WallSettingsBridge intercepts the Wall command and opens its settings modal.
    if (item.id === 'wall') {
      setOpenGroup(null)
      window.dispatchEvent(new CustomEvent('ritsucad:request-wall-settings', { detail: { item } }))
      return
    }

    const metadata = createSmartTakeoffMetadata(item.id)
    if (!metadata) return

    window.__RITSUCAD_ACTIVE_SMART_TAKEOFF__ = metadata
    window.dispatchEvent(new CustomEvent('ritsucad:smart-takeoff-selected', {
      detail: { ...item, metadata },
    }))
    setOpenGroup(null)
    window.setTimeout(() => activateNativeTool(item.measurementTool), 0)
  }

  return (
    <div className="ritsucadSmartTakeoffBackdrop" onMouseDown={() => setOpenGroup(null)}>
      <section className="ritsucadSmartTakeoffPanel" onMouseDown={(event) => event.stopPropagation()} aria-label={`${openGroup.name} takeoff`}>
        <header>
          <div>
            <small>SMART TAKEOFF</small>
            <h2>{openGroup.name}</h2>
          </div>
          <button type="button" onClick={() => setOpenGroup(null)} aria-label="Close">×</button>
        </header>
        <p>Select the construction object you want to quantify. RitsuCAD will use the appropriate native geometry tool and preserve the semantic takeoff context.</p>
        <div className="ritsucadSmartTakeoffGrid">
          {openGroup.items.map((item) => (
            <button key={item.id} type="button" onClick={() => selectItem(item)}>
              <span className="ritsucadSmartTakeoffIcon">{item.icon === 'count' ? '⊕' : item.icon === 'area' ? '△' : '⌁'}</span>
              <span><strong>{item.label}</strong><small>{item.measurementTool === 'polyline' ? 'Linear geometry' : item.measurementTool === 'area' ? 'Area geometry' : item.measurementTool === 'count' ? 'Count geometry' : 'Geometry'}</small></span>
            </button>
          ))}
        </div>
      </section>
      <style jsx global>{`
        .ritsucadSmartTakeoffBackdrop{position:fixed;inset:0;z-index:130;background:rgba(15,23,42,.24);display:flex;align-items:flex-start;justify-content:center;padding-top:165px}
        .ritsucadSmartTakeoffPanel{width:min(620px,calc(100vw - 36px));background:#fff;border:1px solid #bdccd7;border-radius:10px;box-shadow:0 18px 48px rgba(15,23,42,.24);overflow:hidden;color:#173f52}
        .ritsucadSmartTakeoffPanel>header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px 13px;border-bottom:1px solid #d8e2e8}
        .ritsucadSmartTakeoffPanel header small{display:block;font-size:9px;font-weight:900;letter-spacing:.12em;color:#607986;margin-bottom:3px}
        .ritsucadSmartTakeoffPanel h2{margin:0;font-size:20px;line-height:1.1;color:#12394b}
        .ritsucadSmartTakeoffPanel header button{width:32px;height:32px;border:1px solid #cad7df;background:#fff;border-radius:5px;font-size:22px;line-height:26px;color:#36586a;cursor:pointer}
        .ritsucadSmartTakeoffPanel>p{margin:0;padding:13px 20px 4px;color:#587080;font-size:12px;line-height:1.45}
        .ritsucadSmartTakeoffGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:14px 20px 20px}
        .ritsucadSmartTakeoffGrid>button{min-height:70px;border:1px solid #cfdae2;border-radius:7px;background:#fbfdfe;display:flex;align-items:center;gap:13px;text-align:left;padding:10px 13px;color:#173f52;cursor:pointer}
        .ritsucadSmartTakeoffGrid>button:hover{border-color:#159a98;background:#edf8f7}
        .ritsucadSmartTakeoffIcon{width:38px;height:38px;display:grid;place-items:center;border-radius:6px;background:#e4f2f3;color:#067d83;font-size:23px;font-weight:700;flex:0 0 38px}
        .ritsucadSmartTakeoffGrid strong{display:block;font-size:13px;margin-bottom:4px}.ritsucadSmartTakeoffGrid small{display:block;font-size:10px;color:#68808e;font-weight:600}
        @media(max-width:650px){.ritsucadSmartTakeoffGrid{grid-template-columns:1fr}.ritsucadSmartTakeoffBackdrop{padding-top:120px}}
      `}</style>
    </div>
  )
}
