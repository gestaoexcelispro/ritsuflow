'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase/client'
import AuthShell, { AuthField } from '../login/AuthShell'
import styles from '../login/login.module.css'
import { useT } from '../../lib/i18n/useT'

const supabase = createClient()

export default function ResetPasswordPage() {
  const t = useT('auth')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const [validating, setValidating] = useState(true)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let mounted = true
    let subscription = null

    async function initialize() {
      setValidating(true)
      setErrorMessage('')

      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')

        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error

          if (data?.session && mounted) {
            setSessionReady(true)
            setValidating(false)
            window.history.replaceState({}, document.title, url.pathname)
            return
          }
        }

        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) throw sessionError

        if (session && mounted) {
          setSessionReady(true)
          setValidating(false)
          return
        }

        if (mounted) {
          setErrorMessage(t('reset.errLink'))
          setValidating(false)
        }
      } catch (error) {
        console.error('Password recovery initialization failed.', error)
        if (mounted) {
          setSessionReady(false)
          setValidating(false)
          setErrorMessage(t('reset.errLink'))
        }
      }
    }

    const listener = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!mounted) return
      if (event === 'PASSWORD_RECOVERY' && currentSession) {
        setSessionReady(true)
        setValidating(false)
        setErrorMessage('')
      }
    })
    subscription = listener.data.subscription

    initialize()

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    if (!sessionReady) return setErrorMessage(t('reset.errNotReady'))
    if (password.length < 8) return setErrorMessage(t('errPasswordLength'))
    if (password !== confirmPassword) return setErrorMessage(t('errPasswordMatch'))

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setSuccess(true)
    } catch (error) {
      console.error('Password update failed.', error)
      setErrorMessage(error.message || t('reset.errUpdate'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title={t('reset.title')} subtitle={t('reset.subtitle')}>
      {success ? (
        <div className={styles.form}>
          <div role="status" className={styles.success}>{t('reset.success')}</div>
          <p className={styles.footLine}><Link href="/login" className={styles.textLink}>{t('continueSignIn')}</Link></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className={styles.form}>
          {errorMessage && <div role="alert" className={styles.error}>{errorMessage}</div>}
          {validating && !errorMessage && <div className={styles.info}>{t('reset.validating')}</div>}
          <AuthField label={t('newPassword')} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required disabled={!sessionReady || loading} placeholder={t('passwordRule')} />
          <AuthField label={t('confirmPassword')} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required disabled={!sessionReady || loading} placeholder={t('confirmPasswordPlaceholder')} />
          <button type="submit" disabled={!sessionReady || loading} className={styles.submitButton}>{loading ? t('reset.updating') : t('reset.submit')}</button>
          {errorMessage && !sessionReady && <p className={styles.footLine}><Link href="/forgot-password" className={styles.textLink}>{t('reset.requestNew')}</Link></p>}
        </form>
      )}
    </AuthShell>
  )
}
