# Claude History

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

## 2026-05-17 (Session 24)

- Fixed CI `npm ci` failure: added `"typescript": "6.0.3"` to existing `"overrides"` block in `package.json` so npm v10 (CI) resolves `tsconfck`'s optional `typescript@^5.0.0` peer dep to `6.0.3` instead of trying to install `5.9.3` which was missing from the lock file.
- Updated safe patch-level dev dependencies: `@vitest/coverage-v8` 4.1.2→4.1.6, `@vitest/eslint-plugin` 1.6.14→1.6.17, `prettier` 3.8.1→3.8.3, `typescript` 6.0.2→6.0.3, `typescript-eslint` 8.58.0→8.59.3, `vitest` 4.1.2→4.1.6, `node-persist-manager` 2.0.1→2.0.2.
- Fixed two new lint errors surfaced by `typescript-eslint@8.59.3`: removed redundant `model as string` cast in `getSupportedCleanModes.ts` and `} as AbstractUDPMessageListener` cast in `connectionService.ts`; removed now-unused `AbstractUDPMessageListener` import.
- All 175 test files, 1865 tests pass. Precommit clean.

## 2026-05-17 (Session 23)

- Ran `/simplify` code review on fire-and-forget migration (Phases 1–3 staged changes).
- Fixed memory leak: `OneShotResponseListener` was never removed from broadcaster arrays after settling. Added `deregister(listener)` to `ResponseBroadcaster` interface + all implementations (`V1ResponseBroadcaster`, `B01ResponseBroadcaster`, `ResponseBroadcasterFactory`). Added `finally { broadcaster.deregister(listener) }` to `AbstractClient.query()` and `ClientRouter.query()`.
- Removed `timer.unref()` after `clearTimeout()` in `OneShotResponseListener.onMessage()` — no-op after clear.
- Removed stale JSDoc comment in `AbstractClient.isReady()`.
- Removed commented-out dead code in `Q7MessageDispatcher` (unused `b01MapParser` field and old `getRoomMap` implementation).
- Removed WHAT-only section banner comments in `V10MessageDispatcher`.
- Added `deregister` tests to `v1ResponseBroadcaster.test.ts` and `b01ResponseBroadcaster.test.ts`.
- All 175 test files, 1865 tests pass. Type-check clean.

## 2026-05-16 (Session 22)

- Executed fire-and-forget migration (all 3 phases) per `docs/plan-fire-and-forget-v2.md`.
- Phase 1: Converted 9 dispatcher methods from `client.get()` to `client.send()` (findMyRobot, getDeviceStatus for V10/Q10; getNetworkInfo, getMapInfo, getRoomMap for Q10/Q7). Updated `abstractMessageDispatcher.ts` `getDeviceStatus` return type from `Promise<DeviceStatus | undefined>` to `Promise<void>`.
- Phase 2: Created `OneShotResponseListener` (one-shot listener pattern). Added `query<T>()` to `Client` interface, `AbstractClient`, and `ClientRouter`. Added `parseV1Result<T>()` module helper to `V10MessageDispatcher`. Migrated all remaining `client.get()` callers in V10/Q10/Q7 dispatchers to `client.query()`. Simplified `changeCleanMode()` read-before-write guard (removed `getCustomMessage('get_custom_mode')` call).
- Phase 3: Deleted entire `PendingResponseTracker` infrastructure (3 source files + 3 test files). Removed `tryResolve()` from `ResponseBroadcaster` interface and all implementations. Simplified broadcaster constructors. Removed tracker from local/MQTT client constructors.
- Updated 20+ test files to remove tracker mocks. Fixed race condition in `AbstractClient.query()` test (microtask deferral). All 175 test files, 1863 tests pass.

## 2026-04-11 (Session 21)

