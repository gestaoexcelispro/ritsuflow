import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'
import StandaloneLocationWorkspace from './StandaloneLocationWorkspace'

export const dynamic = 'force-dynamic'

export default async function LocationBreakdownPage({ params }) {
  const { projectId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [projectResult, locationsResult, scopesResult, activitiesResult, allocationsResult] = await Promise.all([
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
      .from('project_scopes')
      .select('id, project_id, parent_scope_id, scope_code, scope_name, item_type, unit, quantity, status')
      .eq('project_id', projectId),
    supabase
      .from('scope_activities')
      .select('id, scope_id, activity_name, wall_side, quantity, unit, notes, sequence')
      .order('sequence', { ascending: true }),
    supabase
      .from('location_service_quantities')
      .select('id, project_id, location_id, service_id, quantity, source_scope_item_id, created_at, updated_at')
      .eq('project_id', projectId),
  ])

  const project = projectResult.data
  if (!project) redirect('/projects')

  const projectScopes = scopesResult.data || []
  const projectScopeIds = new Set(projectScopes.map((item) => item.id))
  const scopeById = new Map(projectScopes.map((item) => [item.id, item]))

  // Scope Management is the canonical source. Scope Allocation consumes its
  // production activities directly instead of maintaining a parallel service list.
  const scopeItems = (activitiesResult.data || [])
    .filter((activity) => projectScopeIds.has(activity.scope_id))
    .map((activity) => {
      const scope = scopeById.get(activity.scope_id)
      return {
        id: activity.id,
        project_id: projectId,
        project_work_package_id: activity.scope_id,
        service_code: scope?.scope_code || '',
        service_name: activity.activity_name,
        unit: activity.unit || scope?.unit || '',
        scope_quantity: activity.quantity,
        sequence_number: activity.sequence || 0,
        is_active: scope?.status !== 'cancelled',
        source_scope_item_id: activity.id,
        scope_name: scope?.scope_name || '',
        wall_side: activity.wall_side || null,
      }
    })
    .filter((item) => item.is_active !== false)

  const loadError = projectResult.error || locationsResult.error || scopesResult.error || activitiesResult.error || allocationsResult.error

  return (
    <main style={shell}>
      <header style={header}>
        <Link href="/workspaces" style={brand}>
          <Image src="/logo-white.png" alt="RitsuFlow" width={132} height={48} priority />
        </Link>
        <div style={titleBlock}>
          <div style={subtitle}>{project.project_id || project.code || 'Project'} · {project.name}</div>
          <div style={title}>Location Breakdown</div>
        </div>
        <div style={headerActions}>
          <Link href={`/projects/${projectId}`} style={recordButton}>← Project Record</Link>
          <Link href={`/projects/${projectId}/scope`} style={scopeButton}>Scope Management</Link>
          <Link href={`/planning/pre-planning?projectId=${projectId}`} style={preconButton}>Continue to PreCon →</Link>
        </div>
      </header>

      <section style={body}>
        {loadError ? (
          <div style={errorBox}>Some Location Breakdown data could not be loaded: {loadError.message}</div>
        ) : null}

        <div id="lbs-workspace" style={workspace}>
          <StandaloneLocationWorkspace
            projectId={project.id}
            projectName={project.name}
            projectCode={project.project_id || project.code || ''}
            userId={user.id}
            initialLocations={locationsResult.data || []}
            scopeItems={scopeItems}
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
          }
        `}</style>
      </section>
    </main>
  )
}

const shell={height:'100vh',overflow:'hidden',background:'#f4f8fa',color:'#082f43',fontFamily:'Arial,sans-serif',display:'flex',flexDirection:'column'}
const header={height:78,flex:'0 0 78px',boxSizing:'border-box',background:'#063247',display:'flex',alignItems:'center',padding:'0 28px',gap:18,color:'#fff',zIndex:1000}
const brand={width:210,height:78,boxSizing:'border-box',display:'flex',alignItems:'center',paddingRight:20,marginRight:0,borderRight:'1px solid rgba(255,255,255,.18)'}
const titleBlock={minWidth:0,flex:1}
const title={fontSize:24,fontWeight:850,lineHeight:1.05,marginTop:4}
const subtitle={fontSize:11,opacity:.82}
const headerActions={display:'flex',alignItems:'center',gap:9}
const baseButton={height:44,boxSizing:'border-box',display:'flex',alignItems:'center',justifyContent:'center',borderRadius:9,padding:'0 16px',fontWeight:800,fontSize:12,textDecoration:'none',whiteSpace:'nowrap'}
const recordButton={...baseButton,color:'#fff',border:'1px solid rgba(255,255,255,.28)'}
const scopeButton={...baseButton,color:'#fff',border:'1px solid #4d92dd',background:'#1b5f9f'}
const preconButton={...baseButton,color:'#fff',border:'1px solid #2f86ee',background:'#2f86ee'}
const body={width:'100%',maxWidth:1800,margin:'0 auto',padding:'18px 24px 22px',boxSizing:'border-box',flex:1,minHeight:0,display:'flex',flexDirection:'column',overflow:'hidden'}
const workspace={flex:1,minHeight:0,overflow:'hidden'}
const errorBox={marginBottom:12,padding:'10px 12px',border:'1px solid #efb0b0',background:'#fff3f3',color:'#a61b1b',borderRadius:7,fontWeight:700,fontSize:12,flex:'0 0 auto'}
