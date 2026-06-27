## Answers

---

## Session: Wiki domain mapping (2026-06-27)

### Q1: What is the exact startup/initialization sequence?

**`onStart()` sequence** (`src/module.ts:110-148`):

1. Awaits `this.ready` and `this.clearSelect()` (Matterbridge lifecycle helpers).
2. Initializes `NodePersist` storage at `<matterbridgePluginDirectory>/matterbridge-roborock-vacuum-plugin/persist`.
3. If `clearStorageOnStartup` is enabled → sets `startupCompleted = false` and returns early (handled by `onConfigure`).
4. If `alwaysExecuteAuthentication` is true → clears persist storage (forces re-auth).
5. Validates config via `PlatformConfigManager.validateConfig()` (checks `username` is set).
6. Calls `DeviceDiscovery.discoverDevices()`:
   - Loads or generates a `sessionId` (UUID) in persist storage.
   - Creates `RoborockService` with `RoborockAuthenticateApi` and `RoborockIoTApi` factories.
   - Authenticates via `AuthenticationCoordinator.authenticate()`.
   - If auth incomplete (e.g., 2FA waiting) → returns `false` → `onStart` aborts.
   - Calls `roborockService.listDevices()` → fetches device list from cloud.
   - Filters devices through whitelist (`isDeviceAllowed`) and supported-model check (`isSupportedDevice`).
   - If server mode disabled, keeps only `vacuums[0]`.
   - For each passing vacuum: `roborockService.initializeMessageClient(vacuum, userData)` (MQTT connect) + `registry.registerDevice(vacuum)`.
   - Returns `true`.
7. Calls `DeviceConfigurator.onConfigureDevice(roborockService)`:
   - Sets a `deviceNotify` callback on `roborockService` → routes to `PlatformRunner.updateRobotWithPayload`.
   - For each vacuum in registry: calls `configureDevice(vacuum, roborockService)`:
     - `roborockService.initializeMessageClientForLocal(vacuum)` (TCP connect to device IP).
     - If `vacuum.serialNumber` missing → fetches via MQTT `get_serial_number`.
     - Creates `RoborockVacuumCleaner` (Matterbridge endpoint) with clean modes, run modes, routines.
     - Registers `areasListener` on `AreaManagementService` (callback pushes `supportedMaps`/`supportedAreas` to Matter cluster).
     - Calls `configureBehavior(...)` → builds `BehaviorDeviceGeneric` with command handlers.
     - Calls `robot.configureHandler(behaviorHandler)` → wires Matter cluster commands to behavior.
     - Calls `addDevice(robot)` → `platform.registerDevice(rvc)` + `registry.registerRobot(rvc)`.
   - For each configured device: `roborockService.activateDeviceNotify(robot.device)` (starts local polling).
   - Calls `platformRunner.requestHomeData()` (initial cloud sync).
   - Calls `platformRunner.activateHandlerFunctions()` (enables routing of device notifications).
   - For each device: `roborockService.getMapInfo(duid)`, `getRoomMap(duid, -1)`, `startPeriodicAreaRefresh(duid)`.
8. Sets `startupCompleted = true`.

**`onConfigure()` sequence** (`src/module.ts:150-201`):

1. Calls `super.onConfigure()`.
2. If `clearStorageOnStartup` is enabled:
   - Clears persist storage.
   - Unregisters all Matterbridge devices (with delay).
   - Sends toast "restart required".
   - Writes `clearStorageOnStartup = false` back to config via `onConfigChanged`.
   - Returns early.
3. If startup did not complete → returns.
4. Calculates `intervalMs = (refreshInterval ?? 60) * 1000 + 100`.
5. Starts `setInterval` → calls `platformRunner.requestHomeData()` on every interval.
6. Calls `platformRunner.startWatchdog()` → logs stale robots (no update for >5 min).
7. Shows snackbar "Roborock Vacuum Plugin is ready".
8. If email notifications enabled → sends test email.

**`onShutdown()` sequence** (`src/module.ts:203-225`):

1. Calls `super.onShutdown(reason)`.
2. Clears the home-data polling interval.
3. Calls `burstPolling.stopAllBurstPolling()`.
4. Calls `platformRunner.stopWatchdog()`.
5. Calls `roborockService.stopService()` (tears down ServiceContainer: disconnects MQTT, local clients, clears maps).
6. If `unregisterOnShutdown` → calls `unregisterAllDevices(UNREGISTER_DEVICES_DELAY_MS)`.
7. Sets `startupCompleted = false`.

---

### Q2: What is the device command execution flow?

**From Matter cluster to wire — full chain:**

1. **Matter cluster handler** (`src/types/roborockVacuumCleaner.ts`):
   - `RoborockVacuumCleaner` extends `RoboticVacuumCleaner` (Matterbridge base).
   - Command handlers registered via `configureHandler(behaviorHandler)`:
     - `changeToMode(newMode)` → `behaviorHandler.executeCommand(CHANGE_TO_MODE, newMode)`
     - `selectAreas(newAreas)` → `behaviorHandler.executeCommand(SELECT_AREAS, areas)`
     - `pause/resume/goHome/stop` → `behaviorHandler.executeCommand(cmd)`

2. **BehaviorDeviceGeneric** (`src/behaviors/BehaviorDeviceGeneric.ts:38-47`):
   - Looks up handler in `commands` map and calls it.

3. **Command handler dispatch** (`src/share/behaviorFactory.ts`):
   - `CHANGE_TO_MODE` → looks up `activity` label via `runModeMap[newMode]` or `config.cleanModes[newMode]`, then calls `config.registry.handle(duid, newMode, activity, context)`.
   - Other commands registered via `registerCommonCommands(...)`.

4. **ModeHandlerRegistry** (`src/behaviors/roborock.vacuum/core/modeHandlerRegistry.ts`):
   - Finds first `ModeHandler` where `canHandle(mode, activity)` returns true.
   - Handlers registered in priority order: `CleaningModeHandler`, `GoVacationHandler`, `SmartPlanHandler` (if device supports it), `DefaultCleanModeHandler`, `PresetCleanModeHandler`, `CustomCleanModeHandler`.

5. **Handler → RoborockService call**:
   - `CleaningModeHandler` (activity = "Cleaning") → `roborockService.startClean(duid)` → via `MessageRoutingService.startClean(duid, { type: 'global' })`.
   - `DefaultCleanModeHandler` (clean mode change) → `roborockService.changeCleanMode(duid, setting)`.
   - `GoVacationHandler` (mode 99) → `roborockService.stopAndGoHome(duid)` → send `app_charge`.
   - For room cleaning: `CleanSelection.type === 'room'` → `startRoomCleaning(duid, roomIds, 1)`.
   - For routine: `CleanSelection.type === 'routine'` → `iotApi.startScene(routineId)` (HTTP POST to cloud).

6. **MessageRoutingService** (`src/services/messageRoutingService.ts`):
   - Holds a `Map<string, AbstractMessageDispatcher>` keyed by duid.
   - Delegates to the correct dispatcher.

7. **MessageDispatcher** (V10/Q7/Q10):
   - **V10MessageDispatcher** (`src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`):
     - `startCleaning` → `RequestMessage { method: 'app_start' }`
     - `startRoomCleaning` → `RequestMessage { method: 'app_segment_clean', params: [{ segments: roomIds, repeat }] }`
     - `goHome` → `RequestMessage { method: 'app_charge' }`
     - `pauseCleaning` → `RequestMessage { method: 'app_pause' }`
     - `resumeCleaning` → `RequestMessage { method: 'app_resume' }`
     - `stopCleaning` → `RequestMessage { method: 'app_stop' }`
     - `changeCleanMode` → `set_custom_mode`, `set_water_box_custom_mode`, `set_mop_mode` calls
   - **Q7/Q10 dispatchers** use B01 protocol-specific DPS keys instead of named RPC methods.

8. **ClientRouter.send()** (`src/roborockCommunication/routing/clientRouter.ts:89-95`):
   - If `request.secure = true` → always uses `mqttClient.send()`.
   - Otherwise → `getLocalClient(duid)` returns local TCP client if ready and not reconnecting; falls back to MQTT.

9. **Wire serialization**:
   - `AbstractClient.sendInternal` → `serializer.serialize(duid, request)` → produces encrypted binary frame.
   - Sent via TCP (local) or MQTT publish to topic `rr/m/i/{rriotU}/{mqttUsername}/{duid}`.

