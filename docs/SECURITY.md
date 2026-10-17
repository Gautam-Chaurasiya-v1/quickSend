# Security model

QuickSend is a small two-person sharing application, not an audited secure messenger. The design reduces exposure by sharing only an explicitly chosen YouTube link and optional note. It does not access WhatsApp, contacts, cookies, browser history, microphone, or all-page content.

## Trust and identity

An installation generates a random 256-bit bearer token and a P-256 ECDH key pair. The token is authenticated over HTTPS; only its SHA-256 digest is stored by the service. Public keys are immutable for a registered device ID. HTTP is allowed only for localhost/127.0.0.1 development.

This is a device identity, not email-based user authentication. Anyone with a token can act as that device. Anyone with the extension’s full local storage or a decrypted backup has both that token and its encryption keys. Backend operators can revoke credentials by deleting the identity after removing its room references, but no self-service account-management system is included yet.

A room starts with its owner. A 256-bit invitation capability expires after 15 minutes and is single-use. The service stores its digest. The invite also includes the owner’s public-key fingerprint. The joiner checks this fingerprint against the returned owner key. Before approving, the owner must compare the joiner’s full fingerprint over another trusted channel. A leaked invite can cause a pending request or denial of service; it cannot by itself decrypt room messages. Rejecting/cancelling a request does not reset its consumed invite. Invite rotation revokes previous codes.

The service atomically claims invitation tokens and enforces two room members with a database trigger. Every messages/read/invites/approval endpoint checks authenticated membership or owner role. Pending members cannot read messages or invite others. A pending cancellation removes that request only. Leaving an active room closes it for both people, so its old key is never reused with a replacement member.

## Encryption format v1

- Room key: 32 random bytes from Web Crypto’s cryptographically secure random generator.
- Content: AES-256-GCM, fresh 96-bit IV per encryption, 128-bit authentication tag.
- Authenticated context: `quicksend:message:v1:<room-id>:<sender-id>:<message-id>`.
- Pairing: P-256 ECDH → HKDF-SHA-256 with room ID as salt and a fixed versioned application context → AES-256-GCM room-key envelope.
- Key-envelope context binds room ID, owner ID, and recipient ID.
- Backup: PBKDF2-SHA-256 (600,000 iterations, random 128-bit salt) → AES-256-GCM with a separate backup context. Minimum password length is 12; length alone does not ensure a strong password.

Algorithms use Web Crypto, not handwritten cryptography. This pairing/transport protocol is application-specific and has not been independently audited. These are long-lived room keys without forward secrecy, signed device certificates, key transparency, or a ratchet. A compromised device can expose its room history. Displaying correct fingerprints protects only if users actually compare them through an authentic separate channel.

## Service hardening

The API uses parameterized SQL, UUID validation, a streamed 16 KB ordinary-request cap (100 KB for device snapshots), bounded ciphertext, generic internal errors, and no payload logging. It rejects foreign website origins, disallows credentialed cross-origin requests, and requires bearer authentication. CORS is not authorization; other extensions and non-browser clients still need valid credentials. No remote scripts, HTML rendering of user content, external thumbnail requests, or URL metadata scraping are used.

Application limits: 20 registrations per IP-derived bucket per hour, 100 authenticated API requests per identity/minute, 300 sends/day, and 10 rooms per identity. Registration bucket keys hash the day and Cloudflare-supplied IP; these are pseudonymous, not anonymous, and expire. Rate bookkeeping lives in D1 and is not a replacement for provider edge DDoS protection. Public deployments may require Turnstile and stricter account-level quotas. Free-tier limits may produce an outage.

The scheduled Worker removes expired invitations, expired rate buckets, and messages older than 90 days. D1/provider backups may retain deleted rows beyond their removal from the live database. Identity records persist until explicitly removed by the service operator; automate account deletion and broader retention before serving a public audience at scale.

## Release requirements

Before a public launch: perform a deployed Worker/D1 smoke test, independently review cryptography and authorization, test unpacked/package behavior in supported browser versions, verify permissions and disclosures, define an identity revocation and recovery process, add operational alerts and a privacy policy appropriate to your jurisdiction, and decide how to handle abuse and account deletion. These are explicit release limitations, not claims that the current code has undergone those reviews.

Report a suspected issue privately to the project maintainer. Do not include bearer tokens, private keys, backup passwords, or live invitation codes in public issue reports.


## Device pairing and invitation links (0.3)

Device pairing copies private identity material **only inside an encrypted snapshot** to a device the user explicitly verifies. The recipient generates an ephemeral P-256 key pair; the relay never receives its private key. ECDH/HKDF uses the existing key derivation with a `device:<session UUID>` salt namespace; AES-GCM uses `quicksend:device:v1:<session UUID>` additional data. Each encryption has a fresh 96-bit random IV. The sender pins the recipient key against the pasted request and compares the full fingerprint. The recipient binds the restored public key to the sender key and compares the full sender fingerprint before installation.

The relay capability is a separate random 256-bit value, stored server-side only as a hash, sent over HTTPS Authorization, and required for reading, publishing, or deleting the session. It does not decrypt a snapshot. Anyone obtaining the code can read its ciphertext, cancel it, or publish a conflicting snapshot first (denial of service); successful impersonation still requires defeating the independently compared key fingerprints. Never skip either comparison. The server can observe public keys, ciphertext size/time, and traffic correlation. The relay accepts one immutable approval, supports identical retries, rejects expired sessions immediately, and physically removes expired rows in daily cleanup. Cancellation or successful receipt deletes the row. A lost delete response can leave ciphertext until cleanup.

The snapshot shares the same bearer identity across browsers; there is no independent device revocation, automatic synchronization, or forward secrecy. A compromised paired browser compromises that shared identity. Pair only a trusted device you own. Ephemeral receiving keys stay in profile storage until completion/cancellation; an expired local session is replaced when pairing restarts. Backups remain password-protected because files are long-lived recovery artifacts rather than an approved live device transfer.

Invitation links place the capability in a fragment, which HTTP requests omit. The isolated landing page has no network/API permission and clears the current fragment after reading. It cannot prevent clipboard exposure, screenshots, browser synchronization before clearing, a malicious browser extension, or a maliciously modified served page. Only room owner approval grants content access. Legacy invitation codes and v1 room/message/backup formats remain supported. QR codes are generated by locally bundled code with no external QR provider.
