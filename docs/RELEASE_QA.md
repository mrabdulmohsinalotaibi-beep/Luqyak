# Luqyak release readiness and test matrix

Status: evidence-based audit checklist. No test may be marked PASS without its result and environment.

## Automated gates (GitHub Actions: quality.yml)

Run `npm run validate` on each main push / pull request. It checks Worker JavaScript syntax and Node regression tests.

- Anonymous private meetup photo: expect HTTP 401 and no-store.
- Anonymous encrypted relay: expect HTTP 401 and no-store.
- Anonymous chat reads and send: expect HTTP 401 and no-store.
- PWA manifest: standalone and proper scope.
- Service Worker: push and notification click handlers; no private response cache.
- Private photo URL handling: verify meetup access check and matching meetup ID.
- Duplicate-submit guard on meeting creation.

**Important:** Source-level assertions do not replace a penetration test; server-side checks require authenticated integration tests.

## Two-account / two-device manual protocol

Use two dedicated test accounts with no real user data; do not use production personal photographs.

1. Account A and B sign up with unique addresses; sign out and back in on separate devices.
2. A sends a friend request; B accepts. Verify both accounts show accepted. Decline/block scenarios should also be tested.
3. A creates a specific-participants meeting and invites B. Check that B sees an incoming invitation on home, accepts, and reaches the same meeting; an unrelated third account must not view it.
4. Both add separately captured test images, including multiple photos. Open/swipe/save/reopen the album, test return navigation and access after the meeting ends.
5. A sends messages to B while B is foreground, background and closed. Record received time, delivery/read state and what persisted after reconnecting.
6. Repeat on iPhone Safari installed to home screen, Android Chrome installed as PWA, iPad Safari and desktop browser.
7. Switch B to a fresh device, log in and verify which items restore. Verify encrypted relay semantics; do not claim all device-local data transfers automatically.
8. Turn on airplane mode while composing. Verify the UI explains what is queued, then test retry and deduplication upon reconnecting.
9. Test navigation links, map selection, date/time zone handling, calendar export and RSVP changes.
10. Test session expiry, stale invitations, unauthorized photo URLs, logout and notification click destinations.

## Push notification platform limits

- iOS web push generally requires a home-screen-installed web app and permission; permission can only be requested from a user gesture.
- Android and desktop permission and background delivery are dependent on platform, browser, energy saver and network conditions.
- Sound volume/strength cannot be overridden independently by a regular web app; follow OS/browser settings.
- Run foreground/background/force-closed tests on physical devices rather than inferring success from server push attempts.

## Security and privacy sign-off

- Confirm both ordinary account chat and encrypted relay disclosures precisely match current implementation. Do not describe all data as end-to-end encrypted unless every message route is covered.
- Confirm private photos are authorized per meetup, uploader/delete privileges and no-cache response.
- Confirm R2 object access is exclusively authorized through the Worker.
- Confirm notification payloads reveal no confidential content on locked screens without user consent.
- Confirm retention and account deletion cover database, media objects and device-local records as intended.

## Performance checks

Record cold load, warm load, memory usage, photo upload sizes, long-session chat lag and reconnect time on 4G/5G/Wi-Fi for each device class. Choose performance targets only after collecting baseline measurements.

## App Store preparation

Prepare an iOS build with a native wrapper or native client (PWA alone is not an App Store binary), bundle identifier, signing certificates, screenshots, permission purpose strings, privacy policy, account deletion path, TestFlight results and App Review notes. Perform live Apple compliance review before submission.

## Release gate

Do not publish a new functional release until automated CI passes, authenticated two-account tests pass, privacy review is complete and the database/media bindings are preserved. Record a release commit SHA, version ID, deployment time and rollback candidate.
