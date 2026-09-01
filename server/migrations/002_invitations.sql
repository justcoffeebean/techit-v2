-- ============================================================================
-- Feature 5: Team invitations
-- Stores pending invites with a unique token, expiry, and the org they bind to.
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS techit_invitations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES techit_organizations(id) ON DELETE CASCADE,
  email           TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'user'
                  CHECK (role IN ('admin', 'user')),
  token           TEXT        UNIQUE NOT NULL,
  invited_by      UUID        REFERENCES techit_users(id) ON DELETE SET NULL,
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'redeemed', 'revoked', 'expired')),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at     TIMESTAMPTZ
);

-- One pending invite per (org, email) — prevents accidental duplicate sends
CREATE UNIQUE INDEX IF NOT EXISTS uniq_invitations_org_email_pending
  ON techit_invitations(organization_id, email)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_invitations_org_status ON techit_invitations(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_token      ON techit_invitations(token);

COMMIT;
