# Room / Map Sync Flow

Describes how map and room data is fetched, parsed, and pushed to the Matter `ServiceArea` cluster.

---

## Overview

```
DeviceConfigurator
  └─ onConfigure → getMapInfo / getRoomMap (per device)
        │
        ├─ V10 (FF off) ──────► client.query (waits for response)
        │                              │
        │                        MapInfoListener (V1 path)
        │
        └─ V10 (FF on) / Q7 / Q10 ──► client.send (fire-and-forget)
                                              │
                                        MapInfoListener (B01 / V1 push path)
                                              │
                                    AreaManagementService
                                    setSupportedAreas / setSupportedMaps
                                              │
                                    areasListener callback
                                              │
                                    ServiceArea cluster attributes updated
```

---

## 1. Initialization (`DeviceConfigurator.onConfigureDevice`)

After all devices are configured:

1. Registers an `areasListener` on `AreaManagementService` per device — this callback fires whenever areas/maps change and immediately pushes `supportedMaps`, `supportedAreas` to the Matter `ServiceArea` cluster.
2. Calls `roborockService.getMapInfo(duid)` and `roborockService.getRoomMap(duid, -1)` to trigger the initial fetch.
3. Starts a periodic refresh timer (`startPeriodicAreaRefresh`) — defaults to every 5 minutes, re-triggers `getMapInfo`.

---

## 2. Request Path (`AreaManagementService`)

`getMapInfo` and `getRoomMap` decide between two paths based on:

```ts
const useLive = this.liveMapUpdates || !dispatcher.supportsMapQueryResponse;
```

| Protocol | `supportsMapQueryResponse` | FF off | FF on |
|----------|--------------------------|--------|-------|
| V10      | `true`                   | query-response (inline) | live (push) |
| Q7       | `false`                  | live (push) | live (push) |
| Q10      | `false`                  | live (push) | live (push) |

**Query-response path (V10, FF off):**
- Sends `get_multi_maps_list` / `get_room_mapping` via `client.query`.
- Response is parsed inline and returned directly.
- `AreaManagementService` processes the result and calls `setSupportedMaps` / `setSupportedAreas`.

**Live (fire-and-forget) path:**
- Sends `getMapInfoV2` / `getRoomMapV2` via `client.send` — no return value.
- Device pushes the response asynchronously; `MapInfoListener` handles it.

---

## 3. Push Listener (`MapInfoListener`)

Registered per-device in `ConnectionService` when the device connects. Handles all incoming push messages for map/room data.

### V1 protocol (`tryParseV1MapInfo`, `tryParseV1RoomMap`)
- Reads `Protocol.rpc_response` or `Protocol.general_response` DPS payload.
- If result is a `MultipleMapDto` → builds `MapInfo`, maps rooms via `HomeModelMapper`.
- If result is `RawRoomMappingData` → builds `RoomMap` from raw array entries.

### Q10 / B01 multimap (`tryParseB01MapInfo`)
- Reads `Q10RequestCode.multimap` DPS key.
- Extracts map list from `raw.data`, builds `MapInfo`, calls `areaService.setSupportedMaps`.
- Stores as `pendingB01MapInfo` — rooms arrive separately in the binary map.

### Q7 / B01 query response (`tryParseB01RoomMap`)
- Reads `Q7RequestCode.query_response` DPS key.
- Parses JSON envelope; expects `method === 'service.get_map_list'`.
- Extracts `map_list`, builds `MapInfo`, calls `areaService.setSupportedMaps`.
- Fires `onActiveMapChanged` if a map is marked `cur: true`.

### B01 map binary (`tryParseB01MapBinary`)
- Reads `Protocol.map_response` DPS key (binary buffer).
- Skipped for V1 protocol devices.
- Decrypts using device model short-code and serial number via `B01MapParser`.
- Extracts room IDs, color IDs, and names; combines with `pendingB01MapInfo` (map list from prior push).
- Calls `updateAreas` with the combined `RoomMap` + `MapInfo`.
- Fires `onActiveMapChanged` if map ID is embedded in the binary.

---

## 4. Area Update (`MapInfoListener.updateAreas`)

```
RoomMap + MapInfo
  └─ getSupportedAreas(homeEntity)
        ├─ areaService.setSupportedAreaIndexMap  ← used for cleaning state → currentArea resolution
        ├─ areaService.setSupportedMaps
        └─ areaService.setSupportedAreas  ← fires areasListener callback
```

`setSupportedAreas` triggers the `areasListener` registered in step 1, which pushes:
- `supportedMaps` to Matter `ServiceArea`
- `supportedAreas` to Matter `ServiceArea`
- resets `currentArea` to `null`

---

## 5. Active Map Change (`serviceAreaHandler.handleActiveMapChanged`)

Triggered when `onActiveMapChanged` fires (from `MapInfoListener`):
- Filters `supportedAreas` for areas belonging to the new `mapId`.
- Sets `selectedAreas` to all area IDs on that map.
- Sets `currentArea` to `null`.

---

## 6. Cleaning State → `currentArea` (`serviceAreaHandler.handleServiceAreaUpdate`)

When a status push arrives during cleaning:
- **Idle**: restores `selectedAreas` from service, clears `currentArea`.
- **Cleaning, no `cleaningInfo`**: infers current area from previously selected areas and clean progress counters.
- **Cleaning with `cleaningInfo`**: resolves `segment_id` → `areaId` via `RoomIndexMap`, sets `currentArea`.
