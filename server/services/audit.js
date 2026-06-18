const supabase = require('./supabase')

async function logAction(userId, username, action, itemId, itemName, changes) {
  try {
    const { error } = await supabase.from('techit_audit_log').insert({
      user_id: userId,
      username,
      action,
      item_id: itemId || null,
      item_name: itemName || null,
      changes: changes || null,
    })

    if (error) {
      console.error('Audit log insert failed:', error.message)
      throw new Error(`Audit log failed: ${error.message}`)
    }
  } catch (err) {
    console.error('Audit log error:', err.message)
    throw err
  }
}

module.exports = { logAction }