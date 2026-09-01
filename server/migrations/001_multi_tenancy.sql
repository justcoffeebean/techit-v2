-- ============================================================================
-- Feature 4: Multi-tenancy
-- Creates organizations, links users/items/audit to a single backfill org,
-- adds an index on every organization_id for query speed.
-- Idempotent: safe to run multiple times.
-- ============================================================================

-- Run the whole migration atomically: if any step fails the database is
-- left exactly as it was, rather than half-migrated.
BEGIN;

-- 1. organizations table
CREATE TABLE IF NOT EXISTS techit_organizations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  slug        TEXT        UNIQUE NOT NULL,
  plan        TEXT        NOT NULL DEFAULT 'free'
              CHECK (plan IN ('free', 'pro', 'business')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add organization_id columns (nullable so the ALTER works on populated tables)
ALTER TABLE techit_users
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES techit_organizations(id) ON DELETE CASCADE;

ALTER TABLE techit_items
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES techit_organizations(id) ON DELETE CASCADE;

ALTER TABLE techit_audit_log
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES techit_organizations(id) ON DELETE CASCADE;

-- 3. Backfill: one "Default Organization" that all existing rows join.
--    If it already exists, reuse it; otherwise create it.
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  SELECT id INTO default_org_id
  FROM techit_organizations
  WHERE slug = 'default';

  IF default_org_id IS NULL THEN
    INSERT INTO techit_organizations (name, slug, plan)
    VALUES ('Default Organization', 'default', 'free')
    RETURNING id INTO default_org_id;
  END IF;

  UPDATE techit_users      SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE techit_items      SET organization_id = default_org_id WHERE organization_id IS NULL;
  UPDATE techit_audit_log  SET organization_id = default_org_id WHERE organization_id IS NULL;
END $$;

-- 4. Default every table to the backfill org, then enforce NOT NULL.
--    The default matters during deploy: an older server instance that has
--    not yet picked up the new code inserts rows without an organization_id,
--    and without a default those inserts would fail against the NOT NULL.
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  SELECT id INTO default_org_id FROM techit_organizations WHERE slug = 'default';

  EXECUTE format('ALTER TABLE techit_users     ALTER COLUMN organization_id SET DEFAULT %L', default_org_id);
  EXECUTE format('ALTER TABLE techit_items     ALTER COLUMN organization_id SET DEFAULT %L', default_org_id);
  EXECUTE format('ALTER TABLE techit_audit_log ALTER COLUMN organization_id SET DEFAULT %L', default_org_id);
END $$;

ALTER TABLE techit_users     ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE techit_items     ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE techit_audit_log ALTER COLUMN organization_id SET NOT NULL;

-- 5. Indexes — every query filters by organization_id, so this matters
CREATE INDEX IF NOT EXISTS idx_techit_users_organization_id     ON techit_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_techit_items_organization_id     ON techit_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_techit_audit_log_organization_id ON techit_audit_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_techit_items_org_created         ON techit_items(organization_id, created_at DESC);

COMMIT;
