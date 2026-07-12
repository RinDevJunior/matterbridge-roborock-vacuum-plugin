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
- [x] Fix startup room names getRoomMap overwrite — `enrichMapRoomDtoFromMapInfo` preserves `map_info` names when `get_room_mapping` raw tuples lack `iot_name`; `HomeEntity` uses `storedMapInfo`

## Pending

### Implementation Tasks

- [x] **Fix B01/Q10 map parser for Roborock Q10 S5+ (protocol 301, LZ4)** — added marker-byte classifier to route Q10 unencrypted LZ4 payloads to new decompressor/parser; Q7 AES+zlib path untouched; best-effort room-name extraction based on python-roborock reference; live-validated via `b01-map-parser-test` CLI on real Q10 S5+ (10 rooms decoded successfully, see issue #136)
- [x] **Fix ServiceArea validation crash on B01 map parse** — added buildPlaceholderSupportedMaps() helper to backfill supportedMaps from computed areas' distinct mapIds when toSupportedMaps() returns empty; 4 new regression tests; live-validated on Q10 S5+ (0 validation errors, 10 real rooms correctly populated)
- [x] **Clean all rooms from Apple Home (SelectAreas([]))** — populate selectedAreas with all rooms of active map on empty input; trySwitchMap reachability fix to prevent V10/V1 unguarded switchMap RPC exposure
- [x] **Ponytail audit cleanup cycles 1–2 (completed)** — consolidated into history; see claude_history.md entries for 2026-07-07
- [x] **RVC per-area estimatedTime + DirectModeChange** — computeAreaEstimatedTime helper, buildProgressUpdate export & extension, RVC Clean Mode Cluster override; 45 tests across 3 files all passing
- [x] **Claude setup token/cost audit (2026-07-09)** — memory.md pruned to caps (+ wiki/memory-archive.md), briefer merged into architect, LSP/serena removed from subagents, plugin trims (ponytail/pyright/github/code-simplifier off per-project), documenter/wiki-manager Bash fix, complexity boundary widened
- [x] **DirectModeChange featureSet gating investigation (2026-07-10)** — no real featureSet/newFeatureSet bit maps to "mid-clean mode change"; `is_support_custom_mode_in_cleaning`/`is_clean_direct_status_supported` are decode-only, unreferenced anywhere in this repo or python-roborock; kept unconditional declaration, no code change
- [x] **Fix Matter ChangeToMode(Idle) no-effect bug** — added IdleModeHandler to ModeHandlerRegistry for both DefaultBehavior and BehaviorSmart; 25 new tests, all passing
- [x] **Fix global clean selectedAreas empty-input bug (Bug A, rc09/rc10)** — ~~added updateAttribute call in SELECT_AREAS handler~~ **[SUPERSEDED]** earlier fix did not work (race condition; base class overwrites milliseconds later). Root cause: MatterbridgeServiceAreaServer.selectAreas() unconditionally calls super.selectAreas(request) with original empty request after command handler runs. Real fix: new selectAreas override in roborockServiceAreaServer.ts resolves empty input to all-rooms list via resolveAllRoomsForActiveMap(), forwards resolved list to super.selectAreas() so base class's internal write succeeds. Simplified SELECT_AREAS handler to unconditional forward.
- [x] **Q10 S5+ map parser real-device validation** — confirmed via `b01-map-parser-test` CLI against real Q10 S5+: 10/10 rooms decoded, valid mapId; 2 minor follow-ups reported on issue #136 (3 room names returned as untranslated raw keys instead of resolved names; CLI tool's 6s wait timeout is too short for the device's ~60s push interval, needs several retries)
- [x] **Q10 "trace/path" secondary payload variant** — implemented b01Q10TraceParser.ts (10-byte header, session counter, big-endian int16 point pairs, stray-leading-point filter); wired into b01MapParser before Q7 fallthrough; last point populates B01MapInfo.currentPose; live-validated on Roborock Q10 S5+ (8 invocations, zero crashes, zero "incorrect header check" errors)
- [ ] **buildCleanCommand room collapse investigation (Bug B)** — app_start command sent without room list when "all rooms" selected; may relate to currentArea freeze symptom during global clean; marked for future investigation
- [ ] **Q10 S5+ battery reading investigation (postponed 2026-07-11)** — user reports incorrect battery capacity shown for Q10 S5+ (B01). Diagnosis so far (see `workspace/investigate-battery-capacity-q10/answer.md`): NO scaling/DPS-key bug found — bootstrap read, live V1 listener, and live B01/Q10 listener all read DPS 122 as a plain 0-100 percentage; the `*2` conversion to Matter's half-percent unit (`batteryStateHandler.ts:21`) happens exactly once and is the only write site for `batPercentRemaining`; no `batCapacity` (mAh) attribute exists anywhere in the plugin. Leading concern instead: B01/Q10 live battery updates depend entirely on an MQTT push or a local-poll request/reply round-trip (`pollingService.ts`); poll failures are only logged, never retried (`pollingService.ts:32-34`) — if pushes/replies stop after the initial bootstrap read, the Matter attribute could silently freeze on a stale value indefinitely. The available log capture (~54s) was too short to prove this reproduces — no poll cycle even completed in that window. Open questions to resolve when resumed: (1) get a longer debug-level log (10+ min) spanning a real battery change, check for recurring "Handling battery update" lines; (2) confirm user's `refreshInterval` config and local-network vs MQTT-only mode (`hasRealTimeConnection` took ~20s to flip true in the sample capture); (3) ask whether restarting the plugin makes the value jump to a new number then get stuck again (would confirm silent live-update failure vs. a fully broken path).
- [ ] **ChangeToMode(Mapping) support investigation** — deferred after confirming no dispatcher command exists across V1-protocol devices to trigger mapping run; roborock-gitlab reference repo not checked (not in allowlist) — revisit if user requests Mapping support later
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
- [ ] **Startup room name real-device validation** — confirm all rooms show real names (not "Room 1"–"Room 4") on V10 after plugin/Matterbridge restart
- [ ] **MapInfoListener room name enrichment (deferred)** — apply same `enrichMapRoomDtoFromMapInfo` on push/listener path if generic placeholders appear after live map updates

### Open Feature Gaps

- [ ] **Gap 1** — `selectAreas` all-selected normalization (low-medium, needs API confirmation)
- [ ] **Gap 3** — Firmware-version-aware device capability selection (low, complex; could leverage featureSetDecoder)
- [ ] **Gap 4** — `roomNames` config override for manual room name assignment (low, ready to implement when user reports)
