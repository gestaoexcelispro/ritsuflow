'use client'

import { useLanguage } from '@/lib/i18n/LanguageProvider'
import { LANGUAGE_OPTIONS } from '@/lib/i18n/settings'
import { useT } from '@/lib/i18n/useT'

/** Compact language switch for top bars. The choice is saved to the user's profile. */
export default function LanguageSelector({ dark = false, compact = false }) {
  const { language, setLanguage } = useLanguage()
  const t = useT('common')

  return (
    <label
      title={t('language.label')}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: compact ? 30 : 34,
        padding: compact ? '0 7px' : '0 9px',
        border: dark ? '1px solid rgba(255,255,255,.16)' : '1px solid #d6e0e3',
        borderRadius: 7,
        background: dark ? 'rgba(255,255,255,.05)' : '#fff',
        color: dark ? '#dcebed' : '#405964',
        fontSize: compact ? 11 : 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      }}
    >
      <span aria-hidden="true">🌐</span>
      <select
        aria-label={t('language.select')}
        value={language}
        onChange={(event) => setLanguage(event.target.value)}
        style={{ border: 'none', outline: 'none', background: 'transparent', color: 'inherit', font: 'inherit', cursor: 'pointer' }}
      >
        {LANGUAGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value} title={option.label} style={{ color: '#203945' }}>
            {option.short}
          </option>
        ))}
      </select>
    </label>
  )
}
