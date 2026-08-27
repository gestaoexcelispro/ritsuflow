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


  // =======================================================
  // COLLAPSIBLE NAVIGATION GROUPS
  //
  // true  = module/pages visible
  // false = module/pages hidden
  //
  // All modules start open.
  // =======================================================

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


  // =======================================================
  // PLATFORM OWNER NAVIGATION AUTHORIZATION
  // =======================================================

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

          setIsPlatformOwner(false)

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


  // =======================================================
  // NAVIGATION GROUPS
  // =======================================================

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


  // =======================================================
  // ACTIVE ROUTE
  // =======================================================

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


  // =======================================================
  // CURRENT MODULE
  // =======================================================

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


  // =======================================================
  // CURRENT PAGE
  // =======================================================

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


  // =======================================================
  // KEEP ACTIVE MODULE OPEN
  //
  // If user navigates directly to a page, its parent module
  // automatically opens.
  // =======================================================

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


  // =======================================================
  // TOGGLE MODULE
  // =======================================================

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


  // =======================================================
  // SIDEBAR TOGGLE
  // =======================================================

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


  function closeMobileNavigation() {
    setIsMobileOpen(
      false
    )
  }


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


  // =======================================================
  // RENDER
  // =======================================================

  return (
    <div
      className={
        styles.shell
      }
    >

      {/* ===================================================
          MOBILE OVERLAY
      =================================================== */}

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


      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside
        className={
          sidebarClassName
        }
      >

        {/* =================================================
            BRAND
        ================================================= */}

        <div
          className={
            styles.sidebarHeader
          }
        >

          <Link
            href="/"

            className={
              styles.brand
            }

            onClick={
              closeMobileNavigation
            }

            aria-label="RitsuFlow home"
          >

            <Image
              src="/logo-white.png"

              alt="RitsuFlow"

              width={
                1600
              }

              height={
                900
              }

              priority

              className={
                styles.brandLogo
              }
            />

          </Link>

        </div>


        {/* =================================================
            NAVIGATION
        ================================================= */}

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
                      MODULE HEADER
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
                      MODULE ITEMS
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


        {/* =================================================
            SIDEBAR FOOTER
        ================================================= */}

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


      {/* ===================================================
          WORKSPACE
      =================================================== */}

      <div
        className={
          styles.workspace
        }
      >

        {/* =================================================
            TOPBAR
        ================================================= */}

        <header
          className={
            styles.topbar
          }
        >

          <div
            className={
              styles.topbarLeft
            }
          >

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


            <div
              className={
                styles.pageIdentity
              }
            >

              <p
                className={
                  styles.pageCategory
                }
              >
                {
                  currentCategory
                }
              </p>


              <h1
                className={
                  styles.pageTitle
                }
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


        {/* =================================================
            PAGE CONTENT
        ================================================= */}

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
