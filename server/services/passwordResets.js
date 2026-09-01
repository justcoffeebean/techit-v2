const crypto = require('crypto')
const supabase = require('./supabase')

// Short-lived by design: a reset link is a bearer credential for the account,
// so it should stop working long before an old email is forwarded or leaked.
const RESET_TTL_MINUTES = 60

function generateToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Issue a reset token for a user.
 *
 * Any outstanding tokens are invalidated first, so requesting a second link
 * silently retires the first and a user cannot be confused by two live links.
 */
async function createResetToken(userId, { requestedIp = null } = {}) {
  await invalidateAllForUser(userId)

  const token = generateToken()
  const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000)

  const { data, error } = await supabase
    .from('techit_password_resets')
    .insert({
      user_id: userId,
      token_hash: hashToken(token),
      requested_ip: requestedIp ? String(requestedIp).slice(0, 64) : null,
      expires_at: expiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (error) throw error
  return { token, id: data.id, expiresAt }
}

/**
 * Resolve a raw token to its row, or null when it is unknown, already used,
 * or expired. An expired row is marked used so it cannot be retried.
 */
async function findValidResetToken(rawToken) {
  if (!rawToken) return null

  const { data, error } = await supabase
    .from('techit_password_resets')
    .select('*')
    .eq('token_hash', hashToken(rawToken))
    .maybeSingle()

  if (error || !data) return null
  if (data.used_at) return null

  if (new Date(data.expires_at) < new Date()) {
    await supabase
      .from('techit_password_resets')
      .update({ used_at: new Date().toISOString() })
      .eq('id', data.id)
    return null
  }

  return data
}

async function markUsed(id) {
  const { error } = await supabase
    .from('techit_password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id)
    .is('used_at', null)

  if (error) throw error
}

/** Retire every outstanding token for a user. */
async function invalidateAllForUser(userId) {
  const { error } = await supabase
    .from('techit_password_resets')
    .update({ used_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('used_at', null)

  if (error) throw error
}

module.exports = {
  RESET_TTL_MINUTES,
  generateToken,
  hashToken,
  createResetToken,
  findValidResetToken,
  markUsed,
  invalidateAllForUser,
}
