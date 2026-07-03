# Project Shared Memory

This file is read by all agents at the start of each session and updated when new knowledge is discovered.
It is version-controlled — commit and push changes so teammates can pull the latest knowledge.

**Pruning rule:** Each section is capped at 10 bullet points. When adding a new entry that would exceed the cap, remove the oldest entry in that section first.

---

## Architecture Insights

<!-- Patterns and relationships discovered during analysis -->

- Room data (supportedAreas, roomIndexMap) is in-memory only inside `AreaManagementService` private Maps keyed by duid — no file/db persistence.
- `getSupportedAreas` is called from 3 sites: `areaManagementService.getMapInfo`, `areaManagementService.getRoomMap`, `mapInfoListener.updateAreas`.
- Room name resolution in `processValidData` (getSupportedAreas.ts:109-113): priority is `iot_name` → secondary lookup by `iot_name_id` → `Unknown Room ${randomInt(1000,9999)}`. B01 map path now normalizes firmware tokens in `MapInfoListener.tryParseB01MapBinary()` via `normalizeB01RoomName()` before `iot_name` is set; R2 deterministic fallback still deferred.
- Q7 map fetch: `Q7MessageDispatcher.getRoomMap`/`getRoomMapV2` fire `service.upload_by_maptype` (`Q7RequestMethod.get_room_mapping`) with `{ force: 1, map_type: 0 }` — primary-only, no fallback retry; `activeMap` param retained but not sent.
- `deviceCapabilityRegistry.ts` is a clean-mode-only registry. After DEVICE_EXTRA_MODES removal: `getExtraModes(_model, featureSet?, newFeatureSet?)` returns `[]` when no feature context, else `[vacFollowedByMopModeConfig]` only if `is_clean_then_mop_mode_supported`. `hasSmartPlan(_model, featureSet?, newFeatureSet?)` now decodes feature flags and returns `features.is_smart_clean_mode_set_supported`. `getAllKnownModeConfigs` hardcodes `[vacFollowedByMopModeConfig, ...baseCleanModeConfigs]`. SmartPlan (mode 4) is now gated by feature flag; VacAndMopDeep (mode 12) remains dropped until feature flags are identified.
- Feature-gated mode wiring: `deviceConfigurator.ts` passes `vacuum.featureSet, vacuum.newFeatureSet` to `configureBehavior`; `behaviorFactory.ts` threads them to `buildBehaviorConfig`; `buildBehaviorConfig` threads to `getAllModesForDevice`. Similarly, `roborockVacuumCleaner.ts` passes `device.featureSet, device.newFeatureSet` to `getSupportedCleanModes`. Both Device instances reach registry functions with feature context for dynamic filtering.
- `cleanModeHandler.ts:35` has only `DeviceSpecs` in scope (no Device, no featureSet) — out of scope for this wiring phase. `matterStateNames.ts:6` calls `getAllKnownModeConfigs()` at module level (pure name lookup, not gating) — no change needed.
- SmartPlan (mode 4) and VacAndMopDeep (mode 12) are intentionally dropped — no feature flags found in DeviceFeatures for them. Decision: drop rather than gate by model string, pending discovery of real flags.

## Known Patterns

<!-- Coding patterns established in this project -->

