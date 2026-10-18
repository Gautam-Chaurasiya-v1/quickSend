QuickSend 0.5.0 is a friend-beta release for desktop Chrome and Brave.

- Share and Inbox are now in the popup's top bar. Inbox opens inside the popup; switching back keeps the draft.
- Inbox uses compact rows, unread counts, room selection, refresh, and video links that open in the same browser running QuickSend.
- The full workspace has a much smaller sharing form and Cards/List controls with a remembered per-profile layout.
- Share mode does not mark messages read. Inbox acknowledges only the current visible/focused verified room, with guards against responses arriving after navigation.
- 22 automated tests pass. Chrome/Brave HTTP preview checks cover inbox navigation, unread behavior, draft preservation, browser link opening, and compact layouts. Actual extension runtime/lifecycle checks remain manual.

Download **quicksend-extension.zip**, extract it, open chrome://extensions or brave://extensions, enable Developer mode, choose Load unpacked, and select the extracted folder containing manifest.json. Keep that folder. For an existing installation, export an identity backup, replace files in the same folder, and click Reload on its extension card. Moving paths can change an unpacked extension's ID/local storage.

Use your own name and the default public server. Friends create separate identities and join invitations; Pair this browser is only for devices you own. Compare complete fingerprints before approval.

No new extension permissions, API/schema changes, paid resources, or backend deployment are required. This is not a Web Store installation; unpacked installation/updates remain manual. No mobile companion or independent security audit is provided. SHA256SUMS verifies the ZIP; checksums.json contains the packaged file hashes.
