'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const attendanceNavigation = [
  {
    label: 'Live Attendance',
    href: '/dashboard/field-management/workforce/attendance',
  },
  {
    label: 'Timecards',
    href: '/dashboard/field-management/workforce/attendance/history',
  },
  {
    label: 'Exceptions',
    href: '/dashboard/field-management/workforce/attendance/exceptions',
  },
  {
    label: 'Audit Trail',
    href: '/dashboard/field-management/workforce/attendance/audit',
  },
]

export default function AttendanceLayout({
  children,
}) {
  const pathname = usePathname()

  function isActive(href) {
    if (
      href ===
      '/dashboard/field-management/workforce/attendance'
    ) {
      return (
        pathname === href ||
        pathname === `${href}/`
      )
    }

    return (
      pathname === href ||
      pathname === `${href}/` ||
      pathname.startsWith(
        `${href}/`
      )
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      <nav
        aria-label="Attendance navigation"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px',
          width: 'fit-content',
          maxWidth: '100%',
          overflowX: 'auto',
          border:
            '1px solid #e2e8f0',
          borderRadius: '11px',
          background: '#ffffff',
        }}
      >
        {attendanceNavigation.map(
          (item) => {
            const active =
              isActive(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display:
                    'inline-flex',
                  alignItems:
                    'center',
                  justifyContent:
                    'center',
                  minHeight: '36px',
                  padding:
                    '0 14px',
                  borderRadius:
                    '8px',
                  color: active
                    ? '#ffffff'
                    : '#475569',
                  background:
                    active
                      ? '#082a4a'
                      : 'transparent',
                  fontSize:
                    '0.78rem',
                  fontWeight: 800,
                  textDecoration:
                    'none',
                  whiteSpace:
                    'nowrap',
                  transition:
                    'background-color 140ms ease, color 140ms ease',
                }}
              >
                {item.label}
              </Link>
            )
          }
        )}
      </nav>

      {children}
    </div>
  )
}
