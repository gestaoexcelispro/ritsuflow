import {
  redirect,
} from 'next/navigation'

import {
  createClient,
} from '../../../../lib/supabase/server'


function formatDate(value) {
  if (!value) {
    return 'No expiration'
  }

  const date =
    new Date(
      `${value}T00:00:00`
    )

  return new Intl.DateTimeFormat(
    'en-US',
    {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }
  ).format(date)
}


function formatModuleName(
  moduleKey
) {
  const labels = {
    project_setup:
      'Project Setup',

    planning:
      'Planning',

    daily_reports:
      'Daily Reports',

    workforce:
      'Workforce',

    production_control:
      'Production Control',
  }

  return (
    labels[moduleKey] ||
    moduleKey
  )
}


function formatPlanName(
  planCode
) {
  const labels = {
    pilot: 'Pilot',
    standard: 'Standard',
    academic: 'Academic',
    custom: 'Custom',
  }

  return (
    labels[planCode] ||
    planCode
  )
}


function getStatusStyles(
  status
) {
  switch (status) {
    case 'active':
      return {
        background:
          '#dcfce7',
        color:
          '#166534',
      }

    case 'trial':
      return {
        background:
          '#dbeafe',
        color:
          '#1d4ed8',
      }

    case 'suspended':
      return {
        background:
          '#fef3c7',
        color:
          '#92400e',
      }

    case 'expired':
    case 'cancelled':
      return {
        background:
          '#fee2e2',
        color:
          '#991b1b',
      }

    default:
      return {
        background:
          '#e2e8f0',
        color:
          '#475569',
      }
  }
}


