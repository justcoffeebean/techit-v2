const supabase = require('./supabase')

const MOVEMENT_TYPES = ['received', 'sold', 'damaged', 'returned', 'adjusted']

// Types that add stock. Everything else removes it. Used to infer a sign when
// a caller supplies a bare magnitude.
const INBOUND_TYPES = ['received', 'returned']

/**
 * Infer the movement type from a manual quantity edit, when the caller has
 * not said why the level changed. An increase reads as stock received and a
 * decrease as an adjustment, which is the conservative reading: it avoids
 * claiming a sale that may not have happened.
 */
function inferType(delta) {
  return delta > 0 ? 'received' : 'adjusted'
}

/**
 * Normalise a change into a signed integer. Inbound types are positive and
 * outbound negative regardless of the sign the caller passed, so a caller
 * cannot record 'sold' as an increase by sending a positive number.
 */
function signedChange(type, magnitude) {
  const size = Math.abs(parseInt(magnitude) || 0)
  return INBOUND_TYPES.includes(type) ? size : -size
}

/**
 * Record one movement. Never throws into the caller's path: a failure to
 * write history should not roll back a stock change that already happened,
 * so errors are logged and swallowed.
 */
async function recordMovement({
  organizationId,
  item,
  movementType,
  quantityChange,
  quantityBefore,
  quantityAfter,
  reason = '',
  referenceType = 'manual',
  referenceId = null,
  userId = null,
  username = '',
}) {
  try {
    if (!MOVEMENT_TYPES.includes(movementType)) {
      throw new Error(`Unknown movement type: ${movementType}`)
    }
    if (!quantityChange) return null

    const { data, error } = await supabase
      .from('techit_stock_movements')
      .insert({
        organization_id: organizationId,
        item_id: item.id,
        item_name: item.name,
        sku: item.sku,
        movement_type: movementType,
        quantity_change: quantityChange,
        quantity_before: quantityBefore,
        quantity_after: quantityAfter,
        reason,
        reference_type: referenceType,
        reference_id: referenceId,
        created_by: userId,
        created_by_username: username,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (err) {
    console.error('Stock movement insert failed:', err.message)
    return null
  }
}

/**
 * Record the movement implied by an item update, if the quantity moved.
 * `movementType` is optional: without it the direction of the change decides.
 */
async function recordQuantityChange({
  organizationId,
  item,
  quantityBefore,
  quantityAfter,
  movementType = null,
  reason = '',
  referenceType = 'manual',
  referenceId = null,
  userId = null,
  username = '',
}) {
  const before = parseInt(quantityBefore) || 0
  const after = parseInt(quantityAfter) || 0
  const delta = after - before

  if (delta === 0) return null

  return recordMovement({
    organizationId,
    item,
    movementType: movementType || inferType(delta),
    quantityChange: delta,
    quantityBefore: before,
    quantityAfter: after,
    reason,
    referenceType,
    referenceId,
    userId,
    username,
  })
}

module.exports = {
  MOVEMENT_TYPES,
  INBOUND_TYPES,
  inferType,
  signedChange,
  recordMovement,
  recordQuantityChange,
}
