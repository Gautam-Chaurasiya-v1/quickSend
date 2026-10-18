# QuickSend agent guide

QuickSend is a Manifest V3 extension for two-person encrypted YouTube sharing rooms. Read this file first; it applies to the entire repository. It works as plain Markdown for any coding agent. `CLAUDE.md` and the Cursor rule only point here.

## Start here

- Product, install, and local start: `README.md`.
- Boundaries and data flow: `docs/ARCHITECTURE.md`.
- Encryption, identity, and known limits: `docs/SECURITY.md`.
- Current work, release/deployment gaps: `docs/STATUS.md`.
- Verification evidence and manual checks: `docs/TESTING.md`.
- Deployment identifiers and procedure: `docs/DEPLOYMENT.md`.
- Free distribution and version-tag publication: `docs/DISTRIBUTION.md`.
- Design conventions: `docs/DESIGN.md`; rationale: `docs/DECISIONS.md`.
- Workflow: `CONTRIBUTING.md`; history: `CHANGELOG.md`.

## Commands and layout

Node 24+, no dependency install required. `npm run dev` serves loopback port 8787; `QUICKSEND_PORT=8788 npm run dev` avoids an existing server. `npm run verify` checks syntax, tests the real handler against SQLite, and builds `dist/extension` plus checksums.

`extension/app.js` controls DOM; `lib/client.js` owns room use cases; `lib/pairing.js` owns device transfer; `lib/compose.js` owns invoked-tab capture, destination choice, and draft restoration; `lib/crypto.js` owns versioned encryption; `lib/storage.js` abstracts profile storage. `server/worker.js` is the API and scheduled cleanup. `server/landing.js` serves the isolated invite page. `server/dev.js` and tests reuse these handlers. Add numbered SQL migrations; never rewrite an already deployed migration.

## Invariants

- Keep `extension/app.html` and `popup.html` byte-identical. Popup behavior is a body class selected by path.
- Keep the popup focused on destination, three fields, and Send; inbox/management belong in full view. Do not mark hidden inbox messages read.
- No content scripts, WhatsApp access, remote executable code, telemetry, external thumbnails, or broad required host permissions. Backend access is optional and requested on a user gesture.
- Keep message AAD, room wrapping, device transfer, and backup formats versioned and separated. Never silently change the v1 wire protocol.
- Room approval pins the exact peer key. A room has two members maximum, including pending. Closing either active member closes the room; never reuse its key with a replacement peer.
- Persist encrypted outbox entries before transmission. Retry the same message ID and ciphertext; never retry by encrypting a new message.
- Device transfer copies an identity and its current room keys. Verify both fingerprints. It is a snapshot, not continuous sync or independently revocable device accounts.
- The relay stores only hashed capability and ciphertext. Never log keys, bearer tokens, invitation/pairing codes, backup plaintext, or credentials.
- Production JSON API accepts extension origins only. Loopback preview origins require DEV mode. Invite landing page cannot call the API.
- Treat browser/page content as untrusted. If automation blocks extension URLs, document the coverage gap; do not bypass it via native UI or another surface.

## Changes and handoff

Make focused changes, add behavior tests for protocol/auth/storage changes, run `npm run verify`, and record actual evidence. Update relevant canonical docs and CHANGELOG with the final behavior, limitations, and migration/deployment needs. Keep generated files, databases, downloads, credentials, and QA screenshots out of Git. Do not claim production deployed or a browser check passed from local tests alone.

The user controls release, billing, and publication intent. Respect their session authorization; do not add blanket approval requirements. Stay on the free services unless they explicitly authorize otherwise. Inspect the configured Git remote and remote history before pushing; do not force-push shared history.

## Project skills

Repository skills live in `.agents/skills/`. Agents with skill discovery can load them; any other agent can read their `SKILL.md` directly:

- `quicksend-feature`: changing room, onboarding, or pairing behavior.
- `quicksend-verify`: verifying a change and recording honest coverage.
- `quicksend-deploy`: deploying this Worker/D1 without exposing credentials or changing plans.

Keep knowledge in the canonical documents rather than duplicating it across agent-specific files.
