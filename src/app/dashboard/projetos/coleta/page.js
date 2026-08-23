import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '../../../../lib/supabase/server'
import ProjectForm from './ProjectForm'
import styles from './project-setup.module.css'

export const dynamic = 'force-dynamic'

function createSuggestedCode(projects) {
  const highestNumber = projects.reduce(
    (currentHighest, project) => {
      const match = project.code?.match(
        /^RF-(\d+)$/
      )

      if (!match) {
        return currentHighest
      }

      const projectNumber = Number(match[1])

      return Math.max(
        currentHighest,
        projectNumber
      )
    },
    0
  )

  return `RF-${String(
    highestNumber + 1
  ).padStart(4, '0')}`
}

export default async function ProjectSetupPage({
  searchParams,
}) {
  const resolvedSearchParams =
    await searchParams

  const rawProjectId =
    resolvedSearchParams?.projectId

  const projectId = Array.isArray(
    rawProjectId
  )
    ? rawProjectId[0]
    : rawProjectId

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

  if (organizationError || !organization) {
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
    data: projectCodes,
    error: projectCodesError,
  } = await supabase
    .from('projects')
    .select('code')
    .eq(
      'organization_id',
      organization.id
    )

  if (projectCodesError) {
    console.error(
      'Project codes could not be loaded.',
      projectCodesError
    )
  }

  let project = null

  if (projectId) {
    const {
      data: projectData,
      error: projectError,
    } = await supabase
      .from('projects')
      .select(`
        id,
        code,
        name,
        client_name,
        status,
        proposal_number,
        contract_number,
        contract_value,
        currency_code,
        planned_start_date,
        planned_finish_date,
        address_line,
        neighborhood,
        city,
        state_region,
        postal_code,
        country_code,
        cover_image_path,
        latitude,
        longitude,
        geofence_radius_m,
        geofence_enabled,
        max_gps_accuracy_m
      `)
      .eq('id', projectId)
      .maybeSingle()

    if (projectError || !projectData) {
      console.error(
        'Requested project could not be loaded.',
        projectError
      )

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
              href="/dashboard/projetos/lista"
              className={styles.backLink}
            >
              Return to projects
            </Link>
          </div>
        </div>
      )
    }

    project = projectData
  }

  const suggestedCode =
    createSuggestedCode(
      projectCodes || []
    )

  return (
    <div className={styles.container}>
      <section className={styles.heading}>
        <div className={styles.headingContent}>
          <p className={styles.eyebrow}>
            Project foundation
          </p>

          <h1 className={styles.title}>
            {project
              ? 'Edit Project'
              : 'Project Setup'}
          </h1>

          <p className={styles.description}>
            Establish the project identity and
            planned boundaries before defining
            its location breakdown structure and
            production scope.
          </p>
        </div>

        <Link
          href="/dashboard/projetos/lista"
          className={styles.backLink}
        >
          ← Back to projects
        </Link>
      </section>

      <ProjectForm
        organizationId={organization.id}
        organizationName={
          organization.name
        }
        userId={user.id}
        project={project}
        suggestedCode={suggestedCode}
      />
    </div>
  )
}
