# Chat recovery security and real-device acceptance — 2026-11-14

## Implemented
- The main Chats tab navigates directly to the existing encrypted /private chat screen.
- Existing plaintext account chats remain readable only; new account-chat sends were disabled in the prior release.
- New identities can export a local AES-256-GCM encrypted backup of their ECDH key, current rooms, and local messages using a user-chosen recovery passphrase (PBKDF2-SHA256, 650000 iterations).
- Restore verifies the signed-in account, matching server-registered key fingerprint and private/public ECDH pair before changing local keys. The passphrase is not sent to the server.
- Automated isolated two-account key restore, wrong-passphrase, tamper, and cross-account rejection tests.

## Known limitations
1. Previous non-extractable private keys cannot be backed up using this feature. Do not reset or rotate these automatically.
2. A new identity can export its key only during its creation browser session. The user must save the encrypted file promptly.
3. Only messages saved locally at backup time are restored. Encrypted relay deliveries expire after 24 hours; no durable multi-device chat-history synchronization exists.
4. File transfer between devices is manual and requires both the archive and its passphrase.
5. Existing ECDH sender authentication and peer key pinning have not undergone independent cryptographic review. Do not claim a complete audited E2EE protocol.
6. Synthetic two-account Node tests are NOT physical iPhone or Android tests.

## Physical-device acceptance required before release
- [ ] Sign in with two dedicated consenting test accounts on two real devices, one iPhone and one Android (or iPad).
- [ ] Accept friendship, send A-to-B and B-to-A, reconnect, check delivery and correct ciphertext-only server storage.
- [ ] Verify blocking and revoking friendship prevents new encrypted message delivery.
- [ ] Create new test identity, save encrypted recovery file, import on a second device and verify key fingerprint and subsequent message decrypt.
- [ ] Check wrong password, different account, tampered archive, and lost archive cases.
- [ ] Confirm only archived local history restores; messages sent after backup do not appear automatically.
- [ ] Confirm iOS Safari installed PWA file download and file import behavior.
- [ ] Record actual device results without exposing personal data or recovery passphrases.

## Release gate
Keep this security-sensitive recovery change behind PR review until physical-device acceptance and a review of the existing peer-key authenticity protocol. Never claim complete secure multidevice recovery based solely on CI.
