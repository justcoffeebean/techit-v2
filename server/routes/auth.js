const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const supabase = require('../services/supabase')
const { asyncHandler } = require('../utils/asyncHandler')
const { loginLimiter, registerLimiter, passwordResetLimiter } = require('../middleware/rateLimiter')
const { findValidInvitation, markRedeemed } = require('../services/invitations')
const {
  RESET_TTL_MINUTES,
  createResetToken,
  findValidResetToken,
  markUsed,
} = require('../services/passwordResets')
const { sendPasswordResetEmail } = require('../services/email')
const { authMiddleware } = require('../middleware/auth')
const {
  REFRESH_COOKIE_NAME,
  signAccessToken,
  refreshCookieOptions,
  issueRefreshToken,
  findRefreshToken,
  revokeToken,
  revokeAllForUser,
} = require('../services/tokens')

/**
 * Slugify a name so it can be used as a unique organizations.slug.
 * Keeps it deterministic and human-readable.
 */
function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'org'
}

/**
 * Create a fresh organization and return its id.
 * Appends a numeric suffix on slug collision so the unique constraint holds.
 */
async function createOrganization(name) {
  const baseSlug = slugify(name)
  let slug = baseSlug
  let attempt = 0

  while (attempt < 5) {
    const { data, error } = await supabase
      .from('techit_organizations')
      .insert({ name: name || baseSlug, slug, plan: 'free' })
      .select('id')
      .single()

    if (!error) return data.id

    // If the slug collided, try again with a random suffix
    if (error.message && error.message.includes('techit_organizations_slug_key')) {
      slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
      attempt += 1
      continue
    }

    throw error
  }

  throw new Error('Could not create organization after 5 attempts')
}

// POST /api/auth/login
router.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' })
  }

  // Find user by username or email (sanitize to prevent injection)
  const sanitized = username.replace(/[,()]/g, '')
  const { data: users, error } = await supabase
    .from('techit_users')
    .select('*')
    .or(`username.eq.${sanitized},email.eq.${sanitized}`)
    .limit(1)

  if (error || !users || users.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  const user = users[0]

  // Verify password
  const validPassword = await bcrypt.compare(password, user.password)
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }

  // Short-lived access token for the client, long-lived refresh token in an
  // httpOnly cookie the browser cannot read.
  const token = signAccessToken(user)
  const { token: refreshToken } = await issueRefreshToken(user.id, {
    userAgent: req.headers['user-agent'],
  })

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions())

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      organization_id: user.organization_id,
    }
  })
}))

// POST /api/auth/refresh — exchange the refresh cookie for a new access token.
// The refresh token is rotated on every use: the presented token is revoked
// and a fresh one issued, so a stolen token is only valid until the real
// client next refreshes.
router.post('/refresh', asyncHandler(async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE_NAME]

  if (!presented) {
    return res.status(401).json({ error: 'No refresh token provided' })
  }

  const stored = await findRefreshToken(presented)

  if (!stored) {
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions())
    return res.status(401).json({ error: 'Invalid refresh token' })
  }

  // A revoked token being presented means it was rotated already and someone
  // replayed the old value. Either it leaked or the cookie was stolen, so
  // burn every session for this user rather than trusting the request.
  if (stored.revoked_at) {
    await revokeAllForUser(stored.user_id)
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions())
    return res.status(401).json({ error: 'Refresh token reuse detected. Please sign in again.' })
  }

  if (new Date(stored.expires_at) < new Date()) {
    await revokeToken(stored.id)
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions())
    return res.status(401).json({ error: 'Refresh token expired' })
  }

  // Re-read the user so a role or organisation change takes effect on the
  // next refresh rather than persisting for the life of the session.
  const { data: user, error: userError } = await supabase
    .from('techit_users')
    .select('id, username, role, organization_id')
    .eq('id', stored.user_id)
    .single()

  if (userError || !user) {
    await revokeToken(stored.id)
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions())
    return res.status(401).json({ error: 'User no longer exists' })
  }

  await revokeToken(stored.id)
  const { token: nextRefresh } = await issueRefreshToken(user.id, {
    replacesId: stored.id,
    userAgent: req.headers['user-agent'],
  })

  res.cookie(REFRESH_COOKIE_NAME, nextRefresh, refreshCookieOptions())

  res.json({
    token: signAccessToken(user),
    user,
  })
}))

// POST /api/auth/logout — revoke the presented refresh token and clear the
// cookie. Pass { all: true } to end every session for the user.
router.post('/logout', asyncHandler(async (req, res) => {
  const presented = req.cookies?.[REFRESH_COOKIE_NAME]

  if (presented) {
    const stored = await findRefreshToken(presented)
    if (stored) {
      if (req.body?.all) {
        await revokeAllForUser(stored.user_id)
      } else {
        await revokeToken(stored.id)
      }
    }
  }

  res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions())
  res.json({ ok: true })
}))

