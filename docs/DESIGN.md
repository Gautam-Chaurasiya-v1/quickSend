# Interface and design conventions

The app uses a custom CSS design system in `extension/app.css`, with system sans-serif fallback (Inter is named but no remote font is fetched). Primary green `--green: #215e48`, muted text `--muted: #7e8b81`, borders `--line: #e1e7de`, mint `--mint: #e6efdc`, and cream `--cream: #f8f9f5` anchor a quiet, personal shared shelf.

Use existing `button primary`, `button secondary`, `icon-button`, `settings-row`, `modal-actions`, and `fingerprint` patterns. Keep destructive actions separate and explain their effect before confirmation. User content goes through textContent/DOM nodes, never interpolated HTML. Keep form labels explicit and use role=status for async notices. Required fingerprint checkboxes must stay accessible and block continuation until checked.

The desktop uses a 220px room sidebar and a fluid main panel. Breakpoints at 850px and 600px adapt the view. The popup adds a `popup` body class, uses a 360px width, and scrolls dialogs within its height limit. Test long server URLs, fingerprints, invitation text, and small viewport layouts. Prefer existing CSS tokens over a parallel component library. Keep focus-visible outlines, reduced-motion support, native form validation, and semantic buttons.

Onboarding defaults to the public server with Advanced for overrides. Browser pairing is a guided verification flow. Backups are secondary recovery tools. QR generation is local; no external QR service receives invitation capabilities. The invitation help page intentionally uses a small separate stylesheet and cannot make network/API requests.

Accessibility contrast and broad assistive-technology behavior have not been independently audited; do not claim full WCAG compliance from the current checks.


The popup has two focused modes in a sticky header: Share and Inbox. Share defaults on open and contains the destination plus exactly three fields and Send. A dropdown appears only for multiple rooms. Inbox opens in the same popup using dense rows and a bounded scrolling region; video links open in the current browser. Unread count, refresh, settings, and the explicit full-workspace action are easy to reach. Preserve drafts and destination while switching modes. Room creation, identity verification, and advanced management remain in dialogs/full workspace.

The full-page composer is a compact horizontal strip on wide screens with aligned field labels and Send; use two columns or stacked controls when space is limited. The latest desktop preview measured about 78px composer height. Avoid hero text or a decorative capture card above the inbox.

Cards and List are complementary layouts. Cards use smaller decorative covers; List uses a small play target, title/note, sender, and date in about 58px rows on a wide desktop. Remember the full-page layout per browser profile. The popup always uses rows. Long row titles/notes truncate visually with full text available to assistive technology and tooltips. Keep keyboard focus and semantic list items. No remote thumbnails or additional metadata fetching is introduced.
