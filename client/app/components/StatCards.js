'use client'

export default function StatCards({ metrics }) {
  const cards = [
    { label: 'Total Products', value: metrics.total_items, icon: '📦', color: '#4ade80' },
    { label: 'Low Stock', value: metrics.low_stock, icon: '⚠️', color: '#fb923c' },
    { label: 'Out of Stock', value: metrics.out_of_stock, icon: '🚫', color: '#f87171' },
    { label: 'Total Value', value: `$${parseFloat(metrics.total_value).toLocaleString()}`, icon: '💰', color: '#60a5fa' },
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
          background: '#1a1a1a',
          border: '1px solid #2a2a2a',
          borderLeft: `4px solid ${card.color}`,
          borderRadius: 12,
          padding: 24,
          animation: 'fadeIn 0.3s ease forwards',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: '#555', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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