const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const supabase = require('./supabase')

const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL_DAYS = 30
const REFRESH_COOKIE_NAME = 'refresh_token'

/**
 * Refresh tokens are opaque random strings, not JWTs, so they can be revoked
 * server-side. Only their SHA-256 hash is stored: a leaked database dump
 * cannot be replayed against the API.
 */
function generateRefreshToken() {
  return crypto.randomBytes(32).toString('base64url')
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Short-lived JWT carrying the identity every request is authorised against. */
function signAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      organization_id: user.organization_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  )
}

/** Cookie options for the refresh token. Cross-site, so SameSite must be None. */
function refreshCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production'
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
    path: '/api/auth',
  }
}

/**
 * Issue a refresh token and persist its hash.
 * `replacesId` links the new row to the one it rotated from, which is what
 * makes reuse detection possible.
 */
async function issueRefreshToken(userId, { replacesId = null, userAgent = null } = {}) {
  const token = generateRefreshToken()
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('techit_refresh_tokens')
    .insert({
      user_id: userId,
      token_hash: hashToken(token),
      expires_at: expiresAt.toISOString(),
      replaces_id: replacesId,
      user_agent: userAgent ? String(userAgent).slice(0, 255) : null,
    })
    .select('id')
    .single()

  if (error) throw error
  return { token, id: data.id, expiresAt }
}

/** Look up a token row by the raw token. Returns null when absent. */
async function findRefreshToken(rawToken) {
  if (!rawToken) return null

  const { data, error } = await supabase
    .from('techit_refresh_tokens')
    .select('*')
    .eq('token_hash', hashToken(rawToken))
    .maybeSingle()

  if (error || !data) return null
  return data
}

async function revokeToken(id) {
  const { error } = await supabase
    .from('techit_refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
    .is('revoked_at', null)

  if (error) throw error
}

/**
 * Revoke every outstanding token for a user. Called on logout-everywhere and,
 * critically, when a already-rotated token is replayed: that means the token
 * leaked, so the whole family is burned and the attacker and the real user
 * are both forced to log in again.
 */
async function revokeAllForUser(userId) {
  const { error } = await supabase
    .from('techit_refresh_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('revoked_at', null)

  if (error) throw error
}

module.exports = {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL_DAYS,
  REFRESH_COOKIE_NAME,
  signAccessToken,
  refreshCookieOptions,
  issueRefreshToken,
  findRefreshToken,
  revokeToken,
  revokeAllForUser,
  hashToken,
}
