'use client';

import React, {
  useEffect,
  useMemo,
  useState
} from 'react';

import { supabase } from '../../../../lib/supabase';


// ============================================================
// RITSUFLOW™
// PULL PLANNING - SESSION WORKSPACE
//
// PHASE 1 APPLICATION LAYER
//
// Purpose:
//   - Select project
//   - Create Pull Planning session
//   - Create primary Pull milestone
//   - List project sessions
//   - Open/review a session
//   - Manage session lifecycle
//
// Lifecycle:
//
// DRAFT
//   ↓
// IN SESSION
//   ↓
// VALIDATION
//   ↓
// PUBLISHED
//   ↓
// ARCHIVED
//
// IMPORTANT:
//
// This page DOES NOT yet create:
//
//   - sticky notes
//   - production activities
//   - handoffs
//   - dependency arrows
//   - Pull canvas
//
// Those will be layered on top after this session
// foundation is validated.
// ============================================================


// ============================================================
// CONSTANTS
// ============================================================

const SESSION_STATUSES = [
  'draft',
  'in_session',
  'validation',
  'published',
  'archived'
];

const STATUS_LABELS = {
  draft: 'Draft',
  in_session: 'In Session',
  validation: 'Validation',
  published: 'Published',
  archived: 'Archived'
};

const STATUS_DESCRIPTIONS = {
  draft:
    'Session created but collaborative planning has not started.',

  in_session:
    'The Last Planner team is actively building the Pull Plan.',

  validation:
    'Backward planning is complete and the plan is under forward validation.',

  published:
    'The Pull Plan has been validated and published for downstream planning.',

  archived:
    'Historical session retained for traceability.'
};

const STATUS_STYLES = {
  draft: {
    background: '#f1f5f9',
    color: '#475569',
    border: '#cbd5e1'
  },

  in_session: {
    background: '#ecfeff',
    color: '#0e7490',
    border: '#a5f3fc'
  },

  validation: {
    background: '#fff7ed',
    color: '#c2410c',
    border: '#fed7aa'
  },

  published: {
    background: '#ecfdf5',
    color: '#047857',
    border: '#a7f3d0'
  },

  archived: {
    background: '#f8fafc',
    color: '#64748b',
    border: '#e2e8f0'
  }
};


// ============================================================
// HELPERS
// ============================================================

const formatDate = (value) => {
  if (!value) return '—';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }
  );
};


const formatDateTime = (value) => {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(
    'en-US',
    {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }
  );
};


const getNextStatus = (status) => {
  const index =
    SESSION_STATUSES.indexOf(
      status
    );

  if (
    index < 0 ||
    index >= SESSION_STATUSES.length - 1
  ) {
    return null;
  }

  return SESSION_STATUSES[
    index + 1
  ];
};


const getPreviousStatus = (
  status
) => {
  const index =
    SESSION_STATUSES.indexOf(
      status
    );

  if (index <= 0) {
    return null;
  }

  return SESSION_STATUSES[
    index - 1
  ];
};


// ============================================================
// MAIN PAGE
// ============================================================

