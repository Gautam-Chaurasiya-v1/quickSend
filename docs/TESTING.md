# Validation record

## Automated

Run `npm run verify` with Node 24. Tests use the production Fetch handler against the same SQLite schema and real Web Crypto implementations.

Covered: YouTube URL canonicalization, backend-origin validation, AES-GCM tampering and associated-data binding, ECDH/HKDF key delivery, backup password failures, authenticated membership, pending-member access denial, owner-only approvals, invitation expiry/single use/rejection, unread counts, message deduplication/conflict detection, pagination, closing-room revocation, untrusted-origin rejection, and retention cleanup. Client integration tests also simulate a lost response after a successful server commit, retry the persisted encrypted outbox, verify exactly one stored message, and decrypt the cached inbox while offline.

## Browser validation on local backend

Two independent local website origins (`localhost:8787` and `127.0.0.1:8787`) were used as separate device identities against the same backend. Tests exercised onboarding, room creation, invitation generation, a join request, fingerprint comparison, owner approval, decryption/unlocking on the recipient, and video sharing in both directions. Displayed links were canonicalized and notes were preserved. These are test identities and local test data, not a cloud account or real friend’s inbox.

The full view and popup share the same HTML and application code. The preview is useful for UI checks but is not an unpacked-extension runtime. Chrome activeTab capture, runtime host permission prompts, service-worker suspension/restart, alarms, badge updates, browser clipboard/download flows, and Brave behavior still need testing after installation. Cloudflare deployment is not performed by the local tests.

## Manual smoke test before release

1. Deploy the Worker/D1 migration to a test Cloudflare project on the Free plan.
2. Load `dist/extension` in Chrome and Brave. Confirm no WhatsApp or all-sites access is requested at install.
3. Connect the same server in both profiles; grant only its origin. Create separate identities for two-person testing.
4. Create an invite; verify expiry/revocation, reject an unwanted pending request, then use a fresh invite.
5. Compare full fingerprints, approve, and send a watch video and a Short from the actual active YouTube tab.
6. Close the popup while sharing. Reopen it; confirm no duplicate delivery after a retry.
7. Disconnect the network, share, reconnect, and verify the encrypted outbox retries while the browser runs.
8. Confirm a new incoming message increments the badge and opening that room clears its unread count.
9. Export a protected backup; restore it into another profile. Verify both old messages and approved-member pins.
10. Exercise room closure, server errors/rate limits, unknown ciphertext versions, keyboard-only navigation, and the 420 px popup layout.

Do not label the application audited or production-verified merely because these checks pass.

## Actual Chrome and live deployment checks · October 18, 2026

- Re-ran all 13 automated tests: passed.
- Installed the unpacked `dist/extension` in Chrome's Gautam profile. The real popup and full-page extension view rendered and opened successfully.
- Further automated inspection of `chrome-extension://` pages was rejected by the browser's URL security policy, which expressly disallows switching control surfaces to work around the restriction. Extension-only tests were not silently replaced with website tests.
- Ran the app's HTTP development preview in actual Chrome with independent localhost and 127.0.0.1 identities. Onboarding, room creation, invitation copy, joining, fingerprint comparison, required approval, two-way sharing, automatic polling delivery without refresh, invalid URL rejection, and watch/Short canonicalization passed.
- Backup export produced an actual encrypted JSON file in Downloads; checked that its outer structure contains no unencrypted identity/roomKeys fields. The automation download-event listener timed out even though the file downloaded, so the event timeout was not treated as an app failure.
- Backup restore file selection was blocked by the browser automation extension's file URL permission requirement. That broader permission was not enabled. A manual restore UI check remains; cryptographic backup round-trip and wrong-password rejection pass automated tests.
- Deployed the Worker/D1 backend and passed all 12 live API smoke checks. Chrome visibly returned `{"ok":true,"version":1}` from the live health endpoint. Details are in DEPLOYMENT.md.

Still unverified in actual extension runtime: optional host permission approval, active YouTube tab capture, service-worker suspension/restart, alarms, unread badge behavior, offline retry with the browser lifecycle, restore file selection, and Brave installation/runtime. These require manual validation or an automation surface that permits extension pages. A complete extension release sign-off is not claimed.


## 0.3.0 validation — October 18, 2026

`npm run verify` passes 17 tests: the prior 13 plus invitation URL host binding/legacy compatibility and landing CSP; relay authentication, ciphertext roundtrip, wrong-key/session rejection, immutable/idempotent publication, cancellation/expiry/retention; concurrent approval conflict; and a client identity transfer restoring the same room key and deleting the relay. Vendor `.mjs` syntax is now checked too.

