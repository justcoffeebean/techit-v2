-- ============================================================================
-- Feature 10: Stock movements
--
-- Records every quantity change so an item's history explains how it reached
-- its current level. Movement rows are append-only: corrections are entered
-- as new adjustments rather than edits, so the ledger stays auditable.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS techit_stock_movements (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES techit_organizations(id) ON DELETE CASCADE,
  item_id          UUID        REFERENCES techit_items(id) ON DELETE SET NULL,

  -- Snapshot so history survives the product being renamed or deleted
  item_name        TEXT        NOT NULL,
  sku              TEXT        NOT NULL,

  movement_type    TEXT        NOT NULL
                   CHECK (movement_type IN ('received', 'sold', 'damaged', 'returned', 'adjusted')),

  -- Signed: positive adds stock, negative removes it. Never zero, since a
  -- movement that changes nothing is not a movement.
  quantity_change  INTEGER     NOT NULL CHECK (quantity_change <> 0),

  -- Levels either side of the change, so a row is readable on its own
  quantity_before  INTEGER     NOT NULL,
  quantity_after   INTEGER     NOT NULL,

  reason           TEXT        NOT NULL DEFAULT '',

  -- Links a movement back to the sale or purchase order that caused it
  reference_type   TEXT        CHECK (reference_type IN ('sale', 'purchase_order', 'manual')),
  reference_id     UUID,

  created_by       UUID        REFERENCES techit_users(id) ON DELETE SET NULL,
  created_by_username TEXT     NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The item detail view reads one item's history newest first
CREATE INDEX IF NOT EXISTS idx_movements_item_created
  ON techit_stock_movements(item_id, created_at DESC);

-- The org-wide movements list and type filter
CREATE INDEX IF NOT EXISTS idx_movements_org_created
  ON techit_stock_movements(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_movements_org_type
  ON techit_stock_movements(organization_id, movement_type);

COMMIT;
