'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '../../components/LogoutButton'
import styles from './dashboard.module.css'

const navigationGroups = [
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
]

export default function DashboardLayout({
  children,
}) {
  const pathname = usePathname()

  const [isCollapsed, setIsCollapsed] =
    useState(false)

  const [isMobileOpen, setIsMobileOpen] =
    useState(false)

  function isActive(href) {
    if (href === '/dashboard') {
      return (
        pathname === '/dashboard' ||
        pathname === '/dashboard/'
      )
    }

    if (href === '/dashboard/projects') {
      return pathname === href
    }

    if (
      href ===
      '/dashboard/field-management/workforce'
    ) {
      return (
        pathname === href ||
        pathname === `${href}/`
      )
    }

    return pathname.startsWith(href)
  }

  const currentNavigationGroup =
    navigationGroups.find((group) =>
      group.items.some((item) =>
        isActive(item.href)
      )
    )

  const currentNavigationItem =
    navigationGroups
      .flatMap((group) => group.items)
      .find((item) =>
        isActive(item.href)
      )

  const currentCategory =
    currentNavigationGroup?.label ||
    'Workspace'

  const currentTitle =
    currentNavigationItem?.label ||
    'Overview'

  function toggleNavigation() {
    if (
      typeof window !== 'undefined' &&
      window
        .matchMedia('(max-width: 980px)')
        .matches
    ) {
      setIsMobileOpen(
        (currentState) => !currentState
      )

      return
    }

    setIsCollapsed(
      (currentState) => !currentState
    )
  }

  function closeMobileNavigation() {
    setIsMobileOpen(false)
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
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.shell}>
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
        className={sidebarClassName}
      >
        <div
          className={
            styles.sidebarHeader
          }
        >
          <Link
            href="/"
            className={styles.brand}
            onClick={
              closeMobileNavigation
            }
            aria-label="RitsuFlow home"
          >
            <Image
              src="/logo-white.png"
              alt="RitsuFlow"
              width={1600}
              height={900}
              priority
              className={
                styles.brandLogo
              }
            />
          </Link>
        </div>

        <nav
          className={styles.navigation}
          aria-label="RitsuFlow navigation"
        >
          {navigationGroups.map(
            (group) => (
              <div
                className={
                  styles.navigationGroup
                }
                key={group.label}
              >
                <p
                  className={
                    styles.navigationLabel
                  }
                >
                  {group.label}
                </p>

                {group.items.map(
                  (item) => {
                    const active =
                      isActive(item.href)

                    const linkClassName = [
                      styles.navigationLink,

                      active
                        ? styles.navigationLinkActive
                        : '',
                    ]
                      .filter(Boolean)
                      .join(' ')

                    return (
                      <Link
                        href={item.href}
                        className={
                          linkClassName
                        }
                        onClick={
                          closeMobileNavigation
                        }
                        key={item.href}
                      >
                        <span
                          className={
                            styles.navigationIcon
                          }
                        >
                          {item.icon}
                        </span>

                        <span
                          className={
                            styles.navigationText
                          }
                        >
                          {item.label}
                        </span>
                      </Link>
                    )
                  }
                )}
              </div>
            )
          )}
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

      <div className={styles.workspace}>
        <header
          className={styles.topbar}
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
                {currentCategory}
              </p>

              <h1
                className={
                  styles.pageTitle
                }
              >
                {currentTitle}
              </h1>
            </div>
          </div>

          <div
            className={
              styles.topbarRight
            }
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
