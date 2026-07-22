# Claude History

Entries are listed in reverse chronological order (most recent first). Older entries (2026-07-03 and earlier) have been moved to `workspace/claude_history_archive.md` to keep this file focused on recent work.

---

## 2026-07-22 — Fix isUpdownWaterReady false-positive in dock error detection

**Task:** Fix false-positive "Docking station error detected: UnableToCompleteOperation" reported to Apple Home/Matter when vacuum was idle and charging with no real fault. Root cause: isUpdownWaterReady dss-bitfield (bits 0-1, intended for up/down water lift-pump faults) was included in hasError() and DSS_FIELD_PRIORITY despite no corresponding Matter RVC enum; real hardware showed this field's steady-state value is 1 during idle/charging, not a transient fault signal.

**Changes:**

- `src/model/DockStationStatus.ts` — excluded isUpdownWaterReady from hasError() and DSS_FIELD_PRIORITY; field remains parsed/exposed on the object for future debugging
- `wiki/Error-Handling-Reporting.md` — updated priority table to reflect five monitored dss fields (clearWater, dirtyWater, dustBag, cleanFluid, filter) instead of six
- `src/tests/model/DockingStationStatus.test.ts` — updated 4 tests to reflect corrected behavior (isUpdownWaterReady=Error alone now yields false/NoError)

**Outcome:** Pass (all verification gates passed: format:ci, lint:fix:ci, type-check:ci, test:ci; reviewer approved logic change).

## 2026-07-22 — Fix room/mode mismatch in HomeKit during cleaning (rc02)

**Task:** Fix HomeKit room indicator flickering/mismatching during multi-room cleans and incorrect mode display ("Automatic" shown when running "Max"). Root causes: (1) handleCleaningWithoutInfo unconditionally pinning currentArea to selectedAreas[0] when cleaningInfo transiently absent; (2) falsy-zero bug in resolveAreaFromCleaningInfo treating areaId=0 as not-found; (3) ModeResolver.resolveFallback() collapsing to generic Default when exact preset not matched.

**Changes:**

- `src/runtimes/handlers/serviceAreaHandler.ts` — last-known-area preservation fallback; avoid unconditional pin-to-first-area
- `src/behaviors/roborock.vacuum/core/modeResolver.ts` — category-aware resolveFallback matching suction power/water flow before Default fallback; fixed falsy-zero check to `=== undefined`
- `src/tests/runtimes/handlers/serviceAreaHandler.test.ts` — added area handling edge-case tests
- `src/tests/behaviors/roborock.vacuum/core/modeResolver.test.ts` — added mode resolution coverage for edge-case presets

**Outcome:** Pass (all verification gates passed: format:ci, lint:fix:ci, type-check:ci, test:ci; reviewer approved with no blocking issues).

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
