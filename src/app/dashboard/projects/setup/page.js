import Link from 'next/link'
import { redirect } from 'next/navigation'

import { createClient } from '../../../../lib/supabase/server'

import ProjectForm from '../../projetos/coleta/ProjectForm'
import ScopeWorkspace from './ScopeWorkspace'

import styles from '../../projetos/coleta/project-setup.module.css'
import selectorStyles from './selector.module.css'


export const dynamic = 'force-dynamic'


// ============================================================
// RITSUFLOW™
// PROJECT SETUP
//
// Unified project-definition workspace:
//
// 01 General
// 02 Scope
// 03 Locations
// 04 Allocation
// 05 Production Parameters
//
// Project Definition
//      ↓
// Planning
//      ↓
// Make Ready
//      ↓
// Commitment
//      ↓
// Production
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
    description:
      'Project identity and contractual information.',
  },
  {
    id: 'scope',
    number: '02',
    label: 'Scope',
    description:
      'Define the Scope Breakdown Structure.',
  },
  {
    id: 'locations',
    number: '03',
    label: 'Locations',
    description:
      'Define the physical production hierarchy.',
  },
  {
    id: 'allocation',
    number: '04',
    label: 'Allocation',
    description:
      'Allocate project scope across locations.',
  },
  {
    id: 'production',
    number: '05',
    label: 'Production Parameters',
    description:
      'Define productivity and production inputs.',
  },
]


// ============================================================
// HELPERS
// ============================================================

