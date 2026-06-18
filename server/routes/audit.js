const express = require('express')
const router = express.Router()
const supabase = require('../services/supabase')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')

// GET /api/audit — get audit log (admin only)
router.get('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('techit_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    res.json(data)
  } catch (err) {
    console.error('Audit log error:', err.message)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router