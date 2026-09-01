'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useTheme } from '../lib/useTheme'

// Every claim below maps to shipped behaviour. Nothing here is aspirational:
// if a capability is not in the codebase, it is not on this page.
const FEATURES = [
  {
    icon: '📊',
    title: 'Sales analytics and P&L',
    desc: 'Revenue, cost of goods, gross margin and net profit after expenses, charted daily and broken down by category and product.',
  },
  {
    icon: '🔄',
    title: 'Full stock movement ledger',
    desc: 'Every quantity change recorded as received, sold, damaged, returned or adjusted, with the levels either side and who made it.',
  },
  {
    icon: '📄',
    title: 'Automatic purchase orders',
    desc: 'Stock crossing its reorder point raises an order for the supplier, batched by supplier, with the PDF emailed out and receiving that puts stock straight back.',
  },
  {
    icon: '📷',
    title: 'Barcode scanning',
    desc: 'Scan to pull up an item by SKU, or scan something unknown and start creating it with the code already filled in.',
  },
  {
    icon: '👥',
    title: 'Teams and invitations',
    desc: 'Invite colleagues by email as an admin or a user. Every organisation sees only its own inventory, orders and history.',
  },
  {
    icon: '🔐',
    title: 'Secure by default',
    desc: 'Short-lived access tokens with rotating refresh tokens, rate-limited endpoints, and an audit log of every change your team makes.',
  },
]

const HOW_IT_WORKS = [
  { step: '01', title: 'Add your stock', desc: 'Import or enter items with cost and sale price, location, supplier and a reorder threshold. Scan barcodes to move faster.' },
  { step: '02', title: 'Work as normal', desc: 'Record sales and expenses as they happen. Every quantity change writes itself into the ledger without anyone thinking about it.' },
  { step: '03', title: 'Let it reorder', desc: 'When something drops below its threshold a purchase order goes to the supplier, so you find out before a customer does.' },
]

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    cadence: 'forever',
    blurb: 'For trying it out on a real catalogue.',
    features: ['Up to 100 items', '1 user', 'Dashboard and analytics', 'CSV export', 'Audit log'],
    cta: 'Start free',
  },
  {
    name: 'Pro',
    price: '$29',
    cadence: 'per month',
    blurb: 'For a working team running real stock.',
    features: ['Unlimited items', 'Up to 5 users', 'Automatic purchase orders', 'Barcode scanning', 'Stock movement history', 'Low stock email alerts'],
    cta: 'Choose Pro',
    featured: true,
  },
  {
    name: 'Business',
    price: '$99',
    cadence: 'per month',
    blurb: 'For multiple sites and larger teams.',
    features: ['Everything in Pro', 'Unlimited users', 'Priority support', 'Full sales and P&L reporting'],
    cta: 'Choose Business',
  },
]

const FAQS = [
  {
    q: 'Do I need a credit card to start?',
    a: 'No. The Free plan covers up to 100 items and one user with no card, and it does not expire. Upgrade only when you outgrow it.',
  },
  {
    q: 'How do purchase orders actually work?',
    a: 'When an item falls to or below the reorder threshold you set, TechIT raises an order for that item’s supplier. Items newly low for the same supplier are batched into one order, and anything already on an open order is skipped, so you never get a stream of duplicates. The PDF is emailed to the supplier, and marking it received puts the stock back and records a movement against each line.',
  },
  {
    q: 'Can my team see each other’s data?',
    a: 'Your colleagues see your organisation’s data; nobody outside it does. Every query is scoped to the organisation, so inventory, orders, movements and the audit log are isolated between customers.',
  },
  {
    q: 'What can I do with the data if I leave?',
    a: 'Export inventory and sales to CSV at any time from the dashboard, and download any purchase order as a PDF. It is your data.',
  },
  {
    q: 'Does the barcode scanner need an app?',
    a: 'No. It runs in the browser using your device camera, so it works on a phone or a laptop webcam. You can also type a SKU if the camera is unavailable or a label is damaged.',
  },
]

