# Status Update Flow

Describes how device status (state, battery, clean mode, errors) is received, normalized, and pushed to Matter clusters.

---

## Overview

Two independent sources feed status updates:

```
Real-time push (MQTT / local UDP)          Cloud polling (fallback / watchdog)
        │                                           │
  V1StatusListener                         requestHomeData()
  B01StatusListener                                │
        │                                   updateFromHomeData()
  AbstractMessageHandler                           │
  (SimpleMessageHandler)                           │
        │                                           │
        └──────────────────────────────────────────┘
                           │
                  PlatformRunner.updateRobotWithPayload()
                           │
            ┌──────────────┼──────────────────┐
       ErrorOccurred  DeviceStatus      BatteryUpdate  CleanModeUpdate  ServiceAreaUpdate
            │              │                  │               │                │
     errorStateHandler  deviceStateHandler  batteryHandler  cleanModeHandler  serviceAreaHandler
            │              │                  │               │                │
                      Matter cluster attributes (RvcRunMode, RvcOperationalState, PowerSource, …)
```

---

## 1. Real-time Push Path

### 1a. V1 Protocol (`V1StatusListener`)

Triggered by any MQTT/local message at `Protocol.rpc_response` or `Protocol.general_request`.

Steps:

1. Checks for `Protocol.additional_props` — if present, immediately re-fires `getDeviceStatus()` to force a full state refresh, then returns.
2. Parses `DeviceStatus` from `rpcData.result[0]`.
3. Extracts fields:
   - `state` → `OperationStatusCode`
   - `battery`, `charge_status` → battery info
   - `fan_power`, `water_box_mode`, `distance_off`, `mop_mode`, `seq_type` → clean mode
   - `cleaning_info`, `clean_area`, `clean_time` → service area / progress
   - `error_code`, `dock_error_status`, `dock_station_status` → errors
   - `map_status` → active map (bits 2–7 = map flag; `63` means no active map)
4. Calls handler methods in order:
   - `handler.onError` (if any error code ≠ 0)
   - `handler.onActiveMapChanged` (if map_status present and valid)
   - `handler.onBatteryUpdate`
   - `handler.onStatusChanged`
   - `handler.onCleanModeUpdate`
   - `handler.onServiceAreaUpdate`

### 1b. Q10 / B01 Protocol (`B01StatusListener.tryHandleQ10Push`)

Q10 sends individual DPS keys per property update:

| DPS key | Field           | Conversion                        |
| ------- | --------------- | --------------------------------- |
| 121     | state           | direct `OperationStatusCode`      |
| 122     | battery         | direct percentage                 |
| 125     | charge_status   | direct                            |
| 126     | error_code      | direct                            |
| 123     | fan_power       | `wire + 100` → V1 range (101–108) |
| 124     | water_box_mode  | `wire + 200` → V1 range (200–203) |
| 133     | clean_area      | direct                            |
| 134     | clean_time      | direct                            |
| 135     | clean_task_type | direct                            |

Each key is handled independently — a single message may contain only one changed field. State is accumulated (`lastState`, `lastBattery`, etc.) so composite messages like `BatteryMessage` always carry full context.

### 1c. Q7 / B01 Protocol (`B01StatusListener.tryHandleQ7Response`)

Q7 sends a JSON envelope at `DPS key 10001` with `method: 'prop.get'` or `'prop.post'`:

```json
{ "method": "prop.get", "data": { "status": 5, "quantity": 80, "wind": 3, "water": 2, "fault": 0 } }
```

Field conversions:

| Q7 field                | Conversion                                              |
| ----------------------- | ------------------------------------------------------- |
| `status`                | direct `OperationStatusCode`                            |
| `quantity`              | battery percentage                                      |
| `fault`                 | error code                                              |
| `wind` (1–5)            | V1 suction: 1→101, 2→102, 3→103, 4→104, 5→108, else→105 |
| `water` (1–3)           | V1 water: `wire + 200`                                  |
| `clean_path_preference` | mop route                                               |
| `cleaning_area`         | `× 100` (Q7 unit is m², V1 is cm²)                      |
| `cleaning_time`         | `× 60` (Q7 unit is minutes, V1 is seconds)              |

