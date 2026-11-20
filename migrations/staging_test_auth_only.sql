-- Test-only legacy authentication / meetup shape for the isolated V2 Cloudflare D1.
-- This file is NEVER applied to the production Luqyak database.
-- No real user identities, photos, secrets or sessions are inserted.
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY,
 account_status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS lk_meetups (
 id TEXT PRIMARY KEY,
 owner_id TEXT NOT NULL,
 title TEXT NOT NULL,
 ended INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stage_sessions_user ON auth_sessions(user_id,expires_at);
