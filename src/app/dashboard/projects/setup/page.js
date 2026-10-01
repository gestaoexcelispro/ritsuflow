import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'
import { resolveProjectCopy } from '../../../../i18n/projectServerCopy'

import ProjectForm from './ProjectForm'
import ScopeWorkspace from './ScopeWorkspace'
import LocationWorkspace from './LocationWorkspace'
import QuantityAllocationMatrix from './QuantityAllocationMatrix'
import ProductionParametersWorkspace from './ProductionParametersWorkspace'

import styles from './project-setup.module.css'
import selectorStyles from './selector.module.css'

export const dynamic = 'force-dynamic'

const SECTION_IDS = new Set(['general', 'scope', 'locations', 'allocation', 'production'])

function createSuggestedCode(projects) {
  const highestNumber = projects.reduce((currentHighest, project) => {
    const match = project.code?.match(/^RF-(\d+)$/)
    return match ? Math.max(currentHighest, Number(match[1])) : currentHighest
  }, 0)
  return `RF-${String(highestNumber + 1).padStart(4, '0')}`
}

function normalizeSection(value) {
  return typeof value === 'string' && SECTION_IDS.has(value) ? value : 'general'
}

function getAllocationStatus(scopeQuantity, allocatedQuantity) {
  if (scopeQuantity === null || scopeQuantity === undefined) return 'quantity_missing'
  const scope = Number(scopeQuantity)
  const allocated = Number(allocatedQuantity || 0)
  if (Math.abs(allocated - scope) <= 0.000001) return 'fully_allocated'
  if (allocated === 0) return 'not_allocated'
  if (allocated < scope) return 'partially_allocated'
  return 'overallocated'
}

function getAllocationStatusClass(status) {
  if (status === 'fully_allocated') return styles.statusSuccess
  if (status === 'partially_allocated' || status === 'not_allocated') return styles.statusWarning
  if (status === 'overallocated') return styles.statusDanger
  return styles.statusNeutral
}