**CleanCommand / CleanSelection discriminated unions** (`src/model/CleanCommand.ts`):
```typescript
type CleanCommand = { type: 'routine'; routineId: number } | { type: 'room'; roomIds: number[] } | { type: 'global' };
type CleanSelection = { type: 'routine'; areaId: number } | { type: 'room'; roomId: number };
```
These are used in `MessageRoutingService.startClean()` to route to `iotApi.startScene`, `dispatcher.startRoomCleaning`, or `dispatcher.startCleaning`.

---

### Q3: What are all the clean modes and how is the "clean mode" business domain structured?

**Mode numeric IDs** (`src/behaviors/roborock.vacuum/core/cleanModeConfig/types.ts:64-84`):

| Label | Mode ID |
|---|---|
| Smart Plan | 4 |
| Vacuum & Mop: Default | 5 |
| Vacuum & Mop: Quick | 6 |
| Vacuum & Mop: Max | 7 |
| Vacuum & Mop: Min | 8 |
| Vacuum & Mop: Quiet | 9 |
| Vacuum & Mop: Energy Saving | 10 |
| Vacuum & Mop: Vac Follow by Mop | 11 |
| Vacuum & Mop: Deep | 12 |
| Mop: Default | 31 |
| Mop: Max | 32 |
| Mop: Min | 33 |
| Mop: Quick | 34 |
| Mop: Deep | 35 |
| Vacuum: Default | 66 |
| Vacuum: Max | 67 |
| Vacuum: Quiet | 68 |
| Vacuum: Quick | 69 |
| Go Vacation | 99 |

**CleanModeConfig shape** (`src/behaviors/roborock.vacuum/core/cleanModeConfig/types.ts:3-8`):
```typescript
interface CleanModeConfig {
  mode: number;
  label: string;
  setting: CleanModeSetting;  // suctionPower, waterFlow, distance_off, mopRoute, sequenceType
  modeTags: { value: number }[];  // Matter RvcCleanMode.ModeTag values
}
```

**CleanModeSetting** (`src/behaviors/roborock.vacuum/core/CleanModeSetting.ts`):
- `suctionPower`: enum `VacuumSuctionPower`
- `waterFlow`: enum `MopWaterFlow`
- `distance_off`: number
- `mopRoute`: enum `MopRoute`
- `sequenceType`: `CleanSequenceType` (Persist = 0, OneTime = 1)

**How deviceCapabilityRegistry decides modes** (`src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`):
- `getExtraModes(model, featureSet?, newFeatureSet?)`: Returns `[vacFollowedByMopModeConfig]` only if `features.is_clean_then_mop_mode_supported` (decoded from featureSet/newFeatureSet). Returns `[]` if no feature context.
- `hasSmartPlan(model, featureSet?, newFeatureSet?)`: Returns `features.is_smart_clean_mode_set_supported` (decoded from flags).
- `getAllModesForDevice(model, featureSet?, newFeatureSet?)`: Returns `[...extraModes, ...baseCleanModeConfigs]`. `baseCleanModeConfigs` = vacAndMop modes + mopOnly modes + vacuumOnly modes.

**How getSupportedCleanModes maps to Matter RvcCleanMode** (`src/initialData/getSupportedCleanModes.ts`):
- Calls `getAllModesForDevice(model, featureSet, newFeatureSet)` → gets `CleanModeConfig[]`.
- Calls `getModeOptions(configs)` → converts each to `RvcCleanMode.ModeOption { mode, label, modeTags }`.
- If `configManager.forceRunAtDefault = true` → only uses `baseCleanModeConfigs` (no extra modes).
- If `useVacationModeToSendVacuumToDock = true` → appends GoVacation mode (99).

**How cleanModeHandler applies a mode change to Matter cluster** (`src/runtimes/handlers/cleanModeHandler.ts`):
- Receives `{ suctionPower, waterFlow, distance_off, mopRoute, seq_type }` from a device status push.
- Creates a `CleanModeSetting` from these values.
- Calls `getCleanModeResolver(deviceData.model, forceRunAtDefault)` → resolves to a mode number by matching `CleanModeSetting` fields against known `CleanModeConfig.setting` entries.
- Writes `RvcCleanMode.currentMode = resolvedModeNumber` on the Matter endpoint.

---

### Q4: What is the MQTT / local-network communication domain?

**How ClientRouter decides between MQTT and local** (`src/roborockCommunication/routing/clientRouter.ts:89-128`):
- `send(duid, request)`:
  - `request.secure = true` → always `mqttClient.send()` (no local fallback).
  - `request.secure = false` → calls `getLocalClient(duid)`:
    - No local client registered → falls back to MQTT.
    - Local client exists but is `isReconnecting()` → falls back to MQTT (with log).
    - Local client exists but `!isReady()` → falls back to MQTT.
    - Otherwise → uses local TCP client.

**MQTT connection** (`src/roborockCommunication/mqtt/mqttClient.ts`):
- Broker URL comes from `userdata.rriot.r.m` (from Roborock auth API).
- `clientId` = `md5(u:k).substring(2,10)`, `username` = same, `password` = `md5(s:k).substring(16)`.
- Connects with `keepalive: 30`.
- Subscribe topic: `rr/m/o/{rriotU}/{mqttUsername}/#`
- Publish topic: `rr/m/i/{rriotU}/{mqttUsername}/{duid}`
- TLS: uses the URL scheme from `rriot.r.m` (typically `mqtts://`).
- Reconnect/keepalive: a `setInterval` at `KEEPALIVE_INTERVAL_MS` (60 min) force-ends and reconnects the MQTT client.
- Auth error handling: after 5 consecutive auth errors (code 5), enters 60-min backoff.

**Local UDP discovery** (`src/roborockCommunication/local/udpClient.ts`):
- `LocalNetworkUDPClient` listens on UDP port `58866`.
- Receives V10 (AES-128-ECB, key `qWKYcdQWrbm9hPqe`) or L01 (AES-256-GCM) broadcast messages.
- Each message deserializes to `NetworkInfo { duid, ip }`.
- Used only for B01 devices: `ConnectionService` registers a `onMessage` listener that calls `setupLocalClient(device, ip)` when a matching duid broadcast is seen.

**Local TCP client** (`src/roborockCommunication/local/localClient.ts`):
- TCP socket to device IP on port `58867`.
- On connect → sends hello (V1 or L01 protocol) to get nonce and learn the device's protocol version.
- Frames are length-prefixed (4-byte big-endian length + payload).
- Ping-pong keepalive every 5 seconds; reconnects if no ping response for 15 seconds.

**ConnectionService and ClientManager**:
- `ClientManager` (`src/services/clientManager.ts`) holds a single `ClientRouter` instance per `UserData`.
- `ConnectionService` orchestrates registration: `registerDevice` (context), `connect`, wait for MQTT, then try local.
- Sets `device.specs.hasRealTimeConnection = true` on successful MQTT connection.

**Message lifecycle**:
1. **Serialize**: `RequestMessage` → `AbstractMessageBodyBuilder.buildPayload` → JSON with DPS wrapper → `AbstractSerializer.encode` (AES encryption) → binary frame with header.
2. **Send**: MQTT publish or TCP socket write.
3. **Receive**: MQTT `onMessage` or local `onMessage` → `MessageDeserializer.deserialize`.
4. **Deserialize**: Parse header (version, seq, nonce, timestamp, protocol) → check CRC32 → decrypt payload → parse JSON `{ dps: {...}, t: timestamp }`.
5. **Dispatch**: `ResponseBroadcaster.onMessage(responseMessage)` → all registered `AbstractMessageListener` instances inspect the message.

**Reconnection**:
- MQTT: automatic library reconnect + 60-min forced reconnect interval.
- Local: ping/pong check every 5s; if no ping response for 15s → `disconnect()` + `connect()`.

---

### Q5: What is the Roborock protocol domain (wire format)?

**Message header** (all protocols, big-endian):
```
version   (3 bytes ASCII: "1.0", "A01", "B01", "L01")
seq       (uint32)
nonce     (uint32)
timestamp (uint32)
protocol  (uint16)  — maps to Protocol enum
payloadLen (uint16)
payload   (bytes)
crc32     (uint32)
```
Source: `src/roborockCommunication/protocol/deserializers/messageDeserializer.ts:42-58`

