const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const supabase = require('../services/supabase')
const { asyncHandler } = require('../utils/asyncHandler')
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter')
const { findValidInvitation, markRedeemed } = require('../services/invitations')

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

  // Generate JWT — includes organization_id so every request is scoped
  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role,
      organization_id: user.organization_id,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

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
