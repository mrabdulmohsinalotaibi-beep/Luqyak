# Luqyak: end-to-end encryption and device recovery contract

Status: **not yet implemented**. This is a security design gate, not a promise that current messages are recoverable.

## Currently shipped
- The main social chat entry directs new conversations to the `/private` encrypted client. The old `/account-chat` remains a labeled, read-only legacy plaintext archive.
- Current private messaging uses non-extractable, device-local P-256 ECDH keys, HKDF-SHA256 and AES-256-GCM.
- The Cloudflare D1 relay stores time-limited encrypted envelopes, not a durable, multi-device message history.
- A server public-key fingerprint prevents silent key replacement by a *different authenticated device*, but is **not an independently verified identity proof** against a malicious server.
- A fresh login on a new device cannot recover existing non-extractable keys or the old device's IndexedDB history. Never silently rotate an identity on login.
- Account key reset **does not restore** pre-reset messages. Resetting an identity is a destructive continuity event.

## Recovery safety requirements before implementation
1. Allow device addition only through an authenticated and cryptographically verified transfer approved by the existing trusted device, **or** through an opt-in encrypted recovery secret established while a trusted device is still accessible.
2. Never send a plaintext private key, recovery secret, plaintext message or user passphrase to the server, logs, push notifications or analytics.
3. Use a separately versioned recovery protocol and authenticated encryption with fresh random nonces. Prefer a reviewed modern protocol/library over extending this ad-hoc ECDH envelope to multi-device identity management.
4. Store only encrypted recovery material in D1/R2, with version, salt, KDF cost, creation time, identity fingerprint and revocation metadata. Use a memory-hard KDF for user passphrases if supported, and independent high-entropy recovery codes when practical.
5. Require explicit informed approval before revocation or rotation; never replace key material when a device logs in. Re-check friend/key fingerprints and display safety changes.
6. Provide secure recovery of message history **separately** from key recovery, since current history is local and pending ciphertext expires.
7. Cover simultaneous devices, replay, revoked devices, wrong recovery secret, tampering, expired transfers, lost original device, backup version incompatibility, and abuse/rate limits.
8. Before deployment, run integration tests with two consenting test users on independent browsers/devices, then a security review of the actual cryptographic protocol.

## Release gates
- No 'fully encrypted and recoverable on every device' marketing wording until real-device tests confirm both promises.
- Do not upload/alter production D1 rows, reset keys, or delete old history as part of a test.
- Roll out an independently reviewed recovery protocol behind an opt-in feature flag and provide a downgrade/rollback plan.
