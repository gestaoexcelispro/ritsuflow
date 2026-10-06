'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useLanguage, type AppLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import s from '../_landing/landing.module.css'

const CONTACT_EMAIL = 'contact@excelispro.com'
const LANGUAGES: { code: AppLanguage; label: string }[] = [{ code: 'en-US', label: 'EN' }, { code: 'pt-BR', label: 'PT' }, { code: 'es', label: 'ES' }]

/** Privacy policy for the data the public site collects (trial applications), under the LGPD. */
export default function PrivacyPolicy() {
  const t = useT('landing')
  const { language, setLanguage } = useLanguage()
  return (
    <div className={s.page} lang={language}>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link href="/" className={s.brand} aria-label={t('nav.home')}>
            <Image src="/logo.png" alt="RitsuFlow" width={2000} height={1000} priority className={s.logo} />
          </Link>
          <span style={{ flex: 1 }} />
          <div role="group" aria-label={t('nav.language')} className={s.lang}>
            {LANGUAGES.map(l => <button key={l.code} type="button" lang={l.code} aria-pressed={language === l.code} onClick={() => setLanguage(l.code)}>{l.label}</button>)}
          </div>
        </div>
      </header>
      <main className={s.section}>
        <article className={s.container} style={{ maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 22 }}>
          <Link href="/">← {t('privacy.back')}</Link>
          <h1 style={{ fontSize: 40, fontWeight: 800, letterSpacing: '-0.02em' }}>{t('privacy.title')}</h1>
          <p className={s.small} style={{ margin: 0 }}>{t('privacy.updated')}</p>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <section key={n} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 style={{ fontSize: 22 }}>{t(`privacy.s${n}.title`)}</h2>
              <p style={{ margin: 0, fontSize: 16, lineHeight: 1.65, color: 'var(--body)' }}>
                {t(`privacy.s${n}.text`)}{n === 6 && <> <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></>}
              </p>
            </section>
          ))}
        </article>
      </main>
      <footer className={s.footer}>
        <div className={`${s.container} ${s.footerBottom}`}>{t('footer.copyright')}</div>
      </footer>
    </div>
  )
}
