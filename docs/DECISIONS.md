# Engineering decisions

## 001 — Native modules and a shared API handler

Use plain JavaScript, Web Crypto, HTML/CSS, Worker Fetch APIs, and SQL. This keeps extension CSP strict, avoids a bundler/toolchain installation for contributors, and lets local integration tests exercise the real handler. Add dependencies only for concrete capabilities; QR encoding uses a pinned, locally vendored implementation with attribution. Revisit a UI framework if interface complexity justifies migration, rather than adding one preemptively.

## 002 — Polling for v1 delivery

Polling is implemented and used by UI/background today. It tolerates MV3 suspension and requires no persistent connection coordination. It costs repeated Worker/D1 requests and introduces 15-second visible/one-minute background delays. WebSockets could reduce idle polling and latency, but need reconnect/catchup, worker-lifecycle handling, authenticated subscription semantics, and measured free-tier capacity. Retain polling until those requirements are implemented and tested. This is a tradeoff, not a claim that polling is always cheaper.

## 003 — Approved device snapshots

Password-free pairing uses ephemeral ECDH and an expiring ciphertext relay with two fingerprint comparisons. It copies a current identity rather than creating a new account/device registry. This preserves the two-person room model and avoids passwords/files during normal device setup. It also means no per-device revocation, no automatic key sync, and no forward secrecy after identity compromise. Revocable device credentials and signed device enrollment need a separate protocol design before implementing them.

## 004 — Invitation fragments and a small landing page

Use `https://server/invite#invite=...` so HTTP requests omit the invitation capability. The landing page uses local script/style, no analytics/network, no-referrer, and clears the fragment from its current history entry. Clipboard, browser history synchronization before clearing, screenshots, and anyone receiving the link can still expose the invitation. An unpacked extension has no stable public launch address; the link displays a copy-and-join instruction instead of silently launching or joining. Legacy codes remain supported. QR scanning helps transfer a link; it does not provide mobile room access.

## 005 — Shared agent knowledge

AGENTS.md is the cross-model entry point. Agent-specific adapters point to it. Architecture, security, deployment, and test evidence remain canonical Markdown. Project skills provide focused procedures and link those documents instead of copying them. No external memory service, paid agent service, or model-specific runtime is required.
