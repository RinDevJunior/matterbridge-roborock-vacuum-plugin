# Project Shared Memory

Durable knowledge store. Read at session start **only** by: `technical-architect`, `investigator`, `implementer`, `reviewer`, `test-writer` (and `wiki-manager` as a gather-mode source). Other agents skip it.
It is version-controlled — commit and push changes so teammates can pull the latest knowledge.

**Pruning rules:** max 10 bullets per section, **max 2 lines per bullet**. When adding would exceed the cap, move the oldest/least-durable entry to `wiki/memory-archive.md` (never delete outright). `reviewer` enforces the caps whenever it appends. Compress wording — keep file paths and hard facts, drop rationale prose.

---

## Architecture Insights

<!-- Patterns and relationships discovered during analysis -->

- V1 room-detection flip-flop (Aug 3, 2026): `MapInfoListener.tryParseV1MapBinary` (`mapInfoListener.ts:211-238`) published a room per V1 map push with no smoothing; hub rooms flip `findNearestSegment`. Fix: 2-consecutive-match gate in `setV1ResolvedSegment`; see `workspace/room-detection-flip-flop-investigation/plan.md`.
- Live map updates: `resolveInitialAreas` must sync-bootstrap via `fetchAndApplyMapInfo`/`fetchAndApplyRoomMap` (ignore V2); public `getMapInfo`/`getRoomMap` stay V2-only when `liveMapUpdates`. `handleActiveMapChanged` must intersect with Matter `supportedAreas` before writing `selectedAreas`.
- Multi-map areas: partial room-map fetch/push merges by `mapId` via `mergeSupportedAreasByMap` (keeps other maps, re-indexes areaIds); full `mapInfo.allRooms` / V1 map-info push stays full replace.
- Multi-map + `enableMultipleMap`: ON → bootstrap all physical maps via `switchMap`+sync fetch, merge by mapId; OFF → primary only (`maps[0]`) via `getSupportedAreas(..., false)` — wired from `configManager.isMultipleMapEnabled`.
- No code path calls V1 `dispatcher.getHomeMap` (`get_map_v1`) on a recurring basis — `PollingService` only calls `getDeviceStatus`; `AreaManagementService.startPeriodicRefresh` only calls `getMapInfo` (`get_multi_maps_list`). A V1 position-based fallback needs its own explicit trigger.
- `tryParseB01MapBinary` skips `Protocol.map_response` for V1 (`mapInfoListener.ts:165`); separate `tryParseV1MapBinary` (`:211-238`) handles V1 binaries via `decryptAndUnzipV1Map`→`resolveCurrentRoom`→`onV1RoomResolved` (confirmed in real S8 logs, Jul 25).
- `WashingTheMop`(23) override (`stateResolver.ts:128-139`) writes `operationalState=FillingWaterTank` ~2-3min at clean-start before `Running` (Apple Home likely shows "Preparing", unconfirmed); Run/Clean mode clusters update independently.
- V1 `resolveCurrentRoom` (`mapParser.ts`): exact-pixel tier misses wall/obstacle pixels at room boundaries. Tiers: exact → `findContainingSegment` (bbox, single match only, Jul 28; `LegacySegmentInfo.boundingBox`) → nearest-centroid. No shared point-in-rect helper.
- Reachability (opt-in `enableReachability`, Oct 18 2026): `ReachabilityMonitor` (`platform/reachabilityMonitor.ts`) fed by `setDeviceNotify` markAlive (non-HomeData) + HomeData `online:true`; down waits `reachabilityDelaySeconds` (min 120, default 600) via `watchdog` sweep; `RoborockVacuumCleaner.setReachable` picks BasicInformation (server) vs BridgedDeviceBasicInformation (matter) mode.
- V1 `rr` block types beyond charger=1/image=2/robot=8/cleaned=11: `FORBIDDEN_ZONES=9`, `VIRTUAL_WALLS=10`, `NO_MOP_ZONE=12` (same `get_map_v1` buffer). Wall=2 endpoints/8B, zone (9,12)=4 corners/16B, count `u32` at block `+0x08`; units likely mm (medium confidence, no real capture). See `workspace/virtual-wall-detection-feasibility/answers-virtual-wall.md`.

## Known Patterns

<!-- Coding patterns established in this project -->