export default function PullPlanningPage() {

  // ----------------------------------------------------------
  // PROJECTS
  // ----------------------------------------------------------

  const [
    projects,
    setProjects
  ] = useState([]);

  const [
    projectId,
    setProjectId
  ] = useState('');

  const [
    projectCoverUrls,
    setProjectCoverUrls
  ] = useState({});


  // ----------------------------------------------------------
  // SESSIONS
  // ----------------------------------------------------------

  const [
    sessions,
    setSessions
  ] = useState([]);

  const [
    selectedSessionId,
    setSelectedSessionId
  ] = useState(null);

  const [
    milestonesBySession,
    setMilestonesBySession
  ] = useState({});


  // ----------------------------------------------------------
  // CREATE SESSION MODAL
  // ----------------------------------------------------------

  const [
    showCreateModal,
    setShowCreateModal
  ] = useState(false);

  const [
    sessionName,
    setSessionName
  ] = useState('');

  const [
    phaseName,
    setPhaseName
  ] = useState('');

  const [
    sessionDescription,
    setSessionDescription
  ] = useState('');

  const [
    sessionDate,
    setSessionDate
  ] = useState('');

  const [
    horizonStart,
    setHorizonStart
  ] = useState('');

  const [
    horizonEnd,
    setHorizonEnd
  ] = useState('');

  const [
    milestoneName,
    setMilestoneName
  ] = useState('');

  const [
    milestoneTargetDate,
    setMilestoneTargetDate
  ] = useState('');


  // ----------------------------------------------------------
  // SYSTEM STATE
  // ----------------------------------------------------------

  const [
    loadingProjects,
    setLoadingProjects
  ] = useState(true);

  const [
    loadingSessions,
    setLoadingSessions
  ] = useState(false);

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage
  ] = useState('');


  // ==========================================================
  // CURRENT PROJECT
  // ==========================================================

  const selectedProject =
    useMemo(
      () =>
        projects.find(
          (project) =>
            project.id ===
            projectId
        ) || null,
      [
        projects,
        projectId
      ]
    );


  // ==========================================================
  // CURRENT SESSION
  // ==========================================================

  const selectedSession =
    useMemo(
      () =>
        sessions.find(
          (session) =>
            session.id ===
            selectedSessionId
        ) || null,
      [
        sessions,
        selectedSessionId
      ]
    );


  const selectedMilestones =
    selectedSessionId
      ? (
          milestonesBySession[
            selectedSessionId
          ] || []
        )
      : [];


  const primaryMilestone =
    selectedMilestones.find(
      (milestone) =>
        milestone.is_primary
    ) ||
    selectedMilestones[0] ||
    null;


  // ==========================================================
  // INITIAL PROJECT LOAD
  // ==========================================================

  useEffect(
    () => {

      const loadProjects =
        async () => {

          setLoadingProjects(
            true
          );

          setErrorMessage('');

          try {

            const {
              data,
              error
            } =
              await supabase
                .from(
                  'projects'
                )
                .select(`
                  id,
                  organization_id,
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
                    ascending:
                      false
                  }
                );

            if (error) {
              throw error;
            }

            const loadedProjects =
              data || [];

            setProjects(
              loadedProjects
            );


            // ----------------------------------------------
            // Restore project from URL
            // ----------------------------------------------

            const params =
              new URLSearchParams(
                window.location.search
              );

            const projectFromUrl =
              params.get(
                'projectId'
              );

            if (
              projectFromUrl &&
              loadedProjects.some(
                (project) =>
                  project.id ===
                  projectFromUrl
              )
            ) {
              setProjectId(
                projectFromUrl
              );
            }


            // ----------------------------------------------
            // Project cover images
            // ----------------------------------------------

            const coverEntries =
              await Promise.all(
                loadedProjects.map(
                  async (
                    project
                  ) => {

                    if (
                      !project
                        .cover_image_path
                    ) {
                      return [
                        project.id,
                        ''
                      ];
                    }

                    const {
                      data:
                        signedData,
                      error:
                        signedError
                    } =
                      await supabase
                        .storage
                        .from(
                          'project-covers'
                        )
                        .createSignedUrl(
                          project
                            .cover_image_path,
                          60 * 60
                        );

                    if (
                      signedError
                    ) {
                      console.warn(
                        'Pull Planning - cover:',
                        signedError
                      );

                      return [
                        project.id,
                        ''
                      ];
                    }

                    return [
                      project.id,
                      signedData
                        ?.signedUrl ||
                        ''
                    ];
                  }
                )
              );

            setProjectCoverUrls(
              Object.fromEntries(
                coverEntries
              )
            );

          } catch (error) {

            console.error(
              'Pull Planning - load projects:',
              error
            );

            setErrorMessage(
              error?.message ||
              'Projects could not be loaded.'
            );

          } finally {

            setLoadingProjects(
              false
            );

          }
        };

      loadProjects();

    },
    []
  );


  // ==========================================================
  // LOAD SESSIONS
  // ==========================================================

  useEffect(
    () => {

      if (!projectId) {

        setSessions([]);
        setMilestonesBySession(
          {}
        );

        setSelectedSessionId(
          null
        );

        return;

      }


      const loadSessions =
        async () => {

          setLoadingSessions(
            true
          );

          setErrorMessage('');

          try {

            const {
              data:
                sessionData,
              error:
                sessionError
            } =
              await supabase
                .from(
                  'pull_planning_sessions'
                )
                .select(`
                  id,
                  organization_id,
                  project_id,
                  name,
                  phase_name,
                  description,
                  session_date,
                  planning_horizon_start,
                  planning_horizon_end,
                  status,
                  published_at,
                  archived_at,
                  created_by,
                  created_at,
                  updated_at
                `)
                .eq(
                  'project_id',
                  projectId
                )
                .order(
                  'updated_at',
                  {
                    ascending:
                      false
                  }
                );

            if (
              sessionError
            ) {
              throw sessionError;
            }

            const loadedSessions =
              sessionData || [];

            setSessions(
              loadedSessions
            );


            // ----------------------------------------------
            // Load milestones for all project sessions
            // ----------------------------------------------

            if (
              loadedSessions.length ===
              0
            ) {

              setMilestonesBySession(
                {}
              );

              setSelectedSessionId(
                null
              );

              return;

            }

            const sessionIds =
              loadedSessions.map(
                (session) =>
                  session.id
              );

            const {
              data:
                milestoneData,
              error:
                milestoneError
            } =
              await supabase
                .from(
                  'pull_planning_milestones'
                )
                .select(`
                  id,
                  organization_id,
                  project_id,
                  pull_planning_session_id,
                  location_id,
                  name,
                  description,
                  target_date,
                  source_type,
                  source_entity_type,
                  source_entity_id,
                  source_name_snapshot,
                  source_target_date_snapshot,
                  is_primary,
                  sequence_number,
                  notes,
                  created_at,
                  updated_at
                `)
                .in(
                  'pull_planning_session_id',
                  sessionIds
                )
                .order(
                  'sequence_number',
                  {
                    ascending:
                      true
                  }
                );

            if (
              milestoneError
            ) {
              throw milestoneError;
            }

            const grouped = {};

            (
              milestoneData ||
              []
            ).forEach(
              (
                milestone
              ) => {

                const key =
                  milestone
                    .pull_planning_session_id;

                if (
                  !grouped[
                    key
                  ]
                ) {
                  grouped[
                    key
                  ] = [];
                }

                grouped[
                  key
                ].push(
                  milestone
                );

              }
            );

            setMilestonesBySession(
              grouped
            );


            // ----------------------------------------------
            // Restore session from URL
            // ----------------------------------------------

            const params =
              new URLSearchParams(
                window.location.search
              );

            const sessionFromUrl =
              params.get(
                'sessionId'
              );

            if (
              sessionFromUrl &&
              loadedSessions.some(
                (session) =>
                  session.id ===
                  sessionFromUrl
              )
            ) {
              setSelectedSessionId(
                sessionFromUrl
              );
            }

          } catch (error) {

            console.error(
              'Pull Planning - load sessions:',
              error
            );

            setErrorMessage(
              error?.message ||
              'Pull Planning sessions could not be loaded.'
            );

          } finally {

            setLoadingSessions(
              false
            );

          }
        };

      loadSessions();

    },
    [
      projectId
    ]
  );


  // ==========================================================
  // RESET FORM
  // ==========================================================

  const resetCreateForm =
    () => {

      const today =
        new Date()
          .toISOString()
          .slice(
            0,
            10
          );

      setSessionName('');
      setPhaseName('');
      setSessionDescription('');
      setSessionDate(
        today
      );
      setHorizonStart('');
      setHorizonEnd('');
      setMilestoneName('');
      setMilestoneTargetDate('');

    };


  // ==========================================================
  // OPEN CREATE MODAL
  // ==========================================================

  const openCreateModal =
    () => {

      resetCreateForm();
      setErrorMessage('');
      setShowCreateModal(
        true
      );

    };


  // ==========================================================
  // CREATE SESSION
  // ==========================================================

  const createSession =
    async (
      event
    ) => {

      event.preventDefault();

      if (
        !selectedProject
      ) {
        return;
      }

      if (
        !sessionName.trim() ||
        !phaseName.trim() ||
        !milestoneName.trim() ||
        !milestoneTargetDate
      ) {

        setErrorMessage(
          'Session name, phase, milestone and target date are required.'
        );

        return;
      }


      if (
        horizonStart &&
        horizonEnd &&
        horizonEnd <
          horizonStart
      ) {

        setErrorMessage(
          'Planning horizon end cannot be before the start date.'
        );

        return;
      }


      setSaving(
        true
      );

      setErrorMessage('');

      let createdSessionId =
        null;


      try {

        // ----------------------------------------------
        // Current authenticated user
        // ----------------------------------------------

        const {
          data:
            userResult,
          error:
            userError
        } =
          await supabase
            .auth
            .getUser();

        if (
          userError
        ) {
          throw userError;
        }

        const currentUser =
          userResult?.user ||
          null;


        // ----------------------------------------------
        // Create session
        // ----------------------------------------------

        const {
          data:
            createdSession,
          error:
            sessionError
        } =
          await supabase
            .from(
              'pull_planning_sessions'
            )
            .insert({
              organization_id:
                selectedProject
                  .organization_id,

              project_id:
                selectedProject.id,

              name:
                sessionName.trim(),

              phase_name:
                phaseName.trim(),

              description:
                sessionDescription
                  .trim() ||
                null,

              session_date:
                sessionDate ||
                null,

              planning_horizon_start:
                horizonStart ||
                null,

              planning_horizon_end:
                horizonEnd ||
                null,

              status:
                'draft',

              created_by:
                currentUser?.id ||
                null
            })
            .select(`
              id,
              organization_id,
              project_id,
              name,
              phase_name,
              description,
              session_date,
              planning_horizon_start,
              planning_horizon_end,
              status,
              published_at,
              archived_at,
              created_by,
              created_at,
              updated_at
            `)
            .single();


        if (
          sessionError
        ) {
          throw sessionError;
        }

        createdSessionId =
          createdSession.id;


        // ----------------------------------------------
        // Create primary Pull milestone
        // ----------------------------------------------

        const {
          data:
            createdMilestone,
          error:
            milestoneError
        } =
          await supabase
            .from(
              'pull_planning_milestones'
            )
            .insert({
              organization_id:
                selectedProject
                  .organization_id,

              project_id:
                selectedProject.id,

              pull_planning_session_id:
                createdSession.id,

              name:
                milestoneName.trim(),

              target_date:
                milestoneTargetDate,

              source_type:
                'pull_planning',

              is_primary:
                true,

              sequence_number:
                1
            })
            .select(`
              id,
              organization_id,
              project_id,
              pull_planning_session_id,
              location_id,
              name,
              description,
              target_date,
              source_type,
              source_entity_type,
              source_entity_id,
              source_name_snapshot,
              source_target_date_snapshot,
              is_primary,
              sequence_number,
              notes,
              created_at,
              updated_at
            `)
            .single();


        if (
          milestoneError
        ) {

          // --------------------------------------------
          // Client-side cleanup.
          //
          // SQL 129 uses cascading milestone ownership,
          // so deleting the failed parent session is safe.
          // --------------------------------------------

          await supabase
            .from(
              'pull_planning_sessions'
            )
            .delete()
            .eq(
              'id',
              createdSession.id
            )
            .eq(
              'project_id',
              selectedProject.id
            );

          createdSessionId =
            null;

          throw milestoneError;

        }


        // ----------------------------------------------
        // Update local state
        // ----------------------------------------------

        setSessions(
          (
            current
          ) => [
            createdSession,
            ...current
          ]
        );

        setMilestonesBySession(
          (
            current
          ) => ({
            ...current,

            [
              createdSession.id
            ]: [
              createdMilestone
            ]
          })
        );

        setSelectedSessionId(
          createdSession.id
        );

        setShowCreateModal(
          false
        );


        window.history
          .replaceState(
            {},
            '',
            `/dashboard/projetos/pullplanning?projectId=${selectedProject.id}&sessionId=${createdSession.id}`
          );

      } catch (error) {

        console.error(
          'Pull Planning - create session:',
          error
        );

        setErrorMessage(
          error?.message ||
          'The Pull Planning session could not be created.'
        );

      } finally {

        setSaving(
          false
        );

      }
    };


  // ==========================================================
  // OPEN SESSION
  // ==========================================================

  const openSession =
    (
      sessionId
    ) => {

      setSelectedSessionId(
        sessionId
      );

      window.history
        .replaceState(
          {},
          '',
          `/dashboard/projetos/pullplanning?projectId=${projectId}&sessionId=${sessionId}`
        );

    };


  // ==========================================================
  // CLOSE SESSION DETAIL
  // ==========================================================

  const closeSession =
    () => {

      setSelectedSessionId(
        null
      );

      window.history
        .replaceState(
          {},
          '',
          `/dashboard/projetos/pullplanning?projectId=${projectId}`
        );

    };


  // ==========================================================
  // CHANGE PROJECT
  // ==========================================================

  const changeProject =
    (
      newProjectId
    ) => {

      setProjectId(
        newProjectId
      );

      setSelectedSessionId(
        null
      );

      if (
        newProjectId
      ) {

        window.history
          .replaceState(
            {},
            '',
            `/dashboard/projetos/pullplanning?projectId=${newProjectId}`
          );

      } else {

        window.history
          .replaceState(
            {},
            '',
            '/dashboard/projetos/pullplanning'
          );

      }
    };


  // ==========================================================
  // UPDATE SESSION STATUS
  // ==========================================================

  const updateSessionStatus =
    async (
      newStatus
    ) => {

      if (
        !selectedSession ||
        !projectId ||
        saving
      ) {
        return;
      }

      if (
        !SESSION_STATUSES.includes(
          newStatus
        )
      ) {
        return;
      }


      const currentLabel =
        STATUS_LABELS[
          selectedSession.status
        ] ||
        selectedSession.status;

      const targetLabel =
        STATUS_LABELS[
          newStatus
        ] ||
        newStatus;


      const confirmed =
        window.confirm(
          `Change this Pull Planning session from "${currentLabel}" to "${targetLabel}"?`
        );

      if (
        !confirmed
      ) {
        return;
      }


      setSaving(
        true
      );

      setErrorMessage('');


      try {

        const payload = {
          status:
            newStatus
        };


        if (
          newStatus ===
          'published'
        ) {

          payload.published_at =
            new Date()
              .toISOString();

        }


        if (
          newStatus ===
          'archived'
        ) {

          payload.archived_at =
            new Date()
              .toISOString();

        }


        const {
          data,
          error
        } =
          await supabase
            .from(
              'pull_planning_sessions'
            )
            .update(
              payload
            )
            .eq(
              'id',
              selectedSession.id
            )
            .eq(
              'project_id',
              projectId
            )
            .select(`
              id,
              organization_id,
              project_id,
              name,
              phase_name,
              description,
              session_date,
              planning_horizon_start,
              planning_horizon_end,
              status,
              published_at,
              archived_at,
              created_by,
              created_at,
              updated_at
            `)
            .single();


        if (
          error
        ) {
          throw error;
        }


        setSessions(
          (
            current
          ) =>
            current.map(
              (
                session
              ) =>
                session.id ===
                data.id
                  ? data
                  : session
            )
        );

      } catch (error) {

        console.error(
          'Pull Planning - status:',
          error
        );

        setErrorMessage(
          error?.message ||
          'Session status could not be updated.'
        );

      } finally {

        setSaving(
          false
        );

      }
    };


  // ==========================================================
  // PROJECT PORTFOLIO
  // ==========================================================

  if (
    !projectId
  ) {

    return (

      <main
        style={{
          minHeight:
            'calc(100vh - 80px)',

          padding:
            '24px 22px 50px',

          background:
            'radial-gradient(circle at top right, rgba(8,170,150,0.06), transparent 28%), #f8fafc',

          fontFamily:
            'sans-serif'
        }}
      >

        <section
          style={{
            marginBottom:
              '30px'
          }}
        >

          <p
            style={{
              margin:
                '0 0 10px',

              color:
                '#009f8e',

              fontSize:
                '0.78rem',

              fontWeight:
                900,

              letterSpacing:
                '0.13em',

              textTransform:
                'uppercase'
            }}
          >
            LAST PLANNER SYSTEM
          </p>


          <h1
            style={{
              margin:
                0,

              color:
                '#061b2f',

              fontSize:
                '3.35rem',

              lineHeight:
                1,

              fontWeight:
                900,

              letterSpacing:
                '-0.04em'
            }}
          >
            Pull Planning
          </h1>


          <p
            style={{
              margin:
                '18px 0 0',

              color:
                '#536a86',

              fontSize:
                '0.95rem',

              maxWidth:
                '700px',

              lineHeight:
                1.6
            }}
          >
            Select a project to create or continue a collaborative phase planning session.
          </p>

        </section>


        {errorMessage && (

          <div
            style={{
              marginBottom:
                '20px',

              padding:
                '13px 15px',

              border:
                '1px solid #fecaca',

              borderRadius:
                '9px',

              background:
                '#fff1f2',

              color:
                '#be123c',

              fontSize:
                '0.8rem',

              fontWeight:
                700
            }}
          >
            {errorMessage}
          </div>

        )}


        {loadingProjects ? (

          <div
            style={{
              padding:
                '28px',

              color:
                '#64748b'
            }}
          >
            Loading projects...
          </div>

        ) : projects.length === 0 ? (

          <div
            style={{
              maxWidth:
                '620px',

              padding:
                '28px',

              border:
                '1px dashed #cbd5e1',

              borderRadius:
                '14px',

              background:
                '#fff',

              color:
                '#64748b'
            }}
          >
            No projects are available for Pull Planning.
          </div>

        ) : (

          <section
            style={{
              display:
                'grid',

              gridTemplateColumns:
                'repeat(auto-fill, minmax(330px, 365px))',

              gap:
                '22px',

              alignItems:
                'start'
            }}
          >

            {projects.map(
              (
                project
              ) => {

                const coverUrl =
                  projectCoverUrls[
                    project.id
                  ];

                const locationText =
                  [
                    project.city,
                    project
                      .state_region
                  ]
                    .filter(
                      Boolean
                    )
                    .join(
                      ', '
                    );


                return (

                  <article
                    key={
                      project.id
                    }
                    style={{
                      overflow:
                        'hidden',

                      border:
                        '1px solid #d9e2ec',

                      borderRadius:
                        '15px',

                      background:
                        '#fff',

                      boxShadow:
                        '0 14px 30px rgba(15,23,42,0.055)'
                    }}
                  >

                    <div
                      style={{
                        position:
                          'relative',

                        height:
                          '215px',

                        overflow:
                          'hidden',

                        background:
                          'linear-gradient(135deg,#173b5f,#2f6e78)'
                      }}
                    >

                      {coverUrl ? (

                        <img
                          src={
                            coverUrl
                          }
                          alt={`${project.name} project`}
                          style={{
                            width:
                              '100%',

                            height:
                              '100%',

                            objectFit:
                              'cover',

                            display:
                              'block'
                          }}
                        />

                      ) : (

                        <div
                          style={{
                            width:
                              '100%',

                            height:
                              '100%',

                            display:
                              'flex',

                            alignItems:
                              'center',

                            justifyContent:
                              'center',

                            color:
                              'rgba(255,255,255,0.72)',

                            fontSize:
                              '0.8rem',

                            fontWeight:
                              800,

                            letterSpacing:
                              '0.08em'
                          }}
                        >
                          PROJECT COVER
                        </div>

                      )}


                      <div
                        style={{
                          position:
                            'absolute',

                          inset:
                            0,

                          background:
                            'linear-gradient(to top, rgba(4,24,43,0.88), rgba(4,24,43,0.08))'
                        }}
                      />


                      <div
                        style={{
                          position:
                            'absolute',

                          left:
                            '18px',

                          right:
                            '18px',

                          bottom:
                            '17px',

                          color:
                            '#fff'
                        }}
                      >

                        <div
                          style={{
                            marginBottom:
                              '6px',

                            fontSize:
                              '0.68rem',

                            fontWeight:
                              900,

                            letterSpacing:
                              '0.12em'
                          }}
                        >
                          {project.code ||
                            'UNASSIGNED'}
                        </div>


                        <div
                          style={{
                            fontSize:
                              '1.05rem',

                            fontWeight:
                              900,

                            textTransform:
                              'uppercase'
                          }}
                        >
                          {project.name}
                        </div>

                      </div>

                    </div>


                    <div
                      style={{
                        padding:
                          '18px 19px 16px'
                      }}
                    >

                      <p
                        style={{
                          margin:
                            '0 0 7px',

                          color:
                            '#00a18f',

                          fontSize:
                            '0.63rem',

                          fontWeight:
                            900,

                          letterSpacing:
                            '0.13em'
                        }}
                      >
                        PULL PLANNING
                      </p>


                      <h2
                        style={{
                          margin:
                            '0 0 7px',

                          color:
                            '#061b2f',

                          fontSize:
                            '1.05rem',

                          fontWeight:
                            900
                        }}
                      >
                        {project.name}
                      </h2>


                      <p
                        style={{
                          margin:
                            '0 0 5px',

                          color:
                            '#536a86',

                          fontSize:
                            '0.78rem'
                        }}
                      >
                        {project.client_name ||
                          'Client not assigned'}
                      </p>


                      <p
                        style={{
                          margin:
                            0,

                          color:
                            '#7890a8',

                          fontSize:
                            '0.74rem'
                        }}
                      >
                        {locationText ||
                          project.country_code ||
                          'Location not assigned'}
                      </p>

                    </div>


                    <button
                      type="button"
                      onClick={() =>
                        changeProject(
                          project.id
                        )
                      }
                      style={{
                        width:
                          '100%',

                        minHeight:
                          '48px',

                        padding:
                          '0 19px',

                        display:
                          'flex',

                        alignItems:
                          'center',

                        justifyContent:
                          'space-between',

                        border:
                          0,

                        borderTop:
                          '1px solid #e6edf3',

                        background:
                          '#fff',

                        color:
                          '#071c31',

                        cursor:
                          'pointer',

                        fontSize:
                          '0.73rem',

                        fontWeight:
                          900,

                        textAlign:
                          'left'
                      }}
                    >

                      <span>
                        Open Pull Planning
                      </span>


                      <span
                        style={{
                          width:
                            '28px',

                          height:
                            '28px',

                          display:
                            'inline-flex',

                          alignItems:
                            'center',

                          justifyContent:
                            'center',

                          borderRadius:
                            '8px',

                          background:
                            '#e8faf6',

                          color:
                            '#008f80',

                          fontSize:
                            '1rem'
                        }}
                      >
                        →
                      </span>

                    </button>

                  </article>

                );
              }
            )}

          </section>

        )}

      </main>

    );

  }


  // ==========================================================
  // PROJECT WORKSPACE
  // ==========================================================

  return (

    <main
      style={{
        minHeight:
          'calc(100vh - 80px)',

        padding:
          '24px',

        background:
          '#f7f9fb',

        fontFamily:
          'sans-serif'
      }}
    >

      {/* ====================================================
          HEADER
      ==================================================== */}

      <section
        style={{
          marginBottom:
            '22px',

          display:
            'flex',

          justifyContent:
            'space-between',

          alignItems:
            'flex-end',

          gap:
            '18px',

          flexWrap:
            'wrap'
        }}
      >

        <div>

          <p
            style={{
              margin:
                '0 0 7px',

              color:
                '#009f8e',

              fontSize:
                '0.68rem',

              fontWeight:
                900,

              letterSpacing:
                '0.14em'
            }}
          >
            LAST PLANNER SYSTEM
          </p>


          <h1
            style={{
              margin:
                0,

              color:
                '#071c31',

              fontSize:
                '2rem',

              fontWeight:
                900,

              letterSpacing:
                '-0.035em'
            }}
          >
            Pull Planning
          </h1>


          <p
            style={{
              margin:
                '8px 0 0',

              color:
                '#64748b',

              fontSize:
                '0.82rem'
            }}
          >
            {selectedProject?.code
              ? `${selectedProject.code} · `
              : ''}

            {selectedProject?.name}
          </p>

        </div>


        <div
          style={{
            display:
              'flex',

            gap:
              '10px',

            alignItems:
              'center',

            flexWrap:
              'wrap'
          }}
        >

          <select
            value={
              projectId
            }
            onChange={(
              event
            ) =>
              changeProject(
                event.target
                  .value
              )
            }
            style={{
              minWidth:
                '260px',

              padding:
                '10px 12px',

              border:
                '1px solid #cbd5e1',

              borderRadius:
                '8px',

              background:
                '#fff',

              color:
                '#334155',

              fontWeight:
                700
            }}
          >

            <option value="">
              Select project
            </option>

            {projects.map(
              (
                project
              ) => (

                <option
                  key={
                    project.id
                  }
                  value={
                    project.id
                  }
                >
                  {project.code
                    ? `${project.code} - `
                    : ''}

                  {project.name}
                </option>

              )
            )}

          </select>


          <button
            type="button"
            onClick={
              openCreateModal
            }
            style={{
              padding:
                '10px 16px',

              border:
                'none',

              borderRadius:
                '8px',

              background:
                '#008f80',

              color:
                '#fff',

              cursor:
                'pointer',

              fontWeight:
                900
            }}
          >
            + New Pull Session
          </button>

        </div>

      </section>


      {errorMessage && (

        <div
          style={{
            marginBottom:
              '18px',

            padding:
              '13px 15px',

            border:
              '1px solid #fecaca',

            borderRadius:
              '9px',

            background:
              '#fff1f2',

            color:
              '#be123c',

            fontSize:
              '0.8rem',

            fontWeight:
              700
          }}
        >
          {errorMessage}
        </div>

      )}


      {/* ====================================================
          SESSION DETAIL
      ==================================================== */}

      {selectedSession ? (

        <section>

          <button
            type="button"
            onClick={
              closeSession
            }
            style={{
              marginBottom:
                '16px',

              border:
                'none',

              background:
                'transparent',

              color:
                '#008f80',

              fontSize:
                '0.78rem',

              fontWeight:
                900,

              cursor:
                'pointer'
            }}
          >
            ← Back to Sessions
          </button>


          <div
            style={{
              display:
                'grid',

              gridTemplateColumns:
                'minmax(0, 1fr) 330px',

              gap:
                '20px',

              alignItems:
                'start'
            }}
          >

            {/* --------------------------------------------
                MAIN SESSION CARD
            -------------------------------------------- */}

            <div
              style={{
                border:
                  '1px solid #dce5ec',

                borderRadius:
                  '14px',

                background:
                  '#fff',

                overflow:
                  'hidden',

                boxShadow:
                  '0 12px 35px rgba(15,23,42,0.05)'
              }}
            >

              <div
                style={{
                  padding:
                    '24px',

                  borderBottom:
                    '1px solid #e5eaf0'
                }}
              >

                <div
                  style={{
                    display:
                      'flex',

                    justifyContent:
                      'space-between',

                    gap:
                      '18px',

                    alignItems:
                      'flex-start',

                    flexWrap:
                      'wrap'
                  }}
                >

                  <div>

                    <p
                      style={{
                        margin:
                          '0 0 6px',

                        color:
                          '#008f80',

                        fontSize:
                          '0.67rem',

                        fontWeight:
                          900,

                        letterSpacing:
                          '0.12em'
                      }}
                    >
                      {selectedSession.phase_name ||
                        'PHASE'}
                    </p>


                    <h2
                      style={{
                        margin:
                          0,

                        color:
                          '#071c31',

                        fontSize:
                          '1.65rem',

                        fontWeight:
                          900
                      }}
                    >
                      {selectedSession.name}
                    </h2>

                  </div>


                  {(() => {

                    const style =
                      STATUS_STYLES[
                        selectedSession.status
                      ] ||
                      STATUS_STYLES.draft;

                    return (

                      <span
                        style={{
                          padding:
                            '7px 11px',

                          border:
                            `1px solid ${style.border}`,

                          borderRadius:
                            '999px',

                          background:
                            style.background,

                          color:
                            style.color,

                          fontSize:
                            '0.7rem',

                          fontWeight:
                            900,

                          textTransform:
                            'uppercase',

                          letterSpacing:
                            '0.06em'
                        }}
                      >
                        {STATUS_LABELS[
                          selectedSession.status
                        ] ||
                          selectedSession.status}
                      </span>

                    );

                  })()}

                </div>


                {selectedSession.description && (

                  <p
                    style={{
                      margin:
                        '17px 0 0',

                      color:
                        '#64748b',

                      lineHeight:
                        1.6,

                      fontSize:
                        '0.85rem'
                    }}
                  >
                    {selectedSession.description}
                  </p>

                )}

              </div>


              {/* ------------------------------------------
                  MILESTONE
              ------------------------------------------ */}

              <div
                style={{
                  padding:
                    '22px 24px'
                }}
              >

                <p
                  style={{
                    margin:
                      '0 0 12px',

                    color:
                      '#64748b',

                    fontSize:
                      '0.65rem',

                    fontWeight:
                      900,

                    letterSpacing:
                      '0.11em'
                  }}
                >
                  PRIMARY PULL MILESTONE
                </p>


                {primaryMilestone ? (

                  <div
                    style={{
                      padding:
                        '18px',

                      border:
                        '1px solid #99f6e4',

                      borderRadius:
                        '11px',

                      background:
                        '#f0fdfa'
                    }}
                  >

                    <div
                      style={{
                        display:
                          'flex',

                        justifyContent:
                          'space-between',

                        gap:
                          '16px',

                        alignItems:
                          'center',

                        flexWrap:
                          'wrap'
                      }}
                    >

                      <div>

                        <strong
                          style={{
                            display:
                              'block',

                            color:
                              '#0f766e',

                            fontSize:
                              '1rem'
                          }}
                        >
                          {primaryMilestone.name}
                        </strong>


                        <span
                          style={{
                            display:
                              'block',

                            marginTop:
                              '5px',

                            color:
                              '#64748b',

                            fontSize:
                              '0.74rem'
                          }}
                        >
                          Pull backward from this milestone.
                        </span>

                      </div>


                      <div
                        style={{
                          textAlign:
                            'right'
                        }}
                      >

                        <span
                          style={{
                            display:
                              'block',

                            color:
                              '#64748b',

                            fontSize:
                              '0.62rem',

                            fontWeight:
                              900
                          }}
                        >
                          TARGET
                        </span>


                        <strong
                          style={{
                            color:
                              '#071c31',

                            fontSize:
                              '1rem'
                          }}
                        >
                          {formatDate(
                            primaryMilestone.target_date
                          )}
                        </strong>

                      </div>

                    </div>

                  </div>

                ) : (

                  <div
                    style={{
                      color:
                        '#94a3b8',

                      fontSize:
                        '0.8rem'
                    }}
                  >
                    No milestone associated with this session.
                  </div>

                )}


                {/* ----------------------------------------
                    PLACEHOLDER FOR NEXT PHASE
                ---------------------------------------- */}

                <div
                  style={{
                    marginTop:
                      '24px',

                    minHeight:
                      '260px',

                    display:
                      'flex',

                    alignItems:
                      'center',

                    justifyContent:
                      'center',

                    border:
                      '2px dashed #cbd5e1',

                    borderRadius:
                      '12px',

                    background:
                      '#f8fafc',

                    textAlign:
                      'center',

                    padding:
                      '30px'
                  }}
                >

                  <div>

                    <div
                      style={{
                        width:
                          '52px',

                        height:
                          '52px',

                        margin:
                          '0 auto 14px',

                        display:
                          'flex',

                        alignItems:
                          'center',

                        justifyContent:
                          'center',

                        borderRadius:
                          '14px',

                        background:
                          '#e6faf6',

                        color:
                          '#008f80',

                        fontSize:
                          '1.4rem',

                        fontWeight:
                          900
                      }}
                    >
                      ◫
                    </div>


                    <strong
                      style={{
                        display:
                          'block',

                        color:
                          '#334155',

                        fontSize:
                          '0.95rem'
                      }}
                    >
                      Pull Planning Board
                    </strong>


                    <p
                      style={{
                        margin:
                          '8px auto 0',

                        maxWidth:
                          '430px',

                        color:
                          '#94a3b8',

                        fontSize:
                          '0.78rem',

                        lineHeight:
                          1.5
                      }}
                    >
                      The collaborative sticky-note board will be implemented in the next application phase.
                    </p>

                  </div>

                </div>

              </div>

            </div>


            {/* --------------------------------------------
                SIDE PANEL
            -------------------------------------------- */}

            <aside
              style={{
                display:
                  'flex',

                flexDirection:
                  'column',

                gap:
                  '14px'
              }}
            >

              <div
                style={{
                  padding:
                    '18px',

                  border:
                    '1px solid #dce5ec',

                  borderRadius:
                    '12px',

                  background:
                    '#fff'
                }}
              >

                <p
                  style={{
                    margin:
                      '0 0 14px',

                    color:
                      '#64748b',

                    fontSize:
                      '0.64rem',

                    fontWeight:
                      900,

                    letterSpacing:
                      '0.1em'
                  }}
                >
                  SESSION DETAILS
                </p>


                {[
                  [
                    'Session Date',
                    formatDate(
                      selectedSession.session_date
                    )
                  ],

                  [
                    'Horizon Start',
                    formatDate(
                      selectedSession.planning_horizon_start
                    )
                  ],

                  [
                    'Horizon End',
                    formatDate(
                      selectedSession.planning_horizon_end
                    )
                  ],

                  [
                    'Updated',
                    formatDateTime(
                      selectedSession.updated_at
                    )
                  ]
                ].map(
                  (
                    [
                      label,
                      value
                    ]
                  ) => (

                    <div
                      key={
                        label
                      }
                      style={{
                        display:
                          'flex',

                        justifyContent:
                          'space-between',

                        gap:
                          '12px',

                        padding:
                          '9px 0',

                        borderBottom:
                          '1px solid #eef2f6',

                        fontSize:
                          '0.74rem'
                      }}
                    >

                      <span
                        style={{
                          color:
                            '#64748b'
                        }}
                      >
                        {label}
                      </span>


                      <strong
                        style={{
                          color:
                            '#334155',

                          textAlign:
                            'right'
                        }}
                      >
                        {value}
                      </strong>

                    </div>

                  )
                )}

              </div>


              {/* ----------------------------------------
                  LIFECYCLE
              ---------------------------------------- */}

              <div
                style={{
                  padding:
                    '18px',

                  border:
                    '1px solid #dce5ec',

                  borderRadius:
                    '12px',

                  background:
                    '#fff'
                }}
              >

                <p
                  style={{
                    margin:
                      '0 0 8px',

                    color:
                      '#64748b',

                    fontSize:
                      '0.64rem',

                    fontWeight:
                      900,

                    letterSpacing:
                      '0.1em'
                  }}
                >
                  SESSION LIFECYCLE
                </p>


                <p
                  style={{
                    margin:
                      '0 0 15px',

                    color:
                      '#94a3b8',

                    fontSize:
                      '0.72rem',

                    lineHeight:
                      1.45
                  }}
                >
                  {STATUS_DESCRIPTIONS[
                    selectedSession.status
                  ]}
                </p>


                <div
                  style={{
                    display:
                      'flex',

                    flexDirection:
                      'column',

                    gap:
                      '8px'
                  }}
                >

                  {SESSION_STATUSES.map(
                    (
                      status,
                      index
                    ) => {

                      const active =
                        selectedSession.status ===
                        status;

                      const style =
                        STATUS_STYLES[
                          status
                        ];


                      return (

                        <div
                          key={
                            status
                          }
                          style={{
                            display:
                              'grid',

                            gridTemplateColumns:
                              '28px 1fr',

                            gap:
                              '8px',

                            alignItems:
                              'center',

                            padding:
                              '8px 9px',

                            border:
                              active
                                ? `1px solid ${style.border}`
                                : '1px solid transparent',

                            borderRadius:
                              '8px',

                            background:
                              active
                                ? style.background
                                : 'transparent'
                          }}
                        >

                          <span
                            style={{
                              width:
                                '24px',

                              height:
                                '24px',

                              display:
                                'inline-flex',

                              alignItems:
                                'center',

                              justifyContent:
                                'center',

                              borderRadius:
                                '999px',

                              background:
                                active
                                  ? style.color
                                  : '#e2e8f0',

                              color:
                                '#fff',

                              fontSize:
                                '0.68rem',

                              fontWeight:
                                900
                            }}
                          >
                            {index + 1}
                          </span>


                          <span
                            style={{
                              color:
                                active
                                  ? style.color
                                  : '#64748b',

                              fontSize:
                                '0.73rem',

                              fontWeight:
                                active
                                  ? 900
                                  : 700
                            }}
                          >
                            {STATUS_LABELS[
                              status
                            ]}
                          </span>

                        </div>

                      );
                    }
                  )}

                </div>


                <div
                  style={{
                    display:
                      'grid',

                    gridTemplateColumns:
                      '1fr 1fr',

                    gap:
                      '8px',

                    marginTop:
                      '16px'
                  }}
                >

                  <button
                    type="button"
                    disabled={
                      !getPreviousStatus(
                        selectedSession.status
                      ) ||
                      saving
                    }
                    onClick={() =>
                      updateSessionStatus(
                        getPreviousStatus(
                          selectedSession.status
                        )
                      )
                    }
                    style={{
                      padding:
                        '9px',

                      border:
                        '1px solid #cbd5e1',

                      borderRadius:
                        '7px',

                      background:
                        '#fff',

                      color:
                        '#475569',

                      fontWeight:
                        800,

                      cursor:
                        !getPreviousStatus(
                          selectedSession.status
                        )
                          ? 'not-allowed'
                          : 'pointer',

                      opacity:
                        !getPreviousStatus(
                          selectedSession.status
                        )
                          ? 0.45
                          : 1
                    }}
                  >
                    ← Previous
                  </button>


                  <button
                    type="button"
                    disabled={
                      !getNextStatus(
                        selectedSession.status
                      ) ||
                      saving
                    }
                    onClick={() =>
                      updateSessionStatus(
                        getNextStatus(
                          selectedSession.status
                        )
                      )
                    }
                    style={{
                      padding:
                        '9px',

                      border:
                        'none',

                      borderRadius:
                        '7px',

                      background:
                        '#008f80',

                      color:
                        '#fff',

                      fontWeight:
                        900,

                      cursor:
                        !getNextStatus(
                          selectedSession.status
                        )
                          ? 'not-allowed'
                          : 'pointer',

                      opacity:
                        !getNextStatus(
                          selectedSession.status
                        )
                          ? 0.45
                          : 1
                    }}
                  >
                    Next →
                  </button>

                </div>

              </div>

            </aside>

          </div>

        </section>

      ) : (

        /* ==================================================
           SESSION LIST
        ================================================== */

        <section>

          <div
            style={{
              display:
                'flex',

              justifyContent:
                'space-between',

              alignItems:
                'center',

              marginBottom:
                '14px'
            }}
          >

            <div>

              <h2
                style={{
                  margin:
                    0,

                  color:
                    '#172033',

                  fontSize:
                    '1.05rem',

                  fontWeight:
                    900
                }}
              >
                Pull Planning Sessions
              </h2>


              <p
                style={{
                  margin:
                    '5px 0 0',

                  color:
                    '#94a3b8',

                  fontSize:
                    '0.75rem'
                }}
              >
                Collaborative phase planning history for this project.
              </p>

            </div>

          </div>


          {loadingSessions ? (

            <div
              style={{
                padding:
                  '28px',

                color:
                  '#64748b'
              }}
            >
              Loading sessions...
            </div>

          ) : sessions.length === 0 ? (

            <div
              style={{
                minHeight:
                  '300px',

                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'center',

                padding:
                  '30px',

                border:
                  '2px dashed #cbd5e1',

                borderRadius:
                  '13px',

                background:
                  '#fff',

                textAlign:
                  'center'
              }}
            >

              <div>

                <strong
                  style={{
                    display:
                      'block',

                    color:
                      '#334155',

                    fontSize:
                      '1rem'
                  }}
                >
                  No Pull Planning sessions yet
                </strong>


                <p
                  style={{
                    margin:
                      '8px 0 18px',

                    color:
                      '#94a3b8',

                    fontSize:
                      '0.78rem'
                  }}
                >
                  Create the first collaborative phase planning session for this project.
                </p>


                <button
                  type="button"
                  onClick={
                    openCreateModal
                  }
                  style={{
                    padding:
                      '10px 16px',

                    border:
                      'none',

                    borderRadius:
                      '8px',

                    background:
                      '#008f80',

                    color:
                      '#fff',

                    cursor:
                      'pointer',

                    fontWeight:
                      900
                  }}
                >
                  + New Pull Session
                </button>

              </div>

            </div>

          ) : (

            <div
              style={{
                display:
                  'grid',

                gridTemplateColumns:
                  'repeat(auto-fill, minmax(310px, 1fr))',

                gap:
                  '16px'
              }}
            >

              {sessions.map(
                (
                  session
                ) => {

                  const milestone =
                    (
                      milestonesBySession[
                        session.id
                      ] || []
                    ).find(
                      (
                        item
                      ) =>
                        item.is_primary
                    ) ||
                    (
                      milestonesBySession[
                        session.id
                      ] || []
                    )[0] ||
                    null;


                  const statusStyle =
                    STATUS_STYLES[
                      session.status
                    ] ||
                    STATUS_STYLES.draft;


                  return (

                    <article
                      key={
                        session.id
                      }
                      style={{
                        border:
                          '1px solid #dce5ec',

                        borderRadius:
                          '12px',

                        background:
                          '#fff',

                        overflow:
                          'hidden',

                        boxShadow:
                          '0 8px 24px rgba(15,23,42,0.045)'
                      }}
                    >

                      <div
                        style={{
                          padding:
                            '18px'
                        }}
                      >

                        <div
                          style={{
                            display:
                              'flex',

                            justifyContent:
                              'space-between',

                            alignItems:
                              'flex-start',

                            gap:
                              '10px'
                          }}
                        >

                          <div>

                            <div
                              style={{
                                marginBottom:
                                  '5px',

                                color:
                                  '#008f80',

                                fontSize:
                                  '0.62rem',

                                fontWeight:
                                  900,

                                letterSpacing:
                                  '0.1em',

                                textTransform:
                                  'uppercase'
                              }}
                            >
                              {session.phase_name ||
                                'Phase'}
                            </div>


                            <h3
                              style={{
                                margin:
                                  0,

                                color:
                                  '#071c31',

                                fontSize:
                                  '1rem',

                                fontWeight:
                                  900
                              }}
                            >
                              {session.name}
                            </h3>

                          </div>


                          <span
                            style={{
                              padding:
                                '5px 8px',

                              border:
                                `1px solid ${statusStyle.border}`,

                              borderRadius:
                                '999px',

                              background:
                                statusStyle.background,

                              color:
                                statusStyle.color,

                              fontSize:
                                '0.58rem',

                              fontWeight:
                                900,

                              textTransform:
                                'uppercase'
                            }}
                          >
                            {STATUS_LABELS[
                              session.status
                            ] ||
                              session.status}
                          </span>

                        </div>


                        <div
                          style={{
                            marginTop:
                              '17px',

                            paddingTop:
                              '14px',

                            borderTop:
                              '1px solid #eef2f6'
                          }}
                        >

                          <span
                            style={{
                              display:
                                'block',

                              color:
                                '#94a3b8',

                              fontSize:
                                '0.58rem',

                              fontWeight:
                                900,

                              letterSpacing:
                                '0.08em'
                            }}
                          >
                            PRIMARY MILESTONE
                          </span>


                          <strong
                            style={{
                              display:
                                'block',

                              marginTop:
                                '5px',

                              color:
                                '#334155',

                              fontSize:
                                '0.78rem'
                            }}
                          >
                            {milestone
                              ?.name ||
                              'No milestone'}
                          </strong>


                          <span
                            style={{
                              display:
                                'block',

                              marginTop:
                                '3px',

                              color:
                                '#64748b',

                              fontSize:
                                '0.7rem'
                            }}
                          >
                            {formatDate(
                              milestone
                                ?.target_date
                            )}
                          </span>

                        </div>

                      </div>


                      <button
                        type="button"
                        onClick={() =>
                          openSession(
                            session.id
                          )
                        }
                        style={{
                          width:
                            '100%',

                          padding:
                            '12px 18px',

                          display:
                            'flex',

                          justifyContent:
                            'space-between',

                          alignItems:
                            'center',

                          border:
                            'none',

                          borderTop:
                            '1px solid #e6edf3',

                          background:
                            '#fff',

                          color:
                            '#071c31',

                          cursor:
                            'pointer',

                          fontSize:
                            '0.72rem',

                          fontWeight:
                            900
                        }}
                      >
                        <span>
                          Open Session
                        </span>

                        <span
                          style={{
                            color:
                              '#008f80',

                            fontSize:
                              '1rem'
                          }}
                        >
                          →
                        </span>
                      </button>

                    </article>

                  );
                }
              )}

            </div>

          )}

        </section>

      )}


      {/* ====================================================
          CREATE SESSION MODAL
      ==================================================== */}

      {showCreateModal && (

        <div
          style={{
            position:
              'fixed',

            inset:
              0,

            zIndex:
              5000,

            display:
              'flex',

            alignItems:
              'center',

            justifyContent:
              'center',

            padding:
              '22px',

            background:
              'rgba(3,17,30,0.58)'
          }}
        >

          <div
            style={{
              width:
                'min(760px,96vw)',

              maxHeight:
                '92vh',

              overflowY:
                'auto',

              borderRadius:
                '14px',

              background:
                '#fff',

              boxShadow:
                '0 30px 90px rgba(0,0,0,0.3)'
            }}
          >

            <div
              style={{
                padding:
                  '20px 24px',

                display:
                  'flex',

                justifyContent:
                  'space-between',

                alignItems:
                  'center',

                borderBottom:
                  '1px solid #e5eaf0'
              }}
            >

              <div>

                <p
                  style={{
                    margin:
                      '0 0 5px',

                    color:
                      '#008f80',

                    fontSize:
                      '0.65rem',

                    fontWeight:
                      900,

                    letterSpacing:
                      '0.11em'
                  }}
                >
                  PULL PLANNING
                </p>


                <h2
                  style={{
                    margin:
                      0,

                    color:
                      '#071c31',

                    fontSize:
                      '1.35rem'
                  }}
                >
                  New Pull Session
                </h2>

              </div>


              <button
                type="button"
                onClick={() =>
                  setShowCreateModal(
                    false
                  )
                }
                style={{
                  border:
                    'none',

                  background:
                    'transparent',

                  color:
                    '#64748b',

                  cursor:
                    'pointer',

                  fontSize:
                    '1.5rem'
                }}
              >
                ×
              </button>

            </div>


            <form
              onSubmit={
                createSession
              }
            >

              <div
                style={{
                  padding:
                    '22px 24px',

                  display:
                    'grid',

                  gridTemplateColumns:
                    '1fr 1fr',

                  gap:
                    '16px'
                }}
              >

                <div
                  style={{
                    gridColumn:
                      '1 / -1'
                  }}
                >

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Session Name *
                  </label>

                  <input
                    required
                    type="text"
                    value={
                      sessionName
                    }
                    onChange={(
                      event
                    ) =>
                      setSessionName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Example: Interior Finishes Phase Planning"
                    style={
                      inputStyle
                    }
                  />

                </div>


                <div>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Phase *
                  </label>

                  <input
                    required
                    type="text"
                    value={
                      phaseName
                    }
                    onChange={(
                      event
                    ) =>
                      setPhaseName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Example: Interior Finishes"
                    style={
                      inputStyle
                    }
                  />

                </div>


                <div>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Session Date
                  </label>

                  <input
                    type="date"
                    value={
                      sessionDate
                    }
                    onChange={(
                      event
                    ) =>
                      setSessionDate(
                        event.target
                          .value
                      )
                    }
                    style={
                      inputStyle
                    }
                  />

                </div>


                <div>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Planning Horizon Start
                  </label>

                  <input
                    type="date"
                    value={
                      horizonStart
                    }
                    onChange={(
                      event
                    ) =>
                      setHorizonStart(
                        event.target
                          .value
                      )
                    }
                    style={
                      inputStyle
                    }
                  />

                </div>


                <div>

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Planning Horizon End
                  </label>

                  <input
                    type="date"
                    value={
                      horizonEnd
                    }
                    onChange={(
                      event
                    ) =>
                      setHorizonEnd(
                        event.target
                          .value
                      )
                    }
                    style={
                      inputStyle
                    }
                  />

                </div>


                <div
                  style={{
                    gridColumn:
                      '1 / -1'
                  }}
                >

                  <label
                    style={
                      labelStyle
                    }
                  >
                    Description
                  </label>

                  <textarea
                    value={
                      sessionDescription
                    }
                    onChange={(
                      event
                    ) =>
                      setSessionDescription(
                        event.target
                          .value
                      )
                    }
                    placeholder="Session scope, participants or planning objective..."
                    rows={3}
                    style={{
                      ...inputStyle,

                      resize:
                        'vertical'
                    }}
                  />

                </div>


                {/* --------------------------------------
                    MILESTONE
                -------------------------------------- */}

                <div
                  style={{
                    gridColumn:
                      '1 / -1',

                    marginTop:
                      '4px',

                    padding:
                      '17px',

                    border:
                      '1px solid #99f6e4',

                    borderRadius:
                      '10px',

                    background:
                      '#f0fdfa'
                  }}
                >

                  <div
                    style={{
                      marginBottom:
                        '14px'
                    }}
                  >

                    <strong
                      style={{
                        display:
                          'block',

                        color:
                          '#0f766e',

                        fontSize:
                          '0.85rem'
                      }}
                    >
                      Primary Pull Milestone
                    </strong>


                    <span
                      style={{
                        display:
                          'block',

                        marginTop:
                          '4px',

                        color:
                          '#64748b',

                        fontSize:
                          '0.71rem'
                      }}
                    >
                      The team will plan backward from this target.
                    </span>

                  </div>


                  <div
                    style={{
                      display:
                        'grid',

                      gridTemplateColumns:
                        '1fr 190px',

                      gap:
                        '12px'
                    }}
                  >

                    <div>

                      <label
                        style={
                          labelStyle
                        }
                      >
                        Milestone *
                      </label>

                      <input
                        required
                        type="text"
                        value={
                          milestoneName
                        }
                        onChange={(
                          event
                        ) =>
                          setMilestoneName(
                            event.target
                              .value
                          )
                        }
                        placeholder="Example: Level 03 Ready for Turnover"
                        style={
                          inputStyle
                        }
                      />

                    </div>


                    <div>

                      <label
                        style={
                          labelStyle
                        }
                      >
                        Target Date *
                      </label>

                      <input
                        required
                        type="date"
                        value={
                          milestoneTargetDate
                        }
                        onChange={(
                          event
                        ) =>
                          setMilestoneTargetDate(
                            event.target
                              .value
                          )
                        }
                        style={
                          inputStyle
                        }
                      />

                    </div>

                  </div>

                </div>


                {errorMessage && (

                  <div
                    style={{
                      gridColumn:
                        '1 / -1',

                      padding:
                        '11px 13px',

                      border:
                        '1px solid #fecaca',

                      borderRadius:
                        '7px',

                      background:
                        '#fff1f2',

                      color:
                        '#be123c',

                      fontSize:
                        '0.75rem',

                      fontWeight:
                        700
                    }}
                  >
                    {errorMessage}
                  </div>

                )}

              </div>


              <div
                style={{
                  padding:
                    '16px 24px',

                  display:
                    'flex',

                  justifyContent:
                    'flex-end',

                  gap:
                    '10px',

                  borderTop:
                    '1px solid #e5eaf0'
                }}
              >

                <button
                  type="button"
                  disabled={
                    saving
                  }
                  onClick={() =>
                    setShowCreateModal(
                      false
                    )
                  }
                  style={{
                    padding:
                      '10px 15px',

                    border:
                      '1px solid #cbd5e1',

                    borderRadius:
                      '7px',

                    background:
                      '#fff',

                    color:
                      '#475569',

                    cursor:
                      'pointer',

                    fontWeight:
                      800
                  }}
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  style={{
                    padding:
                      '10px 17px',

                    border:
                      'none',

                    borderRadius:
                      '7px',

                    background:
                      '#008f80',

                    color:
                      '#fff',

                    cursor:
                      saving
                        ? 'not-allowed'
                        : 'pointer',

                    fontWeight:
                      900,

                    opacity:
                      saving
                        ? 0.65
                        : 1
                  }}
                >
                  {saving
                    ? 'Creating...'
                    : 'Create Session'}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </main>

  );

}


// ============================================================
// SHARED INLINE STYLES
// ============================================================

const labelStyle = {
  display:
    'block',

  marginBottom:
    '5px',

  color:
    '#475569',

  fontSize:
    '0.7rem',

  fontWeight:
    900,

  textTransform:
    'uppercase',

  letterSpacing:
    '0.04em'
};


const inputStyle = {
  width:
    '100%',

  padding:
    '10px 11px',

  border:
    '1px solid #cbd5e1',

  borderRadius:
    '7px',

  outline:
    'none',

  background:
    '#fff',

  color:
    '#172033',

  fontSize:
    '0.82rem',

  boxSizing:
    'border-box'
};
