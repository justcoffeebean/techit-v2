const express = require('express')
const router = express.Router()
const supabase = require('../services/supabase')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const { asyncHandler } = require('../utils/asyncHandler')
const { parsePagination, buildPagination } = require('../utils/pagination')
const { computeStatus } = require('../utils/computeStatus')
const { logAction } = require('../services/audit')
const { sendLowStockAlert } = require('../services/email')
const { MOVEMENT_TYPES, signedChange, recordMovement } = require('../services/movements')

// GET /api/movements — org-wide movement history, newest first
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const { type, item_id, from, to } = req.query
  const { page, limit, offset } = parsePagination(req.query)

  let query = supabase
    .from('techit_stock_movements')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId)

  if (type && type !== 'all') {
    if (!MOVEMENT_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Unknown movement type' })
    }
    query = query.eq('movement_type', type)
  }

  if (item_id) query = query.eq('item_id', item_id)
  if (from) query = query.gte('created_at', `${from}T00:00:00.000Z`)
  if (to) query = query.lte('created_at', `${to}T23:59:59.999Z`)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  res.json({
    items: data || [],
    pagination: buildPagination(page, limit, count),
  })
}))

// GET /api/movements/item/:itemId — one item's history for the detail view
router.get('/item/:itemId', authMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const { itemId } = req.params
  const { page, limit, offset } = parsePagination(req.query)

  const { data, error, count } = await supabase
    .from('techit_stock_movements')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId)
    .eq('item_id', itemId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  res.json({
    items: data || [],
    pagination: buildPagination(page, limit, count),
  })
}))

// POST /api/movements — record a deliberate stock movement (admin only).
// This is how stock is received, written off as damaged, or returned; the
// item quantity is updated to match.
router.post('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const { item_id, movement_type, quantity, reason } = req.body

  if (!item_id) {
    return res.status(400).json({ error: 'An item is required' })
  }
  if (!MOVEMENT_TYPES.includes(movement_type)) {
    return res.status(400).json({ error: `Movement type must be one of: ${MOVEMENT_TYPES.join(', ')}` })
  }

  const magnitude = Math.abs(parseInt(quantity) || 0)
  if (magnitude === 0) {
    return res.status(400).json({ error: 'Quantity must be greater than zero' })
  }

  const { data: item, error: itemError } = await supabase
    .from('techit_items')
    .select('*')
    .eq('id', item_id)
    .eq('organization_id', orgId)
    .single()

  if (itemError || !item) {
    return res.status(404).json({ error: 'Item not found' })
  }

  const change = signedChange(movement_type, magnitude)
  const before = item.quantity || 0
  const after = before + change

  if (after < 0) {
    return res.status(400).json({
      error: `Cannot remove ${magnitude} units: only ${before} on hand`,
    })
  }

  const { data: updated, error: updateError } = await supabase
    .from('techit_items')
    .update({ quantity: after, updated_at: new Date().toISOString() })
    .eq('id', item_id)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (updateError) throw updateError

  const movement = await recordMovement({
    organizationId: orgId,
    item,
    movementType: movement_type,
    quantityChange: change,
    quantityBefore: before,
    quantityAfter: after,
    reason: reason || '',
    referenceType: 'manual',
    userId: req.user.id,
    username: req.user.username,
  })

  await logAction(req.user.id, req.user.username, 'STOCK_MOVEMENT', item.id, item.name, {
    movement_type,
    quantity_change: change,
    quantity_before: before,
    quantity_after: after,
  }, orgId)

  const status = computeStatus(updated.quantity, updated.low_stock_threshold)
  if (status !== 'In Stock') {
    try {
      await sendLowStockAlert([{ ...updated, status }])
    } catch (emailErr) {
      console.error('Low stock alert failed after stock movement:', emailErr.message)
    }
  }

  res.status(201).json({
    movement,
    item: { ...updated, status },
  })
}))

module.exports = router
