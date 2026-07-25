# Project Shared Memory

Durable knowledge store. Read at session start **only** by: `technical-architect`, `investigator`, `implementer`, `reviewer`, `test-writer` (and `wiki-manager` as a gather-mode source). Other agents skip it.
It is version-controlled — commit and push changes so teammates can pull the latest knowledge.

**Pruning rules:** max 10 bullets per section, **max 2 lines per bullet**. When adding would exceed the cap, move the oldest/least-durable entry to `wiki/memory-archive.md` (never delete outright). `reviewer` enforces the caps whenever it appends. Compress wording — keep file paths and hard facts, drop rationale prose.

---

## Architecture Insights

<!-- Patterns and relationships discovered during analysis -->

- `ModeResolver.resolveFallback()` (`modeResolver.ts:55`, pre-fix Jul 22) discarded suction power/water flow entirely once the exact `suctionPower:waterFlow:mopRoute` triple missed all ~19 presets — always returned generic "...Default" (Auto tag). Any real mode (e.g. Max) with a non-canonical water/route combo showed as "Automatic" in HomeKit. Fix: category-aware match on suction power (vacuum/vacuum+mop) or water flow (mop-only) before falling to generic Default.
- `ModeUtils.assertModeChange` (matter.js mode-base) never checks operational state for Run/Clean Mode — only "is newMode supported"; mid-clean mode changes already work with zero guards anywhere in the chain.
- `ProgressStruct.estimatedTime` (ServiceArea) spec: set once at Progress-entry creation, unlike `estimatedEndTime` which re-publishes every tick. No per-room historical duration data exists (confirmed Jul 2026); only the active area can get a non-null estimate.
- Live map updates: `resolveInitialAreas` must sync-bootstrap via `fetchAndApplyMapInfo`/`fetchAndApplyRoomMap` (ignore V2); public `getMapInfo`/`getRoomMap` stay V2-only when `liveMapUpdates`. `handleActiveMapChanged` must intersect with Matter `supportedAreas` before writing `selectedAreas`.
- Multi-map areas: partial room-map fetch/push merges by `mapId` via `mergeSupportedAreasByMap` (keeps other maps, re-indexes areaIds); full `mapInfo.allRooms` / V1 map-info push stays full replace.
- Multi-map + `enableMultipleMap`: ON → bootstrap all physical maps via `switchMap`+sync fetch, merge by mapId; OFF → primary only (`maps[0]`) via `getSupportedAreas(..., false)` — wired from `configManager.isMultipleMapEnabled`.
- No code path calls V1 `dispatcher.getHomeMap` (`get_map_v1`) on a recurring basis — `PollingService` only calls `getDeviceStatus`; `AreaManagementService.startPeriodicRefresh` only calls `getMapInfo` (`get_multi_maps_list`). A V1 position-based fallback needs its own explicit trigger.
- `MapInfoListener.tryParseB01MapBinary` skips `Protocol.map_response` when `deviceProtocol === ProtocolVersion.V1` (`mapInfoListener.ts:165`), but a SEPARATE `tryParseV1MapBinary` (`:211-238`) handles V1 map binaries via `decryptAndUnzipV1Map`→`resolveCurrentRoom`→`onV1RoomResolved`; confirmed firing correctly in real S8 logs (Jul 25, corrects a prior stale claim that V1 binaries were dropped entirely).
- `OperationStatusCode.WashingTheMop`(23) override (`stateResolver.ts:128-139`) writes `operationalState=FillingWaterTank` for ~2-3min at clean-start (real mop-pad wash phase) before `Running` — Apple Home master tile likely shows this as "Preparing" (unconfirmed, HomeKit-side); `RvcRunMode.currentMode`/`RvcCleanMode.currentMode` update correctly/promptly throughout, independent clusters.
- V1 `mapParser.ts` `resolveCurrentRoom` (`:72-99`): exact-pixel-match tier only matches pixels where `parseImageBlock` recorded a segment (`pixelType` bits 2:0 in `{2..7}` AND `segmentId` bits 7:3 nonzero) — misses on wall/obstacle/type-0 pixels, common at room boundaries. Prior fallback was straight-to-nearest-centroid (no containment check) — confirmed real-log cause of cross-room mismatches (Jul 25 S8 fix: bounding-box containment tier inserted before centroid).

## Known Patterns

<!-- Coding patterns established in this project -->

