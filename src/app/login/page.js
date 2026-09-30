'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import styles from './login.module.css'

const supabase = createClient()
const OAUTH_CALLBACK_URL = 'https://ritsuflow.com/auth/callback'

function safeNextPath(value) {
  if (!value || typeof value !== 'string') return '/workspaces'
  if (!value.startsWith('/') || value.startsWith('//')) return '/workspaces'
  return value
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  async function handleGoogleLogin() {
    setGoogleLoading(true)
    setErrorMessage('')

    const nextPath = typeof window !== 'undefined'
      ? safeNextPath(new URLSearchParams(window.location.search).get('next'))
      : '/workspaces'

    const redirectTo = `${OAUTH_CALLBACK_URL}?next=${encodeURIComponent(nextPath)}`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      setErrorMessage('Google sign-in could not be started. Please try again.')
      setGoogleLoading(false)
    }
  }

  async function handleLogin(event) {
    event.preventDefault()
    setLoading(true)
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrorMessage('Invalid email or password.')
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

      <div className={styles.shell}>
        <section className={styles.brandPanel}>
          <a href="/" className={styles.brand} aria-label="RitsuFlow home">
            <Image src="/logo-white.png" alt="RitsuFlow" width={300} height={110} priority className={styles.logo} />
          </a>

          <div className={styles.brandContent}>
            <h1>Plan by location.<br />Control by <span>flow.</span></h1>
            <div className={styles.accentLine} />
            <p className={styles.brandDescription}>RitsuFlow™ connects master planning, lookahead preparation, weekly commitments, and production control in one integrated construction workflow.</p>

            <div className={styles.principles}>
              <div className={styles.principle}><span className={styles.principleIcon}>01</span><div><strong>Flow-Based Planning</strong><p>Align locations, sequence, and production.</p></div></div>
              <div className={styles.principle}><span className={styles.principleIcon}>02</span><div><strong>Reliable Execution</strong><p>Make work ready before you commit.</p></div></div>
              <div className={styles.principle}><span className={styles.principleIcon}>03</span><div><strong>Continuous Control</strong><p>Connect planning decisions to execution.</p></div></div>
            </div>
          </div>
        </section>

        <section className={styles.loginArea}>
          <div className={styles.loginCard}>
            <div className={styles.cardLogo}><Image src="/logo-white.png" alt="RitsuFlow" width={190} height={70} priority /></div>
            <header className={styles.loginHeader}><h2>Welcome back</h2><p>Sign in to continue to RitsuFlow™</p></header>

            {errorMessage && <div role="alert" className={styles.error}>{errorMessage}</div>}

            <button type="button" onClick={handleGoogleLogin} disabled={googleLoading || loading} className={styles.googleButton}>
              <span className={styles.googleMark} aria-hidden="true">G</span>
              <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
            </button>

            <div className={styles.authDivider}><span>or continue with email</span></div>

            <form onSubmit={handleLogin} className={styles.form}>
              <label className={styles.field}>
                <span>Email</span>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon} aria-hidden="true">@</span>
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter your email" autoComplete="email" required />
                </div>
              </label>

              <label className={styles.field}>
                <span>Password</span>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputIcon} aria-hidden="true">•</span>
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
                  <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button>
                </div>
              </label>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px' }}>
                <Link href="/forgot-password" style={{ color: '#11c7b2', fontSize: '.9rem', fontWeight: 700, textDecoration: 'none' }}>Forgot password?</Link>
              </div>

              <button type="submit" disabled={loading || googleLoading} className={styles.submitButton}>{loading ? 'Signing in...' : 'Sign in'}{!loading && <span aria-hidden="true">→</span>}</button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center', color: '#b6c3d1', fontSize: '.92rem' }}>
              New to RitsuFlow? <Link href="/register" style={{ color: '#11c7b2', fontWeight: 700, textDecoration: 'none' }}>Create an account</Link>
            </div>

            <div className={styles.privateAccess}><div className={styles.lockIcon}>🔒</div><div><strong>Private development access</strong><p>Registration creates an account only. Organization and project access require authorization.</p></div></div>
          </div>

          <div className={styles.support}><span>Need help?</span><span>Contact your system administrator.</span></div>
          <div className={styles.copyright}>© {new Date().getFullYear()} Eduardo Fernandes de Freitas. All rights reserved.</div>
        </section>
      </div>
    </main>
  )
}
