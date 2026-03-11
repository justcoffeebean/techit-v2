'use client'

const actionColors = {
  'ADD_ITEM': { bg: '#0d2e1f', border: '#1a5c3a', text: '#4ade80', label: '+ Added' },
  'UPDATE_ITEM': { bg: '#1f2a0d', border: '#3a5c1a', text: '#a3e635', label: '✎ Updated' },
  'DELETE_ITEM': { bg: '#3a0d0d', border: '#6e1a1a', text: '#f87171', label: '✕ Deleted' },
}

export default function AuditLog({ logs, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20,
    }}>
      <div style={{
        background: '#1a1a1a', border: '1px solid #2a2a2a',
        borderRadius: 16, padding: 32, width: '100%', maxWidth: 700,
        maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>📋 Audit Log</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#555',
            fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {logs.length === 0 ? (
            <p style={{ color: '#555', textAlign: 'center', padding: 40 }}>No audit logs yet</p>
          ) : (
            logs.map((log) => {
              const colors = actionColors[log.action] || actionColors['UPDATE_ITEM']
              return (
                <div key={log.id} style={{
                  padding: '14px 16px', borderBottom: '1px solid #2a2a2a',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <span style={{
                    background: colors.bg, border: `1px solid ${colors.border}`,
                    color: colors.text, padding: '3px 8px',
                    borderRadius: 6, fontSize: 11, fontWeight: 700,
                    whiteSpace: 'nowrap', marginTop: 2,
                  }}>{colors.label}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, color: '#fff', marginBottom: 2 }}>
                      <span style={{ color: '#4ade80', fontWeight: 600 }}>{log.username}</span>
                      {' '}{log.action === 'ADD_ITEM' ? 'added' : log.action === 'DELETE_ITEM' ? 'deleted' : 'updated'}{' '}
                      <span style={{ fontWeight: 600 }}>{log.item_name}</span>
                    </p>
                    {log.changes && (
                      <p style={{ fontSize: 12, color: '#555' }}>
                        {log.action === 'UPDATE_ITEM' && log.changes.before && (
                          `Qty: ${log.changes.before.quantity} → ${log.changes.after.quantity} · Price: $${log.changes.before.price} → $${log.changes.after.price}`
                        )}
                        {log.action === 'ADD_ITEM' && (
                          `Qty: ${log.changes.quantity} · Price: $${log.changes.price}`
                        )}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap' }}>
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}