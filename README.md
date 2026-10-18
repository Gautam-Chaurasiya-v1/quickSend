# QuickSend · private video rooms

A browser extension for the moment you think, “you have to watch this.” Two people pair once, then share YouTube videos in a private inbox. Chrome and Brave use the same MV3 extension.

**Status:** source release 0.4.0 adds a compact sharing popup and free automated GitHub release downloads, on top of invitation links/QR and approved browser pairing. See [current release/deployment status](docs/STATUS.md). Working local application and deployed Cloudflare Worker/D1 backend, with automated integration tests and browser-tested room pairing and bidirectional sharing. Chrome installation, popup rendering, and full-page opening were verified. Full extension lifecycle testing remains manual because browser automation blocks extension URLs. Not independently security-audited. Do not describe it as hack-proof or audited production software.

## Run locally — no accounts or purchases

Requires **Node.js 24+**. There are no npm-managed runtime dependencies and no install step.

```sh
npm run dev
```

Open http://localhost:8787. Enter your name; the preview selects `http://localhost:8787` automatically. Open Advanced to override it. Data persists in `.data/quicksend.sqlite` (gitignored).

Use `QUICKSEND_PORT=8788 npm run dev` to run on a different local port.

For a second independent identity on the same computer, open http://127.0.0.1:8787 in another tab, but enter **http://localhost:8787** as its shared server too. The two origins have separate local identities. This browser preview is a development convenience; deployed users use the packaged extension.

1. Create a room and copy the invitation.
2. The second identity joins using that code.
3. Compare its full fingerprint with the owner’s review screen, then approve it.
4. Paste a YouTube video in either room and share. Check it appears on the other side.

Invitations expire in 15 minutes and work once. The backend retains message ciphertext for 90 days. Each identity can belong to 10 rooms and send up to 300 videos per day. A room has at most two members, including a pending member.

## Load the extension in Chrome or Brave

For friends, [download the latest ready-to-load ZIP](https://github.com/Gautam-Chaurasiya-v1/quickSend/releases/latest/download/quicksend-extension.zip), extract it, and choose the extracted folder in step 2. No Node.js or build is needed. Keep the folder in place after installation. [Release and update instructions](docs/DISTRIBUTION.md).

For developers, build from source:

```sh
npm run verify
```

1. Visit `chrome://extensions` in Chrome or `brave://extensions` in Brave.
2. Enable Developer mode → Load unpacked → select **dist/extension**.
3. Pin QuickSend and open it from a YouTube video.
4. Enter your name. The public QuickSend server is prefilled; Advanced allows self-hosting. For local testing use `http://localhost:8787` while `npm run dev` is running.
5. Grant access to that specific backend when the browser asks. The extension requests no WhatsApp, contact, history, or page-content access.

**Localhost is only your own computer.** Two people on different computers need the public HTTPS backend described below. Your friend must use the same deployed server origin.

The 360px popup captures the active YouTube video’s canonical link and cleaned title when you click the extension. It opens your only room or remembers the previous room. With multiple rooms, change the destination using the compact To selector. Add a note if wanted, then Send (or Ctrl/⌘ + Enter). These are the only three input fields; room management and the inbox are under **Rooms & inbox**.

The popup restores drafts for the same video for up to 24 hours; a newly captured different video starts without the previous note. No new permissions, page scripts, title API requests, remote thumbnails, or background browsing capture are used. Full view supports pasted URLs and does not inspect other tabs. Opening the popup alone does not mark inbox messages read. If YouTube has not updated its tab title yet, the captured title may need editing; page-content scraping is not implemented.

### Use your identity in both Chrome and Brave

1. In the new browser's QuickSend onboarding, choose **Already use QuickSend? Pair this browser**.
2. Copy its pairing code to the existing browser: **Settings → Add my other browser / device**.
3. Compare the complete new-browser fingerprint and approve the transfer.
4. On the new browser choose **Check for approval**, compare the sender fingerprint with the existing browser, and confirm.

The transfer expires in ten minutes, uses end-to-end encryption, and does not require a password or backup file. It copies your identity and current room keys. Later room/key changes do not automatically sync, and devices cannot be revoked individually. Use a fresh profile as the receiving browser. Password-encrypted backup export/restore remains available for offline recovery.

Room invitations now copy a link and show a QR code generated locally. The link opens a small instruction page, where your friend copies the invitation into QuickSend. Legacy `qs1.` codes still work. A QR code transfers the invitation; there is no mobile companion yet.

## Deploy for $0 on Cloudflare

Use **Workers Free** + **D1 Free**, with the included `workers.dev` address. No domain, separate frontend host, email provider, paid authentication service, or external YouTube API is needed.

As checked on October 18, 2026:

| Service | Free allowance | Behavior at limit |
| --- | --- | --- |
| Workers | 100,000 requests/day | Free-tier requests can fail; upgrade is a deliberate choice |
| D1 | 5 GB total, 5 million rows read/day, 100,000 rows written/day | Queries fail when free daily quotas are exhausted |
| Extension | Load unpacked locally for free | Public Chrome Web Store publishing requires a one-time registration fee |

The open app polls every 15 seconds while visible. Each installed extension polls once a minute while the browser runs. Two always-running installations use approximately 2,880 background requests/day before open-window activity and retries. Other projects on the same Cloudflare account share relevant limits. Rate-limit bookkeeping also consumes D1 writes. Free quotas are finite and can change; see the official sources below.

### One-time setup

Create or sign in to your own Cloudflare account, staying on **Workers Free**. Then, from this project root:

```sh
npx wrangler@4.151.1 login
npx wrangler@4.151.1 d1 create quicksend
```

Copy the returned database ID into `server/wrangler.toml` at `database_id`, then:

```sh
npx wrangler@4.151.1 d1 migrations apply quicksend --remote --config server/wrangler.toml
npx wrangler@4.151.1 deploy --config server/wrangler.toml
```

Use the deployed `https://quicksend-rooms.<your-subdomain>.workers.dev` origin in both extensions. Verify `/v1/health` returns `{"ok":true,"version":1}`. No service-role secret is bundled in the client. Wrangler authenticates using your Cloudflare account; do not commit its credentials. This project has been deployed with Wrangler 4.151.1; see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). For your own separate deployment, replace both the account and database IDs in the configuration.

