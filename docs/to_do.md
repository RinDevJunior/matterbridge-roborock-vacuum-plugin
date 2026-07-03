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

## Pending

### Implementation Tasks

- [ ] **External room list R2 (deferred per user)** — replace random `Unknown Room ####` fallback in `getSupportedAreas.ts` with deterministic `"Room {id}"` (safe, no device dependency)
- [ ] **Q7 upload_by_maptype hardware validation** — confirm R1 map fetch works on real Q7 device(s) after command switch
- [ ] **B01 currentPose Phase 2 (deferred)** — implement `roomMatrix` pixel-to-room decode once real Q10 data confirms wire layout (via `b01-pose-info`); wire into `areaManagementService`, `roborockService`, `mapInfoListener`, `serviceAreaHandler` for live multi-room `currentArea`
- [ ] **Legacy map → plugin** — wire `LegacyMapParser.resolveCurrentRoom` into runtime for V1 devices lacking `vacuumRoom` in status (replace or supplement `getRoomIdFromMap`); reuse `decryptAndUnzipV1Map` for Protocol 301 push; resolve segment names from `device.mapInfos` (not nonexistent `device.rooms`)
- [ ] **Legacy map hex fixture** — optional: capture A187 `"rr"` binary from live run for regression fixture

### Open Feature Gaps

- [ ] **Gap 1** — `selectAreas` all-selected normalization (low-medium, needs API confirmation)
- [ ] **Gap 3** — Firmware-version-aware device capability selection (low, complex; could leverage featureSetDecoder)
- [ ] **Gap 4** — `roomNames` config override for manual room name assignment (low, ready to implement when user reports)
