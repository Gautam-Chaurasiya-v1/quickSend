# Current status and next handoff

Source release: **0.3.0**, October 18, 2026. The 0.3 backend is deployed on the public default origin with migration 0002 applied; consult DEPLOYMENT.md for the actual version record. Do not assume a source push deploys Cloudflare: CI verifies and packages only.

Implemented: two-person encrypted YouTube sharing; owner approval and pins; idempotent encrypted outbox; unread polling; offline cache; encrypted recovery backups; default server onboarding; legacy/code/link invitation parsing; local QR; isolated invite landing page; expiring approved browser identity snapshots.

Validated: `npm run verify` (17 tests), Chrome → Brave HTTP preview device pairing with both fingerprint comparisons and the same room appearing in Brave. This caught and fixed `.mjs` MIME serving. Earlier 0.2 Chrome preview tests covered bidirectional sharing, invalid URLs, and owner approval; the updated live backend passed 12 room/API checks and 8 pairing/landing checks. See TESTING.md for precise coverage.

Remaining release checks: extension optional-host permission gesture, active YouTube tab capture, worker suspension/restart, alarms/badge, popup closure retry, encrypted file restore via actual chooser, and Brave extension installation/runtime. Browser automation blocked extension URLs; do not claim those checks passed. QR rendered and its encoded input is tested; physical camera scanning is not verified.

Known product limits: desktop Chromium extension, two people per room, YouTube only; no WebSockets, mobile companion, automatic key sync, independent device revocation, password reset, forward secrecy, or security audit. The invitation link still needs copy-and-paste into the unpacked extension.

Suggested next work: run the extension release checklist on both browsers; improve continuous device key synchronization only with a protocol design; then evaluate reactions/per-video saved state and measured push delivery. Preserve the free-plan constraint.
