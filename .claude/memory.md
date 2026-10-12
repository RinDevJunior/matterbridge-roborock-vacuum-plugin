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
- V1 `rr` block types beyond charger=1/image=2/robot=8/cleaned=11: `FORBIDDEN_ZONES=9`, `VIRTUAL_WALLS=10`, `NO_MOP_ZONE=12` (same `get_map_v1` buffer). Wall=2 endpoints/8B, zone (9,12)=4 corners/16B, count `u32` at block `+0x08`; units likely mm (medium confidence, no real capture). See `workspace/virtual-wall-detection-feasibility/answers-virtual-wall.md`.

## Known Patterns

<!-- Coding patterns established in this project -->

- **Commit messages:** `<type>(<optional scope>): <short summary>` + optional why-body. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`. Imperative mood; no `Co-Authored-By`.
- Per-device override pattern: array of objects with key (`serialNumber`) + value (`productName`), gated by a boolean in `advancedFeature.settings`. See `DeviceProductNameOverride` (`RoborockPluginPlatformConfig.ts:58`).
- New config sections in schema use JSON Schema `if/then` blocks under `advancedFeature.allOf`.
- **Agent frontmatter:** `effort`/`maxTurns` after `color`, before `tools`; `tools` MUST be a comma-separated string — YAML block lists silently fail and the subagent falls back to Read/Write/Edit/Bash only.
- **Subagent toolsets (macOS, Jul 10 2026):** native `Glob`/`Grep` absent from Task subagents — use `mcp__glob-grep__*`. `LSP` only reachable via deferred ToolSearch in wildcard-tools subagents — don't rely on it in agent definitions.
- **Subagent task tracking:** `TaskCreate`/`TaskUpdate`/`TodoWrite` never reach Task subagents (Jul 10 2026) — don't list in frontmatter; EM tracks steps in main session, subagents report plain text.

## Decisions Made

<!-- Architectural and design decisions with rationale -->

- `extra_time`→`estimatedEndTime` removed (Jul 2026); opt-in `enableEstimatedEndTime` (default off) + `clean_time`/`clean_percent` linear ETA in `src/share/estimatedEndTime.ts`. Sep 20: Q10 reads DP 87 (`b01StatusListener.ts` `tryHandleQ10Push`) so flag works for Q10; Q7 stays `null`.
- `progress` reset-on-new-clean (Jul 13, 2026): triggers are `selectAreas` and `handleServiceAreaUpdate`'s Idle branch (direct `[]` clear). NOT `RoborockService.startClean` — its `HandlerContext` never carries `robot`/`device`.
- Matterbridge 3.10.12 native skipArea (PR #643) forwards to the `skipArea` command handler BEFORE `assertSkipServiceArea`; plugin `RoborockServiceAreaServer.skipArea` must validate (#172 rule) first, then `super.skipArea`, then `finalizeSkipArea`.
- `RoboticVacuumCleanerOptions.progress` exists only on the options-object ctor (positional is deprecated); min Matterbridge = 3.10.12. npm `dev` build 20261002-6a30fb3 predates PR #643 (no skipArea/progress) — wait for npm 3.10.12.
- Dock→Matter mapping (Jul 2026): default bundle Items 1+2+3+4 in `DockStationStatus.ts` only; Item 3 vs 5 mutually exclusive (full dss vs dustBag-only); codes 32/33/35 as `DockErrorCode` enum; dss priority clearWater→dirty→dustBag→cleanFluid→filter→updown.
- `progress` reset (Jul 14, 2026), 3rd trigger: `handleServiceAreaUpdate` compares stored-vs-current "actively cleaning" classification (Docked/Stopped/Error = not cleaning), not raw `CLEANING_STATES` (false positives on `ReturningDock` detours). Flag lives in `AreaManagementService`.
- Vacuum→Matter mapping (Jul 2026): bundle ideas 2–6 in `VacuumStatus.ts`; export `VACUUM_ERROR_TO_MATTER`; unknown non-zero → `UnableToCompleteOperation`; add `VacuumErrorCode.AutoEmptyDockFanError=33`; 8 semantic refinements per spike answer.md.
- `dss` `isUpdownWaterReady` (bits 0-1) is unreliable on real hardware (dss=2729 → Error while idle, no other error): excluded from `hasError()`/`DSS_FIELD_PRIORITY` (Jul 22, 2026), still parsed. python-roborock parses nothing at bits 0-1 (`v1_containers.py:277-278` is `hatch_door_status`, bits 12-14).
- Q10 reconnect race fix (Sep 20, 2026): `AreaManagementService.pendingQ10RoomResolution` cache (30s TTL) filled on silent-failure branches of `resolveAreaFromCleaningInfo`; retried via `deviceConfigurator.ts` `registerAreasListener` callback → `PlatformRunner.updateRobotWithPayload` (single subscriber; see `workspace/q10-room-resolution-race-fix/plan.md`).
- Persist-cleaning-state (Oct 12, 2026, planned): `platform.cleaningRunStateStore` exists only when flag ON; after restart seed mirror flag true + `activeMapId`, confirm-or-discard on first update; validate by `mapId:areaId:roomId` fingerprint (areaIds positional). See `workspace/feature-persist-cleaning-state/plan.md`.

## Test Patterns

- **ConnectionService UDP tests (Oct 12, 2026):** `udpStub` (hoisted) needs `disconnect`; `disconnect.mockReset()` + `mockResolvedValue` in `beforeEach`. Sync-throw variant via `mockImplementationOnce`.
- **ModeResolver.resolveFallback category-aware tests:** import `vacuumOnlyModeConfigs`/`mopOnlyModeConfigs`/`vacuumAndMopModeConfigs` + `baseCleanModeConfigs`; Max/Balanced/Quiet with non-canonical water/route → same-category mode; test vacuum-off/mop-off, unknown suction → Default; exact-triple still wins.
- **handleErrorOccurred tests (9 branches):** includeVacuumErrorStatus off; vacuum error; Running+no-error; not-Running+no-vacuum+dock-disabled (clear, the bug fix); dock status error/no-error; dockErrorCode active/NoError; both-undefined. Use `buildOperationalError()`; mock `robot.getAttribute` for operationalState.
- **LegacyMapParser tests:** `buildWallBlock`/`buildZoneBlock` (8B/16B stride; truncated drops partial). Containment tier (Jul 28): containment beats closer centroid; 2+ or 0 matches → nearest-center; exact pixel wins; namedRooms lookup. Y-flip `pyRel = height - 1 - (pyAbs - top)`. Islands: 4-connectivity BFS, wall tol ±3px, per-island 30% heuristic.
- **V1 debounce tests (`setV1ResolvedSegment`/`getV1ResolvedSegment`, Aug 3, 2026):** 2 consecutive matches confirm; cover single→undefined, two same→published, outlier keeps published, outlier+two new→new, all-different→never, `clearAll()` resets pending+confirmed, per-duid isolation. TTL tests must call set twice.
- **B01StatusListener nested-DPS tests (Sep 20, 2026):** `extractQ10RoomId` malformed guards (non-object `common_request`, missing `clean_expand`, empty/non-array `room_id_list`) never throw → undefined. Sticky `lastRoomId` reused when absent. `onServiceAreaUpdate` gate: any of cleanArea/cleanTime/cleanTaskType/roomId/cleanProgress defined.
- **scripts/ tests (Oct 11, 2026):** run real `.mjs` via child process; PATH = fake `git`/`codegraph`/`npx` bin dir (+ `/bin/cat` symlink) for POSIX-only `describe.skipIf(win32)`. Pure helpers via `node --input-type=module -e` harness.
- **`*:ci` guard:** `ciScripts.test.ts` enforces single `node scripts/<x>.mjs` values; new `:ci` scripts must follow it.
- **Mocking `node:crypto.randomInt` (Oct 12, 2026):** `vi.mock('node:crypto', importOriginal => ({...actual, randomInt: vi.fn()}))`; set `mockImplementation` in `beforeEach` (not once at top). `MapInfo` names never undefined (`Default Map N`), so use `asPartial<MapInfo>` for the `?? 'Map <id>'` arm.
- **persistCleaningRunState tests (Oct 12, 2026):** SAVE only runs when `operationalState` attr is actively cleaning; CLEAR runs for Docked/Charging unless `message.state` is a cleaning state. Confirmed-restore with attr Docked + Cleaning msg → no clear, no save.

## Common Pitfalls

<!-- Things to avoid — bugs found, anti-patterns, footguns -->

- `classifyIslands` (`legacyIslandDetection.ts`) size heuristic (Jul 27, fixed): was gated map-wide via `hasNoWallOrZoneData`; now evaluated per-island as last-resort fallback.
- ESLint `preserve-caught-error` requires re-thrown errors to carry `{ cause: err }` — omitting it fails `lint:fix:ci` even when the message embeds the original error text.
- ESLint `no-base-to-string` prohibits stringifying `err.cause` directly in templates (`String(err.cause)`) — check `if (cause instanceof Error)` first, then safely access `.message`; this prevents accidental `[object Object]` in logs.
- Static `import` of `scripts/*.mjs` from `src/tests` breaks `type-check:ci` (checkJs TS7006 + tsconfig rootDir TS6059). Test scripts via child process instead.
- `handleCleaningWithoutInfo`'s `selectedAreas[0]` pin (`serviceAreaHandler.ts:311`) reuses last-known `currentArea` first (PR #150) — sole call site of that read; re-verified Aug 3 against real-S8 log (34/34). `AreaManagementService.lastKnownAreaCache` never existed in `src/` — don't rely on it.
- `resolveAreaFromCleaningInfo`'s falsy-zero check is fixed (`mappedArea === undefined`, `serviceAreaHandler.ts:405`) — confirmed correct Jul 25, no gap.
- `DockStationStatus.isUpdownWaterReady` (bits 0-1) is parsed but EXCLUDED from `hasError()`/`getMatterOperationalError()` (Jul 22, 2026): reads Error as steady idle state on real hardware, unlike the 5 other dss fields.
- `modeResolver.ts` `createDefaultModeResolver`/`createSmartModeResolver` OneTime branch (pre-fix Jul 22) always returned mode 11 regardless of `configs`; real `seq_type` reaches it on any non-B01 device. Fix: gate on `configs.some(mode===11)`, computed once per factory call.
- `errorStateHandler.ts` `handleErrorOccurred` (fixed Sep 13 2026): `!includeDockStationStatus` guard did bare `return;` without clearing `operationalError`, sticking a vacuum `errorStateId` forever. Fix: `buildOperationalError` helper clears before early return; `errorStateDetails` on all writes.
- B01/Q10 currentArea (Sep 20, 2026): `resolveAreaFromCleaningInfo`/`RoomIndexMap.getAreaId` (`serviceAreaHandler.ts:392-444`) has no V1-only gate; `B01StatusListener.tryHandleQ10Push` now fills `cleaningInfo.segment_id` from `common_request`(101)→`clean_expand`(91)→`room_id_list`. No handler changes.

## Tooling & Environment

<!-- npm/OS/shell footguns -->

- `*:ci` scripts must avoid raw POSIX shell syntax (`>/dev/null`, `;` chaining) — npm defaults to cmd.exe on Windows and it can't parse them; wrap in a node script instead (see `scripts/run-test-summary.mjs`).

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
