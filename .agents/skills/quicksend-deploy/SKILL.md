---
name: quicksend-deploy
description: Package or deploy the QuickSend Cloudflare Worker and D1 schema, verify the live API, and update records while preserving the Free-plan constraint and credential boundaries.
---

Read AGENTS.md, docs/DEPLOYMENT.md, and docs/STATUS.md. Check session authorization and the exact account, Worker, database, and plan. Account/database identifiers are public configuration, not credentials; replace them for another account.

Run npm run verify. Use the official pinned Wrangler version from deployment docs, preferably with a temporary XDG_CONFIG_HOME and metrics disabled. Use interactive OAuth; never print auth files or tokens. Reuse existing valid authorization; request user involvement only when authentication requires it.

Dry-run the Worker bundle. Apply numbered D1 migrations before deploying code that uses them. Deploy with --config server/wrangler.toml, staying on the Free plan. No automatic CI deployment or force push is needed.

Verify health, invite landing CSP, and explicit-target API smoke. For pairing changes test capability denial, encrypted roundtrip, immutable approval, cancellation, and expiry on the intended environment. Record version ID, migration state, checks, and gaps in DEPLOYMENT/STATUS. A GitHub push does not establish live deployment.

Close disposable smoke rooms; delete only exact QA identity IDs when authorized. Keep reports in ignored artifacts without credentials. Log out temporary OAuth after completion. If cloud authentication is unavailable, finish packaging/docs and record deployment pending.
