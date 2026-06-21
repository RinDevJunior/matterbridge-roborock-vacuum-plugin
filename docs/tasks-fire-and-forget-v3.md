# Fire-and-Forget v3: Task Breakdown

Reference: `docs/plan-fire-and-forget-v3.md`

---

## Task 1 — Convert `getMapInfo()` and `getRoomMap()` to `Promise<void>` across the full chain

The return type change cascades through five layers. Do all in one step so TypeScript guides the fixes.

### 1.1 — Update `abstractMessageDispatcher.ts` interface

**File:** `src/roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.ts`

```typescript
// BEFORE
getMapInfo(duid: string): Promise<MapInfo>;
getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData>;

// AFTER
getMapInfo(duid: string): Promise<void>;
getRoomMap(duid: string, activeMap: number): Promise<void>;
```

Remove `MapInfo` and `RawRoomMappingData` imports if no longer used in the interface file.

### 1.2 — Update `V10MessageDispatcher.ts`

**File:** `src/roborockCommunication/protocol/dispatcher/V10MessageDispatcher.ts`

```typescript
// BEFORE (lines 70–90)
public async getMapInfo(duid: string): Promise<MapInfo> { ... client.query ... }
public async getRoomMap(duid: string, _activeMap: number): Promise<RawRoomMappingData> { ... client.query ... }

// AFTER
public async getMapInfo(duid: string): Promise<void> {
    await this.client.send(duid, new RequestMessage({ method: 'get_multi_maps_list' }));
}

public async getRoomMap(duid: string, _activeMap: number): Promise<void> {
    await this.client.send(duid, new RequestMessage({ method: 'get_room_mapping' }));
}
```

Remove `MultipleMapDto` import (line 7) — only used by the old `getMapInfo`.
`Protocol`, `DpsPayload`, `parseV1Result` remain — still used by `getNetworkInfo`, `getSerialNumber`, `getHomeMap`, `getCustomMessage`.

### 1.3 — Update `Q10MessageDispatcher.ts`

**File:** `src/roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.ts`

```typescript
public async getMapInfo(duid: string): Promise<void> {
    const request = new RequestMessage({
        messageId: this.messageId,
        dps: { [Q10RequestCode.common_request]: { [Q10RequestMethod.multimap]: { 'op': 'list' } } },
    });
    await this.client.send(duid, request);
}

public async getRoomMap(duid: string, _activeMap: number): Promise<void> {
    await this.client.send(
        duid,
        new RequestMessage({ messageId: this.messageId, dps: { [Q10RequestCode.get_prop]: 1 } }),
    );
}
```

### 1.4 — Update `Q7MessageDispatcher.ts`

**File:** `src/roborockCommunication/protocol/dispatcher/Q7MessageDispatcher.ts`

```typescript
public async getMapInfo(duid: string): Promise<void> {
    await this.client.send(
        duid,
        new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.get_map_list, {}) }),
    );
}

public async getRoomMap(duid: string, activeMap: number): Promise<void> {
    await this.client.send(
        duid,
        new RequestMessage({
            messageId: this.messageId,
            dps: this.createDps(Q7RequestMethod.get_room_mapping_backup_1, { map_id: activeMap, prefer_type: 1 }),
        }),
    );
}
```

### 1.5 — Update `messageRoutingService.ts`

**File:** `src/services/messageRoutingService.ts`

```typescript
// BEFORE
public getMapInfo(duid: string): Promise<MapInfo> { ... }
public getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> { ... }

// AFTER
public getMapInfo(duid: string): Promise<void> {
    return this.getMessageDispatcher(duid).getMapInfo(duid);
}
public getRoomMap(duid: string, activeMap: number): Promise<void> {
    return this.getMessageDispatcher(duid).getRoomMap(duid, activeMap);
}
```

Remove `MapInfo` and `RawRoomMappingData` imports if no longer used.

### 1.6 — Update `areaManagementService.ts`

**File:** `src/services/areaManagementService.ts`

