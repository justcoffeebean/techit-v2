const nodemailer = require('nodemailer')

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

async function sendLowStockAlert(items) {
  if (!items || items.length === 0) return

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

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: process.env.LOW_STOCK_EMAIL,
    subject: `⚠️ TechIT: ${items.length} item(s) need restocking`,
    html,
  })

  console.log(`Low stock alert sent for ${items.length} items`)
}

module.exports = { sendLowStockAlert }