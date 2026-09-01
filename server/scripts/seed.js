#!/usr/bin/env node
/**
 * Seed a demo organization exercising every feature.
 *
 * Creates one organization with its own users, catalogue, sales, expenses,
 * stock movements, an invitation and purchase orders, so the dashboard,
 * analytics, orders and history pages all have something real to show.
 *
 * Safety
 * ------
 * Everything is written under a single organization with a fixed slug, so
 * seeding cannot touch real tenants and `--reset` removes exactly what it
 * created. It refuses to run against production unless forced, and never
 * emails anyone: purchase orders are inserted directly rather than raised
 * through the service that would notify a supplier.
 *
 *   node scripts/seed.js            # create the demo org
 *   node scripts/seed.js --reset    # delete the demo org and everything in it
 */

require('dotenv').config()
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const supabase = require('../services/supabase')

const ORG_SLUG = 'demo-co'
const ORG_NAME = 'Demo Company'
const DEMO_PASSWORD = process.env.SEED_PASSWORD || 'demo1234'

const args = process.argv.slice(2)
const RESET = args.includes('--reset')
const FORCE = args.includes('--force')

function log(msg) { console.log(`  ${msg}`) }

function fail(msg) {
  console.error(`\n  ${msg}\n`)
  process.exit(1)
}

/** Deterministic pseudo-random, so repeated runs produce comparable data. */
let seedState = 42
function rand() {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296
  return seedState / 4294967296
}
function randInt(min, max) { return Math.floor(rand() * (max - min + 1)) + min }
function pick(list) { return list[Math.floor(rand() * list.length)] }

function daysAgo(n) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

const CATALOGUE = [
  { name: 'MacBook Pro 14-inch M3', sku: 'MBP-14-M3', category: 'Laptops', price: 2399, cost: 1800, supplier: 'Apple Inc.', location: 'Warehouse A', threshold: 5 },
  { name: 'MacBook Air 13-inch M3', sku: 'MBA-13-M3', category: 'Laptops', price: 1299, cost: 950, supplier: 'Apple Inc.', location: 'Warehouse A', threshold: 6 },
  { name: 'Dell XPS 15', sku: 'DEL-XPS-15', category: 'Laptops', price: 1899, cost: 1400, supplier: 'Dell Technologies', location: 'Warehouse A', threshold: 4 },
  { name: 'Studio Display 27-inch', sku: 'STD-27', category: 'Displays', price: 1599, cost: 1180, supplier: 'Apple Inc.', location: 'Warehouse B', threshold: 3 },
  { name: 'Dell UltraSharp 32', sku: 'DEL-U32', category: 'Displays', price: 899, cost: 640, supplier: 'Dell Technologies', location: 'Warehouse B', threshold: 4 },
  { name: 'MagSafe USB-C Adapter', sku: 'MAG-USBC', category: 'Accessories', price: 79, cost: 42, supplier: 'Apple Inc.', location: 'Shelf 1', threshold: 25 },
  { name: 'Thunderbolt 4 Dock', sku: 'TB4-DOCK', category: 'Accessories', price: 329, cost: 210, supplier: 'CalDigit', location: 'Shelf 1', threshold: 10 },
  { name: 'Magic Keyboard', sku: 'MAG-KEY', category: 'Accessories', price: 149, cost: 88, supplier: 'Apple Inc.', location: 'Shelf 2', threshold: 15 },
  { name: 'Logitech MX Master 3S', sku: 'LOG-MX3S', category: 'Accessories', price: 99, cost: 58, supplier: 'Logitech', location: 'Shelf 2', threshold: 20 },
  { name: 'USB-C Cable 2m', sku: 'CBL-USBC-2M', category: 'Accessories', price: 29, cost: 11, supplier: 'Anker', location: 'Shelf 3', threshold: 40 },
  { name: 'Cisco Catalyst Switch 24p', sku: 'CIS-CAT-24', category: 'Networking', price: 1249, cost: 890, supplier: 'Cisco Systems', location: 'Warehouse C', threshold: 3 },
  { name: 'Ubiquiti UniFi AP 6 Pro', sku: 'UBI-AP6-PRO', category: 'Networking', price: 189, cost: 132, supplier: 'Ubiquiti', location: 'Warehouse C', threshold: 8 },
  { name: 'Cat6 Patch Cable 3m', sku: 'CBL-CAT6-3M', category: 'Networking', price: 12, cost: 4, supplier: 'Anker', location: 'Shelf 3', threshold: 50 },
  { name: 'HP LaserJet Pro M404', sku: 'HP-LJ-M404', category: 'Printers', price: 349, cost: 240, supplier: 'HP Inc.', location: 'Warehouse B', threshold: 4 },
  { name: 'Brother Label Printer', sku: 'BRO-QL820', category: 'Printers', price: 179, cost: 118, supplier: 'Brother', location: 'Shelf 4', threshold: 6 },
]