Chrome Gautam → Brave Extra, using the HTTP preview on localhost:8788: created disposable Pairing QA identity and Browser pairing QA room; rendered invite link and local QR; generated a fresh Brave pairing request; compared complete receiver fingerprints in both UIs; approved in Chrome; compared complete sender fingerprints; accepted in Brave; observed Browser paired and the same named room in Brave. No backup file/password was used. This caught and fixed the development server serving `.mjs` with the wrong MIME type. Screenshot: ignored `artifacts/brave-pairing-0.3.png`.

This is browser-preview evidence, not Brave extension lifecycle coverage. QR image rendering is verified, physical camera decoding is not. Migration 0002 and the Worker update are now deployed. The updated public backend passed 12 room/API and 8 pairing/landing smoke checks. Live expiration waiting was not performed; automated shared-handler tests cover expiration and retention. Refer to DEPLOYMENT for the actual version.

Chrome also opened the invitation link, displayed its code, and cleared the fragment from the visible URL. No physical QR scan was performed.


## 0.4.0 compact popup verification — October 18, 2026

Automated: 20 tests pass, including active-tab-only metadata extraction, tracking removal/title cleanup, missing/restricted-tab fallback, destination selection after room removal, matching/expired/oversized drafts, and prevention of note carryover to another captured video. The real activeTab permission/YouTube runtime remains manual; mocked tab metadata is not browser capture evidence.

Chrome Gautam HTTP preview at localhost:8787/popup.html: ready form measured 360px wide / 403px document height, exactly three visible fields and a single-room destination label; entered a link/title/note, reloaded and observed the restored draft; used Ctrl/Command+Enter, observed Sending then Sent, cleared note, and confirmed canonical received URL/title/note in Chrome Peer QA at 127.0.0.1:8787/app.html. Added a second disposable room, observed the compact selector, switched away/back without losing the draft, reloaded and observed the remembered destination and draft.

Brave Elastic HTTP preview: compact onboarding rendered; paired the same disposable Chrome QA identity using both full fingerprint comparisons; selected the existing paired room and observed the three-field sharing form with the compact room selector. Brave also sent a Short using the Send button; the link was canonicalized in the form and its title/note arrived in the receiving inbox. These checks exercise the HTTP UI preview and shared use cases, not actual extension runtime APIs.

Screenshot: ignored artifacts/compact-popup-0.4.png (Chrome ready form, cropped to its measured bounds). QR camera scanning, activeTab capture on an actual installed extension, background lifecycle, browser host-permission prompts, and automatic popup closing behavior remain manual release checks.

Release validation uses matching tag/package/manifest versions, npm run verify, ZIP integrity, SHA256SUMS, and a downloaded published asset. The tag-triggered Release extension and Verify workflows passed. A fresh download from the public latest ZIP URL reports version 0.4.0, matches SHA256SUMS, and matches all 20 per-file hashes. Details are in DISTRIBUTION/STATUS.


## 0.5.0 inbox and density checks — October 18, 2026

Automated: npm run verify passes 22 tests. New policy tests cover acknowledgements for the current visible/focused/verified room, hidden Share mode, navigation to another room, offline/modal-covered state, empty/error pages, and full workspace. Browser-opening tests validate canonical YouTube-only routing through the supplied tabs API. These are policy/API-instance tests, not actual extension execution.

Chrome Gautam HTTP preview: Inbox opened inside the same popup.html page, displayed room videos, and Share returned to exactly three fields with the draft intact. A peer sent a disposable QA video; Share showed Inbox with 1 unread after reload, and opening Inbox displayed it and cleared the unread count. Full workspace switched Cards/List and remembered List across reload. Ten local QA entries exercised density: the wide-screen composer measured 77.5px high, rows 58px, five complete rows fit in the default 635px-high viewport with another row partly visible, and no horizontal overflow was observed.

Chrome and Brave Elastic HTTP previews both opened videos from the popup list. Browser tab IDs observed before/after clicking confirmed new YouTube tabs in the initiating browser. The actual extension chrome.tabs.create route is separately covered by a mocked API instance and still requires manual extension runtime verification. No OS/default-browser invocation is used.

Screenshots are ignored artifacts/popup-inbox-0.5.png and artifacts/workspace-list-0.5.png. New extension permissions were not added. No backend change or repeated live write smoke was needed. Actual extension lifecycle, activeTab, host prompts, and popup-closing behavior remain manual; browser automation restrictions were respected.
