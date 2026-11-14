-- Additive migration. Existing meetups remain tagged 'meetup'.
ALTER TABLE lk_meetups ADD COLUMN occasion_type TEXT NOT NULL DEFAULT 'meetup';