const SUPPLIER_EMAILS = {
  'Apple Inc.': 'orders@apple.demo',
  'Dell Technologies': 'orders@dell.demo',
  'CalDigit': 'sales@caldigit.demo',
  'Logitech': 'orders@logitech.demo',
  'Anker': 'sales@anker.demo',
  'Cisco Systems': 'orders@cisco.demo',
  'Ubiquiti': 'sales@ubiquiti.demo',
  'HP Inc.': 'orders@hp.demo',
  'Brother': 'orders@brother.demo',
}

const EXPENSES = [
  { description: 'Warehouse rent', category: 'Premises', amount: 2400 },
  { description: 'Team salaries', category: 'Payroll', amount: 8600 },
  { description: 'Courier and freight', category: 'Logistics', amount: 940 },
  { description: 'Accounting software', category: 'Software', amount: 89 },
  { description: 'Electricity', category: 'Utilities', amount: 310 },
  { description: 'Packaging materials', category: 'Logistics', amount: 220 },
]

const CUSTOMERS = [
  'Northwind Traders', 'Contoso Ltd', 'Fabrikam Inc', 'Adventure Works',
  'Tailspin Toys', 'Wingtip Toys', 'Litware Inc', '',
]

async function findOrg() {
  const { data } = await supabase
    .from('techit_organizations')
    .select('id, name')
    .eq('slug', ORG_SLUG)
    .maybeSingle()
  return data
}

async function reset() {
  const org = await findOrg()
  if (!org) {
    log('No demo organization found; nothing to remove.')
    return
  }

  // Every seeded table cascades from the organization, so one delete is
  // enough and cannot reach another tenant's rows.
  const { error } = await supabase
    .from('techit_organizations')
    .delete()
    .eq('id', org.id)

  if (error) fail(`Could not remove the demo organization: ${error.message}`)
  log(`Removed "${org.name}" and everything belonging to it.`)
}

