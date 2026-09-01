const supabase = require('./supabase')
const { buildPurchaseOrderPdf } = require('./purchaseOrderPdf')
const { sendPurchaseOrderEmail } = require('./email')

// Statuses that still count as outstanding. An item with a line on one of
// these has already been ordered and must not be ordered again.
const OPEN_STATUSES = ['open', 'sent']

/**
 * How many units to order. Brings stock up to twice the threshold, so the
 * item clears its reorder point with headroom rather than landing exactly on
 * it and re-triggering on the next sale. Always at least one unit.
 */
function reorderQuantity(item) {
  const threshold = parseInt(item.low_stock_threshold) || 10
  const onHand = parseInt(item.quantity) || 0
  return Math.max(1, (threshold * 2) - onHand)
}

/** Next PO reference for an org, e.g. PO-000042. */
async function nextReference(organizationId) {
  const { count, error } = await supabase
    .from('techit_purchase_orders')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', organizationId)

  if (error) throw error
  return `PO-${String((count || 0) + 1).padStart(6, '0')}`
}

/**
 * Filter a candidate list down to items with no outstanding order.
 * One query for all candidates rather than one per item.
 */
async function withoutOpenOrders(organizationId, items) {
  if (items.length === 0) return []

  const { data: openOrders, error: orderError } = await supabase
    .from('techit_purchase_orders')
    .select('id')
    .eq('organization_id', organizationId)
    .in('status', OPEN_STATUSES)

  if (orderError) throw orderError
  if (!openOrders || openOrders.length === 0) return items

  const { data: lines, error: lineError } = await supabase
    .from('techit_purchase_order_lines')
    .select('item_id')
    .in('purchase_order_id', openOrders.map(o => o.id))

  if (lineError) throw lineError

  const alreadyOrdered = new Set((lines || []).map(l => l.item_id).filter(Boolean))
  return items.filter(item => !alreadyOrdered.has(item.id))
}

/** Resolve a supplier's email from the suppliers table, if one is recorded. */
async function supplierEmails(organizationId, names) {
  if (names.length === 0) return {}

  const { data, error } = await supabase
    .from('techit_suppliers')
    .select('name, email')
    .eq('organization_id', organizationId)
    .in('name', names)

  if (error) {
    console.error('Supplier lookup failed:', error.message)
    return {}
  }

  const map = {}
  ;(data || []).forEach(s => { map[s.name] = s.email })
  return map
}

/**
 * Raise purchase orders for a set of low-stock items.
 *
 * Items are grouped by supplier so one supplier receives a single order
 * covering everything newly low, and any item that already sits on an
 * outstanding order is skipped.
 *
 * Returns the orders created. Never throws: a failure here must not roll back
 * the stock change that triggered it.
 */
async function createPurchaseOrdersForLowStock({
  organizationId,
  organizationName = 'TechIT',
  items,
  createdVia = 'auto',
  username = 'system',
}) {
  try {
    const candidates = (items || []).filter(i => i && i.id)
    if (candidates.length === 0) return []

    const eligible = await withoutOpenOrders(organizationId, candidates)
    if (eligible.length === 0) return []

    // Group by supplier. Items with no supplier recorded are grouped under a
    // placeholder so the order still exists for an admin to act on.
    const bySupplier = {}
    eligible.forEach(item => {
      const supplier = (item.supplier || '').trim() || 'Unassigned supplier'
      if (!bySupplier[supplier]) bySupplier[supplier] = []
      bySupplier[supplier].push(item)
    })

    const emailMap = await supplierEmails(organizationId, Object.keys(bySupplier))
    const created = []

    for (const [supplierName, supplierItems] of Object.entries(bySupplier)) {
      const reference = await nextReference(organizationId)

      const lines = supplierItems.map(item => {
        const qty = reorderQuantity(item)
        const unitCost = parseFloat(item.cost_price) || 0
        return {
          item_id: item.id,
          item_name: item.name,
          sku: item.sku,
          quantity_ordered: qty,
          unit_cost: unitCost,
          line_total: Number((qty * unitCost).toFixed(2)),
          quantity_at_order: item.quantity || 0,
          threshold_at_order: item.low_stock_threshold || 10,
        }
      })

      const total = Number(lines.reduce((sum, l) => sum + l.line_total, 0).toFixed(2))

      const { data: order, error: orderError } = await supabase
        .from('techit_purchase_orders')
        .insert({
          organization_id: organizationId,
          reference,
          supplier_name: supplierName,
          supplier_email: emailMap[supplierName] || '',
          status: 'open',
          total_cost: total,
          created_via: createdVia,
          created_by_username: username,
        })
        .select()
        .single()

      if (orderError) {
        console.error('Purchase order insert failed:', orderError.message)
        continue
      }

      const { error: lineError } = await supabase
        .from('techit_purchase_order_lines')
        .insert(lines.map(l => ({ ...l, purchase_order_id: order.id })))

      if (lineError) {
        console.error('Purchase order lines insert failed:', lineError.message)
        // An order with no lines is meaningless, so remove it rather than
        // leaving a hollow record behind.
        await supabase.from('techit_purchase_orders').delete().eq('id', order.id)
        continue
      }

      await emailPurchaseOrder({ order, lines, organizationName })
      created.push({ ...order, lines })
    }

    return created
  } catch (err) {
    console.error('createPurchaseOrdersForLowStock failed:', err.message)
    return []
  }
}

/**
 * Render the PDF and email it to the supplier, recording the outcome on the
 * order so an admin can see what did or did not reach the supplier.
 */
async function emailPurchaseOrder({ order, lines, organizationName }) {
  if (!order.supplier_email) {
    await supabase
      .from('techit_purchase_orders')
      .update({ email_error: 'No supplier email on file' })
      .eq('id', order.id)
    return false
  }

  try {
    const pdf = await buildPurchaseOrderPdf({ order, lines, organizationName })

    await sendPurchaseOrderEmail({
      to: order.supplier_email,
      reference: order.reference,
      supplierName: order.supplier_name,
      organizationName,
      lineCount: lines.length,
      total: order.total_cost,
      pdfBuffer: pdf,
    })

    await supabase
      .from('techit_purchase_orders')
      .update({ status: 'sent', emailed_at: new Date().toISOString(), email_error: null })
      .eq('id', order.id)

    return true
  } catch (err) {
    console.error(`Purchase order ${order.reference} email failed:`, err.message)
    await supabase
      .from('techit_purchase_orders')
      .update({ email_error: err.message.slice(0, 500) })
      .eq('id', order.id)
    return false
  }
}

module.exports = {
  OPEN_STATUSES,
  reorderQuantity,
  nextReference,
  withoutOpenOrders,
  createPurchaseOrdersForLowStock,
  emailPurchaseOrder,
}
