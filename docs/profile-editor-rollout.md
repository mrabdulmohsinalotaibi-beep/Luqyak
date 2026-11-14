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
- Worker code is in worker.js. The existing email_otps table stores namespaced email-change challenges.\n- Production D1 has case-insensitive UNIQUE indexes on users(lower(username)) and users(lower(email)); checked for duplicates first, and both indexes verified present.
- Email provider requires existing RESEND_API_KEY and AUTH_FROM_EMAIL bindings.
- D1 DB, R2 PHOTOS, LIVE_CHANNEL and Worker secrets must be preserved.
- PR #26 was merged. Cloudflare active deployment confirmed 100% for version 8c52812d-cc94-4b35-8802-8a24cdc630e8, with live Worker content CRC32 fe423e1a and length 699955 matching GitHub main. Bindings were verified intact.
- Remaining acceptance: browser/device test on iPhone, tablet and desktop; authenticated email delivery and photo upload require a signed-in test account. Direct external HTTP probe was unavailable in this environment; do not claim an end-to-end user journey passed.
