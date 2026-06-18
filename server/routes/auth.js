const express = require('express')
const router = express.Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const supabase = require('../services/supabase')
const { asyncHandler } = require('../utils/asyncHandler')

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
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

  // Generate JWT
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )

  res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role }
  })
}))

// POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const { username, email, password } = req.body

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'All fields required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' })
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10)

  // Insert user
  const { data, error } = await supabase
    .from('techit_users')
    .insert({ username, email, password: hashedPassword, role: 'user' })
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
