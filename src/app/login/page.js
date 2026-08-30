'use client'

import { useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase/client'
import styles from './login.module.css'

const supabase = createClient()

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const router = useRouter()

  async function handleLogin(event) {
    event.preventDefault()

    setLoading(true)
    setErrorMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setErrorMessage('Invalid email or password.')
      setLoading(false)
      return
    }

    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <main className={styles.page}>
      <div className={styles.background} />

      <div className={styles.overlay} />

      <div className={styles.flowLines}>
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className={styles.shell}>
        <section className={styles.brandPanel}>
          <a
            href="/"
            className={styles.brand}
            aria-label="RitsuFlow home"
          >
            <Image
              src="/logo-white.png"
              alt="RitsuFlow"
              width={300}
              height={110}
              priority
              className={styles.logo}
            />
          </a>

          <div className={styles.brandContent}>
            <h1>
              Plan by location.
              <br />
              Control by <span>flow.</span>
            </h1>

            <div className={styles.accentLine} />

            <p className={styles.brandDescription}>
              RitsuFlow™ connects master planning,
              lookahead preparation, weekly commitments,
              and production control in one integrated
              construction workflow.
            </p>

            <div className={styles.principles}>
              <div className={styles.principle}>
                <span className={styles.principleIcon}>
                  01
                </span>

                <div>
                  <strong>
                    Flow-Based Planning
                  </strong>

                  <p>
                    Align locations, sequence, and production.
                  </p>
                </div>
              </div>

              <div className={styles.principle}>
                <span className={styles.principleIcon}>
                  02
                </span>

                <div>
                  <strong>
                    Reliable Execution
                  </strong>

                  <p>
                    Make work ready before you commit.
                  </p>
                </div>
              </div>

              <div className={styles.principle}>
                <span className={styles.principleIcon}>
                  03
                </span>

                <div>
                  <strong>
                    Continuous Control
                  </strong>

                  <p>
                    Connect planning decisions to execution.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.loginArea}>
          <div className={styles.loginCard}>
            <div className={styles.cardLogo}>
              <Image
                src="/logo-white.png"
                alt="RitsuFlow"
                width={190}
                height={70}
                priority
              />
            </div>

            <header className={styles.loginHeader}>
              <h2>
                Welcome back
              </h2>

              <p>
                Sign in to continue to RitsuFlow™
              </p>
            </header>

            <form
              onSubmit={handleLogin}
              className={styles.form}
            >
              {errorMessage && (
                <div
                  role="alert"
                  className={styles.error}
                >
                  {errorMessage}
                </div>
              )}

              <label className={styles.field}>
                <span>
                  Email
                </span>

                <div className={styles.inputWrapper}>
                  <span
                    className={styles.inputIcon}
                    aria-hidden="true"
                  >
                    @
                  </span>

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className={styles.field}>
                <span>
                  Password
                </span>

                <div className={styles.inputWrapper}>
                  <span
                    className={styles.inputIcon}
                    aria-hidden="true"
                  >
                    •
                  </span>

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />

                  <button
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() =>
                      setShowPassword(
                        (current) => !current
                      )
                    }
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </label>

              <button
                type="submit"
                disabled={loading}
                className={styles.submitButton}
              >
                {loading
                  ? 'Signing in...'
                  : 'Sign in'}

                {!loading && (
                  <span aria-hidden="true">
                    →
                  </span>
                )}
              </button>
            </form>

            <div className={styles.privateAccess}>
              <div className={styles.lockIcon}>
                🔒
              </div>

              <div>
                <strong>
                  Private development access
                </strong>

                <p>
                  RitsuFlow™ is currently in private development.
                </p>
              </div>
            </div>
          </div>

          <div className={styles.support}>
            <span>
              Need help?
            </span>

            <span>
              Contact your system administrator.
            </span>
          </div>

          <div className={styles.copyright}>
            © {new Date().getFullYear()} Eduardo Fernandes de
            Freitas. All rights reserved.
          </div>
        </section>
      </div>
    </main>
  )
}
