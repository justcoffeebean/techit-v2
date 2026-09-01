/**
 * Shared pagination parsing for list endpoints.
 * Clamps the page to >= 1 and the limit to [1, MAX_LIMIT] so a caller
 * cannot ask for an unbounded result set.
 */

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

function parsePagination({ page, limit } = {}) {
  const pageNum = Math.max(1, parseInt(page) || 1)
  const requestedLimit = parseInt(limit) || DEFAULT_LIMIT
  const limitNum = Math.min(MAX_LIMIT, Math.max(1, requestedLimit))

  return {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum,
  }
}

/** Build the response envelope every paginated list endpoint returns. */
function buildPagination(page, limit, count) {
  const total = count || 0
  const totalPages = Math.ceil(total / limit)

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  }
}

module.exports = { DEFAULT_LIMIT, MAX_LIMIT, parsePagination, buildPagination }