**Protocol enum** (`src/roborockCommunication/models/protocol.ts`):
- 0=hello_request, 1=hello_response, 2=ping_request, 3=ping_response
- 4=general_request, 5=general_response
- 101=rpc_request, 102=rpc_response
- 121=status_update, 122=battery, 123=suction_power, 124=water_box_mode
- 301=map_response, 500=device_status_ota

**Encryption per protocol** (serializers in `src/roborockCommunication/protocol/serializers/`):
- **V01**: AES-128-ECB. Key = `md5(encodeTimestamp(ts) + localKey + "TXdfu$jyZ#TZHsg4")` (16 bytes).
- **B01**: AES-128-CBC. IV = `md5hex(nonceHex + "5wwh9ikChRjASpMU8cxg7o1d2E").substring(9, 25)`. Key = `localKey` bytes.
- **L01**: AES-256-GCM. Key = `sha256(encodeTimestamp(ts) + localKey + SALT)`. IV = `sha256([seq, nonce, ts]).subarray(0,12)`. AAD = `[seq, connectNonce, ackNonce, nonce, ts]` (20 bytes).

**`encodeTimestamp`** (`src/roborockCommunication/helper/cryptoHelper.ts:27-30`): shuffles hex digits of timestamp at index positions `[5,6,3,7,1,2,0,4]`.

**Dispatcher names and protocol selection** (`src/roborockCommunication/protocol/dispatcher/dispatcherFactory.ts`):
- `pv = "1.0"` or `pv = "L01"` → V10MessageDispatcher
- `pv = "B01"` + model suffix `ss*` → Q10MessageDispatcher
- `pv = "B01"` + model suffix `sc*` → Q7MessageDispatcher

**DPS (data point system)** (`src/roborockCommunication/models/dps.ts`):
- `Dps` is `Record<number|string, string|DpsPayload|Buffer|Record<string,unknown>>`.
- The DPS key is the `Protocol` enum value (e.g., `102` = rpc_response).
- For V1/V10: JSON payload wraps method call under `dps: { [protocol]: JSON.stringify(data) }`.
- For Q10: each DPS key 121–135 carries individual status fields.
- For Q7: DPS key `10001` carries envelope `{ method: 'prop.get', data: { status, quantity, wind, water, fault } }`.

**MessageDeserializer flow** (`src/roborockCommunication/protocol/deserializers/messageDeserializer.ts`):
1. Parse 15-byte header.
2. Validate version in `[V1, A01, B01, L01]`.
3. If protocol is hello/ping/general_response → return without payload.
4. Parse content: payloadLen + payload + crc32.
5. Verify CRC32.
6. Decrypt payload using version-specific serializer.
7. If `rpc_response` or `general_request`: JSON-parse DPS, return `ResponseMessage`.
8. If `map_response`: return raw buffer.
9. If `device_status_ota`: JSON-parse.

---

### Q6: What is the device discovery and filtering domain?

**Fetching devices from cloud** (`src/platform/deviceDiscovery.ts`, `src/roborockCommunication/api/iotClient.ts`):
1. `RoborockService.listDevices()` → `DeviceManagementService.listDevices()`.
2. Fetches `HomeData` via `RoborockIoTApi.getHomeWithProducts(homeId)`:
   - Tries `GET user/homes/{homeId}` (v1), then `v2/...`, then `v3/...` as fallbacks.
   - For devices requiring v3 (e.g. `roborock.vacuum.ss07`) → merges v3 device list.
   - If `rooms` empty in v1 → tries v2/v3 for rooms.

**Home entity structure** (`src/roborockCommunication/models/home.ts`):
```typescript
interface Home {
  id: number;
  name: string;
  products: Product[];       // schema/model info
  devices: Device[];         // owned devices
  receivedDevices: Device[]; // shared devices
  rooms: RoomEntity[];       // named rooms from Roborock app
}
```

**Whitelist filtering** (`src/platform/platformConfigManager.ts:239-244`):
- `isDeviceAllowed({ duid })`: if `whiteList.length > 0`, only allow if duid is in array; otherwise all devices allowed. No separate blacklist.

**Unsupported model exclusion** (`src/platform/deviceDiscovery.ts:97`):
- `isSupportedDevice(device.specs.model)` checks against a known model list. Unsupported models are logged as warning and skipped.

**Server mode** (`src/platform/deviceDiscovery.ts:112-113`):
- If `enableServerMode = false` → keeps only `vacuums[0]` after filtering.

**DeviceRegistry storage** (`src/platform/deviceRegistry.ts`):
- Two `Map<string, T>` keyed by `duid`:
  - `devices` → raw `Device` objects (from cloud, registered during discovery).
  - `robots` → `RoborockVacuumCleaner` instances (Matterbridge endpoints, registered after `platform.registerDevice`).
- "device" = raw cloud data with specs, localKey, pv, scenes, etc.
- "robot" = Matterbridge endpoint exposing Matter clusters.

---

### Q7: What is the Matterbridge device registration domain?

**What a "robot" is**:
- `RoborockVacuumCleaner` extends `RoboticVacuumCleaner` from `matterbridge/devices`.
- `RoboticVacuumCleaner` is a `MatterbridgeEndpoint` subclass pre-configured with RVC device type and standard clusters.

**How deviceConfigurator creates and registers** (`src/platform/deviceConfigurator.ts:85-138`):
1. Creates `RoborockVacuumCleaner(vacuum, homeInfo, configManager, roborockService, log)`.
2. Constructor calls `getSupportedCleanModes`, `getOperationalStates`, `getRunModeOptions` for initial cluster state.
3. Registers `areasListener` for ServiceArea cluster updates.
4. Calls `configureBehavior(...)` → returns `BehaviorDeviceGeneric` with all command handlers.
5. Calls `robot.configureHandler(behaviorHandler)` → wires Matter commands to behavior.
6. Calls `addDevice(rvc)`:
   - Sets version info.
   - Applies `MatterOverrideSettings` if enabled.
   - Creates Identify cluster (5s, AudibleBeep).
   - Adds `bridgedNode` device type if missing.
   - Creates `BridgedDeviceBasicInformation` cluster.
   - Calls `platform.registerDevice(rvc)`.
   - Calls `registry.registerRobot(rvc)`.

**Matter clusters on each endpoint**:
- **RvcRunMode**: run modes (Idle, Cleaning, Mapping).
- **RvcCleanMode**: all clean mode entries.
- **RvcOperationalState**: operational state + error state. Initial = Docked.
- **PowerSource**: battery level, charge state.
- **ServiceArea**: supported areas (rooms), maps, current area, selected areas, routines.
- **BridgedDeviceBasicInformation**: serial number, vendor info, versions.
- **Identify**: audible beep.
- **Descriptor**: device type list.

**BehaviorDeviceGeneric and behaviorFactory**:
- `BehaviorDeviceGeneric<Commands>`: command registry with `setCommandHandler` + `executeCommand`.
- `configureBehavior(...)` calls `buildBehaviorConfig(model, featureSet, newFeatureSet)`:
  - Determines SmartPlan support via `hasSmartPlan(...)`.
  - Builds `ModeHandlerRegistry` with handlers in priority order.
  - Returns `BehaviorConfig { name, cleanModes, cleanSettings, runModeConfigs, registry }`.
- Registers `CHANGE_TO_MODE` and common commands (pause, resume, goHome, selectAreas, identify, stop).

**RoborockVacuumCleaner fields** (`src/types/roborockVacuumCleaner.ts`):
- `device: Device` — raw cloud device.
- `homeInFo: HomeEntity` — active map ID, room map.
- `dockStationStatus: DockStationStatus | undefined` — last dock status.
- `cleanModeSetting: CleanModeSetting | undefined` — last known clean settings.
- `lastUpdateAt: number | null` — timestamp of last real-time update (used by watchdog).

---

### Q8: What is the polling and real-time connection management domain?

**PollingService** (`src/services/pollingService.ts`):
- `activateDeviceNotifyOverLocal(device)`: `setInterval` at `refreshInterval * LOCAL_REFRESH_INTERVAL_MULTIPLIER` (1000 ms/unit → effectively `refreshInterval` seconds). Sends `get_prop ['get_status']` on each tick.
- `requestStatusOnce(duid)`: one-shot status request.

