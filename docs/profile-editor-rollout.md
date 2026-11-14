# Profile editor rollout checklist (issue #25)

- [x] Circular avatar cropper with drag, zoom, preview, JPEG compression (src/profile-avatar-editor.js)
- [x] Camera/gallery controls with authenticated upload (src/profile-avatar-controls.js)
- [ ] Bundle modules into worker.js and replace automatic center crop
- [ ] Implement normalized, unique username changes with conflict handling
- [ ] Implement email change with verified code, expiry, attempt limits, replay protection and CSRF
- [ ] Add UI for username/email and pending verification
- [ ] Run npm run validate, security tests, and two-account device tests
- [ ] Merge and deploy through Wrangler only after passing checks

Existing POST /api/social/profile updates display_name only. POST /api/social/avatar accepts JPEG. Current lkBindProfile auto-crops immediately.
Do not deploy this incomplete branch. Preserve D1, R2 and secrets.