- **Commit messages:** `<type>(<optional scope>): <short summary>` + optional why-body. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`. Imperative mood; no `Co-Authored-By`.
- Per-device override pattern: array of objects with key (`serialNumber`) + value (`productName`), gated by a boolean in `advancedFeature.settings`. See `DeviceProductNameOverride` (`RoborockPluginPlatformConfig.ts:58`).
- New config sections in schema use JSON Schema `if/then` blocks under `advancedFeature.allOf`.
- **Agent frontmatter:** `effort`/`maxTurns` after `color`, before `tools`; `tools` MUST be a comma-separated string — YAML block lists silently fail and the subagent falls back to Read/Write/Edit/Bash only.
- **Subagent toolsets (macOS, re-verified Jul 10 2026):** native `Glob`/`Grep` absent from Task subagents — `mcp__glob-grep__*` is the only working search. `LSP` newly reachable in wildcard-tools subagents via deferred ToolSearch (one probe; explicit `tools:` lists historically never got it) — don't rely on it in agent definitions.
- **Subagent task tracking:** `TaskCreate`/`TaskUpdate`/`TodoWrite` never reach Task subagents (verified Jul 10 2026, direct-executor probe) — never list them in agent frontmatter; EM tracks pipeline steps in the main session, subagents report plain text (use a `progress.md` file in the task folder if live status is ever needed).

## Decisions Made

<!-- Architectural and design decisions with rationale -->

- `MatterbridgeServiceAreaServer.selectAreas` (`@matterbridge/core`) unconditionally calls `super.selectAreas(request)` with the ORIGINAL request AFTER our command handler runs, writing `this.state.selectedAreas` directly (bypasses `updateAttribute`). Any empty-input resolution must intercept in `RoborockServiceAreaServer.selectAreas` and forward a RESOLVED request to `super.selectAreas`, not `updateAttribute` from `roborockVacuumCleaner.ts`'s command handler — that write always loses the race.
- `extra_time` → `estimatedEndTime` removed (Jul 2026); replacement: V1-only opt-in `enableEstimatedEndTime` (default off) + `clean_time`/`clean_percent` linear ETA in `src/share/estimatedEndTime.ts`; B01/Q7/Q10 stay `null`.
- `robot.homeInFo.activeMapId` inits to `-1` (`deviceConfigurator.ts:105`), only written via B01/Q7 `onActiveMapChanged` — V10/V1 NEVER updates it. `RoomIndexMap.getAreaId(roomId,mapId)` then always misses for V10/V1 multi-map; `getAreaIdV2(roomId)` is the correct fallback.
- No "currently selected map" Matter attribute exists — Apple Home infers active map from which map's rooms appear first in `supportedAreas`/`selectedAreas` (mirrors `roborockService.ts:350` `buildCleanCommand`).
- `handleActiveMapChanged` (`serviceAreaHandler.ts:234-275`) has no idle/cleaning guard — unconditionally overwrites `selectedAreas`/`currentArea`/`progress`; only matters if the device reports a genuinely different active map mid-clean.
- Shared state-update helper pattern (`applyResolvedStateUpdates`, `deviceStateHandler.ts:22-49`): extract identical Promise.all/snapshot/completion blocks into a private async helper; callers keep their own state resolution and return values.
- `AreaManagementService.supportedRoutines` (routine-as-room, `mapId=999`) is structurally separate from `supportedAreas` — "all rooms of active map" logic from `getSupportedAreas` excludes routines automatically.
- `homeInFo.activeMapId` alone is unreliable for active-map inference (stays -1 for V10/V1). Fallback order used in `SELECT_AREAS` empty-list handling: Matter `selectedAreas` mapId → `activeMapId` (if not -1) → first `supportedAreas` mapId.
- `RvcRunMode.ChangeToMode(Idle)` is now handled via `IdleModeHandler` (new, Jul 10 2026) → `roborockService.pauseClean`. `Mapping` deferred: `AbstractMessageDispatcher` (V10/Q7/Q10) has zero mapping/explore-start command.
- `getSupportedAreas()` (`initialData/getSupportedAreas.ts`) is the single point enforcing "Areas non-null mapId ⇒ supportedMaps non-empty" (Matter `#assertSupportedAreas`). `processValidData` branch always assigns numeric `mapId`; empty `mapInfo.maps` (e.g. `MapInfo.empty()` fallback) previously left `supportedMaps=[]` — fixed via `buildPlaceholderSupportedMaps` (pair, don't null — matches existing `createFallbackArea` convention).
- V1 currentArea fallback (planned): CLI's `extractNamedRooms`/`roomDisplayName` (`cli/mapListHelpers.ts`) stay CLI-only — runtime resolves `segmentId → areaId` via existing `roomIndexMap.getAreaId`/`getAreaIdV2`, doesn't need room names, so no move/share needed.
- `progress` reset-on-new-clean (Jul 13, 2026, revised): TWO reset triggers — `selectAreas` AND `handleServiceAreaUpdate`'s Idle branch (replaces old Operating→Completed flip with direct `[]` clear, since both writes happen in one sync call with no observable gap). NOT `RoborockService.startClean` — its `HandlerContext` chain never carries `robot`/`device`.
- `RoborockVacuumCleaner.roborockService` exposed as `public readonly` (not private) to enable behaviors/servers (e.g., `RoborockServiceAreaServer`) to call `setProgress()`/`getProgress()` directly without routing through platform. Companion to existing public readonly `device` and `homeInFo` fields.
- Dock→Matter mapping (Jul 2026): default bundle Items 1+2+3+4 in `DockStationStatus.ts` only; Item 3 vs 5 mutually exclusive (full dss vs dustBag-only); codes 32/33/35 as `DockErrorCode` enum; dss priority clearWater→dirty→dustBag→cleanFluid→filter→updown.
- `progress` reset on start-of-clean (Jul 14, 2026): 3rd trigger added — `handleServiceAreaUpdate` compares stored-vs-current `operationalState` "actively cleaning" classification (Docked/Stopped/Error = not cleaning), NOT raw `CLEANING_STATES` membership (misses `ReturningDock`/`EmptyingDustContainer` detours → false positives). Flag stored in `AreaManagementService` (proxied via `RoborockService`), not a module-level var.
- Vacuum→Matter mapping (Jul 2026): bundle ideas 2–6 in `VacuumStatus.ts`; export `VACUUM_ERROR_TO_MATTER`; unknown non-zero → `UnableToCompleteOperation`; add `VacuumErrorCode.AutoEmptyDockFanError=33`; 8 semantic refinements per spike answer.md.
- `dss` field `isUpdownWaterReady` (bits 0-1) does NOT reliably follow the shared Unknown/Error/OK convention on real hardware: dss=2729 shows it=1 (Error) persistently while idle/charging with zero other error signal — false positive. Excluded from `hasError()`/`DSS_FIELD_PRIORITY` (Jul 22, 2026 fix); still parsed, just not error-consulted. Prior Item-3 inclusion (Jul 2026) was only "medium confidence" (ioBroker label, no RVC enum) — now disproven. Re-check (Jul 22): python-roborock `v1_containers.py:277-278` is `hatch_door_status` (bits 12-14), NOT bits 0-1 as previously miscited — python-roborock parses no field at bits 0-1 at all, any version.