```typescript
// BEFORE
public async getMapInfo(duid: string): Promise<MapInfo> { ... }
public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> { ... }

// AFTER
public async getMapInfo(duid: string): Promise<void> {
    if (!this.serviceRouting) throw new DeviceError('Service routing not initialized', duid);
    this.logger.debug('AreaManagementService - getMapInfo', duid);
    await this.serviceRouting.getMapInfo(duid);
}

public async getRoomMap(duid: string, activeMap: number): Promise<void> {
    if (!this.serviceRouting) throw new DeviceError('Service routing not initialized', duid);
    this.logger.debug('AreaManagementService - getRoomMap', duid);
    await this.serviceRouting.getRoomMap(duid, activeMap);
}
```

Remove `MapInfo` and `RawRoomMappingData` imports if no longer used.

### 1.7 — Update `roborockService.ts`

**File:** `src/services/roborockService.ts`

```typescript
// BEFORE
public async getMapInfo(duid: string): Promise<MapInfo> { ... }
public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> { ... }

// AFTER
public async getMapInfo(duid: string): Promise<void> {
    return this.areaService.getMapInfo(duid);
}
public async getRoomMap(duid: string, activeMap: number): Promise<void> {
    return this.areaService.getRoomMap(duid, activeMap);
}
```

Remove `MapInfo` and `RawRoomMappingData` imports if no longer used.

**Definition of Done:**

- [ ] Interface `abstractMessageDispatcher.ts` returns `Promise<void>` for both methods
- [ ] All three dispatchers (V10, Q10, Q7) updated to `Promise<void>`
- [ ] `messageRoutingService.ts` returns `Promise<void>`
- [ ] `areaManagementService.ts` returns `Promise<void>`
- [ ] `roborockService.ts` returns `Promise<void>`
- [ ] `MultipleMapDto` import removed from `V10MessageDispatcher.ts`
- [ ] No unused imports remain in any updated file
- [ ] `npm run type-check` exits 0

---

## Task 2 — Rewrite `RoomMap.fromMapInfo()` to fire-and-forget

### 2.1 — Update `fromMapInfo()` signature and body

**File:** `src/core/application/models/RoomMap.ts`

```typescript
// BEFORE
public static async fromMapInfo(vacuum: Device, context: MapInfoPlatformContext): Promise<MapInfoResult> {
    // ... awaits getMapInfo + getRoomMap, builds RoomMap, returns MapInfoResult
}

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

Remove the `MapInfoResult` interface — no longer returned.

### 2.2 — Update `deviceConfigurator.ts` caller

**File:** `src/platform/deviceConfigurator.ts` (line 95)

```typescript
// BEFORE
const { activeMapId, mapInfo, roomMap } = await RoomMap.fromMapInfo(vacuum, { roborockService, log: this.log });
this.log.debug('Initializing - roomMap: ', debugStringify(roomMap));
const homeInfo = new HomeEntity(homeData.id, homeData.name, roomMap, mapInfo, activeMapId);

// AFTER
await RoomMap.fromMapInfo(vacuum, { roborockService, log: this.log });
const homeInfo = new HomeEntity(homeData.id, homeData.name, RoomMap.empty(), MapInfo.empty(), 0);
```

`MapInfo.empty()` already exists (line 49 of `MapInfo.ts`). Remove `debugStringify(roomMap)` log line — there is no roomMap to log at this point.

**Definition of Done:**

- [ ] `fromMapInfo` returns `Promise<void>`
- [ ] `MapInfoResult` interface deleted from `RoomMap.ts`
- [ ] `deviceConfigurator.ts` constructs `HomeEntity` with `RoomMap.empty()` and `MapInfo.empty()`
- [ ] No unused imports remain in either file
- [ ] `npm run type-check` exits 0

---

## Task 2 Gate

- [ ] Tasks 1 and 2 complete
- [ ] `npm run type-check` exits 0
- [ ] `npm test` passes

---

## Task 3 — Create `MapInfoListener`

**New file:** `src/roborockCommunication/routing/listeners/implementation/mapInfoListener.ts`

Catches map info and room map push responses for all three protocols and updates `AreaManagementService` directly.

```typescript
import { AnsiLogger } from 'matterbridge/logger';

