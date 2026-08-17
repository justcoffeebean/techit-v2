const express = require('express')
const router = express.Router()
const supabase = require('../services/supabase')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const { asyncHandler } = require('../utils/asyncHandler')

// GET /api/audit — get audit log (admin only, org-scoped)
router.get('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id

  const { data, error } = await supabase
    .from('techit_audit_log')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error

  res.json(data)
}))

module.exports = router
