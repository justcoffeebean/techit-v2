const express = require('express')
const router = express.Router()
const supabase = require('../services/supabase')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const { logAction } = require('../services/audit')
const { sendLowStockAlert } = require('../services/email')
const { Parser } = require('json2csv')
const { computeStatus } = require('../utils/computeStatus')
const { asyncHandler } = require('../utils/asyncHandler')
const { parsePagination, buildPagination } = require('../utils/pagination')
const { summarise, saleRevenue, saleProfit, withDerived } = require('../utils/salesMath')
const { recordMovement } = require('../services/movements')
const { triggerReorderIfLow } = require('../services/reorder')

const DEFAULT_RANGE_DAYS = 30
const TOP_PRODUCT_COUNT = 10

/**
 * Resolve the ?from / ?to query into ISO day boundaries, defaulting to the
 * last 30 days. `to` is inclusive of the whole day.
 */
function resolveRange({ from, to } = {}) {
  const end = to ? new Date(`${to}T23:59:59.999Z`) : new Date()
  const start = from
    ? new Date(`${from}T00:00:00.000Z`)
    : new Date(end.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000)

  const validEnd = isNaN(end.getTime()) ? new Date() : end
  const validStart = isNaN(start.getTime())
    ? new Date(validEnd.getTime() - DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000)
    : start

  return { start: validStart.toISOString(), end: validEnd.toISOString() }
}

/** YYYY-MM-DD key for daily bucketing. */
function dayKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10)
}

/** Fetch every sale for an org within a range, ordered oldest first. */
async function fetchSalesInRange(orgId, start, end) {
  const { data, error } = await supabase
    .from('techit_sales')
    .select('*')
    .eq('organization_id', orgId)
    .gte('sold_at', start)
    .lte('sold_at', end)
    .order('sold_at', { ascending: true })

  if (error) throw error
  return data || []
}

// GET /api/sales — paginated sales list for the caller's org
router.get('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { keyword, category, from, to } = req.query
  const orgId = req.user.organization_id
  const { page, limit, offset } = parsePagination(req.query)
  const { start, end } = resolveRange({ from, to })

  let query = supabase
    .from('techit_sales')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId)
    .gte('sold_at', start)
    .lte('sold_at', end)

  if (category && category !== 'all') {
    query = query.eq('category', category)
  }

  if (keyword) {
    const sanitizedKeyword = keyword.replace(/[,()]/g, '')
    query = query.or(`item_name.ilike.%${sanitizedKeyword}%,sku.ilike.%${sanitizedKeyword}%,customer.ilike.%${sanitizedKeyword}%`)
  }

  const { data, error, count } = await query
    .order('sold_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  res.json({
    items: (data || []).map(withDerived),
    pagination: buildPagination(page, limit, count),
  })
}))

// GET /api/sales/metrics — sales analytics + P&L for the caller's org
router.get('/metrics', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const { start, end } = resolveRange(req.query)

  const sales = await fetchSalesInRange(orgId, start, end)

  // Operating expenses in the same window
  const { data: expenseRows, error: expenseError } = await supabase
    .from('techit_expenses')
    .select('amount')
    .eq('organization_id', orgId)
    .gte('incurred_on', start.slice(0, 10))
    .lte('incurred_on', end.slice(0, 10))

  if (expenseError) throw expenseError

  // Inventory still on hand, valued at cost
  const { data: itemRows, error: itemError } = await supabase
    .from('techit_items')
    .select('quantity,cost_price')
    .eq('organization_id', orgId)

  if (itemError) throw itemError

  const totals = summarise(sales)
  const expenses = (expenseRows || []).reduce((sum, e) => sum + parseFloat(e.amount || 0), 0)
  const net_profit = totals.gross_profit - expenses
  const inventory_value = (itemRows || [])
    .reduce((sum, i) => sum + (parseFloat(i.cost_price || 0) * (i.quantity || 0)), 0)

  // Daily series — every day in range gets a row so the chart has no gaps
  const dayTotals = {}
  sales.forEach(sale => {
    const key = dayKey(sale.sold_at)
    if (!dayTotals[key]) dayTotals[key] = { revenue: 0, profit: 0 }
    dayTotals[key].revenue += saleRevenue(sale)
    dayTotals[key].profit += saleProfit(sale)
  })

  const by_day = []
  const cursor = new Date(`${start.slice(0, 10)}T00:00:00.000Z`)
  const lastDay = end.slice(0, 10)
  while (cursor.toISOString().slice(0, 10) <= lastDay) {
    const key = cursor.toISOString().slice(0, 10)
    const bucket = dayTotals[key] || { revenue: 0, profit: 0 }
    by_day.push({
      date: key,
      revenue: Number(bucket.revenue.toFixed(2)),
      profit: Number(bucket.profit.toFixed(2)),
    })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  // Per-category and per-product rollups
  const categoryTotals = {}
  const productTotals = {}

  sales.forEach(sale => {
    const revenue = saleRevenue(sale)
    const profit = saleProfit(sale)

    if (!categoryTotals[sale.category]) {
      categoryTotals[sale.category] = { name: sale.category, revenue: 0, profit: 0, units: 0 }
    }
    categoryTotals[sale.category].revenue += revenue
    categoryTotals[sale.category].profit += profit
    categoryTotals[sale.category].units += sale.quantity

    if (!productTotals[sale.sku]) {
      productTotals[sale.sku] = { name: sale.item_name, sku: sale.sku, revenue: 0, profit: 0, units: 0 }
    }
    productTotals[sale.sku].revenue += revenue
    productTotals[sale.sku].profit += profit
    productTotals[sale.sku].units += sale.quantity
  })

  const round2 = (row) => ({
    ...row,
    revenue: Number(row.revenue.toFixed(2)),
    profit: Number(row.profit.toFixed(2)),
  })

  res.json({
    from: start.slice(0, 10),
    to: end.slice(0, 10),
    revenue: totals.revenue.toFixed(2),
    cogs: totals.cogs.toFixed(2),
    gross_profit: totals.gross_profit.toFixed(2),
    margin_pct: Number(totals.margin_pct.toFixed(1)),
    expenses: expenses.toFixed(2),
    net_profit: net_profit.toFixed(2),
    units_sold: totals.units,
    order_count: totals.order_count,
    avg_order_value: (totals.order_count ? totals.revenue / totals.order_count : 0).toFixed(2),
    inventory_value: inventory_value.toFixed(2),
    by_day,
    by_category: Object.values(categoryTotals).map(round2).sort((a, b) => b.revenue - a.revenue),
    top_products: Object.values(productTotals)
      .map(round2)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, TOP_PRODUCT_COUNT),
  })
}))