- Executed `docs/plan-cleanModeConfig-split.md`: split `src/behaviors/roborock.vacuum/core/cleanModeConfig.ts` (383 LOC) into a directory module.
- Created `cleanModeConfig/` with 7 files: `types.ts`, `vacuumAndMop.ts`, `mopOnly.ts`, `vacuumOnly.ts`, `special.ts`, `helpers.ts`, `index.ts`.
- Fixed import paths: enums are at `../../enums/` (not `../enums/`) from inside the subdirectory.
- Updated 20 import files (11 production + 9 test): `cleanModeConfig.js` → `cleanModeConfig/index.js`.
- Deleted original `cleanModeConfig.ts`.
- `npm run build` exits 0, all 1911 tests pass, lint clean.

## 2026-04-11 (Session 20)

- Ran code-simplifier on `src/runtimes/handlers/` (5 handler files + `platformRunner.ts`).
- `errorStateHandler.ts`: removed duplicate `debug` log (line 24 was identical to line 17); moved `currentOperationState` getAttribute call to just before its use (skips it on early-return paths); simplified `!== undefined && !== null` → `!= null`.
- `serviceAreaHandler.ts`: removed redundant `if (!cleaningInfo) return` guard inside `resolveAreaFromCleaningInfo` (caller already narrows); changed function signature to accept `CleanInformation` directly; renamed snake_case segment vars to camelCase (`sourceSegmentId`, `sourceTargetSegmentId`, `segmentId`); inlined `activeArea` find into debug log (removed unused variable).
- `batteryStateHandler.ts`: fixed falsy-zero bug — `if (batteryLevel)` skipped updates at 0% battery; replaced with `if (batteryLevel != null)` which guards against undefined wire data without skipping 0%.
- `deviceStateHandler.ts`: parallelized two independent `updateAttribute` calls in `handleDeviceStatusUpdate` using `Promise.all`.
- `roborockService.coverage.test.ts`: removed test "should throw error when configManager is not provided" — tested dead guard removed in Session 19.
- All 1911 tests pass.

## 2026-04-11 (Session 19)

- Ran code-simplifier review on `src/services/roborockService.ts`.
- Removed dead guard `if (!this.configManager)` in `authenticate()` — constructor guarantees it's set.
- Removed section header comments (`// === ... ===`) in `roborockService.ts` — pure WHAT noise.
- Fixed bug in `serviceContainer.ts` `destroy()`: `pollingService.shutdown()` was called twice (once without clearing the reference, then again in the normal cleanup block). Removed the redundant early call.
- Flagged future refactor: move `buildCleanCommand` from `RoborockService` to `AreaManagementService` to reduce 4-call coupling; deferred due to required test redesign.

## 2026-04-04 (Session 18)

- Executed Priority 1 refactoring from `docs/refactoring-recommendations.md`: split `platformRunner.ts` (562 LOC) into 5 pure handler modules under `src/runtimes/handlers/`.
- Created plan in `docs/plan-platformRunner-split.md`, then executed 5 phases sequentially with build+test after each.
- Extracted handlers:
  - `serviceAreaHandler.ts` — `handleServiceAreaUpdate` + 3 helpers + `CLEANING_STATES` const
  - `errorStateHandler.ts` — `handleErrorOccurred`
  - `deviceStateHandler.ts` — `handleDeviceStatusUpdate` (returns `boolean` for burst polling signal) + `handleDeviceStatusSimpleUpdate`
  - `batteryStateHandler.ts` — `handleBatteryUpdate`
  - `cleanModeHandler.ts` — `handleCleanModeUpdate`
- `platformRunner.ts` reduced from 562 → 118 LOC (dispatcher + lifecycle only, no handler logic).
- All 1912 tests pass. Lint and build clean. Changes staged (not committed per user preference).
- Updated `docs/CODE_STRUCTURE.md` with new `runtimes/handlers/` directory, `docs/to_do.md` marked item complete.

## 2026-03-14 (Session 17)

- Fixed multi-device polling bug in `PollingService`: second vacuum was stopping first vacuum's polling interval.
  - Replaced single `localRequestDeviceStatusInterval` with `Map<string, NodeJS.Timeout>` keyed by `duid`.
