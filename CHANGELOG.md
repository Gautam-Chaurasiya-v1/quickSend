# Change log

## 0.3.0 — 2026-10-18

- Default to the existing public QuickSend server; keep a self-hosting override under Advanced.
- Copy private invitation links and display locally generated QR codes. Accept both links and legacy `qs1.` codes in Join.
- Serve a network-isolated invitation landing page. Invite capability stays in the URL fragment and is removed from the current history entry after reading. Opening it does not automatically join or open an unpacked extension.
- Add “Pair this browser” and “Add my other browser / device”. Transfer an encrypted identity/room-key snapshot through a 10-minute relay; compare complete receiver and sender fingerprints; no backup password or file needed.
- Add migration `0002_device_pairing.sql`, capability-scoped relay endpoints, immutable approval, idempotent retries, cancellation, expiration checks, and retention cleanup.
- Reuse snapshot validation for backup restore. Keep password-encrypted backups for recovery and offline storage.
- Add pinned local QR generator, license notice, migration discovery in local SQLite, `.mjs` syntax/MIME support, and configurable local test port.
- Add cross-agent guidance, project skills, contributor workflow, architecture and design notes, decisions, status, PR/issue templates, and CI build artifact upload.
- Verification: 17 automated tests; Chrome-to-Brave preview pairing and invitation rendering. See `docs/TESTING.md` for gaps.

Deployment of 0.3.0 requires applying migration 0002 before deploying the Worker. See `docs/STATUS.md` and the deployment record for actual live state.

## 0.2.0 — initial application

- Two-person rooms, single-use expiring invitations, owner-approved fingerprint pinning, encrypted YouTube links/titles/notes.
- Paginated inbox, unread cursor/badge, persistent encrypted outbox, idempotent sends, offline cache, password-protected backups.
- MV3 Chrome/Brave package, local SQLite development server, Cloudflare Worker/D1 backend, retention and abuse limits.
- Initial deployed API passed 12 live smoke checks. Full extension lifecycle remains a manual release check.
