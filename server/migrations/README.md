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

## Order matters

002 and 003 both reference `techit_organizations`, so **001 must run first**.
Running 002 against a database without 001 fails with:

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
