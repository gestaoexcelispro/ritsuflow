'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useLanguage, type AppLanguage } from '@/lib/i18n/LanguageProvider'
import { useT } from '@/lib/i18n/useT'
import TrialForm from './TrialForm'
import s from './landing.module.css'

export const CONTACT_EMAIL = 'contact@excelispro.com'
export const LINKEDIN_URL = 'https://www.linkedin.com/company/144771058/'

const LANGUAGES: { code: AppLanguage; label: string }[] = [
  { code: 'en-US', label: 'EN' },
  { code: 'pt-BR', label: 'PT' },
  { code: 'es', label: 'ES' },
]

const MODULES = [
  { key: 'ritsuscope', name: 'RitsuScope', image: '/ritsuscope-icon.svg', fit: 'contain', isNew: false },
  { key: 'commercial', name: 'Commercial', image: '/commercial-icon.svg', fit: 'contain', isNew: true },
  { key: 'projects', name: 'Projects', image: '/projects-icon.png', fit: 'cover', isNew: false },
  { key: 'precon', name: 'PreCon', image: '/precon-icon.png', fit: 'cover', isNew: false },
  { key: 'fieldop', name: 'FieldOp', image: '/fieldop-icon.png', fit: 'cover', isNew: false },
] as const

const FLOW = [
  { n: '01', module: 'RITSUSCOPE', tone: 'teal' },
  { n: '02', module: 'COMMERCIAL', tone: 'pink' },
  { n: '03', module: 'COMMERCIAL → PROJECTS', tone: 'pink' },
  { n: '04', module: 'PRECON', tone: 'teal' },
  { n: '05', module: 'FIELDOP', tone: 'teal' },
] as const

const ROADMAP = [
  { status: 'done' }, { status: 'done' }, { status: 'done' }, { status: 'inProgress' }, { status: 'next' }, { status: 'next' },
] as const

function Check({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className={s.check}>
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  )
}

