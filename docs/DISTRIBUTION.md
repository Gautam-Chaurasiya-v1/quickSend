# Free distribution and release procedure

The public GitHub repository hosts versioned release downloads. No paid hosting, custom domain, registration, or additional Cloudflare service is needed for this beta distribution.

Permanent download link:
https://github.com/Gautam-Chaurasiya-v1/quickSend/releases/latest/download/quicksend-extension.zip

Release page:
https://github.com/Gautam-Chaurasiya-v1/quickSend/releases/latest

The invitation page links to this ZIP and install instructions after the corresponding Worker deployment. The ZIP contains manifest.json at its root, ready for extraction and Load unpacked. Unlike expiring CI artifacts, release assets have a stable public URL and can be downloaded without a GitHub login for this public repository. The latest link advances when a new non-prerelease release is published. This is a beta product even though the release is marked latest for download-link compatibility.

## Publish an authorized version

1. Finish implementation and update package.json and extension/manifest.json to the same numeric version.
2. Update CHANGELOG, docs/RELEASE_NOTES.md, TESTING and STATUS with actual verification and remaining gaps.
3. Run npm run verify, then npm run package (packaging requires the standard zip utility; it is available on macOS and the Ubuntu CI runner).
4. Inspect the ZIP, hashes, source diff, and configured remote. Commit and push the version to the authorized repository.
5. When release publication is authorized, create and push a matching version tag such as v0.4.0. Do not move an existing published tag.
6. The Release extension workflow validates tag/package/manifest agreement, runs verification again, packages the extension, and publishes the ZIP, SHA256SUMS and file checksums. Only its release job has repository contents-write permission; ordinary CI remains read-only. There is no paid service or new persistent secret.
7. Check the workflow result and published files. Download the asset from the public URL, verify SHA256SUMS and manifest version, and record the result.

If release publication fails, investigate the run rather than moving the tag. Retry the failed workflow when appropriate. If a release already exists, inspect it before any upload/replacement; do not overwrite published bytes silently.

## What this automates

Build verification, ZIP creation, checksums, versioned download hosting, and release publication from an explicitly pushed version tag. It removes the need to send a ZIP individually to each friend. The current workflow is for this public GitHub repository; private-repository automation allowances differ.

## What remains for a later phase

Browser-required installation and updates of unpacked extensions remain manual. Keep each install in the same extracted folder; changing paths/IDs can strand profile storage. Export a recovery backup before updates. The extension cannot safely install or update itself by downloading executable ZIPs.

A Chrome Web Store listing would provide normal browser-managed install/update distribution. Direct invitation-to-installed-extension handoff also needs a stable extension ID, tightly allowed origin/message validation, explicit user confirmation, and tests. Neither is implemented here. They are separate from free HTTPS hosting; another hosting service cannot remove browser installation requirements. An independently designed web/PWA companion is another future option, not a feature of this release.

Official references:
- https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases
- https://docs.github.com/en/actions/reference/runners/github-hosted-runners
- https://developer.chrome.com/docs/webstore/publish
- https://developer.chrome.com/docs/extensions/reference/manifest/key
- https://developer.chrome.com/docs/extensions/reference/manifest/externally-connectable


## Published 0.4.0 — October 18, 2026

Version tag v0.4.0 points to aec2394b3f5031aa92716a0178897e4f2e514ee1. The Release extension workflow passed at https://github.com/Gautam-Chaurasiya-v1/quickSend/actions/runs/39114299967 and published the ZIP, SHA256SUMS, and checksums.json at https://github.com/Gautam-Chaurasiya-v1/quickSend/releases/tag/v0.4.0. Tag verification also passed at https://github.com/Gautam-Chaurasiya-v1/quickSend/actions/runs/39114299988.

The public latest/download/quicksend-extension.zip URL was downloaded without embedding credentials; its manifest reports 0.4.0, its SHA-256 matches the published SHA256SUMS, and all 20 archive files match checksums.json. The tag remains fixed; subsequent documentation-only commits do not replace its artifacts. Reports/downloaded validation files remain under ignored artifacts/release-0.4.
