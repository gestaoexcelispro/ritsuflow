'use client'

import Image from 'next/image'
import LanguageSelector from '../../components/LanguageSelector'
import { useT } from '../../lib/i18n/useT'
import styles from './login.module.css'

/** Branded frame for the sign-in family of pages: same background and card as the login page. */
export default function AuthShell({ title, subtitle, children }) {
  const t = useT('auth')
  return (
    <main className={styles.page}>
      <div className={styles.background} />
      <div className={styles.overlay} />
      <div className={styles.flowLines}><span /><span /><span /><span /><span /></div>
      <div className={styles.lang}><LanguageSelector dark /></div>
      <div className={styles.single}>
        <section className={styles.loginArea}>
          <div className={styles.loginCard}>
            <div className={styles.cardLogo}><Image src="/logo-white.png" alt="RitsuFlow" width={190} height={70} priority /></div>
            <header className={styles.loginHeader}><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</header>
            {children}
          </div>
          <div className={styles.support}><span>{t('help')}</span><span>{t('helpText')}</span></div>
          <div className={styles.copyright}>{t('copyright', { year: new Date().getFullYear() })}</div>
        </section>
      </div>
    </main>
  )
}

/** Password-style input in the login look. Module-level so it keeps focus while typing. */
export function AuthField({ label, icon = '•', ...input }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.inputWrapper}>
        <span className={styles.inputIcon} aria-hidden="true">{icon}</span>
        <input {...input} />
      </div>
    </label>
  )
}
