/**
 * Financial derivations for sales rows.
 * Single place where revenue, COGS, profit and margin are computed, so the
 * list, metrics and export endpoints can never drift from each other.
 *
 * Money is kept as plain numbers here; callers round with .toFixed(2)
 * only at the response edge.
 */

function toNumber(value) {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/** Revenue for one sale: quantity × unit price. */
function saleRevenue(sale) {
  return toNumber(sale.quantity) * toNumber(sale.unit_price)
}

/** Cost of goods sold for one sale: quantity × the cost snapshotted at sale time. */
function saleCogs(sale) {
  return toNumber(sale.quantity) * toNumber(sale.unit_cost)
}

/** Gross profit for one sale. */
function saleProfit(sale) {
  return saleRevenue(sale) - saleCogs(sale)
}

/** Gross margin as a percentage. Zero revenue yields 0 rather than NaN/Infinity. */
function marginPct(revenue, grossProfit) {
  const rev = toNumber(revenue)
  if (rev === 0) return 0
  return (toNumber(grossProfit) / rev) * 100
}

/**
 * Aggregate a list of sales into headline figures.
 * `order_count` counts sale rows; `units` counts items moved.
 */
function summarise(sales) {
  const list = sales || []

  let revenue = 0
  let cogs = 0
  let units = 0

  list.forEach(sale => {
    revenue += saleRevenue(sale)
    cogs += saleCogs(sale)
    units += toNumber(sale.quantity)
  })

  const gross_profit = revenue - cogs

  return {
    revenue,
    cogs,
    gross_profit,
    margin_pct: marginPct(revenue, gross_profit),
    units,
    order_count: list.length,
  }
}

/** Attach derived revenue/cogs/profit to a sale row for list and export responses. */
function withDerived(sale) {
  return {
    ...sale,
    revenue: saleRevenue(sale),
    cogs: saleCogs(sale),
    profit: saleProfit(sale),
  }
}

module.exports = {
  saleRevenue,
  saleCogs,
  saleProfit,
  marginPct,
  summarise,
  withDerived,
}
