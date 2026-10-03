'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '../../lib/supabase/client'

const supabase = createClient()

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setErrorMessage('')

    const normalizedName = fullName.trim()
    const normalizedEmail = email.trim().toLowerCase()

    if (normalizedName.length < 2) return setErrorMessage('Please enter your full name.')
    if (password.length < 8) return setErrorMessage('Password must contain at least 8 characters.')
    if (password !== confirmPassword) return setErrorMessage('The passwords do not match.')

    setLoading(true)

    try {
      const emailRedirectTo = `${window.location.origin}/login`
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo,
          data: {
            full_name: normalizedName,
          },
        },
      })

      if (error) throw error
      setSuccess(true)
    } catch (error) {
      console.error('Registration failed.', error)
      setErrorMessage('RitsuFlow could not create the account. Please verify your information or contact your system administrator.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f4f7f8', fontFamily: 'Arial, sans-serif' }}>
      <section style={{ width: '100%', maxWidth: 460, padding: 40, background: '#fff', borderRadius: 16, boxShadow: '0 12px 32px rgba(6,43,84,.12)' }}>
        <h1 style={{ margin: '0 0 8px', color: '#062b54' }}>Create your RitsuFlow account</h1>
        <p style={{ margin: '0 0 12px', color: '#64748b', lineHeight: 1.5 }}>Create your personal account. Organization and project access are granted separately by an authorized administrator.</p>
        <div style={{ marginBottom: 24, padding: 12, borderRadius: 8, background: '#eff6ff', color: '#1e3a5f', fontSize: '.9rem', lineHeight: 1.45 }}>Registration does not create an organization membership and does not grant access to any project.</div>

        {success ? (
          <div>
            <div role="status" style={{ padding: 12, borderRadius: 8, background: '#ecfdf5', color: '#166534', lineHeight: 1.45 }}>Your account request was received. If email confirmation is required, check your inbox before signing in.</div>
            <p style={{ margin: '24px 0 0', textAlign: 'center' }}><Link href="/login" style={{ color: '#0f5f9b', fontWeight: 700, textDecoration: 'none' }}>Continue to sign in</Link></p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {errorMessage && <div role="alert" style={{ padding: 12, borderRadius: 8, background: '#fee2e2', color: '#991b1b', lineHeight: 1.45 }}>{errorMessage}</div>}

            <label style={{ color: '#334155', fontWeight: 600 }}>Full Name<input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} autoComplete="name" required placeholder="Enter your full name" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem' }} /></label>
            <label style={{ color: '#334155', fontWeight: 600 }}>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required placeholder="Enter your email" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem' }} /></label>
            <label style={{ color: '#334155', fontWeight: 600 }}>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required placeholder="At least 8 characters" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem' }} /></label>
            <label style={{ color: '#334155', fontWeight: 600 }}>Confirm Password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required placeholder="Confirm your password" style={{ width: '100%', boxSizing: 'border-box', marginTop: 8, padding: 12, border: '1px solid #cbd5e1', borderRadius: 8, fontSize: '1rem' }} /></label>

            <button type="submit" disabled={loading} style={{ padding: 14, border: 0, borderRadius: 8, background: loading ? '#94a3b8' : '#062b54', color: '#fff', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>{loading ? 'Creating account...' : 'Create account'}</button>
          </form>
        )}

        {!success && <p style={{ margin: '24px 0 0', textAlign: 'center', color: '#64748b' }}>Already have an account? <Link href="/login" style={{ color: '#0f5f9b', fontWeight: 700, textDecoration: 'none' }}>Sign in</Link></p>}
      </section>
    </main>
  )
}