async function seed() {
  const existing = await findOrg()
  if (existing) {
    fail('A demo organization already exists. Run "node scripts/seed.js --reset" first.')
  }

  // --- organization -------------------------------------------------------
  const { data: org, error: orgErr } = await supabase
    .from('techit_organizations')
    .insert({ name: ORG_NAME, slug: ORG_SLUG, plan: 'business' })
    .select()
    .single()
  if (orgErr) fail(`Could not create the organization: ${orgErr.message}`)
  log(`Organization "${org.name}" created.`)

  const orgId = org.id
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10)

  // --- users --------------------------------------------------------------
  const { data: users, error: userErr } = await supabase
    .from('techit_users')
    .insert([
      { username: 'demo.admin', email: 'admin@demo.co', password: hashed, role: 'admin', organization_id: orgId },
      { username: 'demo.staff', email: 'staff@demo.co', password: hashed, role: 'user', organization_id: orgId },
    ])
    .select()
  if (userErr) fail(`Could not create users: ${userErr.message}`)

  const admin = users.find(u => u.role === 'admin')
  log(`Users created: ${users.map(u => u.username).join(', ')}`)

  // --- suppliers ----------------------------------------------------------
  const supplierNames = [...new Set(CATALOGUE.map(i => i.supplier))]
  await supabase.from('techit_suppliers').insert(
    supplierNames.map(name => ({
      organization_id: orgId, name, email: SUPPLIER_EMAILS[name] || '',
    }))
  )
  log(`Suppliers recorded: ${supplierNames.length}`)

  // --- items --------------------------------------------------------------
  // Quantities span all three stock states: most healthy, a couple at or
  // below threshold, one at zero, so the dashboard shows every status.
  const itemRows = CATALOGUE.map((c, i) => {
    let quantity
    if (i === 5) quantity = 0
    else if (i === 2 || i === 10) quantity = Math.max(1, c.threshold - 1)
    else quantity = c.threshold * randInt(3, 8)

    return {
      organization_id: orgId,
      name: c.name, sku: c.sku, category: c.category,
      quantity, price: c.price, cost_price: c.cost,
      location: c.location, supplier: c.supplier,
      low_stock_threshold: c.threshold,
      created_at: daysAgo(90 - i).toISOString(),
    }
  })

  const { data: items, error: itemErr } = await supabase
    .from('techit_items').insert(itemRows).select()
  if (itemErr) fail(`Could not create items: ${itemErr.message}`)
  log(`Items created: ${items.length}`)

  // --- sales over the last 90 days ---------------------------------------
  const sales = []
  for (let day = 89; day >= 0; day--) {
    // Weekends are quieter, so the daily chart has a believable rhythm.
    const date = daysAgo(day)
    const isWeekend = [0, 6].includes(date.getUTCDay())
    const orders = isWeekend ? randInt(0, 2) : randInt(1, 5)

    for (let n = 0; n < orders; n++) {
      const item = pick(items)
      const qty = ['Accessories', 'Networking'].includes(item.category)
        ? randInt(1, 8)
        : randInt(1, 2)

      const soldAt = new Date(date)
      soldAt.setUTCHours(randInt(8, 18), randInt(0, 59), 0, 0)

      sales.push({
        organization_id: orgId,
        item_id: item.id,
        item_name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: qty,
        unit_price: item.price,
        unit_cost: item.cost_price,
        customer: pick(CUSTOMERS),
        sold_by: admin.id,
        sold_by_username: admin.username,
        sold_at: soldAt.toISOString(),
      })
    }
  }

  // Batched: a single statement with a thousand rows can exceed request limits.
  for (let i = 0; i < sales.length; i += 200) {
    const { error } = await supabase.from('techit_sales').insert(sales.slice(i, i + 200))
    if (error) fail(`Could not create sales: ${error.message}`)
  }
  log(`Sales recorded: ${sales.length} across 90 days`)

  // --- expenses, monthly for three months --------------------------------
  const expenseRows = []
  for (const monthOffset of [0, 1, 2]) {
    for (const e of EXPENSES) {
      const when = daysAgo(monthOffset * 30 + randInt(1, 5))
      expenseRows.push({
        organization_id: orgId,
        description: e.description,
        category: e.category,
        amount: e.amount + randInt(-40, 60),
        incurred_on: when.toISOString().slice(0, 10),
        created_by_username: admin.username,
      })
    }
  }
  await supabase.from('techit_expenses').insert(expenseRows)
  log(`Expenses recorded: ${expenseRows.length}`)

  // --- stock movements ----------------------------------------------------
  // An opening receipt per item, then a mix of types so every filter on the
  // history view has something to show.
  const movements = []
  for (const item of items) {
    const opening = item.quantity + randInt(10, 40)

    movements.push({
      organization_id: orgId, item_id: item.id,
      item_name: item.name, sku: item.sku,
      movement_type: 'received',
      quantity_change: opening,
      quantity_before: 0, quantity_after: opening,
      reason: 'Opening stock',
      reference_type: 'manual',
      created_by: admin.id, created_by_username: admin.username,
      created_at: daysAgo(90).toISOString(),
    })

    let running = opening
    const events = randInt(2, 5)
    for (let e = 0; e < events; e++) {
      const type = pick(['sold', 'sold', 'received', 'damaged', 'returned', 'adjusted'])
      const inbound = type === 'received' || type === 'returned'
      const size = Math.max(1, Math.min(running, randInt(1, 8)))
      const change = inbound ? size : -size

      if (!inbound && running - size < 0) continue

      const before = running
      running += change

      movements.push({
        organization_id: orgId, item_id: item.id,
        item_name: item.name, sku: item.sku,
        movement_type: type,
        quantity_change: change,
        quantity_before: before, quantity_after: running,
        reason: {
          sold: 'Customer order',
          received: 'Supplier delivery',
          damaged: 'Damaged in transit',
          returned: 'Customer return',
          adjusted: 'Stock count correction',
        }[type],
        reference_type: type === 'sold' ? 'sale' : 'manual',
        created_by: admin.id, created_by_username: admin.username,
        created_at: daysAgo(randInt(1, 85)).toISOString(),
      })
    }
  }

  for (let i = 0; i < movements.length; i += 200) {
    const { error } = await supabase.from('techit_stock_movements').insert(movements.slice(i, i + 200))
    if (error) fail(`Could not create stock movements: ${error.message}`)
  }
  log(`Stock movements recorded: ${movements.length}`)

  // --- purchase orders ----------------------------------------------------
  // Inserted directly rather than raised through the service, so seeding
  // never emails a supplier. One received, one still awaiting delivery.
  const lowItems = items.filter(i => i.quantity <= i.low_stock_threshold)
  const poSpecs = [
    { ref: 'PO-000001', status: 'received', supplier: 'Apple Inc.', daysBack: 21 },
    { ref: 'PO-000002', status: 'sent', supplier: lowItems[0]?.supplier || 'Dell Technologies', daysBack: 3 },
  ]

  let poCount = 0
  for (const spec of poSpecs) {
    const forSupplier = items.filter(i => i.supplier === spec.supplier).slice(0, 3)
    if (forSupplier.length === 0) continue

    const lines = forSupplier.map(i => {
      const qty = Math.max(1, i.low_stock_threshold * 2 - i.quantity)
      return {
        item_id: i.id, item_name: i.name, sku: i.sku,
        quantity_ordered: qty,
        unit_cost: i.cost_price,
        line_total: Number((qty * i.cost_price).toFixed(2)),
        quantity_at_order: i.quantity,
        threshold_at_order: i.low_stock_threshold,
      }
    })

    const total = Number(lines.reduce((s, l) => s + l.line_total, 0).toFixed(2))

    const { data: po, error: poErr } = await supabase
      .from('techit_purchase_orders')
      .insert({
        organization_id: orgId,
        reference: spec.ref,
        supplier_name: spec.supplier,
        supplier_email: SUPPLIER_EMAILS[spec.supplier] || '',
        status: spec.status,
        total_cost: total,
        created_via: 'auto',
        created_by_username: 'system',
        emailed_at: daysAgo(spec.daysBack).toISOString(),
        created_at: daysAgo(spec.daysBack).toISOString(),
        received_at: spec.status === 'received' ? daysAgo(spec.daysBack - 7).toISOString() : null,
      })
      .select()
      .single()

    if (poErr) {
      log(`  (skipped ${spec.ref}: ${poErr.message})`)
      continue
    }

    await supabase.from('techit_purchase_order_lines')
      .insert(lines.map(l => ({ ...l, purchase_order_id: po.id })))
    poCount += 1
  }
  log(`Purchase orders created: ${poCount}`)

  // --- a pending invitation ----------------------------------------------
  await supabase.from('techit_invitations').insert({
    organization_id: orgId,
    email: 'newhire@demo.co',
    role: 'user',
    token: crypto.randomBytes(24).toString('base64url'),
    invited_by: admin.id,
    status: 'pending',
    expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
  })
  log('Invitation created: 1 pending')

  // --- audit log ----------------------------------------------------------
  const auditRows = items.slice(0, 8).map((item, i) => ({
    organization_id: orgId,
    user_id: admin.id,
    username: admin.username,
    action: i % 3 === 0 ? 'ADD_ITEM' : i % 3 === 1 ? 'UPDATE_ITEM' : 'STOCK_MOVEMENT',
    item_id: item.id,
    item_name: item.name,
    changes: { quantity: item.quantity, price: item.price },
    created_at: daysAgo(randInt(1, 30)).toISOString(),
  }))
  await supabase.from('techit_audit_log').insert(auditRows)
  log(`Audit entries recorded: ${auditRows.length}`)

  console.log(`
  Demo data ready.

    Sign in as   admin@demo.co  /  ${DEMO_PASSWORD}   (admin)
                 staff@demo.co  /  ${DEMO_PASSWORD}   (read-only)

    To remove it again:  node scripts/seed.js --reset
`)
}

async function main() {
  // Seeding writes a lot of rows, so production needs an explicit
  // acknowledgement rather than a stray command doing it by accident.
  if (process.env.NODE_ENV === 'production' && !FORCE) {
    fail('Refusing to seed with NODE_ENV=production. Re-run with --force if you are certain.')
  }

  console.log('')
  if (RESET) {
    await reset()
  } else {
    await seed()
  }
}

main().catch(err => fail(err.message))
