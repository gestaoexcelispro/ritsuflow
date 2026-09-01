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
// RitsuFlow™
// DASHBOARD NAVIGATION
//
// No external icon library required.
//
// Expanded:
// [icon] Page Name
//
// Collapsed:
// [icon]
//    ↓ hover
// Page Name tooltip
// ============================================================


// ============================================================
// INLINE SVG ICON
// ============================================================

function NavIcon({
  type,
  size = 19,
}) {

  const commonProps = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  }


  switch (type) {

    case 'overview':
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      )


    case 'projects':
      return (
        <svg {...commonProps}>
          <path d="M3 7h6l2 2h10v10H3z" />
          <path d="M3 7V5h6l2 2" />
        </svg>
      )


    case 'setup':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H9.6v-.1A1.7 1.7 0 0 0 8.2 19.3a1.7 1.7 0 0 0-1.4.4l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3V9.6h.1A1.7 1.7 0 0 0 4.7 8.2a1.7 1.7 0 0 0-.4-1.4l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.8 4.7a1.7 1.7 0 0 0 1.4-.4l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.1.4.3.7.6 1 .3.2.7.4 1.1.4h.1v4h-.1a1.7 1.7 0 0 0-1.7.6z" />
        </svg>
      )


    case 'location':
      return (
        <svg {...commonProps}>
          <path d="M12 21s6-5 6-11a6 6 0 1 0-12 0c0 6 6 11 6 11z" />
          <circle cx="12" cy="10" r="2" />
        </svg>
      )


    case 'packages':
      return (
        <svg {...commonProps}>
          <path d="M4 7l8-4 8 4-8 4z" />
          <path d="M4 12l8 4 8-4" />
          <path d="M4 17l8 4 8-4" />
        </svg>
      )


    case 'operations':
      return (
        <svg {...commonProps}>
          <path d="M4 19V9" />
          <path d="M10 19V5" />
          <path d="M16 19v-7" />
          <path d="M22 19V3" />
          <path d="M2 19h20" />
        </svg>
      )


    case 'reports':
      return (
        <svg {...commonProps}>
          <rect x="5" y="3" width="14" height="18" rx="2" />
          <path d="M9 3h6v4H9z" />
          <path d="M9 11h6" />
          <path d="M9 15h6" />
        </svg>
      )


    case 'workforce':
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="8" r="3" />
          <circle cx="17" cy="9" r="2" />
          <path d="M3 20c0-4 2.5-6 6-6s6 2 6 6" />
          <path d="M15 15c3 0 5 1.7 5 5" />
        </svg>
      )


    case 'assignment':
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-4 2.5-6 6-6 2.1 0 3.8.7 4.8 2" />
          <path d="M15 18l2 2 4-5" />
        </svg>
      )


    case 'attendance':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      )


    case 'masterplan':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M3 10h18" />
          <path d="M8 14h3" />
          <path d="M13 14h3" />
          <path d="M8 17h3" />
        </svg>
      )


    case 'lookahead':
      return (
        <svg {...commonProps}>
          <path d="M5 5h6" />
          <path d="M5 12h10" />
          <path d="M5 19h14" />
          <path d="M11 5l3 3-3 3" />
          <path d="M15 12l3 3-3 3" />
        </svg>
      )


    case 'weekly':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M8 3v4" />
          <path d="M16 3v4" />
          <path d="M3 10h18" />
          <path d="M7 14h2" />
          <path d="M11 14h2" />
          <path d="M15 14h2" />
          <path d="M7 17h2" />
          <path d="M11 17h2" />
        </svg>
      )


    case 'constraint':
      return (
        <svg {...commonProps}>
          <path d="M12 3L2.5 20h19z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="16.5" r=".7" fill="currentColor" stroke="none" />
        </svg>
      )


    case 'production':
      return (
        <svg {...commonProps}>
          <path d="M3 20V8l6 3V8l6 3V4h6v16z" />
          <path d="M7 16h2" />
          <path d="M12 16h2" />
          <path d="M17 16h2" />
        </svg>
      )


    case 'matrix':
      return (
        <svg {...commonProps}>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="M3 15h18" />
          <path d="M9 3v18" />
          <path d="M15 3v18" />
        </svg>
      )


    case 'users':
      return (
        <svg {...commonProps}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 20c0-4 2.5-6 6-6s6 2 6 6" />
          <path d="M17 8v6" />
          <path d="M14 11h6" />
        </svg>
      )


    case 'organizations':
      return (
        <svg {...commonProps}>
          <rect x="5" y="3" width="14" height="18" rx="1" />
          <path d="M9 7h2" />
          <path d="M13 7h2" />
          <path d="M9 11h2" />
          <path d="M13 11h2" />
          <path d="M9 15h2" />
          <path d="M13 15h2" />
          <path d="M10 21v-3h4v3" />
        </svg>
      )


    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )

  }
}