export default async function PlatformOrganizationsPage() {
  const supabase =
    await createClient()


  // =======================================================
  // AUTHENTICATION
  // =======================================================

  const {
    data: {
      user,
    },
  } =
    await supabase.auth
      .getUser()


  if (!user) {
    redirect('/login')
  }


  // =======================================================
  // PLATFORM AUTHORIZATION
  // =======================================================

  const {
    data:
      isPlatformOwner,
    error:
      platformAuthorizationError,
  } =
    await supabase.rpc(
      'is_platform_owner'
    )


  if (
    platformAuthorizationError ||
    !isPlatformOwner
  ) {
    redirect('/dashboard')
  }


  // =======================================================
  // ORGANIZATION COMMERCIAL SUMMARY
  // =======================================================

  const {
    data:
      organizations,
    error:
      organizationsError,
  } =
    await supabase.rpc(
      'get_platform_organizations'
    )


  if (
    organizationsError
  ) {
    console.error(
      'Platform organizations could not be loaded.',
      organizationsError
    )
  }


  const organizationList =
    organizations || []


  return (
    <div
      style={{
        display: 'flex',
        flexDirection:
          'column',
        gap: '24px',
      }}
    >
      {/* ==================================================
          PAGE HEADER
      ================================================== */}

      <section
        style={{
          display: 'flex',
          justifyContent:
            'space-between',
          alignItems:
            'flex-start',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2
            style={{
              margin:
                '0 0 8px',
              color:
                '#0f172a',
              fontSize:
                '1.6rem',
            }}
          >
            Organizations
          </h2>

          <p
            style={{
              margin: 0,
              color:
                '#64748b',
              lineHeight:
                1.5,
            }}
          >
            Manage RitsuFlow
            customer organizations,
            licenses and enabled
            modules.
          </p>
        </div>


        {/*
          The button becomes functional
          in the next development step.
        */}

        <button
          type="button"
          disabled
          title="Organization provisioning will be enabled next."
          style={{
            padding:
              '12px 18px',
            border: 0,
            borderRadius:
              '8px',
            background:
              '#94a3b8',
            color:
              '#ffffff',
            fontSize:
              '0.95rem',
            fontWeight:
              700,
            cursor:
              'not-allowed',
          }}
        >
          + Add Organization
        </button>
      </section>


      {/* ==================================================
          ERROR
      ================================================== */}

      {organizationsError && (
        <section
          style={{
            padding:
              '16px',
            border:
              '1px solid #fecaca',
            borderRadius:
              '10px',
            background:
              '#fef2f2',
            color:
              '#991b1b',
          }}
        >
          Organizations could
          not be loaded.
        </section>
      )}


      {/* ==================================================
          EMPTY STATE
      ================================================== */}

      {!organizationsError &&
        organizationList.length ===
          0 && (
          <section
            style={{
              padding:
                '48px 24px',
              border:
                '1px solid #e2e8f0',
              borderRadius:
                '12px',
              background:
                '#ffffff',
              textAlign:
                'center',
            }}
          >
            <div
              style={{
                width:
                  '52px',
                height:
                  '52px',
                margin:
                  '0 auto 16px',
                display:
                  'flex',
                alignItems:
                  'center',
                justifyContent:
                  'center',
                borderRadius:
                  '12px',
                background:
                  '#e0f2fe',
                color:
                  '#075985',
                fontWeight:
                  800,
              }}
            >
              OR
            </div>

            <h3
              style={{
                margin:
                  '0 0 8px',
                color:
                  '#0f172a',
              }}
            >
              No organizations
            </h3>

            <p
              style={{
                margin: 0,
                color:
                  '#64748b',
              }}
            >
              Customer
              organizations will
              appear here.
            </p>
          </section>
        )}


      {/* ==================================================
          ORGANIZATION CARDS
      ================================================== */}

      {!organizationsError &&
        organizationList.length >
          0 && (
          <section
            style={{
              display:
                'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(340px, 1fr))',
              gap:
                '18px',
            }}
          >
            {organizationList.map(
              (
                organization
              ) => {
                const status =
                  organization
                    .license_status ||
                  'active'

                const statusStyles =
                  getStatusStyles(
                    status
                  )

                const modules =
                  organization
                    .enabled_modules ||
                  []

                return (
                  <article
                    key={
                      organization
                        .organization_id
                    }
                    style={{
                      padding:
                        '22px',
                      border:
                        '1px solid #e2e8f0',
                      borderRadius:
                        '12px',
                      background:
                        '#ffffff',
                      boxShadow:
                        '0 4px 16px rgba(15, 23, 42, 0.04)',
                    }}
                  >
                    {/* ================================
                        CARD HEADER
                    ================================ */}

                    <div
                      style={{
                        display:
                          'flex',
                        justifyContent:
                          'space-between',
                        alignItems:
                          'flex-start',
                        gap:
                          '16px',
                        marginBottom:
                          '22px',
                      }}
                    >
                      <div>
                        <h3
                          style={{
                            margin:
                              '0 0 6px',
                            color:
                              '#0f172a',
                            fontSize:
                              '1.15rem',
                          }}
                        >
                          {
                            organization
                              .organization_name
                          }
                        </h3>

                        <span
                          style={{
                            color:
                              '#64748b',
                            fontSize:
                              '0.9rem',
                          }}
                        >
                          {
                            formatPlanName(
                              organization
                                .plan_code
                            )
                          }{' '}
                          License
                        </span>
                      </div>


                      <span
                        style={{
                          padding:
                            '6px 10px',
                          borderRadius:
                            '999px',
                          background:
                            statusStyles
                              .background,
                          color:
                            statusStyles
                              .color,
                          fontSize:
                            '0.72rem',
                          fontWeight:
                            800,
                          textTransform:
                            'uppercase',
                          letterSpacing:
                            '0.04em',
                        }}
                      >
                        {status}
                      </span>
                    </div>


                    {/* ================================
                        LICENSE INFORMATION
                    ================================ */}

                    <div
                      style={{
                        display:
                          'grid',
                        gridTemplateColumns:
                          'repeat(2, minmax(0, 1fr))',
                        gap:
                          '16px',
                        marginBottom:
                          '22px',
                      }}
                    >
                      <div>
                        <p
                          style={{
                            margin:
                              '0 0 4px',
                            color:
                              '#94a3b8',
                            fontSize:
                              '0.75rem',
                            fontWeight:
                              700,
                            textTransform:
                              'uppercase',
                          }}
                        >
                          Seats
                        </p>

                        <strong
                          style={{
                            color:
                              '#0f172a',
                          }}
                        >
                          {
                            organization
                              .seats_used
                          }{' '}
                          /{' '}
                          {
                            organization
                              .seat_limit
                          }
                        </strong>
                      </div>


                      <div>
                        <p
                          style={{
                            margin:
                              '0 0 4px',
                            color:
                              '#94a3b8',
                            fontSize:
                              '0.75rem',
                            fontWeight:
                              700,
                            textTransform:
                              'uppercase',
                          }}
                        >
                          Expiration
                        </p>

                        <strong
                          style={{
                            color:
                              '#0f172a',
                          }}
                        >
                          {
                            formatDate(
                              organization
                                .expires_at
                            )
                          }
                        </strong>
                      </div>
                    </div>


                    {/* ================================
                        PRIMARY ADMIN
                    ================================ */}

                    <div
                      style={{
                        marginBottom:
                          '22px',
                        padding:
                          '14px',
                        borderRadius:
                          '8px',
                        background:
                          '#f8fafc',
                      }}
                    >
                      <p
                        style={{
                          margin:
                            '0 0 6px',
                          color:
                            '#94a3b8',
                          fontSize:
                            '0.75rem',
                          fontWeight:
                            700,
                          textTransform:
                            'uppercase',
                        }}
                      >
                        Primary Admin
                      </p>

                      <div
                        style={{
                          color:
                            '#334155',
                          fontWeight:
                            700,
                        }}
                      >
                        {
                          organization
                            .primary_admin_name ||
                          'Not assigned'
                        }
                      </div>

                      {organization
                        .primary_admin_email && (
                        <div
                          style={{
                            marginTop:
                              '3px',
                            color:
                              '#64748b',
                            fontSize:
                              '0.88rem',
                          }}
                        >
                          {
                            organization
                              .primary_admin_email
                          }
                        </div>
                      )}
                    </div>


                    {/* ================================
                        MODULES
                    ================================ */}

                    <div>
                      <p
                        style={{
                          margin:
                            '0 0 10px',
                          color:
                            '#94a3b8',
                          fontSize:
                            '0.75rem',
                          fontWeight:
                            700,
                          textTransform:
                            'uppercase',
                        }}
                      >
                        Enabled Modules
                      </p>


                      {modules.length ===
                      0 ? (
                        <span
                          style={{
                            color:
                              '#94a3b8',
                            fontSize:
                              '0.88rem',
                          }}
                        >
                          No modules
                          configured
                        </span>
                      ) : (
                        <div
                          style={{
                            display:
                              'flex',
                            flexWrap:
                              'wrap',
                            gap:
                              '8px',
                          }}
                        >
                          {modules.map(
                            (
                              moduleKey
                            ) => (
                              <span
                                key={
                                  moduleKey
                                }
                                style={{
                                  padding:
                                    '6px 9px',
                                  borderRadius:
                                    '6px',
                                  background:
                                    '#e0f2fe',
                                  color:
                                    '#075985',
                                  fontSize:
                                    '0.78rem',
                                  fontWeight:
                                    700,
                                }}
                              >
                                {
                                  formatModuleName(
                                    moduleKey
                                  )
                                }
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                )
              }
            )}
          </section>
        )}
    </div>
  )
}
