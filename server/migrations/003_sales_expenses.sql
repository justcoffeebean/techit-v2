-- ============================================================================
-- Sales, expenses and cost tracking
--
-- Backfills the schema that server/routes/sales.js and server/routes/expenses.js
-- already depend on:
--   - techit_items.cost_price   (unit cost, used for COGS and inventory value)
--   - techit_sales              (one row per sale, with cost snapshotted)
--   - techit_expenses           (operating expenses, for net profit)
--   - techit_record_sale()      (atomic sale insert + stock decrement)
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Unit cost on items
--    Sales snapshot this at sale time so historical COGS never shifts when
--    the current cost is edited later.
-- ---------------------------------------------------------------------------
ALTER TABLE techit_items
  ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12,2) NOT NULL DEFAULT 0
    CHECK (cost_price >= 0);

-- ---------------------------------------------------------------------------
-- 2. Sales
--    item_id is ON DELETE SET NULL so deleting a product does not erase the
--    revenue history; item_name / sku / category are denormalised copies that
--    keep reports readable after the product is gone.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS techit_sales (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID        NOT NULL REFERENCES techit_organizations(id) ON DELETE CASCADE,
  item_id           UUID        REFERENCES techit_items(id) ON DELETE SET NULL,

  -- Snapshot of the product at the moment of sale
  item_name         TEXT        NOT NULL,
  sku               TEXT        NOT NULL,
  category          TEXT        NOT NULL DEFAULT 'Uncategorised',

  quantity          INTEGER     NOT NULL CHECK (quantity > 0),
  unit_price        NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),

  customer          TEXT        NOT NULL DEFAULT '',
  sold_by           UUID        REFERENCES techit_users(id) ON DELETE SET NULL,
  sold_by_username  TEXT        NOT NULL DEFAULT '',

  sold_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every sales query filters by org and a sold_at range
CREATE INDEX IF NOT EXISTS idx_sales_org_sold_at ON techit_sales(organization_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_org_category ON techit_sales(organization_id, category);
CREATE INDEX IF NOT EXISTS idx_sales_org_sku      ON techit_sales(organization_id, sku);
CREATE INDEX IF NOT EXISTS idx_sales_item         ON techit_sales(item_id);

-- ---------------------------------------------------------------------------
-- 3. Expenses
--    incurred_on is a DATE: the metrics endpoint compares it against
--    date strings, not timestamps.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS techit_expenses (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID        NOT NULL REFERENCES techit_organizations(id) ON DELETE CASCADE,
  description         TEXT        NOT NULL,
  category            TEXT        NOT NULL DEFAULT 'General',
  amount              NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  incurred_on         DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_by_username TEXT        NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_org_incurred ON techit_expenses(organization_id, incurred_on DESC);

-- ---------------------------------------------------------------------------
-- 4. techit_record_sale
--    Locks the item row, verifies stock, decrements it and inserts the sale
--    in one transaction so two concurrent sales cannot oversell.
--
--    Raises ITEM_NOT_FOUND / INSUFFICIENT_STOCK, which the route maps to
--    404 and 400 respectively.
--
--    Returns the complete inserted row: the caller reads item_name and
--    passes the row through withDerived().
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION techit_record_sale(
  p_org        UUID,
  p_item       UUID,
  p_qty        INTEGER,
  p_unit_price NUMERIC,
  p_customer   TEXT,
  p_user       UUID,
  p_username   TEXT
)
RETURNS SETOF techit_sales
LANGUAGE plpgsql
AS $$
DECLARE
  v_item techit_items%ROWTYPE;
BEGIN
  IF p_qty IS NULL OR p_qty <= 0 THEN
    RAISE EXCEPTION 'INVALID_QUANTITY';
  END IF;

  -- FOR UPDATE holds the row until this transaction commits, so a second
  -- concurrent sale blocks here and re-reads the decremented quantity.
  SELECT * INTO v_item
  FROM techit_items
  WHERE id = p_item
    AND organization_id = p_org
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND';
  END IF;

  IF v_item.quantity < p_qty THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK';
  END IF;

  UPDATE techit_items
  SET quantity   = quantity - p_qty,
      updated_at = now()
  WHERE id = p_item;

  RETURN QUERY
  INSERT INTO techit_sales (
    organization_id, item_id,
    item_name, sku, category,
    quantity, unit_price, unit_cost,
    customer, sold_by, sold_by_username
  )
  VALUES (
    p_org, p_item,
    v_item.name, v_item.sku, COALESCE(v_item.category, 'Uncategorised'),
    p_qty, p_unit_price, COALESCE(v_item.cost_price, 0),
    COALESCE(p_customer, ''), p_user, COALESCE(p_username, '')
  )
  RETURNING *;
END $$;

COMMIT;
