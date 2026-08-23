'use client';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useRouter } from 'next/navigation';

import { createClient } from '../../../../lib/supabase/client';

import centerStyles from './daily-reports-center.module.css';
import projectCenterStyles from './project-report-center.module.css';

const PROJECT_COVER_BUCKET =
  'project-covers';

const SIGNED_URL_DURATION =
  60 * 60;

function formatDate(value) {
  if (!value) {
    return '—';
  }

  const [year, month, day] =
    value.split('-');

  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  );

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  ).format(date);
}

function getLocalDateKey(
  date = new Date()
) {
  const year =
    date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function formatReportNumber(
  value
) {
  if (
    value === null ||
    value === undefined
  ) {
    return 'DR-—';
  }

  return `DR-${String(
    value
  ).padStart(4, '0')}`;
}

function formatStatus(status) {
  const labels = {
    draft: 'Draft',
    submitted: 'Submitted',
    reviewed: 'Reviewed',
    approved: 'Approved',
  };

  return (
    labels[status] ||
    status ||
    'Draft'
  );
}

function getWeatherLabel(report) {
  if (!report) {
    return '—';
  }

  return (
    report.weather_summary ||
    report.weather_condition ||
    '—'
  );
}

function formatProjectLocation(
  project
) {
  const parts = [
    project.city,
    project.state_region,
  ].filter(Boolean);

  if (
    parts.length > 0
  ) {
    return parts.join(', ');
  }

  return (
    project.country_code ||
    'Location not specified'
  );
}

function getStatusClass(
  status
) {
  switch (status) {
    case 'approved':
      return projectCenterStyles
        .statusApproved;

    case 'reviewed':
      return projectCenterStyles
        .statusReviewed;

    case 'submitted':
      return projectCenterStyles
        .statusSubmitted;

    default:
      return projectCenterStyles
        .statusDraft;
  }
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}) {
  return (
    <article
      className={
        projectCenterStyles.metricCard
      }
    >
      <span
        className={
          projectCenterStyles.metricIcon
        }
      >
        {icon}
      </span>

      <div
        className={
          projectCenterStyles.metricContent
        }
      >
        <span
          className={
            projectCenterStyles.metricLabel
          }
        >
          {label}
        </span>

        <strong
          className={
            projectCenterStyles.metricValue
          }
        >
          {value}
        </strong>

        <span
          className={
            projectCenterStyles.metricHelper
          }
        >
          {helper}
        </span>
      </div>
    </article>
  );
}

