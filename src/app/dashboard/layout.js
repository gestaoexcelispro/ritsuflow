'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '../../components/LogoutButton'
import styles from './dashboard.module.css'

function NavIcon({ type, size = 19 }) {
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
    case 'preplanning':
      return (
        <svg {...commonProps}>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M7 8h10" />
          <path d="M7 12h4" />
          <path d="M7 16h4" />
          <path d="M15 12v4" />
          <path d="M13 14h4" />
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
    case 'constraint':
      return (
        <svg {...commonProps}>
          <path d="M12 3L2.5 20h19z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="16.5" r=".7" fill="currentColor" stroke="none" />
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
    default:
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
  }
}

const planningItems = [
  { label: 'Pre-Planning', href: '/planning/pre-planning', icon: 'preplanning' },
  { label: 'Master Plan', href: '/dashboard/planning/master-plan', icon: 'masterplan' },
  { label: 'Lookahead Planning', href: '/dashboard/planning/lookahead', icon: 'lookahead' },
  { label: 'Constraint Management', href: '/dashboard/projects/constraints', icon: 'constraint' },
  { label: 'Weekly Planning', href: '/dashboard/planning/weekly-planning', icon: 'weekly' },
]

export default function DashboardLayout({ children }) {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const [hoveredNavigationItem, setHoveredNavigationItem] = useState(null)

  function isActive(href) {
    return pathname === href || pathname === `${href}/` || pathname.startsWith(`${href}/`)
  }

  const currentNavigationItem = planningItems.find((item) => isActive(item.href))
  const currentTitle = currentNavigationItem?.label || 'PreCon'

  function toggleNavigation() {
    setHoveredNavigationItem(null)

    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 980px)').matches) {
      setIsMobileOpen((current) => !current)
      return
    }

    setIsCollapsed((current) => !current)
  }

  function closeMobileNavigation() {
    setIsMobileOpen(false)
    setHoveredNavigationItem(null)
  }

  const sidebarClassName = [
    styles.sidebar,
    isCollapsed ? styles.sidebarCollapsed : '',
    isMobileOpen ? styles.sidebarMobileOpen : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={styles.shell}>
      {isMobileOpen && (
        <button
          type="button"
          className={styles.mobileOverlay}
          onClick={closeMobileNavigation}
          aria-label="Close navigation"
        />
      )}

      <aside className={sidebarClassName} style={{ overflow: 'visible' }}>
        <div style={{ height: isCollapsed ? '18px' : '26px', flexShrink: 0 }} />

        <nav
          className={styles.navigation}
          aria-label="PreCon planning navigation"
          style={{ overflowX: 'visible' }}
        >
          <div className={styles.navigationGroup} style={{ position: 'relative', overflow: 'visible' }}>
            {!isCollapsed && (
              <div
                className={styles.navigationLabel}
                style={{ margin: 0, padding: '8px 10px' }}
              >
                Planning
              </div>
            )}

            <div style={{ overflow: 'visible' }}>
              {planningItems.map((item) => {
                const active = isActive(item.href)
                const tooltipVisible = isCollapsed && hoveredNavigationItem === item.href
                const linkClassName = [
                  styles.navigationLink,
                  active ? styles.navigationLinkActive : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <div
                    key={item.href}
                    style={{ position: 'relative', overflow: 'visible' }}
                    onMouseEnter={() => setHoveredNavigationItem(item.href)}
                    onMouseLeave={() => setHoveredNavigationItem(null)}
                  >
                    <Link
                      href={item.href}
                      className={linkClassName}
                      onClick={closeMobileNavigation}
                      aria-label={item.label}
                      style={{
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: isCollapsed ? 'center' : 'flex-start',
                        overflow: 'visible',
                      }}
                    >
                      <span
                        className={styles.navigationIcon}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: isCollapsed ? '40px' : '36px',
                          height: isCollapsed ? '40px' : '36px',
                          minWidth: isCollapsed ? '40px' : '36px',
                          borderRadius: '10px',
                          background: active ? '#14b8a6' : 'rgba(15,23,42,0.16)',
                          color: '#ffffff',
                          transition: 'background 0.15s ease, transform 0.15s ease',
                          transform:
                            hoveredNavigationItem === item.href
                              ? 'translateX(1px)'
                              : 'translateX(0)',
                        }}
                      >
                        <NavIcon type={item.icon} size={isCollapsed ? 21 : 19} />
                      </span>

                      {!isCollapsed && (
                        <span className={styles.navigationText} style={{ marginLeft: '10px' }}>
                          {item.label}
                        </span>
                      )}
                    </Link>

                    {tooltipVisible && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: 'calc(100% + 12px)',
                          zIndex: 10000,
                          transform: 'translateY(-50%)',
                          display: 'flex',
                          alignItems: 'center',
                          minHeight: '36px',
                          padding: '8px 12px',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '7px',
                          background: '#0f172a',
                          boxShadow: '0 8px 24px rgba(15,23,42,0.24)',
                          color: '#ffffff',
                          fontSize: '13px',
                          lineHeight: 1,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          pointerEvents: 'none',
                        }}
                      >
                        {item.label}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.developmentStatus}>
            <div className={styles.statusTitle}>
              <span className={styles.statusDot} />
              Private development
            </div>
            <p className={styles.statusText}>RitsuFlow is currently under active development.</p>
          </div>

          <div className={styles.logoutArea}>
            <LogoutButton label={isCollapsed ? '' : 'Logout'} />
          </div>
        </div>
      </aside>

      <div className={styles.workspace}>
        <header className={styles.topbar}>
          <div
            className={styles.topbarLeft}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              minWidth: 0,
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              className={styles.menuButton}
              onClick={toggleNavigation}
              aria-label="Toggle navigation"
            >
              ☰
            </button>

            <Link
              href="/workspaces"
              onClick={closeMobileNavigation}
              aria-label="Return to RitsuFlow workspaces"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '120px',
                height: '56px',
                flexShrink: 0,
                padding: 0,
                margin: 0,
                background: 'transparent',
                border: 'none',
                borderRadius: 0,
                textDecoration: 'none',
                overflow: 'visible',
              }}
            >
              <Image
                src="/logo.png"
                alt="RitsuFlow"
                width={1600}
                height={900}
                priority
                style={{
                  display: 'block',
                  width: '110px',
                  height: '52px',
                  objectFit: 'contain',
                  objectPosition: 'center',
                }}
              />
            </Link>

            <div
              className={styles.pageIdentity}
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                minWidth: 0,
              }}
            >
              <p
                className={styles.pageCategory}
                style={{
                  margin: 0,
                  color: '#64748b',
                  fontSize: '14px',
                  lineHeight: 1.2,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                PreCon
              </p>

              <h1
                className={styles.pageTitle}
                style={{
                  margin: '4px 0 0',
                  color: '#0f172a',
                  fontSize: '24px',
                  lineHeight: 1.1,
                  fontWeight: 900,
                }}
              >
                {currentTitle}
              </h1>
            </div>
          </div>

          <div
            id="dashboard-topbar-actions"
            className={styles.topbarRight}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '6px',
              flex: '1 1 auto',
              minWidth: 0,
              marginLeft: '20px',
              overflowX: 'auto',
              overflowY: 'hidden',
              scrollbarWidth: 'none',
            }}
          />
        </header>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  )
}
