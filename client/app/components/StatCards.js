'use client'
import { colors } from '../lib/styles'

export default function StatCards({ metrics }) {
  const cards = [
    { label: 'Total Products', value: metrics.total_items, icon: '📦', color: colors.success },
    { label: 'Low Stock', value: metrics.low_stock, icon: '⚠️', color: colors.warning },
    { label: 'Out of Stock', value: metrics.out_of_stock, icon: '🚫', color: colors.error },
    { label: 'Total Value', value: `$${parseFloat(metrics.total_value).toLocaleString()}`, icon: '💰', color: colors.info },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: 16,
      marginBottom: 24,
    }}>
      {cards.map((card) => (
        <div key={card.label} style={{
          background: colors.card,
          border: `1px solid ${colors.border}`,
          borderLeft: `4px solid ${card.color}`,
          borderRadius: 12,
          padding: 24,
          animation: 'fadeIn 0.3s ease forwards',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: colors.subtle, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {card.label}
            </p>
            <span style={{ fontSize: 20 }}>{card.icon}</span>
          </div>
          <p style={{ fontSize: 32, fontWeight: 800, color: card.color }}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}
