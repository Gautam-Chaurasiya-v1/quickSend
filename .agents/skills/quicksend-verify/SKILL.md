---
name: quicksend-verify
description: Validate QuickSend changes, reproduce pairing or delivery bugs, and record automated, browser-preview, extension, and deployed evidence without overstating coverage.
---

Read docs/TESTING.md and docs/STATUS.md. Run npm run verify on Node 24+. This checks JS/MJS syntax, manifest access, shell equality, real-handler integration tests, and build checksums. Investigate failures rather than merely rerunning.

For UI changes, run npm run dev; QUICKSEND_PORT=8788 avoids a busy 8787. Do not kill unknown processes. Different profiles or localhost/127.0.0.1 origins create independent identities, but all participants must choose the same API origin. Device pairing needs a fresh receiving profile; room joining needs a separate identity.

Use available browser-control tools for UI tests, not hidden storage mutations or direct browser protocol scripts. Inspect fresh state after actions. Use disposable QA identities. Never log or commit real tokens, pairing/invite codes, backup plaintext, or credentials. If extension URL automation is blocked, mark extension-only checks manual; do not bypass the restriction.

Record the environment and exact flows actually passed. HTTP previews do not prove MV3 host permissions, activeTab capture, alarms, badge, or lifecycle behavior. Follow the manual release checklist. Screenshots go under ignored artifacts.

Run node scripts/smoke.js with an explicit deployed origin only when authorized; it creates QA identities and closes its room. Report identity cleanup separately. Update TESTING/STATUS and include failures and limitations in the handoff.

For releases, follow docs/DISTRIBUTION.md: run npm run package after verify, validate the tag/version agreement, and check the downloaded public ZIP against SHA256SUMS and every file hash. Mocked tab metadata does not prove actual activeTab capture.
