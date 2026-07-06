# To Do

## Completed

- [x] Release candidate `1.1.7-rc04` created
- [x] Fix `ChargingError` (status code 9) to properly set `operationalError = FailedToFindChargingDock`
- [x] Investigate feature gaps (reference vs current plugin) — gaps analysis complete
- [x] Implement `src/share/featureSetDecoder.ts` — pure decoder for DeviceFeatures capability flags
- [x] Wire `hasSmartPlan` to `is_smart_clean_mode_set_supported` feature flag — SmartPlan mode 4 now dynamically gated
- [x] Wiki documentation fixes — updated 6 files to reflect feature-flag-driven architecture
- [x] Wiki gap fill — created 5 new pages (Runtime-Handlers-Pipeline, Message-Listeners-Architecture, Message-Dispatchers-Protocol-Routing, Feature-Flags-Device-Capabilities, Room-Map-Data-Pipeline); expanded 6 existing pages; updated Home.md index
- [x] Legacy V1 map parser + `legacy-map-info` CLI probe — parse Protocol 301 binary, resolve current room from robot position
- [x] V1 map inner decryption — `decryptAndUnzipV1Map` + CLI decrypt step before parse; `ClientRouter.getSerializeNonce()`
- [x] A187 legacy map parse fix — Int32LE field widths in `LegacyMapParser`; CLI fire-and-forget `getHomeMap`; live-validated on A187
- [x] Legacy map room names (CLI) — `mapListHelpers` + parallel `getMapInfo`/`getDeviceStatus` in `legacy-map-info`; shared with `map-info`
- [x] B01 currentPose/roomMatrix Phase 1 — shared decode core (`roborockProto`, `b01MapParser`, `types`), safe no-op `resolveRoomFromPose()`, `b01-pose-info` CLI for real Q10 capture
- [x] External room list R1 — Q7 `getRoomMap`/`getRoomMapV2` use `service.upload_by_maptype` (`get_room_mapping`) with `{ force: 1, map_type: 0 }`
- [x] External room list R3 — B01 `roomNameNormalizer.ts` + wired in `MapInfoListener.tryParseB01MapBinary()` for firmware-style Q10 names
- [x] Fix B01/Q10 Apple Home area icons — `roomTypeId` (not `colorId`) + dual-scheme `populateAreaNamespaceTag` (`areaType` pre-compute for B01, V10 tag switch unchanged)
- [x] B01 extended room IDs (2001–2011) — `roomTypeIdToAreaTag` switch extended per ioBroker `ROOM_TYPE_MAP`; unit + integration tests
- [x] B01 listener protocol guard — register `V1StatusListener` or `B01StatusListener` at connect time based on `device.pv`, not both; unit tests in `connectionService.test.ts`
- [x] RVC OperationCompletion (idea 1) — session tracking + `operationCompletion` Matter event on active clean/map → idle
- [x] RVC SkipArea (idea 3) — `RoborockServiceAreaServer.skipArea`, V10 `stop_segment_clean`; B01/Q7 return `InvalidInMode`
- [x] RVC currentArea + estimatedEndTime (idea 4) — `extra_time` forwarding, `computeEstimatedEndTime`, multi-room fallback
- [x] RVC extended operational states (idea 5) — `FillingWaterTank` in `stateResolver`; legacy maps in `function.ts`
- [x] Remove extra_time → estimatedEndTime wiring — deleted `computeEstimatedEndTime`, `extraTimeSeconds` message field, and v1 listener forwarding; kept idle/map-change `estimatedEndTime: null` clears
- [x] Wire estimatedEndTime from clean_time + clean_percent — V1-only opt-in ETA (`enableEstimatedEndTime`, default off); pure helper, v1 listener `clean_percent` forward, `updateCurrentAreaAndEstimate`; B01/Q7/Q10 remain `null`

## Pending

### Implementation Tasks

- [ ] **RVC estimatedEndTime real-device validation** — confirm V1 `clean_percent` tracks job progress reliably when `enableEstimatedEndTime` is on; document accuracy limits (pauses, low percent, Home display lag)
- [ ] **RVC SkipArea real-device validation** — confirm skip room on V10 multi-room clean; expect `InvalidInMode` on B01/Q7
- [ ] **RVC FillingWaterTank real-device validation** — confirm `wash_status` / `replenish_mode` disambiguation from `CleaningMop` on dock-fill robots
- [ ] **RVC SelectWhileRunning (idea 2, deferred)** — allow changing selected areas while a clean is running; out of scope for `rvc-opstate-servicearea-gaps`
- [ ] **B01/Q10 Apple Home icon validation** — confirm room category icons on real B01 or Q10 device after areaType fix (includes extended IDs 2001–2011)
- [ ] **External room list R2 (deferred per user)** — replace random `Unknown Room ####` fallback in `getSupportedAreas.ts` with deterministic `"Room {id}"` (safe, no device dependency)
- [ ] **Q7 upload_by_maptype hardware validation** — confirm R1 map fetch works on real Q7 device(s) after command switch
- [ ] **B01 currentPose Phase 2 (deferred)** — implement `roomMatrix` pixel-to-room decode once real Q10 data confirms wire layout (via `b01-pose-info`); wire into `areaManagementService`, `roborockService`, `mapInfoListener`, `serviceAreaHandler` for live multi-room `currentArea`
- [ ] **Legacy map → plugin** — wire `LegacyMapParser.resolveCurrentRoom` into runtime for V1 devices lacking `vacuumRoom` in status (replace or supplement `getRoomIdFromMap`); reuse `decryptAndUnzipV1Map` for Protocol 301 push; resolve segment names from `device.mapInfos` (not nonexistent `device.rooms`)
- [ ] **Legacy map hex fixture** — optional: capture A187 `"rr"` binary from live run for regression fixture

### Open Feature Gaps

- [ ] **Gap 1** — `selectAreas` all-selected normalization (low-medium, needs API confirmation)
- [ ] **Gap 3** — Firmware-version-aware device capability selection (low, complex; could leverage featureSetDecoder)
- [ ] **Gap 4** — `roomNames` config override for manual room name assignment (low, ready to implement when user reports)