import { MapInfo } from '../../../../core/application/models/MapInfo.js';
import { RoomMap } from '../../../../core/application/models/RoomMap.js';
import { HomeModelMapper } from '../../../models/home/mappers.js';
import { DpsPayload, Protocol, ResponseMessage } from '../../../models/index.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';
import { Q10RequestCode } from '../../../enums/Q10RequestCode.js';
import { Q7RequestCode } from '../../../enums/Q7RequestCode.js';
import { Room } from '../../../models/home/index.js';
import { AreaManagementService } from '../../../../services/areaManagementService.js';
import { getSupportedAreas } from '../../../../initialData/getSupportedAreas.js';

export class MapInfoListener implements AbstractMessageListener {
    readonly name = 'MapInfoListener';

    constructor(
        public readonly duid: string,
        private readonly rooms: Room[],
        private readonly areaService: AreaManagementService,
        private readonly logger: AnsiLogger,
    ) {}

    public async onMessage(message: ResponseMessage): Promise<void> {
        if (message.duid !== this.duid) return;
        this.tryParseV1RoomMap(message);
        this.tryParseV1MapInfo(message);
        this.tryParseB01RoomMap(message);
        this.tryParseB01MapInfo(message);
    }

    // V1: get_room_mapping response
    private tryParseV1RoomMap(message: ResponseMessage): void {
        if (!message.body) return;
        let dps = message.get(Protocol.rpc_response) as DpsPayload;
        if (!dps) dps = message.get(Protocol.general_response) as DpsPayload;
        if (!dps?.result || !Array.isArray(dps.result)) return;

        const rawRoomData = dps.result as RawRoomMappingData;
        const roomMappings = rawRoomData.map((dto) => HomeModelMapper.rawArrayToMapRoomDto(dto, 0))
            .map((dto) => HomeModelMapper.toRoomMapping(dto, this.rooms));
        this.updateAreas(new RoomMap(roomMappings));
    }

    // V1: get_multi_maps_list response
    private tryParseV1MapInfo(message: ResponseMessage): void {
        if (!message.body) return;
        let dps = message.get(Protocol.rpc_response) as DpsPayload;
        if (!dps) dps = message.get(Protocol.general_response) as DpsPayload;
        if (!dps?.result || typeof dps.result !== 'object') return;

        const mapInfo = new MapInfo(dps.result as MultipleMapDto);
        this.logger.debug(`[${this.duid}] MapInfoListener: V1 map info updated`);
        // MapInfo alone doesn't update areas — room map carries the room data
        _ = mapInfo; // stored for future activeMapId tracking if needed
    }

    // B01-Q10: flat DPS key 61 (multimap) → map info
    private tryParseB01MapInfo(message: ResponseMessage): void {
        if (!message.body?.data) return;
        const data = message.body.data[Q10RequestCode.multimap];
        if (!data) return;
        this.logger.debug(`[${this.duid}] MapInfoListener: B01 map info push received`);
        // TODO: cast to MultipleMapDto and update once shape is confirmed from device log
    }

    // B01-Q10 / B01-Q7: room mapping push
    private tryParseB01RoomMap(message: ResponseMessage): void {
        if (!message.body?.data) return;

        // Q10: flat DPS key 999 (get_prop) — TODO: verify DPS code from device log
        const q10Data = message.body.data[Q10RequestCode.get_prop];
        if (q10Data) {
            this.logger.debug(`[${this.duid}] MapInfoListener: B01-Q10 room map push received (key 999)`);
            // TODO: parse and call updateAreas() once shape confirmed
            return;
        }

        // Q7: query_response envelope (key 10001), method 'service.get_preference'
        const q7Envelope = message.body.data[Q7RequestCode.query_response] as
            | { method?: string; result?: unknown }
            | undefined;
        if (q7Envelope?.method === 'service.get_preference' && q7Envelope.result) {
            this.logger.debug(`[${this.duid}] MapInfoListener: B01-Q7 room map push received`);
            // TODO: parse result as RawRoomMappingData and call updateAreas()
        }
    }

