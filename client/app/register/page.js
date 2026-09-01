'use client'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiClient } from '../lib/api'
import { useTheme } from '../lib/useTheme'
import { labelStyle, errorAlertStyle, successAlertStyle, pageWrapperStyle, cardStyle } from '../lib/styles'

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteToken = searchParams.get('invite')
  const { colors, isDark } = useTheme()

  const [form, setForm] = useState({ username: '', email: '', password: '', confirm_password: '' })
  const [inviteInfo, setInviteInfo] = useState(null)
  const [inviteError, setInviteError] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // Validate the invite token and pre-fill the email it was issued to.
  useEffect(() => {
    if (!inviteToken) return
    let cancelled = false

    apiClient.get('/api/invitations/validate', { params: { token: inviteToken } })
      .then(res => {
        if (cancelled) return
        if (res.data?.valid) {
          setInviteInfo(res.data)
          setForm(prev => ({ ...prev, email: res.data.email }))
        }
      })
      .catch(() => {
        if (!cancelled) setInviteError('This invitation link is invalid or has expired.')
      })

    return () => { cancelled = true }
  }, [inviteToken])

  const handleSubmit = async () => {
    setError('')
    setSuccess('')

    if (!form.username || !form.email || !form.password || !form.confirm_password) {
      return setError('Please fill in all fields')
    }
    if (form.password !== form.confirm_password) {
      return setError('Passwords do not match')
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters')
    }

    setLoading(true)
    try {
      await apiClient.post('/api/auth/register', {
        username: form.username,
        email: form.email,
        password: form.password,
        invite_token: inviteToken || undefined,
      })
      setSuccess('Account created! Redirecting to sign in...')
      setTimeout(() => router.push('/login?registered=true'), 800)
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const inputSx = {
    width: '100%', padding: '12px 16px',
    background: colors.inputBg, border: `1px solid ${colors.border}`,
    borderRadius: 8, color: colors.text, fontSize: 15, outline: 'none',
    marginTop: 6,
  }

  return (
    <div style={{ ...pageWrapperStyle, background: colors.bg }}>
      <div style={{ ...cardStyle, background: colors.card, border: `1px solid ${colors.border}`, padding: 40, maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>📦</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, color: colors.text }}>
            {inviteInfo ? `Join ${inviteInfo.organization_name}` : 'Create Account'}
          </h1>
          <p style={{ color: colors.subtle, fontSize: 14 }}>
            {inviteInfo
              ? `You've been invited as ${inviteInfo.role === 'admin' ? 'an admin' : 'a user'}`
              : 'Join TechIT Inventory Management'}
          </p>
        </div>

        {inviteError && <div style={errorAlertStyle}>{inviteError}</div>}
        {error && <div style={errorAlertStyle}>{error}</div>}
        {success && <div style={successAlertStyle}>{success}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              style={inputSx}
              placeholder="Choose a username"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              style={{ ...inputSx, opacity: inviteInfo ? 0.7 : 1, cursor: inviteInfo ? 'not-allowed' : 'text' }}
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              readOnly={Boolean(inviteInfo)}
            />
            {inviteInfo && (
              <p style={{ fontSize: 11, color: colors.subtle, marginTop: 4 }}>
                Locked to the address this invitation was sent to
              </p>
            )}
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              style={inputSx}
              type="password"
              placeholder="Min 6 characters"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input
              style={inputSx}
              type="password"
              placeholder="Repeat your password"
              value={form.confirm_password}
              onChange={e => setForm(p => ({ ...p, confirm_password: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            />
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '13px', marginTop: 24,
            background: loading ? colors.border : colors.success,
            border: 'none', color: loading ? colors.subtle : (isDark ? '#000' : '#fff'),
            borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 15, fontWeight: 700,
          }}
        >
          {loading ? 'Creating account...' : (inviteInfo ? 'Join team' : 'Create Account')}
        </button>

        {!inviteInfo && (
          <div style={{
            marginTop: 24, padding: 16,
            background: colors.inputBg, border: `1px solid ${colors.border}`,
            borderRadius: 8,
          }}>
            <p style={{ ...labelStyle, marginBottom: 10 }}>What you get</p>
            {[
              'Real-time inventory dashboard',
              'Analytics and charts',
              'Advanced search and filtering',
              'CSV export',
            ].map(f => (
              <p key={f} style={{ fontSize: 13, color: colors.muted, padding: '4px 0' }}>{f}</p>
            ))}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: colors.subtle }}>
          Already have an account?{' '}
          <span
            onClick={() => router.push('/login')}
            style={{ color: colors.success, cursor: 'pointer', fontWeight: 600 }}
          >
            Sign in
          </span>
        </p>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh', background: '#0f0f0f',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
      }}>
        Loading...
      </div>
    }>
      <RegisterContent />
    </Suspense>
  )
}
