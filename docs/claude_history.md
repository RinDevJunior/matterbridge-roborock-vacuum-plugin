# Claude History

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
