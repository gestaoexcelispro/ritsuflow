'use client'

import {
  useEffect,
  useState,
} from 'react'

import {
  useRouter,
} from 'next/navigation'

import {
  createClient,
} from '../../../lib/supabase/client'

const supabase =
  createClient()

export default function InvitePage() {
  const router =
    useRouter()

  const [
    password,
    setPassword,
  ] =
    useState('')

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState('')

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState('')

  const [
    loading,
    setLoading,
  ] =
    useState(false)

  const [
    sessionReady,
    setSessionReady,
  ] =
    useState(false)

  useEffect(() => {
    let mounted = true

    async function initializeInvitationSession() {
      try {
        setErrorMessage('')

        const {
          data: {
            session,
          },
        } =
          await supabase.auth
            .getSession()

        if (
          session &&
          mounted
        ) {
          setSessionReady(true)
          return
        }

        /*
         * Supabase invitation links can arrive
         * with auth information in the URL.
         *
         * The browser client processes that
         * information and emits an auth state
         * event once the session exists.
         */
        const {
          data: {
            subscription,
          },
        } =
          supabase.auth
            .onAuthStateChange(
              (
                event,
                currentSession
              ) => {
                if (
                  !mounted
                ) {
                  return
                }

                if (
                  currentSession
                ) {
                  setSessionReady(true)
                  setErrorMessage('')
                }
              }
            )

        /*
         * Give Supabase a short opportunity
         * to process the invitation URL.
         */
        window.setTimeout(
          async () => {
            if (
              !mounted
            ) {
              return
            }

            const {
              data: {
                session:
                  refreshedSession,
              },
            } =
              await supabase.auth
                .getSession()

            if (
              refreshedSession
            ) {
              setSessionReady(true)
              setErrorMessage('')
              return
            }

            setErrorMessage(
              'This invitation link is invalid or has expired. Please ask your organization administrator to send a new invitation.'
            )
          },
          1500
        )

        return () => {
          subscription.unsubscribe()
        }
      } catch (error) {
        console.error(
          'Invitation session initialization failed.',
          error
        )

        if (
          mounted
        ) {
          setErrorMessage(
            'RitsuFlow could not validate this invitation.'
          )
        }
      }
    }

    const cleanup =
      initializeInvitationSession()

    return () => {
      mounted = false

      Promise.resolve(
        cleanup
      ).then(
        (
          cleanupFunction
        ) => {
          if (
            typeof cleanupFunction ===
            'function'
          ) {
            cleanupFunction()
          }
        }
      )
    }
  }, [])

  async function handleActivateAccount(
    event
  ) {
    event.preventDefault()

    setErrorMessage('')

    if (
      !sessionReady
    ) {
      setErrorMessage(
        'The invitation session is not ready.'
      )

      return
    }

    if (
      password.length < 8
    ) {
      setErrorMessage(
        'Password must contain at least 8 characters.'
      )

      return
    }

    if (
      password !==
      confirmPassword
    ) {
      setErrorMessage(
        'The passwords do not match.'
      )

      return
    }

    setLoading(true)

    try {
      const {
        error,
      } =
        await supabase.auth
          .updateUser({
            password,
          })

      if (
        error
      ) {
        setErrorMessage(
          error.message ||
            'Your password could not be created.'
        )

        setLoading(false)

        return
      }

      router.replace(
        '/dashboard'
      )

      router.refresh()
    } catch (error) {
      console.error(
        'Account activation failed.',
        error
      )

      setErrorMessage(
        'Your account could not be activated.'
      )

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
        backgroundColor:
          '#f4f7f8',
        fontFamily:
          'Arial, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '40px',
          backgroundColor:
            '#ffffff',
          borderRadius: '16px',
          boxShadow:
            '0 12px 32px rgba(6, 43, 84, 0.12)',
        }}
      >
        <header
          style={{
            marginBottom:
              '32px',
            textAlign:
              'center',
          }}
        >
          <h1
            style={{
              margin:
                '0 0 8px',
              color:
                '#062b54',
              fontSize:
                '2rem',
            }}
          >
            RitsuFlow
          </h1>

          <p
            style={{
              margin:
                '0 0 8px',
              color:
                '#334155',
              fontWeight:
                700,
            }}
          >
            Activate your account
          </p>

          <p
            style={{
              margin: 0,
              color:
                '#64748b',
              lineHeight:
                1.5,
            }}
          >
            Create your password
            to complete your
            RitsuFlow account
            setup.
          </p>
        </header>

        <form
          onSubmit={
            handleActivateAccount
          }
          style={{
            display:
              'flex',
            flexDirection:
              'column',
            gap:
              '20px',
          }}
        >
          {errorMessage && (
            <div
              role="alert"
              style={{
                padding:
                  '12px',
                color:
                  '#991b1b',
                backgroundColor:
                  '#fee2e2',
                borderRadius:
                  '8px',
                textAlign:
                  'center',
                fontSize:
                  '0.9rem',
                lineHeight:
                  1.45,
              }}
            >
              {errorMessage}
            </div>
          )}

          {!sessionReady &&
            !errorMessage && (
              <div
                style={{
                  padding:
                    '12px',
                  color:
                    '#475569',
                  backgroundColor:
                    '#f8fafc',
                  borderRadius:
                    '8px',
                  textAlign:
                    'center',
                  fontSize:
                    '0.9rem',
                }}
              >
                Validating
                invitation...
              </div>
            )}

          <label
            style={{
              color:
                '#334155',
              fontWeight:
                600,
            }}
          >
            Create Password

            <input
              type="password"
              value={
                password
              }
              onChange={
                (event) =>
                  setPassword(
                    event.target
                      .value
                  )
              }
              placeholder="Create your password"
              autoComplete="new-password"
              required
              disabled={
                !sessionReady ||
                loading
              }
              style={{
                width:
                  '100%',
                marginTop:
                  '8px',
                padding:
                  '12px',
                border:
                  '1px solid #cbd5e1',
                borderRadius:
                  '8px',
                boxSizing:
                  'border-box',
                fontSize:
                  '1rem',
                backgroundColor:
                  !sessionReady
                    ? '#f8fafc'
                    : '#ffffff',
              }}
            />
          </label>

          <label
            style={{
              color:
                '#334155',
              fontWeight:
                600,
            }}
          >
            Confirm Password

            <input
              type="password"
              value={
                confirmPassword
              }
              onChange={
                (event) =>
                  setConfirmPassword(
                    event.target
                      .value
                  )
              }
              placeholder="Confirm your password"
              autoComplete="new-password"
              required
              disabled={
                !sessionReady ||
                loading
              }
              style={{
                width:
                  '100%',
                marginTop:
                  '8px',
                padding:
                  '12px',
                border:
                  '1px solid #cbd5e1',
                borderRadius:
                  '8px',
                boxSizing:
                  'border-box',
                fontSize:
                  '1rem',
                backgroundColor:
                  !sessionReady
                    ? '#f8fafc'
                    : '#ffffff',
              }}
            />
          </label>

          <button
            type="submit"
            disabled={
              !sessionReady ||
              loading
            }
            style={{
              padding:
                '14px',
              color:
                '#ffffff',
              backgroundColor:
                (
                  !sessionReady ||
                  loading
                )
                  ? '#94a3b8'
                  : '#062b54',
              border: 0,
              borderRadius:
                '8px',
              cursor:
                (
                  !sessionReady ||
                  loading
                )
                  ? 'not-allowed'
                  : 'pointer',
              fontSize:
                '1rem',
              fontWeight:
                700,
            }}
          >
            {loading
              ? 'Activating...'
              : 'Activate Account'}
          </button>
        </form>
      </section>
    </main>
  )
}