## Test Patterns

- **computeAreaEstimatedTime tests:** pure helper returning raw remaining seconds (no `now +`); `25%/60` → `180`; `100%` → `0`; bounds 5–100%; `cleanPercent=undefined` → `null`. Import from `src/share/estimatedEndTime.js`.
- **ModeHandler tests (IdleModeHandler):** test `canHandle(mode, activity)` returns true only for target activity (Idle), false for others (Cleaning/Mapping/unknown). Integration: add tests to `behaviorConfig.test.ts` that call `registry.handle(duid, mode, activity, context)` and verify `roborockService` method + logger call; run on both DefaultBehavior and BehaviorSmart configs.
- **ModeResolver.createDefaultModeResolver/createSmartModeResolver tests:** gated feature branches (e.g., OneTime→VacFollowedByMop mode 11) require two test paths — unsupported configs array (baseCleanModeConfigs, smartPlanModeConfig only) + supported array (inject vacFollowedByMopModeConfig). Test both branches and priority order (OneTime before isCustomMode before exact-match). Serialization key is `suctionPower:waterFlow:mopRoute` (sequenceType omitted).
- **RoborockServiceAreaServer.selectAreas override tests:** spy on parent prototype's selectAreas via `vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(server)), 'selectAreas')` and mock its response to avoid deep matterbridge machinery; verify override calls `device.resolveAllRoomsForActiveMap()` for empty input, `device.trySwitchMap(areas)` for non-empty input, forwards resolved/original request to super with correct arguments.
- **Status listener error-code tests (V1StatusListener, handleHomeDataMessage):** listener fires `onError` whenever error-related field is _defined_ (including 0/None), not only non-zero; test three cases: payload with None/0 codes, field-absent (no call), sequential error→clear (both called). For home-data, `updateRobotWithPayload(ErrorOccurred)` only if errorCode defined; missing field never dispatches.
- **handleCleaningWithoutInfo + resolveV1CurrentArea tests:** test realistic multi-room `selectedAreas = [0, 1, 2...]` (not empty arrays) to match real-world scheduled-clean scenarios. Verify V1 resolution attempts before falling back to pin-first-area. Cover: fresh cache (resolves correct room), cache miss (pin-first + refresh), segment outside selectedAreas (pin-first + no refresh), non-V1 protocol (pin-first + no V1 calls), single area (immediate pin, no resolution), zero areas (null + empty).
- **DockStationStatus tests:** parse raw dss integers, 5-field priority in `hasError()`/`getMatterOperationalError()` (clearWater→dirty→dustBag→cleanFluid→filter, EXCLUDE isUpdownWaterReady). `isUpdownWaterReady` still parsed but false-positive on real hardware (dss=2729 idle = bit Error), verified via real-log fixture. Use `createDockStatus()` helper + `OK`/`ERR` constants for override tests.
- **resolveAreaFromCleaningInfo falsy-zero tests:** test areaId=0 separately (segment→0 resolves as 0, not null); verify `mappedArea === undefined` check (not `!mappedArea`). RoomIndexMap mock: multi-area roomMapData + roomInfo for segment→areaId mapping.
- **handleCleaningWithoutInfo last-known-area tests:** mock `getAttribute(ServiceArea.id, 'currentArea')` to return prior value; test first-update (undefined → fallback selectedAreas[0]), mid-run valid (→ reuse), mid-run falsy-zero (0 in selectedAreas[0,1,2] → use 0), stale value (not in selectedAreas → fallback). Use separate mockImplementation for each currentArea return value.
- **ModeResolver.resolveFallback category-aware tests:** import `vacuumOnlyModeConfigs`, `mopOnlyModeConfigs`, `vacuumAndMopModeConfigs` alongside `baseCleanModeConfigs`; test Max/Balanced/Quiet suction with non-canonical water/route → match same-category mode (not Default); test vacuum-off/mop-off branches; test unrecognized suction → Default fallback. Exact-triple match still takes priority (no regression).