export default function DailyReportsPage() {
  const router =
    useRouter();

  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const [
    projects,
    setProjects,
  ] = useState([]);

  const [
    projectCoverUrls,
    setProjectCoverUrls,
  ] = useState({});

  const [
    projectProgressById,
    setProjectProgressById,
  ] = useState({});

  const [
    selectedProject,
    setSelectedProject,
  ] = useState(null);

  const [
    reports,
    setReports,
  ] = useState([]);

  const [
    todayReport,
    setTodayReport,
  ] = useState(null);

  const [
    workforceToday,
    setWorkforceToday,
  ] = useState(0);

  const [
    activitiesToday,
    setActivitiesToday,
  ] = useState(0);

  const [
    occurrencesToday,
    setOccurrencesToday,
  ] = useState(0);

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('');

  const [
    activeView,
    setActiveView,
  ] = useState('today');

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const today =
    getLocalDateKey();

  useEffect(() => {
    async function loadPage() {
      setIsLoading(true);
      setErrorMessage('');

      const params =
        new URLSearchParams(
          window.location.search
        );

      const projectId =
        params.get(
          'projectId'
        );

      const {
        data: userData,
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !userData?.user
      ) {
        setErrorMessage(
          'Your authenticated session could not be verified.'
        );

        setIsLoading(false);
        return;
      }

      const {
        data: projectData,
        error: projectError,
      } =
        await supabase
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
            cover_image_path,
            created_at
          `)
          .neq(
            'status',
            'archived'
          )
          .order(
            'created_at',
            {
              ascending: false,
            }
          );

      if (projectError) {
        setErrorMessage(
          projectError.message
        );

        setIsLoading(false);
        return;
      }

      const availableProjects =
        projectData || [];

      setProjects(
        availableProjects
      );

      // ------------------------------------------------------
      // CENTRAL PRODUCTION CONTROL PROGRESS
      // ------------------------------------------------------
      // This is the same portfolio-level source used by
      // Master Plan. Daily Reports does not recalculate
      // project progress independently.
      const {
        data: progressData,
        error: progressError,
      } =
        await supabase
          .from(
            'production_control_project_portfolio'
          )
          .select(`
            project_id,
            scope_item_count,
            not_started_count,
            in_progress_count,
            completed_count,
            overall_progress_percentage,
            last_production_date,
            has_production_scope
          `);

      if (progressError) {
        console.warn(
          'Daily Reports - Production Control progress:',
          progressError
        );

        setProjectProgressById(
          {}
        );
      } else {
        const progressMap =
          Object.fromEntries(
            (
              progressData ||
              []
            ).map(
              (item) => [
                item.project_id,
                item,
              ]
            )
          );

        setProjectProgressById(
          progressMap
        );
      }

      const coverEntries =
        await Promise.all(
          availableProjects.map(
            async (project) => {
              if (
                !project.cover_image_path
              ) {
                return [
                  project.id,
                  '',
                ];
              }

              const {
                data:
                  signedData,
              } =
                await supabase.storage
                  .from(
                    PROJECT_COVER_BUCKET
                  )
                  .createSignedUrl(
                    project.cover_image_path,
                    SIGNED_URL_DURATION
                  );

              return [
                project.id,
                signedData?.signedUrl ||
                  '',
              ];
            }
          )
        );

      setProjectCoverUrls(
        Object.fromEntries(
          coverEntries
        )
      );

      if (!projectId) {
        setSelectedProject(
          null
        );

        setReports([]);
        setTodayReport(null);
        setWorkforceToday(0);
        setActivitiesToday(0);
        setOccurrencesToday(0);

        setIsLoading(false);
        return;
      }

      const activeProject =
        availableProjects.find(
          (project) =>
            project.id ===
            projectId
        ) || null;

      if (!activeProject) {
        setErrorMessage(
          'The selected project could not be found.'
        );

        setSelectedProject(
          null
        );

        setIsLoading(false);
        return;
      }

      setSelectedProject(
        activeProject
      );

      const {
        data: reportsData,
        error: reportsError,
      } =
        await supabase
          .from(
            'daily_reports'
          )
          .select('*')
          .eq(
            'project_id',
            activeProject.id
          )
          .order(
            'report_date',
            {
              ascending:
                false,
            }
          )
          .order(
            'report_number',
            {
              ascending:
                false,
            }
          );

      if (reportsError) {
        setErrorMessage(
          reportsError.message
        );

        setIsLoading(false);
        return;
      }

      const loadedReports =
        reportsData || [];

      setReports(
        loadedReports
      );

      const currentReport =
        loadedReports.find(
          (report) =>
            report.report_date ===
            today
        ) || null;

      setTodayReport(
        currentReport
      );

      const snapshotReport =
        currentReport ||
        loadedReports[0] ||
        null;

      if (!snapshotReport) {
        setWorkforceToday(0);
        setActivitiesToday(0);
        setOccurrencesToday(0);

        setIsLoading(false);
        return;
      }

      const [
        workforceResult,
        activitiesResult,
        occurrencesResult,
      ] =
        await Promise.all([
          supabase
            .from(
              'daily_report_workforce_roles'
            )
            .select(
              'worker_count'
            )
            .eq(
              'daily_report_id',
              snapshotReport.id
            ),

          supabase
            .from(
              'daily_report_activities'
            )
            .select('id')
            .eq(
              'daily_report_id',
              snapshotReport.id
            ),

          supabase
            .from(
              'daily_report_occurrences'
            )
            .select('id')
            .eq(
              'daily_report_id',
              snapshotReport.id
            ),
        ]);

      if (
        !workforceResult.error
      ) {
        const total =
          (
            workforceResult.data ||
            []
          ).reduce(
            (
              sum,
              role
            ) =>
              sum +
              Number(
                role.worker_count ||
                  0
              ),
            0
          );

        setWorkforceToday(
          total
        );
      }

      setActivitiesToday(
        activitiesResult.data
          ?.length || 0
      );

      setOccurrencesToday(
        occurrencesResult.data
          ?.length || 0
      );

      setIsLoading(false);
    }

    loadPage();
  }, [
    supabase,
    today,
  ]);

  const latestReport =
    reports[0] || null;

  const draftReports =
    reports.filter(
      (report) =>
        report.status ===
        'draft'
    ).length;

  const filteredReports =
    useMemo(() => {
      const value =
        searchTerm
          .trim()
          .toLowerCase();

      if (!value) {
        return reports;
      }

      return reports.filter(
        (report) =>
          formatReportNumber(
            report.report_number
          )
            .toLowerCase()
            .includes(value) ||
          formatDate(
            report.report_date
          )
            .toLowerCase()
            .includes(value) ||
          formatStatus(
            report.status
          )
            .toLowerCase()
            .includes(value)
      );
    }, [
      reports,
      searchTerm,
    ]);

  function openProject(
    projectId
  ) {
    window.location.href =
      `/dashboard/projects/daily-reports?projectId=${projectId}`;
  }

  function openPortfolio() {
    window.location.href =
      '/dashboard/projects/daily-reports';
  }

  function openNewReport() {
    if (
      selectedProject?.id
    ) {
      router.push(
        `/dashboard/projects/daily-reports/new?projectId=${selectedProject.id}`
      );

      return;
    }

    router.push(
      '/dashboard/projects/daily-reports/new'
    );
  }

  function openReport(
    reportId
  ) {
    router.push(
      `/dashboard/projects/daily-reports/${reportId}`
    );
  }

  function openReportSection(
    section
  ) {
    const targetReport =
      todayReport ||
      latestReport;

    if (!targetReport) {
      openNewReport();
      return;
    }

    router.push(
      `/dashboard/projects/daily-reports/${targetReport.id}/${section}`
    );
  }

  if (isLoading) {
    return (
      <main
        className={
          centerStyles.page
        }
      >
        <section
          className={
            centerStyles.loadingPanel
          }
        >
          <div
            className={
              centerStyles.loadingMark
            }
          >
            DR
          </div>

          <div>
            <strong>
              Loading Daily Reports
            </strong>

            <p>
              Preparing project data...
            </p>
          </div>
        </section>
      </main>
    );
  }

  /*
   * ==========================================================
   * PROJECT SELECTION
   * ==========================================================
   */

  if (!selectedProject) {
    return (
      <main
        className={
          centerStyles.page
        }
      >
        <section
          className={
            centerStyles.portfolioHeader
          }
        >
          <div>
            <p
              className={
                centerStyles.eyebrow
              }
            >
              FIELD MANAGEMENT
            </p>

            <h1
              className={
                centerStyles.title
              }
            >
              Daily Reports
            </h1>

            <p
              className={
                centerStyles.description
              }
            >
              Select a project to
              access its Daily Reports.
            </p>
          </div>
        </section>

        {errorMessage && (
          <div
            className={
              centerStyles.errorMessage
            }
          >
            {errorMessage}
          </div>
        )}

        <section
          className={
            centerStyles.projectGrid
          }
        >
          {projects.map(
            (project) => {
              const coverUrl =
                projectCoverUrls[
                  project.id
                ] || '';

              const progressData =
                projectProgressById[
                  project.id
                ] || null;

              const hasProductionScope =
                Boolean(
                  progressData?.has_production_scope
                );

              const rawProgress =
                Number(
                  progressData?.overall_progress_percentage ??
                    0
                );

              const progress =
                hasProductionScope &&
                Number.isFinite(
                  rawProgress
                )
                  ? Math.max(
                      0,
                      Math.min(
                        100,
                        Math.round(
                          rawProgress
                        )
                      )
                    )
                  : null;

              const scopeItemCount =
                Number(
                  progressData?.scope_item_count ||
                    0
                );

              const completedCount =
                Number(
                  progressData?.completed_count ||
                    0
                );

              const inProgressCount =
                Number(
                  progressData?.in_progress_count ||
                    0
                );

              return (
                <button
                  type="button"
                  key={
                    project.id
                  }
                  className={
                    centerStyles.projectCard
                  }
                  onClick={() =>
                    openProject(
                      project.id
                    )
                  }
                >
                  <div
                    className={
                      centerStyles.coverArea
                    }
                  >
                    {coverUrl ? (
                      <img
                        src={
                          coverUrl
                        }
                        alt={`${project.name} project`}
                        className={
                          centerStyles.coverImage
                        }
                      />
                    ) : (
                      <div
                        className={
                          centerStyles.coverPlaceholder
                        }
                      >
                        <span
                          className={
                            centerStyles.coverPlaceholderCode
                          }
                        >
                          {project.code ||
                            'PROJECT'}
                        </span>

                        <strong>
                          Project image
                        </strong>

                        <small>
                          Add a cover photo
                          in Project Setup
                        </small>
                      </div>
                    )}

                    <div
                      className={
                        centerStyles.coverGradient
                      }
                    />

                    <div
                      className={
                        centerStyles.coverIdentity
                      }
                    >
                      <span
                        className={
                          centerStyles.coverProjectCode
                        }
                      >
                        {project.code ||
                          'Unassigned'}
                      </span>

                      <strong
                        className={
                          centerStyles.coverProjectName
                        }
                      >
                        {
                          project.name
                        }
                      </strong>
                    </div>
                  </div>

                  <div
                    className={
                      centerStyles.cardBody
                    }
                  >
                    <div
                      className={
                        centerStyles.projectDetails
                      }
                    >
                      <div>
                        <span
                          className={
                            centerStyles.projectLabel
                          }
                        >
                          PROJECT
                        </span>

                        <h2
                          className={
                            centerStyles.projectName
                          }
                        >
                          {
                            project.name
                          }
                        </h2>

                        <p
                          className={
                            centerStyles.projectMeta
                          }
                        >
                          {project.client_name ||
                            'Client not specified'}
                        </p>

                        <p
                          className={
                            centerStyles.projectLocation
                          }
                        >
                          {formatProjectLocation(
                            project
                          )}
                        </p>
                      </div>
                    </div>

                    <div
                      className={
                        centerStyles.progressSection
                      }
                    >
                      <div
                        className={
                          centerStyles.progressHeader
                        }
                      >
                        <span>
                          Overall Progress
                        </span>

                        <strong>
                          {progress ===
                          null
                            ? '—'
                            : `${progress}%`}
                        </strong>
                      </div>

                      <div
                        className={
                          centerStyles.progressTrack
                        }
                      >
                        <div
                          className={
                            centerStyles.progressFill
                          }
                          style={{
                            width:
                              progress ===
                              null
                                ? '0%'
                                : `${progress}%`,
                          }}
                        />
                      </div>

                      <p
                        className={
                          centerStyles.progressHelper
                        }
                      >
                        {progress === null
                          ? 'Production Control data not available yet.'
                          : `${completedCount} of ${scopeItemCount} scope items completed${
                              inProgressCount > 0
                                ? ` · ${inProgressCount} in progress`
                                : ''
                            }.`}
                      </p>
                    </div>

                    <div
                      className={
                        centerStyles.cardFooter
                      }
                    >
                      <span
                        className={
                          centerStyles.openProjectText
                        }
                      >
                        Open Project
                      </span>

                      <span
                        className={
                          centerStyles.openArrow
                        }
                      >
                        →
                      </span>
                    </div>
                  </div>
                </button>
              );
            }
          )}
        </section>
      </main>
    );
  }

  /*
   * ==========================================================
   * PROJECT DAILY REPORT CENTER — OPTION D
   * ==========================================================
   */

  const coverUrl =
    projectCoverUrls[
      selectedProject.id
    ] || '';

  return (
    <main
      className={
        projectCenterStyles.page
      }
    >
      <button
        type="button"
        onClick={
          openPortfolio
        }
        style={{
          width:
            'fit-content',
          padding: 0,
          border: 0,
          background:
            'transparent',
          color:
            '#087f73',
          cursor:
            'pointer',
          fontFamily:
            'inherit',
          fontSize:
            '0.68rem',
          fontWeight:
            850,
        }}
      >
        ← All Projects
      </button>

      <section
        className={
          projectCenterStyles.hero
        }
      >
        {coverUrl && (
          <img
            src={
              coverUrl
            }
            alt={`${selectedProject.name} project`}
            className={
              projectCenterStyles.heroImage
            }
          />
        )}

        <div
          className={
            projectCenterStyles.heroOverlay
          }
        />

        <div
          className={
            projectCenterStyles.heroContent
          }
        >
          <div
            className={
              projectCenterStyles.heroText
            }
          >
            <p
              className={
                projectCenterStyles.heroCode
              }
            >
              {selectedProject.code ||
                'Unassigned'}
              {' · '}
              {selectedProject.name}
            </p>

            <h1
              className={
                projectCenterStyles.heroTitle
              }
            >
              Daily Report Center
            </h1>

            <p
              className={
                projectCenterStyles.heroDescription
              }
            >
              Manage and monitor
              all Daily Reports
              for this project.
            </p>
          </div>

          <button
            type="button"
            className={
              projectCenterStyles.newReportButton
            }
            onClick={
              openNewReport
            }
          >
            + New Daily Report
          </button>
        </div>
      </section>

      <section
        className={
          projectCenterStyles.metricsGrid
        }
      >
        <MetricCard
          icon="DR"
          label="Reports"
          value={
            reports.length
          }
          helper="Total records"
        />

        <MetricCard
          icon="OP"
          label="Open"
          value={
            draftReports
          }
          helper="Draft reports"
        />

        <MetricCard
          icon="WF"
          label="Workforce today"
          value={
            workforceToday
          }
          helper="People on site"
        />

        <MetricCard
          icon="AC"
          label="Activities today"
          value={
            activitiesToday
          }
          helper="Recorded activities"
        />
      </section>

      <section
        className={
          projectCenterStyles.workspace
        }
      >
        <aside
          className={
            projectCenterStyles.sidebar
          }
        >
          <div
            className={
              projectCenterStyles.sidebarSection
            }
          >
            <p
              className={
                projectCenterStyles.sidebarEyebrow
              }
            >
              DAILY REPORTS
            </p>

            <nav
              className={
                projectCenterStyles.navigation
              }
            >
              <button
                type="button"
                className={`${projectCenterStyles.navButton} ${
                  activeView ===
                  'today'
                    ? projectCenterStyles.navButtonActive
                    : ''
                }`}
                onClick={() =>
                  setActiveView(
                    'today'
                  )
                }
              >
                <span
                  className={
                    projectCenterStyles.navIcon
                  }
                >
                  TD
                </span>

                <span>
                  <strong
                    className={
                      projectCenterStyles.navTitle
                    }
                  >
                    Today
                  </strong>

                  <span
                    className={
                      projectCenterStyles.navDescription
                    }
                  >
                    Latest Daily Report
                  </span>
                </span>
              </button>

              <button
                type="button"
                className={`${projectCenterStyles.navButton} ${
                  activeView ===
                  'history'
                    ? projectCenterStyles.navButtonActive
                    : ''
                }`}
                onClick={() =>
                  setActiveView(
                    'history'
                  )
                }
              >
                <span
                  className={
                    projectCenterStyles.navIcon
                  }
                >
                  HI
                </span>

                <span>
                  <strong
                    className={
                      projectCenterStyles.navTitle
                    }
                  >
                    Report History
                  </strong>

                  <span
                    className={
                      projectCenterStyles.navDescription
                    }
                  >
                    All project reports
                  </span>
                </span>
              </button>

              <button
                type="button"
                className={`${projectCenterStyles.navButton} ${
                  activeView ===
                  'snapshot'
                    ? projectCenterStyles.navButtonActive
                    : ''
                }`}
                onClick={() =>
                  setActiveView(
                    'snapshot'
                  )
                }
              >
                <span
                  className={
                    projectCenterStyles.navIcon
                  }
                >
                  FS
                </span>

                <span>
                  <strong
                    className={
                      projectCenterStyles.navTitle
                    }
                  >
                    Field Snapshot
                  </strong>

                  <span
                    className={
                      projectCenterStyles.navDescription
                    }
                  >
                    Today overview
                  </span>
                </span>
              </button>

              <button
                type="button"
                className={`${projectCenterStyles.navButton} ${
                  activeView ===
                  'production'
                    ? projectCenterStyles.navButtonActive
                    : ''
                }`}
                onClick={() =>
                  setActiveView(
                    'production'
                  )
                }
              >
                <span
                  className={
                    projectCenterStyles.navIcon
                  }
                >
                  PC
                </span>

                <span>
                  <strong
                    className={
                      projectCenterStyles.navTitle
                    }
                  >
                    Production Control
                  </strong>

                  <span
                    className={
                      projectCenterStyles.navDescription
                    }
                  >
                    Integration & progress
                  </span>
                </span>
              </button>
            </nav>
          </div>

          <div
            className={
              projectCenterStyles.sidebarSection
            }
          >
            <p
              className={
                projectCenterStyles.sidebarEyebrow
              }
            >
              QUICK ACTIONS
            </p>

            <div
              className={
                projectCenterStyles.quickActions
              }
            >
              <button
                type="button"
                className={
                  projectCenterStyles.quickAction
                }
                onClick={
                  openNewReport
                }
              >
                <span
                  className={
                    projectCenterStyles.quickActionIcon
                  }
                >
                  +
                </span>

                <span>
                  <strong
                    className={
                      projectCenterStyles.quickActionTitle
                    }
                  >
                    New Daily Report
                  </strong>

                  <span
                    className={
                      projectCenterStyles.quickActionDescription
                    }
                  >
                    Create a new report
                  </span>
                </span>
              </button>

              <button
                type="button"
                className={
                  projectCenterStyles.quickAction
                }
                onClick={() =>
                  openReportSection(
                    'production'
                  )
                }
              >
                <span
                  className={
                    projectCenterStyles.quickActionIcon
                  }
                >
                  PR
                </span>

                <span>
                  <strong
                    className={
                      projectCenterStyles.quickActionTitle
                    }
                  >
                    Production Entry
                  </strong>

                  <span
                    className={
                      projectCenterStyles.quickActionDescription
                    }
                  >
                    Update production data
                  </span>
                </span>
              </button>

              <button
                type="button"
                className={
                  projectCenterStyles.quickAction
                }
                onClick={() =>
                  openReportSection(
                    'issues'
                  )
                }
              >
                <span
                  className={
                    projectCenterStyles.quickActionIcon
                  }
                >
                  IS
                </span>

                <span>
                  <strong
                    className={
                      projectCenterStyles.quickActionTitle
                    }
                  >
                    New Issue
                  </strong>

                  <span
                    className={
                      projectCenterStyles.quickActionDescription
                    }
                  >
                    Report an issue
                  </span>
                </span>
              </button>

              <button
                type="button"
                className={
                  projectCenterStyles.quickAction
                }
                onClick={() =>
                  openReportSection(
                    'attachments'
                  )
                }
              >
                <span
                  className={
                    projectCenterStyles.quickActionIcon
                  }
                >
                  PH
                </span>

                <span>
                  <strong
                    className={
                      projectCenterStyles.quickActionTitle
                    }
                  >
                    Add Photo
                  </strong>

                  <span
                    className={
                      projectCenterStyles.quickActionDescription
                    }
                  >
                    Upload site photo
                  </span>
                </span>
              </button>
            </div>
          </div>
        </aside>

        <section
          className={
            projectCenterStyles.mainPanel
          }
        >
          {activeView ===
            'today' &&
            (latestReport ? (
              <>
                <header
                  className={
                    projectCenterStyles.panelHeader
                  }
                >
                  <div>
                    <p
                      className={
                        projectCenterStyles.panelEyebrow
                      }
                    >
                      LATEST DAILY REPORT
                    </p>

                    <h2
                      className={
                        projectCenterStyles.panelTitle
                      }
                    >
                      Today
                    </h2>

                    <p
                      className={
                        projectCenterStyles.panelDescription
                      }
                    >
                      Most recent field
                      record for this
                      project.
                    </p>
                  </div>

                  <span
                    className={`${projectCenterStyles.statusBadge} ${getStatusClass(
                      latestReport.status
                    )}`}
                  >
                    {formatStatus(
                      latestReport.status
                    )}
                  </span>
                </header>

                <div
                  className={
                    projectCenterStyles.latestReport
                  }
                >
                  <div
                    className={
                      projectCenterStyles.latestIdentity
                    }
                  >
                    <span
                      className={
                        projectCenterStyles.reportIcon
                      }
                    >
                      DR
                    </span>

                    <div>
                      <h3
                        className={
                          projectCenterStyles.reportNumber
                        }
                      >
                        {formatReportNumber(
                          latestReport.report_number
                        )}
                      </h3>

                      <p
                        className={
                          projectCenterStyles.reportDate
                        }
                      >
                        {formatDate(
                          latestReport.report_date
                        )}
                      </p>
                    </div>
                  </div>

                  <div
                    className={
                      projectCenterStyles.reportMetrics
                    }
                  >
                    <div
                      className={
                        projectCenterStyles.reportMetric
                      }
                    >
                      <span
                        className={
                          projectCenterStyles.reportMetricLabel
                        }
                      >
                        Weather
                      </span>

                      <strong
                        className={
                          projectCenterStyles.reportMetricValue
                        }
                      >
                        {getWeatherLabel(
                          latestReport
                        )}
                      </strong>
                    </div>

                    <div
                      className={
                        projectCenterStyles.reportMetric
                      }
                    >
                      <span
                        className={
                          projectCenterStyles.reportMetricLabel
                        }
                      >
                        Workforce
                      </span>

                      <strong
                        className={
                          projectCenterStyles.reportMetricValue
                        }
                      >
                        {workforceToday}
                      </strong>

                      <span
                        className={
                          projectCenterStyles.reportMetricHelper
                        }
                      >
                        People on site
                      </span>
                    </div>

                    <div
                      className={
                        projectCenterStyles.reportMetric
                      }
                    >
                      <span
                        className={
                          projectCenterStyles.reportMetricLabel
                        }
                      >
                        Activities
                      </span>

                      <strong
                        className={
                          projectCenterStyles.reportMetricValue
                        }
                      >
                        {activitiesToday}
                      </strong>

                      <span
                        className={
                          projectCenterStyles.reportMetricHelper
                        }
                      >
                        Recorded
                      </span>
                    </div>

                    <div
                      className={
                        projectCenterStyles.reportMetric
                      }
                    >
                      <span
                        className={
                          projectCenterStyles.reportMetricLabel
                        }
                      >
                        Occurrences
                      </span>

                      <strong
                        className={
                          projectCenterStyles.reportMetricValue
                        }
                      >
                        {occurrencesToday}
                      </strong>

                      <span
                        className={
                          projectCenterStyles.reportMetricHelper
                        }
                      >
                        Reported
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className={
                      projectCenterStyles.openReportButton
                    }
                    onClick={() =>
                      openReport(
                        latestReport.id
                      )
                    }
                  >
                    <span>
                      Open Report
                    </span>

                    <span
                      className={
                        projectCenterStyles.openReportArrow
                      }
                    >
                      →
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div
                className={
                  projectCenterStyles.emptyPanel
                }
              >
                <span
                  className={
                    projectCenterStyles.emptyIcon
                  }
                >
                  DR
                </span>

                <h2
                  className={
                    projectCenterStyles.emptyTitle
                  }
                >
                  No Daily Reports yet
                </h2>

                <p
                  className={
                    projectCenterStyles.emptyDescription
                  }
                >
                  Create the first
                  Daily Report for
                  this project.
                </p>

                <button
                  type="button"
                  className={
                    projectCenterStyles.newReportButton
                  }
                  onClick={
                    openNewReport
                  }
                >
                  + New Daily Report
                </button>
              </div>
            ))}

          {activeView ===
            'history' && (
            <>
              <header
                className={
                  projectCenterStyles.panelHeader
                }
              >
                <div>
                  <p
                    className={
                      projectCenterStyles.panelEyebrow
                    }
                  >
                    DAILY REPORTS
                  </p>

                  <h2
                    className={
                      projectCenterStyles.panelTitle
                    }
                  >
                    Report History
                  </h2>

                  <p
                    className={
                      projectCenterStyles.panelDescription
                    }
                  >
                    All field records
                    for this project.
                  </p>
                </div>
              </header>

              <div
                className={
                  projectCenterStyles.historyToolbar
                }
              >
                <input
                  className={
                    projectCenterStyles.searchInput
                  }
                  type="search"
                  placeholder="Search reports..."
                  value={
                    searchTerm
                  }
                  onChange={(
                    event
                  ) =>
                    setSearchTerm(
                      event.target
                        .value
                    )
                  }
                />

                <button
                  type="button"
                  className={
                    projectCenterStyles.filterButton
                  }
                >
                  Filters
                </button>
              </div>

              <div
                className={
                  projectCenterStyles.historyList
                }
              >
                {filteredReports.map(
                  (report) => (
                    <div
                      key={
                        report.id
                      }
                      className={
                        projectCenterStyles.historyRow
                      }
                    >
                      <button
                        type="button"
                        className={
                          projectCenterStyles.historyReportButton
                        }
                        onClick={() =>
                          openReport(
                            report.id
                          )
                        }
                      >
                        {formatReportNumber(
                          report.report_number
                        )}
                      </button>

                      <span
                        className={
                          projectCenterStyles.historyDate
                        }
                      >
                        {formatDate(
                          report.report_date
                        )}
                      </span>

                      <span
                        className={
                          projectCenterStyles.historyWeather
                        }
                      >
                        {getWeatherLabel(
                          report
                        )}
                      </span>

                      <span
                        className={`${projectCenterStyles.statusBadge} ${getStatusClass(
                          report.status
                        )}`}
                      >
                        {formatStatus(
                          report.status
                        )}
                      </span>
                    </div>
                  )
                )}
              </div>
            </>
          )}

          {activeView ===
            'snapshot' && (
            <>
              <header
                className={
                  projectCenterStyles.panelHeader
                }
              >
                <div>
                  <p
                    className={
                      projectCenterStyles.panelEyebrow
                    }
                  >
                    TODAY
                  </p>

                  <h2
                    className={
                      projectCenterStyles.panelTitle
                    }
                  >
                    Field Snapshot
                  </h2>

                  <p
                    className={
                      projectCenterStyles.panelDescription
                    }
                  >
                    Current field
                    condition overview.
                  </p>
                </div>
              </header>

              <div
                className={
                  projectCenterStyles.snapshotGrid
                }
              >
                <article
                  className={
                    projectCenterStyles.snapshotCard
                  }
                >
                  <span
                    className={
                      projectCenterStyles.snapshotLabel
                    }
                  >
                    Weather
                  </span>

                  <strong
                    className={
                      projectCenterStyles.snapshotValue
                    }
                  >
                    {getWeatherLabel(
                      todayReport ||
                        latestReport
                    )}
                  </strong>
                </article>

                <article
                  className={
                    projectCenterStyles.snapshotCard
                  }
                >
                  <span
                    className={
                      projectCenterStyles.snapshotLabel
                    }
                  >
                    Workforce
                  </span>

                  <strong
                    className={
                      projectCenterStyles.snapshotValue
                    }
                  >
                    {workforceToday}
                  </strong>
                </article>

                <article
                  className={
                    projectCenterStyles.snapshotCard
                  }
                >
                  <span
                    className={
                      projectCenterStyles.snapshotLabel
                    }
                  >
                    Activities
                  </span>

                  <strong
                    className={
                      projectCenterStyles.snapshotValue
                    }
                  >
                    {activitiesToday}
                  </strong>
                </article>

                <article
                  className={
                    projectCenterStyles.snapshotCard
                  }
                >
                  <span
                    className={
                      projectCenterStyles.snapshotLabel
                    }
                  >
                    Occurrences
                  </span>

                  <strong
                    className={
                      projectCenterStyles.snapshotValue
                    }
                  >
                    {occurrencesToday}
                  </strong>
                </article>
              </div>
            </>
          )}

          {activeView ===
            'production' && (
            <>
              <header
                className={
                  projectCenterStyles.panelHeader
                }
              >
                <div>
                  <p
                    className={
                      projectCenterStyles.panelEyebrow
                    }
                  >
                    INTEGRATION
                  </p>

                  <h2
                    className={
                      projectCenterStyles.panelTitle
                    }
                  >
                    Production Control
                  </h2>

                  <p
                    className={
                      projectCenterStyles.panelDescription
                    }
                  >
                    Connection between
                    field reporting and
                    production control.
                  </p>
                </div>
              </header>

              <div
                className={
                  projectCenterStyles.productionPanel
                }
              >
                <div
                  className={
                    projectCenterStyles.productionFlow
                  }
                >
                  <div
                    className={
                      projectCenterStyles.productionNode
                    }
                  >
                    <strong>
                      Planning
                    </strong>

                    <span>
                      Planned work
                    </span>
                  </div>

                  <span
                    className={
                      projectCenterStyles.productionArrow
                    }
                  >
                    →
                  </span>

                  <div
                    className={
                      projectCenterStyles.productionNode
                    }
                  >
                    <strong>
                      Daily Report
                    </strong>

                    <span>
                      Field record
                    </span>
                  </div>

                  <span
                    className={
                      projectCenterStyles.productionArrow
                    }
                  >
                    →
                  </span>

                  <div
                    className={
                      projectCenterStyles.productionNode
                    }
                  >
                    <strong>
                      Production Data
                    </strong>

                    <span>
                      Actual quantities
                    </span>
                  </div>

                  <span
                    className={
                      projectCenterStyles.productionArrow
                    }
                  >
                    →
                  </span>

                  <div
                    className={
                      projectCenterStyles.productionNode
                    }
                  >
                    <strong>
                      Control
                    </strong>

                    <span>
                      Status & progress
                    </span>
                  </div>
                </div>

                <p
                  className={
                    projectCenterStyles.integrationNotice
                  }
                >
                  Production Control
                  integration will use
                  the central production
                  status source when that
                  layer is implemented.
                </p>
              </div>
            </>
          )}
        </section>
      </section>
    </main>
  );
}
