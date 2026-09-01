-- ============================================================================
-- Feature 6: Refresh tokens
--
-- Access tokens are short-lived JWTs (15 minutes). Refresh tokens are opaque
-- random strings stored here as SHA-256 hashes, so they can be revoked and a
-- leaked database dump cannot be replayed against the API.
--
-- Idempotent: safe to re-run.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS techit_refresh_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES techit_users(id) ON DELETE CASCADE,

  -- SHA-256 of the token. The raw value only ever exists in the cookie.
  token_hash  TEXT        UNIQUE NOT NULL,

  -- Rotation chain: the row this token replaced. Lets a replayed token be
  -- traced back to its family so the whole family can be revoked.
  replaces_id UUID        REFERENCES techit_refresh_tokens(id) ON DELETE SET NULL,

  user_agent  TEXT,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Refresh does a hash lookup on every access-token expiry
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON techit_refresh_tokens(token_hash);

-- Revoking every session for a user scans by user_id
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON techit_refresh_tokens(user_id);

-- Partial index over live tokens only, for session listing and cleanup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active
  ON techit_refresh_tokens(user_id, expires_at)
  WHERE revoked_at IS NULL;

COMMIT;
