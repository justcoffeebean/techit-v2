-- ============================================================================
-- Feature 9: Purchase orders
--
-- When stock falls below its threshold a purchase order is raised for the
-- supplier. Newly-low items for the same supplier are batched into one order,
-- and an item with an order already open is skipped, so a level that keeps
-- dropping does not produce a stream of duplicates.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

-- Where to send the order. Suppliers are free text on items today, so this
-- maps a supplier name to a contact address per organization.
CREATE TABLE IF NOT EXISTS techit_suppliers (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES techit_organizations(id) ON DELETE CASCADE,
  name             TEXT        NOT NULL,
  email            TEXT        NOT NULL DEFAULT '',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS techit_purchase_orders (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        NOT NULL REFERENCES techit_organizations(id) ON DELETE CASCADE,

  -- Human-facing reference, e.g. PO-000042
  reference        TEXT        NOT NULL,

  supplier_name    TEXT        NOT NULL,
  supplier_email   TEXT        NOT NULL DEFAULT '',

  status           TEXT        NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'sent', 'received', 'cancelled')),

  total_cost       NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Whether the PDF actually reached the supplier
  emailed_at       TIMESTAMPTZ,
  email_error      TEXT,

  -- 'auto' when raised by a low-stock trigger, 'manual' when an admin asked
  created_via      TEXT        NOT NULL DEFAULT 'auto'
                   CHECK (created_via IN ('auto', 'manual')),

  created_by_username TEXT     NOT NULL DEFAULT 'system',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at      TIMESTAMPTZ,

  UNIQUE (organization_id, reference)
);

CREATE TABLE IF NOT EXISTS techit_purchase_order_lines (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID        NOT NULL REFERENCES techit_purchase_orders(id) ON DELETE CASCADE,
  item_id           UUID        REFERENCES techit_items(id) ON DELETE SET NULL,

  item_name         TEXT        NOT NULL,
  sku               TEXT        NOT NULL,

  quantity_ordered  INTEGER     NOT NULL CHECK (quantity_ordered > 0),
  unit_cost         NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total        NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Levels at the moment the order was raised, for context on the PDF
  quantity_at_order INTEGER     NOT NULL DEFAULT 0,
  threshold_at_order INTEGER    NOT NULL DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_org_created ON techit_purchase_orders(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_org_status  ON techit_purchase_orders(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_po_lines_po    ON techit_purchase_order_lines(purchase_order_id);

-- "Does this item already have an open order?" runs on every stock decrease
CREATE INDEX IF NOT EXISTS idx_po_lines_item  ON techit_purchase_order_lines(item_id);

COMMIT;
