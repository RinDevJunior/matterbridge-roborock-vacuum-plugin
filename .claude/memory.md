# Project Shared Memory

Durable knowledge store. Read at session start **only** by: `technical-architect`, `investigator`, `implementer`, `reviewer`, `test-writer` (and `wiki-manager` as a gather-mode source). Other agents skip it.
It is version-controlled — commit and push changes so teammates can pull the latest knowledge.

**Pruning rules:** max 10 bullets per section, **max 2 lines per bullet**. When adding would exceed the cap, remove or merge the oldest entry first. Compress wording — keep file paths and hard facts, drop rationale prose.

---

## Architecture Insights

<!-- Patterns and relationships discovered during analysis -->

- Room data (supportedAreas, roomIndexMap) is in-memory only inside `AreaManagementService` private Maps keyed by duid — no file/db persistence.
- `getSupportedAreas` is called from 3 sites: `areaManagementService.getMapInfo`, `areaManagementService.getRoomMap`, `mapInfoListener.updateAreas`.
- Room name resolution (`getSupportedAreas.ts:109-113`): `iot_name` → lookup by `iot_name_id` → `Unknown Room ${randomInt(1000,9999)}`. B01 path normalizes firmware tokens via `normalizeB01RoomName()` in `MapInfoListener.tryParseB01MapBinary()`; R2 deterministic fallback deferred.
- V10 cloud `tag` and B01 `roomTypeId` use different numbering (e.g. V10 Kitchen=14, B01 Kitchen=6). B01 sets `RoomMapping.areaType` via `roomTypeIdToAreaTag()` (covers 0–11 + extended 2001–2011 per ioBroker); V10 uses `populateAreaNamespaceTag` tag switch.
- Q7 map fetch: `Q7MessageDispatcher.getRoomMap`/`getRoomMapV2` fire `service.upload_by_maptype` (`get_room_mapping`) with `{ force: 1, map_type: 0 }` — primary-only, no fallback retry; `activeMap` param retained but not sent.
- `deviceCapabilityRegistry.ts` (clean-mode-only): `getExtraModes` returns `[]` without feature context, else `[vacFollowedByMopModeConfig]` if `is_clean_then_mop_mode_supported`; `hasSmartPlan` returns `features.is_smart_clean_mode_set_supported`; `getAllKnownModeConfigs` hardcodes `[vacFollowedByMopModeConfig, ...baseCleanModeConfigs]`.
- Feature-gated mode wiring: `deviceConfigurator.ts` → `behaviorFactory.ts` → `buildBehaviorConfig` → `getAllModesForDevice` thread `featureSet`/`newFeatureSet`; `roborockVacuumCleaner.ts` passes them to `getSupportedCleanModes`.
- `cleanModeHandler.ts:35` has only `DeviceSpecs` in scope (no featureSet) — out of scope for feature-gating. `matterStateNames.ts:6` calls `getAllKnownModeConfigs()` at module level (pure name lookup) — no change needed.
- SmartPlan (mode 4) gated by feature flag; VacAndMopDeep (mode 12) dropped — no feature flags found in DeviceFeatures. Decision: drop rather than gate by model string.
- `RoomMapping` stable key candidates: `id` (number), composite `${id}-${iot_map_id}` (string, matches `roomInfos` Map key), `iot_name_id` (string).
- `AreaManagementService.clearAll()` wipes all in-memory area data including room names. Fallback room name suffix (`RANDOM_ROOM_MIN=1000`, `MAX=9999`) is non-deterministic — changes every startup.
- Startup room names: `getRoomMap` enriches raw tuples via `HomeModelMapper.enrichMapRoomDtoFromMapInfo(dto, mapInfoCache)` before `toRoomMapping`; `HomeEntity` uses `storedMapInfo` not `MapInfo.empty()`.
- Live map updates: `resolveInitialAreas` must sync-bootstrap via `fetchAndApplyMapInfo`/`fetchAndApplyRoomMap` (ignore V2); public `getMapInfo`/`getRoomMap` stay V2-only when `liveMapUpdates`. `handleActiveMapChanged` must intersect with Matter `supportedAreas` attribute before writing `selectedAreas`.
- Multi-map areas: partial room-map fetch/push merges by `mapId` via `mergeSupportedAreasByMap` (keeps other maps, re-indexes areaIds); full `mapInfo.allRooms` / V1 map-info push stays full replace.
- Multi-map + `enableMultipleMap` (cycles 4–5): when ON, bootstrap all physical maps via `switchMap`+sync fetch, merge by mapId; when OFF, primary only (`maps[0]`) via `RoomMap.getRooms(..., false)` in `getSupportedAreas(..., false)` — wired via `AreaManagementService.enableMultipleMap` + `MapInfoListener.enableMultipleMap` from `configManager.isMultipleMapEnabled`.

