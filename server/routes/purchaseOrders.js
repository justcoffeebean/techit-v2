const express = require('express')
const router = express.Router()
const supabase = require('../services/supabase')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const { asyncHandler } = require('../utils/asyncHandler')
const { parsePagination, buildPagination } = require('../utils/pagination')
const { logAction } = require('../services/audit')
const { buildPurchaseOrderPdf } = require('../services/purchaseOrderPdf')
const {
  createPurchaseOrdersForLowStock,
  emailPurchaseOrder,
} = require('../services/purchaseOrders')
const { recordMovement } = require('../services/movements')

/** Fetch an order plus its lines, scoped to the caller's org. */
async function loadOrder(orgId, id) {
  const { data: order, error } = await supabase
    .from('techit_purchase_orders')
    .select('*')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (error || !order) return null

  const { data: lines } = await supabase
    .from('techit_purchase_order_lines')
    .select('*')
    .eq('purchase_order_id', order.id)
    .order('created_at', { ascending: true })

  return { ...order, lines: lines || [] }
}

async function organizationName(orgId) {
  const { data } = await supabase
    .from('techit_organizations')
    .select('name')
    .eq('id', orgId)
    .single()
  return data?.name || 'TechIT'
}

// GET /api/purchase-orders — paginated list for the caller's org
router.get('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const { status, supplier } = req.query
  const { page, limit, offset } = parsePagination(req.query)

  let query = supabase
    .from('techit_purchase_orders')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId)

  if (status && status !== 'all') query = query.eq('status', status)
  if (supplier) query = query.ilike('supplier_name', `%${supplier.replace(/[,()]/g, '')}%`)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  // Attach a line count so the list can show order size without a second call
  const orders = data || []
  if (orders.length > 0) {
    const { data: lines } = await supabase
      .from('techit_purchase_order_lines')
      .select('purchase_order_id, quantity_ordered')
      .in('purchase_order_id', orders.map(o => o.id))

    const counts = {}
    ;(lines || []).forEach(l => {
      if (!counts[l.purchase_order_id]) counts[l.purchase_order_id] = { lines: 0, units: 0 }
      counts[l.purchase_order_id].lines += 1
      counts[l.purchase_order_id].units += l.quantity_ordered
    })

    orders.forEach(o => {
      o.line_count = counts[o.id]?.lines || 0
      o.unit_count = counts[o.id]?.units || 0
    })
  }

  res.json({
    items: orders,
    pagination: buildPagination(page, limit, count),
  })
}))

// GET /api/purchase-orders/:id — one order with its lines
router.get('/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const order = await loadOrder(req.user.organization_id, req.params.id)
  if (!order) return res.status(404).json({ error: 'Purchase order not found' })
  res.json(order)
}))

