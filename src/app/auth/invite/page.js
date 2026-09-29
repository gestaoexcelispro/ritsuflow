'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase/client'

const supabase = createClient()

export default function InvitePage() {
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
          throw new Error(
            'This invitation link is invalid or has expired. Please ask your organization administrator to send a new invitation.'
          )
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
              ? 'This invitation link is invalid or has expired. Please ask your organization administrator to send a new invitation.'
              : message || 'RitsuFlow could not validate this invitation.'
          )
        }
      }
    }

    initializeInvitationSession()

    return () => {
      mounted = false
    }
  }, [])

  async function handleActivateAccount(event) {
    event.preventDefault()
    setErrorMessage('')

    if (!sessionReady) {
      setErrorMessage('The invitation session is not ready.')
      return
    }

    if (password.length < 8) {
      setErrorMessage('Password must contain at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMessage('The passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { error: passwordError } = await supabase.auth.updateUser({ password })

      if (passwordError) {
        throw new Error(passwordError.message || 'Your password could not be created.')
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
          activationResult.error ||
            'Your password was created, but your RitsuFlow membership could not be activated.'
        )
      }

      router.replace('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('Account activation failed.', error)
      setErrorMessage(error.message || 'Your account could not be activated.')
      setLoading(false)
    }
  }

  return (
    <main
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        padding: '24px',
        backgroundColor: '#f4f7f8',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '40px',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 12px 32px rgba(6, 43, 84, 0.12)',
        }}
      >
        <header style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h1 style={{ margin: '0 0 8px', color: '#062b54', fontSize: '2rem' }}>
            RitsuFlow
          </h1>
          <p style={{ margin: '0 0 8px', color: '#334155', fontWeight: 700 }}>
            Activate your account
          </p>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.5 }}>
            Create your password to complete your RitsuFlow account setup.
          </p>
        </header>

        <form
          onSubmit={handleActivateAccount}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
        >
          {errorMessage && (
            <div
              role="alert"
              style={{
                padding: '12px',
                color: '#991b1b',
                backgroundColor: '#fee2e2',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '0.9rem',
                lineHeight: 1.45,
              }}
            >
              {errorMessage}
            </div>
          )}

          {!sessionReady && !errorMessage && (
            <div
              style={{
                padding: '12px',
                color: '#475569',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                textAlign: 'center',
                fontSize: '0.9rem',
              }}
            >
              Validating invitation...
            </div>
          )}

          <label style={{ color: '#334155', fontWeight: 600 }}>
            Create Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Create your password"
              autoComplete="new-password"
              required
              disabled={!sessionReady || loading}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxSizing: 'border-box',
                fontSize: '1rem',
                backgroundColor: !sessionReady ? '#f8fafc' : '#ffffff',
              }}
            />
          </label>

          <label style={{ color: '#334155', fontWeight: 600 }}>
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
              disabled={!sessionReady || loading}
              style={{
                width: '100%',
                marginTop: '8px',
                padding: '12px',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                boxSizing: 'border-box',
                fontSize: '1rem',
                backgroundColor: !sessionReady ? '#f8fafc' : '#ffffff',
              }}
            />
          </label>

          <button
            type="submit"
            disabled={!sessionReady || loading}
            style={{
              padding: '14px',
              color: '#ffffff',
              backgroundColor: !sessionReady || loading ? '#94a3b8' : '#062b54',
              border: 0,
              borderRadius: '8px',
              cursor: !sessionReady || loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 700,
            }}
          >
            {loading ? 'Activating...' : 'Activate Account'}
          </button>
        </form>
      </section>
    </main>
  )
}
