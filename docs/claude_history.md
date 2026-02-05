# Claude History

## 2026-02-05

### Fix MQTT Reconnection Loop (Error Code 5)

- Fixed race condition in `onReconnect` - removed `subscribeToQueue()` call since `onReconnect` fires when reconnection *starts*, not when it succeeds
- Added error code 5 handling to translate `{ code: 5 }` to "Connection refused: Not authorized" message
- Added `isReady()` method to MQTTClient
- Updated `connectionStateListener.onError` to clear manual reconnect timer on auth errors
- Files modified:
  - [mqttClient.ts](../src/roborockCommunication/mqtt/mqttClient.ts)
  - [connectionStateListener.ts](../src/roborockCommunication/routing/listeners/implementation/connectionStateListener.ts)
- Updated tests in:
  - [MQTTClient.test.ts](../src/tests/roborockCommunication/broadcast/client/MQTTClient.test.ts)
  - [connectionStateListener.test.ts](../src/tests/roborockCommunication/broadcast/listener/implementation/connectionStateListener.test.ts)

## 2026-02-02

### Unit Tests for platformRunner.ts

- Wrote comprehensive unit tests for [platformRunner.ts](../src/platformRunner.ts)
- Achieved 96.5% average coverage (100% statements, 86.11% branches, 100% functions, 100% lines)
- Added 29 test cases covering:
  - `requestHomeData` method with various edge cases
  - `updateRobotWithPayload` with all message types
  - Error handling for missing robots and services
  - Battery update scenarios
  - Device status updates including dock station errors
  - Clean mode updates
  - Service area updates with segment mapping
  - Home data message handling
- Updated `createMockConfigManager` in test utils to include `includeDockStationStatus` property
