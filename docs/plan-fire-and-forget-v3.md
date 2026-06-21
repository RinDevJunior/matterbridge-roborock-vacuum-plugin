# Fire-and-Forget v3: Reactive Map / Room Data Pipeline

## Context

After v2, all `client.get()` calls were removed. However `getRoomMap()` / `getMapInfo()` still block `configureDevice` — either via `client.query()` (V10) or returning empty stubs (Q10/Q7).

| Dispatcher             | Protocol | Method       | Current state                                                  |
| ---------------------- | -------- | ------------ | -------------------------------------------------------------- |
| `V10MessageDispatcher` | V1       | `getMapInfo` | `client.query()` — blocks startup, times out if device is slow |
| `V10MessageDispatcher` | V1       | `getRoomMap` | `client.query()` — blocks startup, times out if device is slow |
| `Q10MessageDispatcher` | B01      | `getMapInfo` | `client.send()` → stub returns empty `MapInfo`                 |
| `Q10MessageDispatcher` | B01      | `getRoomMap` | `client.send()` → stub returns `[]`                            |
| `Q7MessageDispatcher`  | B01      | `getMapInfo` | `client.send()` → stub returns empty `MapInfo`                 |
| `Q7MessageDispatcher`  | B01      | `getRoomMap` | `client.send()` → stub returns `[]`                            |

**Goal:** Unified reactive approach across all protocols — fire requests at startup, return immediately, populate `AreaManagementService` when the push response arrives. `handleServiceAreaUpdate` already reads from `AreaManagementService` and degrades gracefully when data is not yet available.

---

## Architecture

```
BEFORE (blocking)
─────────────────────────────────────────────────────────
configureDevice
  → RoomMap.fromMapInfo()
      → await getRoomMap()      ← blocks up to 10s
      → await getMapInfo()      ← blocks up to 10s
  → getSupportedAreas(homeInfo) → AreaManagementService.set*(...)
  → addDevice

AFTER (reactive)
─────────────────────────────────────────────────────────
configureDevice
  → RoomMap.fromMapInfo()
      → send getRoomMap()       ← fire and return
      → send getMapInfo()       ← fire and return
  → addDevice (empty AreaManagementService, device live immediately)

[device push arrives asynchronously]
  → MapInfoListener.onMessage()
      → parse push response → RoomMap + MapInfo
      → AreaManagementService.setSupportedAreaIndexMap(duid, indexMap)
      → AreaManagementService.setSupportedAreas(duid, areas)

handleServiceAreaUpdate (already correct)
  → getSupportedAreasIndexMap(duid)  ← returns undefined if not yet populated
  → if undefined → early return (existing guard, line 103–107)
  → if populated → resolve room area normally
```

`HomeEntity` does **not** need to be mutated — it is used only during initial setup to seed `AreaManagementService`. After that, `AreaManagementService` is the runtime source of truth, and `handleServiceAreaUpdate` already reads from it.

---

## Tasks

### Task 1 — Convert V10 `getMapInfo()` and `getRoomMap()` to fire-and-forget

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`

Drop `client.query()` — fire and return empty immediately, consistent with Q10/Q7.

```typescript
// BEFORE
public async getMapInfo(duid: string): Promise<MapInfo> {
    const request = new RequestMessage({ method: 'get_multi_maps_list' });
    const response = await this.client.query<MultipleMapDto>(...);
    return new MapInfo(response ?? { ... });
}

public async getRoomMap(duid: string, _activeMap: number): Promise<RawRoomMappingData> {
    const request = new RequestMessage({ method: 'get_room_mapping' });
    const response = await this.client.query<RawRoomMappingData>(...);
    return response ?? [];
}

// AFTER
public async getMapInfo(duid: string): Promise<MapInfo> {
    await this.client.send(duid, new RequestMessage({ method: 'get_multi_maps_list' }));
    return new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
}