    private updateAreas(roomMap: RoomMap): void {
        const { supportedAreas, roomIndexMap } = getSupportedAreas(
            { roomMap, rooms: this.rooms } as HomeEntityLike,
            this.logger,
        );
        this.areaService.setSupportedAreaIndexMap(this.duid, roomIndexMap);
        this.areaService.setSupportedAreas(this.duid, supportedAreas);
        this.logger.debug(`[${this.duid}] MapInfoListener: areas updated (${roomMap.rooms.length} rooms)`);
    }
}
```

**Note:** `getSupportedAreas` currently takes a full `HomeEntity`. Check its signature — if it only reads `roomMap` and `rooms`, extract what it needs and pass inline. Adjust `updateAreas` accordingly.

**Definition of Done:**

- [ ] File exists at the path above
- [ ] Implements `AbstractMessageListener` (`name`, `duid`, `onMessage`)
- [ ] V1 room map push → `updateAreas()` → `AreaManagementService` updated
- [ ] B01-Q10 and B01-Q7 branches exist with `// TODO` stubs and debug logs
- [ ] `npm run type-check` exits 0

---

## Task 4 — Wire `MapInfoListener` in `connectionService.ts`

**File:** `src/services/connectionService.ts`

After the `simpleMessageListener` registration (line 156), register a `MapInfoListener` for the device:

```typescript
// Add after line 156:
const mapInfoListener = new MapInfoListener(
    device.duid,
    device.store.homeData.rooms,
    this.areaManagementService,   // inject or access via existing reference
    this.logger,
);
this.clientRouter.registerMessageListener(mapInfoListener);
```

Import `MapInfoListener` from its new path. Verify `this.areaManagementService` is accessible in `connectionService` — add a setter or constructor param if not.

**Definition of Done:**

- [ ] `MapInfoListener` imported and registered after `simpleMessageListener`
- [ ] `AreaManagementService` accessible in `connectionService`
- [ ] `npm run type-check` exits 0
- [ ] `npm test` passes

---

## Task 5 — Update `serviceAreaHandler.ts`

**File:** `src/runtimes/handlers/serviceAreaHandler.ts`

### 5.1 — Remove the `getRoomMap` call in `resolveAreaFromCleaningInfo`

Lines 109–112 use `getRoomMap` to update `activeMapId` for the multiple-map scenario. With `getRoomMap` returning `void`, this block must be removed. `activeMapId` is now updated reactively by `MapInfoListener` (Task 3).

```typescript
// BEFORE (lines 109–112)
if (platform.configManager.isMultipleMapEnabled) {
    const roomData = await platform.roborockService.getRoomMap(robot.device.duid, robot.homeInFo.activeMapId);
    robot.homeInFo.activeMapId = robot.homeInFo.mapInfo.getActiveMapId(roomData);
}

// AFTER — delete the block entirely
```

### 5.2 — Verify the empty `roomIndexMap` guard log level

```typescript
// CONFIRM (or change to):
if (!roomIndexMap || !platform.roborockService) {
    logger.debug('Room map not yet available, skipping room area resolution');
    return;
}
```

Log must be `debug` — empty room map during startup is expected, not an error.

**Definition of Done:**

- [ ] Lines 109–112 (`getRoomMap` call + `activeMapId` update) deleted
- [ ] Empty `roomIndexMap` guard logs at `debug`
- [ ] `npm run type-check` exits 0

---

## Phase Gate

- [ ] All tasks 1–5 complete
- [ ] Zero `client.query()` calls remain in `getMapInfo`/`getRoomMap` across all dispatchers
- [ ] `npm run type-check` exits 0
- [ ] `npm test` passes
- [ ] Debug logs confirm `MapInfoListener` fires and updates `AreaManagementService` on real device push
