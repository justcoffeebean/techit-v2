const nodemailer = require('nodemailer')

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

let transporter = null

function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return null
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    })
  }

  return transporter
}

async function sendLowStockAlert(items) {
  if (!items || items.length === 0) return

  const mailer = getTransporter()
  if (!mailer) {
    console.warn('Email alerts skipped: EMAIL_USER or EMAIL_PASS not configured')
    return
  }

  if (!process.env.LOW_STOCK_EMAIL) {
    console.warn('Email alerts skipped: LOW_STOCK_EMAIL not configured')
    return
  }

  const itemList = items.map(item => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a;">${escapeHtml(item.name)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a;">${escapeHtml(item.sku)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a; color: ${item.quantity === 0 ? '#f87171' : '#fb923c'};">
        ${item.quantity} units
      </td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #2a2a2a;">${item.status}</td>
    </tr>
  `).join('')

  const html = `
    <div style="font-family: sans-serif; background: #0f0f0f; color: #fff; padding: 32px; border-radius: 12px;">
      <h2 style="color: #fb923c; margin-bottom: 8px;">⚠️ Low Stock Alert</h2>
      <p style="color: #888; margin-bottom: 24px;">The following items need your attention:</p>
      <table style="width: 100%; border-collapse: collapse; background: #1a1a1a; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #2a2a2a;">
            <th style="padding: 12px; text-align: left; color: #555;">Product</th>
            <th style="padding: 12px; text-align: left; color: #555;">SKU</th>
            <th style="padding: 12px; text-align: left; color: #555;">Quantity</th>
            <th style="padding: 12px; text-align: left; color: #555;">Status</th>
          </tr>
        </thead>
        <tbody>${itemList}</tbody>
      </table>
      <p style="color: #555; margin-top: 24px; font-size: 12px;">
        Sent by TechIT Inventory Management System
      </p>
    </div>
  `

  try {
    await mailer.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.LOW_STOCK_EMAIL,
      subject: `⚠️ TechIT: ${items.length} item(s) need restocking`,
      html,
    })
    console.log(`Low stock alert sent for ${items.length} items`)
  } catch (err) {
    console.error('Failed to send low stock alert:', err.message)
    throw err
  }
}


/**
 * Send a team invitation email. `acceptUrl` is the full frontend URL with the
 * token, e.g. https://techit-v2.vercel.app/register?invite=<token>.
 */
async function sendInvitationEmail({ to, organizationName, role, acceptUrl, inviterName }) {
  const mailer = getTransporter()
  if (!mailer) {
    console.warn('Invitation email skipped: EMAIL_USER or EMAIL_PASS not configured')
    throw new Error('Email transport not configured')
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; padding: 32px; border-radius: 12px; max-width: 560px;">
      <h2 style="color: #4ade80; margin-bottom: 8px;">You're invited to TechIT</h2>
      <p style="color: #888; margin-bottom: 24px; line-height: 1.6;">
        <strong style="color: #fff;">${escapeHtml(inviterName || 'An administrator')}</strong>
        has invited you to join <strong style="color: #fff;">${escapeHtml(organizationName)}</strong>
        on TechIT Inventory Management as a <strong style="color: #4ade80;">${escapeHtml(role)}</strong>.
      </p>

      <a href="${escapeHtml(acceptUrl)}" style="display: inline-block; background: #4ade80; color: #000; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 800; font-size: 15px;">
        Accept invitation
      </a>

      <p style="color: #555; margin-top: 32px; font-size: 13px;">
        Or paste this link into your browser:<br />
        <a href="${escapeHtml(acceptUrl)}" style="color: #4ade80; word-break: break-all;">${escapeHtml(acceptUrl)}</a>
      </p>

      <p style="color: #555; margin-top: 24px; font-size: 12px;">
        This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
      </p>

      <p style="color: #333; margin-top: 32px; font-size: 11px;">
        Sent by TechIT Inventory Management System
      </p>
    </div>
  `

  try {
    await mailer.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject: `${inviterName || 'Someone'} invited you to ${organizationName} on TechIT`,
      html,
    })
    console.log(`Invitation email sent to ${to}`)
  } catch (err) {
    console.error('Failed to send invitation email:', err.message)
    throw err
  }
}


