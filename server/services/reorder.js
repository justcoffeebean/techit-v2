const supabase = require('./supabase')
const { computeStatus } = require('../utils/computeStatus')
const { createPurchaseOrdersForLowStock } = require('./purchaseOrders')

/**
 * Raise purchase orders when a stock change has pushed items to or below
 * their reorder threshold.
 *
 * Called after the stock change has already been persisted, and never throws:
 * a reordering failure must not undo the movement that triggered it.
 */
async function triggerReorderIfLow(organizationId, items) {
  try {
    const low = (items || []).filter(item => {
      if (!item) return false
      const status = computeStatus(item.quantity, item.low_stock_threshold)
      return status !== 'In Stock'
    })

    if (low.length === 0) return []

    const { data: org } = await supabase
      .from('techit_organizations')
      .select('name')
      .eq('id', organizationId)
      .single()

    return await createPurchaseOrdersForLowStock({
      organizationId,
      organizationName: org?.name || 'TechIT',
      items: low,
      createdVia: 'auto',
      username: 'system',
    })
  } catch (err) {
    console.error('Automatic reorder check failed:', err.message)
    return []
  }
}

module.exports = { triggerReorderIfLow }
