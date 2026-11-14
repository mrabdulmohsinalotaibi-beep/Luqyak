# Profile editor rollout — GitHub #25

## Implemented
- [x] Avatar cropper supports pan, zoom, circular preview, confirmation/cancel and JPEG compression
- [x] Camera and gallery inputs are integrated into account page in worker.js
- [x] Worker serves avatar editor module at /src/profile-avatar-editor.js
- [x] Account avatar CSS is circular and profile upload uses authenticated /api/social/avatar
- [x] Display name and normalized unique username edit in account page and /api/social/profile
- [x] Email change request and verification endpoints with authenticated session, Origin check, short-lived hashed code, five attempts, per-user rate limit and verified update only
- [x] Email form in profile page with confirmation code step
- [x] Added tests for API validation, UI cropper and embedded client JavaScript parsing

## Deployment notes
- Worker code is in worker.js; no D1 schema migration is needed because existing email_otps table stores namespaced email change challenges.
- Email provider requires existing RESEND_API_KEY and AUTH_FROM_EMAIL bindings.
- D1 DB, R2 PHOTOS, LIVE_CHANNEL and Worker secrets must be preserved.
- Verify all GitHub Actions validation jobs on the final head SHA, then merge and deploy Worker without replacing bindings.
- After deployment, verify publicly accessible module URL and unauthenticated API protections. End-to-end photo and email delivery require a signed-in test account.
