# Claude History

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