**Burst polling** (`src/platform/burstPollingManager.ts`):
- Started when `handleDeviceStatusUpdate` returns true (device entered Cleaning or Mapping).
- `setInterval` at `BURST_POLLING_INTERVAL_MS = 10000 ms` (10 seconds).
- Calls `roborockService.requestDeviceStatusOnce(duid)` on each tick.
- Stops when `operationalState` is Docked or Charging.
- Prevents double-start: checks `this.timers.has(duid)`.

**Watchdog** (`src/platformRunner.ts:26-44`):
- `setInterval` at `WATCHDOG_CHECK_INTERVAL_MS = 60_000 ms`.
- Logs an error for any robot with `lastUpdateAt < Date.now() - WATCHDOG_THRESHOLD_MS` (5 min).
- Logging only — does not trigger re-fetch itself.

**Cloud polling skip condition** (`src/platformRunner.ts:55-69`):
- `requestHomeData()` skips cloud fetch if ALL robots satisfy:
  - `device.specs.hasRealTimeConnection === true` AND
  - `robot.lastUpdateAt > Date.now() - WATCHDOG_THRESHOLD_MS`.
- If any robot fails → fetches `getHomeDataForUpdating(rrHomeId)` → dispatches `HomeData` payload.

**Real-time push vs polling fallback**:
- V1/V10: real-time push via MQTT/local TCP (`V1StatusListener`).
- B01 (Q7/Q10): real-time push via B01 DPS messages (`B01StatusListener`).
- `hasRealTimeConnection = true` set when MQTT connects.
- Cloud polling interval is the fallback for stale data.
- Local polling runs in parallel as supplemental fetch.

---

### Q9: What is the scene / routine domain?

**What Roborock scenes are** (`src/roborockCommunication/models/scene.ts`):
- `Scene { id, name, enabled, type, param, extra }`.
- `param` is a JSON string containing `SceneParam { triggers, action, matchType }`.
- `action.items: SceneItem[]` — each item has method and params (fan_power, water_box_mode, mop_mode, etc.).
- Scenes are pre-configured cleaning automation rules defined in the Roborock app.
- Distinct from rooms: rooms are physical map segments; scenes are multi-step automation routines.

**Mapping to Matter ServiceArea** (`src/initialData/getSupportedRoutines.ts`):
- Filters scenes for `enabled = true` and `name` present.
- Maps each to `ServiceArea.Area`:
  - `areaId = SCENE_AREA_ID_MIN + routine.id` (offset 5000).
  - `mapId = null` (not tied to a physical map).
  - `areaInfo.locationInfo.locationName = routine.name`.
- A special map entry `{ mapId: 999, name: 'Routine' }` groups them in the Matter map list.

**How routines are triggered**:
- When `selectAreas` is called with an area whose `areaId >= SCENE_AREA_ID_MIN`, it's a routine.
- `MessageRoutingService.startClean(duid, { type: 'routine', routineId })` → `iotApi.startScene(routineId)` (HTTP POST `user/scene/{id}/execute`).

**Scenes are read-only from the plugin**: fetched from cloud at discovery (`device.scenes`), exposed as ServiceArea areas. The plugin cannot create, edit, or delete scenes.

**Config flag**: `showRoutinesAsRoom` (`advancedFeature.settings.showRoutinesAsRoom`). Default: `false`. When true, routines are included in the initial `supportedAreaAndRoutines` and in the `areasListener` callback.

---

### Q10: What is the error handling and error reporting domain?

**VacuumErrorCode → RvcOperationalState.ErrorState mapping** (`src/model/VacuumStatus.ts`):

| VacuumErrorCode | ErrorState |
|---|---|
| LidarBlocked, CompassError, CliffSensorError, OpticalFlowSensorDirt, WallSensorDirty, CameraError, WallSensorError | NavigationSensorObscured |
| BumperStuck, RobotTrapped, RobotTilted, VerticalBumperPressed, VibrariseJammed, RobotOnCarpet | Stuck |
| WheelsSuspended, WheelsJammed | WheelsJammed |
| MainBrushJammed, SideBrushJammed, SideBrushError, ClearBrushPositioningError, MoppingRollerJammed, MoppingRollerJammed2 | BrushJammed |
| NoDustbin, StrainerError, CleanAutoEmptyDock | DustBinMissing |
| FilterBlocked | DustBinFull |
| LowBattery | LowBattery |
| ChargingError | UnableToStartOrResume |
| DockNotConnectedToPower, ReturnToDockFail, DockLocatorError | FailedToFindChargingDock |
| NogoZoneDetected, InvisibleWallDetected, CannotCrossCarpet | CannotReachTargetArea |
| InternalError, TemperatureProtection, CleanCarouselException, FanError, BatteryError, AutoEmptyDockVoltage, AudioError, MoppingRollerNotLowered, SinkStrainerHoare, CheckCleanCarouse | UnableToCompleteOperation |
| ClearWaterBoxHoare, ClearBrushInstalledProperly, FilterScreenException, UpWaterException, WaterCarriageDrop | WaterTankMissing |
| ClearWaterTankEmpty | WaterTankEmpty |
| DirtyWaterBoxHoare, DrainWaterException, CleanCarouselWaterFull | DirtyWaterTankFull |

**DockStationStatus bit-fields** (`src/model/DockStationStatus.ts`):
- Bits 0–1: `isUpdownWaterReady`
- Bits 2–3: `clearWaterBoxStatus`
- Bits 4–5: `dirtyWaterBoxStatus`
- Bits 6–7: `dustBagStatus`
- Bits 8–9: `waterBoxFilterStatus`
- Bits 10–11: `cleanFluidStatus`
- Each 2-bit field: 0=Unknown, 1=Error, 2=OK.
- `getMatterOperationalError()` priority: cleanFluid→WaterTankMissing, waterBoxFilter→WaterTankLidOpen, dustBag→DustBinFull, dirtyWaterBox→DirtyWaterTankFull, clearWaterBox→WaterTankEmpty.

**DockErrorCode → ErrorState** (`src/model/DockStationStatus.ts:88-108`):
WaterEmpty→WaterTankEmpty, DuctBlockage→DustBinFull, WasteWaterTankFull/CleaningTankFullOrBlocked→DirtyWaterTankFull, MaintenanceBrushJammed→BrushJammed, DirtyTankLatchOpen→DirtyWaterTankMissing, NoDustbin→DustBinMissing, None→NoError, default→UnableToCompleteOperation.

**errorStateHandler flow** (`src/runtimes/handlers/errorStateHandler.ts`):
1. Check `configManager.includeVacuumErrorStatus` — if disabled, skip.
2. If `vacuumErrorCode != None` → write `operationalState = Error` + `operationalError = { errorStateId }` and return.
3. If vacuum is `Running` with no error → clear `operationalError` to `NoError` and return.
4. Check `configManager.includeDockStationStatus`.
5. If `dockStationStatus` present → `parseDockStationStatus(dss)`: write Error or clear to NoError.
6. If `dockErrorCode != None` → `parseDockErrorCode(code)` → write accordingly.
7. Otherwise → clear to `NoError`.

**Error surfacing to users**:
- Errors written to Matter `RvcOperationalState` cluster → visible in Apple Home / any Matter controller.
- Logs at `warn` level.
- `EmailNotificationService` (`src/services/emailNotificationService.ts`): nodemailer, fires on `DisconnectNotificationListener` events (MQTT/local disconnects). Test email sent at startup if enabled.

---

### Q11: What is the configuration domain?

**Top-level config sections** (`src/model/RoborockPluginPlatformConfig.ts`):

**`authentication`**: `username`, `region` (US/EU/CN/RU), `forceAuthentication`, `authenticationMethod` (VerificationCode/Password), `verificationCode`, `password`.

**`pluginConfiguration`**: `whiteList` (string[]), `enableServerMode`, `enableMultipleMap`, `sanitizeSensitiveLogs`, `refreshInterval` (default 60s), `debug`, `unregisterOnShutdown`.