// GET /api/auth/me — resolve the caller from their access token. The client
// uses this instead of trusting a user object it stored itself.
router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const { data: user, error } = await supabase
    .from('techit_users')
    .select('id, username, email, role, organization_id')
    .eq('id', req.user.id)
    .single()

  if (error || !user) {
    return res.status(404).json({ error: 'User not found' })
  }

  res.json(user)
}))


/**
 * Build the frontend reset URL. Mirrors the invitation link, preferring
 * CLIENT_URL and falling back to the request origin for local development.
 */
function buildResetUrl(req, token) {
  const base =
    (process.env.CLIENT_URL && process.env.CLIENT_URL.replace(/\/$/, '')) ||
    (req.headers.origin && req.headers.origin.replace(/\/$/, '')) ||
    'https://techit-v2.vercel.app'

  return `${base}/reset-password?token=${encodeURIComponent(token)}`
}

// POST /api/auth/forgot-password — send a reset link.
//
// Always answers the same way whether or not the address is registered:
// a differing response would turn this into an oracle for discovering which
// email addresses hold accounts.
router.post('/forgot-password', passwordResetLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body

  const genericResponse = {
    message: 'If an account exists for that address, a reset link is on its way.',
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.json(genericResponse)
  }

  const { data: user } = await supabase
    .from('techit_users')
    .select('id, username, email')
    .ilike('email', email.trim())
    .maybeSingle()

  // No account: answer identically and do no work.
  if (!user) return res.json(genericResponse)

  try {
    const { token } = await createResetToken(user.id, { requestedIp: req.ip })
    await sendPasswordResetEmail({
      to: user.email,
      username: user.username,
      resetUrl: buildResetUrl(req, token),
      expiresInMinutes: RESET_TTL_MINUTES,
    })
  } catch (err) {
    // A mail failure is logged but not surfaced: reporting it would leak
    // that the address exists.
    console.error('Password reset dispatch failed:', err.message)
  }

  res.json(genericResponse)
}))

// GET /api/auth/reset-password/:token — check a link before showing the form,
// so an expired link says so instead of failing after the user types a password.
router.get('/reset-password/:token', asyncHandler(async (req, res) => {
  const reset = await findValidResetToken(req.params.token)

  if (!reset) {
    return res.status(404).json({ valid: false, error: 'This reset link is invalid or has expired.' })
  }

  res.json({ valid: true })
}))

// POST /api/auth/reset-password — set the new password.
router.post('/reset-password', passwordResetLimiter, asyncHandler(async (req, res) => {
  const { token, password } = req.body

  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  const reset = await findValidResetToken(token)
  if (!reset) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' })
  }

  const hashedPassword = await bcrypt.hash(password, 10)

  const { error: updateError } = await supabase
    .from('techit_users')
    .update({ password: hashedPassword })
    .eq('id', reset.user_id)

  if (updateError) throw updateError

  await markUsed(reset.id)

  // Whoever knew the old password may still hold a refresh token, so every
  // session is revoked: resetting a password must end access everywhere.
  try {
    await revokeAllForUser(reset.user_id)
  } catch (err) {
    console.error('Failed to revoke sessions after password reset:', err.message)
  }

  res.json({ message: 'Password updated. Please sign in with your new password.' })
}))

// POST /api/auth/register
router.post('/register', registerLimiter, asyncHandler(async (req, res) => {
  const { username, email, password, invite_token } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  // Validate the invitation up front so we never create a user we would
  // then have to reject or orphan.
  let invite = null
  if (invite_token) {
    invite = await findValidInvitation(invite_token)
    if (!invite) {
      return res.status(400).json({ error: 'Invitation is invalid or expired' })
    }
    if (invite.email.toLowerCase() !== String(email).toLowerCase()) {
      return res.status(400).json({ error: 'Email does not match the invitation' })
    }
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // An invited user joins the inviting org at the invited role. Everyone
  // else gets a fresh organization and becomes its admin.
  let organizationId
  let role

  if (invite) {
    organizationId = invite.organization_id
    role = invite.role
  } else {
    organizationId = await createOrganization(`${username}'s Organization`)
    role = 'admin'
  }

  // Insert user
  const { data, error } = await supabase
    .from('techit_users')
    .insert({
      username,
      email,
      password: hashedPassword,
      role,
      organization_id: organizationId,
    })
    .select()
    .single()

  if (error) {
    if (error.message.includes('unique')) {
      return res.status(400).json({ error: 'Username or email already exists' })
    }
    throw error
  }

  // The account already carries the invited org and role, so the invitation
  // is consumed here rather than in a separate post-login step.
  if (invite) {
    await markRedeemed(invite.id)
  }

  res.status(201).json({
    message: invite
      ? 'Account created. Please sign in to access your team.'
      : 'Account created successfully',
  })
}))

module.exports = router