public async getRoomMap(duid: string, _activeMap: number): Promise<RawRoomMappingData> {
    await this.client.send(duid, new RequestMessage({ method: 'get_room_mapping' }));
    return [];
}
```

Remove now-unused imports (`MultipleMapDto`, `Protocol`, `DpsPayload`) if no longer referenced elsewhere in the file.

**Definition of Done:**

- [ ] Both methods call `client.send()` and return empty immediately
- [ ] No unused imports remain
- [ ] `npm run type-check` exits 0

---

### Task 2 — Rewrite `RoomMap.fromMapInfo()` to fire-and-forget

**File:** `src/core/application/models/RoomMap.ts`

The method currently awaits responses. Convert to fire requests and return `void`.

```typescript
// AFTER
public static async fromMapInfo(vacuum: Device, context: MapInfoPlatformContext): Promise<void> {
    if (!context.roborockService) {
        context.log.error('Roborock service not initialized');
        return;
    }
    await context.roborockService.getMapInfo(vacuum.duid);
    await context.roborockService.getRoomMap(vacuum.duid, -1);
}
```

**`deviceConfigurator.ts` change** — `fromMapInfo` no longer returns data; construct `HomeEntity` with empty values:

```typescript
// BEFORE
const { activeMapId, mapInfo, roomMap } = await RoomMap.fromMapInfo(vacuum, { roborockService, log: this.log });
const homeInfo = new HomeEntity(homeData.id, homeData.name, roomMap, mapInfo, activeMapId);

// AFTER
await RoomMap.fromMapInfo(vacuum, { roborockService, log: this.log });
const homeInfo = new HomeEntity(homeData.id, homeData.name, RoomMap.empty(), MapInfo.empty(), 0);
```

Verify `MapInfo.empty()` exists or add it as a static factory returning the zero-value dto. Remove `MapInfoResult` interface if now unused.

**Definition of Done:**

- [ ] `fromMapInfo` returns `Promise<void>`
- [ ] `deviceConfigurator` constructs `HomeEntity` with empty room map / map info
- [ ] `MapInfoResult` type removed or updated
- [ ] `npm run type-check` exits 0

---

### Task 3 — Create `MapInfoListener`

**New file:** `src/roborockCommunication/routing/listeners/implementation/mapInfoListener.ts`

A per-device listener that catches map info and room map push responses and updates `AreaManagementService` directly.

```typescript
export class MapInfoListener implements AbstractMessageListener {
    readonly name = 'MapInfoListener';

    constructor(
        public readonly duid: string,
        private readonly rooms: Room[],         // from homeData.rooms, for name mapping
        private readonly areaService: AreaManagementService,
        private readonly logger: AnsiLogger,
    ) {}

    public async onMessage(message: ResponseMessage): Promise<void> {
        if (message.duid !== this.duid) return;
        this.tryParseV1MapInfo(message);
        this.tryParseV1RoomMap(message);
        this.tryParseB01MapInfo(message);
        this.tryParseB01RoomMap(message);
    }

    private tryParseV1MapInfo(message: ResponseMessage): void {
        // Protocol.rpc_response / general_response, method 'get_multi_maps_list'
        // → build MapInfo → update activeMapId on HomeEntity if needed
    }

    private tryParseV1RoomMap(message: ResponseMessage): void {
        // Protocol.rpc_response / general_response, method 'get_room_mapping'
        // → build RoomMap → buildAndPushAreas()
    }

    private tryParseB01MapInfo(message: ResponseMessage): void {
        // msg.body.data[Q10RequestCode.multimap] for Q10
        // msg.body.data[Q7RequestCode.query_response].method === 'service.get_map_list' for Q7
    }

    private tryParseB01RoomMap(message: ResponseMessage): void {
        // msg.body.data[Q10RequestCode.get_prop] for Q10 (DPS code unverified — TODO)
        // msg.body.data[Q7RequestCode.query_response].method === 'service.get_preference' for Q7
    }

    private buildAndPushAreas(roomMap: RoomMap): void {
        // Convert RoomMap → RoomIndexMap + ServiceArea.Area[]
        // Call areaService.setSupportedAreaIndexMap(this.duid, indexMap)
        // Call areaService.setSupportedAreas(this.duid, areas)
        this.logger.debug(`[${this.duid}] Room map updated reactively (${roomMap.rooms.length} rooms)`);
    }
}
```

**Note on Q10 `get_prop` (999):** DPS code is marked `// TODO: Verify` in `Q10RequestCode`. Implement with a guard and a debug log when the key is seen so it can be confirmed from real device logs.