**`advancedFeature.settings`** (all gated by `enableAdvancedFeature`):
- `clearStorageOnStartup`: wipe persist + re-register devices.
- `showRoutinesAsRoom`: expose Roborock scenes as ServiceArea rooms.
- `includeDockStationStatus`: surface dock errors as Matter errors.
- `includeVacuumErrorStatus`: surface vacuum errors as Matter errors.
- `forceRunAtDefault`: use only base clean modes (ignore device-specific modes).
- `useVacationModeToSendVacuumToDock`: expose GoVacation mode (99) → sends to dock.
- `enableCleanModeMapping`: use custom mode parameter overrides.
- `cleanModeSettings`: per-category overrides (`CleanModeSettings`).
- `overrideMatterConfiguration`: apply custom Matter identity.
- `matterOverrideSettings`: `MatterOverrideSettings`.
- `enableEmailNotification`: enable email alerts.
- `emailNotificationSettings`: SMTP settings.
- `enableLiveMapUpdates`: use live push map updates.

**MatterOverrideSettings** (`src/model/RoborockPluginPlatformConfig.ts:63-69`):
`matterVendorName`, `matterVendorId`, `matterProductName`, `matterProductId`, `deviceProductNames: DeviceProductNameOverride[]` (per-device product names keyed by serialNumber).

**CleanModeSettings** (`src/model/RoborockPluginPlatformConfig.ts:71-93`):
- `vacuuming: { fanMode, mopRouteMode }`
- `mopping: { waterFlowMode, mopRouteMode, distanceOff }`
- `vacmop: { fanMode, waterFlowMode, mopRouteMode, distanceOff }`

**EmailNotificationSettings**: `smtpHost`, `smtpPort` (587), `smtpSecure` (false), `smtpUser`, `smtpPassword`, `recipient`.

**PlatformConfigManager** (`src/platform/platformConfigManager.ts`):
- `create(config, log)` factory — applies defaults: `whiteList ??= []`, `advancedFeature ??= createDefaultAdvancedFeature()`.
- `validateConfig()` checks `username` present. `validateAuthentication()` checks credentials.
- All advanced settings gated behind `isAdvancedFeatureEnabled`.
- `isDeviceAllowed({ duid })`: whitelist logic.
- No runtime JSON schema validation — config is cast in `module.ts:31`.

**JSON schema file**: `matterbridge-roborock-vacuum-plugin.schema.json` (project root). Used by Matterbridge UI. Uses JSON Schema `if/then` for `authenticationMethod` branching. Advanced features gated by `enableAdvancedFeature` boolean via `allOf if/then` blocks.

**`clearStorageOnStartup`**: when true at `onConfigure`, clears all persisted data, unregisters all Matter devices, resets the flag to `false`, requests a restart. Forces full re-discovery from scratch.

---

### Q12: What is the CLI tool domain?

**Full command list** (`src/cli/main.ts`):

| Command | Purpose |
|---|---|
| `login` | Interactive: email + 2FA code → authenticate → save session |
| `devices` | List all devices in saved session |
| `status` | Get current device status |
| `start` | Start cleaning |
| `stop` | Stop cleaning |
| `pause` | Pause cleaning |
| `resume` | Resume cleaning |
| `ping` | Send ping to device |
| `room-info` | List rooms and IDs |
| `map-info` | List maps |
| `clean-mode` | Get current clean mode settings |
| `network-info` | Get device network info (IP, MAC, WiFi) |
| `scenes` | List Roborock scenes/routines |
| `custom` | Send arbitrary RPC method (fire-and-forget or query) |

**How CLI authenticates** (`src/cli/commands/login.ts`):
- Directly instantiates `RoborockAuthenticateApi` → `requestCodeV4(email)` → `loginWithCodeV4(email, code)`.
- Does NOT reuse `AuthenticationService` or `AuthenticationCoordinator` — its own direct path.
- Only supports 2FA (verification code), not password auth.

**How CLI connects** (`src/cli/connection.ts:33-65`):
- Reuses `ClientRouter` directly: creates instance, registers device, connects MQTT.
- Waits for connection by polling `isReady() && isConnected()` every 200ms up to 10s.
- Creates dispatcher via `MessageDispatcherFactory`.
- If `--local` flag: fetches device IP via `getNetworkInfo`, registers local client.

**Session file** (`src/cli/types.ts`):
- File: `.cli-session.json` in project root.
- Contents: `{ email, userData: UserData, devices: Device[] }`.
- `UserData` contains `rriot` (MQTT credentials, API URLs) and auth tokens.

**Primary use case**: developer/debugging tool. Allows direct interaction with a Roborock device without running the full Matterbridge plugin.

---

### Q13: Are there any other business areas not yet covered?

**`src/initialData/` — additional fetchers**:
- `getBatteryStatus.ts`: `getBatteryStatus(pct)` → `PowerSource.BatChargeLevel` (Ok ≥70%, Warning ≥40%, Critical <40%). `getBatteryState(state, pct)` → charge state.
- `getSupportedRunModes.ts`: `getRunningMode(modeTag)` → finds run mode number from `baseRunModeConfigs` by ModeTag.
- `getOperationalStates.ts`: `getOperationalStates()` → full list of `RvcOperationalState.OperationalStateStruct` for cluster init. Also provides DSS error mapping helpers.
- `regionUrls.ts`: maps region string to base API URL.

**`src/share/stateResolver.ts`** — State Resolution Matrix:
- `resolveDeviceState(message: StatusChangeMessage) → ResolvedState { runMode, operationalState, operationalError? }`.
- Implements 48-row priority matrix:
  1. **Status Override Rules** (highest): Sleeping, Idle, InError, ChargingError, EmptyingDustContainer, WashingTheMop, GoingToWashTheMop, Mapping → fixed states ignoring all modifiers.
  2. **Cleaning Status Special Overrides**: when status = any cleaning variant, `isLocating/isExploring` → UpdatingMaps; `inWarmup` → CleaningMop; `inReturning` → SeekingCharger.
  3. **Modifier Priority Chain**: `inReturning` → SeekingCharger (unless Paused/ReturnToDock/ReturningDock); `isExploring` → Mapping run mode; `inFreshState` (Charging only) → Idle/Docked.
- Not used for B01/Q10 devices (which use direct status mapping in `B01StatusListener`).

**`src/share/matterStateNames.ts`** — Display name utilities:
- `getRunModeName`, `getOperationalStateName`, `getCleanModeName`, `getOperationalErrorName`, `getRunModeNameV2` — pure lookup functions for human-readable names in logs.
- `getAllKnownModeConfigs()` called at module load time (static).

**`src/share/filterLogger.ts`** — Sensitive data filtering:
- `FilterLogger` wraps an `AnsiLogger` delegate.
- On each `log()` call: applies `sensitiveDataRegexReplacements` (from `src/constants/sensitiveDataRegexReplacements.ts`) to the message and all parameters.
- Controlled by `sanitizeSensitiveLogs` config flag.

**`src/runtimes/handleCloudMessage.ts`**: entirely commented out / deprecated. Was the old DPS message handler. No longer active.

**`src/runtimes/handleLocalMessage.ts`**: Contains only `triggerDssError(robot, platform)` — sets dock station error state. Used by `errorStateHandler`.

**`src/roborockCommunication/models/dockInfo.ts`**: `DockInfo` class wraps a `DockType` enum value. No methods beyond constructor. Placeholder for future dock-type-specific logic.

**ServiceContainer / dependency injection domain** (not previously covered):
- `ServiceContainer` wires all services: `ClientManager`, `MessageRoutingService`, `AreaManagementService`, `ConnectionService`, `PollingService`, `DeviceManagementService`, `AuthenticationCoordinator`.
- `RoborockService` is a facade over `ServiceContainer`.
- `synchronizeMessageClients()` propagates `ClientRouter` to dependent services after new connections.

---

## Existing Docs Reference

The wiki writer should reference these docs rather than re-document:

- `docs/authentication-flow.md`: Full mermaid flowchart (password + 2FA paths, token caching, rate limiting).
- `docs/status-update-flow.md`: Full diagram (V1/B01 push paths, handler→notify bridge, PlatformRunner dispatch, watchdog, burst polling).
- `docs/room-map-sync-flow.md`: Full diagram (map init, query-response vs live push, MapInfoListener, area update, active map change).

---

## Confidence

