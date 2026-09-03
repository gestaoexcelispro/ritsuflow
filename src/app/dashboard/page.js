import Link from 'next/link'
import { createClient } from '../../lib/supabase/server'
import styles from './overview.module.css'

const planningCycle = [
  {
    number: '01',
    title: 'Master Plan',
    description:
      'Define locations, production sequence, milestones, and long-term flow.',
    href: '/dashboard/projetos/masterplan',
  },
  {
    number: '02',
    title: 'Lookahead Planning',
    description:
      'Prepare upcoming work and remove constraints before execution.',
    href: '/dashboard/projetos/lookahead',
  },
  {
    number: '03',
    title: 'Weekly Planning',
    description:
      'Convert ready work into reliable field commitments.',
    href: '/dashboard/projetos/semanal',
  },
  {
    number: '04',
    title: 'Flow Control',
    description:
      'Monitor progress, rhythm, deviations, and production reliability.',
    href: '/dashboard/projetos/matriz-status',
  },
]

function formatProjectDetail({
  activeProjects,
  planningProjects,
  totalProjects,
  hasError,
}) {
  if (hasError) {
    return 'Unable to load project data'
  }

  if (activeProjects > 0) {
    return activeProjects === 1
      ? '1 project currently active'
      : `${activeProjects} projects currently active`
  }

  if (planningProjects > 0) {
    return planningProjects === 1
      ? '1 project currently in planning'
      : `${planningProjects} projects currently in planning`
  }

  if (totalProjects > 0) {
    return totalProjects === 1
      ? '1 project configured'
      : `${totalProjects} projects configured`
  }

  return 'No projects configured'
}

function formatLocationDetail({
  locations,
  hasError,
}) {
  if (hasError) {
    return 'Unable to load location data'
  }

  if (locations === 1) {
    return '1 production location configured'
  }

  if (locations > 1) {
    return `${locations} production locations configured`
  }

  return 'No locations configured'
}

function getReadinessStatus({
  complete,
  completeLabel = 'Complete',
  pendingLabel = 'Not configured',
}) {
  if (complete) {
    return {
      status: completeLabel,
      statusClass: styles.statusComplete,
    }
  }

  return {
    status: pendingLabel,
    statusClass: styles.statusPlanned,
  }
}

