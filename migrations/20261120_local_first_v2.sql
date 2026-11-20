-- LUQYAK v2: additive schema only. NEVER run in production without an existing-backup check.
-- No existing tables, rows, photos or R2 objects are changed here.
CREATE TABLE IF NOT EXISTS lk_v2_device_keys (
  device_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  public_key_spki TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_lk_v2_device_owner ON lk_v2_device_keys(owner_id,revoked_at);

CREATE TABLE IF NOT EXISTS lk_v2_meetup_shares (
  id TEXT PRIMARY KEY,
  meetup_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(scope IN ('upload','view')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  max_uploads INTEGER,
  can_download_pdf INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lk_v2_share_meetup ON lk_v2_meetup_shares(meetup_id,scope,expires_at);

CREATE TABLE IF NOT EXISTS lk_v2_photo_queue (
  photo_id TEXT PRIMARY KEY,
  meetup_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  recipient_device_id TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  ciphertext_sha256 TEXT NOT NULL,
  wrapped_key TEXT NOT NULL,
  iv TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL CHECK(status IN ('queued','delivered','acknowledged','expired')),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  delivered_at INTEGER,
  acknowledged_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_lk_v2_photo_pending ON lk_v2_photo_queue(owner_id,recipient_device_id,status,expires_at);

CREATE TABLE IF NOT EXISTS lk_v2_view_packages (
  id TEXT PRIMARY KEY,
  meetup_id TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  share_id TEXT NOT NULL,
  iv TEXT NOT NULL,
  ciphertext_sha256 TEXT NOT NULL,
  media_type TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_lk_v2_view_expiry ON lk_v2_view_packages(expires_at,revoked_at);
