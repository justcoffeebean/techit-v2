const crypto = require('crypto')
const supabase = require('./supabase')

const INVITE_TTL_DAYS = 7

/**
 * URL-safe random token, ~190 bits of entropy. Long enough that brute force
 * on the token column is infeasible, short enough to fit in URLs and emails.
 */
function generateToken() {
  return crypto.randomBytes(24).toString('base64url')
}

/**
 * Create a pending invitation. If a pending invite already exists for the
 * same (org, email) the existing row is returned instead of creating a
 * duplicate, so re-inviting someone resends the same link.
 */
async function createInvitation({ organizationId, email, role, invitedBy }) {
  const sanitizedEmail = String(email || '').trim().toLowerCase()
  if (!sanitizedEmail) throw new Error('Email is required')

  const token = generateToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('techit_invitations')
    .insert({
      organization_id: organizationId,
      email: sanitizedEmail,
      role: role === 'admin' ? 'admin' : 'user',
      token,
      invited_by: invitedBy || null,
      expires_at: expiresAt,
    })
    .select('*')
    .single()

  // Unique partial index hit means a pending invite already exists — reuse it
  if (error && error.message && error.message.includes('uniq_invitations_org_email_pending')) {
    const { data: existing, error: existingErr } = await supabase
      .from('techit_invitations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('email', sanitizedEmail)
      .eq('status', 'pending')
      .single()

    if (existingErr) throw existingErr
    return existing
  }

  if (error) throw error
  return data
}

/**
 * Look up a token. Returns null if missing, redeemed, revoked or expired.
 * An expired-but-still-pending row is flipped to 'expired' so the admin's
 * list shows the right status.
 */
async function findValidInvitation(token) {
  if (!token) return null

  const { data, error } = await supabase
    .from('techit_invitations')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !data) return null
  if (data.status !== 'pending') return null

  if (new Date(data.expires_at) < new Date()) {
    await supabase
      .from('techit_invitations')
      .update({ status: 'expired' })
      .eq('id', data.id)
    return null
  }

  return data
}

/** Flip a pending invite to redeemed. Idempotent. */
async function markRedeemed(invitationId) {
  const { error } = await supabase
    .from('techit_invitations')
    .update({ status: 'redeemed', redeemed_at: new Date().toISOString() })
    .eq('id', invitationId)
    .eq('status', 'pending')

  if (error) throw error
}

module.exports = {
  createInvitation,
  findValidInvitation,
  markRedeemed,
  generateToken,
  INVITE_TTL_DAYS,
}
