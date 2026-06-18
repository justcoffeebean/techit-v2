'use client'
import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Cookies from 'js-cookie'
import { apiClient } from '../lib/api'
import { inputStyle, labelStyle, errorAlertStyle, successAlertStyle, pageWrapperStyle, cardStyle, colors } from '../lib/styles'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const registered = searchParams.get('registered')
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const res = await apiClient.post('/api/auth/login', form)
      const cookieOpts = { expires: 7, secure: true, sameSite: 'Strict' }
      Cookies.set('token', res.data.token, cookieOpts)
      Cookies.set('user', JSON.stringify(res.data.user), cookieOpts)
      router.push('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageWrapperStyle}>
      <div style={{ ...cardStyle, padding: 40, maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>📦</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>TechIT</h1>
          <p style={{ color: colors.subtle, fontSize: 14 }}>Smart Inventory Management</p>
        </div>

        {registered && (
          <div style={successAlertStyle}>
            ✓ Account created! Please sign in.
          </div>
        )}

        {error && (
          <div style={errorAlertStyle}>{error}</div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>
            Username or Email
          </label>
          <input
            style={inputStyle}
            placeholder="Enter username"
            value={form.username}
            onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>
            Password
          </label>
          <input
            style={inputStyle}
            type="password"
            placeholder="Enter password"
            value={form.password}
            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '13px',
            background: loading ? colors.border : colors.success,
            border: 'none', color: loading ? colors.subtle : '#000',
            borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 15, fontWeight: 700,
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div style={{
          marginTop: 24, padding: 16,
          background: colors.bg, border: `1px solid ${colors.border}`,
          borderRadius: 8, fontSize: 13, color: colors.subtle,
        }}>
          <strong style={{ color: colors.muted }}>Demo credentials:</strong><br />
          Username: admin · Password: admin123
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: colors.subtle }}>
          {"Don't have an account? "}
          <span
            onClick={() => router.push('/register')}
            style={{ color: colors.success, cursor: 'pointer', fontWeight: 600 }}
          >
            Register here
          </span>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.text,
      }}>
        Loading...
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
