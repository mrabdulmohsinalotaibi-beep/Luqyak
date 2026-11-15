-- Luqyak: selected cover photo for each meetup.
-- Existing photos remain in their original storage; only the selected photo ID is saved here.
CREATE TABLE IF NOT EXISTS lk_meetup_covers (
  meetup_id TEXT PRIMARY KEY,
  photo_id TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