/**
 * Email a purchase order to a supplier with the PDF attached.
 */
async function sendPurchaseOrderEmail({
  to, reference, supplierName, organizationName, lineCount, total, pdfBuffer,
}) {
  const mailer = getTransporter()
  if (!mailer) {
    console.warn('Purchase order email skipped: EMAIL_USER or EMAIL_PASS not configured')
    throw new Error('Email transport not configured')
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; padding: 32px; border-radius: 12px; max-width: 560px;">
      <h2 style="color: #4ade80; margin-bottom: 8px;">Purchase Order ${escapeHtml(reference)}</h2>
      <p style="color: #888; margin-bottom: 24px; line-height: 1.6;">
        Hello ${escapeHtml(supplierName)},<br /><br />
        Please find attached purchase order <strong style="color: #fff;">${escapeHtml(reference)}</strong>
        from <strong style="color: #fff;">${escapeHtml(organizationName)}</strong>,
        covering ${lineCount} item${lineCount === 1 ? '' : 's'}
        with a total of <strong style="color: #4ade80;">$${Number(total).toFixed(2)}</strong>.
      </p>
      <p style="color: #888; margin-bottom: 24px;">
        The full breakdown is in the attached PDF. Please confirm receipt and
        expected delivery at your earliest convenience.
      </p>
      <p style="color: #333; margin-top: 32px; font-size: 11px;">
        Sent by TechIT Inventory Management System
      </p>
    </div>
  `

  await mailer.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: `Purchase Order ${reference} from ${organizationName}`,
    html,
    attachments: [{
      filename: `${reference}.pdf`,
      content: pdfBuffer,
      contentType: 'application/pdf',
    }],
  })

  console.log(`Purchase order ${reference} emailed to ${to}`)
}


/**
 * Email a password reset link.
 *
 * The copy names the expiry and says what to do if the request was not
 * theirs, since an unexpected reset email is the first signal a user gets
 * that someone is trying to reach their account.
 */
async function sendPasswordResetEmail({ to, username, resetUrl, expiresInMinutes }) {
  const mailer = getTransporter()
  if (!mailer) {
    console.warn('Password reset email skipped: EMAIL_USER or EMAIL_PASS not configured')
    throw new Error('Email transport not configured')
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #fff; padding: 32px; border-radius: 12px; max-width: 560px;">
      <h2 style="color: #4ade80; margin-bottom: 8px;">Reset your password</h2>
      <p style="color: #888; margin-bottom: 24px; line-height: 1.6;">
        Hello ${escapeHtml(username || 'there')}, we received a request to reset
        the password on your TechIT account.
      </p>

      <a href="${escapeHtml(resetUrl)}" style="display: inline-block; background: #4ade80; color: #000; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 800; font-size: 15px;">
        Choose a new password
      </a>

      <p style="color: #555; margin-top: 32px; font-size: 13px;">
        Or paste this link into your browser:<br />
        <a href="${escapeHtml(resetUrl)}" style="color: #4ade80; word-break: break-all;">${escapeHtml(resetUrl)}</a>
      </p>

      <p style="color: #555; margin-top: 24px; font-size: 12px; line-height: 1.6;">
        This link expires in ${expiresInMinutes} minutes and can only be used once.
        If you did not ask to reset your password you can ignore this email —
        your password will not change until someone opens the link above.
      </p>

      <p style="color: #333; margin-top: 32px; font-size: 11px;">
        Sent by TechIT Inventory Management System
      </p>
    </div>
  `

  await mailer.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: 'Reset your TechIT password',
    html,
  })

  console.log(`Password reset email sent to ${to}`)
}

module.exports = {
  sendLowStockAlert,
  sendInvitationEmail,
  sendPurchaseOrderEmail,
  sendPasswordResetEmail,
}