/** Public landing page (EN / PT / ES). */
export default function Landing() {
  const t = useT('landing')
  const { language, setLanguage } = useLanguage()
  const [menuOpen, setMenuOpen] = useState(false)

  // BDI example: the worked TCU case from the pricing tests (scripts/commercial-pricing.test.mjs).
  const brl = (v: number) => new Intl.NumberFormat(language, { style: 'currency', currency: 'BRL' }).format(v)
  const pct = (v: number) => new Intl.NumberFormat(language, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + '%'

  const navLinks = (
    <>
      <a href="#modules" onClick={() => setMenuOpen(false)}>{t('nav.modules')}</a>
      <a href="#takeoff" onClick={() => setMenuOpen(false)}>{t('nav.takeoff')}</a>
      <a href="#flow" onClick={() => setMenuOpen(false)}>{t('nav.flow')}</a>
      <a href="#estimating" onClick={() => setMenuOpen(false)}>{t('nav.estimating')}</a>
      <a href="#roadmap" onClick={() => setMenuOpen(false)}>{t('nav.roadmap')}</a>
      <a href="#about" onClick={() => setMenuOpen(false)}>{t('nav.about')}</a>
    </>
  )
  const languageSwitch = (
    <div role="group" aria-label={t('nav.language')} className={s.lang}>
      {LANGUAGES.map(l => (
        <button key={l.code} type="button" lang={l.code} aria-pressed={language === l.code} onClick={() => setLanguage(l.code)}>{l.label}</button>
      ))}
    </div>
  )

  return (
    <div className={s.page} lang={language}>
      <a href="#main" className={s.skip}>{t('nav.skip')}</a>

      <header className={s.header}>
        <div className={s.headerInner}>
          <a href="#top" className={s.brand} aria-label={t('nav.home')}>
            <Image src="/logo.png" alt="RitsuFlow" width={2000} height={1000} priority className={s.logo} />
          </a>
          <nav aria-label={t('nav.main')} className={s.navLinks}>{navLinks}</nav>
          <div className={s.headerActions}>
            <span className={s.desktopOnly}>{languageSwitch}</span>
            <Link href="/login" className={`${s.btn} ${s.btnGhost} ${s.desktopOnly}`}>{t('nav.signIn')}</Link>
            <a href="#trial" className={`${s.btn} ${s.btnPrimary}`}>
              <span className={s.desktopOnly}>{t('nav.apply')}</span>
              <span className={s.mobileOnly}>{t('nav.applyShort')}</span>
            </a>
            <button type="button" className={s.menuButton} aria-expanded={menuOpen} aria-controls="mobile-menu"
              aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')} onClick={() => setMenuOpen(o => !o)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                {menuOpen ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 5h14M3 10h14M3 15h14" />}
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div id="mobile-menu" className={s.mobileMenu}>
            <nav aria-label={t('nav.main')}>{navLinks}</nav>
            {languageSwitch}
            <Link href="/login" className={`${s.btn} ${s.btnGhost}`}>{t('nav.signIn')}</Link>
          </div>
        )}
      </header>

      <main id="main">
        {/* HERO */}
        <section id="top" className={s.hero}>
          <div className={`${s.container} ${s.heroInner}`}>
            <div className={s.heroCopy}>
              <span className={s.badge}><span className={s.dot} />{t('hero.badge')}</span>
              <h1 className={s.heroTitle}>{t('hero.title1')} <span>{t('hero.title2')}</span></h1>
              <p className={s.heroLead}>{t('hero.lead')}</p>
              <div className={s.actions}>
                <a href="#trial" className={`${s.btn} ${s.btnPrimary} ${s.btnLarge}`}>{t('nav.apply')}</a>
                <a href="#flow" className={`${s.btn} ${s.btnGhost} ${s.btnLarge}`}>{t('hero.ctaFlow')}</a>
              </div>
              <ul className={s.points}>
                <li><Check />{t('hero.pointBR')}</li>
                <li><Check />{t('hero.pointUS')}</li>
                <li><Check />{t('hero.pointLang')}</li>
              </ul>
            </div>
            <div className={s.heroShots}>
              <figure className={s.window}>
                <figcaption className={s.windowBar}><span /><span /><span /><em>{t('hero.shot1Label')}</em></figcaption>
                <Image src="/masterplan.png" alt={t('hero.shot1Alt')} width={1771} height={858} priority sizes="(max-width: 980px) 100vw, 640px" />
              </figure>
              <figure className={`${s.window} ${s.windowFloat}`}>
                <figcaption className={s.windowBar}><em>{t('hero.shot2Label')}</em></figcaption>
                <Image src="/constraint.png" alt={t('hero.shot2Alt')} width={1768} height={823} sizes="(max-width: 980px) 60vw, 360px" />
              </figure>
            </div>
          </div>
        </section>

        {/* MODULES */}
        <section id="modules" className={s.section}>
          <div className={s.container}>
            <header className={s.sectionHead}>
              <span className={s.kicker}>{t('modules.kicker')}</span>
              <h2>{t('modules.title')}</h2>
              <p>{t('modules.lead')}</p>
            </header>
            <div className={s.modules}>
              {MODULES.map(m => (
                <article key={m.key} className={`${s.module} ${m.isNew ? s.moduleNew : ''}`}>
                  {m.isNew && <span className={s.newTag}>{t('modules.new')}</span>}
                  <div className={`${s.moduleArt} ${m.fit === 'contain' ? s.moduleArtContain : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.image} alt="" loading="lazy" />
                  </div>
                  <div className={s.moduleBody}>
                    <span className={`${s.eyebrow} ${m.key === 'commercial' ? s.pink : ''}`}>{t(`modules.${m.key}.eyebrow`)}</span>
                    <h3>{m.name}</h3>
                    <p>{t(`modules.${m.key}.desc`)}</p>
                    <p className={s.features}>{t(`modules.${m.key}.features`)}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* RITSUSCOPE TAKEOFF */}
        <section id="takeoff" className={`${s.section} ${s.tint}`}>
          <div className={s.container}>
            <header className={s.sectionHead}>
              <span className={s.kicker}>{t('scope.kicker')}</span>
              <h2>{t('scope.title')}</h2>
              <p>{t('scope.lead')}</p>
            </header>
            <figure className={`${s.window} ${s.scopeMain}`}>
              <figcaption className={s.windowBar}><span /><span /><span /><em>{t('scope.shot1Label')}</em></figcaption>
              <Image src="/landing/ritsuscope-takeoff.webp" alt={t('scope.shot1Alt')} width={1913} height={907} sizes="(max-width: 1240px) 100vw, 1192px" />
            </figure>
            <div className={s.scopeGrid}>
              <figure className={s.scopeCard}>
                <div className={s.scopeArt}><Image src="/landing/ritsuscope-3d-print.webp" alt={t('scope.shot2Alt')} width={978} height={690} sizes="(max-width: 760px) 100vw, 590px" /></div>
                <figcaption><strong>{t('scope.shot2Title')}</strong><span>{t('scope.shot2Text')}</span></figcaption>
              </figure>
              <figure className={s.scopeCard}>
                <div className={s.scopeArt}><Image src="/landing/ritsuscope-framing-3d.webp" alt={t('scope.shot3Alt')} width={1101} height={565} sizes="(max-width: 760px) 100vw, 590px" /></div>
                <figcaption><strong>{t('scope.shot3Title')}</strong><span>{t('scope.shot3Text')}</span></figcaption>
              </figure>
            </div>
            <ul className={s.tags} style={{ marginTop: 24 }}>
              {[1, 2, 3, 4, 5].map(n => <li key={n}>{t(`scope.tag${n}`)}</li>)}
            </ul>
          </div>
        </section>

        {/* FLOW */}
        <section id="flow" className={`${s.section} ${s.dark}`}>
          <div className={s.container}>
            <header className={s.sectionHead}>
              <span className={s.kicker}>{t('flow.kicker')}</span>
              <h2>{t('flow.title')}</h2>
              <p>{t('flow.lead')}</p>
            </header>
            <ol className={s.flow}>
              {FLOW.map((f, i) => (
                <li key={f.n}>
                  <span className={s.flowNumber}>{f.n}</span>
                  <strong>{t(`flow.s${i + 1}.title`)}</strong>
                  <span>{t(`flow.s${i + 1}.text`)}</span>
                  <span className={`${s.flowModule} ${f.tone === 'pink' ? s.flowPink : ''}`}>{f.module}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ESTIMATING */}
        <section id="estimating" className={s.section}>
          <div className={`${s.container} ${s.split}`}>
            <div className={s.splitCopy}>
              <span className={`${s.kicker} ${s.pink}`}>{t('est.kicker')}</span>
              <h2>{t('est.title')}</h2>
              <p>{t('est.lead')}</p>
              <ul className={s.bullets}>
                {[1, 2, 3, 4, 5].map(n => (
                  <li key={n}><Check size={20} /><span><strong>{t(`est.b${n}.strong`)}</strong> {t(`est.b${n}.text`)}</span></li>
                ))}
              </ul>
            </div>
            <div className={s.splitArt}>
              <div className={s.bdiCard}>
                <div className={s.bdiHead}><strong>{t('est.card.title')}</strong><span>{t('est.card.example')}</span></div>
                <dl className={s.bdiRows}>
                  <div><dt>{t('est.card.material')}</dt><dd>{brl(186245.64)}</dd></div>
                  <div><dt>{t('est.card.labor')}</dt><dd>{brl(108119.47)}</dd></div>
                  <div className={s.bdiTotal}><dt>{t('est.card.direct')}</dt><dd>{brl(294365.11)}</dd></div>
                </dl>
                <dl className={s.bdiRates}>
                  <div><dt>{t('est.card.ac')}</dt><dd>{pct(4)}</dd></div>
                  <div><dt>{t('est.card.sg')}</dt><dd>{pct(0.8)}</dd></div>
                  <div><dt>{t('est.card.r')}</dt><dd>{pct(1.2)}</dd></div>
                  <div><dt>{t('est.card.df')}</dt><dd>{pct(1.1)}</dd></div>
                  <div><dt>{t('est.card.l')}</dt><dd>{pct(7.4)}</dd></div>
                  <div><dt>{t('est.card.taxes')}</dt><dd>{pct(11.15)}</dd></div>
                </dl>
                <div className={s.bdiLine}><span>{t('est.card.bdi')}</span><strong>{pct(29.54)}</strong></div>
                <div className={s.bdiPrice}><strong>{t('est.card.price')}</strong><span>{brl(381320.54)}</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* LEAN */}
        <section className={`${s.section} ${s.tint}`}>
          <div className={`${s.container} ${s.split} ${s.splitReverse}`}>
            <div className={s.splitArt}>
              <figure className={s.window}>
                <Image src="/wp-ready.png" alt={t('lean.shotAlt')} width={1466} height={1073} sizes="(max-width: 980px) 100vw, 620px" />
              </figure>
            </div>
            <div className={s.splitCopy}>
              <span className={s.kicker}>{t('lean.kicker')}</span>
              <h2>{t('lean.title')}</h2>
              <p>{t('lean.lead')}</p>
              <ul className={s.tags}>
                {[1, 2, 3, 4].map(n => <li key={n}>{t(`lean.tag${n}`)}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* CONTROL */}
        <section className={s.section}>
          <div className={s.container}>
            <header className={s.sectionHead}>
              <span className={s.kicker}>{t('control.kicker')}</span>
              <h2>{t('control.title')}</h2>
            </header>
            <div className={s.cards}>
              {[1, 2, 3].map(n => (
                <div key={n} className={s.card}>
                  <strong>{t(`control.c${n}.title`)}</strong>
                  <span>{t(`control.c${n}.text`)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ROADMAP */}
        <section id="roadmap" className={`${s.section} ${s.dark}`}>
          <div className={s.container}>
            <header className={s.sectionHead}>
              <span className={s.kicker}>{t('roadmap.kicker')}</span>
              <h2>{t('roadmap.title')}</h2>
            </header>
            <ol className={s.roadmap}>
              {ROADMAP.map((r, i) => (
                <li key={i} className={r.status === 'inProgress' ? s.roadmapCurrent : ''}>
                  <div className={s.roadmapTop}>
                    <span>{t(`roadmap.r${i + 1}.date`)}</span>
                    <span className={`${s.status} ${s[`status_${r.status}`]}`}>{t(`roadmap.${r.status}`)}</span>
                  </div>
                  <strong>{t(`roadmap.r${i + 1}.title`)}</strong>
                  <span>{t(`roadmap.r${i + 1}.text`)}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" className={s.section}>
          <div className={`${s.container} ${s.about}`}>
            <div className={s.aboutCopy}>
              <span className={s.kicker}>{t('about.kicker')}</span>
              <h2>{t('about.title')}</h2>
              <p>{t('about.lead')}</p>
            </div>
            <div className={s.founder}>
              <div className={s.avatar} aria-hidden="true">EF</div>
              <div>
                <span className={s.eyebrow}>{t('about.founder')}</span>
                <strong>Eduardo Fernandes de Freitas</strong>
                <span className={s.founderTitle}>{t('about.founderTitle')}</span>
                <p>{t('about.founderBio')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* TRIAL */}
        <section id="trial" className={`${s.section} ${s.trialSection}`}>
          <div className={`${s.container} ${s.trial}`}>
            <div className={s.trialCopy}>
              <span className={s.kicker}>{t('trial.kicker')}</span>
              <h2>{t('trial.title')}</h2>
              <p>{t('trial.lead')}</p>
              <p className={s.small}>{t('trial.questions')} <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
            </div>
            <TrialForm />
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.container} ${s.footerTop}`}>
          <div className={s.footerBrand}>
            <Image src="/logo-white.png" alt="RitsuFlow" width={2000} height={1000} className={s.footerLogo} />
            <span>{t('footer.tagline')}</span>
            <span className={s.small}>{t('footer.madeBy')}</span>
          </div>
          <nav aria-label={t('footer.product')}>
            <strong>{t('footer.product')}</strong>
            <a href="#modules">{t('nav.modules')}</a>
            <a href="#estimating">{t('nav.estimating')}</a>
            <a href="#roadmap">{t('nav.roadmap')}</a>
          </nav>
          <nav aria-label={t('footer.company')}>
            <strong>{t('footer.company')}</strong>
            <a href="#about">{t('nav.about')}</a>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">{t('footer.linkedin')}</a>
          </nav>
          <nav aria-label={t('footer.legal')}>
            <strong>{t('footer.legal')}</strong>
            <Link href="/privacy">{t('footer.privacy')}</Link>
          </nav>
        </div>
        <div className={`${s.container} ${s.footerBottom}`}>{t('footer.copyright')}</div>
      </footer>
    </div>
  )
}
