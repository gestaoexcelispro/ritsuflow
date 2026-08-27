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

import {
  LayoutDashboard,
  FolderKanban,
  Settings2,
  MapPinned,
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  Users,
  UserRoundCheck,
  Clock3,
  CalendarRange,
  ListTree,
  CalendarDays,
  TriangleAlert,
  Map,
  TableProperties,
  ShieldCheck,
  Building2,
} from 'lucide-react'

import LogoutButton from '../../components/LogoutButton'

import {
  createClient,
} from '../../lib/supabase/client'

import styles from './dashboard.module.css'


// ============================================================
// RitsuFlow™
// DASHBOARD NAVIGATION
//
// EXPANDED SIDEBAR
//
// [icon] Page Name
//
// COLLAPSED SIDEBAR
//
// [icon]
//   ↓ hover
// Page Name tooltip
//
// ============================================================


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
        icon: LayoutDashboard,
      },

      {
        label: 'Projects',
        href: '/dashboard/projects',
        icon: FolderKanban,
      },

      {
        label: 'Project Setup',
        href: '/dashboard/projects/setup',
        icon: Settings2,
      },

      {
        label: 'Location Structure',
        href: '/dashboard/projects/locations',
        icon: MapPinned,
      },

      {
        label: 'Work Packages',
        href: '/dashboard/projects/work-packages',
        icon: Boxes,
      },

    ],
  },


  {
    label: 'Field Management',

    items: [

      {
        label: 'Operational Dashboard',
        href: '/dashboard/projects/operations',
        icon: ChartNoAxesCombined,
      },

      {
        label: 'Daily Reports',
        href: '/dashboard/projects/daily-reports',
        icon: ClipboardList,
      },

      {
        label: 'Workforce',
        href: '/dashboard/field-management/workforce',
        icon: Users,
      },

      {
        label: 'Project Assignments',
        href: '/dashboard/field-management/workforce/assignments',
        icon: UserRoundCheck,
      },

      {
        label: 'Attendance',
        href: '/dashboard/field-management/workforce/attendance',
        icon: Clock3,
      },

    ],
  },


  {
    label: 'Planning',

    items: [

      {
        label: 'Master Plan',
        href: '/dashboard/projetos/masterplan',
        icon: CalendarRange,
      },

      {
        label: 'Lookahead Planning',
        href: '/dashboard/projetos/lookahead',
        icon: ListTree,
      },

      {
        label: 'Weekly Planning',
        href: '/dashboard/projetos/semanal',
        icon: CalendarDays,
      },

      {
        label: 'Constraint Log',
        href: '/dashboard/projects/constraints',
        icon: TriangleAlert,
      },

    ],
  },


  {
    label: 'Control',

    items: [

      {
        label: 'Production Map',
        href: '/dashboard/diretoria/mapa',
        icon: Map,
      },

      {
        label: 'Status Matrix',
        href: '/dashboard/projetos/matriz-status',
        icon: TableProperties,
      },

    ],
  },


  {
    label: 'Administration',

    items: [

      {
        label: 'Users & Access',
        href: '/dashboard/administration/users',
        icon: ShieldCheck,
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
      icon: Building2,
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
  // TOOLTIP STATE
  // ==========================================================

  const [
    hoveredNavigationItem,
    setHoveredNavigationItem,
  ] =
    useState(null)


  // ==========================================================
  // PLATFORM OWNER
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
  // COLLAPSIBLE GROUPS
  // ==========================================================

  const [
    expandedGroups,
    setExpandedGroups,
  ] =
    useState({

      Workspace:
        true,

      'Field Management':
        true,

      Planning:
        true,

      Control:
        true,

      Administration:
        true,

      Platform:
        true,

    })


  // ==========================================================
  // PLATFORM OWNER AUTHORIZATION
  // ==========================================================

  useEffect(
    () => {

      let mounted =
        true


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

        mounted =
          false

      }

    },
    [
      supabase,
    ]
  )


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
      href ===
      '/dashboard'
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
  // CURRENT MODULE
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
  // TOGGLE GROUP
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
  // SIDEBAR TOGGLE
  // ==========================================================

  function toggleNavigation() {

    setHoveredNavigationItem(
      null
    )


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
          current
        ) =>
          !current
      )


      return

    }


    setIsCollapsed(
      (
        current
      ) =>
        !current
    )

  }


  // ==========================================================
  // CLOSE MOBILE NAVIGATION
  // ==========================================================

  function closeMobileNavigation() {

    setIsMobileOpen(
      false
    )


    setHoveredNavigationItem(
      null
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
        style={{
          overflow:
            'visible',
        }}
      >

        {/* ===================================================
            SIDEBAR TOP SPACER
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
          style={{
            overflowX:
              'visible',
          }}
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
                  style={{

                    position:
                      'relative',

                    overflow:
                      'visible',

                  }}
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

                    <div
                      style={{
                        overflow:
                          'visible',
                      }}
                    >

                      {group.items.map(
                        (
                          item
                        ) => {

                          const active =
                            isActive(
                              item.href
                            )


                          const Icon =
                            item.icon


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


                          const tooltipVisible =
                            isCollapsed &&
                            hoveredNavigationItem ===
                              item.href


                          return (

                            <div
                              key={
                                item.href
                              }
                              style={{

                                position:
                                  'relative',

                                overflow:
                                  'visible',

                              }}
                              onMouseEnter={() =>
                                setHoveredNavigationItem(
                                  item.href
                                )
                              }
                              onMouseLeave={() =>
                                setHoveredNavigationItem(
                                  null
                                )
                              }
                            >

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
                                aria-label={
                                  item.label
                                }
                                style={{

                                  position:
                                    'relative',

                                  display:
                                    'flex',

                                  alignItems:
                                    'center',

                                  justifyContent:
                                    isCollapsed
                                      ? 'center'
                                      : 'flex-start',

                                  overflow:
                                    'visible',

                                }}
                              >

                                {/* =============================
                                    ICON
                                ============================= */}

                                <span
                                  className={
                                    styles.navigationIcon
                                  }
                                  style={{

                                    display:
                                      'inline-flex',

                                    alignItems:
                                      'center',

                                    justifyContent:
                                      'center',

                                    width:
                                      isCollapsed
                                        ? '40px'
                                        : '36px',

                                    height:
                                      isCollapsed
                                        ? '40px'
                                        : '36px',

                                    minWidth:
                                      isCollapsed
                                        ? '40px'
                                        : '36px',

                                    borderRadius:
                                      '10px',

                                    background:
                                      active
                                        ? '#14b8a6'
                                        : 'rgba(15,23,42,0.16)',

                                    color:
                                      '#ffffff',

                                    transition:
                                      'background 0.15s ease, transform 0.15s ease',

                                    transform:
                                      hoveredNavigationItem ===
                                        item.href
                                        ? 'translateX(1px)'
                                        : 'translateX(0)',

                                  }}
                                >

                                  <Icon
                                    size={
                                      isCollapsed
                                        ? 21
                                        : 19
                                    }
                                    strokeWidth={
                                      2
                                    }
                                    aria-hidden="true"
                                  />

                                </span>


                                {/* =============================
                                    EXPANDED PAGE NAME
                                ============================= */}

                                {!isCollapsed && (

                                  <span
                                    className={
                                      styles.navigationText
                                    }
                                    style={{

                                      marginLeft:
                                        '10px',

                                    }}
                                  >
                                    {
                                      item.label
                                    }
                                  </span>

                                )}

                              </Link>


                              {/* =============================
                                  COLLAPSED TOOLTIP
                              ============================= */}

                              {tooltipVisible && (

                                <div
                                  style={{

                                    position:
                                      'absolute',

                                    top:
                                      '50%',

                                    left:
                                      'calc(100% + 12px)',

                                    zIndex:
                                      10000,

                                    transform:
                                      'translateY(-50%)',

                                    display:
                                      'flex',

                                    alignItems:
                                      'center',

                                    minHeight:
                                      '36px',

                                    padding:
                                      '8px 12px',

                                    border:
                                      '1px solid rgba(255,255,255,0.08)',

                                    borderRadius:
                                      '7px',

                                    background:
                                      '#0f172a',

                                    boxShadow:
                                      '0 8px 24px rgba(15,23,42,0.24)',

                                    color:
                                      '#ffffff',

                                    fontSize:
                                      '13px',

                                    lineHeight:
                                      1,

                                    fontWeight:
                                      700,

                                    whiteSpace:
                                      'nowrap',

                                    pointerEvents:
                                      'none',

                                  }}
                                >

                                  {/* =========================
                                      TOOLTIP ARROW
                                  ========================= */}

                                  <span
                                    style={{

                                      position:
                                        'absolute',

                                      left:
                                        '-5px',

                                      top:
                                        '50%',

                                      width:
                                        '10px',

                                      height:
                                        '10px',

                                      background:
                                        '#0f172a',

                                      transform:
                                        'translateY(-50%) rotate(45deg)',

                                    }}
                                  />


                                  <span
                                    style={{

                                      position:
                                        'relative',

                                      zIndex:
                                        1,

                                    }}
                                  >
                                    {
                                      item.label
                                    }
                                  </span>

                                </div>

                              )}

                            </div>

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
              RitsuFlow is currently under active development.
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
                MENU
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
                RITSUFLOW LOGO

                Normal logo.
                Transparent background.
                No green block.
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
            CONTENT
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