- Q1–Q3, Q6–Q11: High — all key files read directly.
- Q4–Q5: High — MQTT, local, serializers, deserializer all read.
- Q9 (routine trigger): High — call chain traced through MessageRoutingService; CleanSelection union types confirmed.
- Q12: High — main.ts, session.ts, connection.ts, login.ts all read.
- Q13: High — handleCloudMessage.ts is entirely commented out (confirmed). DockInfo is a thin wrapper (confirmed).

## Status

answered (wiki domains session, 2026-06-27)

---

## Session: Remove DEVICE_EXTRA_MODES / featureSet-driven clean modes (2026-06-27)

### Q1: Exact content of DEVICE_EXTRA_MODES and full bodies of getExtraModes / getAllModesForDevice

File: `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`

**DEVICE_EXTRA_MODES** (lines 28–33):

```typescript
export const DEVICE_EXTRA_MODES: Partial<Record<string, CleanModeConfig[]>> = {
    [DeviceModel.QREVO_EDGE_5V1]: [smartPlanModeConfig, vacFollowedByMopModeConfig],
    [DeviceModel.QREVO_PLUS]:     [smartPlanModeConfig, vacFollowedByMopModeConfig],
    [DeviceModel.QREVO_MAXV]:     [smartPlanModeConfig, vacFollowedByMopModeConfig],
    [DeviceModel.Q10_S5_PLUS]:    [vacFollowedByMopModeConfig, vacAndMopDeepModeConfig],
};
```

Four models total. Three carry SmartPlan + VacFollowedByMop; one carries VacFollowedByMop + VacAndMopDeep.

**getExtraModes** (lines 41–56):

```typescript
export function getExtraModes(model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[] {
    const staticModes = DEVICE_EXTRA_MODES[model] ?? [];
    const hasFeatureContext = featureSet !== undefined || newFeatureSet !== undefined;

    if (!hasFeatureContext) {
        return staticModes;
    }

    const features = decodeFeatureSet(featureSet, newFeatureSet);
    return staticModes.filter((config) => {
        if (config.mode === vacFollowedByMopModeConfig.mode) {
            return features.is_clean_then_mop_mode_supported;
        }
        return true; // Smart Plan, VacAndMopDeep — static only, always pass through
    });
}
```

When called without feature args: returns `DEVICE_EXTRA_MODES[model] ?? []` unchanged. When called with feature args: decodes flags and filters out VacFollowedByMop (mode 11) if `is_clean_then_mop_mode_supported` is false; SmartPlan (mode 4) and VacAndMopDeep (mode 12) always pass through unconditionally.

**getAllModesForDevice** (lines 70–72):

```typescript
export function getAllModesForDevice(model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[] {
    return [...getExtraModes(model, featureSet, newFeatureSet), ...baseCleanModeConfigs];
}
```

Prepends extra modes before base modes. Extra modes come first in the returned array.

**getAllKnownModeConfigs** (lines 78–87) — also reads DEVICE_EXTRA_MODES:

```typescript
export function getAllKnownModeConfigs(): CleanModeConfig[] {
    const allExtra = (Object.values(DEVICE_EXTRA_MODES) as CleanModeConfig[][]).flat();
    const uniqueByMode = new Map<number, CleanModeConfig>();
    for (const config of [...allExtra, ...baseCleanModeConfigs]) {
        if (!uniqueByMode.has(config.mode)) {
            uniqueByMode.set(config.mode, config);
        }
    }
    return [...uniqueByMode.values()];
}
```

Iterates all values of DEVICE_EXTRA_MODES, flattens, deduplicates by mode number, appends base modes. Called from `matterStateNames.ts` at module level for name lookup — no model/feature context.

---

### Q2: All exported CleanModeConfig names, their files, and numeric mode values

**Special configs** — File: `src/behaviors/roborock.vacuum/core/cleanModeConfig/special.ts`

| Export name                  | Mode number | Label                               |
| ---------------------------- | ----------- | ----------------------------------- |
| `smartPlanModeConfig`        | 4           | `'Smart Plan'`                      |
| `vacFollowedByMopModeConfig` | 11          | `'Vacuum & Mop: Vac Follow by Mop'` |
| `vacAndMopDeepModeConfig`    | 12          | `'Vacuum & Mop: Deep'`              |

Mode numbers sourced from `CleanModeLabelInfo` in `src/behaviors/roborock.vacuum/core/cleanModeConfig/types.ts` (lines 64–84):

```
SmartPlan → mode 4
VacFollowedByMop (VacFollowedByMop enum value) → mode 11
VacuumAndMopDeep → mode 12
```

All other modes live in `vacuumAndMop.ts`, `mopOnly.ts`, and `vacuumOnly.ts` and are assembled into `baseCleanModeConfigs` in `index.ts` (lines 14–18). The three configs above are the only ones in `DEVICE_EXTRA_MODES`; they are NOT in `baseCleanModeConfigs`.

Note: `smartCleanModeConfigs` (index.ts lines 20–24) includes `smartPlanModeConfig` and `vacFollowedByMopModeConfig` plus all base modes — but this export is not used by `DEVICE_EXTRA_MODES` or any call sites found; it appears unused or legacy.

---

### Q3: DeviceFeatures flags corresponding to each mode

File: `src/share/featureSetDecoder.ts`

- **Smart Plan (mode 4)**: No corresponding flag. No property in `DeviceFeatures` groups A–G is named `is_smart_plan_supported` or any semantic equivalent. The python-roborock library gates Smart Plan via model whitelist/blacklist (Group F), which always decodes to `false` in `decodeFeatureSet` because that data is not available from home-data alone.

- **VacFollowedByMop (mode 11)**: `is_clean_then_mop_mode_supported` — Group D, `extractNibbleBit(hexStr, 93)` (line 527 of featureSetDecoder.ts). This is already implemented and in use — `getExtraModes` already gates mode 11 on this flag when featureSet/newFeatureSet are provided.

- **VacAndMopDeep (mode 12)**: No corresponding flag. No property in `DeviceFeatures` directly maps to this mode. Thematically adjacent flags (`is_carpet_deep_clean_supported` Group C mask 8, `is_clean_route_deep_slow_plus_supported` Group C mask 16777216) describe route/carpet settings, not a specific combined vac+mop deep clean mode.

---

### Q4: Full call chain from device init to registry

**Chain A — behaviorConfig path:**

1. `src/platform/deviceConfigurator.ts:117–128` — `configureDevice(vacuum: Device, ...)` calls:
   ```typescript
   configureBehavior(
       vacuum.specs.model,
       vacuum.duid,
       roborockService,
       ...,
       vacuum.featureSet,      // passed
       vacuum.newFeatureSet,   // passed
   )
   ```
2. `src/share/behaviorFactory.ts:31` — `configureBehavior(...)` calls:
   ```typescript
   const config = buildBehaviorConfig(modelKey, featureSet, newFeatureSet);
   ```
3. `src/behaviors/roborock.vacuum/core/behaviorConfig.ts:44–45` — `buildBehaviorConfig(model, featureSet?, newFeatureSet?)` calls:
   ```typescript
   const withSmartPlan = hasSmartPlan(model);           // no feature args
   const allModes = getAllModesForDevice(model, featureSet, newFeatureSet);
   ```
   Note: `hasSmartPlan` is called without feature args (static lookup only).

**Chain B — getSupportedCleanModes path:**

1. `src/types/roborockVacuumCleaner.ts:144–149` — `initializeDeviceConfiguration(device: Device, ...)` calls:
   ```typescript
   const cleanModes = getSupportedCleanModes(
       device.specs.model,
       configManager,
       device.featureSet,      // passed
       device.newFeatureSet,   // passed
   );
   ```
2. `src/initialData/getSupportedCleanModes.ts:25` — `getSupportedCleanModes(model, configManager, featureSet?, newFeatureSet?)` calls:
   ```typescript
   const supportedModes = getModeOptions(getAllModesForDevice(model, featureSet, newFeatureSet));
   ```

**decodeFeatureSet import:**

- Imported in `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts:2`:
  ```typescript
  import { decodeFeatureSet } from '../../../share/featureSetDecoder.js';
  ```
- Called inside `getExtraModes` at line 49 — only when `featureSet !== undefined || newFeatureSet !== undefined`.
- Signature: `export function decodeFeatureSet(featureSet?: string, newFeatureSet?: string): DeviceFeatures`

---

### Q5: Full hasSmartPlan body and what it reads from

