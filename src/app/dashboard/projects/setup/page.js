import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'

import ProjectForm from '../../projetos/coleta/ProjectForm'

import styles from '../../projetos/coleta/project-setup.module.css'
import selectorStyles from './selector.module.css'

export const dynamic = 'force-dynamic'


// ============================================================
// PROJECT SETUP
//
// Unified project-definition workspace:
//
// General
// → Scope
// → Locations
// → Allocation
// → Production Parameters
//
// Planning should consume this project definition rather than
// independently creating project scope.
// ============================================================


const statusLabels = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
}


const setupSections = [
  {
    id: 'general',
    number: '01',
    label: 'General',
    description: 'Project identity and contractual information.',
  },
  {
    id: 'scope',
    number: '02',
    label: 'Scope',
    description: 'Define the Scope Breakdown Structure.',
  },
  {
    id: 'locations',
    number: '03',
    label: 'Locations',
    description: 'Define the physical production hierarchy.',
  },
  {
    id: 'allocation',
    number: '04',
    label: 'Allocation',
    description: 'Allocate project scope across production locations.',
  },
  {
    id: 'production',
    number: '05',
    label: 'Production Parameters',
    description: 'Define productivity and production sizing parameters.',
  },
]


function createSuggestedCode(projects) {
  const highestNumber = projects.reduce(
    (currentHighest, project) => {
      const match = project.code?.match(/^RF-(\d+)$/)

      if (!match) {
        return currentHighest
      }

      return Math.max(
        currentHighest,
        Number(match[1])
      )
    },
    0
  )

  return `RF-${String(
    highestNumber + 1
  ).padStart(4, '0')}`
}


function formatLocation(project) {
  const locationParts = [
    project.city,
    project.state_region,
  ].filter(Boolean)

  if (locationParts.length > 0) {
    return locationParts.join(', ')
  }

  return (
    project.country_code ||
    'Location not specified'
  )
}


function normalizeSection(value) {
  const validSections = new Set(
    setupSections.map((section) => section.id)
  )

  if (
    typeof value === 'string' &&
    validSections.has(value)
  ) {
    return value
  }

  return 'general'
}


function formatQuantity(value) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '—'
  }

  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return String(value)
  }

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue)
}


function getAllocationStatusLabel(status) {
  const labels = {
    scope_quantity_missing: 'Quantity missing',
    not_allocated: 'Not allocated',
    partially_allocated: 'Partially allocated',
    fully_allocated: 'Fully allocated',
    overallocated: 'Overallocated',
  }

  return labels[status] || status || 'Not evaluated'
}


function getAllocationStatusClass(status) {
  if (status === 'fully_allocated') {
    return styles.statusSuccess
  }

  if (
    status === 'partially_allocated' ||
    status === 'not_allocated'
  ) {
    return styles.statusWarning
  }

  if (status === 'overallocated') {
    return styles.statusDanger
  }

  return styles.statusNeutral
}


