'use client'

const statusColors = {
  'In Stock': { bg: '#0d2e1f', border: '#1a5c3a', text: '#4ade80' },
  'Low Stock': { bg: '#2e1f0d', border: '#6e3a1a', text: '#fb923c' },
  'Out of Stock': { bg: '#3a0d0d', border: '#6e1a1a', text: '#f87171' },
}

export default function ItemsTable({ items, role, onEdit, onDelete }) {
  if (items.length === 0) {
    return (
      <div style={{
        background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12,
        padding: 60, textAlign: 'center',
      }}>
        <p style={{ fontSize: 32, marginBottom: 12 }}>📭</p>
        <p style={{ color: '#555', fontSize: 16 }}>No items found</p>
        <p style={{ color: '#333', fontSize: 13, marginTop: 4 }}>Try adjusting your filters or add new items</p>
      </div>
    )
  }

  return (
    <div style={{
      background: '#1a1a1a', border: '1px solid #2a2a2a',
      borderRadius: 12, overflow: 'hidden',
    }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#111' }}>
              {['Name', 'SKU', 'Category', 'Quantity', 'Price', 'Status', 'Location', 'Supplier', ...(role === 'admin' ? ['Actions'] : [])].map(h => (
                <th key={h} style={{
                  padding: '14px 16px', textAlign: 'left',
                  fontSize: 11, fontWeight: 700, color: '#555',
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  borderBottom: '1px solid #2a2a2a',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => {
              const colors = statusColors[item.status] || statusColors['In Stock']
              return (
                <tr key={item.id} style={{
                  borderBottom: '1px solid #2a2a2a',
                  background: i % 2 === 0 ? '#1a1a1a' : '#161616',
                }}>
                  <td style={{ padding: '14px 16px', fontWeight: 600, fontSize: 14 }}>{item.name}</td>
                  <td style={{ padding: '14px 16px', color: '#555', fontSize: 13, fontFamily: 'monospace' }}>{item.sku}</td>
                  <td style={{ padding: '14px 16px', color: '#888', fontSize: 13 }}>{item.category}</td>
                  <td style={{ padding: '14px 16px', fontSize: 14 }}>{item.quantity}</td>
                  <td style={{ padding: '14px 16px', fontSize: 14 }}>${parseFloat(item.price).toFixed(2)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: colors.bg, border: `1px solid ${colors.border}`,
                      color: colors.text, padding: '4px 10px',
                      borderRadius: 100, fontSize: 11, fontWeight: 700,
                    }}>{item.status}</span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#888', fontSize: 13 }}>{item.location || '—'}</td>
                  <td style={{ padding: '14px 16px', color: '#888', fontSize: 13 }}>{item.supplier || '—'}</td>
                  {role === 'admin' && (
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => onEdit(item)} style={{
                          padding: '6px 12px', background: '#1f2d1f',
                          border: '1px solid #1a5c3a', color: '#4ade80',
                          borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}>Edit</button>
                        <button onClick={() => onDelete(item)} style={{
                          padding: '6px 12px', background: '#2d1f1f',
                          border: '1px solid #6e1a1a', color: '#f87171',
                          borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                        }}>Delete</button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}