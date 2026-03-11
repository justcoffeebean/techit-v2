'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function LandingPage() {
  const router = useRouter()
  const [dark, setDark] = useState(true)

  const t = {
    bg: dark ? '#0f0f0f' : '#f8fafc',
    card: dark ? '#1a1a1a' : '#ffffff',
    border: dark ? '#2a2a2a' : '#e2e8f0',
    text: dark ? '#ffffff' : '#0f0f0f',
    muted: dark ? '#888' : '#64748b',
    subtle: dark ? '#555' : '#94a3b8',
    navBg: dark ? 'rgba(15,15,15,0.95)' : 'rgba(248,250,252,0.95)',
    inputBg: dark ? '#0f0f0f' : '#f1f5f9',
    statValue: dark ? '#4ade80' : '#16a34a',
  }

  const features = [
    { icon: '📊', title: 'Real-time Dashboard', desc: 'Live inventory metrics with charts showing stock levels, category breakdowns, and total value at a glance.' },
    { icon: '🤖', title: 'Smart Stock Alerts', desc: 'Automatic email notifications when items drop below your custom threshold — never run out of stock unexpectedly.' },
    { icon: '📋', title: 'Full Audit Log', desc: 'Every change tracked — who added, edited, or deleted what and when. Complete accountability for your team.' },
    { icon: '⬇', title: 'CSV Export', desc: 'Export your entire inventory to CSV in one click. Works with Excel, Google Sheets, and any data tool.' },
    { icon: '🔍', title: 'Advanced Search', desc: 'Filter by name, SKU, category, supplier, or stock status. Find any item in seconds.' },
    { icon: '👥', title: 'Role-based Access', desc: 'Admins can add, edit, and delete items. Regular users get read-only access with full search and filtering.' },
  ]

  const stats = [
    { value: '100%', label: 'Free to use' },
    { value: '<1s', label: 'Response time' },
    { value: '6', label: 'Core features' },
    { value: '∞', label: 'Items supported' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: t.bg, color: t.text, transition: 'all 0.3s ease' }}>

      {/* Navbar */}
      <nav style={{
        height: 64, borderBottom: `1px solid ${t.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', position: 'sticky', top: 0,
        background: t.navBg, backdropFilter: 'blur(10px)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>📦 TechIT</span>
          <span style={{
            background: dark ? '#0d2e1f' : '#dcfce7',
            border: `1px solid ${dark ? '#1a5c3a' : '#86efac'}`,
            color: dark ? '#4ade80' : '#16a34a',
            padding: '2px 8px', borderRadius: 100,
            fontSize: 10, fontWeight: 700,
          }}>v2.0</span>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Theme toggle */}
          <button onClick={() => setDark(!dark)} style={{
            padding: '8px 12px',
            background: t.card, border: `1px solid ${t.border}`,
            color: t.muted, borderRadius: 8,
            cursor: 'pointer', fontSize: 16,
            transition: 'all 0.2s',
          }}>
            {dark ? '☀️' : '🌙'}
          </button>
          <button onClick={() => router.push('/login')} style={{
            padding: '8px 18px', background: 'none',
            border: `1px solid ${t.border}`, color: t.muted,
            borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>Sign In</button>
          <button onClick={() => router.push('/register')} style={{
            padding: '8px 18px',
            background: dark ? '#4ade80' : '#16a34a',
            border: 'none', color: '#fff',
            borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}>Get Started</button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{
        maxWidth: 900, margin: '0 auto',
        padding: '100px 24px 80px', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          background: dark ? '#0d2e1f' : '#dcfce7',
          border: `1px solid ${dark ? '#1a5c3a' : '#86efac'}`,
          color: dark ? '#4ade80' : '#16a34a',
          padding: '6px 14px', borderRadius: 100,
          fontSize: 12, fontWeight: 700,
          marginBottom: 24, letterSpacing: 0.5,
        }}>
          SMART INVENTORY MANAGEMENT
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 72px)',
          fontWeight: 900, lineHeight: 1.1,
          marginBottom: 24, letterSpacing: -2,
          color: t.text,
        }}>
          Take control of your{' '}
          <span style={{ color: dark ? '#4ade80' : '#16a34a' }}>inventory</span>
        </h1>

        <p style={{
          fontSize: 18, color: t.muted, lineHeight: 1.7,
          maxWidth: 600, margin: '0 auto 40px',
        }}>
          TechIT gives you real-time visibility into your stock levels,
          automatic alerts when items run low, and a complete audit trail
          of every change your team makes.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/register')} style={{
            padding: '14px 32px',
            background: dark ? '#4ade80' : '#16a34a',
            border: 'none', color: dark ? '#000' : '#fff',
            borderRadius: 10, cursor: 'pointer',
            fontSize: 15, fontWeight: 800,
          }}>
            Get Started Free →
          </button>
          <button onClick={() => router.push('/login')} style={{
            padding: '14px 32px', background: 'none',
            border: `1px solid ${t.border}`, color: t.muted,
            borderRadius: 10, cursor: 'pointer',
            fontSize: 15, fontWeight: 600,
          }}>
            Sign In
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        borderTop: `1px solid ${t.border}`,
        borderBottom: `1px solid ${t.border}`,
        padding: '40px 24px',
        background: t.card,
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
        }}>
          {stats.map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 40, fontWeight: 900, color: dark ? '#4ade80' : '#16a34a', letterSpacing: -1 }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 13, color: t.subtle, marginTop: 4 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
        <h2 style={{
          fontSize: 36, fontWeight: 800, textAlign: 'center',
          marginBottom: 8, letterSpacing: -1, color: t.text,
        }}>
          Everything you need
        </h2>
        <p style={{ color: t.subtle, textAlign: 'center', marginBottom: 56, fontSize: 15 }}>
          Built for teams that take inventory seriously
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {features.map((feature) => (
            <div key={feature.title} style={{
              background: t.card,
              border: `1px solid ${t.border}`,
              borderRadius: 14, padding: 28,
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 28, display: 'block', marginBottom: 14 }}>{feature.icon}</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: t.text }}>{feature.title}</h3>
              <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.6 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{
        borderTop: `1px solid ${t.border}`,
        background: t.card,
        padding: '80px 24px', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 40, fontWeight: 900, marginBottom: 16, letterSpacing: -1, color: t.text }}>
          Ready to get started?
        </h2>
        <p style={{ color: t.subtle, marginBottom: 32, fontSize: 15 }}>
          Create your free account in seconds. No credit card required.
        </p>
        <button onClick={() => router.push('/register')} style={{
          padding: '16px 40px',
          background: dark ? '#4ade80' : '#16a34a',
          border: 'none', color: dark ? '#000' : '#fff',
          borderRadius: 10, cursor: 'pointer',
          fontSize: 16, fontWeight: 800,
        }}>
          Create Free Account →
        </button>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${t.border}`,
        padding: '24px', textAlign: 'center',
        color: t.subtle, fontSize: 13,
        background: t.bg,
      }}>
        © 2024 TechIT Inventory Management System
      </div>
    </div>
  )
}