'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

function buildTree(locations) {
  const map = new Map()
  locations.forEach((location) => {
    const key = location.parent_id || 'root'
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(location)
  })
  map.forEach((items) => items.sort((a, b) => Number(a.sequence_number || 0) - Number(b.sequence_number || 0) || String(a.name || '').localeCompare(String(b.name || ''))))
  return map
}

export default function RitsuCadProjectPanel() {
  const searchParams = useSearchParams()
  const projectId = searchParams.get('projectId')
  const [project, setProject] = useState(null)
  const [locations, setLocations] = useState([])
  const [expanded, setExpanded] = useState(new Set())
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('locations')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const tree = useMemo(() => buildTree(locations), [locations])

  useEffect(() => {
    if (!projectId) return
    let active = true
    ;(async () => {
      setLoading(true)
      setError('')
      const [{ data: projectData, error: projectError }, { data: locationData, error: locationError }] = await Promise.all([
        supabase.from('projects').select('id,project_id,code,name,status').eq('id', projectId).maybeSingle(),
        supabase.from('locations').select('id,parent_id,name,location_type,sequence_number').eq('project_id', projectId).order('sequence_number', { ascending: true })
      ])
      if (!active) return
      if (projectError || locationError) setError(projectError?.message || locationError?.message || 'Unable to load project context.')
      setProject(projectData || null)
      setLocations(locationData || [])
      setExpanded(new Set((locationData || []).filter((item) => !item.parent_id).map((item) => item.id)))
      setLoading(false)
    })()
    return () => { active = false }
  }, [projectId])

  function toggle(id) {
    setExpanded((current) => {
      const next = new Set(current)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function renderBranch(parent = 'root', depth = 0) {
    return (tree.get(parent) || []).map((location) => {
      const children = tree.get(location.id) || []
      const open = expanded.has(location.id)
      const normalizedQuery = query.trim().toLowerCase()
      const matches = !normalizedQuery || String(location.name || '').toLowerCase().includes(normalizedQuery)
      const childMatches = children.some((child) => String(child.name || '').toLowerCase().includes(normalizedQuery))
      if (normalizedQuery && !matches && !childMatches) return null
      return <div key={location.id}>
        <button type="button" className="rfProjectTreeRow" style={{ paddingLeft: 12 + depth * 18 }} onClick={() => children.length && toggle(location.id)}>
          <span className="rfProjectChevron">{children.length ? (open ? '▾' : '▸') : '◇'}</span>
          <span className="rfProjectNode">{depth === 0 ? '▥' : children.length ? '⬡' : '◇'}</span>
          <span className="rfProjectNodeText"><strong>{location.name}</strong><small>{location.location_type || 'Location'}</small></span>
          <span className="rfProjectState" title="Available in project LBS">✓</span>
        </button>
        {children.length && (open || normalizedQuery) ? renderBranch(location.id, depth + 1) : null}
      </div>
    })
  }

  if (!projectId) return null
  const projectCode = project?.project_id || project?.code || 'Project'

  return <aside className="rfProjectPanel" data-ritsucad-project-panel="true">
    <style>{CSS}</style>
    <div className="rfProjectPanelHeader"><strong>Project</strong><button type="button" title="Collapse project panel">−</button></div>
    <div className="rfProjectIdentity"><div className="rfProjectBadge">P</div><div><strong>{project?.name || (loading ? 'Loading project…' : 'Project')}</strong><small>{projectCode}</small></div><span>⋮</span></div>
    <div className="rfProjectTabs"><button type="button" className={tab === 'locations' ? 'active' : ''} onClick={() => setTab('locations')}>Location Structure</button><button type="button" className={tab === 'drawings' ? 'active' : ''} onClick={() => setTab('drawings')}>Drawings</button></div>
    {tab === 'locations' ? <>
      <div className="rfProjectSearch"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search locations..." /></div>
      <div className="rfProjectTree">{loading ? <div className="rfProjectEmpty">Loading Location Breakdown Structure…</div> : error ? <div className="rfProjectError">{error}</div> : locations.length ? renderBranch() : <div className="rfProjectEmpty">No project locations yet. Build the Location Breakdown Structure in Project Setup.</div>}</div>
      <div className="rfProjectLegend"><span><i className="mapped"/>Mapped</span><span><i/>Unmapped</span><span><i className="progress"/>In Progress</span></div>
    </> : <div className="rfProjectEmpty">Project drawings stay connected to this project context. Use Insert → Project Drawing to open another drawing.</div>}
  </aside>
}

const CSS = `
.rfProjectPanel{position:fixed;z-index:70;top:160px;left:0;bottom:76px;width:360px;display:flex;flex-direction:column;background:#f8fafb;border-right:1px solid #b9c9d2;color:#123b50;font-family:inherit;box-shadow:3px 0 12px rgba(20,57,75,.06)}
.rfProjectPanelHeader{height:42px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid #d6e1e6;background:#fff;font-size:12px}.rfProjectPanelHeader button{border:0;background:transparent;color:#456879;font-size:18px;cursor:pointer}
.rfProjectIdentity{min-height:72px;display:grid;grid-template-columns:52px 1fr 20px;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid #dce6ea;background:#fff}.rfProjectBadge{width:50px;height:44px;border-radius:5px;display:grid;place-items:center;background:#e3eef2;color:#075f78;font-size:20px;font-weight:950}.rfProjectIdentity strong{display:block;font-size:12px;line-height:1.25;color:#10394d}.rfProjectIdentity small{display:block;margin-top:4px;font-size:9px;color:#66818e}.rfProjectIdentity>span{color:#466b7c;font-weight:900}
.rfProjectTabs{height:42px;display:flex;background:#fff;border-bottom:1px solid #d5e1e6}.rfProjectTabs button{flex:1;border:0;border-bottom:3px solid transparent;background:transparent;color:#31596c;font-size:10px;font-weight:850;cursor:pointer}.rfProjectTabs button.active{border-bottom-color:#00a39b;color:#0a6d70;background:#f5fbfb}
.rfProjectSearch{height:48px;display:flex;align-items:center;gap:7px;padding:0 12px}.rfProjectSearch span{font-size:17px;color:#5d7b89}.rfProjectSearch input{flex:1;height:32px;border:1px solid #c8d7de;border-radius:4px;padding:0 9px;outline:none;background:#fff;color:#173f52;font-size:10px}
.rfProjectTree{flex:1;min-height:0;overflow:auto;border-top:1px solid #e3ebee;border-bottom:1px solid #e3ebee;background:#fff}.rfProjectTreeRow{width:100%;min-height:42px;display:flex;align-items:center;gap:7px;padding-right:12px;border:0;border-bottom:1px solid #edf2f4;background:#fff;color:#173f52;text-align:left;cursor:pointer}.rfProjectTreeRow:hover{background:#eef7f8}.rfProjectChevron{width:12px;color:#32677c;font-size:10px}.rfProjectNode{width:16px;color:#0b5870;font-size:13px}.rfProjectNodeText{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.rfProjectNodeText strong{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rfProjectNodeText small{font-size:8px;color:#8297a1;text-transform:capitalize}.rfProjectState{width:16px;height:16px;border-radius:50%;display:grid;place-items:center;background:#e9f8f5;color:#119b88;font-size:9px;font-weight:950}
.rfProjectLegend{height:45px;display:flex;align-items:center;justify-content:space-around;padding:0 8px;background:#fff;font-size:8px;color:#587581}.rfProjectLegend span{display:flex;align-items:center;gap:5px}.rfProjectLegend i{width:9px;height:9px;border-radius:50%;background:#d6dee2}.rfProjectLegend i.mapped{background:#13a986}.rfProjectLegend i.progress{background:#fff;border:2px solid #4d8295;box-sizing:border-box}.rfProjectEmpty,.rfProjectError{padding:18px 15px;font-size:10px;line-height:1.5;color:#718995}.rfProjectError{color:#9a4545}
[class*="application"]:has(.rfProjectPanel)>[class*="cadArea"]{left:360px!important;width:auto!important}
@media(max-width:1200px){.rfProjectPanel{width:300px}[class*="application"]:has(.rfProjectPanel)>[class*="cadArea"]{left:300px!important;width:auto!important}}
`