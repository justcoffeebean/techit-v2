const supabase = require('./supabase')

/**
 * Append an entry to the audit log.
 *
 * Never throws. Every caller awaits this *after* the operation it describes
 * has already been committed, so rethrowing would turn a successful write
 * into a 500 and tell the client an item was not created when it was. A
 * failure here is logged and swallowed: losing an audit row is bad, but
 * misreporting the outcome of the operation is worse.
 */
async function logAction(userId, username, action, itemId, itemName, changes, organizationId) {
  try {
    const { error } = await supabase.from('techit_audit_log').insert({
      user_id: userId,
      username,
      organization_id: organizationId,
      action,
      item_id: itemId || null,
      item_name: itemName || null,
      changes: changes || null,
    })

    if (error) {
      console.error('Audit log insert failed:', error.message)
    }
  } catch (err) {
    console.error('Audit log error:', err.message)
  }
}

module.exports = { logAction }
