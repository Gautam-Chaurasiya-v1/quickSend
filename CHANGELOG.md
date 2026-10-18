# Change log

## 0.4.0 — 2026-10-18

- Replace the popup dashboard with a compact 360px sharing surface: destination, link, title, optional note, and Send. Keep inbox/management in full view.
- Automatically capture/canonicalize the invoked YouTube tab URL and clean notification counts/YouTube suffixes from its title. Retain the existing activeTab permission and add no page scripts or metadata network requests.
- Remember the selected room, choose the only/first ready room when needed, preserve input while changing destination, and focus the optional note.
- Restore local compose drafts for the same video for up to 24 hours; prevent a different captured video from inheriting a note. Clear drafts after a sent or queued share.
- Add Ctrl/Command + Enter, visible sending/sent states, compact onboarding and pending-room handling. Do not fetch/mark inbox messages read from the popup.
- Add free GitHub release distribution: ZIP/checksum packaging, matching-version tag validation, tag-triggered release workflow, public download link, and invite-page install/download instructions. Installed unpacked extensions still require manual installation and updates.
- Update official CI action versions to their current Node-compatible releases and document release trust/permissions and beta limitations.

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