## Common Pitfalls

<!-- Things to avoid — bugs found, anti-patterns, footguns -->

- `src/roborockCommunication/map/v1/` (not `map/legacy/`) is the live import path for `mapParser.js`/`v1MapDecryptor.js` — pre-existing uncommitted rename (Jul 3, 2026); don't revert if dirty.
- Implementer must NOT run full builds or the whole test suite — its gate is `format:ci` → `lint:fix:ci` → `type-check:ci` only; `build:local:ci`/`test:ci` belong to compiler/test-writer.
- `platformRunner.ts:120` writes `activeMapId` BEFORE `handleActiveMapChanged` — a guard inside the handler can't prevent `activeMapId` desync, and the same-map guard (`:119`) then swallows an identical-mapId retry.
- `SELECT_AREAS` empty-input path (`roborockVacuumCleaner.ts:164-176`) must NOT call `trySwitchMap` — keep empty vs explicit branches structurally separate with early `return`, else V10/V1 (`activeMapId=-1`) fires unguarded `switchMap` on every global-clean.
- ESLint `preserve-caught-error` requires re-thrown errors to carry `{ cause: err }` — omitting it fails `lint:fix:ci` even when the message embeds the original error text.
- ESLint `no-base-to-string` prohibits stringifying `err.cause` directly in templates (`String(err.cause)`) — check `if (cause instanceof Error)` first, then safely access `.message`; this prevents accidental `[object Object]` in logs.
- `handleCleaningWithoutInfo`'s `selectedAreas[0]` pin (`serviceAreaHandler.ts:311`) DOES reuse last-known `currentArea` first (PR #150/ef1efb1) — but on real S8 V1 hardware the `robot.getAttribute(ServiceArea.id,'currentArea',...)` read used for that reuse itself unreliably returns non-number on the SAME tick a valid value was durably written one tick earlier (log-proven: this read never once emits the standard `Get endpoint` log line unlike sibling reads; matterbridge-internal mechanism unconfirmed, no `node_modules` reachable). Forces the pin every single `v1RoomResolutionCache` TTL cache-miss (~30s), not just on genuine first-run. Fix (Jul 25): same-process `AreaManagementService.lastKnownAreaCache`, synced in `updateCurrentAreaAndEstimate`, checked before `getAttribute`.
- `resolveAreaFromCleaningInfo`'s falsy-zero check is fixed (`mappedArea === undefined`, `serviceAreaHandler.ts:405`) — confirmed correct Jul 25, no gap.
- `DockStationStatus.isUpdownWaterReady` (bits 0-1 of dss) is parsed/observable but EXCLUDED from `hasError()`/`getMatterOperationalError()` (Jul 22, 2026 fix, `rvc-unable-to-complete-cleaning-error`). Real hardware shows it=1 (Error) as steady-state idle/charging, not transient fault — unreliable error signal, unlike the 5 other dss fields.
- `modeResolver.ts`'s `createDefaultModeResolver`/`createSmartModeResolver` `customCheckFn` OneTime branch (pre-fix Jul 22) unconditionally returned `VacFollowedByMop` mode (11) regardless of `configs` — real `seq_type` wire field (`v1StatusListener.ts:96`) reaches it on ANY non-B01 device (`connectionService.ts:161`), not just capability-gated ones. Fix: gate on `configs.some(mode===11)`, computed once per factory call (closures already have `configs` in scope, no signature change).