## Known Patterns

<!-- Coding patterns established in this project -->

- **Commit messages:** `<type>(<optional scope>): <short summary>` + optional why-body. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`. Imperative mood; no `Co-Authored-By`.
- Per-device override pattern: array of objects with key (`serialNumber`) + value (`productName`), gated by a boolean in `advancedFeature.settings`. See `DeviceProductNameOverride` (`RoborockPluginPlatformConfig.ts:58`).
- New config sections in schema use JSON Schema `if/then` blocks under `advancedFeature.allOf`.
- **Agent frontmatter:** `effort`/`maxTurns` go after `color`, before `tools`. `tools` MUST be a comma-separated string (`tools: Read, Grep, Bash`) — YAML block lists silently fail to parse on some CLI versions and the subagent falls back to Read/Write/Edit/Bash only (Glob/Grep "tool not available").
- **LSP tool availability:** works in main session, absent in Task subagents — confirmed structurally absent (Jul 5 2026, CLI 2.1.201): forced-call test showed `LSP` has no function schema entry in subagent's toolset at all (unlike Glob/Grep which existed as named-but-erroring before the glob-grep fix). Frontmatter `tools:` edits and prompt-level forced attempts both had zero effect — no settings.json/.mcp.json knob exists for this (unlike `enabledMcpjsonServers` for glob-grep). Contradicts github.com/anthropics/claude-agent-sdk-typescript#123 where Task subagents from interactive mode reportedly DO inherit LSP — root cause here is unresolved but confirmed unfixable from within this repo. Instructions must say "when in your toolset, else skip silently"; never write unconditional "use LSP".

## Decisions Made

<!-- Architectural and design decisions with rationale -->

- Group C masks `2147483648` (2^31) and `1073741824` (2^30) use `!== 0` comparison (JS signed-32-bit bitwise behavior).
- Legacy V1 map room names: not in `"rr"` binary — from `get_multi_maps_list` (`rooms[].iot_name`) filtered by active `mapFlag` (`map_status >> 2`); helpers in `src/cli/mapListHelpers.ts`. Active map unknown (sentinel 63) → `(unnamed)`, never flatten all maps (room ID collision).
- B01 `currentPose`/`roomMatrix` (Q10): Protocol 301 carries the whole payload as one opaque buffer (`messageDeserializer.ts:120-128`) — no new Protocol enum/listener; fields are siblings of `roomDataInfo` in `SCMap.RobotMap` already reaching `tryParseB01MapBinary()`. Extend `roborockProto.ts`/`b01MapParser.ts`/`types.ts` only.
- `roomMatrix` pixel decode deliberately unimplemented (`resolveRoomFromPose()` → `undefined`): no OSS reference decodes it, and a wrong guess would silently corrupt `currentArea`. Skeleton shipped; algorithm deferred until real Q10 capture.
- Two-phase pattern for unverifiable device-protocol features: Phase 1 = standalone CLI command (`connectDevice()` + `waitForPush()` skeleton) for real-hardware verification; Phase 2 wires the shared dependency-free pure module into production.
- Pose (`MapInfoListener`) and status (`B01StatusListener`) are decoupled — join via cache-write/read pair on `AreaManagementService` (per-duid `Map` + `setX`/`getX`, like `supportedAreaIndexMaps`), NOT a new `ServiceAreaUpdateMessage` field.
- Matterbridge SDK's `RoboticVacuumCleaner.createDefaultServiceAreaClusterServer` hardcodes `ServiceArea.Feature.Maps` only, no feature-flag param — enabling `ProgressReporting` requires overriding the method in `RoborockVacuumCleaner`, not a constructor arg. Override must copy base class's default literal arrays verbatim (line 154-175 `roboticVacuumCleaner.ts` in SDK).
- `ServiceAreaBaseServer.selectAreas()` (`@matter/node` SDK) has zero operational-state guard — SDK never enforces `SelectWhileRunning`; safety must come from our own command handler.
- `commonCommands.ts` `SELECT_AREAS` handler only calls `setSelectedAreas` (queued for next clean, no live redirect); `trySwitchMap`/`switchMap` fires an unguarded map-switch regardless of operational state — do not enable `ServiceArea.Feature.SelectWhileRunning` until an idle/running guard exists.
- ServiceArea.Progress state management: initialize all selected areas to `Pending` on session start; transition actively-cleaning area to `Operating` (others → `Completed`); on idle, mark remaining `Operating` → `Completed`. Helper `buildProgressUpdate` in `serviceAreaHandler.ts:28-67` centralizes transition logic; use same function across all call sites to avoid duplication.
- B01/V1 status listener isolation: register `B01StatusListener` only when `device.pv === ProtocolVersion.B01`, `V1StatusListener` otherwise — in `connectionService.ts` `initializeMessageClientForLocal`. `MapInfoListener` stays dual-protocol (internal guards); do not split `ResponseBroadcasterFactory.register()`.
- SkipArea: `RoborockServiceAreaServer` extends `MatterbridgeServiceAreaServer`; V10 `stop_segment_clean` via `skipRoomCleaning`; Q10/Q7 throw → `InvalidInMode`. Progress/currentArea via `finalizeSkipArea()` + `markAreaSkipped`/`getNextPendingArea`.
- `extra_time` → `estimatedEndTime` removed (Jul 2026); replacement: V1-only opt-in `enableEstimatedEndTime` (default off) + `clean_time`/`clean_percent` linear ETA in `src/share/estimatedEndTime.ts`; B01/Q7/Q10 stay `null`.
- `robot.homeInFo.activeMapId` inits to `-1` (`deviceConfigurator.ts:105`), only written by `platformRunner.ts:119-120` via B01/Q7 `onActiveMapChanged` (`mapInfoListener.ts` `tryParseB01RoomMap`/`tryParseB01MapBinary`) — V10/V1 NEVER updates it, stays `-1` forever. `RoomIndexMap.getAreaId(roomId,mapId)` exact-key lookup then always misses for V10/V1 multi-map; `getAreaIdV2(roomId)` (mapId-agnostic, already unit-tested) is the unused correct fallback.
- No explicit "currently selected map" Matter attribute exists anywhere — Apple Home infers active map from which map's rooms appear first in `supportedAreas`/`selectedAreas` (mirrors `roborockService.ts:350` `buildCleanCommand`'s own inference).
- `resolveInitialAreas` (`areaManagementService.ts:273`) fetches the device's CURRENTLY-ACTIVE map's rooms first (`fetchAndApplyRoomMap(duid,-1)`) before the per-map loop (line 276) — that map's rooms always land as areaId 0..N-1 regardless of its `mapInfo.maps` index, so `supportedAreas` order silently depends on which map was active at restart, not map index. Fix: sort by mapId once after bootstrap, not inside `mergeSupportedAreasByMap` (reused by live-update runtime paths where insertion-order stability matters).
- `handleActiveMapChanged` (`serviceAreaHandler.ts:234-275`) has no idle/cleaning-state guard — unconditionally overwrites `selectedAreas`/`currentArea`/`progress` on any `onActiveMapChanged` fire. `startPeriodicRefresh`/`getMapInfoV2` never calls `switchMap` and the `platformRunner.ts:119` same-map guard already prevents self-triggered false positives — the gap only matters if the device itself reports a genuinely different active map mid-clean.
- `src/errors/` had 22/30 dead subclasses (whole `CommunicationError.ts`/`ConfigurationError.ts`/`ValidationError.ts` files) with test coverage only in their own dedicated `src/tests/errors/*.test.ts` — no production `throw`/`instanceof`. Verify via per-class grep before trusting an audit's dead-code count.
- `AbstractMessageHandler` (`routing/handlers/abstractMessageHandler.ts`) has one implementer (`SimpleMessageHandler`, marked "Skeleton only") but user rejected removal — kept for future use. CodeGraph shows 14 callers across `simpleMessageHandler.ts`/`b01StatusListener.ts`/`v1StatusListener.ts` + tests; do not re-propose removal without new instruction.
- `deviceBuilder.ts:buildDevices()` (CLI-only) vs `deviceManagementService.ts:listDevices()` (plugin runtime) build similar `Device` shapes but scenes-source differs: CLI reads embedded `device.scenes`, service calls live `getScenes()` API — not safe to unify without dropping the live call or changing `buildDevices()`'s signature.
- `handleDeviceStatusSimpleUpdate` (`deviceStateHandler.ts`) had zero direct test coverage as of Jul 2026 audit — only `handleDeviceStatusUpdate` was tested; check before assuming refactors there are test-guarded.
- Shared state-update helper pattern (`applyResolvedStateUpdates`, `deviceStateHandler.ts:22-49`): extract identical Promise.all/snapshot/completion blocks into a private async helper taking `(robot, resolvedState, beforeSnapshot, log)` — both callers remain responsible for their own state resolution and return values (e.g., `handleDeviceStatusUpdate` computes `isActive` post-call).

## Test Patterns

- **handleActiveMapChanged Matter guard:** pass `matterSupportedAreas` as 3rd arg to `createMockRobot` — `getAttribute(ServiceArea.id,'supportedAreas')` must intersect service-cache areas or `updateAttribute(selectedAreas)` is skipped.
- **mapInfoListener V1 enrichment:** call `onMessage` twice (map-info msg then room-map msg) on same listener; `getAreasPassedToService()` asserts `locationName`/`mapId` from `pendingV1MapInfo`.
- **AreaManagementService live bootstrap:** `resolveInitialAreas` with `liveMapUpdates=true` still calls sync `getMapInfo`/`getRoomMap` (not V2); public `getMapInfo`/`getRoomMap` on live service use V2 only — assert sync mocks not called on public methods.
- **SkipArea progress helpers:** unit-test exported `markAreaSkipped`/`getNextPendingArea` in `serviceAreaHandler.test.ts`; multi-room no-info path keeps `selectedAreas`, sets `currentArea` to first — update `platformRunner.test.ts` if stale.
- **connectionService listener gating:** after `initializeMessageClientForLocal`, collect `registerMessageListener.mock.calls.map(([l]) => l.name)`; V1 → `V1StatusListener` not `B01StatusListener`; B01 → reverse; `DeviceStatusListener` always index 0.
- **estimatedEndTime handler tests:** all `RoborockMatterbridgePlatform` mocks need `configManager: createMockConfigManager(enabled)` — `shouldPublishEstimatedEndTime` reads `isEstimatedEndTimeEnabled` unconditionally; use `vi.useFakeTimers()` + `vi.setSystemTime` for handler ETA assertions (not the pure helper).
- **estimatedEndTime pure helper:** test `computeEstimatedEndTimeFromCleanProgress` with injected `nowEpochSeconds` — no fake timers; `cleanPercent=25,cleanTime=60` → `now+180`; `cleanPercent=100` → `now`.
- **CLI command tests (`src/tests/cli/`):** mock module boundaries (`connectDevice`, `waitForPush`, parser classes) via `vi.mock` with relative `.js` paths, static-import after the mocks. Class constructor mocks need a real `function` (not arrow) in `mockImplementation` or `new` throws.
- **AreaManagementService.resolveInitialAreas tests:** async method that calls `getMapInfo` then `getRoomMap` in sequence, catches errors without throwing, returns `{ supportedAreas, supportedMaps }` via `getSupportedAreas`/`getSupportedMaps`. Verify call order with `vi.mocked(mock).mock.invocationCallOrder`, error logging with `logger.error`.
- **RoborockVacuumCleaner constructor with resolved areas:** pass `resolvedAreas: ServiceArea.Area[]` and `resolvedMaps: ServiceArea.Map[]` to constructor (7th/8th params); `initializeDeviceConfiguration` static method merges them: resolved areas first, then routines appended; resolved maps first, routine map (mapId 999) appended if `showRoutinesAsRoom` enabled. Use `asPartial<AdvancedFeatureConfiguration>` + `asPartial<AdvancedFeatureSetting>` for config mocks (both required by type).
- **handleDeviceStatusSimpleUpdate tests:** extracted `applyResolvedStateUpdates` helper now shared between `handleDeviceStatusUpdate` and `handleDeviceStatusSimpleUpdate`. Mock `DockStationStatus` via `asPartial<DockStationStatus>` with all 6 status code properties (cleanFluidStatus, waterBoxFilterStatus, dustBagStatus, dirtyWaterBoxStatus, clearWaterBoxStatus, isUpdownWaterReady, plus hasError method). Test basic Idle/Cleaning paths, operationalError resolution (e.g., ChargingError → FailedToFindChargingDock), dss short-circuit, and operationCompletion emission timing.

## Common Pitfalls

<!-- Things to avoid — bugs found, anti-patterns, footguns -->

- `RoborockPluginPlatformConfig` is set via cast in `module.ts:31` — no runtime schema validation. New fields on the type must also be added to the schema with defaults.
- `buildBehaviorConfig(model, featureSet?, newFeatureSet?)` caches by model key only — acceptable (same model → same feature set), but include a feature hash in the key if per-feature caching is ever needed.
- `decodeFeatureSet` returns all-false on invalid `featureSet` (try/catch around `BigInt()`); Group D nibble extraction returns false on out-of-range/non-hex chars.
- `Device` (`roborockCommunication/models/device.ts`) has no `.rooms` — room data lives in `Device.mapInfos: MapEntry[]` (each entry has `.rooms: MapRoomDto[]`).
- `npm run format` covers `**/*.md` — it can reformat markdown emphasis (`*x*` → `_x_`) in unrelated dirty files. Diff-check after formatting and revert out-of-scope changes.
- `LegacyMapParser` V1 widths: position x/y are `Int32LE` 4 bytes apart (`+0`, `+4`); image `segmentCount` `UInt32LE` at `+0x08`, top/left/height/width `Int32LE` at `+0x0c/+0x10/+0x14/+0x18`. Wrong widths read silently — cross-check binary layouts against a second OSS parser.
- `src/roborockCommunication/map/v1/` (not `map/legacy/`) is the live import path for `mapParser.js`/`v1MapDecryptor.js` — pre-existing uncommitted rename (Jul 3, 2026); don't revert if dirty.
- Implementer must NOT run build/lint/test commands even if a task prompt asks — only compiler runs builds, and only on explicit user request.

- `platformRunner.ts:120` writes `robot.homeInFo.activeMapId = data.mapId` BEFORE calling `handleActiveMapChanged` — any guard added inside that handler (e.g. operational-state check) can't prevent `activeMapId` from desyncing from `selectedAreas`/`progress` when it trips; the same-map guard (`:119`) then swallows a later identical-mapId retry too.

## Module Notes

<!-- Notes about specific modules, non-obvious behaviors -->

- `roomNameNormalizer.ts` (b01): pure module, no imports. `normalizeB01RoomName(roomName, roomTypeId?, roomId?)` returns non-empty; callers may still chain `|| fallback`. `rr_other` (typeId 0) always resolves to `Room ${roomId}`.

## B01/Q7/Q10 current-room detection — reference research (external)

- No reference (python-roborock, ioBroker.roborock, roborock-gitlab) has a working current-room resolver for B01/Q7/Q10 — unsolved across the whole OSS ecosystem.
- python-roborock Q10 has `Q10TracePacket.robot_position` (protocol-302-style trace packet, `02 01` marker, `b01_q10_map_parser.py`) — live x/y from a different message than the room-list map; cached in `MapContentTrait.robot_position` but never joined to a room id.
- ioBroker.roborock `Q10MapCreator.ts` dock-anchor fallback (~70-79, 853-904) exists because the live map often omits the robot pose in the field — Q10 live position is unreliable in practice.
- roborock-gitlab `b01.proto` declares a richer `SCMap.RobotMap` (mapData, currentPose, roomMatrix, roomChain) than our `roborockProto.ts`; `MapContainerB01.getRobotPosition()` (:19-26) is a working `currentPose` reader — the empty `MapRendererB01.render()` stub is an unrelated class.
- `roborock-gitlab` (`@functor/roborock`) is reference-quality but NOT in `wiki/reference-workspaces.md` — flagged as a doc gap.
- No reference derives current-room from clean-record/history data — those carry only aggregate session totals, never per-room breakdowns.

## Open Questions

<!-- Unresolved questions for the team -->

- Does our TypeScript plugin call `APP_GET_INIT_STATUS`? If so, are `newFeatureInfo`/`newFeatureInfoStr`/`featureInfo` captured and stored?

## featureSet / newFeatureSet (python-roborock reference)

- Python ref: `feature_set`/`new_feature_set` (str) on `HomeDataDevice` (`containers.py:298-299`) from home data API; third source `feature_info` (int array) via `APP_GET_INIT_STATUS` RPC. All decoded by `DeviceFeatures.from_feature_flags()` (`device_features.py:560-640`).
- `featureSet` → 64-bit int (`new_feature_info`): lower and upper 32 bits gate different feature groups. `newFeatureSet` → hex string (`new_feature_info_str`): bits extracted by nibble index from the right.
- Our plugin: `featureSet`/`newFeatureSet` typed on `Device` (`models/device.ts:38-39`); capability gating was static model-string lookup only until `featureSetDecoder`.
- `NewFeatureStrBit` enum: 79 members, values 32–120 with gaps; `TIDYUP_ZONES = MECHANICAL_ARM_MODE = 89` (alias).
- `DeviceFeatures` dataclass: 7 source groups + 3 raw (`int`/`str`/`list[int]`) diagnostic fields.
- `featureSetDecoder.ts` (`src/share/`, first hex-parsing code in `src/`): `decodeFeatureSet` wraps `BigInt(featureSet)` in try/catch → private `buildAllFalse()` on failure; bit 89 intentionally decoded into both `is_mechanical_arm_mode_supported` and `is_tidyup_zones_supported`.
