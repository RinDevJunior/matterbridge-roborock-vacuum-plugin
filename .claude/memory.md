# Project Shared Memory

Durable knowledge store. Read at session start **only** by: `technical-architect`, `investigator`, `implementer`, `reviewer`, `test-writer` (and `wiki-manager` as a gather-mode source). Other agents skip it.
It is version-controlled — commit and push changes so teammates can pull the latest knowledge.

**Pruning rules:** max 10 bullets per section, **max 2 lines per bullet**. When adding would exceed the cap, move the oldest/least-durable entry to `wiki/memory-archive.md` (never delete outright). `reviewer` enforces the caps whenever it appends. Compress wording — keep file paths and hard facts, drop rationale prose.

---

## Architecture Insights

<!-- Patterns and relationships discovered during analysis -->

- Room data (supportedAreas, roomIndexMap) is in-memory only inside `AreaManagementService` private Maps keyed by duid — no file/db persistence.
- Room name resolution (`getSupportedAreas.ts:109-113`): `iot_name` → lookup by `iot_name_id` → `Unknown Room ${randomInt(1000,9999)}`. B01 path normalizes firmware tokens via `normalizeB01RoomName()`; R2 deterministic fallback deferred.
- Q7 map fetch: `Q7MessageDispatcher.getRoomMap`/`getRoomMapV2` fire `service.upload_by_maptype` (`get_room_mapping`) with `{ force: 1, map_type: 0 }` — primary-only, no fallback retry; `activeMap` param retained but not sent.
- `AreaManagementService.clearAll()` wipes all in-memory area data including room names. Fallback room name suffix (`RANDOM_ROOM_MIN=1000`, `MAX=9999`) is non-deterministic — changes every startup.
- Startup room names: `getRoomMap` enriches raw tuples via `HomeModelMapper.enrichMapRoomDtoFromMapInfo(dto, mapInfoCache)` before `toRoomMapping`; `HomeEntity` uses `storedMapInfo` not `MapInfo.empty()`.
- `ModeUtils.assertModeChange` (matter.js mode-base) never checks operational state for Run/Clean Mode — only "is newMode supported"; mid-clean mode changes already work with zero guards anywhere in the chain.
- `ProgressStruct.estimatedTime` (ServiceArea) spec: set once at Progress-entry creation, unlike `estimatedEndTime` which re-publishes every tick. No per-room historical duration data exists (confirmed Jul 2026); only the active area can get a non-null estimate.
- Live map updates: `resolveInitialAreas` must sync-bootstrap via `fetchAndApplyMapInfo`/`fetchAndApplyRoomMap` (ignore V2); public `getMapInfo`/`getRoomMap` stay V2-only when `liveMapUpdates`. `handleActiveMapChanged` must intersect with Matter `supportedAreas` before writing `selectedAreas`.
- Multi-map areas: partial room-map fetch/push merges by `mapId` via `mergeSupportedAreasByMap` (keeps other maps, re-indexes areaIds); full `mapInfo.allRooms` / V1 map-info push stays full replace.
- Multi-map + `enableMultipleMap`: ON → bootstrap all physical maps via `switchMap`+sync fetch, merge by mapId; OFF → primary only (`maps[0]`) via `getSupportedAreas(..., false)` — wired from `configManager.isMultipleMapEnabled`.
- Q10 (`ss07`) map_response (DPS 301) carries two binary formats sharing one slot: `01 01` map packet (rooms+grid+header calibration: origin/resolution) and `02 01` trace packet (accumulated path, last point = live position). SCMap protobuf path fails on it (`incorrect header check`) — needs its own decoder. NOTE: `upstream/dev` independently landed a Q10 decoder inside `b01MapParser.ts`/`b01Q10MapParser.ts`/`b01Q10TraceParser.ts` (PRs #138/#139) — reconcile with the separate `map/b01/q10/` module built in this branch before merging.
- `B01StatusListener.tryHandleQ10Push` calls `onServiceAreaUpdate` with `cleaningInfo: undefined` on every clean_area/clean_time/clean_task_type tick → `handleCleaningWithoutInfo`'s coarse `selectedAreas[0]`/`null` currentArea fallback fires constantly for Q10, racing any precise room-resolution write; must guard by model short-code to disable it for Q10.

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
- `getSupportedAreas()` (`initialData/getSupportedAreas.ts`) is the single point enforcing "Areas non-null mapId ⇒ supportedMaps non-empty" (Matter `#assertSupportedAreas`). Two complementary fixes now both live here: `buildPlaceholderSupportedMaps` backfills `supportedMaps` from areas' distinct mapIds when still empty (safety net, `upstream/dev`); the Q10 path also pre-populates `pendingB01MapInfo` before `updateAreas(mergeMapId)` so it's rarely needed there (this branch).

## Test Patterns

- **connectionService listener gating:** after `initializeMessageClientForLocal`, collect `registerMessageListener.mock.calls.map(([l]) => l.name)`; V1 → `V1StatusListener` not `B01StatusListener`; B01 → reverse; `DeviceStatusListener` always index 0.
- **estimatedEndTime handler tests:** all platform mocks need `configManager: createMockConfigManager(enabled)`; use `vi.useFakeTimers()` + `vi.setSystemTime` for handler ETA assertions (not the pure helper).
- **estimatedEndTime pure helper:** test `computeEstimatedEndTimeFromCleanProgress` with injected `nowEpochSeconds` — no fake timers; `cleanPercent=25,cleanTime=60` → `now+180`; `cleanPercent=100` → `now`.
- **CLI command tests (`src/tests/cli/`):** mock module boundaries via `vi.mock` with relative `.js` paths, static-import after the mocks. Class constructor mocks need a real `function` (not arrow) in `mockImplementation` or `new` throws.
- **AreaManagementService.resolveInitialAreas tests:** calls `getMapInfo` then `getRoomMap`, catches errors without throwing. Verify call order with `mock.invocationCallOrder`, error logging with `logger.error`.
- **RoborockVacuumCleaner constructor:** pass `resolvedAreas`/`resolvedMaps` (7th/8th params); `initializeDeviceConfiguration` merges resolved first, routines appended (map 999 if `showRoutinesAsRoom`). Use `asPartial<...>` for both config mocks.
- **handleDeviceStatusSimpleUpdate tests:** shared `applyResolvedStateUpdates` helper; mock `DockStationStatus` via `asPartial` with all 6 status codes + `hasError`. Test Idle/Cleaning, operationalError resolution, dss short-circuit, completion timing.
- **buildProgressUpdate tests:** `estimatedTime` set only on newly-created active-area entry; existing entries never overwritten; status transitions preserve `estimatedTime`. Call with `(existing, selectedAreas, activeAreaId, estimatedTimeForActiveArea)`.
- **computeAreaEstimatedTime tests:** pure helper returning raw remaining seconds (no `now +`); `25%/60` → `180`; `100%` → `0`; bounds 5–100%; `cleanPercent=undefined` → `null`. Import from `src/share/estimatedEndTime.js`.
- **createDefaultRvcCleanModeClusterServer tests:** override declares `RvcCleanMode.Feature.DirectModeChange` via `.with(...)`; defaults `currentMode=1`, three modes (Vacuum/1, Mop/2, DeepClean/3); returns `this` for chaining.
- **ModeHandler tests (IdleModeHandler):** test `canHandle(mode, activity)` returns true only for target activity (Idle), false for others (Cleaning/Mapping/unknown). Integration: add tests to `behaviorConfig.test.ts` that call `registry.handle(duid, mode, activity, context)` and verify `roborockService` method + logger call; run on both DefaultBehavior and BehaviorSmart configs.
- **RoborockServiceAreaServer.selectAreas override tests:** spy on parent prototype's selectAreas via `vi.spyOn(Object.getPrototypeOf(Object.getPrototypeOf(server)), 'selectAreas')` and mock its response to avoid deep matterbridge machinery; verify override calls `device.resolveAllRoomsForActiveMap()` for empty input, `device.trySwitchMap(areas)` for non-empty input, forwards resolved/original request to super with correct arguments.

## Common Pitfalls

<!-- Things to avoid — bugs found, anti-patterns, footguns -->

- `buildBehaviorConfig(model, featureSet?, newFeatureSet?)` caches by model key only — acceptable (same model → same feature set); include a feature hash in the key if per-feature caching is ever needed.
- `decodeFeatureSet` returns all-false on invalid `featureSet` (try/catch around `BigInt()`); Group D nibble extraction returns false on out-of-range/non-hex chars.
- `Device` (`roborockCommunication/models/device.ts`) has no `.rooms` — room data lives in `Device.mapInfos: MapEntry[]` (each entry has `.rooms: MapRoomDto[]`).
- `npm run format` covers `**/*.md` — it can reformat markdown emphasis in unrelated dirty files. Diff-check after formatting and revert out-of-scope changes.
- `LegacyMapParser` V1 widths: position x/y are `Int32LE` 4 bytes apart (`+0`, `+4`); image `segmentCount` `UInt32LE` at `+0x08`, top/left/height/width `Int32LE` at `+0x0c..+0x18`. Cross-check binary layouts against a second OSS parser.
- `src/roborockCommunication/map/v1/` (not `map/legacy/`) is the live import path for `mapParser.js`/`v1MapDecryptor.js` — pre-existing uncommitted rename (Jul 3, 2026); don't revert if dirty.
- Implementer must NOT run full builds or the whole test suite — its gate is `format:ci` → `lint:fix:ci` → `type-check:ci` only; `build:local:ci`/`test:ci` belong to compiler/test-writer.
- `platformRunner.ts:120` writes `activeMapId` BEFORE `handleActiveMapChanged` — a guard inside the handler can't prevent `activeMapId` desync, and the same-map guard (`:119`) then swallows an identical-mapId retry.
- `SELECT_AREAS` empty-input path (`roborockVacuumCleaner.ts:164-176`) must NOT call `trySwitchMap` — keep empty vs explicit branches structurally separate with early `return`, else V10/V1 (`activeMapId=-1`) fires unguarded `switchMap` on every global-clean.
- ESLint `preserve-caught-error` requires re-thrown errors to carry `{ cause: err }` — omitting it fails `lint:fix:ci` even when the message embeds the original error text.
- Q10 map/trace calibration: two unit systems, don't conflate. Header `origin_x`/`origin_y` are 5mm units (÷10→px); trace point x/y are raw mm (÷50→px, NOT the raw header `resolution` field=5). x sign inverted, y not. Empirically verified 54/54 real points, not the Python reference's formula.

## Module Notes

<!-- Notes about specific modules, non-obvious behaviors -->

- `roomNameNormalizer.ts` (b01): pure module, no imports. `normalizeB01RoomName(roomName, roomTypeId?, roomId?)` returns non-empty; callers may still chain `|| fallback`. `rr_other` (typeId 0) always resolves to `Room ${roomId}`.

- Q10 map format: python-roborock's `lz4_block_decompress` (`b01_q10_map_parser.py:190-237`) is a hand-rolled zero-dep LZ4 _block_-format decoder, NOT a call into the Python `lz4` package — no size param, decodes until input exhausted.
- ioBroker's Q10 parser lives at `ioBroker.roborock/src/lib/map/q10/Q10YxMapParser.ts` (not `b01/`) — a structurally different "YxMap" format (28-byte header, version/pixLen/pixLzLen fields) vs python-roborock's `01 01`+offset-27/29 layout; only LZ4-block-format + big-endian u16 width/height are cross-corroborated.
- Q10 fix landed: `b01MapParser.ts.parseRoomsFromEncryptedBinary` routes `0x01 0x01`-prefixed payloads to `b01Q10MapParser.ts`/`lz4BlockDecompressor.ts` (hand-rolled, zero-dep); Q7 AES+zlib pipeline untouched. `0x02 0x01` trace packets route to `b01Q10TraceParser.ts` (`parseQ10TracePacket` → `B01MapInfo.currentPose` = last point; rooms/mapId/roomMatrix always empty/undefined). NOTE: that parser used a 10-byte trace header (per python-roborock, live-validated zero crashes on real Q10 S5+ across 8 invocations); this branch separately validated the real header is **14 bytes** (heading field at offset 10-11) against a live capture — recheck which is authoritative if trace parsing regresses.
- `0x02 0x01` trace packets parse into `B01MapInfo.currentPose` but nothing consumed it into `ServiceArea.currentArea` before this branch (`roomMatrixResolver.ts` stayed a no-op) — this branch adds the missing piece: `q10PositionToGridPixel`/`resolveRoomIdAtPoint` (`map/b01/q10/q10MapParser.ts`) + `handleQ10CurrentAreaChanged` wiring, live-validated end-to-end (currentArea updates with zero Matter validation errors during a real clean).

## Open Questions

<!-- Unresolved questions for the team -->

- Does our TypeScript plugin call `APP_GET_INIT_STATUS`? If so, are `newFeatureInfo`/`newFeatureInfoStr`/`featureInfo` captured and stored?
- `roomMatrix` (RobotMap field 13) confirmed undecoded in python-roborock/ioBroker.roborock/roborock-gitlab too — all define it, none decode it (room-pixel data comes from `roomChain`/occupancy grid instead). Still needs real Q10 packet capture.
- `OperationStatusCode` 104: confirmed absent from canonical status enum in all 3 reference repos (identical `103→202` gap everywhere). The only "104" found is an unrelated DP-id (`BREAKPOINT_CLEAN`), not a status value — coincidence, not the answer.
- **This branch (`feat/q10-current-area`) vs `upstream/dev` (PRs #138/#139) both independently built Q10 `01 01`/`02 01` binary parsing with different architectures and a differing trace-header length (14 vs 10 bytes) — needs reconciliation before/at merge. This branch's `ServiceArea.currentArea` wiring is the piece missing upstream.**

## Archive

Older entries and one-off research (B01/Q7/Q10 current-room detection, featureSet decoding reference) live in `wiki/memory-archive.md` — consult it when working on those areas.
