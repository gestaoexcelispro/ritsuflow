import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import ProjectForm from '../../projetos/coleta/ProjectForm'
import styles from '../../projetos/coleta/project-setup.module.css'
import selectorStyles from './selector.module.css'

export const dynamic = 'force-dynamic'

const statusLabels = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
}

function createSuggestedCode(projects) {
  const highestNumber = projects.reduce(
    (currentHighest, project) => {
      const match = project.code?.match(
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

export default async function ProjectSetupPage({
  searchParams,
}) {
  const resolvedSearchParams =
    await searchParams

  const rawProjectId =
    resolvedSearchParams?.projectId

  const rawMode =
    resolvedSearchParams?.mode

  const projectId = Array.isArray(
    rawProjectId
  )
    ? rawProjectId[0]
    : rawProjectId

  const mode = Array.isArray(rawMode)
    ? rawMode[0]
    : rawMode

  const isCreateMode =
    mode === 'new' && !projectId

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

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

          <p
            className={
              styles.errorDescription
            }
          >
            The project workspace could not
            identify an organization for your
            account.
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
            <h1
              className={styles.errorTitle}
            >
              Project unavailable
            </h1>

            <p
              className={
                styles.errorDescription
              }
            >
              The requested project does not
              exist or your account cannot
              access it.
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

  if (
    !selectedProject &&
    !isCreateMode
  ) {
    return (
      <div className={styles.container}>
        <section className={styles.heading}>
          <div
            className={
              styles.headingContent
            }
          >
            <p className={styles.eyebrow}>
              Project foundation
            </p>

            <h1 className={styles.title}>
              Project Setup
            </h1>

            <p
              className={
                styles.description
              }
            >
              Select a project from your
              portfolio to review or update its
              identity, contract information,
              planned dates, geographic data,
              and project cover image.
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
          className={styles.formPanel}
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
                Choose the project whose setup
                you want to review or update.
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

          {projects.length === 0 ? (
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
                Create the first project before
                defining its location structure
                and production scope.
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
            <div className={styles.section}>
              <div
                className={
                  selectorStyles.projectList
                }
              >
                {projects.map((project) => (
                  <article
                    className={
                      selectorStyles.projectCard
                    }
                    key={project.id}
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
                        {formatLocation(project)}
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
                      ] || project.status}
                    </span>

                    <Link
                      href={`/dashboard/projects/setup?projectId=${project.id}`}
                      className={
                        selectorStyles.configureLink
                      }
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

  return (
    <div className={styles.container}>
      <section className={styles.heading}>
        <div
          className={
            styles.headingContent
          }
        >
          <p className={styles.eyebrow}>
            Project foundation
          </p>

          <h1 className={styles.title}>
            {selectedProject
              ? 'Edit Project'
              : 'Create Project'}
          </h1>

          <p
            className={
              styles.description
            }
          >
            Establish the project identity,
            project image, planned boundaries,
            geographic information, and
            production foundation.
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
        organizationName={
          organization.name
        }
        userId={user.id}
        project={selectedProject}
        suggestedCode={suggestedCode}
      />
    </div>
  )
}
