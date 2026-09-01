/**
 * Chainable Supabase query-builder stand-in.
 *
 * The routes chain filters freely — .eq().or().order().range(), in varying
 * combinations — so a mock that hardcodes one shape breaks whenever a query
 * gains a clause. This returns a proxy where every builder method returns
 * itself and only the terminal call resolves, which keeps the tests coupled
 * to what a route *returns* rather than how it phrases its query.
 */

// Methods that continue the chain rather than resolving it
const CHAIN_METHODS = [
  'select', 'insert', 'update', 'upsert', 'delete',
  'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in', 'or', 'not',
  'order', 'range', 'limit',
]

/**
 * Build a thenable chain resolving to `result`.
 * `single`, `maybeSingle` and awaiting the chain all yield the same value,
 * so a route can terminate however it likes.
 */
function makeChain(result) {
  const resolved = Promise.resolve(result)

  const chain = {
    single: () => resolved,
    maybeSingle: () => resolved,
    then: (onFulfilled, onRejected) => resolved.then(onFulfilled, onRejected),
    catch: (onRejected) => resolved.catch(onRejected),
    finally: (onFinally) => resolved.finally(onFinally),
  }

  CHAIN_METHODS.forEach(method => {
    chain[method] = jest.fn(() => chain)
  })

  return chain
}

/**
 * A `from()` implementation resolving every table to the same result.
 * Use when a test only exercises one table.
 */
function mockTable(result) {
  return () => makeChain(result)
}

/**
 * A `from()` implementation dispatching per table name, so a route touching
 * several tables can be driven from one place.
 *
 *   mockTables({ techit_items: { data: [...], error: null } })
 *
 * A table with no entry resolves empty rather than throwing, since routes
 * commonly read a table only to enrich a response.
 */
function mockTables(byTable, fallback = { data: [], error: null, count: 0 }) {
  return (table) => makeChain(
    Object.prototype.hasOwnProperty.call(byTable, table) ? byTable[table] : fallback
  )
}

module.exports = { makeChain, mockTable, mockTables, CHAIN_METHODS }
