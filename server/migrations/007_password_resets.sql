-- ============================================================================
-- Password resets
--
-- A user who forgets their password currently has no way back in: since
-- registration creates an organization, signing up again yields an empty one
-- rather than recovering their data.
--
-- Only the SHA-256 hash of each token is stored, matching the refresh-token
-- table, so a leaked database dump cannot be replayed to seize accounts.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS techit_password_resets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES techit_users(id) ON DELETE CASCADE,

  -- SHA-256 of the token; the raw value only ever exists in the emailed link
  token_hash  TEXT        UNIQUE NOT NULL,

  -- Recorded so an unexpected reset can be traced
  requested_ip TEXT,

  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Redeeming a link is a hash lookup
CREATE INDEX IF NOT EXISTS idx_password_resets_hash ON techit_password_resets(token_hash);

-- Invalidating a user's outstanding links scans by user
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON techit_password_resets(user_id);

COMMIT;
