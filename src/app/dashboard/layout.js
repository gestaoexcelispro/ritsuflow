'use client'

import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import Image from 'next/image'
import Link from 'next/link'

import {
  usePathname,
} from 'next/navigation'

import LogoutButton from '../../components/LogoutButton'

import {
  createClient,
} from '../../lib/supabase/client'

import styles from './dashboard.module.css'


// ============================================================
// BASE NAVIGATION
// ============================================================

const baseNavigationGroups = [
  {
    label: 'Workspace',

    items: [
      {
        label: 'Overview',
        href: '/dashboard',
        icon: 'OV',
      },
      {
        label: 'Projects',
        href: '/dashboard/projects',
        icon: 'PR',
      },
      {
        label: 'Project Setup',
        href: '/dashboard/projects/setup',
        icon: 'PS',
      },
      {
        label: 'Location Structure',
        href: '/dashboard/projects/locations',
        icon: 'LB',
      },
      {
        label: 'Work Packages',
        href: '/dashboard/projects/work-packages',
        icon: 'PK',
      },
    ],
  },

  {
    label: 'Field Management',

    items: [
      {
        label: 'Operational Dashboard',
        href: '/dashboard/projects/operations',
        icon: 'OD',
      },
      {
        label: 'Daily Reports',
        href: '/dashboard/projects/daily-reports',
        icon: 'DR',
      },
      {
        label: 'Workforce',
        href: '/dashboard/field-management/workforce',
        icon: 'WF',
      },
      {
        label: 'Project Assignments',
        href: '/dashboard/field-management/workforce/assignments',
        icon: 'PA',
      },
      {
        label: 'Attendance',
        href: '/dashboard/field-management/workforce/attendance',
        icon: 'AT',
      },
    ],
  },

  {
    label: 'Planning',

    items: [
      {
        label: 'Master Plan',
        href: '/dashboard/projetos/masterplan',
        icon: 'MP',
      },
      {
        label: 'Lookahead Planning',
        href: '/dashboard/projetos/lookahead',
        icon: 'LA',
      },
      {
        label: 'Weekly Planning',
        href: '/dashboard/projetos/semanal',
        icon: 'WP',
      },
      {
        label: 'Constraint Log',
        href: '/dashboard/projects/constraints',
        icon: 'CL',
      },
    ],
  },

  {
    label: 'Control',

    items: [
      {
        label: 'Production Map',
        href: '/dashboard/diretoria/mapa',
        icon: 'PM',
      },
      {
        label: 'Status Matrix',
        href: '/dashboard/projetos/matriz-status',
        icon: 'SM',
      },
    ],
  },

  {
    label: 'Administration',

    items: [
      {
        label: 'Users & Access',
        href: '/dashboard/administration/users',
        icon: 'UA',
      },
    ],
  },
]


// ============================================================
// PLATFORM NAVIGATION
// ============================================================

const platformNavigationGroup = {
  label: 'Platform',

  items: [
    {
      label: 'Organizations',
      href: '/dashboard/platform/organizations',
      icon: 'OR',
    },
  ],
}


// ============================================================
// DASHBOARD LAYOUT
// ============================================================