- Audited all services for multi-device bugs. Found and fixed 1 real bug:
  - **V1PendingResponseTracker**: messageId collision between devices — changed key from `messageId` (number) to `${duid}:${messageId}` (string).
  - B01PendingResponseTracker was already correctly handling duid isolation via `entry.duid === response.duid` in `matches()`.
- Added new test file `v1PendingResponseTracker.test.ts` (6 tests) + 2 multi-device tests in B01 tracker.
- Updated existing tests in `pendingResponseTracker.test.ts` to use new string key format.

## 2026-03-07 (Session 16)

- Bumped version to `1.1.5-rc08`.
- Updated `package.json` (version + buildpackage filename), `schema.json`, `config.json`, and `CHANGELOG.md`.
- Changelog entry: refactored `handleServiceAreaUpdate` into dedicated helpers with clear 3-branch dispatch.

## 2026-03-02 (Session 15)

- Bumped version to `1.1.5-rc07`.
- Updated `package.json` (version + buildpackage filename), `schema.json`, `config.json`, and `CHANGELOG.md`.
- Changelog entry: fixed `selectedAreas` type (`ServiceArea.Area[]` → `number[]`) correcting `.areaId` access in single-room cleaning.

## 2026-03-01 (Session 14)

- Debugged `stateResolver.ts`: Sleeping (2) + `inCleaning=true` was resolving to Idle+Docked instead of Cleaning+Paused.
  - Root cause: no Sleeping handler in Priority 0 — fell through to `getBaseState` → `state_to_matter_state(2)` = Idle, `state_to_matter_operational_status(2)` = Docked.
  - Fix: added Sleeping override (Rows 8–10) in Priority 0 block of `resolveDeviceState`.
  - Also fixed stale test "should handle Sleeping status - Row 8" (wrong label → "Row 10", wrong expectation Docked → Paused).
- Audited `stateResolver.ts` vs `misc/state_resolution_matrix.md` — found 4 discrepancies, documented in `docs/stateResolver-bugs.md`.

## 2026-02-28 (Session 13)

- Added `src/tests/platform/burstPollingManager.test.ts` (16 tests) to improve PR 116 patch coverage for `BurstPollingManager` — covers startBurstPolling (happy/early-return/error paths), stopBurstPolling, stopAllBurstPolling, has, requestLocalDeviceStatus (undefined service), isDeviceIdle (robot not found, Docked, Charging, Running). Used `vi.useFakeTimers()` with `advanceTimersByTimeAsync(15000)` to trigger the 10s interval callback.

## 2026-02-28 (Session 12)

- Refactored `platformRunner.ts` per `docs/platformRunner-refactor-plan.md`:
  - **Item 1**: Extracted burst polling into `src/platform/burstPollingManager.ts` (`BurstPollingManager` class).
  - **Item 2**: Extracted name resolver pure functions into `src/share/matterStateNames.ts` (`getRunModeName`, `getOperationalStateName`, `getCleanModeName`, `getOperationalErrorName`).
  - **Item 4**: Replaced `payloadHandlers` Map + inline type-guard lambdas with a clean `switch` in `updateRobotWithPayload`.
  - Removed 3 wrapper methods (`startBurstPolling`, `stopBurstPolling`, `stopAllBurstPolling`) from `PlatformRunner` — callers now use `runner.burstPolling.xxx()` directly.
  - Updated `module.ts`, `deviceConfigurator.ts`, `platformRunner.test.ts`, and `module.orchestration.test.ts` accordingly.

## 2026-02-26 (Session 11)

- Fixed `LocalNetworkClient` stale socket race condition on ping-timeout reconnect: replaced `intentionalDisconnect` flag (time-based, shared mutable state) with closure-captured socket reference in `close`/`error`/`end` event handlers. Old socket events are now identity-checked (`this.socket !== socket`) and ignored, preventing the new socket from being destroyed mid-handshake.
- See detailed write-up: `docs/bugfix-local-reconnect-stale-socket.md`

## 2026-02-24 (Session 10)

