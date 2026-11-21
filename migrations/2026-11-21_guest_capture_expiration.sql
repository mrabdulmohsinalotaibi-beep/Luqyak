-- Apply once before deploying expiring capture links. NULL preserves legacy behavior.
ALTER TABLE lk_guest_links ADD COLUMN capture_expires_at TEXT;
CREATE INDEX IF NOT EXISTS idx_lk_guest_links_expiry ON lk_guest_links(capture_expires_at);
