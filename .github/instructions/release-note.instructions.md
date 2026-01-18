---
description: 'Guidelines generate release note'
applyTo: '**/**'
---

# Release Guideline

Follow these steps to ensure a consistent and reliable release process:

1. **Versioning Consistency**

- Update the `version` property in `package.json`.
  - Check the current version and increment the `rc` version.
  - Use the format `x.x.x-rcyy` (e.g., `1.1.1-rc01`).
  - `x.x.x` is the major version.
  - `-rc` stands for release candidate.
  - `yy` is the candidate version.
- Update the `buildpackage` command in `package.json` so the `.tgz` filename matches the new version (e.g., `matterbridge-roborock-vacuum-plugin-1.1.2.tgz`).

2. **Documentation Updates**

- In `README.md`, update the `Requires matterbridge@xxx` line to match the `precondition` version in `package.json`.

3. **Schema and Config Synchronization**

- Update the `version` in the `description` field of `matterbridge-roborock-vacuum-plugin.schema.json` to the new version.
- Update the `version` in `matterbridge-roborock-vacuum-plugin.config.json` to the new version.

4. **Source Code Alignment**

- In `src/module.ts`, set the `requiredMatterbridgeVersion` to match the required `matterbridge` version specified in the `precondition` field of `package.json`.

5. **General Best Practices**

- Double-check all version references for consistency before release.
- Automate these steps if possible to reduce manual errors.
