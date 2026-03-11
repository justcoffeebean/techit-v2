const express = require('express')
const router = express.Router()
const supabase = require('../services/supabase')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const { logAction } = require('../services/audit')
const { sendLowStockAlert } = require('../services/email')
const { Parser } = require('json2csv')

// Helper to compute status from quantity and threshold
function computeStatus(quantity, threshold) {
  if (quantity === 0) return 'Out of Stock'
  if (quantity <= threshold) return 'Low Stock'
  return 'In Stock'
}

// GET /api/items — get all items with optional filters
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { keyword, category, status } = req.query

    let query = supabase.from('techit_items').select('*')

    if (category && category !== 'all') {
      query = query.eq('category', category)
    }

    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,sku.ilike.%${keyword}%,supplier.ilike.%${keyword}%`)
    }

    const { data, error } = await query.order('created_at', { ascending: false })
    if (error) throw error

    // Compute status in app
    let items = data.map(item => ({
      ...item,
      status: computeStatus(item.quantity, item.low_stock_threshold)
    }))

    // Filter by status after computing
    if (status && status !== 'all') {
      items = items.filter(i => i.status === status)
    }

    res.json(items)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/items/metrics — dashboard stats
router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase.from('techit_items').select('*')
    if (error) throw error

    const items = data.map(item => ({
      ...item,
      status: computeStatus(item.quantity, item.low_stock_threshold)
    }))

    const metrics = {
      total_items: items.length,
      low_stock: items.filter(i => i.status === 'Low Stock').length,
      out_of_stock: items.filter(i => i.status === 'Out of Stock').length,
      total_value: items.reduce((sum, i) => sum + (i.price * i.quantity), 0).toFixed(2),
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
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/items/export — export as CSV
router.get('/export', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('techit_items')
      .select('name,sku,category,quantity,price,location,supplier,created_at')
      .order('name')

    if (error) throw error

    const items = data.map(item => ({
      ...item,
      status: computeStatus(item.quantity, item.low_stock_threshold || 10)
    }))

    const parser = new Parser({
      fields: ['name', 'sku', 'category', 'quantity', 'price', 'status', 'location', 'supplier', 'created_at']
    })
    const csv = parser.parse(items)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename=techit-inventory.csv')
    res.send(csv)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/items — add item (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { name, sku, category, quantity, price, location, supplier, low_stock_threshold } = req.body

    if (!name || !sku || !category) {
      return res.status(400).json({ error: 'Name, SKU and category are required' })
    }

    const { data, error } = await supabase
      .from('techit_items')
      .insert({
        name, sku, category,
        quantity: quantity || 0,
        price: price || 0,
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

    await logAction(req.user.id, req.user.username, 'ADD_ITEM', data.id, data.name, { quantity, price })

    if (itemWithStatus.status !== 'In Stock') {
      await sendLowStockAlert([itemWithStatus]).catch(() => {})
    }

    res.status(201).json(itemWithStatus)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/items/:id — update item (admin only)
router.put('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params
    const { name, sku, category, quantity, price, location, supplier, low_stock_threshold } = req.body

    const { data: prev } = await supabase
      .from('techit_items')
      .select('*')
      .eq('id', id)
      .single()

    const prevStatus = prev ? computeStatus(prev.quantity, prev.low_stock_threshold) : 'In Stock'

    const { data, error } = await supabase
      .from('techit_items')
      .update({
        name, sku, category, quantity, price,
        location: location || '',
        supplier: supplier || '',
        low_stock_threshold: low_stock_threshold || 10,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    const itemWithStatus = {
      ...data,
      status: computeStatus(data.quantity, data.low_stock_threshold)
    }

    await logAction(req.user.id, req.user.username, 'UPDATE_ITEM', data.id, data.name, {
      before: { quantity: prev?.quantity, price: prev?.price },
      after: { quantity: data.quantity, price: data.price }
    })

    if (prevStatus === 'In Stock' && itemWithStatus.status !== 'In Stock') {
      await sendLowStockAlert([itemWithStatus]).catch(() => {})
    }

    res.json(itemWithStatus)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/items/:id — delete item (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const { id } = req.params

    const { data: item } = await supabase
      .from('techit_items')
      .select('name')
      .eq('id', id)
      .single()

    const { error } = await supabase
      .from('techit_items')
      .delete()
      .eq('id', id)

    if (error) throw error

    await logAction(req.user.id, req.user.username, 'DELETE_ITEM', id, item?.name, null)

    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router