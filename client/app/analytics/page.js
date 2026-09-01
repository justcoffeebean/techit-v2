'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Cookies from 'js-cookie'
import dynamic from 'next/dynamic'
import { apiClient, getToken } from '../lib/api'
import { useTheme } from '../lib/useTheme'
import Toast from '../components/Toast'

const SalesCharts = dynamic(() => import('../components/SalesCharts'), { ssr: false })

// Preset windows, since almost every question here is "how did the last N days go"
const RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '12 months', days: 365 },
]

function isoDaysAgo(days) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function money(v) {
  const n = parseFloat(v) || 0
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

function moneyExact(v) {
  const n = parseFloat(v) || 0
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { colors, isDark, toggleTheme } = useTheme()

  const [user, setUser] = useState(null)
  const [metrics, setMetrics] = useState(null)
  const [rangeDays, setRangeDays] = useState(30)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id))

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get('/api/sales/metrics', {
        params: { from: isoDaysAgo(rangeDays), to: today() },
      })
      setMetrics(res.data)
    } catch (err) {
      if (err.response?.status === 401) router.push('/login')
      else addToast('Failed to load analytics', 'error')
    } finally {
      setLoading(false)
    }
  }, [rangeDays, router])

  useEffect(() => {
    const userData = Cookies.get('user')
    if (!userData || !getToken()) {
      router.push('/login')
      return
    }
    try {
      const parsed = JSON.parse(userData)
      if (parsed.role !== 'admin') {
        router.push('/dashboard')
        return
      }
      setUser(parsed)
    } catch {
      router.push('/login')
    }
  }, [router])

  useEffect(() => { if (user) load() }, [user, load])

  const handleExport = async () => {
    try {
      const res = await apiClient.get('/api/sales/export', {
        params: { from: isoDaysAgo(rangeDays), to: today() },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'techit-sales.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      addToast('Sales CSV exported')
    } catch {
      addToast('Export failed', 'error')
    }
  }

  const btn = (extra = {}) => ({
    padding: '7px 14px', background: colors.card,
    border: `1px solid ${colors.border}`, color: colors.muted,
    borderRadius: 7, cursor: 'pointer', fontSize: 12, fontWeight: 600,
    ...extra,
  })

  if (!user || (loading && !metrics)) {
    return (
      <div style={{ minHeight: '100vh', background: colors.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: colors.subtle }}>Loading...</p>
      </div>
    )
  }

  // Net profit drives a judgement, so it carries status colour; the rest stay
  // in text ink rather than borrowing series colour.
  const netProfit = parseFloat(metrics?.net_profit || 0)
  const profitColor = netProfit >= 0 ? colors.success : colors.error

  const tiles = [
    { label: 'Revenue', value: moneyExact(metrics?.revenue), sub: `${metrics?.order_count || 0} orders` },
    { label: 'Gross profit', value: moneyExact(metrics?.gross_profit), sub: `${metrics?.margin_pct || 0}% margin` },
    { label: 'Expenses', value: moneyExact(metrics?.expenses), sub: 'in period' },
    { label: 'Net profit', value: moneyExact(metrics?.net_profit), sub: 'after expenses', color: profitColor },
  ]

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>
      <Toast toasts={toasts} removeToast={removeToast} />

      <nav style={{
        height: 60, background: colors.navBg,
        backdropFilter: 'blur(10px)', borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span onClick={() => router.push('/dashboard')} style={{ fontSize: 20, fontWeight: 800, cursor: 'pointer' }}>TechIT</span>
          <span style={{ color: colors.subtle, fontSize: 13 }}>/ Analytics</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => router.push('/dashboard')} style={btn()}>Dashboard</button>
          <button onClick={() => router.push('/purchase-orders')} style={btn()}>Orders</button>
          <button onClick={handleExport} style={btn()}>Export CSV</button>
          <button onClick={toggleTheme} aria-label="Toggle color theme" style={btn({ fontSize: 14 })}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '32px 24px' }}>

        {/* Range filter — one row above the charts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          {RANGES.map(r => (
            <button
              key={r.days}
              onClick={() => setRangeDays(r.days)}
              style={btn({
                background: rangeDays === r.days ? colors.success : colors.card,
                border: `1px solid ${rangeDays === r.days ? colors.successBorder : colors.border}`,
                color: rangeDays === r.days ? (isDark ? '#000' : '#fff') : colors.muted,
                fontWeight: 700,
              })}
            >{r.label}</button>
          ))}
          {metrics && (
            <span style={{ color: colors.subtle, fontSize: 12, marginLeft: 4 }}>
              {metrics.from} to {metrics.to}
            </span>
          )}
        </div>

        {/* Headline figures */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16, marginBottom: 24,
        }}>
          {tiles.map(t => (
            <div key={t.label} style={{
              background: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: 12, padding: 20,
            }}>
              <p style={{
                fontSize: 11, color: colors.subtle, fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: 0.5,
              }}>{t.label}</p>
              <p style={{
                fontSize: 28, fontWeight: 800, marginTop: 8,
                color: t.color || colors.text,
              }}>{t.value}</p>
              <p style={{ fontSize: 12, color: colors.subtle, marginTop: 4 }}>{t.sub}</p>
            </div>
          ))}
        </div>

        {/* Secondary figures */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16, marginBottom: 24,
        }}>
          {[
            { label: 'Units sold', value: (metrics?.units_sold || 0).toLocaleString() },
            { label: 'Avg order', value: moneyExact(metrics?.avg_order_value) },
            { label: 'Cost of goods', value: moneyExact(metrics?.cogs) },
            { label: 'Stock on hand', value: moneyExact(metrics?.inventory_value) },
          ].map(t => (
            <div key={t.label} style={{
              background: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: 12, padding: '14px 18px',
            }}>
              <p style={{ fontSize: 11, color: colors.subtle, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {t.label}
              </p>
              <p style={{ fontSize: 18, fontWeight: 700, marginTop: 6, color: colors.text }}>{t.value}</p>
            </div>
          ))}
        </div>

        {metrics && <SalesCharts metrics={metrics} money={money} moneyExact={moneyExact} />}
      </div>
    </div>
  )
}
