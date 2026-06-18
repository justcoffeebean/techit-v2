/**
 * Wraps an async Express route handler to catch errors and send
 * a consistent 500 JSON response. Logs the real error server-side
 * but returns a generic message to the client (security best practice).
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(err => {
      console.error(`${req.method} ${req.originalUrl} error:`, err.message)
      res.status(500).json({ error: 'Internal server error' })
    })
  }
}

module.exports = { asyncHandler }