**Definition of Done:**

- [ ] Implements `AbstractMessageListener`
- [ ] Handles V1 (rpc_response), B01-Q10 (flat DPS), B01-Q7 (query_response envelope)
- [ ] On match: calls `areaService.setSupportedAreaIndexMap` + `setSupportedAreas`
- [ ] `npm run type-check` exits 0

---

### Task 4 — Wire `MapInfoListener` into the robot lifecycle

**File:** `src/platform/deviceConfigurator.ts`

After constructing the robot, create and register a `MapInfoListener`:

```typescript
const mapInfoListener = new MapInfoListener(
    vacuum.duid,
    vacuum.store.homeData.rooms,
    this.getPlatformRunner().areaManagementService,  // or however the service is accessed
    this.log,
);
roborockService.registerListener(vacuum.duid, mapInfoListener);
```

The listener stays registered for the device lifetime — subsequent map changes (e.g. user switches active map in the Roborock app) will also update `AreaManagementService` automatically.

**Definition of Done:**

- [ ] `MapInfoListener` registered per device after `configureDevice`
- [ ] `AreaManagementService` updated when push arrives
- [ ] `npm run type-check` exits 0

---

### Task 5 — Verify `handleServiceAreaUpdate` guard and log level

**File:** `src/runtimes/handlers/serviceAreaHandler.ts`

The existing guard in `resolveAreaFromCleaningInfo` (lines 103–107) already handles the empty case:

```typescript
const roomIndexMap = platform.roborockService?.getSupportedAreasIndexMap(robot.device.duid);
if (!roomIndexMap || !platform.roborockService) {
    logger.debug('Room map not yet available, skipping room area resolution');
    return;
}
```

Confirm:

- Log is `debug` not `error` — empty room map during startup is expected, not an error
- No `currentArea` or `selectedAreas` update is attempted when room map is empty

**Definition of Done:**

- [ ] Log level is `debug`
- [ ] `npm run type-check` exits 0

---

## Dependency Order

```
Task 1 (V10 fire-and-forget)     ← independent
Task 2 (fromMapInfo void)         ← depends on Task 1 (build must pass)
Task 3 (MapInfoListener)          ← independent
Task 4 (wire listener)            ← depends on Task 3
Task 5 (serviceAreaHandler guard) ← independent
```

Recommended order: **1 → 2 → 3 → 4 → 5**

---

## Verification

After each task:

```
npm run type-check   # must exit 0
npm test             # all tests must pass
```

End-to-end: plugin starts, all devices added immediately with empty area map, `AreaManagementService` populates when map/room push arrives (visible in debug logs), `handleServiceAreaUpdate` resolves rooms correctly once populated.

---

## Files Changed

| File                                                  | Action                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| `protocol/dispatcher/V10MessageDispatcher.ts`         | `getMapInfo` + `getRoomMap` → `client.send()` + empty return                 |
| `core/application/models/RoomMap.ts`                  | `fromMapInfo` → `Promise<void>`, fire only                                   |
| `platform/deviceConfigurator.ts`                      | Construct `HomeEntity` with empty data, register `MapInfoListener`           |
| `routing/listeners/implementation/mapInfoListener.ts` | **CREATE** — reactive map/room push handler, updates `AreaManagementService` |
| `runtimes/handlers/serviceAreaHandler.ts`             | Verify log level on empty room map guard                                     |

---

## Known Unknowns

| Unknown                                       | Risk                                     | Mitigation                                                                |
| --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------- |
| Q10 `get_prop` DPS code (999) is unverified   | Room map never populates for Q10 devices | Log raw push on key 999 match; verify from device log                     |
| Q10/Q7 push response field shape for map data | `parseFn` extracts wrong field           | Log raw payload on first match for verification                           |
| Multiple map scenario (user switches map)     | Active map ID stale on `HomeEntity`      | Update `robot.homeInFo.activeMapId` in `MapInfoListener` on map info push |
