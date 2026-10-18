# Deployment record · October 18, 2026

The user explicitly approved deploying the `quicksend-rooms` Worker and creating/binding the `quicksend` D1 database using only Cloudflare's Free plan.

- API origin: https://quicksend-rooms.1internshipjourney.workers.dev
- Health: https://quicksend-rooms.1internshipjourney.workers.dev/v1/health
- Worker: `quicksend-rooms`
- D1 database: `quicksend`, ID `6ea164b1-3c6d-40fe-b8ca-a4849e63c800`
- Binding: `DB`
- Migration: `0001_initial.sql`, applied and recorded by Wrangler
- Deployed version: `e70ee7d1-546f-4962-a4c9-a172c43fb2d1`
- Daily retention schedule: `19 3 * * *` UTC
- Worker observability: disabled by the project configuration
- Deployment tool: official Wrangler 4.151.1

No paid plan, custom domain, billing upgrade, or additional paid product was enabled. The dashboard showed the Free allowances (100,000 daily Worker requests; D1 5 GB, 5 million rows read/day, 100,000 rows written/day). Account-wide usage and limits still apply.

The web code editor did not load, so deployment used the official CLI after user-approved OAuth authorization with user/account read, Workers Scripts write, D1 write, and required background access. CLI credentials were held in a temporary configuration directory, never in the project or test report. The temporary CLI session was logged out after deployment and cleanup.

## Live verification

`node scripts/smoke.js https://quicksend-rooms.1internshipjourney.workers.dev` passed 12 live checks: health, authentication rejection, registration, foreign-origin rejection, single-use invitation, pending-member read denial, approved encrypted key delivery, encrypted messages with idempotent retries, outsider rejection, unread/read acknowledgement, return-direction delivery, and room-close revocation.

The smoke test closed its room and deleted its message ciphertext. Its three disposable identities were then removed with a targeted D1 cleanup. No production user data was involved. The local report is in `artifacts/live-smoke-report.json`, and includes no credentials.

## Use the deployed backend

Open QuickSend and enter this origin in the server field:

```text
https://quicksend-rooms.1internshipjourney.workers.dev
```

Both people must use the same origin. The extension requests access only to the backend origin when connecting. The server hosts the API and, after the 0.3 deployment, an isolated `/invite` help page. Its root is not the extension UI.

The device identity is bound to the selected server. Local browser-preview QA identities are separate from the installed extension and from any new cloud identities. Do not assume local rooms migrate to the cloud.

For later deployments, run Wrangler login in your own environment, then deploy with `--config server/wrangler.toml`. The account/database IDs in that file identify this user-approved deployment; replace them before deploying into another account.


## Upgrade to 0.3.0

Run verification, then apply `0002_device_pairing.sql` before deploying the Worker. Existing v1 rooms/messages/invitations/backups remain compatible. The new extension defaults to the public origin; self-hosters should change config.js or use Advanced. The invite landing page ships in the Worker bundle, without an extra hosting service.

```sh
npm run verify
npx wrangler@4.151.1 deploy --dry-run --config server/wrangler.toml
npx wrangler@4.151.1 d1 migrations apply quicksend --remote --config server/wrangler.toml
npx wrangler@4.151.1 deploy --config server/wrangler.toml
```

For temporary credentials, prefix commands with `XDG_CONFIG_HOME=/private/tmp/quicksend-cloudflare WRANGLER_SEND_METRICS=false`, log in using the same prefix, and log out after completion. Do not commit credentials or CLI logs. GitHub push does not deploy Cloudflare.

Rollback: retain the additive pairing table and redeploy the previous Worker if needed. Existing rooms continue to work; pairing and invitation landing require the new Worker. Expired relay data needs the new scheduled cleanup or explicit operator cleanup. Do not drop tables containing user data as a routine rollback.


## 0.3.0 deployment — October 18, 2026

- Migration `0002_device_pairing.sql` applied successfully to the existing D1 database.
- Worker version `b03554a7-b367-4a12-b9cb-d2a24c3a54fe` deployed to the same public origin; cron and Free-plan resources unchanged.
- Wrangler bundle dry-run passed (22.45 KiB / gzip 6.52 KiB).
- Existing live room/API smoke passed all 12 checks again. The room was closed; its three exact disposable identity IDs were removed after the smoke test.
- `node scripts/pairing-smoke.js https://quicksend-rooms.1internshipjourney.workers.dev` passed 8 live checks: isolated invitation page/CSP, ten-minute session creation, wrong-capability denial, encrypted snapshot publication, idempotent retry, conflicting-approval rejection, receiver decryption, and relay deletion/access denial. This creates no registered identities and deletes its session.
- Live expiry waiting and physical QR scanning were not tested; expiration/retention are exercised against the shared handler in automated tests.
- Temporary OAuth refreshed the same previously approved account/user read, Workers Scripts write, D1 write, and required background access scopes; credentials remained outside the repository and the temporary CLI session was logged out after cleanup.

Reports are in ignored `artifacts/live-smoke-report.json` and `artifacts/live-pairing-smoke-report.json`. GitHub CI verifies and packages; it does not deploy this service.


## 0.4.0 scope

The extension popup and GitHub release automation change without a new database migration. The Worker change only adds the public release download button and installation steps to the isolated invitation page; API formats, room limits, encryption, cron, and Free-plan resources are unchanged. See the final deployment entry below for actual publication status. Release download publication is separate from Cloudflare deployment.