// ============================================================
// NAVIGATION
// ============================================================

const baseNavigationGroups = [

  {
    label: 'Workspace',

    items: [

      {
        label: 'Overview',
        href: '/dashboard',
        icon: 'overview',
      },

      {
        label: 'Projects',
        href: '/dashboard/projects',
        icon: 'projects',
      },

      {
        label: 'Project Setup',
        href: '/dashboard/projects/setup',
        icon: 'setup',
      },

      {
        label: 'Location Structure',
        href: '/dashboard/projects/locations',
        icon: 'location',
      },

      {
        label: 'Work Packages',
        href: '/dashboard/projects/work-packages',
        icon: 'packages',
      },

    ],
  },


  {
    label: 'Field Management',

    items: [

      {
        label: 'Operational Dashboard',
        href: '/dashboard/projects/operations',
        icon: 'operations',
      },

      {
        label: 'Daily Reports',
        href: '/dashboard/projects/daily-reports',
        icon: 'reports',
      },

      {
        label: 'Workforce',
        href: '/dashboard/field-management/workforce',
        icon: 'workforce',
      },

      {
        label: 'Project Assignments',
        href: '/dashboard/field-management/workforce/assignments',
        icon: 'assignment',
      },

      {
        label: 'Attendance',
        href: '/dashboard/field-management/workforce/attendance',
        icon: 'attendance',
      },

    ],
  },


  {
    label: 'Planning',

    items: [

      {
        label: 'Master Plan',
        href: '/dashboard/projetos/masterplan',
        icon: 'masterplan',
      },

      {
        label: 'Lookahead Planning',
        href: '/dashboard/projetos/lookahead',
        icon: 'lookahead',
      },

      {
        label: 'Weekly Planning',
        href: '/dashboard/projetos/semanal',
        icon: 'weekly',
      },

      {
        label: 'Constraint Log',
        href: '/dashboard/projects/constraints',
        icon: 'constraint',
      },

    ],
  },


  {
    label: 'Control',

    items: [

      {
        label: 'Production Map',
        href: '/dashboard/diretoria/mapa',
        icon: 'production',
      },

      {
        label: 'Status Matrix',
        href: '/dashboard/projetos/matriz-status',
        icon: 'matrix',
      },

    ],
  },


  {
    label: 'Administration',

    items: [

      {
        label: 'Users & Access',
        href: '/dashboard/administration/users',
        icon: 'users',
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
      icon: 'organizations',
    },

  ],

}


// ============================================================
// DASHBOARD
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
  // SIDEBAR
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
  // TOOLTIP
  // ==========================================================

  const [
    hoveredNavigationItem,
    setHoveredNavigationItem,
  ] =
    useState(null)


  // ==========================================================
  // PLATFORM
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
  // MODULE EXPANSION
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
  // PLATFORM AUTHORIZATION
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
  // CURRENT GROUP
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
  // KEEP ACTIVE GROUP OPEN
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
  // GROUP TOGGLE
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


      <aside
        className={
          sidebarClassName
        }
        style={{
          overflow:
            'visible',
        }}
      >

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


                          const tooltipVisible =
                            isCollapsed &&
                            hoveredNavigationItem ===
                              item.href


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

                                  <NavIcon
                                    type={
                                      item.icon
                                    }
                                    size={
                                      isCollapsed
                                        ? 21
                                        : 19
                                    }
                                  />

                                </span>


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


      <div
        className={
          styles.workspace
        }
      >

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

              flexShrink:
                0,

            }}
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
            id="dashboard-topbar-actions"
            className={
              styles.topbarRight
            }
            style={{

              display:
                'flex',

              alignItems:
                'center',

              justifyContent:
                'flex-end',

              gap:
                '8px',

              flex:
                '1 1 auto',

              minWidth:
                0,

              marginLeft:
                '20px',

              overflow:
                'visible',

            }}
          />

        </header>


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
