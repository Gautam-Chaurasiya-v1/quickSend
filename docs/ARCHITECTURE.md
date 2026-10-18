# Architecture

QuickSend uses JavaScript ES modules and browser-native Web Crypto. The MV3 popup and full view share an identical HTML shell. A module service worker retries encrypted sends and updates unread badges on alarms. Cloudflare Worker/D1 provides the HTTPS JSON API, an isolated invitation landing page, and daily retention cleanup. Node 24's SQLite adapter runs the same API handler locally and in tests. No React framework, bundler, authentication provider, WhatsApp integration, or YouTube API is involved.

| Boundary | Responsibility | Source |
| --- | --- | --- |
| Interface | DOM state, dialogs, optional host permission gesture | `extension/app.js` |
| Room operations | Connection, invite, approval, inbox, encrypted outbox | `extension/lib/client.js` |
| Device operations | Pairing request, encrypted snapshot, restore validation | `extension/lib/pairing.js` |
| Protocol primitives | AES-GCM, ECDH/HKDF, fingerprints, password backups | `extension/lib/crypto.js` |
| Storage | Trusted extension local storage or development localStorage, serialized updates | `extension/lib/storage.js` |
| Inbox policy | Visible/current-room read eligibility and same-browser YouTube routing | `extension/lib/inbox.js` |
| Capture/compose | Active-tab metadata, bounded draft restoration, destination selection | `extension/lib/compose.js` |
| Transport | Bounded authenticated requests, timeout, redirect rejection | `extension/lib/api.js` |
| Configuration/input | Public default origin, explicit override, canonical URLs and invites | `extension/lib/config.js`, `validation.js` |
| QR | Pinned local generator, locally assembled SVG image | `extension/lib/qr.js`, `extension/vendor/qrcode.mjs` |
| Backend | Auth, two-member authorization, rate limits, ciphertext, retention | `server/worker.js` |
| Landing | Fragment-only invitation display/copy, no API/network calls | `server/landing.js` |

## Room flow

Owner generates a random room key locally. The server stores room membership and a hash of the expiring invitation capability. A joining identity becomes pending and cannot read messages. The owner compares the recipient's full public-key fingerprint and wraps the room key using ECDH/HKDF. The recipient verifies the owner against the invitation's pinned fingerprint, decrypts the wrapped key, and decrypts messages locally. Message AES-GCM additional data binds room, sender, and message ID. The server never receives a plaintext link, title, note, or room key.

## Additional browser flow

A fresh profile generates an ephemeral P-256 key pair and separate random 256-bit relay capability. The server stores its public key, capability hash, and a ten-minute expiration. A `qsd1.` request contains the public key, capability, session ID, and server; its private key stays local. Copy it privately to the existing browser. The owner compares the receiver fingerprint, then encrypts its current identity, bearer token, settings, room keys, and pins with ECDH/HKDF/AES-GCM in a namespace separate from room wrapping. The relay accepts one immutable ciphertext and sender public key. Identical retries are safe; a conflicting approval fails.

The receiving browser decrypts locally, validates the snapshot and key correspondence, and shows the sender fingerprint for comparison with the existing browser. Only after confirmation does it install the identity. Successful receipt or cancellation deletes relay data; server access rejects expired rows immediately and daily cleanup removes expired ciphertext. The local ephemeral session is cleared after completion. A closed popup can resume an unexpired request from profile storage.

This copies the same identity to both browsers. It does not create a third room member or provide independent device revocation. Keys created or approvals made afterward need another snapshot transfer or backup restore. No continuous key synchronization is implemented.

## Delivery and polling

The UI polls every 15 seconds while visible and no dialog is open. The background alarm polls once per minute while the browser runs. Polling is implemented delivery, with an expected delay; WebSockets are not implemented. It fits the current low-volume request/response API and survives MV3 worker restarts without maintaining a connection. A future push channel still needs reconnection, missed-event catchup, authentication, quota measurements, and a polling fallback. See `DECISIONS.md`.

The outbox persists ciphertext before POST. A lost acknowledgement retries the exact ID/envelope and deduplicates server-side. Offline views use the last cached encrypted page. No work runs with the browser closed.

## Database and API

Numbered SQL migrations are append-only. D1 records applied migrations. The current local migrations use idempotent DDL and are replayed on startup; the local adapter is not a general data migration engine. Add local migration tracking before introducing non-idempotent data migrations.

Existing `/v1` identity/room/message APIs retain their v1 wire formats. New `/v1/device-pairings` POST creates a capability session; `/v1/device-pairings/:id` GET/POST/DELETE uses the session capability, not a room identity token. This intentionally works before onboarding. Its 20 starts/IP bucket/hour limit is separate from identity traffic. Requests are bounded to 100 KB only on the relay; encrypted snapshots to 65,536 base64 characters; ordinary API requests remain 16 KB/8,192-character envelopes. The receiving browser validates all restored fields before installation.

Production API CORS permits extension origins only. The invite page has a `connect-src 'none'` CSP and no room access. Development explicitly enables loopback website origins. CORS is not an authorization mechanism: every room operation also checks the bearer identity and membership.


## Compact sharing and distribution (0.4)

On action-popup open, captureYouTube queries only the invoked active tab, canonicalizes recognized YouTube video/Short/live URLs, and cleans the tab title. It needs no new permission or content script. Title freshness depends on YouTube/browser tab metadata. Capture failures allow manual entry. Full view never queries the active tab.

The popup selects its stored destination, otherwise the first ready room or first pending room. Changing rooms does not reset the compose form. A single local composeDraft restores matching video edits for up to 24 hours; a different capture drops the previous note. These drafts are local plaintext like identity keys and become encrypted only on send; they are not server-synced, part of backups, or included in device snapshots. Sending or queueing clears the draft. Share mode polls room metadata and skips message fetching/read acknowledgement. Inbox mode fetches the selected room and acknowledges it only while current, visible, focused, online, and fully verified.

GitHub Releases hosts the downloadable ZIP. scripts/package.js invokes the system zip utility and writes SHA256SUMS. A matching version tag triggers verification and release publication, with contents-write scoped to that job. No remote code is loaded by an installed extension and no automatic unpacked-extension update is attempted. See DISTRIBUTION.md for the boundary between download hosting and browser-managed installation.


## In-popup inbox and dense workspace (0.5)

app.js tracks popup view separately from the selected room and compose fields. Share is the default on open; switching to Inbox changes the current UI without creating a tab. Full workspace is an explicit ↗ action. Both surfaces render the same verified messages. The popup forces a dense list; the desktop Cards/List preference is stored as local feedLayout and is not part of identity snapshots/backups.

Refresh requests are serialized with a follow-up refresh when navigation happens mid-request. A message response for an old room or hidden inbox cannot populate/acknowledge the current view. The read-policy helper also checks visibility, focus, offline status, and message verification. The list is rendered before a read request. Switching back to Share keeps the draft intact and clears the hidden feed. Popup feed scroll position is restored on rerender, with a reset when selecting another room.

Verified video links use chrome.tabs.create through the extension's own API instance, so Chrome opens Chrome and Brave opens Brave rather than using the OS default browser. No tabs-reading or other new permission is added. HTTP previews use ordinary target=_blank links; actual extension URL automation remains blocked, and preview checks do not establish the extension API's runtime behavior.

The full-page composer is smaller through HTML/CSS changes only. No server, database, encryption, or hosted-page redeployment is necessary for this release.
