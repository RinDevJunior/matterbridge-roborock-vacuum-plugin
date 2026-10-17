# Claude History

Entries are listed in reverse chronological order (most recent first). Older entries (2026-10-02 and earlier) have been moved to `workspace/claude_history_archive.md` to keep this file focused on recent work.

---

## 2026-10-17 — Filter life for V1, min Matterbridge 3.10.13/3.10.14, rc05/rc06 releases, PR #145 closed, wiki refresh (PRs #173, #183, #185)

**Task:** Batch of changes since 2026-10-12: V1 filter life, minimum Matterbridge bumps, prerelease publishing, PR #145 review, wiki refreshes.

**Changes:**

- `src/**` (V1 filter life) — filter life via HepaFilterMonitoring, behind `enableFilterMonitoring` (default OFF; Q10 excluded) (PR #173, commit 842c5b6)
- `package.json` — minimum Matterbridge 3.10.13 (PR #183, f03153a); 3.10.14 (PR #185, c1737a3). Release notes checked: no code impact; Node 22.13+ requirement is below our Node 24
- Releases 1.2.0-rc05 (edbd0ff) and 1.2.0-rc06 (2c9496d) published as prereleases + Discord announcement
- PR #145 (MQTT health monitor) reviewed; architecture review said do-not-merge-as-is; commented and closed. Branch `worktree-mqtt-reconnect-health-backoff` kept; notes in `workspace/review-pr-145-mqtt/answer.md`
- `wiki` — refreshed for rc06 (wiki 53a2e59, pointer d059d2a); then wiki af8224e for the selectAreas fix; main-repo wiki pointer moved to af8224e in PR #185

**Outcome:** Pass. Releases and PRs as listed above.

---

## 2026-10-16 — INCIDENT: scheduled Apple Home clean did not start (PR #184)

**Task:** Investigate Oct 14–16 incident where a scheduled Apple Home clean did not start, and fix it.

**Changes:**

- `src/behaviors/roborockServiceAreaServer.ts` — selectAreas/skipArea no longer await `device.updateAttribute('progress')` inside the command transaction; state written directly in handler; `finalizeSkipArea` returns values
- `src/**` (7 fire-and-forget handlers) — `.catch` + error log added; `CHANGE_TO_MODE` must not be awaited
- `src/tests/**` — regression tests for the hang (PR #184, b7adbed)

**Outcome:** Pass. Root cause: self-deadlock in selectAreas/skipArea awaiting an attribute update inside the command transaction; stuck tx 0450d8ec blocked every later selectAreas. Exposed since #175 kept finalized progress after docking. Details: `workspace/investigate-selectareas-hang/answer.md`. Workaround before release: restart Matterbridge. NOT in a release (user asked not to release); not tested on a real device.

---

## 2026-10-12 — Whole-project test coverage, B01 UDP client fix, persisted cleaning state flag, 08:00 clean investigation (PRs #180, #181, #182)

**Task:** (1) Investigate unexpected two-room clean at 08:00. (2) Fix issue #179 (B01 UDP client leak). (3) Add opt-in persistence of cleaning run state (PR #181). (4) Raise whole-project test coverage (PR #182). Also closed #161 and #170 (Windows-safe CI scripts, coverage gaps).

**Changes:**

- `src/platform/**` / B01 local-network path — `LocalNetworkUDPClient` stored in `udpClientMap`, closed on re-init and shutdown, created only on the fall-through path (PR #180, issue #179 closed)
- `src/**` (cleaning run state) — persist run state behind `advancedFeature.settings.enablePersistCleaningState` (default OFF); node-persist key `cleaningRun:<duid>`; V1 only; restore is confirmed/discarded by first status; 3 h validity; flag OFF deletes saved data; no shutdown flush; reviewer fix: confirmed restore never clears record (PR #181)
- `src/tests/**/*.gaps.test.ts` — 71 new gap test files (PR #182); Node 25 fix: `engines.node` set to `>=24 <25`, real Node.js row logs an error, test pins `process.versions.node`
- Coverage: without `src/cli` lines 99.8 / branches 98.4; raw with CLI 89.5 lines / 88.4 branches

**Outcome:** Pass. Merged to dev: 73aaa6b (#180), 2fd9fd9 (#181), 43da1ad (#182). Investigation result: the 08:00 two-room clean was started by the 08:00 selectAreas, but at 08:19:43 an external Matter `rvcOperationalState.goHome` command from the same controller session sent the robot home. Plugin behaved correctly; no code change. Sender of the command is unknown.

---

## 2026-10-11 — Apple Home stale progress on Start (PR #176, release 1.2.0-rc04)

**Task:** Fix Apple Home showing previous run's ServiceArea progress for 10–60+ s after tapping Start. Root cause: CleaningModeHandler only cleared the AreaManagementService mirror, never the Matter `ServiceArea.progress` attribute.

**Changes:**

- `src/types/roborockVacuumCleaner.ts` — new `resetProgressForNewRun()` (writes attribute + mirror; no-op while actively cleaning = resume guard); run end clears currentArea/estimatedEndTime and resets session timers
- `src/behaviors/roborock.vacuum/core/modeHandler.ts` — onCleaningStart callback added to mode handler contract
- `src/behaviors/roborock.vacuum/handlers/cleaningModeHandler.ts` — calls onCleaningStart; transition reset seeds Pending instead of `[]`
- `src/platform/deviceConfigurator.ts`, `src/share/behaviorFactory.ts` — thread onCleaningStart through to HandlerContext
- `src/runtimes/handlers/serviceAreaHandler.ts` — `buildPendingProgressSeed` seeds Pending rows from selectedAreas or all rooms of active map
- `src/runtimes/handlers/operationCompletionTracker.ts` — run-end handling aligned with reset
- Tests: `cleaningModeHandler.test.ts`, `behaviorFactory.test.ts`, `deviceConfigurator.test.ts`, `operationCompletionTracker.test.ts`, `roborockVacuumCleaner.test.ts`, `serviceAreaHandler.test.ts`

**Outcome:** Pass (all verification gates). Merged to dev as 239dd35. Fast polling intentionally unchanged. Known limitations: Idle-code status between Start and first active status can clear Pending seed; mid-run recharge resume and plugin restart mid-run reset finished rooms to Pending. Codecov: 1 uncovered changed line.

---

## 2026-10-11 — Finalize ServiceArea progress on run end (PR #175, release 1.2.0-rc03)

**Task:** Fix rooms not showing Completed after a clean. Root causes: no run-end finalization, and `isActivelyCleaningOperationalState` was a blacklist so Docked→Charging(65) wiped progress to `[]`. Also live-device investigation via Grafana/Loki matterbridge logs (state, supportedAreas/selectedAreas/progress, `map_status >> 2` = mapId).

**Changes:**

- `src/behaviors/roborockServiceAreaServer.ts` — cherry-picked native Matterbridge 3.10.12 progress/skipArea API (PR #174) onto branch; 6 failing unit tests fixed (test-only: mocks, optionsFor assertions)
- `src/runtimes/handlers/serviceAreaHandler.ts` — active-state whitelist (SeekingCharger kept active); `finalizeProgressOnRunEnd` (Operating→Completed, never-visited Pending→Skipped); finalized progress kept until next real start; Idle branch no longer wipes it; Docked/Charging guard
- `src/types/roborockVacuumCleaner.ts` — progress option wiring for native ProgressReporting
- `vite.config.ts` — native Vite `resolve.tsconfigPaths` replaces vite-tsconfig-paths
- `src/tests/**` — deprecated `X.Cluster.id` → `X.id`; test updates for finalization
- `.claude/statusline-command.sh` — status line shows Claude Code version + update indicator (cache `~/.claude/cache/claude-code-latest-version`, 6h)
- `package.json`, `package-lock.json`, `README.md`, `docs/onboarding.md`, `wiki` — lockfile and wiki committed

**Outcome:** Pass (all verification gates). Merged to dev as f418e34. Release 1.2.0-rc03 (bump 68ce3f7; GitHub prerelease + Discord).

---
