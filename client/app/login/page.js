'use client'
import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import axios from 'axios'
import Cookies from 'js-cookie'

const API = 'http://localhost:3004'

// Create a separate component that uses useSearchParams
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
      const res = await axios.post(`${API}/api/auth/login`, form)
      Cookies.set('token', res.data.token, { expires: 7 })
      Cookies.set('user', JSON.stringify(res.data.user), { expires: 7 })
      router.push('/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '12px 16px',
    background: '#0f0f0f', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#fff', fontSize: 15,
    outline: 'none', marginTop: 6,
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0f0f',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #2a2a2a',
        borderRadius: 16, padding: 40, width: '100%', maxWidth: 420,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 32, marginBottom: 8 }}>📦</p>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>TechIT</h1>
          <p style={{ color: '#555', fontSize: 14 }}>Smart Inventory Management</p>
        </div>

        {registered && (
          <div style={{
            padding: '12px 16px', background: '#0d2e1f',
            border: '1px solid #1a5c3a', borderRadius: 8,
            color: '#4ade80', fontSize: 14, marginBottom: 16,
          }}>
            ✓ Account created! Please sign in.
          </div>
        )}

        {error && (
          <div style={{
            padding: '12px 16px', background: '#3a0d0d',
            border: '1px solid #6e1a1a', borderRadius: 8,
            color: '#f87171', fontSize: 14, marginBottom: 16,
          }}>{error}</div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
          <label style={{ fontSize: 12, fontWeight: 600, color: '#555', textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
            background: loading ? '#2a2a2a' : '#4ade80',
            border: 'none', color: loading ? '#555' : '#000',
            borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 15, fontWeight: 700,
          }}
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>

        <div style={{
          marginTop: 24, padding: 16,
          background: '#0f0f0f', border: '1px solid #2a2a2a',
          borderRadius: 8, fontSize: 13, color: '#555',
        }}>
          <strong style={{ color: '#888' }}>Demo credentials:</strong><br />
          Username: admin · Password: admin123
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#555' }}>
          Don't have an account?{' '}
          <span
            onClick={() => router.push('/register')}
            style={{ color: '#4ade80', cursor: 'pointer', fontWeight: 600 }}
          >
            Register here
          </span>
        </p>
      </div>
    </div>
  )
}

// Main page component with Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff'
      }}>
        Loading...
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}