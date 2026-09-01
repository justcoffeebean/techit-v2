-- ============================================================================
-- Scope SKU uniqueness to the organization
--
-- techit_items.sku carried a global unique constraint from the single-tenant
-- schema. Under multi-tenancy that leaks across customers: once any
-- organization uses a SKU, no other organization can, so two customers both
-- stocking the same product cannot both record its real part number.
--
-- A SKU should be unique within an organization and unrelated between them.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

-- Drop the global constraint. The name is the PostgreSQL default for a
-- column-level UNIQUE on this table; the DO block tolerates it being absent
-- or already replaced by a previous run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'techit_items'::regclass
      AND conname = 'techit_items_sku_key'
  ) THEN
    ALTER TABLE techit_items DROP CONSTRAINT techit_items_sku_key;
  END IF;
END $$;

-- Some deployments may carry it as a bare index rather than a constraint.
DROP INDEX IF EXISTS techit_items_sku_key;

-- Unique per organization instead. This also serves the barcode lookup,
-- which filters on organization_id and then matches the SKU.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_items_org_sku
  ON techit_items(organization_id, sku);

COMMIT;
