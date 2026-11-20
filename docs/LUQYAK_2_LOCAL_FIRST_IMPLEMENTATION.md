# LUQYAK 2.0 — local-first encrypted meetup delivery

## Status (2026-11-20)
Foundation only. NOT enabled in production or wired to existing upload API. Existing accounts, meetings, photos and R2 objects are untouched.

## Verified repository architecture
- Cloudflare Worker entry: `worker.js`
- Existing bindings: `DB` (D1), `PHOTOS` (R2), `LIVE_CHANNEL`
- Existing guest API: `guest.js`; its current guest mode allows browsing to some approved participants. V2 will use separate upload-only and view-only capabilities; do not reuse legacy link permissions without rechecking.

## Delivery protocol (implementation order)
1. Owner registers **public** device encryption key. Private key is protected in the browser with a passphrase-backed wrapping key and backed up to an explicit local user-selected file (never send plaintext key to server).
2. Owner creates meetup start/end times. Worker creates separate random 256-bit tokens for upload and view; store SHA-256 hashes only, not raw tokens. Validate server-side scope, expiry, revocation, quota and rate limits on *every* request.
3. Guest opens upload link without registering, chooses photos, and encrypts each photo in browser using `sealPhoto`. Guest posts binary ciphertext + metadata; Worker validates sizes and identifiers and writes R2 pending object plus D1 queue row.
4. Owner device polls or subscribes to notifications, downloads ciphertext, runs `validateDelivery` and `openPhoto`, saves original bytes durably into OPFS/IndexedDB, and only then sends an authenticated idempotent acknowledgement. Never acknowledge before durable save.
5. On verified owner acknowledgement, queue cleanup deletes the pending R2 object; separately handles expired unacknowledged items (default retention: 7 days, with warnings and an audit trail). Deletion of a D1 queue row **alone** does not delete an R2 object.
6. Only owner-selected photos can be published via a separately encrypted, time-limited view package. Its view decryption key must be delivered with the authorized view capability; do not give view capability upload or owner privileges.
7. Owner creates a PDF locally in a Web Worker from selected images. Use page/size estimates, progress, cancellation, optional automatic volume splitting and no network egress.
8. Preserve current accounts and records by dual-reading old and new metadata, importing local originals before switching source of truth, and never auto-deleting legacy originals during migration.

## Required endpoint contract
- `POST /api/v2/devices` (authenticated): register public key
- `POST /api/v2/meetups/:id/shares` (owner): issue scoped link
- `POST /api/v2/inbox/:token/photos` (upload capability): encrypted payload only
- `GET /api/v2/deliveries` (owner authenticated): pending envelope list
- `GET /api/v2/deliveries/:photoId` (owner): stream encrypted object
- `POST /api/v2/deliveries/:photoId/ack` (owner): receipt after local persistence
- `POST /api/v2/meetups/:id/view-package` (owner): encrypted view package
- `GET /api/v2/view/:token` (view capability): authorized package, no uploads
- `POST /api/v2/meetups/:id/close` and `.../extend` (owner only)

## Acceptance blockers
- Must review existing authentication, tenant ownership, guest flow, rate limits, PWA lifecycle and cleanup first.
- Must test on iOS Safari/PWA and Android Chrome including app termination, storage eviction, offline upload retries, device replacement, large albums, expired links and XSS/CSRF.
- No production migration, R2 deletion, automatic deploy, or claim of end-to-end delivery until integration tests and backup restore pass.
- Avoid exposing share tokens in logs, analytics, referer or error reports. Use Referrer-Policy: no-referrer and no-store.
- Confirm that the current scheduler only removes queue rows and not necessarily R2 objects; build R2 object deletion in a separate verified cleanup routine.