export default function LandingPage() {
  const router = useRouter()
  const { colors, isDark, toggleTheme } = useTheme()
  const [openFaq, setOpenFaq] = useState(0)

  const onAccent = isDark ? '#000' : '#fff'
  const maxW = 1080

  const section = { maxWidth: maxW, margin: '0 auto', padding: '80px 24px' }
  const h2 = {
    fontSize: 'clamp(28px, 4vw, 38px)', fontWeight: 800,
    letterSpacing: -1, color: colors.text, textAlign: 'center', marginBottom: 8,
  }
  const lede = {
    color: colors.muted, textAlign: 'center', fontSize: 15,
    marginBottom: 48, maxWidth: 560, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.6,
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.bg, color: colors.text }}>

      {/* Navbar */}
      <nav style={{
        height: 64, borderBottom: `1px solid ${colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', position: 'sticky', top: 0,
        background: colors.navBg, backdropFilter: 'blur(10px)', zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20, fontWeight: 800 }}>📦 TechIT</span>
          <span style={{
            background: colors.successBg, border: `1px solid ${colors.successBorder}`,
            color: colors.success, padding: '2px 8px', borderRadius: 100,
            fontSize: 10, fontWeight: 700,
          }}>v2.0</span>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={toggleTheme} aria-label="Toggle color theme" style={{
            padding: '8px 12px', background: colors.card,
            border: `1px solid ${colors.border}`, color: colors.muted,
            borderRadius: 8, cursor: 'pointer', fontSize: 15,
          }}>{isDark ? '☀️' : '🌙'}</button>
          <button onClick={() => router.push('/login')} style={{
            padding: '8px 16px', background: 'none',
            border: `1px solid ${colors.border}`, color: colors.muted,
            borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>Sign in</button>
          <button onClick={() => router.push('/register')} style={{
            padding: '8px 16px', background: colors.success,
            border: 'none', color: onAccent,
            borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
          }}>Get started</button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '88px 24px 56px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-block',
          background: colors.successBg, border: `1px solid ${colors.successBorder}`,
          color: colors.success, padding: '6px 14px', borderRadius: 100,
          fontSize: 12, fontWeight: 700, marginBottom: 24, letterSpacing: 0.5,
        }}>
          INVENTORY THAT REORDERS ITSELF
        </div>

        <h1 style={{
          fontSize: 'clamp(38px, 6.5vw, 68px)', fontWeight: 900,
          lineHeight: 1.05, marginBottom: 20, letterSpacing: -2, color: colors.text,
        }}>
          Know what you have,<br />
          and what it&rsquo;s <span style={{ color: colors.success }}>making you</span>
        </h1>

        <p style={{
          fontSize: 18, color: colors.muted, lineHeight: 1.65,
          maxWidth: 580, margin: '0 auto 36px',
        }}>
          TechIT tracks every unit in and out, tells you the margin on all of it,
          and raises the purchase order before you run out.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => router.push('/register')} style={{
            padding: '14px 30px', background: colors.success,
            border: 'none', color: onAccent, borderRadius: 10,
            cursor: 'pointer', fontSize: 15, fontWeight: 800,
          }}>Start free →</button>
          <button onClick={() => router.push('/login')} style={{
            padding: '14px 30px', background: 'none',
            border: `1px solid ${colors.border}`, color: colors.muted,
            borderRadius: 10, cursor: 'pointer', fontSize: 15, fontWeight: 600,
          }}>Sign in</button>
        </div>

        <p style={{ color: colors.subtle, fontSize: 13, marginTop: 20 }}>
          Free for 100 items. No card required.
        </p>
      </div>

      {/* Product preview — an abstraction of the real dashboard rather than a
          screenshot, so it cannot drift out of date as the UI changes. */}
      <div style={{ maxWidth: maxW, margin: '0 auto', padding: '0 24px 88px' }}>
        <div style={{
          background: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: 16, padding: 20, boxShadow: isDark ? 'none' : '0 12px 32px rgba(15,23,42,0.08)',
        }}>
          {/* Stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { label: 'Revenue', value: '$48,250', accent: colors.success },
              { label: 'Gross margin', value: '39.7%', accent: colors.text },
              { label: 'Net profit', value: '$12,750', accent: colors.success },
              { label: 'Low stock', value: '3 items', accent: colors.warning },
            ].map(s => (
              <div key={s.label} style={{
                background: colors.inputBg, border: `1px solid ${colors.border}`,
                borderRadius: 10, padding: '12px 14px',
              }}>
                <p style={{ fontSize: 10, color: colors.subtle, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {s.label}
                </p>
                <p style={{ fontSize: 20, fontWeight: 800, color: s.accent, marginTop: 4 }}>{s.value}</p>
              </div>
            ))}
          </div>

          {/* Suggestive trend, drawn rather than screenshotted */}
          <div style={{
            background: colors.inputBg, border: `1px solid ${colors.border}`,
            borderRadius: 10, padding: 16, height: 168,
          }}>
            <svg viewBox="0 0 600 120" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
              <defs>
                <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.success} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={colors.success} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path
                d="M0,96 C60,84 90,54 140,58 C190,62 210,90 260,80 C310,70 330,34 390,30 C450,26 470,52 520,44 C560,38 580,26 600,22"
                fill="none" stroke={colors.success} strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round"
              />
              <path
                d="M0,96 C60,84 90,54 140,58 C190,62 210,90 260,80 C310,70 330,34 390,30 C450,26 470,52 520,44 C560,38 580,26 600,22 L600,120 L0,120 Z"
                fill="url(#heroFill)"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* Features */}
      <div style={{ ...section, borderTop: `1px solid ${colors.border}` }}>
        <h2 style={h2}>Everything the day actually needs</h2>
        <p style={lede}>
          Not a list of modules. These are the things that go wrong in a stockroom,
          and what TechIT does about each one.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 18,
        }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{
              background: colors.card, border: `1px solid ${colors.border}`,
              borderRadius: 14, padding: 26,
            }}>
              <span style={{ fontSize: 26, display: 'block', marginBottom: 14 }}>{f.icon}</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: colors.text }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: colors.muted, lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div style={{ borderTop: `1px solid ${colors.border}`, background: colors.card }}>
        <div style={section}>
          <h2 style={h2}>Three steps, then it runs itself</h2>
          <p style={lede}>The point is that you stop thinking about it.</p>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 24,
          }}>
            {HOW_IT_WORKS.map(s => (
              <div key={s.step}>
                <p style={{
                  fontSize: 13, fontWeight: 800, color: colors.success,
                  letterSpacing: 1, marginBottom: 10,
                }}>{s.step}</p>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: colors.text }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: colors.muted, lineHeight: 1.65 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing */}
      <div style={{ ...section, borderTop: `1px solid ${colors.border}` }}>
        <h2 style={h2}>Simple pricing</h2>
        <p style={lede}>Start free. Upgrade when your catalogue or your team outgrows it.</p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 18, alignItems: 'start',
        }}>
          {PLANS.map(plan => (
            <div key={plan.name} style={{
              background: colors.card,
              border: `1px solid ${plan.featured ? colors.successBorder : colors.border}`,
              borderRadius: 14, padding: 28,
              position: 'relative',
            }}>
              {plan.featured && (
                <span style={{
                  position: 'absolute', top: -11, left: 28,
                  background: colors.success, color: onAccent,
                  padding: '3px 12px', borderRadius: 100,
                  fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
                }}>MOST POPULAR</span>
              )}

              <h3 style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{plan.name}</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '10px 0 4px' }}>
                <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.5, color: colors.text }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: 13, color: colors.subtle }}>{plan.cadence}</span>
              </div>
              <p style={{ fontSize: 13, color: colors.muted, marginBottom: 20, lineHeight: 1.5 }}>{plan.blurb}</p>

              <button
                onClick={() => router.push('/register')}
                style={{
                  width: '100%', padding: '11px',
                  background: plan.featured ? colors.success : 'none',
                  border: plan.featured ? 'none' : `1px solid ${colors.border}`,
                  color: plan.featured ? onAccent : colors.text,
                  borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 700,
                  marginBottom: 20,
                }}
              >{plan.cta}</button>

              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <span style={{ color: colors.success, fontWeight: 800, fontSize: 13, lineHeight: 1.5 }}>✓</span>
                    <span style={{ fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ borderTop: `1px solid ${colors.border}`, background: colors.card }}>
        <div style={{ ...section, maxWidth: 760 }}>
          <h2 style={h2}>Questions</h2>
          <p style={lede}>The things people ask before signing up.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQS.map((faq, i) => {
              const open = openFaq === i
              return (
                <div key={faq.q} style={{
                  background: colors.bg, border: `1px solid ${colors.border}`,
                  borderRadius: 10, overflow: 'hidden',
                }}>
                  <button
                    onClick={() => setOpenFaq(open ? -1 : i)}
                    aria-expanded={open}
                    style={{
                      width: '100%', textAlign: 'left', padding: '16px 18px',
                      background: 'none', border: 'none', cursor: 'pointer',
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', gap: 16,
                      color: colors.text, fontSize: 14, fontWeight: 600,
                      fontFamily: 'inherit',
                    }}
                  >
                    {faq.q}
                    <span style={{
                      color: colors.success, fontSize: 18, fontWeight: 700,
                      lineHeight: 1, flexShrink: 0,
                    }}>{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <p style={{
                      padding: '0 18px 16px', fontSize: 14,
                      color: colors.muted, lineHeight: 1.7,
                    }}>{faq.a}</p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Closing CTA */}
      <div style={{ ...section, textAlign: 'center', borderTop: `1px solid ${colors.border}` }}>
        <h2 style={{ ...h2, marginBottom: 14 }}>Stop counting shelves</h2>
        <p style={{ ...lede, marginBottom: 32 }}>
          Set it up with your real stock in an afternoon. Free for 100 items, no card.
        </p>
        <button onClick={() => router.push('/register')} style={{
          padding: '15px 36px', background: colors.success,
          border: 'none', color: onAccent, borderRadius: 10,
          cursor: 'pointer', fontSize: 15, fontWeight: 800,
        }}>Create your free account →</button>
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `1px solid ${colors.border}`, padding: '28px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 16, flexWrap: 'wrap', maxWidth: maxW, margin: '0 auto',
      }}>
        <span style={{ color: colors.subtle, fontSize: 13 }}>
          © {new Date().getFullYear()} TechIT Inventory Management
        </span>
        <div style={{ display: 'flex', gap: 18 }}>
          <span onClick={() => router.push('/login')} style={{ color: colors.subtle, fontSize: 13, cursor: 'pointer' }}>Sign in</span>
          <span onClick={() => router.push('/register')} style={{ color: colors.success, fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Get started</span>
        </div>
      </div>
    </div>
  )
}
