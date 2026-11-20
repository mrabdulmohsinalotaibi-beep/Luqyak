# LUQYAK 2.0 — local-first encrypted meetup delivery

## Status (2026-11-20)
Feature-complete **development implementation** with isolated routes for owner, guest upload, view-only album, local photo backup and A4 PDF. NOT DEPLOYED: the additive migration is intentionally unapplied, existing accounts/meetings/photos/R2 objects remain untouched, and live end-to-end device testing remains mandatory.

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

## Development routes (available only after explicit migration and preview deployment)
- `/v2/owner`: owner device enrollment, encrypted key backup, sharing, receive, PDF, encrypted photo backup/restore.
- `/v2/upload/<64-hex-token>`: upload-only WhatsApp camera/gallery form; guest never sees album photos.
- `/v2/view/<64-hex-token>#key=<url-safe-key>`: view-only time-limited encrypted album; PDF only if owner allowed it.

## Staging gate
1. Snapshot the current D1 and R2 state and prove restore works.
2. Provision an isolated staging D1 + R2 for v2; do not point preview at live production photo bucket.
3. Apply `migrations/20261120_local_first_v2.sql` to staging only, then run two-device end-to-end tests.
4. Verify encrypted guest uploads using camera and gallery, roundtrip on owner's phone, local save after reload, and no receipt before durable save.
5. Verify share expiry, early closure, extension, 100-photo/500MB limits, R2 cleanup after ack, temporary view-copy deletion and PDF split files.
6. Verify restore of local photos + owner encryption key after clearing a test browser; never clear real existing data.
7. Audit existing user data migration: legacy photos are **not automatically transferred to local storage by this branch**.
8. Only after tests pass, decide whether to merge, migrate production, and roll out via a reversible feature flag.

## Current test status
- Focused GitHub Actions `Luqyak v2 focused security and build` passed with encrypted roundtrip and security routing checks.
- General repository legacy suites remain failing due to unrelated retained expectations (retired chat flows, older brand palette and legacy response mocks), so merge/deployment is blocked.

## 2026-11-20 follow-up implementation
- Account-isolated IndexedDB for owner photo data and encrypted identity records; no cross-account browser library sharing.
- Owner unlocks private key once to retry deliveries every 30 seconds **while page is open and online**. Browser restrictions mean reception cannot decrypt in a closed PWA; ciphertext remains queued pending the next unlock.
- Owner can explicitly copy authorized legacy JPEG photos from `/api/social/meetup` and `/api/social/photo` into the account-local library. Existing Cloudflare originals are never deleted. Imported counts and errors are reported.
- Device identity registration retries the original public key instead of generating a replacement after transient server errors.
- Upload link metadata now checks the closed/expired window before exposing a public encryption key. Conditional R2 creation prevents overwriting ciphertext on an upload collision.
- Local saving re-reads the Blob and compares SHA-256 before acknowledging a delivery.
- New Python SQLite smoke test applies v2 schema twice against disposable legacy rows, verifies they stay intact and checks quota updates.

### Remaining security and operational gaps
- New V2/local-migrated photo Blob bytes are stored as AES-GCM ciphertext with owner-wrapped keys, including after receipt and before relay acknowledgement. Decryption occurs in the owner browser session only after private-key unlock. Independent on-device validation and key-loss recovery still require two-phone end-to-end testing.
- Browser profile data removal can erase local photos; encrypted manual backup is required to recover them. Do not promise app uninstallation cannot erase storage.
- R2 pending uploads are deliberately retained if no owner acknowledgement arrives; develop an owner-visible expiry reminder and verified retention/deletion policy before the temporary relay goes live.
- Public uploader rate limits should be tested under multiple concurrent guests, and enforce per-IP/bot challenges where supported to prevent free-tier exhaustion.
- Preview must use isolated test D1/R2 with full end-to-end browser testing on Android and iOS; no production D1 migration applied.

## 2026-11-20: encrypted-at-rest implementation
- New recipient envelopes are authenticated with AES-GCM, then stored as ciphertext plus IV/wrapped-key/checksum metadata in account-isolated IndexedDB. Plaintext is never persisted by the V2 local photo library.
- Existing legacy JPEGs are re-encrypted locally with the owner's public key when copied into the V2 library; originals remain safely on existing R2.
- Local PDF and owner-created share packages decrypt photographs **in memory only after key unlock**; viewer never has upload capability.
- Encrypted photo backups now retain envelope metadata (version, IV, wrapped key and ciphertext SHA-256) so restoration does not store plaintext.
- Additional focused tests verify account isolation, encrypted-at-rest contract, legacy copy behavior, and repeatable D1 migration.
- IMPORTANT: this feature branch has **not** been deployed or its migration applied to the production D1/R2. Tests do not replace browser-device QA.