export default async function ProjectSetupPage({ searchParams }) {
  const resolvedSearchParams = await searchParams
  const rawProjectId = resolvedSearchParams?.projectId
  const rawMode = resolvedSearchParams?.mode
  const rawSection = resolvedSearchParams?.section
  const projectId = Array.isArray(rawProjectId) ? rawProjectId[0] : rawProjectId
  const mode = Array.isArray(rawMode) ? rawMode[0] : rawMode
  const requestedSection = Array.isArray(rawSection) ? rawSection[0] : rawSection
  const activeSection = normalizeSection(requestedSection)
  const isCreateMode = mode === 'new' && !projectId

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const i18n = await resolveProjectCopy(supabase, user.id)
  const { locale, text, statusLabels, formatQuantity, formatProjectCount, formatLocation, allocationStatusLabel } = i18n

  const { data: organization, error: organizationError } = await supabase
    .from('organizations')
    .select('id, name')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (organizationError || !organization) {
    console.error('RitsuFlow organization could not be loaded.', organizationError)
    return (
      <div className={styles.container}>
        <div className={styles.errorPanel}>
          <h1 className={styles.errorTitle}>{text('organizationUnavailable')}</h1>
          <p className={styles.errorDescription}>{text('organizationUnavailableHelp')}</p>
          <Link href="/dashboard" className={styles.backLink}>{text('returnOverview')}</Link>
        </div>
      </div>
    )
  }

  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select(`id, code, name, client_name, status, city, state_region, country_code, proposal_number, contract_number, contract_value, currency_code, planned_start_date, planned_finish_date, address_line, neighborhood, postal_code, cover_image_path, latitude, longitude, geofence_radius_m, geofence_enabled, max_gps_accuracy_m`)
    .eq('organization_id', organization.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (projectsError) console.error('RitsuFlow projects could not be loaded.', projectsError)
  const projects = projectsData || []
  let selectedProject = null

  if (projectId) {
    selectedProject = projects.find(project => project.id === projectId) || null
    if (!selectedProject) {
      return (
        <div className={styles.container}>
          <div className={styles.errorPanel}>
            <h1 className={styles.errorTitle}>{text('projectUnavailable')}</h1>
            <p className={styles.errorDescription}>{text('projectUnavailableHelp')}</p>
            <Link href="/dashboard/projects/setup" className={styles.backLink}>{text('selectAnotherProject')}</Link>
          </div>
        </div>
      )
    }
  }

  const suggestedCode = createSuggestedCode(projects)

  if (!selectedProject && !isCreateMode) {
    return (
      <div className={styles.container}>
        <section className={styles.heading}>
          <div className={styles.headingContent}>
            <p className={styles.eyebrow}>{text('projectDefinition')}</p>
            <h1 className={styles.title}>{text('projectSetup')}</h1>
            <p className={styles.description}>{text('projectSetupIntro')}</p>
          </div>
          <Link href="/dashboard/projects" className={styles.backLink}>← {text('backProjects')}</Link>
        </section>

        <div className={styles.contextBar}>
          <div className={styles.contextIdentity}>
            <span className={styles.contextIcon}>OR</span>
            <div>
              <p className={styles.contextLabel}>{text('organization')}</p>
              <p className={styles.contextValue}>{organization.name}</p>
            </div>
          </div>
          <span className={styles.contextMode}>{formatProjectCount(projects.length)}</span>
        </div>

        <article className={styles.formPanel}>
          <div className={`${styles.formHeader} ${selectorStyles.selectorHeader}`}>
            <div>
              <h2 className={styles.formTitle}>{text('selectProject')}</h2>
              <p className={styles.formDescription}>{text('selectProjectHelp')}</p>
            </div>
            <Link href="/dashboard/projects/setup?mode=new" className={styles.primaryButton}>+ {text('createNewProject')}</Link>
          </div>

          {projects.length === 0 ? (
            <div className={selectorStyles.emptyState}>
              <h3 className={selectorStyles.emptyTitle}>{text('noProjectsAvailable')}</h3>
              <p className={selectorStyles.emptyDescription}>{text('createFirstHelp')}</p>
              <Link href="/dashboard/projects/setup?mode=new" className={styles.primaryButton}>{text('createFirstProject')}</Link>
            </div>
          ) : (
            <div className={styles.section}>
              <div className={selectorStyles.projectList}>
                {projects.map(project => (
                  <article className={selectorStyles.projectCard} key={project.id}>
                    <span className={selectorStyles.projectCode}>{project.code || text('unassigned')}</span>
                    <div className={selectorStyles.projectIdentity}>
                      <span className={selectorStyles.projectName}>{project.name}</span>
                      <span className={selectorStyles.projectLocation}>{formatLocation(project)}</span>
                    </div>
                    <span className={selectorStyles.projectClient}>{project.client_name || text('clientNotSpecified')}</span>
                    <span className={selectorStyles.projectStatus}>{statusLabels[project.status] || project.status}</span>
                    <Link href={`/dashboard/projects/setup?projectId=${project.id}&section=general`} className={selectorStyles.configureLink}>{text('configure')} →</Link>
                  </article>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    )
  }

  if (isCreateMode) {
    return (
      <div className={styles.container}>
        <section className={styles.heading}>
          <div className={styles.headingContent}>
            <p className={styles.eyebrow}>{text('projectFoundation')}</p>
            <h1 className={styles.title}>{text('createProject')}</h1>
            <p className={styles.description}>{text('createProjectIntro')}</p>
          </div>
          <Link href="/dashboard/projects/setup" className={styles.backLink}>← {text('selectProject')}</Link>
        </section>
        <ProjectForm organizationId={organization.id} organizationName={organization.name} userId={user.id} project={null} suggestedCode={suggestedCode} locale={locale} />
      </div>
    )
  }

  const [workPackagesResult, scopeItemsResult, locationsResult, allocationsResult, productivityResult] = await Promise.all([
    supabase.from('project_work_packages').select(`id, project_id, code, description, color, is_active`).eq('project_id', selectedProject.id).order('code', { ascending: true }),
    supabase.from('project_services').select(`id, project_id, project_work_package_id, service_code, service_name, unit, scope_quantity, unit_cost, sequence_number, is_active`).eq('project_id', selectedProject.id).order('sequence_number', { ascending: true }),
    supabase.from('locations').select(`id, project_id, parent_id, name, location_type, environment_type, sequence_number, created_at, updated_at`).eq('project_id', selectedProject.id).order('sequence_number', { ascending: true }),
    supabase.from('location_service_quantities').select(`id, project_id, location_id, service_id, quantity, source_scope_item_id, created_at, updated_at`).eq('project_id', selectedProject.id),
    supabase.from('project_service_production_parameters').select(`id, project_id, service_id, productivity_rate, quantity_unit, productivity_basis, effective_workforce, created_at, updated_at`).eq('project_id', selectedProject.id),
  ])

  if (workPackagesResult.error) console.error('Work Packages could not be loaded.', workPackagesResult.error)
  if (scopeItemsResult.error) console.error('Scope Items could not be loaded.', scopeItemsResult.error)
  if (locationsResult.error) console.error('Locations could not be loaded.', locationsResult.error)
  if (allocationsResult.error) console.error('Scope allocations could not be loaded.', allocationsResult.error)
  if (productivityResult.error) console.error('Production parameters could not be loaded.', productivityResult.error)

  const workPackages = workPackagesResult.data || []
  const scopeItems = scopeItemsResult.data || []
  const activeWorkPackages = workPackages.filter(workPackage => workPackage.is_active !== false)
  const activeScopeItems = scopeItems.filter(scopeItem => scopeItem.is_active !== false)
  const locations = locationsResult.data || []
  const allocations = allocationsResult.data || []
  const productivityRecords = productivityResult.data || []

  const allocatedByScopeItem = new Map()
  allocations.forEach(allocation => {
    allocatedByScopeItem.set(allocation.service_id, (allocatedByScopeItem.get(allocation.service_id) || 0) + Number(allocation.quantity || 0))
  })

  const reconciliation = activeScopeItems.map(scopeItem => {
    const allocatedQuantity = allocatedByScopeItem.get(scopeItem.id) || 0
    const status = getAllocationStatus(scopeItem.scope_quantity, allocatedQuantity)
    const scopeQuantity = scopeItem.scope_quantity === null || scopeItem.scope_quantity === undefined ? null : Number(scopeItem.scope_quantity)
    const unallocatedQuantity = scopeQuantity === null ? null : scopeQuantity - allocatedQuantity
    const allocationPercentage = scopeQuantity === null || scopeQuantity === 0 ? null : (allocatedQuantity / scopeQuantity) * 100
    return { ...scopeItem, allocated_quantity: allocatedQuantity, unallocated_quantity: unallocatedQuantity, allocation_percentage: allocationPercentage, allocation_status: status }
  })

  const countStatus = status => reconciliation.filter(item => item.allocation_status === status).length
  const fullyAllocatedCount = countStatus('fully_allocated')
  const partiallyAllocatedCount = countStatus('partially_allocated')
  const notAllocatedCount = countStatus('not_allocated')
  const overallocatedCount = countStatus('overallocated')
  const quantityMissingCount = countStatus('quantity_missing')

  return (
    <div className={styles.container}>
      {activeSection === 'general' && (
        <ProjectForm organizationId={organization.id} organizationName={organization.name} userId={user.id} project={selectedProject} suggestedCode={suggestedCode} locale={locale} />
      )}

      {activeSection === 'scope' && (
        <ScopeWorkspace projectId={selectedProject.id} userId={user.id} initialWorkPackages={workPackages} initialScopeItems={scopeItems} currencyCode={selectedProject.currency_code || 'USD'} locale={locale} />
      )}

      {activeSection === 'locations' && (
        <LocationWorkspace projectId={selectedProject.id} projectName={selectedProject.name} projectCode={selectedProject.code} userId={user.id} initialLocations={locations} scopeItems={activeScopeItems} allocations={allocations} locale={locale} />
      )}

      {activeSection === 'allocation' && (
        <>
          <section className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>{text('fullyAllocated')}</span>
              <strong className={styles.metricValue}>{fullyAllocatedCount}</strong>
              <span className={styles.metricDetail}>{text('scopeItems')}</span>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>{text('partiallyAllocated')}</span>
              <strong className={styles.metricValue}>{partiallyAllocatedCount}</strong>
              <span className={styles.metricDetail}>{text('scopeItems')}</span>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>{text('notAllocated')}</span>
              <strong className={styles.metricValue}>{notAllocatedCount}</strong>
              <span className={styles.metricDetail}>{text('scopeItems')}</span>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>{text('overallocated')}</span>
              <strong className={styles.metricValue}>{overallocatedCount}</strong>
              <span className={styles.metricDetail}>{text('requireCorrection')}</span>
            </article>
          </section>

          {quantityMissingCount > 0 && (
            <div className={styles.scopeWorkspaceError}>
              {text('quantityMissingItems', { count: quantityMissingCount, itemLabel: quantityMissingCount === 1 ? text('itemDoes') : text('itemsDo') })}
            </div>
          )}

          <section className={styles.formPanel}>
            <div className={styles.formHeader}>
              <h2 className={styles.formTitle}>{text('quantityReconciliation')}</h2>
              <p className={styles.formDescription}>{text('reconciliationHelp')}</p>
            </div>

            {reconciliation.length === 0 ? (
              <div className={styles.workspaceEmpty}>
                <span className={styles.workspaceEmptyIcon}>%</span>
                <h3>{text('noAllocationData')}</h3>
                <p>{text('allocationEmptyHelp')}</p>
              </div>
            ) : (
              <div className={styles.reconciliationTable}>
                <div className={styles.reconciliationHeader}>
                  <span>{text('scopeItem')}</span>
                  <span>{text('scopeQty')}</span>
                  <span>{text('allocated')}</span>
                  <span>{text('unallocated')}</span>
                  <span>{text('allocation')}</span>
                  <span>{text('status')}</span>
                </div>
                {reconciliation.map(item => (
                  <div className={styles.reconciliationRow} key={item.id}>
                    <div className={styles.reconciliationIdentity}>
                      <strong>{item.service_name}</strong>
                      <span>{item.service_code || text('scopeItem')}</span>
                    </div>
                    <span>{formatQuantity(item.scope_quantity)}</span>
                    <span>{formatQuantity(item.allocated_quantity)}</span>
                    <span>{formatQuantity(item.unallocated_quantity)}</span>
                    <span>{item.allocation_percentage === null || item.allocation_percentage === undefined ? '—' : `${formatQuantity(item.allocation_percentage)}%`}</span>
                    <span className={[styles.reconciliationStatus, getAllocationStatusClass(item.allocation_status)].join(' ')}>{allocationStatusLabel(item.allocation_status)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <QuantityAllocationMatrix projectId={selectedProject.id} projectCode={selectedProject.code} userId={user.id} locations={locations} scopeItems={activeScopeItems} initialAllocations={allocations} locale={locale} />
        </>
      )}

      {activeSection === 'production' && (
        <ProductionParametersWorkspace projectId={selectedProject.id} projectCode={selectedProject.code} userId={user.id} workPackages={activeWorkPackages} scopeItems={activeScopeItems} initialParameters={productivityRecords} locale={locale} />
      )}
    </div>
  )
}
