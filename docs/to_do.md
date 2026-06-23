# To Do

## In Progress

- [x] Fire-and-forget v3 — all tasks complete (see `docs/tasks-fire-and-forget-v3.md`)
  - [x] Task 1: Convert `getMapInfo()`/`getRoomMap()` to `Promise<void>` across all 7 layers
  - [x] Task 2: Rewrite `RoomMap.fromMapInfo()` → `Promise<void>`, update `deviceConfigurator.ts`
  - [x] Task 3: Create `MapInfoListener` — shape-based V1 detection, `getSupportedAreas` → `AreaManagementService`
  - [x] Task 4: Wire `MapInfoListener` in `connectionService.ts` via injected `AreaManagementService`
  - [x] Task 5: Remove blocking `getRoomMap` block from `serviceAreaHandler.ts`, log level → `debug`

- [ ] Fix status update flow bugs — see `docs/status-update-flow-issues.md`
  - [x] Issue 1 (High): `handleDeviceStatusSimpleUpdate` passes `ModeTag` to `state_to_matter_operational_status` — fixed to pass `message.status`
  - [x] Issue 2 (Medium): `getBatteryState` returns `IsAtFullCharge` for Cleaning/Paused/etc — fixed default case to `IsNotCharging`
  - [x] Issue 3 (Low): falsy check drops 0% battery in `updateFromHomeData` — fixed to `!= null` (also fixed `suctionPower && waterBoxMode`)
  - [x] Issue 4 (Design): DSS check ordering inconsistency in simple vs full path — fixed, DSS check now at top of `handleDeviceStatusSimpleUpdate`
  - [x] Issue 5 (Design): `requestHomeData` global short-circuit — replaced with per-device staleness check using `lastUpdateAt` + `WATCHDOG_THRESHOLD_MS`
  - [x] Issue 6 (Design): Charging guard depends on broken `getBatteryState` — resolved by Issue 2 fix

- [x] Fix `stateResolver.ts` bugs — verified implementation matches `misc/state_resolution_matrix.md`; doc was lost but no remaining discrepancies found

- [x] Fix routine selection in `setSelectedAreas` — already implemented in `roborockService.buildCleanCommand`: separates routines/rooms, uses `indexMap.getRoomId()` for conversion; `setSelectedAreas` stores raw areaIds
- [x] Investigate MQTT keepalive — unconditional `end()` + `reconnect()` re-enabled deliberately (comment confirms intent); not a bug
- [x] Integrate `B01ResponseBroadcaster` — already integrated: `connectionService.ts` registers `B01StatusListener`; `ResponseBroadcasterFactory` routes B01 protocol messages internally

## Completed

- [x] Full codebase read-through + `docs/authentication-flow.md` diagram + `docs/CODE_STRUCTURE.md` refresh (fixed routing/initialData/constants/model/errors drift, added "Error Handling & Plugin Models" and "CLI Tool" sections)
- [x] Improve patch coverage: added 8 targeted tests for uncovered branches in OneShotResponseListener, ResponseBroadcasterFactory, ClientRouter, AbstractClient, V1/B01 broadcasters — 1876 tests pass
- [x] Fire-and-forget migration (Phases 1–3) — replaced `client.get()` with `client.send()` / `client.query()` via `OneShotResponseListener`; deleted `PendingResponseTracker` infrastructure; 1865 tests pass
- [x] Split `cleanModeConfig.ts` into directory module (`types`, `vacuumAndMop`, `mopOnly`, `vacuumOnly`, `special`, `helpers`, `index`) — Priority 4 from refactoring-recommendations.md
- [x] code-simplifier on `roborockService.ts`: removed dead guard, section headers, fixed double pollingService.shutdown() bug in serviceContainer.ts

- [x] platformRunner-refactor: extract all handlers into `src/runtimes/handlers/` — serviceAreaHandler, errorStateHandler, deviceStateHandler, batteryStateHandler, cleanModeHandler (Priority 1 from refactoring-recommendations.md)
- [x] Fix multi-device polling bug — `PollingService` now uses `Map<duid, Timeout>` so each vacuum has its own interval
- [x] Fix V1PendingResponseTracker messageId collision — composite key `${duid}:${messageId}` prevents cross-device response routing
- [x] Release `1.1.6` — Add base Q Revo (`roborock.vacuum.a75`) to `DeviceModel` enum
- [x] Release `1.1.5-rc08` — refactor `handleServiceAreaUpdate` into dedicated helpers
- [x] Release `1.1.5-rc07` — correct type of `selectedAreas` (`ServiceArea.Area[]` → `number[]`)
