# To Do

## In Progress

- [ ] Fix status update flow bugs — see `docs/status-update-flow-issues.md`
  - [ ] Issue 1 (High): `handleDeviceStatusSimpleUpdate` passes `ModeTag` to `state_to_matter_operational_status` — fix to pass `message.status`
  - [ ] Issue 2 (Medium): `getBatteryState` returns `IsAtFullCharge` for Cleaning/Paused/etc — fix default case
  - [ ] Issue 3 (Low): falsy check drops 0% battery in `updateFromHomeData` — fix to `!= null`
  - [ ] Issue 4 (Design): DSS check ordering inconsistency in simple vs full path
  - [ ] Issue 5 (Design): `requestHomeData` global short-circuit on `allDevicesHaveRealTimeConnection`
  - [ ] Issue 6 (Design): Charging guard depends on broken `getBatteryState` exit condition

- [ ] Fix `stateResolver.ts` bugs — see `docs/stateResolver-bugs.md`

- [ ] Fix routine selection in `setSelectedAreas` — see `docs/routine-selection-fix-plan.md`
  - [ ] `areaManagementService.setSelectedAreas`: store raw areaIds (remove RoomIndexMap conversion)
  - [ ] `roborockService.startClean`: separate routines/rooms, convert room areaIds → roomIds
  - [ ] `messageRoutingService.tryStartRoutineClean`: fix `rooms` filter + fix `startScene` scene ID
  - [ ] Add/update tests
- [ ] Investigate MQTT keepalive behavior change (rc04 stopped periodic reconnection — may cause stale connections)
- [ ] Integrate `B01ResponseBroadcaster` into dispatcher factory / connection service for B01 devices

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