- Added `Protocol.device_status_ota` (500) with `deserializeDeviceStatusOta` in `MessageDeserializer` and new `DeviceStatusListener` to log firmware update status/progress and device online/offline events.
- Fixed `LocalNetworkClient` reconnect: added `intentionalDisconnect` flag so stale `close`/`error` events from the old socket are suppressed after a ping-timeout reconnect, preventing the new socket from being torn down mid-handshake.
- Added `isReconnecting()` to `LocalNetworkClient`; `ClientRouter.getLocalClient` now falls back to MQTT with a notice log while the local client is reconnecting.
- Removed dead-code `SyncMessageListener`.
- Added unit tests: `localNetworkClient.reconnect.test.ts` (4 tests) and 3 new cases in `deviceConfigurator.test.ts` for missing coverage (`addDevice` early return, null cluster options, duplicate bridgedNode guard).
- Created release candidate `1.1.5-rc02`: bumped version in `package.json`, `package-lock.json`, `schema.json`, `config.json`. Added CHANGELOG entry.

## 2026-02-18 (Session 9)

- Added `includeVacuumErrorStatus` configuration option under Advanced features. When disabled (default), `handleErrorOccurred` in `platformRunner.ts` is skipped. Updated schema, config type, config manager, platformRunner, and all test files.
- Created release candidate 1.1.4-rc07: bumped version in `package.json`, `schema.json`, `config.json`. Added CHANGELOG entry for vacuum error status control feature.

## 2026-02-17 (Session 8)

- Created `B01PendingResponseTracker` — collects multiple B01 response messages matching by timestamp and protocol, merges body data, resolves after configurable collection window (default 500ms). Supports configurable timestamp tolerance.
- Created `B01ResponseBroadcaster` — B01-specific broadcaster that delegates to `B01PendingResponseTracker` for multi-response collection, with same listener dispatch pattern as `ResponseBroadcaster`.
- Added 10 unit tests for `B01PendingResponseTracker` and 4 for `B01ResponseBroadcaster` (all passing).
- Added real-data integration test to `B01PendingResponseTracker` using sample data from `exampleData/tmp.log`.
- Added key mapping in `B01PendingResponseTracker.mapDataKeys` — converts numeric DPS keys to named keys using `Q10RequestCode` enum reverse lookup (e.g. `'121'` → `'state'`, `'122'` → `'battery'`). Unmapped keys stay as numbers.

## 2026-02-17 (Session 7)

- Created release candidate 1.1.4-rc06: bumped version in `package.json`, `schema.json`, `config.json`. Added CHANGELOG entry for Buy Me a Coffee badge asset.
- Updated CHANGELOG for 1.1.4-rc06: added improvements for 2FA toast notifications, snackbar severity levels, and WebSocket restart prompt after persistence clear.

## 2026-02-17 (Session 6)

- Fixed `mqttClient.ts`: resolve `version` on request object in `sendInternal` via `getMQTTProtocolVersion(duid)` before serialization, matching `LocalNetworkClient` pattern. Previously `version` was `undefined` on the request (only resolved inside serializer).

## 2026-02-16 (Session 5)

- Fixed `platformRunner.ts` Node.js 20 compatibility: spread `Map.values()` into array before calling `.every()` (Iterator Helpers not available in Node.js 20).

## 2026-02-16 (Session 4)

- Added unit tests to improve Codecov patch coverage for 7 files with missing lines.
- Updated test files:
  - `module.orchestration.test.ts` — added 5 tests: clearStorageOnStartup early return, alwaysExecuteAuthentication persist clear, roborockService undefined after discovery, onConfigure clearStorage flow, clearStorage error handling
  - `messageDeserializer.test.ts` — added 3 tests: CRC32 mismatch throw, localKey not found returns undefined body, map_response protocol handling
  - `LocalNetworkClient.test.ts` — added 3 tests: version fallback to context protocol, processHelloResponse clearing existing interval, safeHandler with non-Error objects
  - `Q10MessageDispatcher.test.ts` — added 2 tests: real private helpers via client.send, both suctionPower and waterFlow zero
  - `Q7MessageDispatcher.test.ts` — added 2 tests: real private helpers via client.send, both suctionPower and waterFlow zero
  - `platformRunner.test.ts` — added 2 tests: skip requestHomeData when all devices have real-time connection, proceed when mixed connections

