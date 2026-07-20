# Claude History

## 2026-07-20 — Fix currentArea freeze during V1-protocol multi-room cleans

**Task:** Fix bug where Apple Home showed vacuum permanently "Cleaning Living Room" (or first selected room) during scheduled/multi-room cleans on V1-protocol Roborock devices (reported by S8 owner, affects any V1-protocol device). Root cause: handleCleaningWithoutInfo unconditionally pinned currentArea to selectedAreas[0] whenever multiple rooms were selected (added in commit #125), ordered before V1 segment-cache resolution logic, making that logic unreachable.

**Changes:**

- `src/runtimes/handlers/serviceAreaHandler.ts` — reordered handleCleaningWithoutInfo to try V1 segment-cache resolution (new resolveV1CurrentArea helper) first, falling back to pin-to-first-area only on cache miss or area-outside-selection; extracted shared publishAreaProgress helper to remove duplicated progress-publish logic
- `src/tests/runtimes/handlers/serviceAreaHandler.test.ts` — added 6 new regression tests for V1 fallback with multi-room selection, updated 4 stale tests, fixed 3 stale comments

**Outcome:** Pass (reviewer approved with no blocking issues; all verification gates passed: format:ci, lint:fix:ci, type-check:ci, test:ci).

## 2026-07-18 — Fix error-clear transitions not reported to Matter

**Task:** Fix bug where vacuum/dock error-clear transitions were never reported to the Matter controller. Root cause: error-handling gates in v1StatusListener.ts and handleHomeDataMessage.ts only fired when error code was non-zero, preventing the error-clear path from ever reaching the correct reset logic in handleErrorOccurred.

**Changes:**

- `src/roborockCommunication/routing/listeners/implementation/v1StatusListener.ts` — widened error gate to fire whenever error field is defined (not just non-zero)
- `src/runtimes/handleHomeDataMessage.ts` — widened error gate to match v1StatusListener pattern
- `src/tests/roborockCommunication/routing/listeners/implementation/v1StatusListener.test.ts` — updated stale assertions, added field-absent and error-clear-transition coverage
- `src/tests/roborockCommunication/broadcast/listener/implementation/v1StatusListener.test.ts` — updated stale assertions and added transition coverage
- `src/tests/runtimes/handleHomeDataMessage.test.ts` — updated stale assertions and added field-absent/clear-transition coverage

**Outcome:** Pass (reviewer approved; all verification gates passed: format:ci, lint:fix:ci, type-check:ci, test:ci).

## 2026-07-14 — Reset ServiceArea.progress on clean start (third trigger)

**Task:** Add third trigger for resetting `ServiceArea.progress` per-room state when vacuum starts new clean; detect genuine Docked/Stopped/Error → actively-cleaning operationalState transitions using `lastActivelyCleaningState` flag to avoid false positives on mid-clean detours.

**Changes:**

- `src/runtimes/handlers/serviceAreaHandler.ts` — added third trigger in handleServiceAreaUpdate to call resetProgress on active-clean entry
- `src/services/areaManagementService.ts` — added per-device `lastActivelyCleaningState` flag and `setLastActivelyCleaningState(state)` method
- `src/services/roborockService.ts` — added passthrough proxy `setLastActivelyCleaningState(state)`
- `src/tests/runtimes/handlers/serviceAreaHandler.test.ts` — tests for clean-start progress reset trigger
- `src/tests/services/areaManagementService.test.ts` — tests for `lastActivelyCleaningState` flag lifecycle
- `src/tests/services/roborockService/roborockService.areamanagement.test.ts` — tests for passthrough proxy method
- `src/tests/helpers/testUtils.ts` — helper updates for test fixtures

**Outcome:** Pass (reviewed and approved; all verification gates pass: format:ci, lint:fix:ci, type-check:ci, test:ci).

## 2026-07-14 — Vacuum error → RVC operationalError mapping (ideas 2–6)

**Task:** Vacuum `error_code` → Matter RVC `operationalError` enhancements: unknown-code fallback, enum 33, semantic refinements for 8 codes, and table-driven Map refactor in `VacuumStatus.ts`.

**Changes:**

- `src/roborockCommunication/enums/vacuumAndDockErrorCode.ts` — added `VacuumErrorCode.AutoEmptyDockFanError = 33`
- `src/model/VacuumStatus.ts` — exported `VACUUM_ERROR_TO_MATTER` table; semantic updates (10/34→DustBinFull, 37→BrushJammed, 40→WaterTankMissing, 54→MopCleaningPadMissing, 39→DirtyWaterTankMissing, 44→WaterTankLidOpen); unknown non-zero fallback → `UnableToCompleteOperation`
- `src/tests/model/VacuumStatus.test.ts` — created parametrized full-map + unknown-code tests
- `src/tests/initialData/getOperationalStates.test.ts` — updated vacuum mapping assertions
- `wiki/Error-Handling-Reporting.md` — vacuum error table synced (code 33, semantic changes, unknown fallback)

**Outcome:** Pass (final reviewer APPROVE; ideas 2–6 bundled in single PR).

## 2026-07-14 — Dock error → RVC operationalError mapping (default bundle)

**Task:** Default bundle Items 1+2+3+4 — lock baseline dock_error_status mappings, add auto-empty dock codes 32/33/35, refine dss field semantics and priority, refactor to table-driven lookups in `DockStationStatus.ts`.

**Changes:**

- `src/roborockCommunication/enums/vacuumAndDockErrorCode.ts` — added `NoDustbinOrFilter` (32), `AutoEmptyDockFanError` (33), `AutoEmptyDockVoltageError` (35)
- `src/model/DockStationStatus.ts` — `DOCK_ERROR_TO_MATTER` Map + `DSS_FIELD_PRIORITY` array; dss mappings (dustBag→DustBinMissing, filter→WaterTankMissing, isUpdownWaterReady→UnableToCompleteOperation); priority clearWater→dirty→dustBag→cleanFluid→filter→updown
- `src/tests/model/DockingStationStatus.test.ts` — `createDockStatus` helper; parametrized baseline + new-code tests; dss single-field, priority, and dss=149/dss=2729 fixtures
- `wiki/Error-Handling-Reporting.md` — dock + dss tables synced (already updated)

**Outcome:** Pass (final reviewer APPROVE; default bundle complete; Item 5 deferred as mutually exclusive alternative to Item 3).

## 2026-07-13 — Wire V1 LegacyMapParser into runtime as currentArea fallback

**Task:** Integrate LegacyMapParser.resolveCurrentRoom into the live plugin runtime as a fallback for currentArea/room resolution when V1 devices lack cleaning_info in status updates while actively cleaning. Previously resolveAreaFromCleaningInfo's !cleaningInfo branch was unreachable dead code — handleServiceAreaUpdate intercepts all such cases earlier and routes to handleCleaningWithoutInfo instead.

**Changes:**

- `src/services/messageRoutingService.ts` — added requestHomeMapPush() method to trigger fire-and-forget getHomeMap RPC for fresh map binary
- `src/services/areaManagementService.ts` — added v1RoomResolutionCache { segmentId, resolvedAtMs }, setV1ResolvedSegment(), getV1ResolvedSegment(), requestV1MapRefresh() with 30s staleness window, clearAll() cache purge
- `src/services/roborockService.ts` — added 2 passthrough methods (requestHomeMapPush, getV1ResolvedSegment)
- `src/roborockCommunication/routing/listeners/implementation/mapInfoListener.ts` — added tryParseV1MapBinary() to decrypt/parse V1 map binary pushes, resolve current segment via LegacyMapParser.resolveCurrentRoom, cache { segmentId, resolvedAtMs }, cache miss triggers throttled requestV1MapRefresh; 2 new constructor params (messageRoutingService, areaManagementService)
- `src/services/connectionService.ts` — updated MapInfoListener construction with new params
- `src/runtimes/handlers/serviceAreaHandler.ts` — added V1 fallback logic in handleCleaningWithoutInfo's else branch (not resolveAreaFromCleaningInfo — function reverted to original cleaningInfo-present-only behavior after initial reachability bug); reads v1RoomResolutionCache, resolves via same roomIndexMap lookup as dominant path
- `src/tests/roborockCommunication/routing/listeners/implementation/mapInfoListener.test.ts` — new test coverage for tryParseV1MapBinary
- `src/tests/services/areaManagementService.test.ts` — new tests for v1RoomResolutionCache lifecycle
- `src/tests/services/messageRoutingService.test.ts` — new tests for requestHomeMapPush
- `src/tests/runtimes/handlers/serviceAreaHandler.test.ts` — new tests for handleCleaningWithoutInfo V1 fallback branch

**Outcome:** Pass (second reviewer cycle; initial implementation bug: requestV1MapRefresh fired unconditionally on every call, fixed to fire only on cache-miss; second critical bug caught by test-writer: entire V1 fallback branch was unreachable due to placement in resolveAreaFromCleaningInfo instead of handleCleaningWithoutInfo, discovered via real-code-path test failure, traced by EM, fixed by implementer, re-verified by fresh reviewer pass with hand-traced call chain; all four verification gates passed: format:ci, lint:fix:ci, type-check:ci, test:ci).

**Follow-up:** V1 legacy room fallback real-device validation needed — confirm on a real V1 device (e.g. Roborock Qrevo Edge 5V1 used to validate legacy-map-info CLI) that currentArea correctly updates via this fallback during actual clean where cleaning_info is absent from status pushes; underlying CLI/parser validated on real hardware, but live runtime wiring (throttled getHomeMap trigger + cache + serviceAreaHandler branch) not yet exercised end-to-end on real device.

## 2026-07-12 — Fix B01/Q10 trace packet crash (protocol 301, secondary payload)

**Task:** Fix crash when Roborock Q10 S5+ sends trace packet (marker 0x02 0x01) containing accumulated path of current cleaning session. Previously misclassified as legacy Q7 AES+zlib payload and threw "incorrect header check". Root cause and wire format identified via python-roborock reference project comparison (GitHub issue #136).

**Changes:**

- `src/roborockCommunication/map/b01/b01Q10TraceParser.ts` — new; parses 10-byte header, session counter, big-endian int16 (x,y) point pairs; filters stray-leading-point to match python-roborock logic; wires last point to B01MapInfo.currentPose
- `src/roborockCommunication/map/b01/b01MapParser.ts` — added isTracePacket/parseQ10TracePacket routing before Q7 fallthrough
- `src/roborockCommunication/map/b01/b01MapParserTest.ts` — extended CLI diagnostic classifier to report "Trace-shaped" packet type

**Outcome:** Pass (live-validated on Roborock Q10 S5+ (RCFMKY51101783) during active cleaning: 8 total invocations, real changing (x,y) coordinates, zero crashes, zero "incorrect header check" errors; reviewer approved on branch fix/b01-q10-trace-packet; deferred: roomMatrix pixel-to-room decode mapping, GitHub issue #136 investigation history).

## 2026-07-12 — Fix B01/Q10 map parser for Roborock Q10 S5+ (protocol 301, LZ4)

**Task:** Fix "MapInfoListener: failed to parse B01 map binary: Error: incorrect header check" — 100% reproducible crash on every map push (protocol 301) for Roborock Q10 S5+. Root cause: parseRoomsFromEncryptedBinary was hardcoded for Q7's AES+zlib SCMap-protobuf container; Q10 sends unencrypted LZ4-compressed payload.

**Changes:**

- `src/roborockCommunication/map/b01/b01MapParser.ts` — added marker-byte classifier (0x01 0x01) to route Q10 payloads to new handler; Q7 AES+zlib path untouched (fallthrough default); two private methods extracted for internal Q10 flow (decompressAndParseQ10Packet, parseQ10MapPacket)
- `src/roborockCommunication/map/b01/lz4BlockDecompressor.ts` — new; self-contained hand-rolled LZ4 block decompressor (no npm dependency; node-lz4/lz4js stale/wrong-shaped/nonexistent)
- `src/roborockCommunication/map/b01/b01Q10MapParser.ts` — new; Q10-specific field parser (mapId u32be@2, width/height u16be@7/@9, compressedLength u16be@27, room records with roomId u16be@0/nameLength@26/name@27) using python-roborock's best-effort layout
- `src/tests/roborockCommunication/map/b01/b01MapParser.test.ts` — updated with Q10 marker-byte test
- `src/tests/roborockCommunication/map/b01/lz4BlockDecompressor.test.ts` — new; comprehensive LZ4 decompression tests
- `src/tests/roborockCommunication/map/b01/b01Q10MapParser.test.ts` — new; Q10 parser field-extraction tests

**Outcome:** Pass (full pipeline: implementer → reviewer → test-writer; all verification gates passed: format:ci, lint:fix:ci, type-check:ci, test:ci). Two-tier confidence: (1) high — crash stops, Q10 payloads now decompressed correctly instead of zlib failure; (2) best-effort — room-name extraction unconfirmed against real Q10 hardware; parse failure surfaces new distinguishable error ("Q10 map binary parse failed (best-effort Q10 layout, unconfirmed against real device capture): ...") for future log capture diagnosis.

**Follow-ups:** (1) Q10 S5+ real-device validation (affected user log capture to confirm room-name extraction or flag layout-guess corrections needed); (2) Q10 "trace/path" secondary payload variant explicitly deferred.

## 2026-07-12 — Fix ServiceArea validation crash on B01 map parse

**Task:** Fix a Matter ValidationError/135 crash (`Areas must have a null mapId when supportedMaps is empty`) that occurred on every B01 map update right after plugin startup/reconnect against real Roborock Q10 S5+.

**Changes:**

- `src/initialData/getSupportedAreas.ts` — Added `buildPlaceholderSupportedMaps()` private helper to backfill `supportedMaps` from computed areas' distinct mapIds when `toSupportedMaps()` returns empty, preventing timing race condition
- `src/tests/initialData/getSupportedAreas.test.ts` — Added 3 new regression tests covering edge cases
- `src/tests/roborockCommunication/routing/listeners/implementation/mapInfoListener.test.ts` — Added 1 new regression test

**Outcome:** PASS. Root cause identified: `tryParseB01MapBinary` could run before the first multimap/query_response push populated `supportedMaps`, causing `getSupportedAreas()` to compute areas with non-null mapIds while `toSupportedMaps()` returned empty (violation). Solution applies the existing "pair, don't null" convention in that file. Verified live against real Roborock Q10 S5+ (8 map-parse cycles post-restart, 0 validation errors, 10 real rooms correctly populated). All verification gates PASS: format:ci, lint:fix:ci, type-check:ci, test:ci. Follow-up: GitHub #136 (intermittent zlib header error) fixed upstream via LZ4 decoder, validated live against the same device.

## 2026-07-12 — Fix global clean selectedAreas regression (rc09/rc10 updateAttribute race)

**Task:** Fix ServiceArea.selectedAreas showing [] in Apple Home during Apple-automation-triggered global clean, despite rc09/rc10 fix. Root cause: MatterbridgeServiceAreaServer.selectAreas() calls super.selectAreas(request) with the ORIGINAL empty request, overwriting the resolved rooms immediately after (deterministic, 100% reproducible).

**Changes:**

- `src/behaviors/roborockServiceAreaServer.ts` — added selectAreas override to resolve empty input to all-rooms list via device.resolveAllRoomsForActiveMap(), forward resolved list to super.selectAreas() so base class's internal write lands correctly; on explicit input, forward unchanged and call trySwitchMap (preserving V10/V1 activeMapId=-1 guard)
- `src/types/roborockVacuumCleaner.ts` — simplified SELECT_AREAS command handler to unconditional forward (dropped now-redundant updateAttribute call and branching/trySwitchMap logic, moved to override); widened resolveAllRoomsForActiveMap and trySwitchMap to public visibility
- `src/tests/behaviors/roborockServiceAreaServer.test.ts` — new test coverage for selectAreas override empty-input resolution and explicit-input forwarding
- `src/tests/roborockVacuumCleaner.test.ts` — updated stale assertions to match simplified command handler

**Outcome:** Pass (full pipeline: implementer → reviewer → test-writer; all verification gates passed: format:ci, lint:fix:ci, type-check:ci, test:ci).

## 2026-07-12 — Beautify Claude Code status line (tooling, no product code)

**Task:** Restyle `.claude/statusline-command.sh` and tune its refresh behavior.

**Changes:**

- `.claude/statusline-command.sh` — new look: 256-color palette, `▰▱` bars with dim track, glyph labels (`✦` model, `⛁ ctx`, `◔ 5h`, `◷ 7d`, `↻` reset, `📁` cwd with `~` shortening), `✻ thinking` indicator; context bar now uses the same green/yellow/red thresholds as usage.
- `.claude/settings.local.json` — `statusLine.refreshInterval` 30 → 1 (per-second re-render; data is re-read from the payload on every render).
- A "countdown to next refresh" timer was added on request, then removed as pointless once the interval became 1s (it counted down to a non-event). State files under `$TMPDIR/claude-statusline-next-*` cleaned up.
- Row 1: thinking-mode indicator made explicit both ways (`✻ think:on` magenta / `✻ think:off` dim) from payload `thinking.enabled`.
- Row 2: raw token counts after the context percentage (e.g. `10% 97.9k/1M`) via payload `context_window.total_input_tokens + total_output_tokens` over `context_window_size`; verified against a live captured payload.

**Task:** Fix a bug where Apple Home showed a blank room selection during global "clean everything" automations even though the vacuum cleaned correctly; root cause was empty SelectAreas([]) from Apple Home not being echoed back to Matter after internal resolution to all rooms.

**Changes:**

- `src/types/roborockVacuumCleaner.ts` — added `await this.updateAttribute(ServiceArea.id, 'selectedAreas', allRoomsForActiveMap, this.log)` call in SELECT_AREAS handler's empty-input branch only; explicit-rooms branch left untouched (Apple Home already has that data)
- `src/tests/types/roborockVacuumCleaner.test.ts` — added test coverage for empty SelectAreas input triggering attribute update with resolved all-rooms list
- Task folder: `workspace/fix-selectedareas-not-updated/` (plan.md, test-plan.md, business-brief.md); investigation folder: `workspace/investigate-global-clean-one-room/` (diagnosis documented)

**Outcome:** Pass (full pipeline: technical-architect → user approval → implementer → reviewer → test-writer; tests passing). Bug B (buildCleanCommand collapsing "all rooms" to global app_start, potentially causing currentArea freeze symptom) remains open and untouched, tracked separately per investigation answer.md.

## 2026-07-10 — Fix Matter ChangeToMode(Idle) no-effect bug via IdleModeHandler

**Task:** Fix a bug where Matter clients (Apple Home, Gladys, etc.) sending ChangeToMode(Idle) via the RvcRunMode cluster had no effect on the real Roborock device due to missing handler in ModeHandlerRegistry.

**Changes:**

- `src/runtimes/handlers/modeHandler.ts` — added `IdleModeHandler` class (mirrors CleaningModeHandler pattern) to handle Idle mode transitions
- `src/behaviors/behaviorConfig.ts` — registered `IdleModeHandler` in `ModeHandlerRegistry` chain for both `DefaultBehavior` and `BehaviorSmart` configs; calls existing `RoborockService.pauseClean()`
- `src/tests/runtimes/handlers/modeHandler.test.ts` — 25 new tests covering IdleModeHandler lifecycle, pauseClean calls, state validation, edge cases
- Task folder: `workspace/fix-runmode-idle-mapping/` (plan.md, test-plan.md, business-brief.md present); research folders: `workspace/verify-runmode-idle-bug/`, `workspace/ref-mapping-command/`

**Outcome:** Pass (full pipeline: technical-architect → user approval → implementer → reviewer → test-writer; all 25 tests passing; format:ci, lint:fix:ci, type-check:ci, test:ci green). ChangeToMode(Mapping) remains explicitly deferred — confirmed via reference research (python-roborock, ioBroker.roborock) that no dispatcher command exists to trigger a mapping run across V1-protocol devices; only OperationStatusCode.Mapping=29 status exists (reported, not sendable). roborock-gitlab reference repo gap noted for future investigation if needed.

## 2026-07-09 — Claude setup audit: token/cost slimming across agents, policy, plugins, memory

**Task:** Full review of `.claude/` orchestration setup (agents, policy, skills, MCP, plugins, shared memory) to cut token usage while keeping quality; all findings approved and applied.

**Changes:**

- `.claude/memory.md` — pruned from 24KB to caps (10 bullets/section); overflow moved to new `wiki/memory-archive.md`; reviewer now enforces caps
- `.claude/agents/briefer.md` — deleted; technical-architect now writes `business-brief.md` (+ optional `technical-brief.md`) itself
- `.claude/agents/*` — removed `LSP` + `mcp__serena__*` from all subagent tools/prose (probe re-confirmed LSP and native Glob/Grep are absent in subagents; only `mcp__glob-grep__*` works); removed Progress Checklist from implementer/test-writer; documenter + wiki-manager got Bash (their `format:ci` gate was impossible); direct-executor lost `Task`/`TodoWrite` (leaf agent); documenter now receives EM summary instead of reading plan/brief
- `.claude/instructions/team-orchestrator-policy.md` — pipeline without briefer; low complexity widened to ≤3 files with existing pattern; gate table fixed (implementer/test-writer include `type-check:ci`); checklists limited to architect/release-manager
- `.claude/instructions/agent-prompts.md`, `.claude/skills/load-policy|ref-idea/SKILL.md`, `.claude/templates/reference-workspaces.md` — aligned with the above
- `.claude/settings.json` — SessionStart hook trimmed to 3 lines; project-disabled plugins: ponytail, pyright-lsp, github, code-simplifier; serena removed from `.mcp.json` + both settings files

**Outcome:** Pass (`format:ci` green). Estimated ~25k tokens saved per full pipeline cycle (memory prune) + ~2k/session (plugins/hook) + one fewer spawn per medium/high cycle.

## 2026-07-09 — RVC per-area estimatedTime + DirectModeChange feature declaration

**Task:** Add per-area estimated time for Service Area Progress entries and declare DirectModeChange capability on RVC Clean Mode Cluster.

**Changes:**

- `src/share/estimatedEndTime.ts` — added `computeAreaEstimatedTime()` helper (adapts full-clean ETA logic to single area scope)
- `src/runtimes/handlers/serviceAreaHandler.ts` — exported `buildProgressUpdate()` for testability; extended to compute per-area estimatedTime using new helper, gated by existing `shouldPublishEstimatedEndTime` flag
- `src/types/roborockVacuumCleaner.ts` — added `createDefaultRvcCleanModeClusterServer()` override to declare DirectModeChange feature
- `src/tests/share/estimatedEndTime.test.ts` — 15 new tests (area vs full-clean ETA logic, edge cases, null handling)
- `src/tests/runtimes/handlers/serviceAreaHandler.test.ts` — 20 new tests (progress update with/without estimated time, flag gating, fallback scenarios)
- `src/tests/types/roborockVacuumCleaner.test.ts` — 10 new tests (DirectModeChange capability advertised correctly)

**Outcome:** Pass (verified: format:ci, lint:fix:ci, type-check:ci, test:ci all green). Preceded by verification cycle confirming Matter RVC reference (workspace/todo-task/matter_rvc_findings.md) against local Matter repos — caught and corrected 3 fabricated attribute names before planning. One review round: removed unused nowEpochSeconds param from estimatedTime computation. No config changes needed (uses existing shouldPublishEstimatedEndTime). Mid-clean mode changes already worked pre-implementation (DirectModeChange pure capability advertisement).

## 2026-07-08 — Clean all rooms from Apple Home via empty SelectAreas

**Task:** Populate Matter `selectedAreas` attribute with all rooms of the active map when Apple Home sends empty SelectAreas([]), enabling "clean all" via global clean with populated UI feedback.

**Changes:**

- `src/types/roborockVacuumCleaner.ts` — added `resolveAllRoomsForActiveMap()` private method (active-map inference via Matter selectedAreas hint → homeInFo.activeMapId → first supportedAreas → empty fallback); restructured SELECT_AREAS handler to populate empty input before executeCommand, skip trySwitchMap on populated-all-rooms path to avoid V10/V1 unguarded switchMap RPC exposure
- `src/tests/roborockVacuumCleaner.test.ts` — 8 new test cases (happy path, both active-map fallbacks, no-rooms fallback, trySwitchMap regression guard for V10/V1 activeMapId=-1, non-empty-input regression checks); updated testUtils.ts setReadOnlyProperty helper export
- `src/tests/roborockVacuumCleaner.test.ts` — updated pre-existing test that asserted old "empty list stays empty" behavior to match new populated-all-rooms contract

**Outcome:** Pass (reviewed APPROVED after trySwitchMap reachability fix, tested, verified format:ci lint:fix:ci type-check:ci test:ci). Routines excluded by construction (separate supportedRoutines store, mapId=999). buildCleanCommand resolves to {type:'global'} by construction when all active-map rooms selected.

## 2026-07-07 — Ponytail audit cleanup cycle 2: refactor duplicates, delete dead code, add test coverage

**Task:** Second cleanup iteration — delete dead file (handleCloudMessage.ts), dead duplicate function (asType), dead line (commented throw), refactor two duplicated blocks into shared helpers, add test coverage for previously-untested handleDeviceStatusSimpleUpdate.

**Changes:**

- `src/runtimes/handleCloudMessage.ts` — deleted (129 lines, 100% dead commented-out code)
- `src/share/function.ts` — deleted `asType<T>()` duplicate function (lines 86-89)
- `src/roborockCommunication/protocol/dispatcher/dispatcherFactory.ts` — deleted commented-out line 56
- `src/runtimes/handlers/deviceStateHandler.ts` — extracted shared `applyResolvedStateUpdates()` helper, behavior-preserving refactor (both call sites now use the same logic)
- `src/runtimes/handlers/serviceAreaHandler.ts` — merged two identical-body branches in `handleCleaningWithoutInfo` into single if/else (lines 212–227 deduplicated)
- `src/tests/runtimes/handlers/deviceStateHandler.test.ts` — new test coverage for `handleDeviceStatusSimpleUpdate` (basic flow, operationalError, dock-station error short-circuit, operation-completion tracking)

**Outcome:** Pass (reviewed, tested). Excluded: `deviceBuilder.ts` vs `deviceManagementService.ts` (genuine behavioral divergence in scenes-sourcing logic, no safety net test coverage exists for either).

## 2026-07-07 — Ponytail audit cleanup cycle 1: delete empty file, remove orphaned dependency, prune dead error classes

**Task:** Remove 22 unused error subclasses, delete empty ExperimentalFeatureSetting.ts, remove orphaned node-persist-manager dependency, trim error barrel exports to only actively-thrown classes.

**Changes:**

- `src/model/ExperimentalFeatureSetting.ts` — deleted (0 bytes, zero references)
- `package.json` — removed `node-persist-manager` dependency line 114 (regenerated package-lock.json)
- `src/errors/AuthenticationError.ts` — deleted `InvalidVerificationCodeError`, `RateLimitExceededError` dead subclasses
- `src/errors/DeviceError.ts` — deleted `DeviceOfflineError`, `DeviceCommandError`, `UnsupportedDeviceError` dead subclasses
- `src/errors/CommunicationError.ts` — deleted entire file (all 9 classes unused in production)
- `src/errors/ConfigurationError.ts` — deleted entire file (all 5 classes unused in production)
- `src/errors/ValidationError.ts` — deleted entire file (all 5 classes unused in production)
- `src/errors/index.ts` — removed Communication/Configuration/Validation export blocks; trimmed Authentication and Device blocks to 8 actively-thrown classes
- `src/tests/errors/CommunicationError.test.ts` — deleted (257 lines, test-only file for dead classes)
- `src/tests/errors/ConfigurationError.test.ts` — deleted (test-only file for dead classes)
- `src/tests/errors/ValidationError.test.ts` — deleted (test-only file for dead classes)
- `src/tests/errors/AuthenticationError.test.ts` — trimmed to only test kept classes
- `src/tests/errors/DeviceError.test.ts` — trimmed to only test kept classes

**Outcome:** Pass (reviewed, tested). Excluded: AbstractMessageHandler interface kept (14 callers across handlers/listeners, user explicitly requested retention for future use).

## 2026-07-06 — Preserve map_info room names in getRoomMap

**Task:** Fix startup room labels showing generic "Room 1"–"Room 4" in Apple Home while later rooms display correct names — `getRoomMap` was overwriting `getMapInfo` names because raw `get_room_mapping` tuples lack `iot_name`.

**Changes:**

- `src/roborockCommunication/models/home/mappers.ts` — added `enrichMapRoomDtoFromMapInfo` to copy `iot_name` from cached `MapInfo` before `toRoomMapping`
- `src/services/areaManagementService.ts` — wired enrichment in `getRoomMap` pipeline; pass `storedMapInfo` (not `MapInfo.empty()`) into `HomeEntity`
- `src/tests/roborockCommunication/models/home/mappers.test.ts` — unit tests for enrichment helper (exact match, no-op, cache miss, id-only fallback)
- `src/tests/services/areaManagementService.test.ts` — regression tests for name preservation after getMapInfo→getRoomMap and via `resolveInitialAreas`

**Outcome:** Pass (reviewed). All rooms show real names from plugin startup when `map_info` has `iot_name` but `deviceRooms` lookup fails for early segments; empty rawData and error paths unchanged.

## 2026-07-06 — Fix startup room name placeholder bug

**Task:** Move real room name resolution (getMapInfo + getRoomMap) before device registration so Apple Home sees correct room names from startup, not generic placeholders ("Room 1"-"Room 4").

**Changes:**

- `src/services/areaManagementService.ts` — added `resolveInitialAreas(duid)` method to fetch and return resolved areas + maps synchronously before registration
- `src/services/roborockService.ts` — added facade passthrough `resolveInitialAreas(duid)` delegating to areaManagementService
- `src/types/roborockVacuumCleaner.ts` — constructor now accepts `resolvedAreas` and `resolvedMaps` parameters; `initializeDeviceConfiguration()` threads them through and merges with routines (real rooms first, routines appended with mapId 999)
- `src/platform/deviceConfigurator.ts` — in `configureDevice()`, await `resolveInitialAreas()` before constructing RoborockVacuumCleaner, pass resolved areas/maps to constructor; in `onConfigureDevice()`, removed redundant initial getMapInfo/getRoomMap calls (only startPeriodicAreaRefresh remains in post-config loop)

**Outcome:** Pass. Apple Home no longer shows generic room placeholders on startup; real room names available from moment plugin initializes. Periodic refresh and listener callbacks intact; routine-as-room ordering unchanged; fallback behavior preserved.

## 2026-07-06 — Wire estimatedEndTime from clean_time + clean_percent

**Task:** Opt-in V1 ETA for Matter `ServiceArea.estimatedEndTime` via linear extrapolation from `clean_time` and `clean_percent` (epoch seconds); gated by `enableEstimatedEndTime` (default off). No `extra_time` re-enable; B01/Q7/Q10 stay `null`.

**Changes:**

- `src/share/estimatedEndTime.ts` — new `computeEstimatedEndTimeFromCleanProgress` helper + `MIN_CLEAN_PERCENT`
- `src/roborockCommunication/models/messageResult.ts` — optional `clean_percent` on `CleanProcess`
- `src/roborockCommunication/routing/listeners/implementation/v1StatusListener.ts` — forward `clean_percent` in `cleaningProcess`
- `src/runtimes/handlers/serviceAreaHandler.ts` — restored `updateCurrentAreaAndEstimate` with config/state guards; widened `resolveAreaFromCleaningInfo`
- `src/model/RoborockPluginPlatformConfig.ts` — `enableEstimatedEndTime` in advanced settings (default `false`)
- `src/platform/platformConfigManager.ts` — `isEstimatedEndTimeEnabled` getter
- `matterbridge-roborock-vacuum-plugin.schema.json` — schema property for `enableEstimatedEndTime`
- `src/tests/share/estimatedEndTime.test.ts` — pure helper unit tests
- `src/tests/runtimes/handlers/serviceAreaHandler.test.ts` — config on/off, guards, and regression clears
- `src/tests/roborockCommunication/routing/listeners/implementation/v1StatusListener.test.ts` — `clean_percent` forwarding tests
- `src/tests/platform/platformConfig.test.ts` — `isEstimatedEndTimeEnabled` accessor tests

**Outcome:** Pass (reviewed). V1 users who enable Advanced Features + `enableEstimatedEndTime` may see experimental finish time in Apple Home; default off; B01/Q7/Q10 unchanged.

## 2026-07-06 — Remove extra_time → estimatedEndTime wiring

**Task:** Stop forwarding Roborock `extra_time` and publishing `ServiceArea.estimatedEndTime` from it; research showed `extra_time` is not a reliable countdown.

**Changes:**

- `src/runtimes/handlers/serviceAreaHandler.ts` — removed `computeEstimatedEndTime`; refactored `updateCurrentAreaAndEstimate` → `updateCurrentArea`; kept idle/map-change `estimatedEndTime: null` clears
- `src/types/MessagePayloads.ts` — removed `extraTimeSeconds` from `ServiceAreaUpdateMessage`
- `src/roborockCommunication/routing/listeners/implementation/v1StatusListener.ts` — stopped forwarding `extra_time` in service-area payload
- `src/tests/runtimes/handlers/serviceAreaHandler.test.ts` — removed/updated ETA-related tests
- `src/tests/roborockCommunication/routing/listeners/implementation/v1StatusListener.test.ts` — removed `extra_time` forwarding test

**Outcome:** Pass (reviewed). Apple Home no longer shows estimated cleaning end time during runs; `currentArea`, progress, SkipArea, and OperationCompletion unchanged.

## 2026-07-05 — RVC OpState + Service Area gaps (ideas 1, 3, 4, 5)

**Task:** Close RVC Operational State and Service Area conformance gaps: OperationCompletion events, SkipArea command, estimatedEndTime/currentArea hardening, and extended operational states (FillingWaterTank). SelectWhileRunning (idea 2) skipped.

**Changes:**

- `src/runtimes/handlers/operationCompletionTracker.ts` — session snapshot, pause accounting, `operationCompletion` event via `triggerEvent`
- `src/runtimes/handlers/deviceStateHandler.ts` — before/after session capture and completion emit on active→idle transitions
- `src/behaviors/roborockServiceAreaServer.ts` — `skipArea` cluster override with guards and progress updates
- `src/runtimes/handlers/serviceAreaHandler.ts` — `estimatedEndTime`, skip progress helpers, multi-room `currentArea` fallback
- `src/types/roborockVacuumCleaner.ts` — operation session fields; wire `RoborockServiceAreaServer` and skip callback
- `src/types/MessagePayloads.ts` — optional `extraTimeSeconds` on service-area updates
- `src/roborockCommunication/routing/listeners/implementation/v1StatusListener.ts` — forward `extra_time` from status push
- `src/behaviors/BehaviorDeviceGeneric.ts` — `SKIP_AREA` command name
- `src/behaviors/roborock.vacuum/core/commonCommands.ts` — register SkipArea handler
- `src/roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.ts` — `skipRoomCleaning` contract
- `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts` — `stop_segment_clean` for skip room
- `src/roborockCommunication/protocol/dispatcher/Q7MessageDispatcher.ts` — `skipRoomCleaning` stub (InvalidInMode path)
- `src/roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.ts` — `skipRoomCleaning` stub (InvalidInMode path)
- `src/services/messageRoutingService.ts` / `src/services/roborockService.ts` — delegate `skipRoomCleaning`
- `src/share/stateResolver.ts` — `FillingWaterTank` mapping from wash/replenish signals
- `src/share/function.ts` — legacy simple-status maps aligned to extended operational states
- `src/roborockCommunication/models/deviceStatus.ts` — wash/replenish accessors for resolver
- `src/tests/runtimes/handlers/operationCompletionTracker.test.ts` — OperationCompletion unit tests
- `src/tests/runtimes/handlers/deviceStateHandler.test.ts` — session tracking integration tests
- `src/tests/behaviors/roborockServiceAreaServer.test.ts` — SkipArea guard and success-path tests
- `src/tests/runtimes/handlers/serviceAreaHandler.test.ts` — estimatedEndTime, skip helpers, multi-room currentArea
- `src/tests/share/stateResolver.test.ts` / `src/tests/share/function.test.ts` — extended state mapping tests
- `src/tests/behaviors/roborock.vacuum/core/commonCommands.test.ts` — SkipArea command registration
- `src/tests/roborockCommunication/protocol/dispatcher/V01MessageDispatcher.test.ts` — skipRoomCleaning stub
- `src/tests/roborockCommunication/routing/listeners/implementation/v1StatusListener.test.ts` — `extra_time` forwarding

**Outcome:** Pass (reviewed). OperationCompletion, SkipArea (V10 protocol), estimatedEndTime, and extended op states implemented; B01/Q7 skip and FillingWaterTank mapping remain best-effort pending real-device validation.

## 2026-07-05 — B01 listener protocol guard

**Task:** Gate status listener registration at connect time so V1 vacuums get only `V1StatusListener` and B01 vacuums get only `B01StatusListener`, preventing duplicate status/battery/clean-mode callbacks on V1-only devices.

**Changes:**

- `src/services/connectionService.ts` — protocol-guarded branches in `initializeMessageClientForLocal()` using `device.pv === ProtocolVersion.B01`
- `src/tests/services/connectionService.test.ts` — tests confirming V1 registers V1 listener only and B01 registers B01 listener only

**Outcome:** Pass (reviewed). V1-only devices no longer invoke `B01StatusListener.onMessage()`; B01 and map/OTA listeners unchanged.

## 2026-07-05 — B01 extended roomTypeIds (2001–2011)

**Task:** Extend `roomTypeIdToAreaTag` to map B01 extended room type IDs 2001–2011 (per ioBroker `ROOM_TYPE_MAP`) to Apple Home `AreaNamespaceTag` categories.

**Changes:**

- `src/initialData/getSupportedAreas.ts` — add switch cases 2001–2011 in `roomTypeIdToAreaTag`
- `src/tests/initialData/getSupportedAreas.test.ts` — unit tests for extended IDs, boundary null cases (2000/2012), and integration via `getSupportedAreas`

**Outcome:** Pass (reviewed). B01 devices sending extended `roomTypeId` values now get correct Apple Home category icons; real-device validation on physical B01 still deferred.

## 2026-07-05 — Fix B01/Q10 Apple Home area icons

**Task:** Fix Apple Home room category icons for B01/Q10 by mapping `roomTypeId` (not `colorId`) to Matter `AreaNamespaceTag`, with separate B01 and V10 lookup paths so V10 mappings stay unchanged.

**Changes:**

- `src/core/application/models/RoomMapping.ts` — add optional `areaType?: number | null` for B01 pre-computed tags
- `src/initialData/getSupportedAreas.ts` — add `roomTypeIdToAreaTag`, short-circuit `populateAreaNamespaceTag` on `areaType`, expand V10 switch; migrate to `CommonAreaNamespaceTag`
- `src/roborockCommunication/routing/listeners/implementation/mapInfoListener.ts` — B01 path: `tag` from `roomTypeId`, pre-compute `areaType` via `roomTypeIdToAreaTag`
- `src/tests/initialData/getSupportedAreas.test.ts` — tests for `roomTypeIdToAreaTag`, B01 pre-computed `areaType`, and V10 tag switch regression
- `src/tests/roborockCommunication/routing/listeners/implementation/mapInfoListener.test.ts` — B01 binary parse `roomTypeId` → `areaType` integration tests

**Outcome:** Pass (reviewed). B01/Q10 rooms now get correct Apple Home category icons; V10 tag switch preserved. Extended B01 room IDs (2001–2011) and real-device icon validation remain deferred.

## 2026-07-03 — External room list sources (R1 + R3)

**Task:** Align Q7 map fetch to `service.upload_by_maptype` (R1) and add B01 firmware-style room name normalizer at the listener layer (R3). R2 (deterministic `"Room {id}"` fallback in `getSupportedAreas.ts`) skipped per user preference.

**Changes:**

- `src/roborockCommunication/protocol/dispatcher/Q7MessageDispatcher.ts` — R1: `getRoomMap`/`getRoomMapV2` switch from `get_room_mapping_backup_1` to `get_room_mapping` with `{ force: 1, map_type: 0 }`
- `src/roborockCommunication/map/b01/roomNameNormalizer.ts` — R3: new pure normalizer for `rr_*` tokens, `roomTypeId` lookup, and `roomN` pattern
- `src/roborockCommunication/routing/listeners/implementation/mapInfoListener.ts` — R3: apply `normalizeB01RoomName` in `tryParseB01MapBinary()` `iot_name` assignment
- `src/tests/roborockCommunication/map/b01/roomNameNormalizer.test.ts` — unit tests for normalizer

**Outcome:** Pass (reviewed). R2 intentionally not implemented — random `Unknown Room ####` fallback retained in `getSupportedAreas.ts`. Q7 hardware validation for R1 still recommended on real device.

## 2026-07-03 — B01 currentPose/roomMatrix decode (Phase 1 CLI)

**Task:** Phase 1 only — decode Q10 `currentPose`/`roomMatrix` from B01 RobotMap protobuf and expose via `b01-pose-info` CLI; shared core with safe no-op `resolveRoomFromPose()`. Phase 2 production wiring explicitly deferred.

**Changes:**

- `src/roborockCommunication/map/b01/roborockProto.ts` — `currentPose` (field 8) and `roomMatrix` (field 13) on RobotMap
- `src/roborockCommunication/map/b01/types.ts` — `B01Pose`, `B01RoomMatrix`; extended `B01MapInfo`
- `src/roborockCommunication/map/b01/b01MapParser.ts` — defensive extraction of currentPose/roomMatrix
- `src/roborockCommunication/map/b01/roomMatrixResolver.ts` — new; `resolveRoomFromPose()` safe no-op (always undefined)
- `src/cli/commands/b01PoseInfo.ts` — new `b01-pose-info` command (connectDevice → waitForPush → parse → resolve → print)
- `src/cli/main.ts`, `src/cli/help.ts` — wire `b01-pose-info` command and help row
- Incidental: legacy map path renamed `legacy` → `v1` (`mapParser`, `types`, `v1MapDecryptor` + tests)
- `src/tests/cli/b01PoseInfo.test.ts` — CLI command tests
- `src/tests/roborockCommunication/map/b01/roomMatrixResolver.test.ts` — resolver guard tests
- `src/tests/roborockCommunication/map/b01/b01MapParser.test.ts` — currentPose/roomMatrix extraction tests
- `src/tests/cli/mapListHelpers.test.ts` — updated for v1 path rename

**Outcome:** Pass (Phase 1 only, reviewed). CLI ready for real Q10 device capture; room-matrix pixel decode intentionally unimplemented; Phase 2 (areaManagementService/roborockService/mapInfoListener/serviceAreaHandler wiring) deferred.

## 2026-07-03 — Legacy map room names in legacy-map-info CLI

**Task:** Wire human-readable room names into `legacy-map-info` by fetching `get_multi_maps_list` + active map status in parallel with the V1 binary push, mapping `rooms[].iot_name` to segment IDs on the active map.

**Changes:**

- `src/cli/mapListHelpers.ts` — shared CLI helpers: `resolveActiveMapId`, push parsers, `extractNamedRooms`, `roomDisplayName`
- `src/cli/commands/legacyMapInfo.ts` — triple parallel push listeners; pass `LegacyNamedRoom[]` to `resolveCurrentRoom`; enrich segment list output
- `src/cli/commands/mapInfo.ts` — import shared helpers instead of private duplicates (no behavior change)
- `src/tests/cli/mapListHelpers.test.ts` — unit tests for helper functions

**Outcome:** Pass (reviewed). CLI-only; names from `get_multi_maps_list` filtered by active `mapFlag`; `(unnamed)` fallback when status unknown or device returns no map list.

## 2026-07-03 — A187 legacy map parse fix (Int32LE + CLI)

**Task:** Fix V1 map parser field widths (UInt16LE → Int32LE for position x/y and image dimensions) and stop awaiting `getHomeMap` RPC so the CLI no longer hangs 10s waiting for an RPC that only returns `vacuumRoom`.

**Changes:**

- `src/roborockCommunication/map/legacy/mapParser.ts` — Int32LE position x/y; Int32LE image top/left/height/width; UInt32LE segmentCount
- `src/cli/commands/legacyMapInfo.ts` — fire-and-forget `getHomeMap`; rely on Protocol 301 push listener only
- `src/tests/exampleData/legacyMapFixture.ts` — fixture builders aligned to Int32LE layout
- `src/tests/roborockCommunication/map/legacy/legacyMapParser.test.ts` — updated assertions for corrected field widths

**Outcome:** Pass (reviewed). Validated on live A187 — robot position, image dimensions, and segment centers now parse correctly.

## 2026-07-03 — V1 map inner decryption fix

**Task:** Fix `legacy-map-info` CLI to decrypt the Protocol 301 inner layer before parsing — the push buffer is outer-decrypted only (24-byte envelope + AES-128-CBC + gzip), not a ready-to-parse `"rr"` binary.

**Changes:**

- `src/roborockCommunication/map/legacy/v1MapDecryptor.ts` — `decryptAndUnzipV1Map`: strip envelope, AES-128-CBC(sessionNonce), gunzip
- `src/roborockCommunication/routing/clientRouter.ts` — `getSerializeNonce()` exposes `MessageContext.serializeNonce` for map decryption
- `src/cli/commands/legacyMapInfo.ts` — decrypt raw Protocol 301 push before `LegacyMapParser.parse()`
- `src/tests/exampleData/legacyMapFixture.ts` — `buildEncryptedV1MapPayload` round-trip fixture helper
- `src/tests/roborockCommunication/map/legacy/v1MapDecryptor.test.ts` — round-trip, wrong-nonce, and too-small buffer tests

**Outcome:** Pass (reviewed). `LegacyMapParser` unchanged (`"rr"`-only); CLI now matches ioBroker/roborock-gitlab wire format.

## 2026-07-02 — Legacy V1 map parser + legacy-map-info CLI

**Task:** Prototype position-to-room containment for legacy V1 vacuums by parsing `get_map_v1` binary (Protocol 301); validated via new `legacy-map-info` CLI command. No plugin runtime changes.

**Changes:**

- `src/roborockCommunication/map/legacy/types.ts` — LegacyMapData, image/segment/robot types
- `src/roborockCommunication/map/legacy/mapParser.ts` — LegacyMapParser: parse binary blocks, resolveCurrentRoom
- `src/cli/commands/legacyMapInfo.ts` — cmdLegacyMapInfo: waitForPush + getHomeMap, print room/segments
- `src/cli/main.ts`, `src/cli/help.ts` — register `legacy-map-info` command
- `src/tests/exampleData/legacyMapFixture.ts` — programmatic V1 map binary builders
- `src/tests/roborockCommunication/map/legacy/legacyMapParser.test.ts` — parse + resolveCurrentRoom tests

**Outcome:** Pass (reviewed). CLI probe only; runtime still uses `vacuumRoom` from getHomeMap RPC.

## 2026-06-29 — Wiki gap fill: 5 new pages + 6 expanded

**Task:** Created 5 new wiki pages documenting message pipeline, listeners, dispatchers, feature flags, and room/map data; expanded 6 existing pages with missing sections; updated Home.md index.

**Changes:**

- `wiki/Runtime-Handlers-Pipeline.md` — created; documents PlatformRunner dispatch chain, handler signatures, burst polling integration
- `wiki/Message-Listeners-Architecture.md` — created; documents broadcaster/listener pattern, V1/B01/MapInfo listener implementations
- `wiki/Message-Dispatchers-Protocol-Routing.md` — created; documents dispatcher factory, V10/Q7/Q10 protocol-specific routing
- `wiki/Feature-Flags-Device-Capabilities.md` — created; documents featureSetDecoder Groups A–G, clean mode gating, DeviceFeatures registry
- `wiki/Room-Map-Data-Pipeline.md` — created; documents DTO → Mapper → Model transformation, AreaManagementService endpoint
- `wiki/Polling-Real-Time-Connection.md` — added cross-link to Runtime-Handlers-Pipeline
- `wiki/Supporting-Domains.md` — added AreaManagementService lifecycle section with methods table
- `wiki/Roborock-Protocol-Wire-Format.md` — added Encode Pipeline and Serializer Factory sections
- `wiki/MQTT-Local-Communication.md` — added AbstractClient section documenting broadcaster/listener host
- `wiki/Error-Handling-Reporting.md` — added partial-implementation note to EmailNotificationService section
- `wiki/Home.md` — added "Message & Protocol Flow" index section with links to 5 new pages

**Outcome:** Pass. Implementer created all 5 new pages and expanded all 6 existing pages per plan.md specifications. Wiki coverage now complete with no gaps remaining.

## 2026-06-29 — Wiki documentation fixes

**Task:** Applied accuracy fixes to documentation across wiki and agent-answers. Fixed 6 files based on review against current source code.

**Changes:**

- `wiki/Clean-Mode-Domain.md` — rewrote "Special Modes" section: removed `vacAndMopDeepModeConfig` row, clarified feature-flag conditions for SmartPlan and VacFollowedByMop; rewrote "Device Capability Registry" section to document feature-flag-driven behavior and unused `_model` parameters
- `wiki/Home.md` — removed broken links table, replaced with archived note; added cross-links to flow documentation (`status-update-flow.md` and `room-map-sync-flow.md`)
- `wiki/Roborock-Protocol-Wire-Format.md` — corrected file path to include `deserializers/` subdirectory
- `wiki/Matterbridge-Device-Registration.md` — updated `hasSmartPlan` call signature to include feature set parameters and documented feature-flag gating
- `wiki/Service-Area-Update.md` — translated 100% from Vietnamese to English while preserving all technical content and structure
- `docs/agent-answers.md` — added historical banner to DEVICE_EXTRA_MODES session explaining that static model lookup has been replaced by feature-flag-driven implementation

**Outcome:** Pass. Reviewer approved all changes. Wiki now accurately reflects current feature-flag-driven architecture with no static model whitelists.

## 2026-06-27 — Wired hasSmartPlan to is_smart_clean_mode_set_supported feature flag

**Task:** Wire `hasSmartPlan` to the `is_smart_clean_mode_set_supported` feature flag instead of always returning `false`.

**Changes:**

- `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts` — updated `hasSmartPlan` signature from `hasSmartPlan(_model: string): boolean` to `hasSmartPlan(_model: string, featureSet?: string, newFeatureSet?: string): boolean`; changed implementation to decode feature flags and return `features.is_smart_clean_mode_set_supported` instead of hardcoded `false`
- `src/behaviors/roborock.vacuum/core/behaviorConfig.ts` — updated call to `hasSmartPlan(model)` to pass feature parameters: `hasSmartPlan(model, featureSet, newFeatureSet)`

**Outcome:** Pass. SmartPlan (mode 4) is now dynamically gated by the `is_smart_clean_mode_set_supported` feature flag from the device's feature set. The feature flag is decoded using the existing `decodeFeatureSet` function.

## 2026-06-27 — Wired featureSetDecoder into capability registry

**Task:** Wire `featureSetDecoder` into `deviceCapabilityRegistry` to dynamically gate `VacFollowedByMop` (mode 11) on the `is_clean_then_mop_mode_supported` feature flag (bit 93 of `newFeatureSet`), while keeping `SmartPlan` (mode 4) and `VacAndMopDeep` (mode 12) as static model-string lookups.

**Changes:**

- `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts` — added `decodeFeatureSet` import; updated `getExtraModes` signature with optional `featureSet?` and `newFeatureSet?` parameters; implemented hybrid filter logic that decodes feature flags only when device context is present and gates mode 11 on `is_clean_then_mop_mode_supported`; updated `getAllModesForDevice` signature and body to thread optional params through
- `src/behaviors/roborock.vacuum/core/behaviorConfig.ts` — extended function signature with `featureSet?` and `newFeatureSet?` parameters; threaded them into `getAllModesForDevice` call
- `src/initialData/getSupportedCleanModes.ts` — extended function signature with optional feature params; passed them to `getAllModesForDevice`
- `src/platform/deviceConfigurator.ts` — threaded `vacuum.featureSet` and `vacuum.newFeatureSet` into `configureBehavior` call
- `src/platform/behaviorFactory.ts` — threaded feature params through to called functions
- `src/types/roborockVacuumCleaner.ts` — passed `device.featureSet` and `device.newFeatureSet` to `getSupportedCleanModes` call

**Outcome:** Pass with notes. All registry functions accept feature flags as optional parameters for backward compatibility. Existing callers without device context (e.g., `runtimeHelper.ts`, `matterStateNames.ts`) compile unchanged. VacFollowedByMop is now dynamically gated; SmartPlan and VacAndMopDeep remain static as planned.

## 2026-06-27 — Implemented featureSetDecoder.ts

**Task:** Implemented pure TypeScript decoder that parses `featureSet` (64-bit integer string) and `newFeatureSet` (hex string) from Device DTO into ~172 named boolean `DeviceFeatures` capability flags, mirroring python-roborock's `DeviceFeatures.from_feature_flags()`.

**Changes:**

- `src/share/featureSetDecoder.ts` — created `DeviceFeatures` interface with Groups A–D decoded fields, Groups E–F–G defaulted to false, and 3 raw diagnostic fields; implemented `decodeFeatureSet` function with Group A (lower 32-bit masks), Group B (upper 32-bit bit-index tests), Group C (last 8 hex chars masked), Group D (nibble-index extraction with private `extractNibbleBit` helper); added error handling for invalid `featureSet` (try/catch BigInt) and invalid hex (NaN guard for maskC)

**Outcome:** Pass. File created at `src/share/featureSetDecoder.ts` as a pure utility (no DI, no side effects) with comprehensive guard against invalid inputs. Wiring into capability registry deferred to separate task.

## 2026-06-27 — Investigated Feature Gap 4 (roomNames Config Override)

**Task:** Investigated Gap 4 from feature-gap analysis to understand the deferred roomNames config override issue and confirm Gap 5 was already implemented.

**Changes:**

- `docs/finding/feature-gap.md` — added investigation findings (Gap 4 root cause, name resolution flow, RoomMapping shape, call sites, config type, schema location) and implementation plan (3-step procedure to add config option)

**Outcome:** Pass. Gap 4 is a low-priority deferred issue with complete implementation plan ready to execute when a user reports missing room names. Gap 5 (FullyCharged explicit state) confirmed already implemented. Gaps 1, 2, 5 closed; Gaps 3 and 4 remain open (low priority).

## 2026-06-27 (Session 36)

- Fixed `ChargingError` (status code 9) to properly set `operationalError` when the robot fails to find or reach the charging dock:
  - Extended `ResolvedState` interface to include optional `operationalError?: RvcOperationalState.ErrorState`.
  - Added status override for `ChargingError` in `stateResolver.ts` that sets `operationalState = Error` and `operationalError = FailedToFindChargingDock`.
  - Updated `deviceStateHandler.ts` to apply the `operationalError` from the resolved state when updating Matter attributes.
  - Updated test in `stateResolver.test.ts` to verify `operationalError` is correctly set for `ChargingError` status.
- Root cause: `ChargingError` was only setting `operationalState = Error` but not the detail field `operationalError`, leaving the Matter controller unable to distinguish the specific failure reason. Now the Matter controller can properly report the "FailedToFindChargingDock" error state.
- All 175 test files / 1877 tests pass. Build successful.

## 2026-06-25 (Session 35)

- Fixed 15 failing tests across 4 test files after the V1/V2 dispatcher refactor:
  - `V01MessageDispatcher.test.ts`: Updated `getMapInfo` tests to expect `MapInfo` (not `undefined`); replaced "liveMapUpdates=true" tests with explicit `getMapInfoV2`/`getRoomMapV2` tests; fixed `getRoomMap` no-data test to expect `[]` instead of `undefined`.
  - `Q7MessageDispatcher.test.ts` / `Q10MessageDispatcher.test.ts`: Fixed `getMapInfo` tests to verify `client.send` (not `client.query`, as Q7/Q10 are push-based); replaced "liveMapUpdates=true" tests with V2 method tests; fixed `getRoomMap` to expect `[]`.
  - `areaManagementService.test.ts`: Added `MapInfo` import; updated mocks to return `MapInfo`/`[]` instead of `undefined`; fixed "no maps" assertion to `toBeDefined()` with `maps.length === 0`.
- Removed `supportsMapQueryResponse` check from `areaManagementService.getMapInfo`/`getRoomMap` — routing now uses only `this.liveMapUpdates` flag (simpler, Q7/Q10 V1 path sends the request and returns empty data which is safe).
- All 175 test files / 1877 tests pass.

## 2026-06-25 (Session 34)

- Restored `getMapInfo` to return `MultipleMapDto[] | undefined` propagated through the full call chain:
  - `V10MessageDispatcher.getMapInfo`: `liveMapUpdates=false` uses `client.query<MultipleMapDto[]>()` returning actual data; `liveMapUpdates=true` uses `client.send()` and returns `undefined`.
  - `Q7MessageDispatcher.getMapInfo` / `Q10MessageDispatcher.getMapInfo`: return type `Promise<MultipleMapDto[] | undefined>`, always return `undefined` (push data handled by MapInfoListener).
  - `abstractMessageDispatcher` interface updated to `getMapInfo(): Promise<MultipleMapDto[] | undefined>`.
  - `messageRoutingService`, `roborockService` propagate the return type.
  - `areaManagementService.getMapInfo`: explicitly processes returned `MultipleMapDto[]` → `MapInfo` → derives `supportedMaps` directly from `mapInfo.maps` (cannot use `getSupportedAreas` — it falls back when rooms are empty) → `setSupportedMaps` only (not `setSupportedAreas`, to avoid overwriting rooms).
  - `areaManagementService.getRoomMap`: removed `setSupportedMaps` call — `setSupportedAreas` reads current `supportedMaps` (set by `getMapInfo`) when calling the listener, preserving maps across the two-step startup flow.
- Fixed two test mocks: `mockResolvedValue()` → `mockResolvedValue(undefined)` in `RoomMap.test.ts` and `roborockService.coverage.test.ts`.
- Lint clean, 175 test files / 1875 tests pass.

## 2026-06-25 (Session 33)

- Fully restored original `getRoomMap` data flow (broken by `fcfdfb6` fire-and-forget refactor):
  - `V10MessageDispatcher.getRoomMap`: `liveMapUpdates=false` uses `client.query<RawRoomMappingData>()` and returns actual room data; `liveMapUpdates=true` uses `client.send()` and returns `undefined`.
  - `Q7MessageDispatcher.getRoomMap` / `Q10MessageDispatcher.getRoomMap`: return `Promise<RawRoomMappingData | undefined>` (always `undefined`, data handled by MapInfoListener push).
  - `AbstractMessageDispatcher` interface updated to `getRoomMap(): Promise<RawRoomMappingData | undefined>`.
  - `messageRoutingService`, `areaManagementService`, `roborockService` propagate the return type.
  - `areaManagementService.getRoomMap`: explicitly processes returned `RawRoomMappingData` → `RoomMap` → `HomeEntity` → `setSupportedAreas/Maps/IndexMap` (mirrors `MapInfoListener.updateAreas`).
  - `areaManagementService` stores `deviceRooms` per-duid (via new `setDeviceRooms`) for room-name lookup during explicit processing; cleared in `clearAll()`.
  - `roborockService.setDeviceRooms` delegates to `areaService.setDeviceRooms`.
  - `deviceConfigurator.configureDevice`: calls `roborockService.setDeviceRooms(duid, homeData.rooms)` before device init.
  - `deviceConfigurator.onConfigureDevice`: calls `await roborockService.getRoomMap(duid, -1)` after `getMapInfo` in the startup loop.
- Updated V10 `getRoomMap` tests: default case asserts `client.query` called and result equals raw data; added "no data" case; live case asserts `client.send`.
- Added `setDeviceRooms: vi.fn()` and corrected `getRoomMap` mock return to `undefined` in shared test utilities.
- Fixed `enableLiveMapUpdates` missing from all affected test config fixtures.
- Lint clean, 175 test files / 1875 tests pass.

## 2026-06-24 (Session 32)

- Wired `onActiveMapChanged` callback from `MapInfoListener` into `connectionService.ts` via `NotifyMessageTypes.ActiveMapChanged`.
- Added `handleActiveMapChanged` to `serviceAreaHandler.ts`: sets `selectedAreas` to all rooms on the new map, `currentArea` to `null`.
- Added early return in `resolveAreaFromCleaningInfo` when `segmentId === INVALID_SEGMENT_ID` to prevent overwriting `currentArea` after map switch.
- Wired `requestStatus` callback into `V1StatusListener`: fires `getDeviceStatus` immediately when `additional_props` (DPS 128) push received.
- Added `deviceProtocol` guard in `MapInfoListener.tryParseB01MapBinary`: V1 devices skip binary parsing, keeping `warn` log for genuine B01 failures.
- Implemented `switchMap` on all dispatchers: V1 (`load_multi_map`), Q7 (`service.set_cur_map`), Q10 (DP 60 `multi_map_switch`).
- Added `trySwitchMap` to `RoborockVacuumCleaner`: detects when selected areas belong to a different map and calls `roborockService.switchMap`.
- Initialized `activeMapId = -1` in `deviceConfigurator.ts` so first status response always triggers `handleActiveMapChanged` and populates `selectedAreas` on startup.
- Refactored `connectionService.ts`: moved dispatcher creation before listeners to eliminate lazy `requestStatusFn` pattern; replaced non-null assertion with captured local variable.
- Fixed lint errors: `prefer-const`, `no-non-null-assertion`, `no-base-to-string` (`JSON.stringify`), import sort.
- Analysed Q10 active map detection: fires via `tryParseB01MapBinary` → `onActiveMapChanged(b01Info.mapId)` from binary map blob (Protocol 301), not from list response.

## 2026-06-24 (Session 31)

- Added `requiresBody: boolean` to `AbstractMessageListener` interface (non-optional).
- Set `requiresBody = true` on: `V1StatusListener`, `B01StatusListener`, `MapInfoListener`, `DeviceStatusListener`.
- Set `requiresBody = false` on: `HelloResponseListener`, `MapResponseListener`, `OneShotResponseListener`, `LocalPingResponseListener`, `LoggingMessageListener`, `PushCaptureListener`.
- Both `V1ResponseBroadcaster` and `B01ResponseBroadcaster` now silently skip listeners with `requiresBody = true` when message body is absent.
- Added 2 tests per broadcaster (skip when body absent + pass-through when `requiresBody = false`); updated all test mocks.
- Bumped version `1.1.7-rc02` → `1.1.7-rc03` across `package.json`, `schema.json`, `config.json`.

## 2026-06-23 (Session 30)

- Verified status update flow issues (Issues 1–6) against current code:
  - Issues 1, 2, 4, 6 already fixed in prior sessions; updated `docs/to_do.md` to reflect.
  - Issue 5: replaced global `allDevicesHaveRealTimeConnection` short-circuit in `requestHomeData` with per-device staleness check using `robot.lastUpdateAt` + `WATCHDOG_THRESHOLD_MS`; updated `updateFromHomeData` to send status updates to stale real-time devices.
  - Issue 3: fixed falsy checks in `handleHomeDataMessage.ts` — `if (batteryLevel)` → `if (batteryLevel != null)`, `if (suctionPower && waterBoxMode)` → `if (suctionPower != null && waterBoxMode != null)`.
- Verified remaining todos against current code — all resolved:
  - `stateResolver.ts` bugs: implementation matches `misc/state_resolution_matrix.md`; doc was lost but no remaining discrepancies.
  - Routine selection: `buildCleanCommand` already separates routines/rooms and uses `indexMap.getRoomId()`.
  - MQTT keepalive: unconditional reconnect re-enabled deliberately.
  - `B01ResponseBroadcaster`: already integrated in `connectionService.ts` + `ResponseBroadcasterFactory`.
- Cleaned `docs/claude_history.md` — kept entries from May 2026 onward (1 month).

## 2026-06-21 (Session 29)

- Implemented fire-and-forget v3 Tasks 3 & 4:
  - **Task 3**: Created `MapInfoListener` at `src/roborockCommunication/routing/listeners/implementation/mapInfoListener.ts`. Handles V1 push responses by shape detection (no messageId correlation): `isRawRoomMappingData` checks for array-of-arrays, `isMultipleMapDto` checks for `map_info` presence. Calls `updateAreas()` which constructs a temporary `HomeEntity` and runs `getSupportedAreas()` → updates `AreaManagementService`. B01-Q10 and B01-Q7 branches are debug-logged stubs pending device log confirmation.
  - **Task 4**: Injected `AreaManagementService` as optional constructor param in `ConnectionService`. Updated `ServiceContainer.getConnectionService()` to pass it. In `initializeMessageClientForLocal`, registered `MapInfoListener` after `simpleMessageListener` using `device.store.homeData.rooms` for room name mapping.
  - Added 12 unit tests for `MapInfoListener` covering duid filtering, V1 room map / map info parsing, B01-Q10/Q7 stubs.
  - All 176 test files, 1892 tests pass. `npm run type-check` exits 0.

## 2026-06-21 (Session 28)

- Implemented fire-and-forget v3 Tasks 1, 2, and 5 (full chain):
  - **Task 1**: Converted `getMapInfo()`/`getRoomMap()` to `Promise<void>` across all 7 layers: `abstractMessageDispatcher` interface, `V10MessageDispatcher` (dropped `client.query`, removed `MultipleMapDto` import), `Q10MessageDispatcher`, `Q7MessageDispatcher`, `messageRoutingService`, `areaManagementService`, `roborockService`.
  - **Task 2**: Rewrote `RoomMap.fromMapInfo()` to `Promise<void>` (fires both requests, returns immediately). Removed `MapInfoResult` interface, `HomeModelMapper` and `debugStringify` imports from `RoomMap.ts`. Updated `deviceConfigurator.ts` to construct `HomeEntity` with `RoomMap.empty()` and `MapInfo.empty()`.
  - **Task 5**: Deleted the blocking `getRoomMap` + `activeMapId` update block from `serviceAreaHandler.ts` lines 109–112. Changed the empty room map guard log from `error` to `debug`.
  - Updated CLI commands (`mapInfo.ts`, `rooms.ts`) to fire-and-return pattern.
  - Updated all affected tests across 8 test files (V01/Q10/Q7 dispatchers, RoomMap, platformRunner, platformRunner2, areaManagementService, roborockService.coverage, deviceConfigurator).
  - `npm run type-check` exits 0. `npm test` — 1880 tests pass (175 files).

## 2026-06-20 (Session 27)

- Audited the status update flow across `deviceStateHandler.ts`, `getBatteryStatus.ts`, `handleHomeDataMessage.ts`, `platformRunner.ts`, `function.ts`.
- Found 3 bugs and 3 design issues; documented in `docs/status-update-flow-issues.md`.
- High: `handleDeviceStatusSimpleUpdate` passes `RvcRunMode.ModeTag` (converted) to `state_to_matter_operational_status` instead of the original `OperationStatusCode` — operational state always `Docked` on the simple path.
- Medium: `getBatteryState` returns `IsAtFullCharge` as default for non-dock states (Cleaning, Paused, etc.), which can incorrectly trigger `Charging → Docked` transition during battery updates.
- Low: `batteryLevel` falsy check in `updateFromHomeData` silently drops 0% battery.

## 2026-06-12 (Session 26)

- Full codebase read-through (learn-codebase): read every remaining source file in `src/roborockCommunication/routing/`, `src/cli/` (+ `cli.ts`), `src/model/`, `src/errors/`, `src/initialData/`, `src/constants/`, `src/runtimes/` (incl. `handlers/`), `src/share/`, `src/types/`, `src/core/domain/`, `src/core/application/models/`, `module.ts`, `settings.ts`, `platformRunner.ts`, and the `behaviors/roborock.vacuum/core/` mode-handling system.
- Created `docs/authentication-flow.md` - mermaid flowchart + summary of the `AuthenticationCoordinator` → `PasswordAuthStrategy`/`TwoFactorAuthStrategy` flow (cached-token check, password login, 2FA verification-code flow, error mapping).
- Updated `docs/CODE_STRUCTURE.md` to fix drift from current source (v1.1.7-rc01):
  - `routing/listeners/`: removed stale `services/` subtree (`pendingResponseTracker.ts`, `b01/v1PendingResponseTracker.ts`), added `oneShotResponseListener.ts`.
  - `initialData/`: replaced nonexistent `getSupportedScenes.ts` with `getSupportedRoutines.ts`, added per-file descriptions.
  - `constants/`: noted `sensitiveDataRegexReplacements.ts` is not re-exported from `index.ts`.
  - `model/`: documented all 7 files (was missing `AuthenticationResponse.ts`, `CleanCommand.ts`, `RoborockPluginPlatformConfig.ts`, `VacuumStatus.ts`).
  - `errors/`: documented full `BaseError` hierarchy.
  - Added new "Error Handling & Plugin Models" and "CLI Tool" sections + ToC entries; bumped version/date header.

## 2026-05-17 (Session 25)

- Improved patch coverage from 83.85% to higher by adding 8 new tests targeting uncovered branches in changed files.
- `oneShotResponseListener.test.ts`: added test for wrong-duid messages (covers line 34 false branch) and `onMessage-before-waitFor` (covers line 40 false branch when timer is undefined).
- `responseBroadcasterFactory.test.ts`: added `deregister` test (covers lines 31-32).
- `clientRouter.test.ts`: added `registerDevice`, `updateNonce`, `isReady`, `unregisterClient`, `query` timeout, and `query` resolve tests; added `error`/`warn` to mockLogger.
- `abstractClient.test.ts`: added `isReady` delegates to `isConnected` test (covers line 40).
- `v1ResponseBroadcaster.test.ts` / `b01ResponseBroadcaster.test.ts`: replaced "throw Error" with `throw 'raw string error'` to cover the `String(error)` branch in the non-Error exception handler.
- All 175 test files, 1876 tests pass (+8). Precommit clean.
