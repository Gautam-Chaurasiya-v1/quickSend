---
name: quicksend-feature
description: Implement or change QuickSend onboarding, room sharing, invitations, identity pairing, or storage behavior while preserving extension and encryption protocol boundaries.
---

Read root AGENTS.md, docs/ARCHITECTURE.md, and the relevant section of docs/SECURITY.md. Consult docs/STATUS.md for source versus live deployment gaps.

Trace app.js → compose.js, client.js, or pairing.js → api.js → worker.js as relevant before editing. Capture/room selection/draft rules are in compose.js and tests/compose.test.js; keep capture restricted to invocation metadata. Keep DOM interaction in app.js and use cases in the library. Preserve identical popup/full-page shells.

For data changes, add a numbered migration and test it with createDatabase(), which loads all idempotent DDL migrations. Before non-idempotent migrations, add local migration tracking. Never edit deployed migration 0001.

For protocol changes, enumerate AAD, HKDF namespaces, pin checks, capability handling, retries, and old-code/backup compatibility. Use tests/pairing.test.js for transfers/invites, tests/client.test.js for outbox/cache, and tests/server.test.js for room authorization. Keep Web Crypto primitives.

Update CHANGELOG and canonical docs, then follow quicksend-verify. State backend migration/deploy requirements. Snapshots are not automatic synchronization or revocable device enrollment.
