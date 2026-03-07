# To Do

## In Progress

- [ ] Fix `stateResolver.ts` bugs — see `docs/stateResolver-bugs.md`

- [ ] Fix routine selection in `setSelectedAreas` — see `docs/routine-selection-fix-plan.md`
  - [ ] `areaManagementService.setSelectedAreas`: store raw areaIds (remove RoomIndexMap conversion)
  - [ ] `roborockService.startClean`: separate routines/rooms, convert room areaIds → roomIds
  - [ ] `messageRoutingService.tryStartRoutineClean`: fix `rooms` filter + fix `startScene` scene ID
  - [ ] Add/update tests
- [ ] Investigate MQTT keepalive behavior change (rc04 stopped periodic reconnection — may cause stale connections)
- [ ] Integrate `B01ResponseBroadcaster` into dispatcher factory / connection service for B01 devices

## Completed

- [x] Release `1.1.5-rc08` — refactor `handleServiceAreaUpdate` into dedicated helpers
- [x] Release `1.1.5-rc07` — correct type of `selectedAreas` (`ServiceArea.Area[]` → `number[]`)

## Previously Completed

- [x] Improve PR 116 patch coverage: add `burstPollingManager.test.ts` (16 tests)
- [x] Refactor `platformRunner.ts` — items 1, 2, 4 from `docs/platformRunner-refactor-plan.md`
  - [x] Extract `BurstPollingManager` → `src/platform/burstPollingManager.ts`
  - [x] Extract name resolver utils → `src/share/matterStateNames.ts`
  - [x] Replace `payloadHandlers` Map with `switch` in `updateRobotWithPayload`
  - [x] Remove wrapper delegate methods from `PlatformRunner`; callers use `burstPolling` directly
- [ ] platformRunner-refactor item 3: extract `handleErrorOccurred` and `handleServiceAreaUpdate` into `src/runtimes/`

- [x] Add `Protocol.device_status_ota` (500) with `deserializeDeviceStatusOta` and `DeviceStatusListener` for firmware update/online status logging
- [x] Fix `LocalNetworkClient` reconnect: `intentionalDisconnect` flag suppresses stale `close`/`error` events from old socket after ping-timeout reconnect
- [x] Add `isReconnecting()` to `LocalNetworkClient`; `ClientRouter.getLocalClient` falls back to MQTT with notice log while reconnecting
- [x] Remove dead-code `SyncMessageListener`
- [x] Add unit tests: `localNetworkClient.reconnect.test.ts` (4 tests) + 3 new cases in `deviceConfigurator.test.ts`
- [x] Create release candidate 1.1.5-rc02: bumped version, updated CHANGELOG

- [x] Add "Include Vacuum Error Status" configuration under Advanced features to gate `handleErrorOccurred` in platformRunner

- [x] Create `B01ResponseBroadcaster` and `B01PendingResponseTracker` for multi-response B01 protocol handling
- [x] Add real-data integration test to `B01PendingResponseTracker` using example log data
- [x] Add Q10RequestCode key mapping to `B01PendingResponseTracker` — numeric keys converted to named keys at resolve time
- [x] Create release candidate 1.1.4-rc06 with Buy Me a Coffee badge asset
- [x] Update CHANGELOG for 1.1.4-rc06 with staged improvements (2FA toast, snackbar severity, WSS restart prompt)

- [x] Fix version undefined in MQTT request — resolve version in `mqttClient.sendInternal` before serialization

- [x] Fix Node.js 20 compatibility: `Map.values().every()` → `[...Map.values()].every()` in platformRunner.ts

- [x] Improve Codecov patch coverage for module.ts, messageDeserializer, localClient, Q10/Q7 dispatchers, platformRunner
- [x] Create CHANGELOG for 1.1.4-rc05 release candidate
- [x] Improve Codecov patch coverage for localClient, localPingResponseListener, messageContext, messageDeserializer, Q10/Q7 dispatchers, cleanModeUtils
- [x] Fix keepConnectionAlive in MQTTClient and LocalNetworkClient — only reconnect when connection is down
- [x] Increase patch coverage for dev branch (modeResolver, cleanModeConfig, behaviorConfig, handlers, B01MapParser)
- [x] B01 map parser - room extraction from protobuf data
