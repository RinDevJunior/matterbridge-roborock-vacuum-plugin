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
- Q7 map fetch: `Q7MessageDispatcher.getRoomMap`/`getRoomMapV2` fire `service.upload_by_maptype` (`get_room_mapping`) with `{ force: 1, map_type: 0 }` — primary-only, no fallback retry; `activeMap` param retained but not sent.
- `deviceCapabilityRegistry.ts` (clean-mode-only): `getExtraModes` returns `[]` without feature context, else `[vacFollowedByMopModeConfig]` if `is_clean_then_mop_mode_supported`; `hasSmartPlan` returns `features.is_smart_clean_mode_set_supported`; `getAllKnownModeConfigs` hardcodes `[vacFollowedByMopModeConfig, ...baseCleanModeConfigs]`.
- Feature-gated mode wiring: `deviceConfigurator.ts` → `behaviorFactory.ts` → `buildBehaviorConfig` → `getAllModesForDevice` thread `featureSet`/`newFeatureSet`; `roborockVacuumCleaner.ts` passes them to `getSupportedCleanModes`.
- `cleanModeHandler.ts:35` has only `DeviceSpecs` in scope (no featureSet) — out of scope for feature-gating. `matterStateNames.ts:6` calls `getAllKnownModeConfigs()` at module level (pure name lookup) — no change needed.
- SmartPlan (mode 4) gated by feature flag; VacAndMopDeep (mode 12) dropped — no feature flags found in DeviceFeatures. Decision: drop rather than gate by model string.
- `RoomMapping` stable key candidates: `id` (number), composite `${id}-${iot_map_id}` (string, matches `roomInfos` Map key), `iot_name_id` (string).
- `AreaManagementService.clearAll()` wipes all in-memory area data including room names. Fallback room name suffix (`RANDOM_ROOM_MIN=1000`, `MAX=9999`) is non-deterministic — changes every startup.

## Known Patterns

<!-- Coding patterns established in this project -->