Keep the free plan; a paid plan is not needed for two people. Monitor Cloudflare’s usage dashboard. A public app with many users or hostile traffic may need stronger abuse protection, capacity changes, and a security review before wider release.

Official sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Chrome publisher registration](https://developer.chrome.com/docs/webstore/register).

## Architecture

```text
extension/
  app.html / popup.html     Full-page and popup shells
  app.js / app.css          Interface and interaction state
  background.js            Retry outbox, poll unread, update badge
  lib/client.js            Room and sharing use cases
  lib/api.js               Authenticated HTTP boundary
  lib/crypto.js            Versioned encryption and protected backups
  lib/storage.js           Browser storage and update serialization
  lib/validation.js        Shared input and URL validation
server/
  worker.js                Authenticated JSON API and retention job
  migrations/              Versioned database schema
  sqlite.js                D1-compatible local/test adapter
  dev.js                   Loopback-only development server
scripts/                   Checks and deterministic extension packaging
tests/                     Cryptography, validation, and API integration tests
```

Browser-native ES modules keep extension CSP simple and avoid remote scripts or an npm installation step. One pinned MIT-licensed QR encoder is vendored locally (see [third-party notices](THIRD_PARTY_NOTICES.md)). The backend uses standard Fetch/Web Crypto APIs and parameterized SQL. The local SQLite adapter runs the same request handler and schema as the Worker. No build-time secrets are bundled. The public default endpoint lives in `extension/lib/config.js`; self-hosters can override it in Advanced.

Messages have client-generated IDs. Retrying the same encrypted payload is idempotent. The last 40 encrypted messages per room and room metadata are cached locally for offline viewing; older pages require a connection. A persisted local outbox survives popup closure; the service worker retries transient failures once a minute. Permanent failures remain visible in Settings and can be discarded. No sending or badge updates happen while the browser is closed; previously uploaded messages remain on the server for the recipient.

## Security model and practical limits

Read [docs/SECURITY.md](docs/SECURITY.md) before deploying publicly. Content encryption is implemented, tested, and versioned; this is not a formal protocol audit.

- Only video URL, title, and note are encrypted. Display names, room membership, message sizes/times, and connection metadata are visible to the service/operator.
- Room names are local, delivered to the approved peer inside the encrypted key envelope.
- Compare fingerprints using a separate trusted channel. An invite contains a public owner fingerprint and an expiring capability, never a room key.
- Private device keys, authentication tokens, and room keys live in extension local storage, accessible only to trusted extension contexts. They are not protected from malware, an unlocked browser, or a compromised extension update.
- Backups are encrypted with the password you choose. There is no password reset or key recovery. An old backup may miss newer room keys or approvals.
- There is no forward secrecy or protection from the approved recipient copying content. Closing a room removes live server rows, but cannot erase recipients’ copies or provider backups instantly.
- No remote thumbnails, analytics, or automatic URL fetches. A video opens YouTube only when you click its link.
- UI preview data lives in website localStorage; use the extension for deployment. Production API CORS accepts extension origins only, with loopback website origins enabled solely in local development.

## Development and validation

```sh
npm test          # Encryption, auth, room membership, invitations, message delivery
npm run check     # Syntax, minimal manifest, matching popup/full-page shells
npm run build     # dist/extension + SHA-256 file checksums
npm run package   # Release ZIP + SHA256SUMS (requires system zip)
npm run verify    # All of the above
```

CI runs `npm run verify` on Node 24. A separately scoped tag-triggered workflow publishes free versioned ZIP releases; see [distribution](docs/DISTRIBUTION.md). There are no third-party test dependencies. Browser testing is recorded in [docs/TESTING.md](docs/TESTING.md). Local integration tests do not replace a deployed Cloudflare smoke test or testing extension lifecycle behavior in both browsers.

Potential next features: per-video saved/read state, reactions, push notifications, automatic device-key synchronization, audited account recovery, and a mobile companion. Keep future formats versioned and migrate database changes explicitly.

## Continue development with any agent

Start at [AGENTS.md](AGENTS.md), then [CONTRIBUTING.md](CONTRIBUTING.md). The shared guide links architecture, security, design, decisions, actual test evidence, and current status. Repository skills under `.agents/skills/` cover features, verification, and deployment; any agent can read their SKILL.md as plain Markdown. Claude and Cursor adapters point to the same guide. See [CHANGELOG.md](CHANGELOG.md) for release changes.