File: `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts:61–63`

```typescript
export function hasSmartPlan(model: string): boolean {
    return getExtraModes(model).some((c) => c.label === CleanModeDisplayLabel.SmartPlan);
}
```

It calls `getExtraModes(model)` with NO featureSet or newFeatureSet arguments. This means it takes the `!hasFeatureContext` branch in `getExtraModes` and returns `DEVICE_EXTRA_MODES[model] ?? []` unfiltered. It reads exclusively from `DEVICE_EXTRA_MODES` — not from any feature flag, not from any other data structure.

Consequence for the task: If `DEVICE_EXTRA_MODES` is removed, `hasSmartPlan` must be replaced with a feature-flag-based check or a separate static model set. Since no flag exists for Smart Plan, a separate static set (or inline model check) would be needed to preserve the SmartPlanHandler registration in `buildBehaviorConfig`.

`hasSmartPlan` is called in `behaviorConfig.ts:44` only — no other callers in the codebase.

---

### Q6: Test files referencing DEVICE_EXTRA_MODES, getExtraModes, getAllModesForDevice, or hasSmartPlan

Search result: **No matches found** in `src/tests/`.

None of the four symbols (`DEVICE_EXTRA_MODES`, `getExtraModes`, `getAllModesForDevice`, `hasSmartPlan`) are referenced in any test file. There are no tests to update or break when these symbols change.

---

## Confidence

- Q1: High — read directly from source, lines 28–87.
- Q2: High — all three special configs read directly from `special.ts` and cross-checked against `CleanModeLabelInfo` in `types.ts`.
- Q3: High on VacFollowedByMop (is_clean_then_mop_mode_supported is already wired). High confidence that Smart Plan and VacAndMopDeep have no flag — no matching property found across all 7 groups of DeviceFeatures.
- Q4: High — all four call sites traced with exact line numbers.
- Q5: High — function body is 3 lines, behavior is unambiguous.
- Q6: High — grep returned no matches.

## Status

answered

---

## Previous session answers (featureSetDecoder implementation research)

### Q1: Complete `NewFeatureStrBit` enum entries

All members of `NewFeatureStrBit(IntEnum)` from `/Volumes/ExternalSSD/code/references/python-roborock/roborock/device_features.py:10–88`:

| Name                                 | Value                                            |
| ------------------------------------ | ------------------------------------------------ |
| TWO_KEY_REAL_TIME_VIDEO              | 32                                               |
| TWO_KEY_RTV_IN_CHARGING              | 33                                               |
| DIRTY_REPLENISH_CLEAN                | 34                                               |
| AUTO_DELIVERY_FIELD_IN_GLOBAL_STATUS | 35                                               |
| AVOID_COLLISION_MODE                 | 36                                               |
| VOICE_CONTROL                        | 37                                               |
| NEW_ENDPOINT                         | 38                                               |
| PUMPING_WATER                        | 39                                               |
| CORNER_MOP_STRETCH                   | 40                                               |
| HOT_WASH_TOWEL                       | 41                                               |
| FLOOR_DIR_CLEAN_ANY_TIME             | 42                                               |
| PET_SUPPLIES_DEEP_CLEAN              | 43                                               |
| MOP_SHAKE_WATER_MAX                  | 45                                               |
| EXACT_CUSTOM_MODE                    | 47                                               |
| VIDEO_PATROL                         | 48                                               |
| CARPET_CUSTOM_CLEAN                  | 49                                               |
| PET_SNAPSHOT                         | 50                                               |
| CUSTOM_CLEAN_MODE_COUNT              | 51                                               |
| NEW_AI_RECOGNITION                   | 52                                               |
| AUTO_COLLECTION_2                    | 53                                               |
| RIGHT_BRUSH_STRETCH                  | 54                                               |
| SMART_CLEAN_MODE_SET                 | 55                                               |
| DIRTY_OBJECT_DETECT                  | 56                                               |
| NO_NEED_CARPET_PRESS_SET             | 57                                               |
| VOICE_CONTROL_LED                    | 58                                               |
| WATER_LEAK_CHECK                     | 60                                               |
| MIN_BATTERY_15_TO_CLEAN_TASK         | 62                                               |
| GAP_DEEP_CLEAN                       | 63                                               |
| OBJECT_DETECT_CHECK                  | 64                                               |
| IDENTIFY_ROOM                        | 66                                               |
| MATTER                               | 67                                               |
| WORKDAY_HOLIDAY                      | 69                                               |
| CLEAN_DIRECT_STATUS                  | 70                                               |
| MAP_ERASER                           | 71                                               |
| OPTIMIZE_BATTERY                     | 72                                               |
| ACTIVATE_VIDEO_CHARGING_AND_STANDBY  | 73                                               |
| CARPET_LONG_HAIRED                   | 75                                               |
| CLEAN_HISTORY_TIME_LINE              | 76                                               |
| MAX_ZONE_OPENED                      | 77                                               |
| EXHIBITION_FUNCTION                  | 78                                               |
| LDS_LIFTING                          | 79                                               |
| AUTO_TEAR_DOWN_MOP                   | 80                                               |
| SMALL_SIDE_MOP                       | 81                                               |
| SUPPORT_SIDE_BRUSH_UP_DOWN           | 82                                               |
| DRY_INTERVAL_TIMER                   | 83                                               |
| UVC_STERILIZE                        | 84                                               |
| MIDWAY_BACK_TO_DOCK                  | 85                                               |
| SUPPORT_MAIN_BRUSH_UP_DOWN           | 86                                               |
| EGG_DANCE_MODE                       | 87                                               |
| MECHANICAL_ARM_MODE                  | 89                                               |
| TIDYUP_ZONES                         | 89 (alias: `TIDYUP_ZONES = MECHANICAL_ARM_MODE`) |
| CLEAN_TIME_LINE                      | 91                                               |
| CLEAN_THEN_MOP_MODE                  | 93                                               |
| TYPE_IDENTIFY                        | 94                                               |
| SUPPORT_GET_PARTICULAR_STATUS        | 96                                               |
| THREE_D_MAPPING_INNER_TEST           | 97                                               |
| SYNC_SERVER_NAME                     | 98                                               |
| SHOULD_SHOW_ARM_OVER_LOAD            | 99                                               |
| COLLECT_DUST_COUNT_SHOW              | 100                                              |
| SUPPORT_API_APP_STOP_GRASP           | 101                                              |
| CTM_WITH_REPEAT                      | 102                                              |
| SIDE_BRUSH_LIFT_CARPET               | 104                                              |
| DETECT_WIRE_CARPET                   | 105                                              |
| WATER_SLIDE_MODE                     | 106                                              |
| SOAK_AND_WASH                        | 107                                              |
| CLEAN_EFFICIENCY                     | 108                                              |
| BACK_WASH_NEW_SMART                  | 109                                              |
| DUAL_BAND_WI_FI                      | 110                                              |
| PROGRAM_MODE                         | 111                                              |
| CLEAN_FLUID_DELIVERY                 | 112                                              |
| CARPET_LONG_HAIRED_EX                | 113                                              |
| OVER_SEA_CTM                         | 114                                              |
| FULL_DUPLES_SWITCH                   | 115                                              |
| LOW_AREA_ACCESS                      | 116                                              |
| FOLLOW_LOW_OBS                       | 117                                              |
| TWO_GEARS_NO_COLLISION               | 118                                              |
| CARPET_SHAPE_TYPE                    | 119                                              |
| SR_MAP                               | 120                                              |

Notes:

- Integer values 44, 46, 59, 61, 65, 68, 74, 88, 90, 92, 95, 103 have no enum member assigned (gaps in the sequence).
- `TIDYUP_ZONES` is declared as `TIDYUP_ZONES = MECHANICAL_ARM_MODE` — both resolve to 89 at runtime.

---

## Session: Investigation — forceRunAtDefault Application in Clean Mode Resolution (2026-06-27)

### Q1: Where is `forceRunAtDefault` read and what does it do?

**Primary read location:** `src/platform/platformConfigManager.ts:158–159`

```typescript
public get forceRunAtDefault(): boolean {
    return this.isAdvancedFeatureEnabled && this.advancedFeatureSettings.forceRunAtDefault;
}
```