- **Commit messages:** `<type>(<optional scope>): <short summary>` + optional why-body. Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`. Imperative mood; no `Co-Authored-By`.
- Per-device override pattern: array of objects with key (`serialNumber`) + value (`productName`), gated by a boolean in `advancedFeature.settings`. See `DeviceProductNameOverride` (`RoborockPluginPlatformConfig.ts:58`).
- New config sections in schema use JSON Schema `if/then` blocks under `advancedFeature.allOf`.
- **Agent frontmatter:** `effort`/`maxTurns` go after `color`, before `tools`; `AskUserQuestion` is always the last tools entry. Only `technical-architect`, `implementer`, `test-writer`, `release-manager` keep `TaskCreate`/`TaskUpdate` — leaf agents dropped them (token savings).

## Decisions Made

<!-- Architectural and design decisions with rationale -->

- `featureSetDecoder.ts` placed in `src/share/` (pure utility, no DI, no side effects) — not `roborockCommunication/helper/`.
- `DeviceFeatures` interface: 7 source groups (A–G) + 3 raw fields; Groups E/F/G always decode `false` (require data sources unavailable in its signature).
- `newFeatureInfo` raw diagnostic field typed `bigint` (64-bit value exceeds Number.MAX_SAFE_INTEGER).
- `extractNibbleBit(hexStr, bitIndex)`: nibblePos = floor(bitIndex/4), bitPos = bitIndex%4, char at `hexStr[length-1-nibblePos]`; module-private.
- Group C masks `2147483648` (2^31) and `1073741824` (2^30) use `!== 0` comparison (JS signed-32-bit bitwise behavior).
- Legacy V1 map room names: not in `"rr"` binary — from `get_multi_maps_list` (`rooms[].iot_name`) filtered by active `mapFlag` (`map_status >> 2`); helpers in `src/cli/mapListHelpers.ts`. Active map unknown (sentinel 63) → `(unnamed)`, never flatten all maps (room ID collision).
- B01 `currentPose`/`roomMatrix` (Q10): Protocol 301 carries the whole payload as one opaque buffer (`messageDeserializer.ts:120-128`) — no new Protocol enum/listener; fields are siblings of `roomDataInfo` in `SCMap.RobotMap` already reaching `tryParseB01MapBinary()`. Extend `roborockProto.ts`/`b01MapParser.ts`/`types.ts` only.
- `roomMatrix` pixel decode deliberately unimplemented (`resolveRoomFromPose()` → `undefined`): no OSS reference decodes it, and a wrong guess would silently corrupt `currentArea`. Skeleton shipped; algorithm deferred until real Q10 capture.
- Two-phase pattern for unverifiable device-protocol features: Phase 1 = standalone CLI command (`connectDevice()` + `waitForPush()` skeleton) for real-hardware verification; Phase 2 wires the shared dependency-free pure module into production.
- Pose (`MapInfoListener`) and status (`B01StatusListener`) are decoupled — join via cache-write/read pair on `AreaManagementService` (per-duid `Map` + `setX`/`getX`, like `supportedAreaIndexMaps`), NOT a new `ServiceAreaUpdateMessage` field.

## Test Patterns

- **B01 message bodies:** Q10 — `new Map(Object.entries(body).map(([k, v]) => [Number(k), v]))`, keys are `Q10RequestCode` values (120–138); Q7 — `new Map([[Q7RequestCode.query_response, JSON.stringify({ method, data })]])`, key 10001.
- **Private members:** `(obj as unknown as { m: (a) => R }).m(...)` — avoids `as any`; spy private fields via `vi.spyOn` on the cast. `MapInfoListener` has no `configure` — pass deviceModel/serial/onActiveMapChanged/deviceProtocol as ctor params 5–8 (V1 test: `ProtocolVersion.V1` as 8th).
- **`decryptIfNeeded`:** encrypt with `setAutoPadding(true)` → 32 bytes (16 data + 16 pad). `parseRoomsFromEncryptedBinary` round-trip: compressed length must NOT be a multiple of 16 to skip decryption (pad a spare byte).
- **AreaManagementService liveMapUpdates:** third ctor arg enables live mode; `getMapInfoV2`/`getRoomMapV2` must be added directly to the mock (not in the initial mock object).
- **LegacyMapParser fixtures:** programmatic builders in `src/tests/exampleData/legacyMapFixture.ts`. Test ROBOT_POSITION and CHARGER_LOCATION both (shared `parsePositionBlock`); cover obstacle pixels explicitly (byte bits 2:0 = type, 7:3 = segment ID) — they're a separate output array.
- **Byte-offset/width regressions:** assert `image.dimensions`/`image.position` directly with distinct non-square values and x/y beyond 16-bit range (e.g. 70000/80000) — derived-count assertions stay green while header fields are silently wrong.
- **V1 inner decryption:** protocol 301 push = 24-byte envelope + AES-128-CBC(`serializeNonce`, IV=zeros) + gzip(`"rr"`). `decryptAndUnzipV1Map` in `v1MapDecryptor.ts`; `buildEncryptedV1MapPayload` for round-trips; `LegacyMapParser` tests use plain `"rr"` binary.
- **`mapListHelpers` (CLI):** pure functions, no mocks. `resolveActiveMapId` sentinel is `63` (`map_status: 252`); `extractNamedRooms` returns `[]` when `activeMapId` is undefined. Tests: `src/tests/cli/mapListHelpers.test.ts`.
- **proto3 scalars:** omitted non-message fields decode to `0`, not `undefined` (no wire-level presence tracking) — only message-typed fields can be genuinely absent.
- **CLI command tests (`src/tests/cli/`):** mock module boundaries (`connectDevice`, `waitForPush`, parser classes) via `vi.mock` with relative `.js` paths, static-import after the mocks. Class constructor mocks need a real `function` (not arrow) in `mockImplementation` or `new` throws.

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
