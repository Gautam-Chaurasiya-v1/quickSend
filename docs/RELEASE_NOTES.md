QuickSend 0.4.0 is a friend-beta release for desktop Chrome and Brave.

- Compact 360px sharing popup: destination, YouTube link, title, optional note, and Send.
- Captures the active YouTube link/title when invoked, removes tracking, remembers your room, restores matching drafts, and supports Ctrl/Command + Enter.
- Full room management and inbox remain available from Rooms & inbox. Merely opening the sharing popup does not mark inbox messages read.
- Encrypted two-person rooms and approved browser pairing use the existing Free-plan backend.

Download **quicksend-extension.zip**, extract it, open chrome://extensions or brave://extensions, enable Developer mode, choose Load unpacked, and select the extracted folder containing manifest.json. Keep that folder; the browser loads files from it. For updates, back up your identity, replace files in that same folder, and click Reload on the extension card. Moving to a different unpacked path can change the extension ID and its local storage.

Use your own name and the default public server. Your friend creates their own identity and joins a room invitation; Pair this browser is only for devices you own. Compare full fingerprints before approval.

This release is not a Web Store installation and does not auto-update installed unpacked copies. A browser-required manual installation remains. No new extension permissions were added. Actual activeTab capture and MV3 lifecycle checks still require manual verification; see docs/TESTING.md. No mobile companion or independent security audit is provided.

SHA256SUMS verifies the ZIP; checksums.json contains hashes of the extension files. Source and detailed change history are included in the repository.
