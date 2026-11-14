-- Enforce case-insensitive uniqueness when editing account identities.
-- Existing duplicate counts were checked before deployment.
CREATE UNIQUE INDEX IF NOT EXISTS lk_users_username_ci_unique ON users(lower(username)) WHERE username IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS lk_users_email_ci_unique ON users(lower(email)) WHERE email IS NOT NULL;
