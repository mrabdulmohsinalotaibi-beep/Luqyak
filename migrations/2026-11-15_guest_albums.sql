-- Luqyak guest albums: additive tables, do not alter existing memberships or photos.
CREATE TABLE IF NOT EXISTS lk_guest_links (
 token_hash TEXT PRIMARY KEY,
 meetup_id TEXT NOT NULL,
 owner_id TEXT NOT NULL,
 mode TEXT NOT NULL DEFAULT 'link' CHECK (mode IN ('link','approval','accounts')),
 can_view INTEGER NOT NULL DEFAULT 1,
 can_upload INTEGER NOT NULL DEFAULT 1,
 review_photos INTEGER NOT NULL DEFAULT 0,
 revoked_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_lk_guest_links_owner ON lk_guest_links(owner_id,meetup_id);
CREATE TABLE IF NOT EXISTS lk_guest_members (
 id TEXT PRIMARY KEY,
 token_hash TEXT NOT NULL,
 display_name TEXT NOT NULL,
 session_hash TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'accepted' CHECK(status IN ('pending','accepted','rejected')),
 claimed_user_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(token_hash) REFERENCES lk_guest_links(token_hash)
);
CREATE INDEX IF NOT EXISTS idx_lk_guest_members_token ON lk_guest_members(token_hash,status);
CREATE INDEX IF NOT EXISTS idx_lk_guest_members_claim ON lk_guest_members(claimed_user_id);
CREATE TABLE IF NOT EXISTS lk_guest_photos (
 id TEXT PRIMARY KEY,
 meetup_id TEXT NOT NULL,
 guest_id TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL DEFAULT 'approved' CHECK(status IN ('pending','approved','rejected')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(guest_id) REFERENCES lk_guest_members(id)
);
CREATE INDEX IF NOT EXISTS idx_lk_guest_photos_meet ON lk_guest_photos(meetup_id,status);
