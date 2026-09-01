const express = require('express')
const router = express.Router()
const supabase = require('../services/supabase')
const { authMiddleware, adminMiddleware } = require('../middleware/auth')
const { createInvitation, findValidInvitation, markRedeemed } = require('../services/invitations')
const { sendInvitationEmail } = require('../services/email')
const { logAction } = require('../services/audit')
const { asyncHandler } = require('../utils/asyncHandler')

/**
 * Build the frontend accept URL. Prefers CLIENT_URL, falls back to the
 * request origin so local development works without extra configuration.
 */
function buildAcceptUrl(req, token) {
  const base =
    (process.env.CLIENT_URL && process.env.CLIENT_URL.replace(/\/$/, '')) ||
    (req.headers.origin && req.headers.origin.replace(/\/$/, '')) ||
    'https://techit-v2.vercel.app'

  return `${base}/register?invite=${encodeURIComponent(token)}`
}

// GET /api/invitations/validate?token=... — public, used by /register to
// pre-fill the email and show the org name. Declared before '/:id' routes.
router.get('/validate', asyncHandler(async (req, res) => {
  const { token } = req.query
  if (!token) return res.status(400).json({ error: 'Token is required' })

  const invite = await findValidInvitation(token)
  if (!invite) {
    return res.status(404).json({ valid: false, error: 'Invitation is invalid or expired' })
  }

  const { data: org, error: orgErr } = await supabase
    .from('techit_organizations')
    .select('name')
    .eq('id', invite.organization_id)
    .single()

  if (orgErr) throw orgErr

  res.json({
    valid: true,
    email: invite.email,
    role: invite.role,
    organization_name: org.name,
  })
}))

// POST /api/invitations/redeem — called after the invitee signs in. Moves the
// authenticated user into the inviting org at the invited role.
router.post('/redeem', authMiddleware, asyncHandler(async (req, res) => {
  const { token } = req.body
  if (!token) return res.status(400).json({ error: 'Token is required' })

  const invite = await findValidInvitation(token)
  if (!invite) return res.status(404).json({ error: 'Invitation is invalid or expired' })

  // Only the invited address may redeem, so a leaked link cannot move an
  // unrelated account into someone else's organization.
  const { data: currentUser, error: userFetchErr } = await supabase
    .from('techit_users')
    .select('email')
    .eq('id', req.user.id)
    .single()

  if (userFetchErr || !currentUser) {
    return res.status(404).json({ error: 'User not found' })
  }

  if (currentUser.email.toLowerCase() !== invite.email.toLowerCase()) {
    return res.status(403).json({ error: 'This invitation was issued to a different email address' })
  }

  const { error: userErr } = await supabase
    .from('techit_users')
    .update({
      organization_id: invite.organization_id,
      role: invite.role,
    })
    .eq('id', req.user.id)

  if (userErr) throw userErr

  await markRedeemed(invite.id)

  res.json({
    ok: true,
    organization_id: invite.organization_id,
    role: invite.role,
  })
}))

// GET /api/invitations — list this org's invitations (admin only)
router.get('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const orgId = req.user.organization_id

  const { data, error } = await supabase
    .from('techit_invitations')
    .select('id, email, role, status, expires_at, created_at, redeemed_at')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })

  if (error) throw error
  res.json(data || [])
}))

// POST /api/invitations — create an invitation and email it (admin only)
router.post('/', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { email, role } = req.body
  const orgId = req.user.organization_id

  if (!email) return res.status(400).json({ error: 'Email is required' })
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' })
  }
  if (role && !['admin', 'user'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or user' })
  }

  // Reject invites for someone who already has an account in this org
  const { data: existingUser } = await supabase
    .from('techit_users')
    .select('id')
    .eq('organization_id', orgId)
    .ilike('email', email)
    .maybeSingle()

  if (existingUser) {
    return res.status(400).json({ error: 'That person is already a member of this organization' })
  }

  const { data: org, error: orgErr } = await supabase
    .from('techit_organizations')
    .select('name')
    .eq('id', orgId)
    .single()

  if (orgErr) throw orgErr

  const invite = await createInvitation({
    organizationId: orgId,
    email,
    role: role || 'user',
    invitedBy: req.user.id,
  })

  const acceptUrl = buildAcceptUrl(req, invite.token)

  // Best effort: an unconfigured mailer should not fail the request, since
  // the admin can still copy the returned accept_url.
  let emailed = true
  try {
    await sendInvitationEmail({
      to: invite.email,
      organizationName: org.name,
      role: invite.role,
      acceptUrl,
      inviterName: req.user.username,
    })
  } catch (emailErr) {
    emailed = false
    console.error('Invitation email failed:', emailErr.message)
  }

  await logAction(req.user.id, req.user.username, 'INVITE_USER', invite.id, invite.email, {
    role: invite.role,
  }, orgId)

  res.status(201).json({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    status: invite.status,
    expires_at: invite.expires_at,
    emailed,
    accept_url: acceptUrl,
  })
}))

// DELETE /api/invitations/:id — revoke a pending invitation (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params
  const orgId = req.user.organization_id

  const { data: invite, error: fetchError } = await supabase
    .from('techit_invitations')
    .select('email, status')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (fetchError || !invite) {
    return res.status(404).json({ error: 'Invitation not found' })
  }

  if (invite.status !== 'pending') {
    return res.status(400).json({ error: 'Only pending invitations can be revoked' })
  }

  const { error } = await supabase
    .from('techit_invitations')
    .update({ status: 'revoked' })
    .eq('id', id)
    .eq('organization_id', orgId)
    .eq('status', 'pending')

  if (error) throw error

  res.json({ ok: true })
}))

module.exports = router