The setting is defined in `src/model/RoborockPluginPlatformConfig.ts:47` as a boolean field in the `AdvancedFeatureSetting` interface and defaults to `false` (line 103).

**What `forceRunAtDefault = true` does:**

1. **Neutralizes device model key** (`src/share/behaviorFactory.ts:30`):
   - When true: `const modelKey = forceRunAtDefault ? '' : model;`
   - Empty model key bypasses device-specific behavior configurations

2. **Forces default mode resolver** (`src/share/runtimeHelper.ts:17–20`):
   - Returns the global `defaultModeResolver` (based on `baseCleanModeConfigs` only)
   - When false: creates a device-specific resolver via `getAllModesForDevice(key)` and `hasSmartPlan(key)`

3. **Restricts advertised clean modes** (`src/initialData/getSupportedCleanModes.ts:21–23`):
   - When true: returns only `defaultModes` (from `baseCleanModeConfigs`)
   - When false: returns device model-specific modes via `getAllModesForDevice(model, featureSet, newFeatureSet)`

4. **Bypasses device-specific smart plan support** (`src/share/runtimeHelper.ts:18–19`):
   - When true: skips `hasSmartPlan(key)` check, always uses `defaultModeResolver`
   - When false: calls `createSmartModeResolver` if `hasSmartPlan` returns true

---

### Q2: Trace the clean mode resolution path — which functions resolve the active clean mode, and does `forceRunAtDefault` appear?

**Full clean mode resolution chain:**

**Phase 1: Device Initialization & Behavior Configuration** (`src/platform/deviceConfigurator.ts:117–128`)

```typescript
const behaviorHandler = configureBehavior(
    vacuum.specs.model,
    vacuum.duid,
    roborockService,
    this.configManager.isCustomCleanModeMappingEnabled,
    this.configManager.cleanModeSettings,
    this.configManager.forceRunAtDefault,  // ← First read
    this.log,
    () => this.getPlatformRunner().burstPolling.startBurstPolling(vacuum.duid),
    vacuum.featureSet,
    vacuum.newFeatureSet,
);
```

**Phase 2: Behavior Configuration Decision** (`src/share/behaviorFactory.ts:30–31`)

```typescript
const modelKey = forceRunAtDefault ? '' : model;  // ← First decision point
const config = buildBehaviorConfig(modelKey, featureSet, newFeatureSet);
```

**Phase 3: Behavior Config Building** (`src/behaviors/roborock.vacuum/core/behaviorConfig.ts:44–45`)

```typescript
const withSmartPlan = hasSmartPlan(model, featureSet, newFeatureSet);
const allModes = getAllModesForDevice(model, featureSet, newFeatureSet);
```

Note: When `forceRunAtDefault=true`, `model` is empty string; mode registry is built with limited modes.

**Phase 4: Supported Modes Advertisement** (`src/initialData/getSupportedCleanModes.ts:21–26`)

```typescript
if (configManager.forceRunAtDefault) {
    return getDefaultSupportedCleanModes(configManager, [...defaultModes]);  // ← Second direct check
}

const supportedModes = getModeOptions(getAllModesForDevice(model, featureSet, newFeatureSet));
return getDefaultSupportedCleanModes(configManager, supportedModes);
```

**Phase 5: Runtime Mode Resolution** ← **Active during vacuum operations** (`src/runtimes/handlers/cleanModeHandler.ts:34–36`)

When device reports clean mode settings:

```typescript
const forceRunAtDefault = platform.configManager.forceRunAtDefault;  // ← Third read
const currentCleanModeResolver = getCleanModeResolver(deviceData.model, forceRunAtDefault);
const currentCleanMode = currentCleanModeResolver.resolve(currentCleanModeSetting);
```

**Phase 6: Mode Resolver Selection** (`src/share/runtimeHelper.ts:17–30`)

Final decision point:

```typescript
export function getCleanModeResolver(model: DeviceModel, forceRunAtDefault: boolean): ModeResolver {
    if (forceRunAtDefault) {
        return defaultModeResolver;  // ← Second decision point (line 19)
    }

    const key = model as string;
    if (!resolverCache.has(key)) {
        const modes = getAllModesForDevice(key);  // ← Note: NO feature sets passed
        const resolver = hasSmartPlan(key) ? createSmartModeResolver(modes) : createDefaultModeResolver(modes);
        resolverCache.set(key, resolver);
    }

    return resolverCache.get(key) as ModeResolver;
}
```

**Answer:** `forceRunAtDefault` IS present in all critical stages:

- ✓ Device initialization pass-through (deviceConfigurator.ts:123)
- ✓ Behavior config model key determination (behaviorFactory.ts:30)
- ✓ Supported modes filtering (getSupportedCleanModes.ts:21)
- ✓ Runtime mode resolution (cleanModeHandler.ts:34–35)
- ✓ Resolver selection (runtimeHelper.ts:18–19)

---

### Q3: Is there any code path where `forceRunAtDefault` is ignored or bypassed?

**Critical Finding: Feature-Set-Based Extra Modes Create a Behavioral Inconsistency**

There is a **subtle mismatch** in how feature-set-based extra modes (e.g., `vacFollowedByMopModeConfig`) are handled:

**In behavior config building** (`src/share/behaviorFactory.ts:30–31` → `buildBehaviorConfig`):

- Feature sets ARE passed through to `buildBehaviorConfig` regardless of `forceRunAtDefault`:
  ```typescript
  const config = buildBehaviorConfig(modelKey, featureSet, newFeatureSet);
  ```
- Inside `buildBehaviorConfig:44–45`:
  ```typescript
  const withSmartPlan = hasSmartPlan(model, featureSet, newFeatureSet);
  const allModes = getAllModesForDevice(model, featureSet, newFeatureSet);
  ```
- `getAllModesForDevice` → `getExtraModes` (src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts:4–13) INCLUDES feature-based extra modes:
  ```typescript
  export function getExtraModes(_model: string, featureSet?: string, newFeatureSet?: string): CleanModeConfig[] {
      const hasFeatureContext = featureSet !== undefined || newFeatureSet !== undefined;
      if (!hasFeatureContext) {
          return [];
      }
      const features = decodeFeatureSet(featureSet, newFeatureSet);
      return features.is_clean_then_mop_mode_supported ? [vacFollowedByMopModeConfig] : [];
  }
  ```

**In supported modes filtering** (`src/initialData/getSupportedCleanModes.ts:21–26`):

- When `forceRunAtDefault = true`, feature sets are NOT consulted:
  ```typescript
  if (configManager.forceRunAtDefault) {
      return getDefaultSupportedCleanModes(configManager, [...defaultModes]);
  }
  ```
- Feature-based extra modes are EXCLUDED from the advertised supported modes list

**In runtime mode resolution** (`src/share/runtimeHelper.ts:17–30`):

- `getCleanModeResolver()` does NOT receive feature sets in its signature
- Function only receives `model` and `forceRunAtDefault`
- Calls `getAllModesForDevice(key)` WITHOUT feature set parameters (line 24):
  ```typescript
  const modes = getAllModesForDevice(key);  // No featureSet, newFeatureSet
  ```
- Therefore, feature-based extra modes cannot be resolved at runtime

**Result:**

1. When `forceRunAtDefault = true`, the `buildBehavior Config` call may still include feature-based extra modes (because featureSets are passed through)
2. However, at runtime when resolving the ACTUAL clean mode, `getCleanModeResolver` cannot access those feature sets
3. The advertised supported modes also exclude feature-based modes when `forceRunAtDefault = true`

**This is NOT a bypass of `forceRunAtDefault` logic itself, but rather:**

- An architectural limitation: feature sets are not threaded to runtime resolver
- A potential inconsistency: behavior config may include feature modes, but runtime resolver cannot use them
- The `forceRunAtDefault` setting IS correctly applied in all control flow paths

---

## Confidence

**High confidence on main findings:**

- `forceRunAtDefault` is correctly read and applied across initialization and runtime paths
- It directly controls resolver selection at the critical runtime resolution point (runtimeHelper.ts:18–19)
- The setting gates access to both supported modes and active mode resolution

**Feature-set limitation is confirmed:**

- `getCleanModeResolver()` signature lacks feature set parameters
- Feature-based extra modes require feature set context to be included
- Separation of concerns: feature sets passed to config-time but not runtime

## Status

answered
