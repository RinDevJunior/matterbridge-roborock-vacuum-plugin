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

- [x] Split `cleanModeConfig.ts` into directory module (`types`, `vacuumAndMop`, `mopOnly`, `vacuumOnly`, `special`, `helpers`, `index`) — Priority 4 from refactoring-recommendations.md
- [x] code-simplifier on `roborockService.ts`: removed dead guard, section headers, fixed double pollingService.shutdown() bug in serviceContainer.ts

- [x] platformRunner-refactor: extract all handlers into `src/runtimes/handlers/` — serviceAreaHandler, errorStateHandler, deviceStateHandler, batteryStateHandler, cleanModeHandler (Priority 1 from refactoring-recommendations.md)
- [x] Fix multi-device polling bug — `PollingService` now uses `Map<duid, Timeout>` so each vacuum has its own interval
- [x] Fix V1PendingResponseTracker messageId collision — composite key `${duid}:${messageId}` prevents cross-device response routing
- [x] Release `1.1.5-rc08` — refactor `handleServiceAreaUpdate` into dedicated helpers
- [x] Release `1.1.5-rc07` — correct type of `selectedAreas` (`ServiceArea.Area[]` → `number[]`)
