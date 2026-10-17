# Contributing

Start with [AGENTS.md](AGENTS.md), which is also the cross-agent handoff guide. Use Node 24 or newer; no npm install is required. The project uses JavaScript ES modules, browser APIs, parameterized SQL, and the built-in Node test runner.

1. Read `docs/STATUS.md` and the relevant architecture/security notes before changing behavior.
2. Use a focused branch (agents default to `codex/<short-description>`). Keep protocol changes and schema migrations explicit.
3. Make the smallest coherent change. Keep popup and full-page shells identical, use DOM text nodes for user content, and preserve accessible labels, keyboard focus, and reduced-motion support.
4. Add meaningful tests for new protocol, authorization, retry, validation, or storage behavior. UI-only polish needs visual verification rather than implementation-mirroring tests.
5. Run `npm run verify`. When changing backend behavior, use the shared handler against local SQLite; add deployed smoke evidence when actually deployed.
6. Update CHANGELOG and relevant docs. State whether a migration or deployment is still needed and what remains manual.
7. Review `git diff --check` and staged files for secrets and generated artifacts. Open a PR when requested, or push to the user-authorized destination.

CI runs verification on pushes and pull requests. It has read-only repository permissions and performs no automatic deployment. Generated builds are reproducible with `npm run build`; release ZIPs are not source files.

Vendored dependencies must be pinned, carry their license and origin in `THIRD_PARTY_NOTICES.md`, and execute locally. Review upgrades explicitly; do not fetch executable code at runtime.

Do not add real credentials, user backups, browser profile data, live pairing codes, `.data`, `.wrangler`, or `artifacts` to commits. Public Worker/account/database identifiers are configuration, not credentials.

No project-wide open-source license has been selected yet. Third-party notices cover only their named components.