export default async function ProjectSetupPage({
  searchParams,
}) {
  const resolvedSearchParams =
    await searchParams

  const rawProjectId =
    resolvedSearchParams?.projectId

  const rawMode =
    resolvedSearchParams?.mode

  const rawSection =
    resolvedSearchParams?.section

  const projectId = Array.isArray(
    rawProjectId
  )
    ? rawProjectId[0]
    : rawProjectId

  const mode = Array.isArray(rawMode)
    ? rawMode[0]
    : rawMode

  const requestedSection = Array.isArray(
    rawSection
  )
    ? rawSection[0]
    : rawSection

  const activeSection =
    normalizeSection(requestedSection)

  const isCreateMode =
    mode === 'new' && !projectId

  const supabase =
    await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }


  // ==========================================================
  // ORGANIZATION
  // ==========================================================

  const {
    data: organization,
    error: organizationError,
  } = await supabase
    .from('organizations')
    .select('id, name')
    .order('created_at', {
      ascending: true,
    })
    .limit(1)
    .maybeSingle()

  if (
    organizationError ||
    !organization
  ) {
    console.error(
      'RitsuFlow organization could not be loaded.',
      organizationError
    )

    return (
      <div className={styles.container}>
        <div className={styles.errorPanel}>
          <h1 className={styles.errorTitle}>
            Organization unavailable
          </h1>

          <p className={styles.errorDescription}>
            The project workspace could not identify
            an organization for your account.
          </p>

          <Link
            href="/dashboard"
            className={styles.backLink}
          >
            Return to overview
          </Link>
        </div>
      </div>
    )
  }


  // ==========================================================
  // PROJECTS
  // ==========================================================

  const {
    data: projectsData,
    error: projectsError,
  } = await supabase
    .from('projects')
    .select(`
      id,
      code,
      name,
      client_name,
      status,
      city,
      state_region,
      country_code,
      proposal_number,
      contract_number,
      contract_value,
      currency_code,
      planned_start_date,
      planned_finish_date,
      address_line,
      neighborhood,
      postal_code,
      cover_image_path,
      latitude,
      longitude,
      geofence_radius_m,
      geofence_enabled,
      max_gps_accuracy_m
    `)
    .eq(
      'organization_id',
      organization.id
    )
    .neq('status', 'archived')
    .order('created_at', {
      ascending: false,
    })

  if (projectsError) {
    console.error(
      'RitsuFlow projects could not be loaded.',
      projectsError
    )
  }

  const projects =
    projectsData || []

  let selectedProject = null

  if (projectId) {
    selectedProject =
      projects.find(
        (project) =>
          project.id === projectId
      ) || null

    if (!selectedProject) {
      return (
        <div className={styles.container}>
          <div className={styles.errorPanel}>
            <h1 className={styles.errorTitle}>
              Project unavailable
            </h1>

            <p className={styles.errorDescription}>
              The requested project does not exist
              or your account cannot access it.
            </p>

            <Link
              href="/dashboard/projects/setup"
              className={styles.backLink}
            >
              Select another project
            </Link>
          </div>
        </div>
      )
    }
  }


  const suggestedCode =
    createSuggestedCode(projects)


  // ==========================================================
  // PROJECT SELECTOR
  // ==========================================================

  if (
    !selectedProject &&
    !isCreateMode
  ) {
    return (
      <div className={styles.container}>
        <section className={styles.heading}>
          <div className={styles.headingContent}>
            <p className={styles.eyebrow}>
              Project definition
            </p>

            <h1 className={styles.title}>
              Project Setup
            </h1>

            <p className={styles.description}>
              Select a project to define its identity,
              scope, production locations, scope
              allocation, and production parameters
              before planning begins.
            </p>
          </div>

          <Link
            href="/dashboard/projects"
            className={styles.backLink}
          >
            ← Back to projects
          </Link>
        </section>

        <div className={styles.contextBar}>
          <div className={styles.contextIdentity}>
            <span className={styles.contextIcon}>
              OR
            </span>

            <div>
              <p className={styles.contextLabel}>
                Organization
              </p>

              <p className={styles.contextValue}>
                {organization.name}
              </p>
            </div>
          </div>

          <span className={styles.contextMode}>
            {projects.length === 1
              ? '1 project'
              : `${projects.length} projects`}
          </span>
        </div>

        <article className={styles.formPanel}>
          <div
            className={`${styles.formHeader} ${selectorStyles.selectorHeader}`}
          >
            <div>
              <h2 className={styles.formTitle}>
                Select a project
              </h2>

              <p className={styles.formDescription}>
                Choose the project whose definition
                you want to review or update.
              </p>
            </div>

            <Link
              href="/dashboard/projects/setup?mode=new"
              className={styles.primaryButton}
            >
              + Create new project
            </Link>
          </div>

          {projects.length === 0 ? (
            <div className={selectorStyles.emptyState}>
              <h3 className={selectorStyles.emptyTitle}>
                No projects available.
              </h3>

              <p className={selectorStyles.emptyDescription}>
                Create the first project before
                defining its scope and production
                structure.
              </p>

              <Link
                href="/dashboard/projects/setup?mode=new"
                className={styles.primaryButton}
              >
                Create first project
              </Link>
            </div>
          ) : (
            <div className={styles.section}>
              <div className={selectorStyles.projectList}>
                {projects.map((project) => (
                  <article
                    className={selectorStyles.projectCard}
                    key={project.id}
                  >
                    <span className={selectorStyles.projectCode}>
                      {project.code || 'Unassigned'}
                    </span>

                    <div className={selectorStyles.projectIdentity}>
                      <span className={selectorStyles.projectName}>
                        {project.name}
                      </span>

                      <span className={selectorStyles.projectLocation}>
                        {formatLocation(project)}
                      </span>
                    </div>

                    <span className={selectorStyles.projectClient}>
                      {project.client_name ||
                        'Client not specified'}
                    </span>

                    <span className={selectorStyles.projectStatus}>
                      {statusLabels[
                        project.status
                      ] || project.status}
                    </span>

                    <Link
                      href={`/dashboard/projects/setup?projectId=${project.id}&section=general`}
                      className={selectorStyles.configureLink}
                    >
                      Configure →
                    </Link>
                  </article>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>
    )
  }


  // ==========================================================
  // PROJECT CREATION
  // ==========================================================

  if (isCreateMode) {
    return (
      <div className={styles.container}>
        <section className={styles.heading}>
          <div className={styles.headingContent}>
            <p className={styles.eyebrow}>
              Project foundation
            </p>

            <h1 className={styles.title}>
              Create Project
            </h1>

            <p className={styles.description}>
              Establish the project identity,
              contractual information, planned
              boundaries, geographic information,
              and project cover image.
            </p>
          </div>

          <Link
            href="/dashboard/projects/setup"
            className={styles.backLink}
          >
            ← Select project
          </Link>
        </section>

        <ProjectForm
          organizationId={organization.id}
          organizationName={organization.name}
          userId={user.id}
          project={null}
          suggestedCode={suggestedCode}
        />
      </div>
    )
  }


  // ==========================================================
  // PROJECT DEFINITION DATA
  // ==========================================================

  const [
    scopeCompletenessResult,
    allocationStatusResult,
    workPackagesResult,
    scopeItemsResult,
    locationsResult,
    productivityResult,
    reconciliationResult,
  ] = await Promise.all([
    supabase
      .from('project_scope_definition_completeness')
      .select(`
        project_id,
        total_scope_items,
        work_package_assigned_items,
        work_package_unassigned_items,
        quantity_defined_items,
        quantity_missing_items,
        scope_definition_complete
      `)
      .eq('project_id', selectedProject.id)
      .maybeSingle(),

    supabase
      .from('project_scope_allocation_status')
      .select(`
        project_id,
        total_scope_items,
        quantity_missing_items,
        not_allocated_items,
        partially_allocated_items,
        fully_allocated_items,
        overallocated_items,
        allocation_complete
      `)
      .eq('project_id', selectedProject.id)
      .maybeSingle(),

    supabase
      .from('project_work_packages')
      .select(`
        id,
        project_id,
        code,
        description,
        color,
        is_active
      `)
      .eq('project_id', selectedProject.id)
      .eq('is_active', true)
      .order('code', {
        ascending: true,
      }),

    supabase
      .from('project_services')
      .select(`
        id,
        project_id,
        project_work_package_id,
        service_code,
        service_name,
        unit,
        scope_quantity,
        sequence_number,
        is_active
      `)
      .eq('project_id', selectedProject.id)
      .eq('is_active', true)
      .order('sequence_number', {
        ascending: true,
      })
      .order('service_name', {
        ascending: true,
      }),

    supabase
      .from('locations')
      .select(`
        id,
        project_id,
        location_type
      `)
      .eq('project_id', selectedProject.id),

    supabase
      .from('project_service_productivity')
      .select(`
        id,
        project_id,
        division_location_id,
        service_id,
        productivity_rate,
        effective
      `)
      .eq('project_id', selectedProject.id),

    supabase
      .from('project_scope_quantity_reconciliation')
      .select(`
        project_id,
        scope_item_id,
        project_work_package_id,
        work_package_code,
        work_package_description,
        scope_quantity,
        allocated_quantity,
        unallocated_quantity,
        allocation_count,
        allocation_percentage,
        allocation_status
      `)
      .eq('project_id', selectedProject.id),
  ])


  const scopeCompleteness =
    scopeCompletenessResult.data || null

  const allocationStatus =
    allocationStatusResult.data || null

  const workPackages =
    workPackagesResult.data || []

  const scopeItems =
    scopeItemsResult.data || []

  const locations =
    locationsResult.data || []

  const productivityRecords =
    productivityResult.data || []

  const reconciliation =
    reconciliationResult.data || []


  // ==========================================================
  // PROJECT SETUP METRICS
  // ==========================================================

  const totalScopeItems =
    scopeCompleteness?.total_scope_items ??
    scopeItems.length

  const quantityDefinedItems =
    scopeCompleteness?.quantity_defined_items ??
    scopeItems.filter(
      (item) =>
        item.scope_quantity !== null &&
        item.scope_quantity !== undefined
    ).length

  const workPackageAssignedItems =
    scopeCompleteness?.work_package_assigned_items ??
    scopeItems.filter(
      (item) =>
        Boolean(item.project_work_package_id)
    ).length

  const locationCount =
    locations.length

  const productionLocationCount =
    locations.filter(
      (location) =>
        location.location_type === 'area' ||
        location.location_type === 'room' ||
        location.location_type === 'custom'
    ).length

  const scopeComplete =
    scopeCompleteness?.scope_definition_complete === true

  const allocationComplete =
    allocationStatus?.allocation_complete === true

  const locationsComplete =
    productionLocationCount > 0

  const productionParametersComplete =
    totalScopeItems > 0 &&
    productivityRecords.length >= totalScopeItems

  const projectReadyForPlanning =
    scopeComplete &&
    locationsComplete &&
    allocationComplete


  const workPackageMap =
    new Map(
      workPackages.map(
        (workPackage) => [
          workPackage.id,
          workPackage,
        ]
      )
    )


  const scopeItemsByWorkPackage =
    new Map()

  scopeItems.forEach((scopeItem) => {
    const key =
      scopeItem.project_work_package_id ||
      'unassigned'

    if (!scopeItemsByWorkPackage.has(key)) {
      scopeItemsByWorkPackage.set(key, [])
    }

    scopeItemsByWorkPackage
      .get(key)
      .push(scopeItem)
  })


  const reconciliationMap =
    new Map(
      reconciliation.map(
        (item) => [
          item.scope_item_id,
          item,
        ]
      )
    )


  // ==========================================================
  // SECTION URL
  // ==========================================================

  function sectionHref(sectionId) {
    return (
      `/dashboard/projects/setup?projectId=${selectedProject.id}` +
      `&section=${sectionId}`
    )
  }


  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <div className={styles.container}>
      <section className={styles.heading}>
        <div className={styles.headingContent}>
          <p className={styles.eyebrow}>
            Project definition
          </p>

          <h1 className={styles.title}>
            Project Setup
          </h1>

          <p className={styles.description}>
            Define what the project is, what must
            be delivered, where production will
            occur, and how the scope is distributed
            before planning begins.
          </p>
        </div>

        <Link
          href="/dashboard/projects/setup"
          className={styles.backLink}
        >
          ← Select project
        </Link>
      </section>


      {/* ======================================================
          PROJECT CONTEXT
          ====================================================== */}

      <section className={styles.projectContext}>
        <div className={styles.projectContextIdentity}>
          <span className={styles.projectContextCode}>
            {selectedProject.code || 'PROJECT'}
          </span>

          <div>
            <h2 className={styles.projectContextName}>
              {selectedProject.name}
            </h2>

            <p className={styles.projectContextMeta}>
              {selectedProject.client_name ||
                'Client not specified'}

              <span>·</span>

              {formatLocation(selectedProject)}

              <span>·</span>

              {statusLabels[
                selectedProject.status
              ] || selectedProject.status}
            </p>
          </div>
        </div>

        <div className={styles.readinessBlock}>
          <span className={styles.readinessLabel}>
            Ready for Planning
          </span>

          <span
            className={
              projectReadyForPlanning
                ? styles.readinessReady
                : styles.readinessNotReady
            }
          >
            {projectReadyForPlanning
              ? 'READY'
              : 'NOT READY'}
          </span>
        </div>
      </section>


      {/* ======================================================
          WORKFLOW NAVIGATION
          ====================================================== */}

      <nav
        className={styles.setupNavigation}
        aria-label="Project setup sections"
      >
        {setupSections.map((section) => {
          const isActive =
            activeSection === section.id

          let state = 'pending'

          if (section.id === 'general') {
            state = 'complete'
          }

          if (section.id === 'scope') {
            state =
              scopeComplete
                ? 'complete'
                : 'incomplete'
          }

          if (section.id === 'locations') {
            state =
              locationsComplete
                ? 'complete'
                : 'incomplete'
          }

          if (section.id === 'allocation') {
            state =
              allocationComplete
                ? 'complete'
                : 'incomplete'
          }

          if (section.id === 'production') {
            state =
              productionParametersComplete
                ? 'complete'
                : 'pending'
          }

          return (
            <Link
              href={sectionHref(section.id)}
              className={[
                styles.setupTab,
                isActive
                  ? styles.setupTabActive
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              key={section.id}
            >
              <span className={styles.setupTabNumber}>
                {section.number}
              </span>

              <span className={styles.setupTabContent}>
                <span className={styles.setupTabLabel}>
                  {section.label}
                </span>

                <span className={styles.setupTabDescription}>
                  {section.description}
                </span>
              </span>

              <span
                className={[
                  styles.setupTabState,
                  state === 'complete'
                    ? styles.setupTabStateComplete
                    : '',
                  state === 'incomplete'
                    ? styles.setupTabStateIncomplete
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={state}
              >
                {state === 'complete'
                  ? '✓'
                  : state === 'incomplete'
                    ? '!'
                    : '○'}
              </span>
            </Link>
          )
        })}
      </nav>


      {/* ======================================================
          GENERAL
          ====================================================== */}

      {activeSection === 'general' && (
        <>
          <section className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionIntroEyebrow}>
                01 — General
              </p>

              <h2 className={styles.sectionIntroTitle}>
                Project identity and boundaries
              </h2>

              <p className={styles.sectionIntroDescription}>
                Maintain the contractual, geographic,
                scheduling, and identification information
                that defines this project.
              </p>
            </div>
          </section>

          <ProjectForm
            organizationId={organization.id}
            organizationName={organization.name}
            userId={user.id}
            project={selectedProject}
            suggestedCode={suggestedCode}
          />
        </>
      )}


      {/* ======================================================
          SCOPE
          ====================================================== */}

      {activeSection === 'scope' && (
        <>
          <section className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionIntroEyebrow}>
                02 — Scope
              </p>

              <h2 className={styles.sectionIntroTitle}>
                Scope Breakdown Structure
              </h2>

              <p className={styles.sectionIntroDescription}>
                Define what the project must deliver.
                Work Packages organize the project scope,
                while Scope Items carry their own units
                and authoritative quantities.
              </p>
            </div>

            <div className={styles.sectionIntroActions}>
              <Link
                href={`/dashboard/projects/work-packages?projectId=${selectedProject.id}`}
                className={styles.secondaryButton}
              >
                Manage Work Packages
              </Link>
            </div>
          </section>

          <section className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Work Packages
              </span>

              <strong className={styles.metricValue}>
                {workPackages.length}
              </strong>

              <span className={styles.metricDetail}>
                Active scope groups
              </span>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Scope Items
              </span>

              <strong className={styles.metricValue}>
                {totalScopeItems}
              </strong>

              <span className={styles.metricDetail}>
                Project deliverables
              </span>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Package Assignment
              </span>

              <strong className={styles.metricValue}>
                {workPackageAssignedItems}/{totalScopeItems}
              </strong>

              <span className={styles.metricDetail}>
                Items classified
              </span>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Quantities Defined
              </span>

              <strong className={styles.metricValue}>
                {quantityDefinedItems}/{totalScopeItems}
              </strong>

              <span className={styles.metricDetail}>
                Authoritative quantities
              </span>
            </article>
          </section>

          <section className={styles.formPanel}>
            <div className={styles.formHeader}>
              <div>
                <h2 className={styles.formTitle}>
                  Project Scope
                </h2>

                <p className={styles.formDescription}>
                  Work Package quantity is not calculated
                  automatically from its Scope Items because
                  different Scope Items may represent sequential
                  operations over the same physical quantity.
                </p>
              </div>
            </div>

            {scopeItems.length === 0 ? (
              <div className={styles.workspaceEmpty}>
                <span className={styles.workspaceEmptyIcon}>
                  SBS
                </span>

                <h3>No Scope Items defined.</h3>

                <p>
                  The project needs Scope Items before
                  quantities can be allocated across locations.
                </p>
              </div>
            ) : (
              <div className={styles.scopeStructure}>
                {workPackages.map((workPackage, packageIndex) => {
                  const packageItems =
                    scopeItemsByWorkPackage.get(
                      workPackage.id
                    ) || []

                  return (
                    <article
                      className={styles.scopePackage}
                      key={workPackage.id}
                    >
                      <div className={styles.scopePackageHeader}>
                        <div className={styles.scopePackageIdentity}>
                          <span
                            className={styles.scopePackageNumber}
                          >
                            {String(
                              packageIndex + 1
                            ).padStart(2, '0')}
                          </span>

                          <span
                            className={styles.scopePackageColor}
                            style={{
                              backgroundColor:
                                workPackage.color ||
                                '#00a99d',
                            }}
                          />

                          <div>
                            <div className={styles.scopePackageCode}>
                              {workPackage.code}
                            </div>

                            <h3 className={styles.scopePackageName}>
                              {workPackage.description}
                            </h3>
                          </div>
                        </div>

                        <span className={styles.scopePackageCount}>
                          {packageItems.length}{' '}
                          {packageItems.length === 1
                            ? 'Scope Item'
                            : 'Scope Items'}
                        </span>
                      </div>

                      {packageItems.length === 0 ? (
                        <div className={styles.scopePackageEmpty}>
                          No Scope Items assigned to this
                          Work Package.
                        </div>
                      ) : (
                        <div className={styles.scopeItemTable}>
                          <div className={styles.scopeItemTableHeader}>
                            <span>ID</span>
                            <span>Scope Item</span>
                            <span>Unit</span>
                            <span>Scope Quantity</span>
                          </div>

                          {packageItems.map(
                            (scopeItem, itemIndex) => (
                              <div
                                className={styles.scopeItemRow}
                                key={scopeItem.id}
                              >
                                <span className={styles.scopeItemNumber}>
                                  {packageIndex + 1}.{itemIndex + 1}
                                </span>

                                <div className={styles.scopeItemIdentity}>
                                  <strong>
                                    {scopeItem.service_name}
                                  </strong>

                                  {scopeItem.service_code && (
                                    <span>
                                      {scopeItem.service_code}
                                    </span>
                                  )}
                                </div>

                                <span className={styles.scopeItemUnit}>
                                  {scopeItem.unit || '—'}
                                </span>

                                <span
                                  className={
                                    scopeItem.scope_quantity === null ||
                                    scopeItem.scope_quantity === undefined
                                      ? styles.scopeItemQuantityMissing
                                      : styles.scopeItemQuantity
                                  }
                                >
                                  {formatQuantity(
                                    scopeItem.scope_quantity
                                  )}
                                </span>
                              </div>
                            )
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}

                {scopeItemsByWorkPackage.has('unassigned') && (
                  <article
                    className={`${styles.scopePackage} ${styles.scopePackageUnassigned}`}
                  >
                    <div className={styles.scopePackageHeader}>
                      <div className={styles.scopePackageIdentity}>
                        <span className={styles.scopePackageNumber}>
                          !
                        </span>

                        <div>
                          <div className={styles.scopePackageCode}>
                            UNASSIGNED
                          </div>

                          <h3 className={styles.scopePackageName}>
                            Scope Items requiring classification
                          </h3>
                        </div>
                      </div>

                      <span className={styles.scopePackageCount}>
                        {
                          scopeItemsByWorkPackage.get(
                            'unassigned'
                          ).length
                        }{' '}
                        items
                      </span>
                    </div>

                    <div className={styles.scopeItemTable}>
                      <div className={styles.scopeItemTableHeader}>
                        <span>ID</span>
                        <span>Scope Item</span>
                        <span>Unit</span>
                        <span>Scope Quantity</span>
                      </div>

                      {scopeItemsByWorkPackage
                        .get('unassigned')
                        .map((scopeItem, itemIndex) => (
                          <div
                            className={styles.scopeItemRow}
                            key={scopeItem.id}
                          >
                            <span className={styles.scopeItemNumber}>
                              U.{itemIndex + 1}
                            </span>

                            <div className={styles.scopeItemIdentity}>
                              <strong>
                                {scopeItem.service_name}
                              </strong>

                              {scopeItem.service_code && (
                                <span>
                                  {scopeItem.service_code}
                                </span>
                              )}
                            </div>

                            <span className={styles.scopeItemUnit}>
                              {scopeItem.unit || '—'}
                            </span>

                            <span
                              className={
                                scopeItem.scope_quantity === null ||
                                scopeItem.scope_quantity === undefined
                                  ? styles.scopeItemQuantityMissing
                                  : styles.scopeItemQuantity
                              }
                            >
                              {formatQuantity(
                                scopeItem.scope_quantity
                              )}
                            </span>
                          </div>
                        ))}
                    </div>
                  </article>
                )}
              </div>
            )}
          </section>
        </>
      )}


      {/* ======================================================
          LOCATIONS
          ====================================================== */}

      {activeSection === 'locations' && (
        <>
          <section className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionIntroEyebrow}>
                03 — Locations
              </p>

              <h2 className={styles.sectionIntroTitle}>
                Location Breakdown Structure
              </h2>

              <p className={styles.sectionIntroDescription}>
                Define where production occurs using the
                project physical hierarchy.
              </p>
            </div>

            <div className={styles.sectionIntroActions}>
              <Link
                href={`/dashboard/projects/locations?projectId=${selectedProject.id}`}
                className={styles.primaryButton}
              >
                Open Location Structure
              </Link>
            </div>
          </section>

          <section className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Locations
              </span>

              <strong className={styles.metricValue}>
                {locationCount}
              </strong>

              <span className={styles.metricDetail}>
                Total hierarchy nodes
              </span>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Production Locations
              </span>

              <strong className={styles.metricValue}>
                {productionLocationCount}
              </strong>

              <span className={styles.metricDetail}>
                Areas, rooms and custom locations
              </span>
            </article>
          </section>

          <section className={styles.definitionBridge}>
            <div className={styles.definitionBridgeGraphic}>
              <div className={styles.definitionNode}>
                <span>Building</span>
              </div>

              <span className={styles.definitionArrow}>
                →
              </span>

              <div className={styles.definitionNode}>
                <span>Division / Floor</span>
              </div>

              <span className={styles.definitionArrow}>
                →
              </span>

              <div className={styles.definitionNode}>
                <span>Zone</span>
              </div>

              <span className={styles.definitionArrow}>
                →
              </span>

              <div className={styles.definitionNode}>
                <span>Production Location</span>
              </div>
            </div>

            <p className={styles.definitionBridgeText}>
              The existing Location Structure remains operational
              during this migration. Its location hierarchy will
              progressively be integrated directly into this
              Project Setup workspace.
            </p>
          </section>
        </>
      )}


      {/* ======================================================
          ALLOCATION
          ====================================================== */}

      {activeSection === 'allocation' && (
        <>
          <section className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionIntroEyebrow}>
                04 — Allocation
              </p>

              <h2 className={styles.sectionIntroTitle}>
                Scope Allocation
              </h2>

              <p className={styles.sectionIntroDescription}>
                Connect the Scope Breakdown Structure with
                the Location Breakdown Structure by allocating
                each Scope Item quantity across production
                locations.
              </p>
            </div>
          </section>

          <section className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Fully Allocated
              </span>

              <strong className={styles.metricValue}>
                {allocationStatus?.fully_allocated_items || 0}
              </strong>

              <span className={styles.metricDetail}>
                Scope Items
              </span>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Partially Allocated
              </span>

              <strong className={styles.metricValue}>
                {allocationStatus?.partially_allocated_items || 0}
              </strong>

              <span className={styles.metricDetail}>
                Scope Items
              </span>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Not Allocated
              </span>

              <strong className={styles.metricValue}>
                {allocationStatus?.not_allocated_items || 0}
              </strong>

              <span className={styles.metricDetail}>
                Scope Items
              </span>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Overallocated
              </span>

              <strong className={styles.metricValue}>
                {allocationStatus?.overallocated_items || 0}
              </strong>

              <span className={styles.metricDetail}>
                Require correction
              </span>
            </article>
          </section>

          <section className={styles.formPanel}>
            <div className={styles.formHeader}>
              <div>
                <h2 className={styles.formTitle}>
                  Quantity Reconciliation
                </h2>

                <p className={styles.formDescription}>
                  Scope Quantity is authoritative. Allocated
                  Quantity is the total distributed across
                  production locations.
                </p>
              </div>
            </div>

            {reconciliation.length === 0 ? (
              <div className={styles.workspaceEmpty}>
                <span className={styles.workspaceEmptyIcon}>
                  %
                </span>

                <h3>No allocation data available.</h3>

                <p>
                  Define Scope Items and their quantities
                  before allocating them across locations.
                </p>
              </div>
            ) : (
              <div className={styles.reconciliationTable}>
                <div className={styles.reconciliationHeader}>
                  <span>Scope Item</span>
                  <span>Scope Qty</span>
                  <span>Allocated</span>
                  <span>Unallocated</span>
                  <span>Allocation</span>
                  <span>Status</span>
                </div>

                {reconciliation.map((item) => {
                  const scopeItem =
                    scopeItems.find(
                      (candidate) =>
                        candidate.id ===
                        item.scope_item_id
                    )

                  return (
                    <div
                      className={styles.reconciliationRow}
                      key={item.scope_item_id}
                    >
                      <div className={styles.reconciliationIdentity}>
                        <strong>
                          {scopeItem?.service_name ||
                            'Scope Item'}
                        </strong>

                        <span>
                          {item.work_package_code ||
                            'Unassigned'}
                        </span>
                      </div>

                      <span>
                        {formatQuantity(
                          item.scope_quantity
                        )}
                      </span>

                      <span>
                        {formatQuantity(
                          item.allocated_quantity
                        )}
                      </span>

                      <span>
                        {formatQuantity(
                          item.unallocated_quantity
                        )}
                      </span>

                      <span>
                        {item.allocation_percentage === null ||
                        item.allocation_percentage === undefined
                          ? '—'
                          : `${formatQuantity(
                              item.allocation_percentage
                            )}%`}
                      </span>

                      <span
                        className={[
                          styles.reconciliationStatus,
                          getAllocationStatusClass(
                            item.allocation_status
                          ),
                        ].join(' ')}
                      >
                        {getAllocationStatusLabel(
                          item.allocation_status
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            <div className={styles.migrationAction}>
              <Link
                href={`/dashboard/projects/locations?projectId=${selectedProject.id}`}
                className={styles.secondaryButton}
              >
                Open current quantity matrix
              </Link>
            </div>
          </section>
        </>
      )}


      {/* ======================================================
          PRODUCTION PARAMETERS
          ====================================================== */}

      {activeSection === 'production' && (
        <>
          <section className={styles.sectionIntro}>
            <div>
              <p className={styles.sectionIntroEyebrow}>
                05 — Production Parameters
              </p>

              <h2 className={styles.sectionIntroTitle}>
                Production Parameters
              </h2>

              <p className={styles.sectionIntroDescription}>
                Define productivity assumptions, effective
                workforce, and production sizing information
                used later by planning.
              </p>
            </div>
          </section>

          <section className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Scope Items
              </span>

              <strong className={styles.metricValue}>
                {totalScopeItems}
              </strong>

              <span className={styles.metricDetail}>
                Potential production definitions
              </span>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Productivity Records
              </span>

              <strong className={styles.metricValue}>
                {productivityRecords.length}
              </strong>

              <span className={styles.metricDetail}>
                Project-specific parameters
              </span>
            </article>
          </section>

          <section className={styles.definitionBridge}>
            <div className={styles.productionParameterFlow}>
              <div className={styles.parameterNode}>
                <span className={styles.parameterLabel}>
                  Quantity
                </span>

                <strong>
                  Scope Allocation
                </strong>
              </div>

              <span className={styles.definitionArrow}>
                ×
              </span>

              <div className={styles.parameterNode}>
                <span className={styles.parameterLabel}>
                  Productivity
                </span>

                <strong>
                  Rate
                </strong>
              </div>

              <span className={styles.definitionArrow}>
                ×
              </span>

              <div className={styles.parameterNode}>
                <span className={styles.parameterLabel}>
                  Resources
                </span>

                <strong>
                  Effective Workforce
                </strong>
              </div>

              <span className={styles.definitionArrow}>
                →
              </span>

              <div className={styles.parameterNode}>
                <span className={styles.parameterLabel}>
                  Planning Input
                </span>

                <strong>
                  Duration / Takt
                </strong>
              </div>
            </div>

            <p className={styles.definitionBridgeText}>
              Productivity and Takt pre-dimensioning currently
              remain in the existing Location workspace.
              They will be migrated here after Scope and
              Allocation editing are established.
            </p>

            <Link
              href={`/dashboard/projects/locations?projectId=${selectedProject.id}`}
              className={styles.secondaryButton}
            >
              Open current Production Parameters
            </Link>
          </section>
        </>
      )}
    </div>
  )
}
