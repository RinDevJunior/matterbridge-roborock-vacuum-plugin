# To Do

Completed items have been archived to `workspace/to_do_archive.md`. This file tracks active pending work only.

## Pending

### Implementation Tasks

- [x] **Dock error → RVC operationalError mapping (default bundle Items 1+2+3+4)** — `DOCK_ERROR_TO_MATTER` + `DSS_FIELD_PRIORITY` in `DockStationStatus.ts`; enum codes 32/33/35; dss priority and field semantics per answer.md; parametrized regression tests; wiki synced
- [x] **Wire V1 LegacyMapParser into runtime as currentArea fallback** — integrated LegacyMapParser.resolveCurrentRoom into handleCleaningWithoutInfo's else branch via MapInfoListener.tryParseV1MapBinary (mirrors tryParseB01MapBinary pattern); added v1RoomResolutionCache with 30s staleness window and throttled fire-and-forget requestV1MapRefresh; all four verification gates passed (format:ci, lint:fix:ci, type-check:ci, test:ci); two review-cycle bugs caught and fixed (1. requestV1MapRefresh firing unconditionally on every call instead of only on cache-miss, 2. entire V1 fallback branch unreachable in resolveAreaFromCleaningInfo — moved to correct function handleCleaningWithoutInfo after test-writer traced actual code path)
- [x] **Fix B01/Q10 map parser for Roborock Q10 S5+ (protocol 301, LZ4)** — added marker-byte classifier to route Q10 unencrypted LZ4 payloads to new decompressor/parser; Q7 AES+zlib path untouched; best-effort room-name extraction based on python-roborock reference; live-validated via `b01-map-parser-test` CLI on real Q10 S5+ (10 rooms decoded successfully, see issue #136)
- [x] **Fix ServiceArea validation crash on B01 map parse** — added buildPlaceholderSupportedMaps() helper to backfill supportedMaps from computed areas' distinct mapIds when toSupportedMaps() returns empty; 4 new regression tests; live-validated on Q10 S5+ (0 validation errors, 10 real rooms correctly populated)
- [x] **Clean all rooms from Apple Home (SelectAreas([]))** — populate selectedAreas with all rooms of active map on empty input; trySwitchMap reachability fix to prevent V10/V1 unguarded switchMap RPC exposure
- [x] **Ponytail audit cleanup cycles 1–2 (completed)** — consolidated into history; see claude_history.md entries for 2026-07-07
- [x] **RVC per-area estimatedTime + DirectModeChange** — computeAreaEstimatedTime helper, buildProgressUpdate export & extension, RVC Clean Mode Cluster override; 45 tests across 3 files all passing
- [x] **Claude setup token/cost audit (2026-07-09)** — memory.md pruned to caps (+ wiki/memory-archive.md), briefer merged into architect, LSP/serena removed from subagents, plugin trims (ponytail/pyright/github/code-simplifier off per-project), documenter/wiki-manager Bash fix, complexity boundary widened
- [x] **DirectModeChange featureSet gating investigation (2026-07-10)** — no real featureSet/newFeatureSet bit maps to "mid-clean mode change"; `is_support_custom_mode_in_cleaning`/`is_clean_direct_status_supported` are decode-only, unreferenced anywhere in this repo or python-roborock; kept unconditional declaration, no code change
- [x] **Fix Matter ChangeToMode(Idle) no-effect bug** — added IdleModeHandler to ModeHandlerRegistry for both DefaultBehavior and BehaviorSmart; 25 new tests, all passing
- [x] **Fix global clean selectedAreas empty-input bug (Bug A, rc09/rc10)** — ~~added updateAttribute call in SELECT_AREAS handler~~ **[SUPERSEDED]** earlier fix did not work (race condition; base class overwrites milliseconds later). Root cause: MatterbridgeServiceAreaServer.selectAreas() unconditionally calls super.selectAreas(request) with original empty request after command handler runs. Real fix: new selectAreas override in roborockServiceAreaServer.ts resolves empty input to all-rooms list via resolveAllRoomsForActiveMap(), forwards resolved list to super.selectAreas() so base class's internal write succeeds. Simplified SELECT_AREAS handler to unconditional forward.
- [x] **Q10 S5+ map parser real-device validation** — confirmed via `b01-map-parser-test` CLI against real Q10 S5+: 10/10 rooms decoded, valid mapId; 2 minor follow-ups reported on issue #136 (3 room names returned as untranslated raw keys instead of resolved names; CLI tool's 6s wait timeout is too short for the device's ~60s push interval, needs several retries)
- [x] **Q10 "trace/path" secondary payload variant** — implemented b01Q10TraceParser.ts (10-byte header, session counter, big-endian int16 point pairs, stray-leading-point filter); wired into b01MapParser before Q7 fallthrough; last point populates B01MapInfo.currentPose; live-validated on Roborock Q10 S5+ (8 invocations, zero crashes, zero "incorrect header check" errors)
- [x] **Q10 status code separation (issue #166)** — resolved collision where Q10-specific codes 101/103 collided with canonical OperationStatusCode enum; new dedicated b01Q10OperationStatusCode enum + b01Q10StatusResolver module + wiring into serviceAreaHandler for room/cleaning-progress tracking; 33 new tests, all verification gates pass, reviewer approved
- [ ] **Q10 RvcOperationalState badge follow-up (issue #166 residual)** — wiring in #166 fixes ServiceArea/room tracking only; Q10 sending raw 101/103 can still show "Error" on Matter RvcOperationalState badge; investigate extending fix to rvc-opstate badge (may require integration with stateResolver.ts or function.ts—differs from #166's localized serviceAreaHandler approach)
- [ ] **V1 legacy room fallback real-device validation** — confirm on a real V1 device (e.g. Roborock Qrevo Edge 5V1 used to validate legacy-map-info CLI) that currentArea correctly updates via new V1 fallback during actual clean where cleaning_info is absent from status pushes; underlying CLI/parser validated on real hardware, but live runtime wiring (throttled getHomeMap trigger + cache + serviceAreaHandler branch) not yet exercised end-to-end on real device
- [ ] **V1 zone/wall coordinate-unit real-device validation** — confirm on a real V1 device with configured virtual walls/no-go zones that wall/zone decoding in mapParser (blocks 9/10/12) uses correct coordinate units (assumed raw mm, same as robotPosition); diagnostic CLI (legacy-map-info-v2) validated logically but live device comparison needed
- [ ] **buildCleanCommand room collapse investigation (Bug B)** — app_start command sent without room list when "all rooms" selected; may relate to currentArea freeze symptom during global clean; marked for future investigation
- [ ] **Q10 S5+ battery reading investigation (postponed 2026-07-11)** — user reports incorrect battery capacity shown for Q10 S5+ (B01). Diagnosis so far (see `workspace/investigate-battery-capacity-q10/answer.md`): NO scaling/DPS-key bug found — bootstrap read, live V1 listener, and live B01/Q10 listener all read DPS 122 as a plain 0-100 percentage; the `*2` conversion to Matter's half-percent unit (`batteryStateHandler.ts:21`) happens exactly once and is the only write site for `batPercentRemaining`; no `batCapacity` (mAh) attribute exists anywhere in the plugin. Leading concern instead: B01/Q10 live battery updates depend entirely on an MQTT push or a local-poll request/reply round-trip (`pollingService.ts`); poll failures are only logged, never retried (`pollingService.ts:32-34`) — if pushes/replies stop after the initial bootstrap read, the Matter attribute could silently freeze on a stale value indefinitely. The available log capture (~54s) was too short to prove this reproduces — no poll cycle even completed in that window. Open questions to resolve when resumed: (1) get a longer debug-level log (10+ min) spanning a real battery change, check for recurring "Handling battery update" lines; (2) confirm user's `refreshInterval` config and local-network vs MQTT-only mode (`hasRealTimeConnection` took ~20s to flip true in the sample capture); (3) ask whether restarting the plugin makes the value jump to a new number then get stuck again (would confirm silent live-update failure vs. a fully broken path).
- [ ] **ChangeToMode(Mapping) support investigation** — deferred after confirming no dispatcher command exists across V1-protocol devices to trigger mapping run; roborock-gitlab reference repo not checked (not in allowlist) — revisit if user requests Mapping support later
- [ ] **B01/Q10 currentArea real-device validation** — confirm on a real B01 or Q10 device that `currentArea` updates correctly during multi-room cleaning and tracks which room the vacuum is in; prior implementation validated parsing/triggering logic on real Q10 S5+ but end-to-end runtime behavior not yet confirmed
- [ ] **RVC estimatedEndTime real-device validation** — confirm V1/B01/Q10 `clean_percent` tracks job progress reliably when `enableEstimatedEndTime` is on (B01/Q10 support added in 2026-09-20 task; V1 already verified); document accuracy limits (pauses, low percent, Home display lag)
- [ ] **RVC SkipArea real-device validation (native Matterbridge 3.10.12 API)** — confirm skip current room during multi-room clean on V10 (expects success); expect `InvalidInMode` on B01/Q7; refactored to native API in 2026-10-02 task
- [x] **Finalize ServiceArea progress on run end (PR #175, rc03)** — active-state whitelist, run-end Completed/Skipped finalization, Idle/Docked guards
- [x] **Apple Home stale progress on Start (PR #176, rc04)** — resetProgressForNewRun on onCleaningStart; Pending seed from selectedAreas or all rooms
- [ ] **Live-device: full multi-room clean** — confirm Completed/Skipped stay after docking and next Start shows Pending immediately (PR #175/#176)
- [ ] **Live-device: pause→resume** — confirm progress is preserved across pause/resume (resume guard in resetProgressForNewRun)
- [ ] **Live-device: skip rooms (PR #174 native API)** — skip current room and skip non-active room during clean
- [ ] **Codecov: 1 uncovered changed line in PR #176** — add test coverage
- [ ] **Known limitation: Idle-code status between Start and first active status** — can clear Pending seed; investigate guard
- [ ] **Known limitation: mid-run recharge resume and plugin restart mid-run** — reset finished rooms to Pending; decide whether to persist/restore
- [ ] **Burst polling only while active** — user decision: no change; revisit only if requested
- [ ] **Status line command path is relative** — `.claude/settings*.json` status line breaks if cwd leaves repo root; not fixed
- [x] **B01 UDP client leak (issue #179, PR #180)** — client stored in `udpClientMap`, closed on re-init and shutdown; issue closed
- [x] **Closed #161 and #170** — Windows-safe CI scripts and coverage gap tests
- [x] **Whole-project coverage (PR #182)** — 71 gap test files; without `src/cli` lines 99.8 / branches 98.4
- [x] **Node 25 test fix (PR #182)** — `engines.node` `>=24 <25`; test pins `process.versions.node`
- [ ] **Investigate 08:00 two-room clean (2026-10-12)** — root cause: external Matter `rvcOperationalState.goHome` at 08:19:43 from the same controller session as the 08:00 selectAreas; plugin behaved correctly; open question: who sent the command
- [ ] **Idea: log Matter command sender** — record the controller/session identity for incoming RVC commands (not started)
- [ ] **Persisted cleaning run state (PR #181, flag `enablePersistCleaningState` default OFF)** — needs real-robot test before enabling by default
- [ ] **CHANGELOG entry for rc05** — cover #179 and #181
- [ ] **Release 1.2.0-rc05** — bump version after changelog
- [ ] **Possible bug: `getSupportedAreas` 'Unknown Room N' lookup** — `find` matches the room itself
- [ ] **Possible bug: `lz4BlockDecompressor` truncated input** — silently returns truncated output
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
- [ ] **Legacy map → plugin** — wire `LegacyMapParser.resolveCurrentRoom` into runtime for V1 devices lacking `vacuumRoom` in status (replace or supplement `getRoomIdFromMap`); reuse `decryptAndUnzipV1Map` for Protocol 301 push; resolve segment names from `device.mapInfos` (not nonexistent `device.rooms`)
- [ ] **Legacy map hex fixture** — optional: capture A187 `"rr"` binary from live run for regression fixture
- [ ] **Startup room name real-device validation** — confirm all rooms show real names (not "Room 1"–"Room 4") on V10 after plugin/Matterbridge restart
- [ ] **MapInfoListener room name enrichment (deferred)** — apply same `enrichMapRoomDtoFromMapInfo` on push/listener path if generic placeholders appear after live map updates

### Open Feature Gaps

- [ ] **Gap 1** — `selectAreas` all-selected normalization (low-medium, needs API confirmation)
- [ ] **Gap 3** — Firmware-version-aware device capability selection (low, complex; could leverage featureSetDecoder)
- [ ] **Gap 4** — `roomNames` config override for manual room name assignment (low, ready to implement when user reports)
