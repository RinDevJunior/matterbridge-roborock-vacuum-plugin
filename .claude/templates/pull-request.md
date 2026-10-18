<!--
Pull request template. Fill every section; delete a section only if it truly does not apply.
Keep it short and in simple English. Do NOT add a Claude session link or any "Generated with" line.
Title: conventional-commit style, general, no tool or source names
(example: `feat: report Matter reachable when a robot goes silent`).
-->

## Summary

<!-- 1 to 3 sentences: what this PR does and why, from the user's point of view. -->

## Changes

<!-- One bullet per change (add the commit id in backticks when there are several commits).
     Say what changed and the effect. Mention new config options with default values.
     Mention behavior changes explicitly. -->

- `abc1234` What changed and its effect.

## Testing

<!-- Tick only what you ran. Say plainly what was not tested. -->

- [ ] `npm run precommit:ci` (lint, type-check, duplicate check, format, tests)
- [ ] `npm run format:ci`
- [ ] `npm run lint:fix:ci`
- [ ] `npm run type-check:ci`
- [ ] `npm run test:ci`
- [ ] Manually verified on <robot model / Matterbridge version>: <what was checked>

## Related issue

Closes/relates to #<number> or None