function createSuggestedCode(projects) {
  const highestNumber =
    projects.reduce(
      (
        currentHighest,
        project
      ) => {
        const match =
          project.code?.match(
            /^RF-(\d+)$/
          )

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
  const validSections =
    new Set(
      setupSections.map(
        (section) =>
          section.id
      )
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

  const numericValue =
    Number(value)

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return String(value)
  }

  return new Intl.NumberFormat(
    'en-US',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  ).format(numericValue)
}


function getAllocationStatus(
  scopeQuantity,
  allocatedQuantity
) {
  if (
    scopeQuantity === null ||
    scopeQuantity === undefined
  ) {
    return 'quantity_missing'
  }

  const scope =
    Number(scopeQuantity)

  const allocated =
    Number(allocatedQuantity || 0)

  const tolerance =
    0.000001

  if (
    Math.abs(
      allocated - scope
    ) <= tolerance
  ) {
    return 'fully_allocated'
  }

  if (
    allocated === 0
  ) {
    return 'not_allocated'
  }

  if (
    allocated < scope
  ) {
    return 'partially_allocated'
  }

  return 'overallocated'
}


function getAllocationStatusLabel(
  status
) {
  const labels = {
    quantity_missing:
      'Quantity missing',

    not_allocated:
      'Not allocated',

    partially_allocated:
      'Partially allocated',

    fully_allocated:
      'Fully allocated',

    overallocated:
      'Overallocated',
  }

  return (
    labels[status] ||
    'Not evaluated'
  )
}


function getAllocationStatusClass(
  status
) {
  if (
    status ===
    'fully_allocated'
  ) {
    return styles.statusSuccess
  }

  if (
    status ===
      'partially_allocated' ||
    status ===
      'not_allocated'
  ) {
    return styles.statusWarning
  }

  if (
    status ===
    'overallocated'
  ) {
    return styles.statusDanger
  }

  return styles.statusNeutral
}


// ============================================================
// PAGE
// ============================================================

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


  const projectId =
    Array.isArray(
      rawProjectId
    )
      ? rawProjectId[0]
      : rawProjectId


  const mode =
    Array.isArray(
      rawMode
    )
      ? rawMode[0]
      : rawMode


  const requestedSection =
    Array.isArray(
      rawSection
    )
      ? rawSection[0]
      : rawSection


  const activeSection =
    normalizeSection(
      requestedSection
    )


  const isCreateMode =
    mode === 'new' &&
    !projectId


  // ==========================================================
  // SUPABASE / AUTH
  // ==========================================================

  const supabase =
    await createClient()


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser()


  if (!user) {
    redirect('/login')
  }


  // ==========================================================
  // ORGANIZATION
  // ==========================================================

  const {
    data: organization,
    error: organizationError,
  } =
    await supabase
      .from(
        'organizations'
      )
      .select(`
        id,
        name
      `)
      .order(
        'created_at',
        {
          ascending: true,
        }
      )
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
      <div
        className={
          styles.container
        }
      >
        <div
          className={
            styles.errorPanel
          }
        >
          <h1
            className={
              styles.errorTitle
            }
          >
            Organization unavailable
          </h1>

          <p
            className={
              styles.errorDescription
            }
          >
            The project workspace
            could not identify an
            organization for your
            account.
          </p>

          <Link
            href="/dashboard"
            className={
              styles.backLink
            }
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
  } =
    await supabase
      .from(
        'projects'
      )
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
      .neq(
        'status',
        'archived'
      )
      .order(
        'created_at',
        {
          ascending: false,
        }
      )


  if (projectsError) {
    console.error(
      'RitsuFlow projects could not be loaded.',
      projectsError
    )
  }


  const projects =
    projectsData || []


  let selectedProject =
    null


  if (projectId) {
    selectedProject =
      projects.find(
        (project) =>
          project.id ===
          projectId
      ) || null


    if (
      !selectedProject
    ) {
      return (
        <div
          className={
            styles.container
          }
        >
          <div
            className={
              styles.errorPanel
            }
          >
            <h1
              className={
                styles.errorTitle
              }
            >
              Project unavailable
            </h1>

            <p
              className={
                styles.errorDescription
              }
            >
              The requested project
              does not exist or your
              account cannot access it.
            </p>

            <Link
              href="/dashboard/projects/setup"
              className={
                styles.backLink
              }
            >
              Select another project
            </Link>
          </div>
        </div>
      )
    }
  }


  const suggestedCode =
    createSuggestedCode(
      projects
    )


  // ==========================================================
  // PROJECT SELECTOR
  // ==========================================================

  if (
    !selectedProject &&
    !isCreateMode
  ) {
    return (
      <div
        className={
          styles.container
        }
      >
        <section
          className={
            styles.heading
          }
        >
          <div
            className={
              styles.headingContent
            }
          >
            <p
              className={
                styles.eyebrow
              }
            >
              Project definition
            </p>

            <h1
              className={
                styles.title
              }
            >
              Project Setup
            </h1>

            <p
              className={
                styles.description
              }
            >
              Select a project to
              define its identity,
              scope, production
              locations, scope
              allocation, and
              production parameters
              before planning begins.
            </p>
          </div>


          <Link
            href="/dashboard/projects"
            className={
              styles.backLink
            }
          >
            ← Back to projects
          </Link>
        </section>


        <div
          className={
            styles.contextBar
          }
        >
          <div
            className={
              styles.contextIdentity
            }
          >
            <span
              className={
                styles.contextIcon
              }
            >
              OR
            </span>

            <div>
              <p
                className={
                  styles.contextLabel
                }
              >
                Organization
              </p>

              <p
                className={
                  styles.contextValue
                }
              >
                {organization.name}
              </p>
            </div>
          </div>


          <span
            className={
              styles.contextMode
            }
          >
            {projects.length === 1
              ? '1 project'
              : `${projects.length} projects`}
          </span>
        </div>


        <article
          className={
            styles.formPanel
          }
        >
          <div
            className={`${styles.formHeader} ${selectorStyles.selectorHeader}`}
          >
            <div>
              <h2
                className={
                  styles.formTitle
                }
              >
                Select a project
              </h2>

              <p
                className={
                  styles.formDescription
                }
              >
                Choose the project
                whose definition you
                want to review or
                update.
              </p>
            </div>


            <Link
              href="/dashboard/projects/setup?mode=new"
              className={
                styles.primaryButton
              }
            >
              + Create new project
            </Link>
          </div>


          {projects.length ===
          0 ? (
            <div
              className={
                selectorStyles.emptyState
              }
            >
              <h3
                className={
                  selectorStyles.emptyTitle
                }
              >
                No projects available.
              </h3>

              <p
                className={
                  selectorStyles.emptyDescription
                }
              >
                Create the first
                project before
                defining its scope
                and production
                structure.
              </p>

              <Link
                href="/dashboard/projects/setup?mode=new"
                className={
                  styles.primaryButton
                }
              >
                Create first project
              </Link>
            </div>
          ) : (
            <div
              className={
                styles.section
              }
            >
              <div
                className={
                  selectorStyles.projectList
                }
              >
                {projects.map(
                  (project) => (
                    <article
                      className={
                        selectorStyles.projectCard
                      }
                      key={
                        project.id
                      }
                    >
                      <span
                        className={
                          selectorStyles.projectCode
                        }
                      >
                        {project.code ||
                          'Unassigned'}
                      </span>


                      <div
                        className={
                          selectorStyles.projectIdentity
                        }
                      >
                        <span
                          className={
                            selectorStyles.projectName
                          }
                        >
                          {project.name}
                        </span>

                        <span
                          className={
                            selectorStyles.projectLocation
                          }
                        >
                          {formatLocation(
                            project
                          )}
                        </span>
                      </div>


                      <span
                        className={
                          selectorStyles.projectClient
                        }
                      >
                        {project.client_name ||
                          'Client not specified'}
                      </span>


                      <span
                        className={
                          selectorStyles.projectStatus
                        }
                      >
                        {statusLabels[
                          project.status
                        ] ||
                          project.status}
                      </span>


                      <Link
                        href={`/dashboard/projects/setup?projectId=${project.id}&section=general`}
                        className={
                          selectorStyles.configureLink
                        }
                      >
                        Configure →
                      </Link>
                    </article>
                  )
                )}
              </div>
            </div>
          )}
        </article>
      </div>
    )
  }


  // ==========================================================
  // CREATE PROJECT
  // ==========================================================

  if (isCreateMode) {
    return (
      <div
        className={
          styles.container
        }
      >
        <section
          className={
            styles.heading
          }
        >
          <div
            className={
              styles.headingContent
            }
          >
            <p
              className={
                styles.eyebrow
              }
            >
              Project foundation
            </p>

            <h1
              className={
                styles.title
              }
            >
              Create Project
            </h1>

            <p
              className={
                styles.description
              }
            >
              Establish the project
              identity, contractual
              information, planned
              boundaries, geographic
              information, and cover
              image.
            </p>
          </div>


          <Link
            href="/dashboard/projects/setup"
            className={
              styles.backLink
            }
          >
            ← Select project
          </Link>
        </section>


        <ProjectForm
          organizationId={
            organization.id
          }
          organizationName={
            organization.name
          }
          userId={
            user.id
          }
          project={null}
          suggestedCode={
            suggestedCode
          }
        />
      </div>
    )
  }


  // ==========================================================
  // LOAD PROJECT DEFINITION DATA
  // ==========================================================

  const [
    workPackagesResult,
    scopeItemsResult,
    locationsResult,
    allocationsResult,
    productivityResult,
  ] =
    await Promise.all([
      supabase
        .from(
          'project_work_packages'
        )
        .select(`
          id,
          project_id,
          code,
          description,
          color,
          is_active
        `)
        .eq(
          'project_id',
          selectedProject.id
        )
        .order(
          'code',
          {
            ascending: true,
          }
        ),


      supabase
        .from(
          'project_services'
        )
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
        .eq(
          'project_id',
          selectedProject.id
        )
        .order(
          'sequence_number',
          {
            ascending: true,
          }
        ),


      supabase
        .from(
          'locations'
        )
        .select(`
          id
        `)
        .eq(
          'project_id',
          selectedProject.id
        ),


      supabase
        .from(
          'location_service_quantities'
        )
        .select(`
          service_id,
          quantity
        `)
        .eq(
          'project_id',
          selectedProject.id
        ),


      supabase
        .from(
          'project_service_productivity'
        )
        .select(`
          id,
          service_id
        `)
        .eq(
          'project_id',
          selectedProject.id
        ),
    ])


  // ==========================================================
  // LOG LOAD ERRORS
  // ==========================================================

  if (
    workPackagesResult.error
  ) {
    console.error(
      'Work Packages could not be loaded.',
      workPackagesResult.error
    )
  }


  if (
    scopeItemsResult.error
  ) {
    console.error(
      'Scope Items could not be loaded.',
      scopeItemsResult.error
    )
  }


  if (
    locationsResult.error
  ) {
    console.error(
      'Locations could not be loaded.',
      locationsResult.error
    )
  }


  if (
    allocationsResult.error
  ) {
    console.error(
      'Scope allocations could not be loaded.',
      allocationsResult.error
    )
  }


  if (
    productivityResult.error
  ) {
    console.error(
      'Production parameters could not be loaded.',
      productivityResult.error
    )
  }


  // ==========================================================
  // NORMALIZE DATA
  // ==========================================================

  const workPackages =
    workPackagesResult.data ||
    []


  const scopeItems =
    scopeItemsResult.data ||
    []


  const activeWorkPackages =
    workPackages.filter(
      (workPackage) =>
        workPackage.is_active !==
        false
    )


  const activeScopeItems =
    scopeItems.filter(
      (scopeItem) =>
        scopeItem.is_active !==
        false
    )


  const locations =
    locationsResult.data ||
    []


  const allocations =
    allocationsResult.data ||
    []


  const productivityRecords =
    productivityResult.data ||
    []


  // ==========================================================
  // SCOPE COMPLETENESS
  // ==========================================================

  const assignedScopeItemCount =
    activeScopeItems.filter(
      (scopeItem) =>
        Boolean(
          scopeItem.project_work_package_id
        )
    ).length


  const quantityDefinedCount =
    activeScopeItems.filter(
      (scopeItem) =>
        scopeItem.scope_quantity !==
          null &&
        scopeItem.scope_quantity !==
          undefined
    ).length


  const unitsDefinedCount =
    activeScopeItems.filter(
      (scopeItem) =>
        Boolean(
          String(
            scopeItem.unit || ''
          ).trim()
        )
    ).length


  const scopeComplete =
    activeScopeItems.length > 0 &&
    assignedScopeItemCount ===
      activeScopeItems.length &&
    quantityDefinedCount ===
      activeScopeItems.length &&
    unitsDefinedCount ===
      activeScopeItems.length


  // ==========================================================
  // LOCATION COMPLETENESS
  // ==========================================================

  const locationCount =
    locations.length


  const locationsComplete =
    locationCount > 0


  // ==========================================================
  // ALLOCATION RECONCILIATION
  // ==========================================================

  const allocatedByScopeItem =
    new Map()


  allocations.forEach(
    (allocation) => {
      const currentValue =
        allocatedByScopeItem.get(
          allocation.service_id
        ) || 0


      allocatedByScopeItem.set(
        allocation.service_id,

        currentValue +
          Number(
            allocation.quantity ||
              0
          )
      )
    }
  )


  const reconciliation =
    activeScopeItems.map(
      (scopeItem) => {
        const allocatedQuantity =
          allocatedByScopeItem.get(
            scopeItem.id
          ) || 0


        const status =
          getAllocationStatus(
            scopeItem.scope_quantity,
            allocatedQuantity
          )


        const scopeQuantity =
          scopeItem.scope_quantity ===
            null ||
          scopeItem.scope_quantity ===
            undefined
            ? null
            : Number(
                scopeItem.scope_quantity
              )


        const unallocatedQuantity =
          scopeQuantity === null
            ? null
            : scopeQuantity -
              allocatedQuantity


        const allocationPercentage =
          scopeQuantity === null ||
          scopeQuantity === 0
            ? null
            : (
                allocatedQuantity /
                scopeQuantity
              ) * 100


        return {
          ...scopeItem,

          allocated_quantity:
            allocatedQuantity,

          unallocated_quantity:
            unallocatedQuantity,

          allocation_percentage:
            allocationPercentage,

          allocation_status:
            status,
        }
      }
    )


  const fullyAllocatedCount =
    reconciliation.filter(
      (item) =>
        item.allocation_status ===
        'fully_allocated'
    ).length


  const partiallyAllocatedCount =
    reconciliation.filter(
      (item) =>
        item.allocation_status ===
        'partially_allocated'
    ).length


  const notAllocatedCount =
    reconciliation.filter(
      (item) =>
        item.allocation_status ===
        'not_allocated'
    ).length


  const overallocatedCount =
    reconciliation.filter(
      (item) =>
        item.allocation_status ===
        'overallocated'
    ).length


  const quantityMissingCount =
    reconciliation.filter(
      (item) =>
        item.allocation_status ===
        'quantity_missing'
    ).length


  const allocationComplete =
    activeScopeItems.length > 0 &&
    fullyAllocatedCount ===
      activeScopeItems.length


  // ==========================================================
  // PRODUCTION PARAMETERS
  // ==========================================================

  const scopeItemsWithProductivity =
    new Set(
      productivityRecords
        .map(
          (record) =>
            record.service_id
        )
        .filter(Boolean)
    )


  const productionParametersComplete =
    activeScopeItems.length > 0 &&
    activeScopeItems.every(
      (scopeItem) =>
        scopeItemsWithProductivity.has(
          scopeItem.id
        )
    )


  // ==========================================================
  // PROJECT READINESS
  // ==========================================================

  const projectReadyForPlanning =
    scopeComplete &&
    locationsComplete &&
    allocationComplete


  // ==========================================================
  // SECTION LINK
  // ==========================================================

  function sectionHref(
    sectionId
  ) {
    return (
      `/dashboard/projects/setup?projectId=${selectedProject.id}` +
      `&section=${sectionId}`
    )
  }


  // ==========================================================
  // RENDER PROJECT SETUP WORKSPACE
  // ==========================================================

  return (
    <div
      className={
        styles.container
      }
    >
      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <section
        className={
          styles.heading
        }
      >
        <div
          className={
            styles.headingContent
          }
        >
          <p
            className={
              styles.eyebrow
            }
          >
            Project definition
          </p>

          <h1
            className={
              styles.title
            }
          >
            Project Setup
          </h1>

          <p
            className={
              styles.description
            }
          >
            Define what the project
            is, what must be
            delivered, where
            production will occur,
            and how the scope is
            distributed before
            planning begins.
          </p>
        </div>


        <Link
          href="/dashboard/projects/setup"
          className={
            styles.backLink
          }
        >
          ← Select project
        </Link>
      </section>


      {/* ======================================================
          PROJECT CONTEXT
          ====================================================== */}

      <section
        className={
          styles.projectContext
        }
      >
        <div
          className={
            styles.projectContextIdentity
          }
        >
          <span
            className={
              styles.projectContextCode
            }
          >
            {selectedProject.code ||
              'PROJECT'}
          </span>


          <div>
            <h2
              className={
                styles.projectContextName
              }
            >
              {selectedProject.name}
            </h2>

            <p
              className={
                styles.projectContextMeta
              }
            >
              {selectedProject.client_name ||
                'Client not specified'}

              <span>
                ·
              </span>

              {formatLocation(
                selectedProject
              )}

              <span>
                ·
              </span>

              {statusLabels[
                selectedProject.status
              ] ||
                selectedProject.status}
            </p>
          </div>
        </div>


        <div
          className={
            styles.readinessBlock
          }
        >
          <span
            className={
              styles.readinessLabel
            }
          >
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
          SETUP NAVIGATION
          ====================================================== */}

      <nav
        className={
          styles.setupNavigation
        }
        aria-label="Project setup sections"
      >
        {setupSections.map(
          (section) => {
            const isActive =
              activeSection ===
              section.id


            let state =
              'pending'


            if (
              section.id ===
              'general'
            ) {
              state =
                'complete'
            }


            if (
              section.id ===
              'scope'
            ) {
              state =
                scopeComplete
                  ? 'complete'
                  : 'incomplete'
            }


            if (
              section.id ===
              'locations'
            ) {
              state =
                locationsComplete
                  ? 'complete'
                  : 'incomplete'
            }


            if (
              section.id ===
              'allocation'
            ) {
              state =
                allocationComplete
                  ? 'complete'
                  : 'incomplete'
            }


            if (
              section.id ===
              'production'
            ) {
              state =
                productionParametersComplete
                  ? 'complete'
                  : 'pending'
            }


            return (
              <Link
                href={
                  sectionHref(
                    section.id
                  )
                }
                className={[
                  styles.setupTab,

                  isActive
                    ? styles.setupTabActive
                    : '',
                ]
                  .filter(
                    Boolean
                  )
                  .join(' ')}
                key={
                  section.id
                }
              >
                <span
                  className={
                    styles.setupTabNumber
                  }
                >
                  {section.number}
                </span>


                <span
                  className={
                    styles.setupTabContent
                  }
                >
                  <span
                    className={
                      styles.setupTabLabel
                    }
                  >
                    {section.label}
                  </span>

                  <span
                    className={
                      styles.setupTabDescription
                    }
                  >
                    {section.description}
                  </span>
                </span>


                <span
                  className={[
                    styles.setupTabState,

                    state ===
                    'complete'
                      ? styles.setupTabStateComplete
                      : '',

                    state ===
                    'incomplete'
                      ? styles.setupTabStateIncomplete
                      : '',
                  ]
                    .filter(
                      Boolean
                    )
                    .join(' ')}
                >
                  {state ===
                  'complete'
                    ? '✓'
                    : state ===
                        'incomplete'
                      ? '!'
                      : '○'}
                </span>
              </Link>
            )
          }
        )}
      </nav>


      {/* ======================================================
          01 GENERAL
          ====================================================== */}

      {activeSection ===
        'general' && (
        <>
          <section
            className={
              styles.sectionIntro
            }
          >
            <div>
              <p
                className={
                  styles.sectionIntroEyebrow
                }
              >
                01 — General
              </p>

              <h2
                className={
                  styles.sectionIntroTitle
                }
              >
                Project identity
                and boundaries
              </h2>

              <p
                className={
                  styles.sectionIntroDescription
                }
              >
                Maintain the
                contractual,
                geographic,
                scheduling, and
                identification
                information that
                defines this
                project.
              </p>
            </div>
          </section>


          <ProjectForm
            organizationId={
              organization.id
            }
            organizationName={
              organization.name
            }
            userId={
              user.id
            }
            project={
              selectedProject
            }
            suggestedCode={
              suggestedCode
            }
          />
        </>
      )}


      {/* ======================================================
          02 SCOPE
          ====================================================== */}

      {activeSection ===
        'scope' && (
        <>
          <section
            className={
              styles.sectionIntro
            }
          >
            <div>
              <p
                className={
                  styles.sectionIntroEyebrow
                }
              >
                02 — Scope
              </p>

              <h2
                className={
                  styles.sectionIntroTitle
                }
              >
                Scope Breakdown
                Structure
              </h2>

              <p
                className={
                  styles.sectionIntroDescription
                }
              >
                Define what the
                project must deliver.
                Work Packages organize
                the scope while Scope
                Items define measurable
                production operations
                and their authoritative
                project quantities.
              </p>
            </div>
          </section>


          <ScopeWorkspace
            projectId={
              selectedProject.id
            }
            userId={
              user.id
            }
            initialWorkPackages={
              workPackages
            }
            initialScopeItems={
              scopeItems
            }
          />
        </>
      )}


      {/* ======================================================
          03 LOCATIONS
          ====================================================== */}

      {activeSection ===
        'locations' && (
        <>
          <section
            className={
              styles.sectionIntro
            }
          >
            <div>
              <p
                className={
                  styles.sectionIntroEyebrow
                }
              >
                03 — Locations
              </p>

              <h2
                className={
                  styles.sectionIntroTitle
                }
              >
                Location Breakdown
                Structure
              </h2>

              <p
                className={
                  styles.sectionIntroDescription
                }
              >
                Define where production
                occurs using the
                project's physical
                hierarchy.
              </p>
            </div>


            <div
              className={
                styles.sectionIntroActions
              }
            >
              <Link
                href={`/dashboard/projects/locations?projectId=${selectedProject.id}`}
                className={
                  styles.primaryButton
                }
              >
                Open Location Structure
              </Link>
            </div>
          </section>


          <section
            className={
              styles.metricGrid
            }
          >
            <article
              className={
                styles.metricCard
              }
            >
              <span
                className={
                  styles.metricLabel
                }
              >
                Locations
              </span>

              <strong
                className={
                  styles.metricValue
                }
              >
                {locationCount}
              </strong>

              <span
                className={
                  styles.metricDetail
                }
              >
                Defined hierarchy nodes
              </span>
            </article>
          </section>


          <section
            className={
              styles.definitionBridge
            }
          >
            <div
              className={
                styles.definitionBridgeGraphic
              }
            >
              <div
                className={
                  styles.definitionNode
                }
              >
                <span>
                  Project
                </span>
              </div>

              <span
                className={
                  styles.definitionArrow
                }
              >
                →
              </span>

              <div
                className={
                  styles.definitionNode
                }
              >
                <span>
                  Division / Floor
                </span>
              </div>

              <span
                className={
                  styles.definitionArrow
                }
              >
                →
              </span>

              <div
                className={
                  styles.definitionNode
                }
              >
                <span>
                  Zone / Area
                </span>
              </div>

              <span
                className={
                  styles.definitionArrow
                }
              >
                →
              </span>

              <div
                className={
                  styles.definitionNode
                }
              >
                <span>
                  Production Location
                </span>
              </div>
            </div>


            <p
              className={
                styles.definitionBridgeText
              }
            >
              The existing Location
              Structure remains
              operational during this
              migration. We will move
              its hierarchy editor
              directly into Project
              Setup in a later step.
            </p>
          </section>
        </>
      )}


      {/* ======================================================
          04 ALLOCATION
          ====================================================== */}

      {activeSection ===
        'allocation' && (
        <>
          <section
            className={
              styles.sectionIntro
            }
          >
            <div>
              <p
                className={
                  styles.sectionIntroEyebrow
                }
              >
                04 — Allocation
              </p>

              <h2
                className={
                  styles.sectionIntroTitle
                }
              >
                Scope Allocation
              </h2>

              <p
                className={
                  styles.sectionIntroDescription
                }
              >
                Connect the Scope
                Breakdown Structure
                with the Location
                Breakdown Structure
                by distributing each
                Scope Item quantity
                across production
                locations.
              </p>
            </div>
          </section>


          <section
            className={
              styles.metricGrid
            }
          >
            <article
              className={
                styles.metricCard
              }
            >
              <span
                className={
                  styles.metricLabel
                }
              >
                Fully Allocated
              </span>

              <strong
                className={
                  styles.metricValue
                }
              >
                {fullyAllocatedCount}
              </strong>

              <span
                className={
                  styles.metricDetail
                }
              >
                Scope Items
              </span>
            </article>


            <article
              className={
                styles.metricCard
              }
            >
              <span
                className={
                  styles.metricLabel
                }
              >
                Partially Allocated
              </span>

              <strong
                className={
                  styles.metricValue
                }
              >
                {partiallyAllocatedCount}
              </strong>

              <span
                className={
                  styles.metricDetail
                }
              >
                Scope Items
              </span>
            </article>


            <article
              className={
                styles.metricCard
              }
            >
              <span
                className={
                  styles.metricLabel
                }
              >
                Not Allocated
              </span>

              <strong
                className={
                  styles.metricValue
                }
              >
                {notAllocatedCount}
              </strong>

              <span
                className={
                  styles.metricDetail
                }
              >
                Scope Items
              </span>
            </article>


            <article
              className={
                styles.metricCard
              }
            >
              <span
                className={
                  styles.metricLabel
                }
              >
                Overallocated
              </span>

              <strong
                className={
                  styles.metricValue
                }
              >
                {overallocatedCount}
              </strong>

              <span
                className={
                  styles.metricDetail
                }
              >
                Require correction
              </span>
            </article>
          </section>


          {quantityMissingCount >
            0 && (
            <div
              className={
                styles.scopeWorkspaceError
              }
            >
              {quantityMissingCount}{' '}
              Scope{' '}
              {quantityMissingCount ===
              1
                ? 'Item does'
                : 'Items do'}{' '}
              not yet have an
              authoritative Scope
              Quantity.
            </div>
          )}


          <section
            className={
              styles.formPanel
            }
          >
            <div
              className={
                styles.formHeader
              }
            >
              <h2
                className={
                  styles.formTitle
                }
              >
                Quantity Reconciliation
              </h2>

              <p
                className={
                  styles.formDescription
                }
              >
                Scope Quantity is
                authoritative. Allocated
                Quantity represents the
                amount distributed
                across project
                locations.
              </p>
            </div>


            {reconciliation.length ===
            0 ? (
              <div
                className={
                  styles.workspaceEmpty
                }
              >
                <span
                  className={
                    styles.workspaceEmptyIcon
                  }
                >
                  %
                </span>

                <h3>
                  No allocation data
                  available.
                </h3>

                <p>
                  Define Scope Items
                  and their quantities
                  before allocating
                  them across project
                  locations.
                </p>
              </div>
            ) : (
              <div
                className={
                  styles.reconciliationTable
                }
              >
                <div
                  className={
                    styles.reconciliationHeader
                  }
                >
                  <span>
                    Scope Item
                  </span>

                  <span>
                    Scope Qty
                  </span>

                  <span>
                    Allocated
                  </span>

                  <span>
                    Unallocated
                  </span>

                  <span>
                    Allocation
                  </span>

                  <span>
                    Status
                  </span>
                </div>


                {reconciliation.map(
                  (item) => (
                    <div
                      className={
                        styles.reconciliationRow
                      }
                      key={
                        item.id
                      }
                    >
                      <div
                        className={
                          styles.reconciliationIdentity
                        }
                      >
                        <strong>
                          {item.service_name}
                        </strong>

                        <span>
                          {item.service_code ||
                            'Scope Item'}
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
                        {item.allocation_percentage ===
                          null ||
                        item.allocation_percentage ===
                          undefined
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
                )}
              </div>
            )}


            <div
              className={
                styles.migrationAction
              }
            >
              <Link
                href={`/dashboard/projects/locations?projectId=${selectedProject.id}`}
                className={
                  styles.secondaryButton
                }
              >
                Open current quantity matrix
              </Link>
            </div>
          </section>
        </>
      )}


      {/* ======================================================
          05 PRODUCTION PARAMETERS
          ====================================================== */}

      {activeSection ===
        'production' && (
        <>
          <section
            className={
              styles.sectionIntro
            }
          >
            <div>
              <p
                className={
                  styles.sectionIntroEyebrow
                }
              >
                05 — Production Parameters
              </p>

              <h2
                className={
                  styles.sectionIntroTitle
                }
              >
                Production Parameters
              </h2>

              <p
                className={
                  styles.sectionIntroDescription
                }
              >
                Define productivity
                assumptions, effective
                workforce, and
                production sizing
                information consumed
                later by planning.
              </p>
            </div>
          </section>


          <section
            className={
              styles.metricGrid
            }
          >
            <article
              className={
                styles.metricCard
              }
            >
              <span
                className={
                  styles.metricLabel
                }
              >
                Scope Items
              </span>

              <strong
                className={
                  styles.metricValue
                }
              >
                {activeScopeItems.length}
              </strong>

              <span
                className={
                  styles.metricDetail
                }
              >
                Active project scope
              </span>
            </article>


            <article
              className={
                styles.metricCard
              }
            >
              <span
                className={
                  styles.metricLabel
                }
              >
                Productivity Records
              </span>

              <strong
                className={
                  styles.metricValue
                }
              >
                {
                  productivityRecords.length
                }
              </strong>

              <span
                className={
                  styles.metricDetail
                }
              >
                Project-specific
                production inputs
              </span>
            </article>
          </section>


          <section
            className={
              styles.definitionBridge
            }
          >
            <div
              className={
                styles.productionParameterFlow
              }
            >
              <div
                className={
                  styles.parameterNode
                }
              >
                <span
                  className={
                    styles.parameterLabel
                  }
                >
                  Quantity
                </span>

                <strong>
                  Scope Allocation
                </strong>
              </div>


              <span
                className={
                  styles.definitionArrow
                }
              >
                ×
              </span>


              <div
                className={
                  styles.parameterNode
                }
              >
                <span
                  className={
                    styles.parameterLabel
                  }
                >
                  Productivity
                </span>

                <strong>
                  Rate
                </strong>
              </div>


              <span
                className={
                  styles.definitionArrow
                }
              >
                ×
              </span>


              <div
                className={
                  styles.parameterNode
                }
              >
                <span
                  className={
                    styles.parameterLabel
                  }
                >
                  Resources
                </span>

                <strong>
                  Effective Workforce
                </strong>
              </div>


              <span
                className={
                  styles.definitionArrow
                }
              >
                →
              </span>


              <div
                className={
                  styles.parameterNode
                }
              >
                <span
                  className={
                    styles.parameterLabel
                  }
                >
                  Planning Input
                </span>

                <strong>
                  Duration / Takt
                </strong>
              </div>
            </div>


            <p
              className={
                styles.definitionBridgeText
              }
            >
              Productivity and Takt
              pre-dimensioning remain
              available in the current
              Location workspace during
              this migration. They will
              move into this section
              after Scope Allocation is
              fully integrated.
            </p>


            <Link
              href={`/dashboard/projects/locations?projectId=${selectedProject.id}`}
              className={
                styles.secondaryButton
              }
            >
              Open current Production Parameters
            </Link>
          </section>
        </>
      )}
    </div>
  )
}
