const express = require('express')
const router = express.Router()
const supabase = require('../services/supabase')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const { logAction } = require('../services/audit')
const { sendLowStockAlert } = require('../services/email')
const { Parser } = require('json2csv')
const { computeStatus, mapItemsWithStatus } = require('../utils/computeStatus')
const { asyncHandler } = require('../utils/asyncHandler')
const { parsePagination, buildPagination } = require('../utils/pagination')
const { recordMovement, recordQuantityChange } = require('../services/movements')
const { triggerReorderIfLow } = require('../services/reorder')

// GET /api/items — list items in the caller's org
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const { keyword, category, status } = req.query
  const orgId = req.user.organization_id

  const { page, limit, offset } = parsePagination(req.query)

  let query = supabase
    .from('techit_items')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId)

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  if (keyword) {
    const sanitizedKeyword = keyword.replace(/[,()]/g, '')
    query = query.or(`name.ilike.%${sanitizedKeyword}%,sku.ilike.%${sanitizedKeyword}%,supplier.ilike.%${sanitizedKeyword}%`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  let items = mapItemsWithStatus(data || [])

  if (status && status !== 'all') {
    items = items.filter(i => i.status === status)
  }

  res.json({
    items,
    pagination: buildPagination(page, limit, count)
  })
}))

// GET /api/items/metrics — dashboard stats for the caller's org only
router.get('/metrics', authMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id

  const { data, error } = await supabase
    .from('techit_items')
    .select('*')
    .eq('organization_id', orgId)

  if (error) throw error

  const items = mapItemsWithStatus(data)

  const metrics = {
    total_items: items.length,
    low_stock: items.filter(i => i.status === 'Low Stock').length,
    out_of_stock: items.filter(i => i.status === 'Out of Stock').length,
    total_value: items.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2),
    total_cost_value: items.reduce((sum, i) => sum + (parseFloat(i.cost_price || 0) * i.quantity), 0).toFixed(2),
    categories: [...new Set(items.map(i => i.category))],
    by_category: {},
    by_status: {
      'In Stock': items.filter(i => i.status === 'In Stock').length,
      'Low Stock': items.filter(i => i.status === 'Low Stock').length,
      'Out of Stock': items.filter(i => i.status === 'Out of Stock').length,
    }
  }

  items.forEach(item => {
    if (!metrics.by_category[item.category]) {
      metrics.by_category[item.category] = { count: 0, value: 0 }
    }
    metrics.by_category[item.category].count++
    metrics.by_category[item.category].value += item.price * item.quantity
  })

  res.json(metrics)
}))

// GET /api/items/export — export the caller's org as CSV
router.get('/export', authMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id

  const { data, error } = await supabase
    .from('techit_items')
    .select('name,sku,category,quantity,price,cost_price,location,supplier,low_stock_threshold,created_at')
    .eq('organization_id', orgId)
    .order('name')

  if (error) throw error

  const items = data.map(item => ({
    ...item,
    status: computeStatus(item.quantity, item.low_stock_threshold || 10)
  }))

  const parser = new Parser({
    fields: ['name', 'sku', 'category', 'quantity', 'price', 'cost_price', 'status', 'location', 'supplier', 'created_at']
  })
  const csv = parser.parse(items)

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=techit-inventory.csv')
  res.send(csv)
}))

