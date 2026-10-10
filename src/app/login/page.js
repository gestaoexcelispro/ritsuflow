'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Script from 'next/script'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import styles from './login.module.css'
import LanguageSelector from '../../components/LanguageSelector'
import { useT } from '../../lib/i18n/useT'
import { useLanguage } from '../../lib/i18n/LanguageProvider'

const supabase = createClient()
const OAUTH_CALLBACK_URL = 'https://ritsuflow.com/auth/callback'
// Google OAuth Web Client ID (public value). When set, sign-in uses Google's own
// button on ritsuflow.com, so Google's prompt shows RitsuFlow instead of the
// Supabase project domain. When unset, the old redirect flow is used.
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID

function safeNextPath(value) {
  if (!value || typeof value !== 'string') return '/workspaces'
  if (!value.startsWith('/') || value.startsWith('//')) return '/workspaces'
  return value
}

function currentNextPath() {
  return typeof window !== 'undefined'
    ? safeNextPath(new URLSearchParams(window.location.search).get('next'))
    : '/workspaces'
}

// Nonce pair: Google gets the SHA-256 hash, Supabase gets the raw value.
async function generateNonce() {
  const raw = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hashed = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return { raw, hashed }
}

export default function LoginPage() {
  const t = useT('auth')
  const { language } = useLanguage()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()
  const googleButtonRef = useRef(null)
  const [gisReady, setGisReady] = useState(false)
  const [gisRendered, setGisRendered] = useState(false)

  const initGoogleButton = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current || !window.google?.accounts?.id) return
    const { raw, hashed } = await generateNonce()

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      nonce: hashed,
      ux_mode: 'popup',
      use_fedcm_for_prompt: true,
      callback: async ({ credential }) => {
        setGoogleLoading(true)
        setErrorMessage('')
        const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce: raw })
        if (error) {
          setErrorMessage(t('login.errGoogle'))
          setGoogleLoading(false)
          initGoogleButton() // fresh nonce for the next attempt
          return
        }
        router.replace(currentNextPath())
        router.refresh()
      },
    })

    googleButtonRef.current.innerHTML = ''
    window.google.accounts.id.renderButton(googleButtonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'rectangular',
      text: 'continue_with',
      logo_alignment: 'center',
      locale: language,
      width: Math.min(googleButtonRef.current.offsetWidth || 400, 400),
    })
    setGisRendered(true)
  }, [router, language, t])

  useEffect(() => {
    if (gisReady) initGoogleButton()
  }, [gisReady, initGoogleButton])

  // Fallback: Supabase redirect flow (shows the supabase.co domain on Google's screen).
  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setErrorMessage('')

    const nextPath = currentNextPath()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${OAUTH_CALLBACK_URL}?next=${encodeURIComponent(nextPath)}`,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    })

    if (error) {
      setErrorMessage(t('login.errGoogleStart'))
      setGoogleLoading(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    setLoading(true)
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMessage(t('login.errInvalid'))
      setLoading(false)
      return
    }

    const nextPath = typeof window !== 'undefined'
      ? safeNextPath(new URLSearchParams(window.location.search).get('next'))
      : '/workspaces'

    router.replace(nextPath)
    router.refresh()
  }

  return (
    <main className={styles.page}>
      <div className={styles.background} />
      <div className={styles.overlay} />
      <div className={styles.flowLines}><span /><span /><span /><span /><span /></div>
      <div className={styles.lang}><LanguageSelector dark /></div>

      <div className={styles.shell}>
        <section className={styles.brandPanel}>
          <a href="/" className={styles.brand} aria-label={t('login.homeAria')}>
            <Image src="/logo-white.png" alt="RitsuFlow" width={300} height={110} priority className={styles.logo} />
          </a>

          <div className={styles.brandContent}>
            <h1>{t('login.heroLine1')}<br />{t('login.heroLine2')} <span>{t('login.heroAccent')}</span></h1>
            <div className={styles.accentLine} />
            <p className={styles.brandDescription}>{t('login.heroText')}</p>
            <div className={styles.principles}>
              <div className={styles.principle}><span className={styles.principleIcon}>01</span><div><strong>{t('login.p1Title')}</strong><p>{t('login.p1Text')}</p></div></div>
              <div className={styles.principle}><span className={styles.principleIcon}>02</span><div><strong>{t('login.p2Title')}</strong><p>{t('login.p2Text')}</p></div></div>
              <div className={styles.principle}><span className={styles.principleIcon}>03</span><div><strong>{t('login.p3Title')}</strong><p>{t('login.p3Text')}</p></div></div>
            </div>
          </div>
        </section>

        <section className={styles.loginArea}>
          <div className={styles.loginCard}>
            <div className={styles.cardLogo}><Image src="/logo-white.png" alt="RitsuFlow" width={190} height={70} priority /></div>
            <header className={styles.loginHeader}><h2>{t('login.title')}</h2><p>{t('login.subtitle')}</p></header>

            {errorMessage && <div role="alert" className={styles.error}>{errorMessage}</div>}

            {GOOGLE_CLIENT_ID && (
              <>
                <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onReady={() => setGisReady(true)} />
                <div ref={googleButtonRef} aria-busy={!gisRendered} style={{ display: gisRendered ? 'flex' : 'none', justifyContent: 'center', width: '100%', minHeight: 44, opacity: googleLoading ? .62 : 1, pointerEvents: googleLoading ? 'none' : 'auto' }} />
              </>
            )}

            {!gisRendered && (
            <button type="button" onClick={handleGoogleLogin} disabled={googleLoading || loading} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, width:'100%', minHeight:50, padding:'0 16px', color:'#172033', border:'1px solid rgba(255,255,255,.72)', borderRadius:10, background:'#fff', cursor:(googleLoading || loading) ? 'not-allowed' : 'pointer', fontSize:'.92rem', fontWeight:700, opacity:(googleLoading || loading) ? .62 : 1 }}>
              <span aria-hidden="true" style={{ color:'#4285f4', fontSize:'1rem', fontWeight:900 }}>G</span>
              <span>{googleLoading ? t('login.googleConnecting') : t('login.google')}</span>
            </button>
            )}

            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', margin:'18px 0', color:'rgba(182,195,209,.72)', fontSize:'.72rem', textTransform:'uppercase', letterSpacing:'.04em' }}>{t('login.orEmail')}</div>

            <form onSubmit={handleLogin} className={styles.form}>
              <label className={styles.field}>
                <span>{t('email')}</span>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon} aria-hidden="true">@</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t('emailPlaceholder')} autoComplete="email" required />
                </div>
              </label>

              <label className={styles.field}>
                <span>{t('password')}</span>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon} aria-hidden="true">•</span>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('login.passwordPlaceholder')} autoComplete="current-password" required />
                  <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}>{showPassword ? t('login.hide') : t('login.show')}</button>
                </div>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px' }}>
                <Link href="/forgot-password" style={{ color: '#11c7b2', fontSize: '.9rem', fontWeight: 700, textDecoration: 'none' }}>{t('login.forgot')}</Link>
              </div>

              <button type="submit" disabled={loading || googleLoading} className={styles.submitButton}>{loading ? t('login.signingIn') : t('login.signIn')}{!loading && <span aria-hidden="true">→</span>}</button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center', color: '#b6c3d1', fontSize: '.92rem' }}>
              {t('login.newHere')} <Link href="/register" style={{ color: '#11c7b2', fontWeight: 700, textDecoration: 'none' }}>{t('login.createAccount')}</Link>
            </div>

            <div className={styles.privateAccess}><div className={styles.lockIcon}>🔒</div><div><strong>{t('login.privateTitle')}</strong><p>{t('login.privateText')}</p></div></div>
          </div>

          <div className={styles.support}><span>{t('help')}</span><span>{t('helpText')}</span></div>
          <div className={styles.copyright}>{t('copyright', { year: new Date().getFullYear() })}</div>
        </section>
      </div>
    </main>
  )
}