export default function DashboardLayout({
  children,
}) {
  const pathname =
    usePathname()

  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    )


  // ==========================================================
  // SIDEBAR STATE
  // ==========================================================

  const [
    isCollapsed,
    setIsCollapsed,
  ] =
    useState(false)


  const [
    isMobileOpen,
    setIsMobileOpen,
  ] =
    useState(false)


  // ==========================================================
  // PLATFORM OWNER STATE
  // ==========================================================

  const [
    isPlatformOwner,
    setIsPlatformOwner,
  ] =
    useState(false)


  const [
    platformAuthorizationLoaded,
    setPlatformAuthorizationLoaded,
  ] =
    useState(false)


  // ==========================================================
  // COLLAPSIBLE NAVIGATION GROUPS
  // ==========================================================

  const [
    expandedGroups,
    setExpandedGroups,
  ] =
    useState({
      Workspace: true,
      'Field Management': true,
      Planning: true,
      Control: true,
      Administration: true,
      Platform: true,
    })


  // ==========================================================
  // PLATFORM OWNER AUTHORIZATION
  // ==========================================================

  useEffect(() => {
    let mounted = true


    async function loadPlatformAuthorization() {
      try {
        const {
          data,
          error,
        } =
          await supabase.rpc(
            'is_platform_owner'
          )


        if (!mounted) {
          return
        }


        if (error) {
          console.error(
            'Platform owner authorization could not be loaded.',
            error
          )


          setIsPlatformOwner(
            false
          )


          setPlatformAuthorizationLoaded(
            true
          )


          return
        }


        setIsPlatformOwner(
          data === true
        )


        setPlatformAuthorizationLoaded(
          true
        )

      } catch (error) {
        console.error(
          'Platform owner authorization failed.',
          error
        )


        if (mounted) {
          setIsPlatformOwner(
            false
          )


          setPlatformAuthorizationLoaded(
            true
          )
        }
      }
    }


    loadPlatformAuthorization()


    return () => {
      mounted = false
    }

  }, [
    supabase,
  ])


  // ==========================================================
  // NAVIGATION GROUPS
  // ==========================================================

  const navigationGroups =
    useMemo(
      () => {

        if (
          isPlatformOwner
        ) {
          return [
            ...baseNavigationGroups,
            platformNavigationGroup,
          ]
        }


        return baseNavigationGroups

      },
      [
        isPlatformOwner,
      ]
    )


  // ==========================================================
  // ACTIVE ROUTE
  // ==========================================================

  function isActive(
    href
  ) {

    if (
      href === '/dashboard'
    ) {
      return (
        pathname ===
          '/dashboard' ||
        pathname ===
          '/dashboard/'
      )
    }


    if (
      href ===
      '/dashboard/projects'
    ) {
      return (
        pathname ===
        href
      )
    }


    if (
      href ===
      '/dashboard/field-management/workforce'
    ) {
      return (
        pathname ===
          href ||
        pathname ===
          `${href}/`
      )
    }


    return pathname.startsWith(
      href
    )
  }


  // ==========================================================
  // CURRENT NAVIGATION GROUP
  // ==========================================================

  const currentNavigationGroup =
    navigationGroups.find(
      (
        group
      ) =>
        group.items.some(
          (
            item
          ) =>
            isActive(
              item.href
            )
        )
    )


  // ==========================================================
  // CURRENT PAGE
  // ==========================================================

  const currentNavigationItem =
    navigationGroups
      .flatMap(
        (
          group
        ) =>
          group.items
      )
      .find(
        (
          item
        ) =>
          isActive(
            item.href
          )
      )


  const currentCategory =
    currentNavigationGroup
      ?.label ||
    'Workspace'


  const currentTitle =
    currentNavigationItem
      ?.label ||
    'Overview'


  // ==========================================================
  // KEEP CURRENT MODULE OPEN
  // ==========================================================

  useEffect(
    () => {

      if (
        !currentNavigationGroup
          ?.label
      ) {
        return
      }


      const activeGroupLabel =
        currentNavigationGroup
          .label


      setExpandedGroups(
        (
          current
        ) => {

          if (
            current[
              activeGroupLabel
            ]
          ) {
            return current
          }


          return {
            ...current,

            [activeGroupLabel]:
              true,
          }

        }
      )

    },
    [
      currentNavigationGroup
        ?.label,
    ]
  )


  // ==========================================================
  // TOGGLE NAVIGATION GROUP
  // ==========================================================

  function toggleGroup(
    groupLabel
  ) {

    setExpandedGroups(
      (
        current
      ) => ({

        ...current,

        [groupLabel]:
          !current[
            groupLabel
          ],

      })
    )

  }


  // ==========================================================
  // TOGGLE SIDEBAR
  // ==========================================================

  function toggleNavigation() {

    if (
      typeof window !==
        'undefined' &&
      window
        .matchMedia(
          '(max-width: 980px)'
        )
        .matches
    ) {

      setIsMobileOpen(
        (
          currentState
        ) =>
          !currentState
      )


      return
    }


    setIsCollapsed(
      (
        currentState
      ) =>
        !currentState
    )
  }


  // ==========================================================
  // CLOSE MOBILE SIDEBAR
  // ==========================================================

  function closeMobileNavigation() {

    setIsMobileOpen(
      false
    )

  }


  // ==========================================================
  // SIDEBAR CLASS
  // ==========================================================

  const sidebarClassName = [
    styles.sidebar,

    isCollapsed
      ? styles.sidebarCollapsed
      : '',

    isMobileOpen
      ? styles.sidebarMobileOpen
      : '',
  ]
    .filter(
      Boolean
    )
    .join(
      ' '
    )


  // ==========================================================
  // RENDER
  // ==========================================================

  return (

    <div
      className={
        styles.shell
      }
    >

      {/* =====================================================
          MOBILE OVERLAY
      ===================================================== */}

      {isMobileOpen && (

        <button
          type="button"
          className={
            styles.mobileOverlay
          }
          onClick={
            closeMobileNavigation
          }
          aria-label="Close navigation"
        />

      )}


      {/* =====================================================
          SIDEBAR
      ===================================================== */}

      <aside
        className={
          sidebarClassName
        }
      >

        {/* ===================================================
            SIDEBAR TOP SPACER

            The RitsuFlow brand is now displayed in the
            dashboard topbar instead of the sidebar.
        =================================================== */}

        <div
          style={{
            height:
              isCollapsed
                ? '18px'
                : '26px',

            flexShrink:
              0,
          }}
        />


        {/* ===================================================
            NAVIGATION
        =================================================== */}

        <nav
          className={
            styles.navigation
          }
          aria-label="RitsuFlow navigation"
        >

          {navigationGroups.map(
            (
              group
            ) => {

              const isGroupExpanded =
                expandedGroups[
                  group.label
                ] !== false


              const isCurrentGroup =
                currentNavigationGroup
                  ?.label ===
                group.label


              return (

                <div
                  className={
                    styles.navigationGroup
                  }
                  key={
                    group.label
                  }
                >

                  {/* =========================================
                      GROUP HEADER
                  ========================================= */}

                  <button
                    type="button"
                    onClick={() =>
                      toggleGroup(
                        group.label
                      )
                    }
                    title={
                      isGroupExpanded
                        ? `Hide ${group.label}`
                        : `Show ${group.label}`
                    }
                    aria-expanded={
                      isGroupExpanded
                    }
                    style={{
                      display:
                        'flex',

                      alignItems:
                        'center',

                      justifyContent:
                        'space-between',

                      width:
                        '100%',

                      margin:
                        0,

                      padding:
                        isCollapsed
                          ? '8px 4px'
                          : '8px 10px',

                      border:
                        0,

                      background:
                        isCurrentGroup
                          ? 'rgba(255,255,255,0.06)'
                          : 'transparent',

                      color:
                        'inherit',

                      font:
                        'inherit',

                      textAlign:
                        'left',

                      cursor:
                        'pointer',

                      borderRadius:
                        '6px',

                      transition:
                        'background 0.15s ease',
                    }}
                  >

                    {!isCollapsed && (

                      <span
                        className={
                          styles.navigationLabel
                        }
                        style={{
                          margin:
                            0,

                          padding:
                            0,
                        }}
                      >
                        {
                          group.label
                        }
                      </span>

                    )}


                    {!isCollapsed && (

                      <span
                        aria-hidden="true"
                        style={{
                          display:
                            'inline-flex',

                          alignItems:
                            'center',

                          justifyContent:
                            'center',

                          width:
                            '18px',

                          height:
                            '18px',

                          color:
                            '#94a3b8',

                          fontSize:
                            '10px',

                          fontWeight:
                            900,

                          transform:
                            isGroupExpanded
                              ? 'rotate(0deg)'
                              : 'rotate(-90deg)',

                          transition:
                            'transform 0.15s ease',
                        }}
                      >
                        ▼
                      </span>

                    )}

                  </button>


                  {/* =========================================
                      GROUP ITEMS
                  ========================================= */}

                  {(
                    isGroupExpanded ||
                    isCollapsed
                  ) && (

                    <div>

                      {group.items.map(
                        (
                          item
                        ) => {

                          const active =
                            isActive(
                              item.href
                            )


                          const linkClassName = [
                            styles.navigationLink,

                            active
                              ? styles.navigationLinkActive
                              : '',
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              ' '
                            )


                          return (

                            <Link
                              href={
                                item.href
                              }
                              className={
                                linkClassName
                              }
                              onClick={
                                closeMobileNavigation
                              }
                              key={
                                item.href
                              }
                            >

                              <span
                                className={
                                  styles.navigationIcon
                                }
                              >
                                {
                                  item.icon
                                }
                              </span>


                              <span
                                className={
                                  styles.navigationText
                                }
                              >
                                {
                                  item.label
                                }
                              </span>

                            </Link>

                          )

                        }
                      )}

                    </div>

                  )}

                </div>

              )

            }
          )}


          {!platformAuthorizationLoaded &&
            null}

        </nav>


        {/* ===================================================
            SIDEBAR FOOTER
        =================================================== */}

        <div
          className={
            styles.sidebarFooter
          }
        >

          <div
            className={
              styles.developmentStatus
            }
          >

            <div
              className={
                styles.statusTitle
              }
            >

              <span
                className={
                  styles.statusDot
                }
              />

              Private development

            </div>


            <p
              className={
                styles.statusText
              }
            >
              RitsuFlow is currently under
              active development.
            </p>

          </div>


          <div
            className={
              styles.logoutArea
            }
          >

            <LogoutButton
              label={
                isCollapsed
                  ? ''
                  : 'Logout'
              }
            />

          </div>

        </div>

      </aside>


      {/* =====================================================
          WORKSPACE
      ===================================================== */}

      <div
        className={
          styles.workspace
        }
      >

        {/* ===================================================
            TOPBAR
        =================================================== */}

        <header
          className={
            styles.topbar
          }
        >

          <div
            className={
              styles.topbarLeft
            }
            style={{
              display:
                'flex',

              alignItems:
                'center',

              gap:
                '16px',

              minWidth:
                0,
            }}
          >

            {/* ===============================================
                MENU BUTTON
            =============================================== */}

            <button
              type="button"
              className={
                styles.menuButton
              }
              onClick={
                toggleNavigation
              }
              aria-label="Toggle navigation"
            >
              ☰
            </button>


            {/* ===============================================
                RITSUFLOW BRAND

                Normal full-color logo.
                Transparent background.
                No green container.
            =============================================== */}

            <Link
              href="/"
              onClick={
                closeMobileNavigation
              }
              aria-label="RitsuFlow home"
              style={{
                display:
                  'flex',

                alignItems:
                  'center',

                justifyContent:
                  'center',

                width:
                  '120px',

                height:
                  '56px',

                flexShrink:
                  0,

                padding:
                  0,

                margin:
                  0,

                background:
                  'transparent',

                border:
                  'none',

                borderRadius:
                  0,

                textDecoration:
                  'none',

                overflow:
                  'visible',
              }}
            >

              <Image
                src="/logo.png"
                alt="RitsuFlow"
                width={
                  1600
                }
                height={
                  900
                }
                priority
                style={{
                  display:
                    'block',

                  width:
                    '110px',

                  height:
                    '52px',

                  objectFit:
                    'contain',

                  objectPosition:
                    'center',
                }}
              />

            </Link>


            {/* ===============================================
                PAGE IDENTITY
            =============================================== */}

            <div
              className={
                styles.pageIdentity
              }
              style={{
                display:
                  'flex',

                flexDirection:
                  'column',

                justifyContent:
                  'center',

                minWidth:
                  0,
              }}
            >

              <p
                className={
                  styles.pageCategory
                }
                style={{
                  margin:
                    0,

                  color:
                    '#64748b',

                  fontSize:
                    '14px',

                  lineHeight:
                    1.2,

                  fontWeight:
                    800,

                  letterSpacing:
                    '0.08em',

                  textTransform:
                    'uppercase',
                }}
              >
                {
                  currentCategory
                }
              </p>


              <h1
                className={
                  styles.pageTitle
                }
                style={{
                  margin:
                    '4px 0 0',

                  color:
                    '#0f172a',

                  fontSize:
                    '24px',

                  lineHeight:
                    1.1,

                  fontWeight:
                    900,
                }}
              >
                {
                  currentTitle
                }
              </h1>

            </div>

          </div>


          <div
            className={
              styles.topbarRight
            }
          />

        </header>


        {/* ===================================================
            PAGE CONTENT
        =================================================== */}

        <main
          className={
            styles.content
          }
        >
          {children}
        </main>

      </div>

    </div>

  )
}