// GET /api/sales/export — CSV of sales in range
router.get('/export', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const { start, end } = resolveRange(req.query)

  const sales = await fetchSalesInRange(orgId, start, end)

  const rows = sales.map(sale => {
    const derived = withDerived(sale)
    return {
      sold_at: derived.sold_at,
      item_name: derived.item_name,
      sku: derived.sku,
      category: derived.category,
      quantity: derived.quantity,
      unit_price: derived.unit_price,
      unit_cost: derived.unit_cost,
      revenue: derived.revenue.toFixed(2),
      cogs: derived.cogs.toFixed(2),
      profit: derived.profit.toFixed(2),
      customer: derived.customer,
      sold_by_username: derived.sold_by_username,
    }
  })

  const parser = new Parser({
    fields: ['sold_at', 'item_name', 'sku', 'category', 'quantity', 'unit_price',
      'unit_cost', 'revenue', 'cogs', 'profit', 'customer', 'sold_by_username'],
  })

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=techit-sales.csv')
  res.send(parser.parse(rows))
}))

// POST /api/sales — record a sale, decrementing stock atomically
router.post('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { item_id, quantity, unit_price, customer } = req.body
  const orgId = req.user.organization_id

  const qty = parseInt(quantity)
  const price = parseFloat(unit_price)

  if (!item_id) {
    return res.status(400).json({ error: 'An item is required' })
  }
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive number' })
  }
  if (!Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: 'Unit price must be zero or greater' })
  }

  // The insert and the stock decrement happen inside one Postgres transaction
  // with a row lock, so concurrent sales cannot oversell the same item.
  const { data, error } = await supabase.rpc('techit_record_sale', {
    p_org: orgId,
    p_item: item_id,
    p_qty: qty,
    p_unit_price: price,
    p_customer: customer || '',
    p_user: req.user.id,
    p_username: req.user.username,
  })

  if (error) {
    if (error.message && error.message.includes('ITEM_NOT_FOUND')) {
      return res.status(404).json({ error: 'Item not found' })
    }
    if (error.message && error.message.includes('INSUFFICIENT_STOCK')) {
      return res.status(400).json({ error: 'Not enough stock on hand to complete this sale' })
    }
    throw error
  }

  const sale = Array.isArray(data) ? data[0] : data

  await logAction(req.user.id, req.user.username, 'RECORD_SALE', sale.item_id, sale.item_name, {
    quantity: sale.quantity,
    unit_price: sale.unit_price,
  }, orgId)

  // The sale may have pushed the item below its threshold
  const { data: item } = await supabase
    .from('techit_items')
    .select('*')
    .eq('id', item_id)
    .eq('organization_id', orgId)
    .single()

  if (item) {
    // The RPC already decremented the stock, so the level before the sale is
    // the current level plus what was sold.
    await recordMovement({
      organizationId: orgId,
      item,
      movementType: 'sold',
      quantityChange: -qty,
      quantityBefore: item.quantity + qty,
      quantityAfter: item.quantity,
      reason: customer ? `Sold to ${customer}` : 'Sale',
      referenceType: 'sale',
      referenceId: sale.id,
      userId: req.user.id,
      username: req.user.username,
    })

    const status = computeStatus(item.quantity, item.low_stock_threshold)
    if (status !== 'In Stock') {
      try {
        await sendLowStockAlert([{ ...item, status }])
      } catch (emailErr) {
        console.error('Low stock alert failed after recording sale:', emailErr.message)
      }
      await triggerReorderIfLow(orgId, [item])
    }
  }

  res.status(201).json(withDerived(sale))
}))

module.exports = router