// GET /api/purchase-orders/:id/pdf — download the PDF
router.get('/:id/pdf', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const order = await loadOrder(orgId, req.params.id)
  if (!order) return res.status(404).json({ error: 'Purchase order not found' })

  const pdf = await buildPurchaseOrderPdf({
    order,
    lines: order.lines,
    organizationName: await organizationName(orgId),
  })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename=${order.reference}.pdf`)
  res.send(pdf)
}))

// POST /api/purchase-orders/generate — raise orders for everything currently
// below threshold, batched by supplier. Items already on an open order are
// skipped, so this is safe to run repeatedly.
router.post('/generate', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id

  const { data: items, error } = await supabase
    .from('techit_items')
    .select('*')
    .eq('organization_id', orgId)

  if (error) throw error

  const lowStock = (items || []).filter(
    i => (i.quantity || 0) <= (i.low_stock_threshold || 10)
  )

  if (lowStock.length === 0) {
    return res.json({ created: [], message: 'No items are below their reorder threshold' })
  }

  const created = await createPurchaseOrdersForLowStock({
    organizationId: orgId,
    organizationName: await organizationName(orgId),
    items: lowStock,
    createdVia: 'manual',
    username: req.user.username,
  })

  if (created.length > 0) {
    await logAction(req.user.id, req.user.username, 'GENERATE_PURCHASE_ORDERS', null, null, {
      order_count: created.length,
      references: created.map(o => o.reference),
    }, orgId)
  }

  res.status(created.length ? 201 : 200).json({
    created,
    message: created.length
      ? `Raised ${created.length} purchase order${created.length === 1 ? '' : 's'}`
      : 'Every low-stock item is already on an open order',
  })
}))

// POST /api/purchase-orders/:id/resend — retry the supplier email
router.post('/:id/resend', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const order = await loadOrder(orgId, req.params.id)
  if (!order) return res.status(404).json({ error: 'Purchase order not found' })

  if (!order.supplier_email) {
    return res.status(400).json({
      error: 'No email on file for this supplier. Add one under Suppliers first.',
    })
  }

  const sent = await emailPurchaseOrder({
    order,
    lines: order.lines,
    organizationName: await organizationName(orgId),
  })

  res.json({ ok: sent, emailed: sent })
}))

// POST /api/purchase-orders/:id/receive — mark delivered and add the stock.
// Each line becomes a 'received' movement, so the delivery shows up in item
// history alongside every other change.
router.post('/:id/receive', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const order = await loadOrder(orgId, req.params.id)
  if (!order) return res.status(404).json({ error: 'Purchase order not found' })

  if (order.status === 'received') {
    return res.status(400).json({ error: 'This order has already been received' })
  }
  if (order.status === 'cancelled') {
    return res.status(400).json({ error: 'This order was cancelled' })
  }

  for (const line of order.lines) {
    if (!line.item_id) continue

    const { data: item } = await supabase
      .from('techit_items')
      .select('*')
      .eq('id', line.item_id)
      .eq('organization_id', orgId)
      .single()

    if (!item) continue

    const before = item.quantity || 0
    const after = before + line.quantity_ordered

    const { error: updateError } = await supabase
      .from('techit_items')
      .update({ quantity: after, updated_at: new Date().toISOString() })
      .eq('id', item.id)
      .eq('organization_id', orgId)

    if (updateError) {
      console.error(`Receiving ${order.reference} failed for ${item.sku}:`, updateError.message)
      continue
    }

    await recordMovement({
      organizationId: orgId,
      item,
      movementType: 'received',
      quantityChange: line.quantity_ordered,
      quantityBefore: before,
      quantityAfter: after,
      reason: `Received against ${order.reference}`,
      referenceType: 'purchase_order',
      referenceId: order.id,
      userId: req.user.id,
      username: req.user.username,
    })
  }

  const { data: updated, error: statusError } = await supabase
    .from('techit_purchase_orders')
    .update({ status: 'received', received_at: new Date().toISOString() })
    .eq('id', order.id)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (statusError) throw statusError

  await logAction(req.user.id, req.user.username, 'RECEIVE_PURCHASE_ORDER', order.id, order.reference, {
    line_count: order.lines.length,
  }, orgId)

  res.json(updated)
}))

// POST /api/purchase-orders/:id/cancel — close an order without receiving it,
// which frees its items to be ordered again.
router.post('/:id/cancel', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const order = await loadOrder(orgId, req.params.id)
  if (!order) return res.status(404).json({ error: 'Purchase order not found' })

  if (order.status === 'received') {
    return res.status(400).json({ error: 'A received order cannot be cancelled' })
  }

  const { data: updated, error } = await supabase
    .from('techit_purchase_orders')
    .update({ status: 'cancelled' })
    .eq('id', order.id)
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) throw error

  await logAction(req.user.id, req.user.username, 'CANCEL_PURCHASE_ORDER', order.id, order.reference, null, orgId)

  res.json(updated)
}))

// --- Suppliers -------------------------------------------------------------
// Supplier contact details live here so purchase orders know where to go.

// GET /api/purchase-orders/suppliers/list
router.get('/suppliers/list', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('techit_suppliers')
    .select('*')
    .eq('organization_id', req.user.organization_id)
    .order('name', { ascending: true })

  if (error) throw error
  res.json(data || [])
}))

// PUT /api/purchase-orders/suppliers — upsert a supplier's email
router.put('/suppliers', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { name, email } = req.body
  const orgId = req.user.organization_id

  if (!name) return res.status(400).json({ error: 'Supplier name is required' })
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }

  const { data, error } = await supabase
    .from('techit_suppliers')
    .upsert(
      { organization_id: orgId, name, email: email || '' },
      { onConflict: 'organization_id,name' }
    )
    .select()
    .single()

  if (error) throw error
  res.json(data)
}))

module.exports = router
