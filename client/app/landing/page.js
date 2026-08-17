'use client'
import { useRouter } from 'next/navigation'
import { useTheme } from '../lib/useTheme'

export default function LandingPage() {
  const router = useRouter()
  const { colors, isDark, toggleTheme } = useTheme()

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
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text, transition: 'all 0.3s ease' }}>

      <nav style={{
        height: 64, borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 40px', position: 'sticky', top: 0,
        background: colors.navBg, backdropFilter: 'blur(10px)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800 }}>📦 TechIT</span>
          <span style={{
            background: colors.successBg, border: `1px solid ${colors.successBorder}`,
            color: colors.success, padding: '2px 8px', borderRadius: 100,
            fontSize: 10, fontWeight: 700,
          }}>v2.0</span>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={toggleTheme} aria-label="Toggle color theme" style={{
            padding: '8px 12px',
            background: colors.card, border: `1px solid ${colors.border}`,
            color: colors.muted, borderRadius: 8,
            cursor: 'pointer', fontSize: 16,
            transition: 'all 0.2s',
          }}>
            {isDark ? '☀️' : '🌙'}
          </button>
          <button onClick={() => router.push('/login')} style={{
            padding: '8px 18px', background: 'none',
            border: `1px solid ${colors.border}`, color: colors.muted,
            borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>Sign In</button>
          <button onClick={() => router.push('/register')} style={{
            padding: '8px 18px',
            background: colors.success,
            border: 'none', color: isDark ? '#000' : '#fff',
            borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}>Get Started</button>
        </div>
      </nav>

      <div style={{
        maxWidth: 900, margin: '0 auto',
        padding: '100px 24px 80px', textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          background: colors.successBg, border: `1px solid ${colors.successBorder}`,
          color: colors.success, padding: '6px 14px', borderRadius: 100,
          fontSize: 12, fontWeight: 700,
          marginBottom: 24, letterSpacing: 0.5,
        }}>
          SMART INVENTORY MANAGEMENT
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 72px)',
          fontWeight: 900, lineHeight: 1.1,
          marginBottom: 24, letterSpacing: -2,
          color: colors.text,
        }}>
          Take control of your{' '}
          <span style={{ color: colors.success }}>inventory</span>
        </h1>

        <p style={{
          fontSize: 18, color: colors.muted, lineHeight: 1.7,
          maxWidth: 600, margin: '0 auto 40px',
        }}>
          TechIT gives you real-time visibility into your stock levels,
          automatic alerts when items run low, and a complete audit trail
          of every change your team makes.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/register')} style={{
            padding: '14px 32px',
            background: colors.success,
            border: 'none', color: isDark ? '#000' : '#fff',
            borderRadius: 10, cursor: 'pointer',
            fontSize: 15, fontWeight: 800,
          }}>
            Get Started Free →
          </button>
          <button onClick={() => router.push('/login')} style={{
            padding: '14px 32px', background: 'none',
            border: `1px solid ${colors.border}`, color: colors.muted,
            borderRadius: 10, cursor: 'pointer',
            fontSize: 15, fontWeight: 600,
          }}>
            Sign In
          </button>
        </div>
      </div>

      <div style={{
        borderTop: `1px solid ${colors.border}`,
        borderBottom: `1px solid ${colors.border}`,
        padding: '40px 24px',
        background: colors.card,
      }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24,
        }}>
          {stats.map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 40, fontWeight: 900, color: colors.success, letterSpacing: -1 }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 13, color: colors.subtle, marginTop: 4 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px' }}>
        <h2 style={{
          fontSize: 36, fontWeight: 800, textAlign: 'center',
          marginBottom: 8, letterSpacing: -1, color: colors.text,
        }}>
          Everything you need
        </h2>
        <p style={{ color: colors.subtle, textAlign: 'center', marginBottom: 56, fontSize: 15 }}>
          Built for teams that take inventory seriously
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 20,
        }}>
          {features.map((feature) => (
            <div key={feature.title} style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 14, padding: 28,
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 28, display: 'block', marginBottom: 14 }}>{feature.icon}</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: colors.text }}>{feature.title}</h3>
              <p style={{ fontSize: 14, color: colors.muted, lineHeight: 1.6 }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        borderTop: `1px solid ${colors.border}`,
        background: colors.card,
        padding: '80px 24px', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 40, fontWeight: 900, marginBottom: 16, letterSpacing: -1, color: colors.text }}>
          Ready to get started?
        </h2>
        <p style={{ color: colors.subtle, marginBottom: 32, fontSize: 15 }}>
          Create your free account in seconds. No credit card required.
        </p>
        <button onClick={() => router.push('/register')} style={{
          padding: '16px 40px',
          background: colors.success,
          border: 'none', color: isDark ? '#000' : '#fff',
          borderRadius: 10, cursor: 'pointer',
          fontSize: 16, fontWeight: 800,
        }}>
          Create Free Account →
        </button>
      </div>

      <div style={{
        borderTop: `1px solid ${colors.border}`,
        padding: '24px', textAlign: 'center',
        color: colors.subtle, fontSize: 13,
        background: colors.bg,
      }}>
        © 2024 TechIT Inventory Management System
      </div>
    </div>
  )
}