// POST /api/items — add item (admin only) in the caller's org
router.post('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { name, sku, category, quantity, price, cost_price, location, supplier, low_stock_threshold } = req.body
  const orgId = req.user.organization_id

  if (!name || !sku || !category) {
    return res.status(400).json({ error: 'Name, SKU and category are required' })
  }

  const { data, error } = await supabase
    .from('techit_items')
    .insert({
      organization_id: orgId,
      name, sku, category,
      quantity: quantity || 0,
      price: price || 0,
      cost_price: cost_price || 0,
      location: location || '',
      supplier: supplier || '',
      low_stock_threshold: low_stock_threshold || 10
    })
    .select()
    .single()

  if (error) {
    if (error.message.includes('unique')) {
      return res.status(400).json({ error: 'SKU already exists' })
    }
    throw error
  }

  const itemWithStatus = {
    ...data,
    status: computeStatus(data.quantity, data.low_stock_threshold)
  }

  await logAction(req.user.id, req.user.username, 'ADD_ITEM', data.id, data.name, { quantity, price }, orgId)

  // Opening stock is the item's first movement, so the history starts at zero
  // rather than appearing to materialise out of nowhere.
  if (data.quantity > 0) {
    await recordMovement({
      organizationId: orgId,
      item: data,
      movementType: 'received',
      quantityChange: data.quantity,
      quantityBefore: 0,
      quantityAfter: data.quantity,
      reason: 'Opening stock',
      referenceType: 'manual',
      userId: req.user.id,
      username: req.user.username,
    })
  }

  if (itemWithStatus.status !== 'In Stock') {
    try {
      await sendLowStockAlert([itemWithStatus])
    } catch (emailErr) {
      console.error('Low stock alert failed after adding item:', emailErr.message)
    }
    await triggerReorderIfLow(orgId, [data])
  }

  res.status(201).json(itemWithStatus)
}))

// PUT /api/items/:id — update item (admin only) within the caller's org
router.put('/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params
  const { name, sku, category, quantity, price, cost_price, location, supplier, low_stock_threshold } = req.body
  const orgId = req.user.organization_id

  const { data: prev, error: fetchError } = await supabase
    .from('techit_items')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (fetchError || !prev) {
    return res.status(404).json({ error: 'Item not found' })
  }

  const prevStatus = computeStatus(prev.quantity, prev.low_stock_threshold)

  const { data, error } = await supabase
    .from('techit_items')
    .update({
      name, sku, category, quantity, price,
      cost_price: cost_price || 0,
      location: location || '',
      supplier: supplier || '',
      low_stock_threshold: low_stock_threshold || 10,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) throw error

  const itemWithStatus = {
    ...data,
    status: computeStatus(data.quantity, data.low_stock_threshold)
  }

  await logAction(req.user.id, req.user.username, 'UPDATE_ITEM', data.id, data.name, {
    before: { quantity: prev.quantity, price: prev.price },
    after: { quantity: data.quantity, price: data.price }
  }, orgId)

  // An edit that moves the quantity is a stock movement. The caller may name
  // the reason via movement_type; otherwise the direction of the change decides.
  await recordQuantityChange({
    organizationId: orgId,
    item: data,
    quantityBefore: prev.quantity,
    quantityAfter: data.quantity,
    movementType: req.body.movement_type || null,
    reason: req.body.movement_reason || 'Quantity edited',
    referenceType: 'manual',
    userId: req.user.id,
    username: req.user.username,
  })

  // Only on the crossing, not on every save while already low, so an admin
  // editing a low item repeatedly does not raise repeated orders.
  if (prevStatus === 'In Stock' && itemWithStatus.status !== 'In Stock') {
    try {
      await sendLowStockAlert([itemWithStatus])
    } catch (emailErr) {
      console.error('Low stock alert failed after updating item:', emailErr.message)
    }
    await triggerReorderIfLow(orgId, [data])
  }

  res.json(itemWithStatus)
}))

// DELETE /api/items/:id — delete item (admin only) within the caller's org
router.delete('/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params
  const orgId = req.user.organization_id

  const { data: item, error: fetchError } = await supabase
    .from('techit_items')
    .select('name')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (fetchError || !item) {
    return res.status(404).json({ error: 'Item not found' })
  }

  const { error } = await supabase
    .from('techit_items')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) throw error

  await logAction(req.user.id, req.user.username, 'DELETE_ITEM', id, item.name, null, orgId)

  res.json({ ok: true })
}))

module.exports = router
