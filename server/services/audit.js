const supabase = require('./supabase')

async function logAction(userId, username, action, itemId, itemName, changes) {
  try {
    await supabase.from('techit_audit_log').insert({
      user_id: userId,
      username,
      action,
      item_id: itemId || null,
      item_name: itemName || null,
      changes: changes || null,
    })
  } catch (err) {
    console.error('Audit log error:', err.message)
  }
}

module.exports = { logAction }