const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const supabase = require('../services/supabase')
const { asyncHandler } = require('../utils/asyncHandler')
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter')

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
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Create a new organization for this user. The new user becomes its admin.
  const orgName = `${username}'s Organization`
  const organizationId = await createOrganization(orgName)

  // Insert user
  const { data, error } = await supabase
    .from('techit_users')
    .insert({
      username,
      email,
      password: hashedPassword,
      role: 'admin',
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

  res.status(201).json({ message: 'Account created successfully' })
}))

module.exports = router
