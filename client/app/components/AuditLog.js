'use client'
import { modalOverlayStyle, cardStyle, colors } from '../lib/styles'

const actionColors = {
  'ADD_ITEM': { bg: colors.successBg, border: colors.successBorder, text: colors.success, label: '+ Added' },
  'UPDATE_ITEM': { bg: '#1f2a0d', border: '#3a5c1a', text: '#a3e635', label: '✎ Updated' },
  'DELETE_ITEM': { bg: colors.errorBg, border: colors.errorBorder, text: colors.error, label: '✕ Deleted' },
}

export default function AuditLog({ logs, onClose }) {
  return (
    <div style={modalOverlayStyle}>
      <div style={{
        ...cardStyle,
        maxWidth: 700,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Audit Log</h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: colors.subtle,
            fontSize: 20, cursor: 'pointer',
          }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {logs.length === 0 ? (
            <p style={{ color: colors.subtle, textAlign: 'center', padding: 40 }}>No audit logs yet</p>
          ) : (
            logs.map((log) => {
              const logColors = actionColors[log.action] || actionColors['UPDATE_ITEM']
              return (
                <div key={log.id} style={{
                  padding: '14px 16px', borderBottom: `1px solid ${colors.border}`,
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <span style={{
                    background: logColors.bg, border: `1px solid ${logColors.border}`,
                    color: logColors.text, padding: '3px 8px',
                    borderRadius: 6, fontSize: 11, fontWeight: 700,
                    whiteSpace: 'nowrap', marginTop: 2,
                  }}>{logColors.label}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, color: colors.text, marginBottom: 2 }}>
                      <span style={{ color: colors.success, fontWeight: 600 }}>{log.username}</span>
                      {' '}{log.action === 'ADD_ITEM' ? 'added' : log.action === 'DELETE_ITEM' ? 'deleted' : 'updated'}{' '}
                      <span style={{ fontWeight: 600 }}>{log.item_name}</span>
                    </p>
                    {log.changes && (
                      <p style={{ fontSize: 12, color: colors.subtle }}>
                        {log.action === 'UPDATE_ITEM' && log.changes.before && (
                          `Qty: ${log.changes.before.quantity} → ${log.changes.after.quantity} · Price: $${log.changes.before.price} → $${log.changes.after.price}`
                        )}
                        {log.action === 'ADD_ITEM' && (
                          `Qty: ${log.changes.quantity} · Price: $${log.changes.price}`
                        )}
                      </p>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: colors.subtle, whiteSpace: 'nowrap' }}>
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
