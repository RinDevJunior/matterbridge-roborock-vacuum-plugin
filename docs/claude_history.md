# Claude History

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
