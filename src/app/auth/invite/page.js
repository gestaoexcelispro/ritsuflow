'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'
import AuthShell, { AuthField } from '../../login/AuthShell'
import styles from '../../login/login.module.css'
import { useT } from '../../../lib/i18n/useT'

const supabase = createClient()

export default function InvitePage() {
  const t = useT('auth')
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    let mounted = true

    async function initializeInvitationSession() {
      try {
        setErrorMessage('')

        const url = new URL(window.location.href)
        const search = url.searchParams
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''))

        const returnedError =
          search.get('error_description') ||
          hash.get('error_description') ||
          search.get('error') ||
          hash.get('error')

        if (returnedError) {
          throw new Error(decodeURIComponent(returnedError.replace(/\+/g, ' ')))
        }

        let session = null

        // Supabase PKCE flow: the redirect contains ?code=...
        const code = search.get('code')
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error
          session = data?.session || null
        }

        // Supabase token-hash flow: support explicit invite verification links.
        if (!session) {
          const tokenHash = search.get('token_hash')
          const type = search.get('type')

          if (tokenHash && type === 'invite') {
            const { data, error } = await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'invite',
            })
            if (error) throw error
            session = data?.session || null
          }
        }

        // Supabase implicit flow: credentials are returned in the URL fragment.
        if (!session) {
          const accessToken = hash.get('access_token')
          const refreshToken = hash.get('refresh_token')

          if (accessToken && refreshToken) {
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (error) throw error
            session = data?.session || null
          }
        }

        // The browser client may already have consumed the redirect credentials.
        if (!session) {
          const { data, error } = await supabase.auth.getSession()
          if (error) throw error
          session = data?.session || null
        }

        if (!session) {
          throw new Error(t('invite.errLink'))
        }

        if (!mounted) return

        // Remove authentication credentials from the visible browser URL after use.
        window.history.replaceState({}, document.title, '/auth/invite')
        setSessionReady(true)
        setErrorMessage('')
      } catch (error) {
        console.error('Invitation session initialization failed.', error)

        if (mounted) {
          const message = String(error?.message || '')
          const looksExpired = /expired|invalid|otp|token|code verifier|pkce/i.test(message)

          setErrorMessage(
            looksExpired
              ? t('invite.errLink')
              : message || t('invite.errValidate')
          )
        }
      }
    }

    initializeInvitationSession()

    return () => {
      mounted = false
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleActivateAccount(event) {
    event.preventDefault()
    setErrorMessage('')

    if (!sessionReady) {
      setErrorMessage(t('invite.errNotReady'))
      return
    }

    if (password.length < 8) {
      setErrorMessage(t('errPasswordLength'))
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage(t('errPasswordMatch'))
      return
    }

    setLoading(true)

    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password })

      if (passwordError) {
        throw new Error(passwordError.message || t('invite.errPassword'))
      }

      const activationResponse = await fetch('/api/auth/activate-invitation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const activationResult = await activationResponse.json()

      if (!activationResponse.ok) {
        throw new Error(
          activationResult.error || t('invite.errActivate')
        )
      }

      router.replace('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Account activation failed.', error)
      setErrorMessage(error.message || t('invite.errAccount'))
      setLoading(false)
    }
  }

  return (
    <AuthShell title={t('invite.title')} subtitle={t('invite.subtitle')}>
      <form onSubmit={handleActivateAccount} className={styles.form}>
        {errorMessage && <div role="alert" className={styles.error}>{errorMessage}</div>}
        {!sessionReady && !errorMessage && <div className={styles.info}>{t('invite.validating')}</div>}
        <AuthField label={t('invite.createPassword')} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={t('passwordRule')} autoComplete="new-password" required disabled={!sessionReady || loading} />
        <AuthField label={t('confirmPassword')} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder={t('confirmPasswordPlaceholder')} autoComplete="new-password" required disabled={!sessionReady || loading} />
        <button type="submit" disabled={!sessionReady || loading} className={styles.submitButton}>{loading ? t('invite.activating') : t('invite.submit')}</button>
      </form>
    </AuthShell>
  )
}
