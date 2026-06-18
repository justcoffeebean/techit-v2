/**
 * Compute stock status from quantity and threshold.
 * Used across all item endpoints to derive status in the application layer.
 */
function computeStatus(quantity, threshold) {
  if (quantity === 0) return 'Out of Stock'
  if (quantity <= threshold) return 'Low Stock'
  return 'In Stock'
}

/**
 * Map raw Supabase item rows to include a computed `status` field.
 */
function mapItemsWithStatus(items) {
  return items.map(item => ({
    ...item,
    status: computeStatus(item.quantity, item.low_stock_threshold)
  }))
}

module.exports = { computeStatus, mapItemsWithStatus }
