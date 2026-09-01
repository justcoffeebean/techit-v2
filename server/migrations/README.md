# Migrations

Run these in order against the Supabase SQL editor. Each is idempotent and
wrapped in a transaction, so a failure rolls back rather than leaving the
database half-migrated, and re-running a migration that already applied is
a no-op.

| # | File | Adds |
|---|------|------|
| 001 | `001_multi_tenancy.sql` | `techit_organizations`; `organization_id` on users, items and the audit log; backfills every existing row into one "Default Organization" |
| 002 | `002_invitations.sql` | `techit_invitations` — team invites with a unique token and 7-day expiry |
| 003 | `003_sales_expenses.sql` | `techit_items.cost_price`, `techit_sales`, `techit_expenses`, and the `techit_record_sale()` function |
| 004 | `004_refresh_tokens.sql` | `techit_refresh_tokens` — hashed refresh tokens with a rotation chain |
| 005 | `005_stock_movements.sql` | `techit_stock_movements` — a signed ledger of every quantity change |
| 006 | `006_purchase_orders.sql` | `techit_purchase_orders`, its lines, and `techit_suppliers` |

## Order matters

Every later migration references `techit_organizations`, so **001 must run
first**. Running any of them against a database without 001 fails with:

```
ERROR: 42P01: relation "techit_organizations" does not exist
```

## After 001

`organization_id` is `NOT NULL` on users, items and the audit log, and every
API query filters by it. Deploy the matching server code before or alongside
this migration. The migration sets a column default pointing at the Default
Organization so a server instance still running the old code cannot insert
rows that violate the constraint mid-deploy.

## After 003

`techit_record_sale()` decrements stock and inserts the sale inside one
transaction, holding a row lock on the item so two concurrent sales cannot
oversell. It raises `ITEM_NOT_FOUND` and `INSUFFICIENT_STOCK`, which
`routes/sales.js` maps to 404 and 400.

## After 004

Set `NODE_ENV=production` on the API host. The refresh cookie is cross-site
(Vercel to Render), so it needs `Secure` and `SameSite=None`; without that
variable the cookie falls back to development settings and the browser
rejects it.

## After 006

Purchase orders email a PDF to the supplier, which needs `EMAIL_USER` and
`EMAIL_PASS` set. Without them an order is still raised and the failure
recorded on it, so nothing is lost and the send can be retried. Supplier
addresses live in `techit_suppliers` and are managed from the purchase
orders page.
