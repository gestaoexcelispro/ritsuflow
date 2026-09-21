import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'
import LocationWorkspace from '../../../dashboard/projects/setup/LocationWorkspace'

export const dynamic = 'force-dynamic'

export default async function LocationBreakdownPage({ params }) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [projectResult, locationsResult, servicesResult, allocationsResult] = await Promise.all([
    supabase
      .from('projects')
      .select('id, project_id, code, name')
      .eq('id', projectId)
      .maybeSingle(),
    supabase
      .from('locations')
      .select('id, project_id, parent_id, name, location_type, environment_type, sequence_number, created_at, updated_at')
      .eq('project_id', projectId)
      .order('sequence_number', { ascending: true }),
    supabase
      .from('project_services')
      .select('id, project_id, project_work_package_id, service_code, service_name, unit, scope_quantity, unit_cost, sequence_number, is_active')
      .eq('project_id', projectId)
      .order('sequence_number', { ascending: true }),
    supabase
      .from('location_service_quantities')
      .select('id, project_id, location_id, service_id, quantity, source_scope_item_id, created_at, updated_at')
      .eq('project_id', projectId),
  ])

  const project = projectResult.data
  if (!project) redirect('/projects')

  const loadError = projectResult.error || locationsResult.error || servicesResult.error || allocationsResult.error
  const services = (servicesResult.data || []).filter(item => item.is_active !== false)

  return (
    <main style={shell}>
      <header style={header}>
        <Link href="/workspaces" style={brand}>
          <Image src="/logo-white.png" alt="RitsuFlow" width={132} height={48} priority />
        </Link>
        <div style={titleBlock}>
          <div style={title}>Location Breakdown Structure</div>
          <div style={subtitle}>{project.project_id || project.code || 'Project'} · {project.name}</div>
        </div>
        <div style={headerActions}>
          <Link href={`/projects/${projectId}`} style={recordButton}>← Project Record</Link>
          <Link href={`/projects/${projectId}/scope`} style={scopeButton}>Scope Management</Link>
          <Link href={`/planning/pre-planning?projectId=${projectId}`} style={preconButton}>Continue to PreCon →</Link>
        </div>
      </header>

      <section style={body}>
        <div style={intro}>
          <div>
            <div style={eyebrow}>WHERE THE WORK HAPPENS</div>
            <h1 style={heading}>Location Breakdown Structure</h1>
            <p style={description}>Define the shared physical hierarchy used by RitsuCAD, PreCon, FieldOp, production control, workforce and reporting. These are the project&apos;s authoritative locations.</p>
          </div>
          <div style={concept}>
            <span><b>Scope</b> = WHAT</span>
            <span style={arrow}>→</span>
            <span><b>LBS</b> = WHERE</span>
            <span style={arrow}>→</span>
            <span><b>RitsuCAD</b> = WHERE ON THE DRAWING</span>
          </div>
        </div>

        {loadError ? (
          <div style={errorBox}>Some Location Breakdown data could not be loaded: {loadError.message}</div>
        ) : null}

        <div id="lbs-workspace" style={workspace}>
          <LocationWorkspace
            projectId={project.id}
            projectName={project.name}
            projectCode={project.project_id || project.code || ''}
            userId={user.id}
            initialLocations={locationsResult.data || []}
            scopeItems={services}
            allocations={allocationsResult.data || []}
          />
        </div>

        <style>{`
          html, body {
            height: 100%;
            overflow: hidden !important;
          }

          #lbs-workspace {
            overscroll-behavior: contain;
            scrollbar-gutter: stable;
          }

          #lbs-workspace label:has(input[type="number"]) {
            display: none !important;
          }
        `}</style>
      </section>
    </main>
  )
}

const shell={height:'100vh',overflow:'hidden',background:'#f4f8fa',color:'#082f43',fontFamily:'Arial,sans-serif',display:'flex',flexDirection:'column'}
const header={height:68,flex:'0 0 68px',boxSizing:'border-box',background:'#063247',display:'flex',alignItems:'center',padding:'0 28px',gap:12,color:'#fff',zIndex:1000}
const brand={width:210,height:68,boxSizing:'border-box',display:'flex',alignItems:'center',paddingRight:20,marginRight:4,borderRight:'1px solid rgba(255,255,255,.18)'}
const titleBlock={minWidth:0,flex:1}
const title={fontSize:23,fontWeight:800,lineHeight:1}
const subtitle={fontSize:11,opacity:.8,marginTop:4}
const headerActions={display:'flex',alignItems:'center',gap:9}
const baseButton={height:38,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:8,padding:'0 14px',fontWeight:800,fontSize:12,textDecoration:'none',whiteSpace:'nowrap'}
const recordButton={...baseButton,color:'#fff',border:'1px solid rgba(255,255,255,.28)'}
const scopeButton={...baseButton,color:'#ddecff',border:'1px solid #4d92dd',background:'#1b5f9f'}
const preconButton={...baseButton,color:'#fff',border:'1px solid #2f86ee',background:'#2f86ee'}
const body={width:'100%',maxWidth:1800,margin:'0 auto',padding:'18px 24px 24px',boxSizing:'border-box',flex:1,minHeight:0,display:'flex',flexDirection:'column',overflow:'hidden'}
const intro={display:'flex',alignItems:'flex-end',justifyContent:'space-between',gap:24,marginBottom:14,flex:'0 0 auto'}
const eyebrow={fontSize:10,fontWeight:900,letterSpacing:'1.4px',color:'#079a9a'}
const heading={margin:'4px 0 5px',fontSize:24,lineHeight:1.1}
const description={margin:0,maxWidth:820,color:'#607784',fontSize:12.5,lineHeight:1.5}
const concept={display:'flex',alignItems:'center',gap:8,padding:'10px 13px',border:'1px solid #d7e3e8',borderRadius:8,background:'#fff',fontSize:10.5,color:'#486879',whiteSpace:'nowrap'}
const arrow={color:'#079a9a',fontWeight:900}
const workspace={background:'#fff',border:'1px solid #d7e3e8',borderRadius:9,boxShadow:'0 1px 5px rgba(7,47,67,.03)',overflowY:'auto',overflowX:'hidden',flex:1,minHeight:0}
const errorBox={marginBottom:12,padding:'10px 12px',border:'1px solid #efb0b0',background:'#fff3f3',color:'#a61b1b',borderRadius:7,fontWeight:700,fontSize:12,flex:'0 0 auto'}