## Module Notes

<!-- Notes about specific modules, non-obvious behaviors -->

- `roomNameNormalizer.ts` (b01): pure module, no imports. `normalizeB01RoomName(roomName, roomTypeId?, roomId?)` returns non-empty; callers may still chain `|| fallback`. `rr_other` (typeId 0) always resolves to `Room ${roomId}`.

- Q10 map format: python-roborock's `lz4_block_decompress` (`b01_q10_map_parser.py:190-237`) is a hand-rolled zero-dep LZ4 _block_-format decoder, NOT a call into the Python `lz4` package — no size param, decodes until input exhausted.
- ioBroker's Q10 parser lives at `ioBroker.roborock/src/lib/map/q10/Q10YxMapParser.ts` (not `b01/`) — a structurally different "YxMap" format (28-byte header, version/pixLen/pixLzLen fields) vs python-roborock's `01 01`+offset-27/29 layout; only LZ4-block-format + big-endian u16 width/height are cross-corroborated.
- Q10 fix landed: `b01MapParser.ts.parseRoomsFromEncryptedBinary` routes `0x01 0x01`-prefixed payloads to new `b01Q10MapParser.ts`/`lz4BlockDecompressor.ts` (hand-rolled, zero-dep); Q7 AES+zlib pipeline untouched. `0x02 0x01` trace packets now route to `b01Q10TraceParser.ts` (`parseQ10TracePacket` → `B01MapInfo.currentPose` = last point; rooms/mapId/roomMatrix always empty/undefined) instead of falling through to the Q7 path — superseded a same-day minimal "recognize+skip, no parse" fallback that had landed on `dev` first.
- `0x02 0x01` confirmed = python-roborock `Q10TracePacket` (10-byte header + repeating i16be x/y pairs, robot_position=last point); NOT corroborated by ioBroker (different wire format, no `02 01` marker at all). Real-hardware repro: 598B during active cleaning vs 7076B full map. Live-validated on real Q10 S5+: real changing (x,y) coordinates, zero crashes across 8 invocations. `mapInfoListener.ts`/`roomMatrixResolver.ts` needed zero changes (already consume `currentPose` generically); area/room wiring stays out of scope.

## Open Questions

<!-- Unresolved questions for the team -->

- Does our TypeScript plugin call `APP_GET_INIT_STATUS`? If so, are `newFeatureInfo`/`newFeatureInfoStr`/`featureInfo` captured and stored?
- `roomMatrix` (RobotMap field 13) confirmed undecoded in python-roborock/ioBroker.roborock/roborock-gitlab too — all define it, none decode it (room-pixel data comes from `roomChain`/occupancy grid instead). Still needs real Q10 packet capture.
- `OperationStatusCode` 104: confirmed absent from canonical status enum in all 3 reference repos (identical `103→202` gap everywhere). The only "104" found is an unrelated DP-id (`BREAKPOINT_CLEAN`), not a status value — coincidence, not the answer.

## Archive

Older entries and one-off research (B01/Q7/Q10 current-room detection, featureSet decoding reference) live in `wiki/memory-archive.md` — consult it when working on those areas.
