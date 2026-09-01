const express = require('express')
const router = express.Router()
const supabase = require('../services/supabase')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const { logAction } = require('../services/audit')
const { asyncHandler } = require('../utils/asyncHandler')
const { parsePagination, buildPagination } = require('../utils/pagination')

// GET /api/expenses — paginated expenses for the caller's org
router.get('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id
  const { from, to } = req.query
  const { page, limit, offset } = parsePagination(req.query)

  let query = supabase
    .from('techit_expenses')
    .select('*', { count: 'exact' })
    .eq('organization_id', orgId)

  if (from) query = query.gte('incurred_on', from)
  if (to) query = query.lte('incurred_on', to)

  const { data, error, count } = await query
    .order('incurred_on', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error

  res.json({
    items: data || [],
    pagination: buildPagination(page, limit, count),
  })
}))

// POST /api/expenses — record an expense
router.post('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { description, category, amount, incurred_on } = req.body
  const orgId = req.user.organization_id

  const value = parseFloat(amount)

  if (!description) {
    return res.status(400).json({ error: 'Description is required' })
  }
  if (!Number.isFinite(value) || value < 0) {
    return res.status(400).json({ error: 'Amount must be zero or greater' })
  }

  const { data, error } = await supabase
    .from('techit_expenses')
    .insert({
      organization_id: orgId,
      description,
      category: category || 'General',
      amount: value,
      incurred_on: incurred_on || new Date().toISOString().slice(0, 10),
      created_by_username: req.user.username,
    })
    .select()
    .single()

  if (error) throw error

  await logAction(req.user.id, req.user.username, 'ADD_EXPENSE', data.id, data.description, {
    amount: data.amount,
    category: data.category,
  }, orgId)

  res.status(201).json(data)
}))

// DELETE /api/expenses/:id — remove an expense
router.delete('/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params
  const orgId = req.user.organization_id

  const { data: expense, error: fetchError } = await supabase
    .from('techit_expenses')
    .select('description')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (fetchError || !expense) {
    return res.status(404).json({ error: 'Expense not found' })
  }

  const { error } = await supabase
    .from('techit_expenses')
    .delete()
    .eq('id', id)
    .eq('organization_id', orgId)

  if (error) throw error

  await logAction(req.user.id, req.user.username, 'DELETE_EXPENSE', id, expense.description, null, orgId)

  res.json({ ok: true })
}))

module.exports = router
