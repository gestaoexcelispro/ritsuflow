'use client'

import { useCallback } from 'react'
import { useLanguage } from '../../../../lib/i18n/LanguageProvider'
import { parseIso } from '../../../../lib/pull/schedule'

export const PULL_BASE = '/dashboard/planning/pull-planning'
export const STATUSES = ['draft', 'in_session', 'agreed', 'archived']
export const STATUS_TONE = { draft: undefined, in_session: 'info', agreed: 'ok', archived: undefined }

/** Formats an ISO date (YYYY-MM-DD) in the user's language; '—' when empty. */
export function useFormatDate() {
  const { language } = useLanguage()
  return useCallback((iso, options) => {
    if (!iso) return '—'
    // Timestamps (signed off, agreed) show the user's local day; plain dates stay as they are.
    if (iso.length > 10) iso = localIso(new Date(iso))
    const format = options || { month: 'short', day: 'numeric', year: 'numeric' }
    return new Intl.DateTimeFormat(language, { timeZone: 'UTC', ...format }).format(new Date(parseIso(iso)))
  }, [language])
}

/** "Nov 17 – 25" style range (short month and day). */
export function useFormatRange() {
  const format = useFormatDate()
  return useCallback((from, to) => {
    if (!from) return '—'
    const a = format(from, { month: 'short', day: 'numeric' })
    if (!to || to === from) return a
    return `${a} – ${format(to, { month: 'short', day: 'numeric' })}`
  }, [format])
}

export const handoffLabel = (handoff) => `H${handoff.number}`

/** A Date in the browser's time zone, as YYYY-MM-DD. */
export function localIso(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Today's date in the browser's time zone, as YYYY-MM-DD. */
export function todayIso() {
  return localIso(new Date())
}

export const errorText = (error) => error?.message || String(error || '')
