'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '../../../../../lib/supabase/client'
import { getAttendanceNavigationCopy } from '../../../../../i18n/workforceAttendanceNavigation'

export default function AttendanceLayout({ children }) {
  const pathname = usePathname()
  const supabase = useMemo(() => createClient(), [])
  const [locale, setLocale] = useState('en-US')
  const t = useMemo(() => getAttendanceNavigationCopy(locale), [locale])

  const attendanceNavigation = useMemo(
    () => [
      {
        label: t.liveAttendance,
        href: '/dashboard/field-management/workforce/attendance',
      },
      {
        label: t.timecards,
        href: '/dashboard/field-management/workforce/attendance/history',
      },
      {
        label: t.exceptions,
        href: '/dashboard/field-management/workforce/attendance/exceptions',
      },
      {
        label: t.auditTrail,
        href: '/dashboard/field-management/workforce/attendance/audit',
      },
    ],
    [t]
  )

  useEffect(() => {
    let active = true

    async function loadOrganizationLocale() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) return

        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle()

        if (!membership?.organization_id) return

        const { data: organization } = await supabase
          .from('organizations')
          .select('locale')
          .eq('id', membership.organization_id)
          .maybeSingle()

        if (
          active &&
          ['en-US', 'pt-BR', 'es'].includes(organization?.locale)
        ) {
          setLocale(organization.locale)
        }
      } catch (error) {
        console.warn('Attendance navigation locale fallback to en-US.', error)
      }
    }

    loadOrganizationLocale()

    return () => {
      active = false
    }
  }, [supabase])

  function isActive(href) {
    if (href === '/dashboard/field-management/workforce/attendance') {
      return pathname === href || pathname === `${href}/`
    }

    return (
      pathname === href ||
      pathname === `${href}/` ||
      pathname.startsWith(`${href}/`)
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
        aria-label={t.ariaLabel}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '5px',
          width: 'fit-content',
          maxWidth: '100%',
          overflowX: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: '11px',
          background: '#ffffff',
        }}
      >
        {attendanceNavigation.map((item) => {
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '36px',
                padding: '0 14px',
                borderRadius: '8px',
                color: active ? '#ffffff' : '#475569',
                background: active ? '#082a4a' : 'transparent',
                fontSize: '0.78rem',
                fontWeight: 800,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'background-color 140ms ease, color 140ms ease',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      {children}
    </div>
  )
}