---

## 2. Handler → Notify Bridge (`SimpleMessageHandler`)

`SimpleMessageHandler` implements `AbstractMessageHandler` and wraps each handler call into a `NotifyMessageTypes` payload, then calls the `deviceNotify` callback:

| Handler method        | Notify type         |
| --------------------- | ------------------- |
| `onError`             | `ErrorOccurred`     |
| `onBatteryUpdate`     | `BatteryUpdate`     |
| `onStatusChanged`     | `DeviceStatus`      |
| `onCleanModeUpdate`   | `CleanModeUpdate`   |
| `onServiceAreaUpdate` | `ServiceAreaUpdate` |
| `onActiveMapChanged`  | `ActiveMapChanged`  |

---

## 3. PlatformRunner Dispatch

`PlatformRunner.updateRobotWithPayload` routes each payload to the appropriate handler:

### `DeviceStatus` → `handleDeviceStatusUpdate`

1. Checks dock station error — if present, triggers DSS error path instead.
2. Calls `resolveDeviceState(message)` — maps `OperationStatusCode` to `(RvcRunMode.ModeTag, RvcOperationalState.OperationalState)`.
3. Skips update if device is still `Charging` and new state is `Docked` (let battery handler do the transition when full).
4. Writes `RvcRunMode.currentMode` and `RvcOperationalState.operationalState`.
5. Returns `true` (should burst poll) if new run mode is `Cleaning` or `Mapping`.

### `DeviceStatusSimple` → `handleDeviceStatusSimpleUpdate`

- Lightweight version used by cloud polling path.
- Maps `OperationStatusCode` directly with `state_to_matter_state` / `state_to_matter_operational_status`.
- Does not trigger burst polling.

### `BatteryUpdate` → `handleBatteryUpdate`

- Writes `PowerSource.batPercentRemaining`.
- Manages `Charging` → `Docked` transition when battery reaches 100%.

### `ErrorOccurred` → `handleErrorOccurred`

- Maps `VacuumErrorCode` to `RvcOperationalState.ErrorState` via lookup table (see `VacuumStatus`).
- Writes `RvcOperationalState.operationalState = Error` and `operationalError`.

### `CleanModeUpdate` → `handleCleanModeUpdate`

- Updates vacuum-specific clean mode cluster attributes (suction power, water flow, mop route).

### `ServiceAreaUpdate` → `handleServiceAreaUpdate`

- See [room-map-sync-flow.md](./room-map-sync-flow.md) §6.

### `ActiveMapChanged` → `handleActiveMapChanged`

- See [room-map-sync-flow.md](./room-map-sync-flow.md) §5.

### `HomeData` → `updateFromHomeData`

- Dispatches `ErrorOccurred`, `BatteryUpdate`, `CleanModeUpdate` unconditionally.
- Dispatches `DeviceStatusSimple` only if the device has no real-time connection OR its `lastUpdateAt` is stale (older than `WATCHDOG_THRESHOLD_MS`).

---

## 4. Cloud Polling / Watchdog

`PlatformRunner.requestHomeData` is called on a periodic timer.

**Skip condition:** all registered devices satisfy both:

- `device.specs.hasRealTimeConnection === true`
- `robot.lastUpdateAt > Date.now() - WATCHDOG_THRESHOLD_MS`

If any device fails either condition, the full home data is fetched from the cloud and processed via `updateFromHomeData`.

`hasRealTimeConnection` is set to `true` in `ConnectionService` when a device establishes a local or MQTT connection.

---

## 5. Burst Polling

When `handleDeviceStatusUpdate` returns `true` (device entered Cleaning or Mapping), `PlatformRunner` starts `BurstPollingManager` for that device. This polls status at a higher frequency until the device returns to idle, capturing fine-grained progress updates that real-time push may not deliver quickly enough.
