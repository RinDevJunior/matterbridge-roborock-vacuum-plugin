# To Do

Completed items have been archived to `workspace/to_do_archive.md`. This file tracks active pending work only.

## Recently done

- [x] **selectAreas hang fix (PR #184, b7adbed)** — selectAreas/skipArea no longer await an attribute update inside the command transaction; stuck tx blocked later selectAreas. Not in a release; not tested on a real device
- [x] **B01 UDP client leak (issue #179, PR #180)** — client stored in `udpClientMap`, closed on re-init and shutdown; issue closed
- [x] **Closed #161 and #170** — Windows-safe CI scripts and coverage gap tests
- [x] **Whole-project coverage (PR #182) + Node 25 test fix** — 71 gap test files; `engines.node` `>=24 <25`; test pins `process.versions.node`
- [x] **CHANGELOG entry for rc05** — cover #179 and #181
- [x] **Release 1.2.0-rc05 and 1.2.0-rc06** — published as prereleases + Discord
- [x] **Min Matterbridge 3.10.13 (PR #183) and 3.10.14 (PR #185)** — no code impact
- [x] **PR #145 MQTT health monitor** — architecture review: do-not-merge-as-is; closed; branch `worktree-mqtt-reconnect-health-backoff` kept
- [x] **Wiki refresh for rc06 and selectAreas fix** — wiki 53a2e59, af8224e
- [x] **Finalize ServiceArea progress on run end (PR #175, rc03)** — active-state whitelist, run-end Completed/Skipped finalization, Idle/Docked guards
- [x] **Apple Home stale progress on Start (PR #176, rc04)** — resetProgressForNewRun on onCleaningStart; Pending seed from selectedAreas or all rooms

## Pending

### Implementation Tasks

- [ ] **Q10 RvcOperationalState badge follow-up (issue #166 residual)** — wiring in #166 fixes ServiceArea/room tracking only; Q10 sending raw 101/103 can still show "Error" on Matter RvcOperationalState badge; investigate extending fix to rvc-opstate badge (may require integration with stateResolver.ts or function.ts—differs from #166's localized serviceAreaHandler approach)
- [ ] **V1 legacy room fallback real-device validation** — confirm on a real V1 device (e.g. Roborock Qrevo Edge 5V1 used to validate legacy-map-info CLI) that currentArea correctly updates via new V1 fallback during actual clean where cleaning_info is absent from status pushes; underlying CLI/parser validated on real hardware, but live runtime wiring (throttled getHomeMap trigger + cache + serviceAreaHandler branch) not yet exercised end-to-end on real device
- [ ] **V1 zone/wall coordinate-unit real-device validation** — confirm on a real V1 device with configured virtual walls/no-go zones that wall/zone decoding in mapParser (blocks 9/10/12) uses correct coordinate units (assumed raw mm, same as robotPosition); diagnostic CLI (legacy-map-info-v2) validated logically but live device comparison needed
- [ ] **buildCleanCommand room collapse investigation (Bug B)** — app_start command sent without room list when "all rooms" selected; may relate to currentArea freeze symptom during global clean; marked for future investigation
- [ ] **Q10 S5+ battery reading investigation (postponed 2026-07-11)** — user reports incorrect battery capacity shown for Q10 S5+ (B01). Diagnosis so far (see `workspace/investigate-battery-capacity-q10/answer.md`): NO scaling/DPS-key bug found — bootstrap read, live V1 listener, and live B01/Q10 listener all read DPS 122 as a plain 0-100 percentage; the `*2` conversion to Matter's half-percent unit (`batteryStateHandler.ts:21`) happens exactly once and is the only write site for `batPercentRemaining`; no `batCapacity` (mAh) attribute exists anywhere in the plugin. Leading concern instead: B01/Q10 live battery updates depend entirely on an MQTT push or a local-poll request/reply round-trip (`pollingService.ts`); poll failures are only logged, never retried (`pollingService.ts:32-34`) — if pushes/replies stop after the initial bootstrap read, the Matter attribute could silently freeze on a stale value indefinitely. The available log capture (~54s) was too short to prove this reproduces — no poll cycle even completed in that window. Open questions to resolve when resumed: (1) get a longer debug-level log (10+ min) spanning a real battery change, check for recurring "Handling battery update" lines; (2) confirm user's `refreshInterval` config and local-network vs MQTT-only mode (`hasRealTimeConnection` took ~20s to flip true in the sample capture); (3) ask whether restarting the plugin makes the value jump to a new number then get stuck again (would confirm silent live-update failure vs. a fully broken path).
- [ ] **ChangeToMode(Mapping) support investigation** — deferred after confirming no dispatcher command exists across V1-protocol devices to trigger mapping run; roborock-gitlab reference repo not checked (not in allowlist) — revisit if user requests Mapping support later
- [ ] **B01/Q10 currentArea real-device validation** — confirm on a real B01 or Q10 device that `currentArea` updates correctly during multi-room cleaning and tracks which room the vacuum is in; prior implementation validated parsing/triggering logic on real Q10 S5+ but end-to-end runtime behavior not yet confirmed
- [ ] **RVC estimatedEndTime real-device validation** — confirm V1/B01/Q10 `clean_percent` tracks job progress reliably when `enableEstimatedEndTime` is on (B01/Q10 support added in 2026-09-20 task; V1 already verified); document accuracy limits (pauses, low percent, Home display lag)
- [ ] **RVC SkipArea real-device validation (native Matterbridge 3.10.12 API)** — confirm skip current room during multi-room clean on V10 (expects success); expect `InvalidInMode` on B01/Q7; refactored to native API in 2026-10-02 task
- [ ] **Live-device: full multi-room clean** — confirm Completed/Skipped stay after docking and next Start shows Pending immediately (PR #175/#176)
- [ ] **Live-device: pause→resume** — confirm progress is preserved across pause/resume (resume guard in resetProgressForNewRun)
- [ ] **Live-device: skip rooms (PR #174 native API)** — skip current room and skip non-active room during clean
- [ ] **Known limitation: Idle-code status between Start and first active status** — can clear Pending seed; investigate guard
- [ ] **Known limitation: mid-run recharge resume and plugin restart mid-run** — reset finished rooms to Pending; decide whether to persist/restore
- [ ] **Status line command path is relative** — `.claude/settings*.json` status line breaks if cwd leaves repo root; not fixed
- [ ] **Idea: log Matter command sender** — record the controller/session identity for incoming RVC commands (not started). Also the open question from the 2026-10-12 08:00 two-room clean investigation: root cause was an external Matter `rvcOperationalState.goHome` at 08:19:43 from the same controller session; plugin behaved correctly; sender still unknown
- [ ] **Persisted cleaning run state (PR #181, flag `enablePersistCleaningState` default OFF)** — needs real-robot test before enabling by default
- [ ] **Release rc07 with the #184 selectAreas fix** — when user asks
- [ ] **Real-device test of selectAreas fix (PR #184)** — scheduled Apple Home clean after restart; confirm no stuck transaction
- [ ] **Decide WP1–WP2 from `workspace/cleanups-support-bugs`** — awaiting user's decisions/approval. WP1 cleanups: dead `rvc.mode` branch, split `KEEPALIVE_INTERVAL_MS` (codecov and coverage-threshold items are listed separately below). WP2 support tools: CLI consumable command (log command sender is listed above). WP3 bugs: see the two "Possible bug" items below
- [ ] **Wiki Constants-Reference note for constant rename** — only if WP1 happens
- [ ] **Possible bug: `getSupportedAreas` 'Unknown Room N' lookup** — `find` matches the room itself (WP3)
- [ ] **Possible bug: `lz4BlockDecompressor` truncated input** — silently returns truncated output (WP3)
- [ ] **Dead code: `DeviceConfigurator.configureDevice`** — never returns false
- [ ] **codecov.yml cleanup** — three duplicate `coverage:` keys; no project/patch target
- [ ] **Raise vitest `coverage.thresholds` from 75** — after coverage batches land
- [ ] **Optional CLI tests batch 10** — `src/cli` untested (~100 tests); raw coverage with CLI 89.5 lines / 88.4 branches
- [ ] **.claude/memory.md over cap** — Common Pitfalls and Test Patterns sections exceed 10-bullet limit; archive to wiki/memory-archive.md
- [ ] **RVC FillingWaterTank real-device validation** — confirm `wash_status` / `replenish_mode` disambiguation from `CleaningMop` on dock-fill robots
- [ ] **RVC SelectWhileRunning (idea 2, deferred)** — allow changing selected areas while a clean is running; out of scope for `rvc-opstate-servicearea-gaps`
- [ ] **B01/Q10 Apple Home icon validation** — confirm room category icons on real B01 or Q10 device after areaType fix (includes extended IDs 2001–2011)
- [ ] **External room list R2 (deferred per user)** — replace random `Unknown Room ####` fallback in `getSupportedAreas.ts` with deterministic `"Room {id}"` (safe, no device dependency)
- [ ] **Q7 upload_by_maptype hardware validation** — confirm R1 map fetch works on real Q7 device(s) after command switch
- [ ] **B01 currentPose Phase 2 (deferred)** — implement `roomMatrix` pixel-to-room decode once real Q10 data confirms wire layout (via `b01-pose-info`); wire into `areaManagementService`, `roborockService`, `mapInfoListener`, `serviceAreaHandler` for live multi-room `currentArea`
- [ ] **Legacy map hex fixture** — optional: capture A187 `"rr"` binary from live run for regression fixture
- [ ] **Startup room name real-device validation** — confirm all rooms show real names (not "Room 1"–"Room 4") on V10 after plugin/Matterbridge restart
- [ ] **MapInfoListener room name enrichment (deferred)** — apply same `enrichMapRoomDtoFromMapInfo` on push/listener path if generic placeholders appear after live map updates

### Open Feature Gaps

- [ ] **Gap 3** — Firmware-version-aware device capability selection (low, complex; could leverage featureSetDecoder)
- [ ] **Gap 4** — `roomNames` config override for manual room name assignment (low, ready to implement when user reports)
