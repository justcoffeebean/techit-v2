'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '../lib/api'
import { inputStyle, labelStyle, errorAlertStyle, pageWrapperStyle, cardStyle, colors } from '../lib/styles'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirm_password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
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
      })
      router.push('/login?registered=true')
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageWrapperStyle}>
      <div style={{ ...cardStyle, padding: 40, maxWidth: 440 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>📦</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Create Account</h1>
          <p style={{ color: colors.subtle, fontSize: 14 }}>Join TechIT Inventory Management</p>
        </div>

        {/* Error */}
        {error && (
          <div style={errorAlertStyle}>{error}</div>
        )}

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Username</label>
            <input
              style={inputStyle}
              placeholder="Choose a username"
              value={form.username}
              onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              style={inputStyle}
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <input
              style={inputStyle}
              type="password"
              placeholder="Min 6 characters"
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            />
          </div>

          <div>
            <label style={labelStyle}>Confirm Password</label>
            <input
              style={inputStyle}
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
            border: 'none', color: loading ? colors.subtle : '#000',
            borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 15, fontWeight: 700,
          }}
        >
          {loading ? 'Creating account...' : 'Create Account'}
        </button>

        {/* Features list */}
        <div style={{
          marginTop: 24, padding: 16,
          background: colors.bg, border: `1px solid ${colors.border}`,
          borderRadius: 8,
        }}>
          <p style={{ ...labelStyle, marginBottom: 10 }}>
            What you get
          </p>
          {[
            'Real-time inventory dashboard',
            'Analytics and charts',
            'Advanced search and filtering',
            'CSV export',
          ].map(f => (
            <p key={f} style={{ fontSize: 13, color: colors.muted, padding: '4px 0' }}>{f}</p>
          ))}
        </div>

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