- **Commit messages:** `<type>(<optional scope>): <short summary>` + optional body (blank line, then 1–2 sentences on **why**). Types: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`, `style`, `perf`. Imperative mood; no `Co-Authored-By`.
- Per-device override pattern: array of objects with a key field (`serialNumber`) + value field (`productName`), gated by a boolean flag in `advancedFeature.settings`. See `DeviceProductNameOverride` in `RoborockPluginPlatformConfig.ts:58`.
- New config sections in schema use JSON Schema `if/then` blocks under `advancedFeature.allOf` to conditionally expose sub-fields.
- **Agent frontmatter:** `effort` and `maxTurns` go after `color`, before `tools`. `AskUserQuestion` is always appended as the last item in the tools list — never inserted mid-list. `release-manager` uses `TaskCreate`/`TaskUpdate`/`AskUserQuestion` (added in this upgrade).

## Decisions Made

<!-- Architectural and design decisions with rationale -->

- `featureSetDecoder.ts` placed in `src/share/` (pure utility, no DI, no side effects) — not in `roborockCommunication/helper/` which is scoped to communication internals.
- `DeviceFeatures` interface includes all 7 source groups (A–G) + 3 raw fields; Groups E/F/G always decode to `false` in `decodeFeatureSet` (require other data sources not available in its signature).
- `newFeatureInfo` raw diagnostic field typed as `bigint` (featureSet is a 64-bit integer exceeding Number.MAX_SAFE_INTEGER).
- `extractNibbleBit(hexStr, bitIndex)` helper: nibblePos = Math.floor(bitIndex/4), bitPos = bitIndex%4, char from hexStr[length-1-nibblePos]; module-private (not exported).
- Group C mask `2147483648` (2^31) and `1073741824` (2^30) use `!== 0` comparison to handle JS signed-32-bit bitwise operator behavior.
- Legacy V1 map room names: not in `"rr"` binary — sourced from `get_multi_maps_list` (`rooms[].iot_name`), filtered by active `mapFlag` (`map_status >> 2`). `LegacyMapParser.resolveCurrentRoom` already accepts `LegacyNamedRoom[]`; CLI helpers in `src/cli/mapListHelpers.ts` (shared with `map-info`). When active map unknown (sentinel 63), show `(unnamed)` — do not flatten all maps (room ID collision).
- B01 `currentPose`/`roomMatrix` decode (Q10-only): `Protocol.map_response` (301) is confirmed (via `messageDeserializer.ts:120-128`) to carry the ENTIRE raw payload as one opaque buffer with zero transport-level marker-byte routing — no new `Protocol` enum entry or listener registration needed; `currentPose`/`roomMatrix` are sibling fields of `roomDataInfo` in the same `SCMap.RobotMap` protobuf message already flowing to `MapInfoListener.tryParseB01MapBinary()`. Extend `roborockProto.ts`/`b01MapParser.ts`/`types.ts` only.
- `roomMatrix` pixel-to-room decoding is deliberately left unimplemented (`resolveRoomFromPose()` always returns `undefined`): no reference implementation (python-roborock, ioBroker.roborock, roborock-gitlab) decodes this raw-bytes field either, so its wire encoding is a genuine unknown, not just undocumented. A wrong guess would silently corrupt `currentArea` — worse than the existing safe fallback. Ship the decode/resolver skeleton now; defer the actual algorithm until real Q10 device data is captured via a CLI verification tool.
- Two-phase delivery pattern for risky/unverifiable device-protocol features: Phase 1 ships a standalone CLI command (follows `legacy-map-info`'s `connectDevice()`+`waitForPush()` skeleton) with zero production-path coupling, for manual real-hardware verification; Phase 2 wires the same shared, pure decode/resolve function into production only after Phase 1 data confirms correctness. Shared logic must be a dependency-free pure module (no CLI/service imports) importable unchanged from both call sites.
- Pose data (arrives via async map-binary push, `MapInfoListener`) and status data (arrives via async status push, `B01StatusListener`) are structurally decoupled listener classes with no direct coupling — the correct integration pattern for joining them is a cache-write/cache-read pair on `AreaManagementService` (per-duid `Map<string, T>` + `setX`/`getX`, mirroring the existing `supportedAreaIndexMaps` pattern), NOT a new field threaded through `ServiceAreaUpdateMessage`.

## Test Patterns

- **B01 Q10 messages:** Use `new Map(Object.entries(body).map(([k, v]) => [Number(k), v]))` for body construction; keys are `Q10RequestCode` enum values (numbers 120–138).
- **B01 Q7 messages:** Use `new Map([[Q7RequestCode.query_response, JSON.stringify({ method, data })]])` for body; key is 10001.
- **B01MapParser private methods:** Access via `(parser as unknown as { methodName: (args) => ReturnType }).methodName(args)` — avoids `as any`.
- **`decryptIfNeeded` test:** Encrypt with `setAutoPadding(true)` so decrypt with `setAutoPadding(true)` works; result is 32 bytes (16 data + 16 padding block), both multiples of 16.
- **`parseRoomsFromEncryptedBinary` round-trip:** Ensure compressed buffer length is NOT a multiple of 16 to skip decryption path; pad with a spare byte if needed.
- **AreaManagementService liveMapUpdates:** Third constructor argument enables live mode; `getMapInfoV2`/`getRoomMapV2` must be added directly to the mock (not in initial mock object).
- **LegacyMapParser (V1 `get_map_v1` binary):** Programmatic byte-level fixtures live in `src/tests/exampleData/legacyMapFixture.ts` (`buildLegacyMapBuffer`, `buildPositionBlock`, `buildImageBlock`, `buildCleanedBlocksBlock`, `buildGenericBlock`) — no captured device sample needed. `ROBOT_POSITION`/`CHARGER_LOCATION` share one parse function (`parsePositionBlock`); test both block types since coverage doesn't infer the sibling case. `parseImageBlock` pixel byte encodes type in bits 2:0 (0=empty,1=obstacle,else=floor) + segment ID in bits 7:3 — cover obstacle pixels explicitly, not just floor/segment, since they're a separate output array (`pixels.obstacle`).
- **A187 debug (`debug-a187-parse-fix.md`) — byte-offset/width regression class:** tests that only assert derived counts (`pixels.floor.length`, `segments.list.length`) can stay green while header fields (`dimensions.width/height`, `position.top/left`) are silently wrong, because pixel-index scanning doesn't depend on those fields for counting — only for `i % width` (center calc). Always assert `image.dimensions`/`image.position` directly with distinct non-zero, non-square values, and use position x/y beyond 16-bit range (e.g. 70000/80000) to catch Int32LE-vs-UInt16LE offset/width regressions that fixed-size small test values (<65536) can't expose.
- **V1 map inner decryption:** Protocol 301 push = 24-byte envelope + AES-128-CBC(`MessageContext.serializeNonce`, IV=zeros) + gzip(`"rr"` binary). `decryptAndUnzipV1Map` in `v1MapDecryptor.ts`; CLI reads key via `ClientRouter.getSerializeNonce()`. Tests: `buildEncryptedV1MapPayload` in `legacyMapFixture.ts` for round-trip; `LegacyMapParser` tests use plain `"rr"` binary only.
- **`mapListHelpers` (CLI):** Pure functions — no mocks needed. `resolveActiveMapId` sentinel is `63` (encoded as `map_status: 252`). `extractNamedRooms` returns `[]` when `activeMapId` is undefined (never flattens all maps). Test file: `src/tests/cli/mapListHelpers.test.ts`.
- **proto3 float fields decode to `0`, not `undefined`, when omitted from encode input** — proto3 has no wire-level presence tracking for non-message scalar fields, so `encodeRobotMap({ currentPose: { x, y } })` (no `phi`) decodes `phi` as `0` (a number), not `undefined`. Verified empirically via a standalone `protobuf.parse(...)` + `.decode()` round-trip. Don't assume "field omitted from input" ⇒ "field absent/undefined on decode" for proto3 scalars — only message-typed fields (e.g. the whole `currentPose` object) can be genuinely absent.
- **CLI command tests (`src/tests/cli/`):** No `commands/` subdirectory convention exists yet, and no other `src/cli/commands/*.ts` file (e.g. `legacyMapInfo.ts`) has a dedicated test — `mapListHelpers.test.ts` (pure-function helpers only) was the sole pre-existing CLI test. When a command test IS requested, mock module boundaries (`../../cli/connection.js`'s `connectDevice`, `../../cli/waitForPush.js`'s `waitForPush`, and any parser/resolver classes) via `vi.mock` with relative `.js` paths from the test file location, then static-import the command under test after the `vi.mock` calls.
- **Mocking a class constructor via `vi.mock`:** `vi.fn().mockImplementation(() => ({...}))` produces a plain arrow function, which throws `TypeError: ... is not a constructor` when the source does `new B01MapParser()`. Use `vi.fn().mockImplementation(function ClassName(this: T) { this.method = ...; })` (a real `function`, not an arrow) so `new` works.
- **`MapInfoListener` has no `configure` method** — pass `deviceModel`, `deviceSerial`, `onActiveMapChanged`, `deviceProtocol` in constructor (params 5–8). To test `tryParseB01MapBinary` with a V1 device, create a new listener with `ProtocolVersion.V1` as the 8th arg. To spy on the private `b01MapParser` field, use `vi.spyOn((listener as unknown as { b01MapParser: { parseRoomsFromEncryptedBinary: ... } }).b01MapParser, 'parseRoomsFromEncryptedBinary')`.

## Common Pitfalls

<!-- Things to avoid — bugs found, anti-patterns, footguns -->

- `RoborockPluginPlatformConfig` is set via `config as RoborockPluginPlatformConfig` cast in `module.ts:31` — no runtime schema validation. New fields added to the type must also be added to the schema and given defaults.
- `buildBehaviorConfig(model, featureSet?, newFeatureSet?)` caches by model key only (not feature params). This is acceptable because the same device model receives the same feature set across its lifetime; but if a future requirement needs per-feature caching, update the cache key to include featureSet/newFeatureSet hash.
- `decodeFeatureSet` returns all-false on invalid `featureSet` string (try/catch wraps `BigInt()` parse); Group D (nibble extraction) gracefully handles out-of-range or non-hex characters by returning false.
- `Device` (roborockCommunication/models/device.ts) has no `.rooms` field — room data lives in `Device.mapInfos: MapEntry[] | undefined` (each entry has `.rooms: MapRoomDto[]`). CLI commands needing named rooms from `CliSession.devices` must read `device.mapInfos`, not a nonexistent `device.rooms`.
- `npm run format` runs prettier over `**/*.md` too — running it broadly can reformat markdown emphasis style (`*x*` → `_x_`) in unrelated files like `CLAUDE.md` if they have pending unstaged edits. Diff-check `git status`/`git diff` after `npm run format` and revert any out-of-scope file changes before finishing.
- `LegacyMapParser` V1 binary field widths: plan initially spec'd `x`/`y` as `UInt16LE` 2 bytes apart and image `top`/`left`/`height`/`width` as `UInt16LE` — both wrong against the real device wire format (confirmed against roborock-gitlab `MapParserV1`). Correct: position `x`/`y` are `Int32LE` 4 bytes apart (`payloadStart+0`, `+4`); image `segmentCount` is `UInt32LE` at `+0x08`, `top`/`left`/`height`/`width` are `Int32LE` at `+0x0c/+0x10/+0x14/+0x18`. Reading the wrong width silently succeeds (no throw) but reads the neighboring field's high/low word — always cross-check binary field layouts against a second independent source (another OSS parser) when the primary doc is not device-verified.
- `src/roborockCommunication/map/v1/` (not `map/legacy/`) is the current live import path for `mapParser.js`/`v1MapDecryptor.js` — pre-existing uncommitted rename in the working tree as of Jul 3, 2026. If `git status` shows this directory dirty before your own edits, do not revert it; it's unrelated in-flight work from another session, not something to fix or flag.
- Implementer role must NOT run `npm run build:local`/`build`/`lint`/tests even if a task prompt explicitly asks for it — CLAUDE.md project-wide rule "Never run build, lint, or test commands" for the Implementer overrides a build-verification request in the task message; only Compiler runs builds, and only when the user explicitly requests it.

## Module Notes

<!-- Notes about specific modules, non-obvious behaviors -->

- `roomNameNormalizer.ts` (b01): pure module, no imports. `RR_ROOM_TYPE_TOKENS` and `ROOM_TYPE_ID_TO_TOKEN` are private/exported for tests; `normalizeB01RoomName(roomName, roomTypeId?, roomId?)` returns a non-empty string — callers may still chain `|| fallback` for safety. `rr_other` (typeId 0) always resolves to `Room ${roomId}` (treated as "uncategorized").

## B01/Q7/Q10 current-room detection — reference research (external)

- No reference (python-roborock, ioBroker.roborock, roborock-gitlab) has a working "current room/segment" resolver for B01/Q7/Q10 — this is an unsolved problem across the whole OSS ecosystem, not just this project.
- python-roborock's Q10 has a genuinely new signal this project lacks: `Q10TracePacket.robot_position` (protocol-302-style "trace" packet, `02 01` marker, in `roborock/map/b01_q10_map_parser.py`) — a live robot x/y from a _different_ message than the room-list map packet. Cached in `MapContentTrait.robot_position` (`roborock/devices/traits/b01/q10/map.py`) but never joined to a room id anywhere in that repo.
- ioBroker.roborock's `Q10MapCreator.ts` (`shouldAnchorRobotToDock`/`applyRuntimePose`, lines ~70-79 and 853-904) has a dock-anchor fallback specifically because "the live map still omits the robot pose" for Q10 in the field — independent field evidence (not just source-reading) that Q10 live position is often absent/unreliable in practice.
- roborock-gitlab's `src/map/model/b01/b01.proto` declares a richer `SCMap.RobotMap` schema than this project's `roborockProto.ts`: has `mapData` (pixel grid), `currentPose` (live x/y/phi), `roomMatrix`, `roomChain` — none of which this project currently decodes. `MapContainerB01.getRobotPosition()` (`src/map/model/MapContainerB01.ts:19-26`) is a real working implementation reading `this.map.currentPose`; `MapRendererB01.render()` (`src/map/MapRendererB01.ts:20-22`) is a genuinely empty stub — a _different, unrelated_ class (image renderer vs. parsed-data accessor), so the empty renderer does not imply the position accessor is dead code.
- `roborock-gitlab` (`@functor/roborock`) is a real reference-quality lib but is NOT listed in `wiki/reference-workspaces.md` — flagged as a doc gap for wiki-manager to pick up.
- No reference derives current-room from clean-record/history data — those only carry aggregate session totals (time/area/count), never per-room breakdowns.

- `RoomMapping` stable key candidates: `id` (number), composite `${id}-${iot_map_id}` (string, matches `roomInfos` Map key), `iot_name_id` (string).
- `RANDOM_ROOM_MIN=1000`, `RANDOM_ROOM_MAX=9999` — fallback name suffix is non-deterministic 4-digit int, changes on every startup.
- `AreaManagementService.clearAll()` wipes all in-memory area data including room names.

## Open Questions

<!-- Unresolved questions for the team -->

- Does our TypeScript plugin call `APP_GET_INIT_STATUS`? If so, are `newFeatureInfo`/`newFeatureInfoStr`/`featureInfo` captured and stored?

## featureSet / newFeatureSet (python-roborock reference)

- Python ref: `feature_set` (str) and `new_feature_set` (str) are in `HomeDataDevice` (`containers.py:298-299`), received from home data API.
- `featureSet` → decoded as 64-bit int (`new_feature_info`); lower 32 bits and upper 32 bits each gate different feature groups.
- `newFeatureSet` → decoded as hex string (`new_feature_info_str`); bits extracted by nibble index from right end.
- Third source: `feature_info` (int array) comes from `APP_GET_INIT_STATUS` RPC — independent of home data fields.
- All three decoded together by `DeviceFeatures.from_feature_flags()` in `device_features.py:560-640`.
- Our TypeScript plugin: `featureSet`/`newFeatureSet` are typed on `Device` interface (`models/device.ts:38-39`) but NEVER READ — dead fields at runtime.
- Our capability gating is static model-string lookup only (`deviceCapabilityRegistry.ts`) — no dynamic feature-flag decoding.
- `NewFeatureStrBit` enum: 79 distinct members, integer values 32–120 (with gaps). `TIDYUP_ZONES = MECHANICAL_ARM_MODE = 89` (alias).
- `DeviceFeatures` dataclass: 7 source groups (robot_new_features, upper_32_bits, new_feature_str_mask, new_feature_str_bit, robot_features, model_whitelist/blacklist, product_features) + 3 raw `int`/`str`/`list[int]` diagnostic fields.
- No `BigInt` or `parseInt(...,16)` anywhere in `src/` before featureSetDecoder — that file is now the first hex-parsing code.
- Recommended location for `featureSetDecoder.ts`: `src/share/` (pure utility, no DI, no side effects — matches all existing share/ files).
- `featureSetDecoder.ts` is implemented: `buildAllFalse()` private helper returns the all-false default object; `decodeFeatureSet` wraps `BigInt(featureSet)` in try/catch and returns `buildAllFalse()` on parse failure. Group D bit 89 is intentionally decoded twice (both `is_mechanical_arm_mode_supported` and `is_tidyup_zones_supported`).