export default async function DashboardHome() {
  const supabase = await createClient()

  const [
    activeProjectsResult,
    planningProjectsResult,
    totalProjectsResult,
    locationsResult,
    scopeItemsResult,
  ] = await Promise.all([
    supabase
      .from('projects')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'active'),

    supabase
      .from('projects')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('status', 'planning'),

    supabase
      .from('projects')
      .select('id', {
        count: 'exact',
        head: true,
      })
      .neq('status', 'archived'),

    supabase
      .from('locations')
      .select('id', {
        count: 'exact',
        head: true,
      }),

    supabase
      .from('scope_items')
      .select('id', {
        count: 'exact',
        head: true,
      }),
  ])

  const projectQueryFailed = Boolean(
    activeProjectsResult.error ||
      planningProjectsResult.error ||
      totalProjectsResult.error
  )

  const locationQueryFailed = Boolean(
    locationsResult.error
  )

  const scopeQueryFailed = Boolean(
    scopeItemsResult.error
  )

  if (
    projectQueryFailed ||
    locationQueryFailed ||
    scopeQueryFailed
  ) {
    console.error(
      'RitsuFlow dashboard data query failed.',
      {
        activeProjects:
          activeProjectsResult.error,
        planningProjects:
          planningProjectsResult.error,
        totalProjects:
          totalProjectsResult.error,
        locations:
          locationsResult.error,
        scopeItems:
          scopeItemsResult.error,
      }
    )
  }

  const activeProjects =
    activeProjectsResult.count ?? 0

  const planningProjects =
    planningProjectsResult.count ?? 0

  const totalProjects =
    totalProjectsResult.count ?? 0

  const locations =
    locationsResult.count ?? 0

  const scopeItems =
    scopeItemsResult.count ?? 0

  const metrics = [
    {
      label: 'Active projects',
      value: projectQueryFailed
        ? 'â€”'
        : String(activeProjects),

      detail: formatProjectDetail({
        activeProjects,
        planningProjects,
        totalProjects,
        hasError: projectQueryFailed,
      }),

      icon: 'PR',
    },
    {
      label: 'Locations',
      value: locationQueryFailed
        ? 'â€”'
        : String(locations),

      detail: formatLocationDetail({
        locations,
        hasError: locationQueryFailed,
      }),

      icon: 'LB',
    },
    {
      label: 'Open constraints',
      value: 'â€”',
      detail: 'Constraint module coming next',
      icon: 'CM',
    },
    {
      label: 'Plan reliability',
      value: 'â€”',
      detail: 'Weekly planning module coming next',
      icon: 'PPC',
    },
  ]

  const projectReadiness = getReadinessStatus({
    complete:
      !projectQueryFailed &&
      totalProjects > 0,
  })

  const locationReadiness =
    getReadinessStatus({
      complete:
        !locationQueryFailed &&
        locations > 0,
    })

  const scopeReadiness = scopeQueryFailed
    ? {
        status: 'Unable to verify',
        statusClass: styles.statusPlanned,
      }
    : scopeItems > 0
      ? {
          status: 'Foundation ready',
          statusClass:
            styles.statusComplete,
        }
      : {
          status: 'In preparation',
          statusClass:
            styles.statusProgress,
        }

  const readinessItems = [
    {
      icon: 'âœ“',
      name: 'Secure authentication',
      status: 'Complete',
      statusClass: styles.statusComplete,
    },
    {
      icon: '01',
      name: 'Project structure',
      status: projectReadiness.status,
      statusClass:
        projectReadiness.statusClass,
    },
    {
      icon: '02',
      name: 'Location breakdown structure',
      status: locationReadiness.status,
      statusClass:
        locationReadiness.statusClass,
    },
    {
      icon: '03',
      name: 'Planning workspace',
      status: scopeReadiness.status,
      statusClass:
        scopeReadiness.statusClass,
    },
  ]

  return (
    <div className={styles.container}>
      <section className={styles.heading}>
        <div className={styles.headingContent}>
          <p className={styles.eyebrow}>
            Production planning workspace
          </p>

          <h2 className={styles.title}>
            Production Overview
          </h2>

          <p className={styles.description}>
            Connect projects, locations, planning
            horizons, constraints, and production
            performance in one operational view.
          </p>
        </div>

        <div
          className={styles.developmentBadge}
        >
          <span
            className={styles.developmentDot}
          />

          Private development
        </div>
      </section>

      <section
        className={styles.metricsGrid}
        aria-label="Production metrics"
      >
        {metrics.map((metric) => (
          <article
            className={styles.metricCard}
            key={metric.label}
          >
            <div
              className={styles.metricHeader}
            >
              <span
                className={styles.metricLabel}
              >
                {metric.label}
              </span>

              <span
                className={styles.metricIcon}
              >
                {metric.icon}
              </span>
            </div>

            <p
              className={styles.metricValue}
            >
              {metric.value}
            </p>

            <p
              className={styles.metricDetail}
            >
              {metric.detail}
            </p>
          </article>
        ))}
      </section>

      <section className={styles.section}>
        <div
          className={styles.sectionHeading}
        >
          <div>
            <h3
              className={styles.sectionTitle}
            >
              Planning cycle
            </h3>

            <p
              className={
                styles.sectionDescription
              }
            >
              Move from strategic planning to
              reliable production control.
            </p>
          </div>
        </div>

        <div className={styles.cycleGrid}>
          {planningCycle.map((step) => (
            <Link
              href={step.href}
              className={styles.cycleCard}
              key={step.number}
            >
              <span
                className={styles.cycleNumber}
              >
                {step.number}
              </span>

              <h4
                className={styles.cycleTitle}
              >
                {step.title}
              </h4>

              <p
                className={
                  styles.cycleDescription
                }
              >
                {step.description}
              </p>

              <span
                className={styles.cycleArrow}
                aria-hidden="true"
              >
                â†’
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className={styles.lowerGrid}>
        <article className={styles.panel}>
          <h3 className={styles.panelTitle}>
            Project readiness
          </h3>

          <p
            className={
              styles.panelDescription
            }
          >
            Complete the project foundation
            before activating the planning
            cycle.
          </p>

          <div
            className={styles.progressList}
          >
            {readinessItems.map((item) => (
              <div
                className={
                  styles.progressItem
                }
                key={item.name}
              >
                <div
                  className={
                    styles.progressIdentity
                  }
                >
                  <span
                    className={
                      styles.progressIcon
                    }
                  >
                    {item.icon}
                  </span>

                  <span
                    className={
                      styles.progressName
                    }
                  >
                    {item.name}
                  </span>
                </div>

                <span
                  className={
                    item.statusClass
                  }
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </article>

        <article
          className={`${styles.panel} ${styles.startPanel}`}
        >
          <div>
            <h3
              className={styles.panelTitle}
            >
              Start with the project structure.
            </h3>

            <p
              className={
                styles.panelDescription
              }
            >
              Register the project, define its
              production locations, and prepare
              the foundation for location-based
              planning.
            </p>
          </div>

          <Link
            href="/dashboard/projects/setup"
            className={
              styles.primaryButton
            }
          >
            Configure project
          </Link>
        </article>
      </section>
    </div>
  )
}

