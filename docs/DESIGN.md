# Interface and design conventions

The app uses a custom CSS design system in `extension/app.css`, with system sans-serif fallback (Inter is named but no remote font is fetched). Primary green `--green: #215e48`, muted text `--muted: #7e8b81`, borders `--line: #e1e7de`, mint `--mint: #e6efdc`, and cream `--cream: #f8f9f5` anchor a quiet, personal shared shelf.

Use existing `button primary`, `button secondary`, `icon-button`, `settings-row`, `modal-actions`, and `fingerprint` patterns. Keep destructive actions separate and explain their effect before confirmation. User content goes through textContent/DOM nodes, never interpolated HTML. Keep form labels explicit and use role=status for async notices. Required fingerprint checkboxes must stay accessible and block continuation until checked.

The desktop uses a 250px room sidebar and a fluid main panel. Breakpoints at 850px and 600px adapt the view. The popup adds a `popup` body class, uses a 360px width, and scrolls dialogs within its height limit. Test long server URLs, fingerprints, invitation text, and small viewport layouts. Prefer existing CSS tokens over a parallel component library. Keep focus-visible outlines, reduced-motion support, native form validation, and semantic buttons.

Onboarding defaults to the public server with Advanced for overrides. Browser pairing is a guided verification flow. Backups are secondary recovery tools. QR generation is local; no external QR service receives invitation capabilities. The invitation help page intentionally uses a small separate stylesheet and cannot make network/API requests.

Accessibility contrast and broad assistive-technology behavior have not been independently audited; do not claim full WCAG compliance from the current checks.


The popup is a sharing tool rather than a miniature inbox. Its default view is the destination plus exactly three fields and Send; use a dropdown only when there is more than one room. Keep the single room name visible. No hero copy, card feed, sidebar, or room management section belongs in the ready-to-send popup. Keep pending/empty/error states actionable. Full view retains the larger room/inbox layout. The measured HTTP preview ready-to-send surface is about 360 × 403 px before a success notice.