## 2026-02-16 (Session 3)

- Created CHANGELOG entry for `1.1.4-rc05`.
- Staged changes include:
  - Skip `requestHomeData` when all devices have real-time connections (`platformRunner.ts`).
  - Move `VacFollowedByMop` from base to smart clean mode configs (`cleanModeConfig.ts`).
  - Tighten `PlatformRunner` type contract, remove optional chaining (`deviceConfigurator.ts`, `module.ts`).

## 2026-02-16 (Session 2)

- Added unit tests to increase Codecov patch coverage across 8 files with missing lines.
- New test files:
  - `src/tests/roborockCommunication/broadcast/listener/localPingResponseListener.test.ts` (8 tests) — covers ping response handling, timer cleanup
  - `src/tests/behaviors/roborock.vacuum/core/cleanModeUtils.test.ts` (11 tests) — covers getSettingFromCleanMode with all modes and CustomizeWithDistanceOff
- Updated test files:
  - `LocalNetworkClient.test.ts` — added 17 tests: isReady, isConnected branches, sendInternal hello_request bypass, trySendHelloRequest V1/L01 fallback, processHelloResponse, checkConnection reconnect/ping/skip, safeHandler error handling, multi-segment onMessage
  - `messageContext.test.ts` — added 3 tests: updateMQTTProtocolVersion, getMQTTProtocolVersion, unregisterAllDevices
  - `messageDeserializer.unit.test.ts` — added 4 tests: unsupported version, ping_response, hello_response, general_response
  - `Q10MessageDispatcher.test.ts` — added 3 tests: messageId monotonic, Date.now collision, getRoomMap empty
  - `Q7MessageDispatcher.test.ts` — added 2 tests: messageId monotonic, Date.now collision
- All 1552 tests pass across 154 test files.

## 2026-02-16

- Fixed keepConnectionAlive in MQTTClient and LocalNetworkClient to only reconnect when connection is down.
  - **MQTTClient**: Removed `end()` + `reconnect()` cycle when already connected (caused empty subscription list on reconnect, leading to message timeouts).
  - **LocalNetworkClient**: Removed `disconnect().then(() => connect())` when already connected (caused socket destruction and failed hello handshake race condition).
  - **LocalNetworkClient**: Fixed interval leak — `disconnect()` now clears `keepConnectionAliveInterval`. Fixed `clearTimeout` → `clearInterval` mismatch.
- Added unit tests to increase patch coverage for dev branch changes.
- New test files:
  - `src/tests/behaviors/roborock.vacuum/core/modeResolver.test.ts` (21 tests)
  - `src/tests/behaviors/roborock.vacuum/core/cleanModeConfig.test.ts` (16 tests)
  - `src/tests/behaviors/roborock.vacuum/core/behaviorConfig.test.ts` (12 tests)
  - `src/tests/behaviors/roborock.vacuum/handlers/defaultCleanModeHandler.test.ts` (8 tests)
  - `src/tests/behaviors/roborock.vacuum/handlers/customCleanModeHandler.test.ts` (3 tests)
  - `src/tests/roborockCommunication/map/b01MapParser.test.ts` (6 tests)
- Updated test files:
  - `src/tests/behaviors/roborock.vacuum/default/default.test.ts` - added VacFollowedByMop and EnergySaving mode tests
  - `src/tests/behaviors/roborock.vacuum/smart/smart.test.ts` - added VacFollowedByMop and EnergySaving mode tests
- Coverage improvements: modeResolver 0%→97.56%, b01MapParser 20%→100%, handlers to 100%.

## 2026-02-15

- Created B01 map parser for extracting rooms from protobuf-encoded map data.
- Added `protobufjs` dependency.
- Created files: `src/roborockCommunication/map/b01/b01MapParser.ts`, `types.ts`, `roborockProto.ts`.
- Proto schema minimized to only room-related messages (`RobotMap`, `RoomDataInfo`, `DevicePointInfo`, `MapHeadInfo`).