- **Commit messages:** `<type>(<optional scope>): <short summary>` + optional why-body. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`. Imperative mood; no `Co-Authored-By`.
- Per-device override pattern: array of objects with key (`serialNumber`) + value (`productName`), gated by a boolean in `advancedFeature.settings`. See `DeviceProductNameOverride` (`RoborockPluginPlatformConfig.ts:58`).
- New config sections in schema use JSON Schema `if/then` blocks under `advancedFeature.allOf`.
- **Agent frontmatter:** `effort`/`maxTurns` after `color`, before `tools`; `tools` MUST be a comma-separated string — YAML block lists silently fail and the subagent falls back to Read/Write/Edit/Bash only.
- **Subagent toolsets (macOS, Jul 10 2026):** native `Glob`/`Grep` absent from Task subagents — use `mcp__glob-grep__*`. `LSP` only reachable via deferred ToolSearch in wildcard-tools subagents — don't rely on it in agent definitions.
- **Mode enum name lookup (Oct 18, 2026):** `cleanModeUtils.ts` resolves `MopWaterFlow[str]`/`MopRoute[str]` by member NAME, so new members (Min/Max/Extreme/SmartWater/DeepPlusCn) now accept those config strings instead of falling back.
- **format:ci rewrites files:** it reflows edited code (e.g. `(x) =>` arrows, wrapped args); re-Read the file before any further edit.
- **Subagent task tracking:** `TaskCreate`/`TaskUpdate`/`TodoWrite` never reach Task subagents (Jul 10 2026) — don't list in frontmatter; EM tracks steps in main session, subagents report plain text.

## Decisions Made

<!-- Architectural and design decisions with rationale -->

- `extra_time`→`estimatedEndTime` removed (Jul 2026); opt-in `enableEstimatedEndTime` (default off) + `clean_time`/`clean_percent` linear ETA in `src/share/estimatedEndTime.ts`. Sep 20: Q10 reads DP 87 (`b01StatusListener.ts` `tryHandleQ10Push`) so flag works for Q10; Q7 stays `null`.
- Matterbridge 3.10.12 native skipArea (PR #643) forwards to the `skipArea` command handler BEFORE `assertSkipServiceArea`; plugin `RoborockServiceAreaServer.skipArea` must validate (#172 rule) first, then `super.skipArea`, then `finalizeSkipArea`.
- `RoboticVacuumCleanerOptions.progress` exists only on the options-object ctor (positional is deprecated); min Matterbridge = 3.10.14. npm `dev` build 20261002-6a30fb3 predates PR #643 (no skipArea/progress) — wait for npm 3.10.12.
- `dss` `isUpdownWaterReady` (bits 0-1) is unreliable on real hardware (dss=2729 → Error while idle, no other error): excluded from `hasError()`/`DSS_FIELD_PRIORITY` (Jul 22, 2026), still parsed. python-roborock parses nothing at bits 0-1 (`v1_containers.py:277-278` is `hatch_door_status`, bits 12-14).
- Q10 reconnect race fix (Sep 20, 2026): `AreaManagementService.pendingQ10RoomResolution` cache (30s TTL) filled on silent-failure branches of `resolveAreaFromCleaningInfo`; retried via `deviceConfigurator.ts` `registerAreasListener` callback → `PlatformRunner.updateRobotWithPayload` (single subscriber; see `workspace/q10-room-resolution-race-fix/plan.md`).
- Persist-cleaning-state (Oct 12, 2026, planned): `platform.cleaningRunStateStore` exists only when flag ON; after restart seed mirror flag true + `activeMapId`, confirm-or-discard on first update; validate by `mapId:areaId:roomId` fingerprint (areaIds positional). See `workspace/feature-persist-cleaning-state/plan.md`.

- Filter monitoring (Sep 23, 2026 plan): `matterbridge@^3.10.9` already has built-in `MatterbridgeEndpoint.createDefaultHepaFilterMonitoringClusterServer()` (`@matterbridge/core` `matterbridgeEndpoint.js:1270`) — call directly, no `addClusterServer(HepaFilterMonitoringServer.with(...))` needed. Reset hook is `addCommandHandler('HepaFilterMonitoring.resetCondition', ...)` (distinct key from bare `'resetCondition'`), same `configureHandler` pipeline as IDENTIFY/PAUSE/etc.
- Filter monitoring config flag (Sep 25, 2026 addendum): opt-in `advancedFeature.settings.enableFilterMonitoring` (default `false`) gates cluster creation + reset-command + consumable polling. Gates at: `roborockVacuumCleaner` line 280 (AND with `isV1Device`), stored as `private readonly supportsFilterMonitoring` field, reset handler at line 226, consumable polling in `roborockService.activateDeviceNotify`. Follows exact pattern of `enableLiveMapUpdates`/`enableEstimatedEndTime`.
- Consumable/filter-life DPs exist in the wire protocol but are unread: V1 `Protocol.ts` has `main_brush_work_time=125`/`side_brush_work_time=126`/`filter_work_time=127`; Q10 `Q10RequestCode.ts` mirrors them (125-127) + `reset_filter=22` etc — `b01StatusListener.ts`/`V10MessageDispatcher.ts` never read/request them. Rated-life constants (main brush 300h, side 200h, filter 150h, sensor 30h) confirmed by 2 independent reference repos (python-roborock `const.py`, ioBroker `V1ConsumableService.ts`). Q10's DP unit (percent vs elapsed-seconds) is only medium-confidence — no real capture disambiguates.
- Q7 has zero brush/filter/consumable data source at any layer (`Q7RequestCode.ts` string-prop system, no numeric DPS keyspace) — permanent exclusion for any consumable-monitoring feature, not a gap to fill later.

## Test Patterns

- **selectAreas/skipArea progress (Oct 16, 2026):** writes go via `this.state.progress`/`currentArea` (no `updateAttribute`); assert `updateAttribute` calls filtered by attr name, read state via `server['state']`.
- **Enum name-lookup tests (Oct 18, 2026):** `MopWaterFlow[name]`/`MopRoute[name]` reverse lookup covered in `enums/enums.test.ts`; config-name cases in `cleanModeUtils.test.ts` "name lookup" block.
- **LZ4/getSupportedAreas regression (Oct 18, 2026):** truncated LZ4 cases go in `it.each` (`[0xf0]`, `[0x1f,0x41,0x01,0x00]`); nameless-room cases use `result.roomIndexMap.areaInfo.get(i)`.
- **Water-slide codes (Oct 18, 2026):** `waterSlide.ts` normalizes 221-250 by position; 225/235/245 map to 201-203 in `ModeResolver.resolve` before lookup. Raw setting still goes to `customCheckFn`.
- **`it.each` typing for CleanModeLabelInfo:** it's keyed by `CleanModeLabel`, not `CleanModeDisplayLabel`. Pass `.mode` numbers in the tuple (`it.each<[number, number]>`).
- **Run-start grace tests (Oct 18, 2026):** `vi.useFakeTimers()`+`setSystemTime` in describe `beforeEach`; set `robot.runStartSeededAtMs` directly on `createMockRobot`. Boundary: 29 999 kept, 30 000 cleared.
- **Mocking `node:crypto.randomInt` (Oct 12, 2026):** `vi.mock('node:crypto', importOriginal => ({...actual, randomInt: vi.fn()}))`; set `mockImplementation` in `beforeEach` (not once at top). `MapInfo` names never undefined (`Default Map N`), so use `asPartial<MapInfo>` for the `?? 'Map <id>'` arm.
- **Command-handler wrapper tests (Oct 18, 2026):** `vi.spyOn(vacuum,'addCommandHandler')` pre-configureHandler, then invoke `mock.calls` handler with `asType<CommandHandlerPayload>`; `describeCommandSender` returns exact strings (no regex on PASE parens).
- **selectAreas same-list no-op tests (Oct 18, 2026):** `spyOnParentSelectAreas(server)` helper; `it.each` objects with `$label`. Mocked super never writes, so no-op guards also need `setProgress`/`trySwitchMap` not-called asserts.
- **persistCleaningRunState tests (Oct 12, 2026):** SAVE only runs when `operationalState` attr is actively cleaning; CLEAR runs for Docked/Charging unless `message.state` is a cleaning state. Confirmed-restore with attr Docked + Cleaning msg → no clear, no save.

## Common Pitfalls

<!-- Things to avoid — bugs found, anti-patterns, footguns -->

- Valley flag (Oct 18): `decodeFeatureSet` sets `is_supported_valley_electricity` for BOTH a187 and a306 strings — use featureSet `'0'` for the "no valley" case.
- ESLint `preserve-caught-error` requires re-thrown errors to carry `{ cause: err }` — omitting it fails `lint:fix:ci` even when the message embeds the original error text.
- ESLint `no-base-to-string` prohibits stringifying `err.cause` directly in templates (`String(err.cause)`) — check `if (cause instanceof Error)` first, then safely access `.message`; this prevents accidental `[object Object]` in logs.
- Static `import` of `scripts/*.mjs` from `src/tests` breaks `type-check:ci` (checkJs TS7006 + tsconfig rootDir TS6059). Test scripts via child process instead.
- `handleCleaningWithoutInfo`'s `selectedAreas[0]` pin (`serviceAreaHandler.ts:311`) reuses last-known `currentArea` first (PR #150) — sole call site of that read; re-verified Aug 3 against real-S8 log (34/34). `AreaManagementService.lastKnownAreaCache` never existed in `src/` — don't rely on it.
- `resolveAreaFromCleaningInfo`'s falsy-zero check is fixed (`mappedArea === undefined`, `serviceAreaHandler.ts:405`) — confirmed correct Jul 25, no gap.
- `modeResolver.ts` `createDefaultModeResolver`/`createSmartModeResolver` OneTime branch (pre-fix Jul 22) always returned mode 11 regardless of `configs`; real `seq_type` reaches it on any non-B01 device. Fix: gate on `configs.some(mode===11)`, computed once per factory call.
- `errorStateHandler.ts` `handleErrorOccurred` (fixed Sep 13 2026): `!includeDockStationStatus` guard did bare `return;` without clearing `operationalError`, sticking a vacuum `errorStateId` forever. Fix: `buildOperationalError` helper clears before early return; `errorStateDetails` on all writes.
- B01/Q10 currentArea (Sep 20, 2026): `resolveAreaFromCleaningInfo`/`RoomIndexMap.getAreaId` (`serviceAreaHandler.ts:392-444`) has no V1-only gate; `B01StatusListener.tryHandleQ10Push` now fills `cleaningInfo.segment_id` from `common_request`(101)→`clean_expand`(91)→`room_id_list`. No handler changes.

## Tooling & Environment

<!-- npm/OS/shell footguns -->

- `*:ci` scripts must avoid raw POSIX shell syntax (`>/dev/null`, `;` chaining) — npm defaults to cmd.exe on Windows and it can't parse them; wrap in a node script instead (see `scripts/run-test-summary.mjs`).
- `release-comment.mjs` `isReleasePr` skips `release/*` heads, dev→main PRs and version-only titles (#164 false positive fixed). Workflow `if:` must check `github.event_name` — `null == false` is true on dispatch.

## Module Notes

<!-- Notes about specific modules, non-obvious behaviors -->

- `roomNameNormalizer.ts` (b01): pure module, no imports. `normalizeB01RoomName(roomName, roomTypeId?, roomId?)` returns non-empty; callers may still chain `|| fallback`. `rr_other` (typeId 0) always resolves to `Room ${roomId}`.
- Q10 map format: python-roborock's `lz4_block_decompress` (`b01_q10_map_parser.py:190-237`) is a hand-rolled zero-dep LZ4 _block_-format decoder, NOT a call into the Python `lz4` package — no size param, decodes until input exhausted.
- ioBroker's Q10 parser lives at `ioBroker.roborock/src/lib/map/q10/Q10YxMapParser.ts` (not `b01/`) — a structurally different "YxMap" format (28-byte header, version/pixLen/pixLzLen fields) vs python-roborock's `01 01`+offset-27/29 layout; only LZ4-block-format + big-endian u16 width/height are cross-corroborated.
- Q10 fix: `b01MapParser.ts.parseRoomsFromEncryptedBinary` routes `0x01 0x01` payloads to `b01Q10MapParser.ts`/`lz4BlockDecompressor.ts` (zero-dep); Q7 AES+zlib untouched. `0x02 0x01` trace packets → `b01Q10TraceParser.ts` (`parseQ10TracePacket` → `B01MapInfo.currentPose` = last point; rooms/mapId/roomMatrix empty).
- `0x02 0x01` = python-roborock `Q10TracePacket` (10B header + i16be x/y pairs, position = last point); not in ioBroker. Real Q10 S5+: 598B active vs 7076B full map; live-validated. `mapInfoListener.ts`/`roomMatrixResolver.ts` needed no changes; area wiring out of scope.

## Open Questions

<!-- Unresolved questions for the team -->

- Does our TypeScript plugin call `APP_GET_INIT_STATUS`? If so, are `newFeatureInfo`/`newFeatureInfoStr`/`featureInfo` captured and stored?
- `roomMatrix` (RobotMap field 13) confirmed undecoded in python-roborock/ioBroker.roborock/roborock-gitlab too — all define it, none decode it (room-pixel data comes from `roomChain`/occupancy grid instead). Still needs real Q10 packet capture.
- `OperationStatusCode` 104: confirmed absent from canonical status enum in all 3 reference repos (identical `103→202` gap everywhere). The only "104" found is an unrelated DP-id (`BREAKPOINT_CLEAN`), not a status value — coincidence, not the answer.

## Archive

Older entries and one-off research (B01/Q7/Q10 current-room detection, featureSet decoding reference) live in `wiki/memory-archive.md` — consult it when working on those areas.
