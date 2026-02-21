# Claude History

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
