# Room/Map Models Refactoring Plan

## Current State Analysis

### Duplicated Interfaces/Types

1. **Room representations** (4 duplicates):

   - `Room` in `src/roborockCommunication/models/room.ts` - API response
   - `RoomEntity` in `src/core/domain/entities/Room.ts` - Domain entity
   - `RoomInformation` in `src/roborockCommunication/models/map.ts` - API response
   - `RoomEntry` in `src/roborockCommunication/models/roomInfo.ts` - Internal

2. **Room with map context** (3 duplicates):

   - `MapRoom` in `src/roborockCommunication/models/mapInfo.ts`
   - `RoomSpec` in `src/roborockCommunication/models/mapInfo.ts`
   - `RoomMapEntry` in `src/model/RoomMap.ts`

3. **Map information** (2 duplicates):
   - `MapInfo` interface in `src/model/RoomMap.ts`
   - `MapInfo` class in `src/roborockCommunication/models/mapInfo.ts`

### Scattered Models

- API DTOs: `src/roborockCommunication/models/`
- Domain entities: `src/core/domain/entities/`
- Application models: `src/model/`

### Helper Functions (to be converted to methods)

In `src/share/helper.ts`:

- `getRoomMap(duid, platform)` → Should be instance/static method
- `getRoomMapFromDevice(device, platform)` → Should be instance/static method

## Proposed Structure

### API DTOs: `src/roborockCommunication/models/home/`

**Naming Convention**: All API response models use `Dto` suffix to distinguish from application models.

```
src/roborockCommunication/models/home/
├── RoomDto.ts              # API: Base room from home data
├── MapRoomDto.ts           # API: Room with map context from map_info
├── MapDataDto.ts           # API: Map information from multiple_map endpoint
├── MultipleMapDto.ts       # API: Multi-map container from multiple_map endpoint
├── mappers.ts              # DTO → Application model mappers
└── index.ts                # Barrel export
```

### Keep Domain Layer Separate

```
src/core/domain/entities/
└── Room.ts              # Domain entity (stays unchanged)
```

### Application Models: `src/core/application/models/`

**Naming Convention**: Application models have no suffix (clean names).

```
src/core/application/models/
├── RoomMapping.ts       # App: Room with local/global ID mapping
├── MapRoom.ts           # App: Room with map context (aggregated)
├── MapInfo.ts           # App: Map information aggregator
├── RoomMap.ts           # App: Room collection with map context
├── RoomIndexMap.ts      # App: Area ID ↔ Room ID bidirectional map
└── index.ts             # Barrel export
```

## Refactoring Steps

### Phase 1: Consolidate API DTOs

1. **Create `src/roborockCommunication/models/home/` directory**

2. **Create API DTOs with `Dto` suffix**:

   **`RoomDto.ts`** (from `room.ts`):

   ```typescript
   /** API response: Room from home data */
   export interface RoomDto {
     id: number;        // Global ID
     name: string;
   }
   ```

   **`MapRoomDto.ts`** (consolidates `MapRoom`, `RoomSpec`, `RoomInformation`):

   ```typescript
   /** API response: Room with map context from map_info endpoint */
   export interface MapRoomDto {
     id: number;              // Local room ID
     globalId?: number;       // Global room ID (from iot_name_id)
     iot_name_id: string;     // Global ID as string
     tag: number;             // Room tag/marker
     displayName?: string;    // Decoded display name
     mapId?: number;          // Map this room belongs to
   }
   ```

   **`MapDataDto.ts`** (from `map.ts`):

   ```typescript
   /** API response: Map information from multiple_map endpoint */
   export interface MapDataDto {
     mapFlag: number;
     add_time: number;
     length: number;
     name: string;
     rooms?: MapRoomDto[];
     bak_maps: MapBackupDto[];
   }

   export interface MapBackupDto {
     mapFlag: number;
     add_time: number;
   }
   ```

   **`MultipleMapDto.ts`** (from `multipleMap.ts`):

   ```typescript
   /** API response: Container for multiple maps */
   export interface MultipleMapDto {
     max_multi_map: number;
     max_bak_map: number;
     multi_map_count: number;
     map_info: MapDataDto[];
   }
   ```

3. **Create `mappers.ts`** - DTO to Application Model mappers:

   ```typescript
   import { RoomDto, MapRoomDto, MapDataDto, MultipleMapDto } from './index.js';
   import { RoomMapping, MapRoom, MapInfo } from '../../../core/application/models/index.js';
   import decodeComponent from '../../helper/nameDecoder.js';

   export class HomeModelMapper {
     /**
      * Map API room DTO to application room mapping.
      */
     static toRoomMapping(dto: MapRoomDto, rooms: RoomDto[]): RoomMapping {
       const room = rooms.find(r => r.id === dto.globalId || r.id === dto.id);
       return {
         id: dto.id,
         globalId: dto.globalId,
         iot_name_id: dto.iot_name_id,
         tag: dto.tag,
         mapId: dto.mapId ?? 0,
         displayName: room?.name ?? dto.displayName ?? `Room ${dto.id}`,
       };
     }

     /**
      * Map raw room data array (from get_room_mapping) to MapRoomDto.
      */
     static rawArrayToMapRoomDto(raw: number[], activeMap: number): MapRoomDto {
       return {
         id: raw[0],
         globalId: raw[1],
         iot_name_id: String(raw[1]),
         tag: raw[2],
         mapId: activeMap,
       };
     }

     /**
      * Map multiple map DTO to application MapInfo.
      */
     static toMapInfo(dto: MultipleMapDto): MapInfo {
       return new MapInfo(dto);
     }
   }
   ```

4. **Update `src/roborockCommunication/models/index.ts`**: Re-export from `./home/index.ts`

5. **Delete old files** (after migration complete):
   - Delete `room.ts`, `map.ts`, `mapInfo.ts`, `multipleMap.ts`, `roomInfo.ts` from `models/`
   - Remove duplicate interfaces `RoomSpec`, `RoomInformation` (consolidated into `MapRoomDto`)

### Phase 2: Create Application Models

1. **Create `src/core/application/models/` directory**

2. **Create `RoomMapping.ts`** - Application model for room with ID mappings:

   ```typescript
   /** Application model: Room with local/global ID mapping and display info */
   export interface RoomMapping {
     /** Local room ID (device-specific, used in commands) */
     id: number;
     /** Global room ID (cloud/home-level, for name lookup) */
     globalId?: number;
     /** Room identifier string */
     iot_name_id: string;
     /** Tag/marker */
     tag: number;
     /** Map ID this room belongs to */
     mapId: number;
     /** Display name (decoded from API or default) */
     displayName: string;
   }
   ```

3. **Create `MapRoom.ts`** - Application model for room with map context:

   ```typescript
   import { MapRoomDto } from '../../../roborockCommunication/models/home/index.js';

   /** Application model: Room with full map context */
   export class MapRoom {
     constructor(
       public readonly id: number,
       public readonly globalId: number | undefined,
       public readonly displayName: string,
       public readonly alternativeId: string,
       public readonly mapId: number | undefined,
     ) {}

     static fromDto(dto: MapRoomDto, displayName: string): MapRoom {
       return new MapRoom(
         dto.id,
         dto.globalId,
         displayName,
         `${dto.id}${dto.tag ?? ''}`,
         dto.mapId,
       );
     }
   }
   ```

4. **Create `MapInfo.ts`** - Application model for map information:

   ```typescript
   import { MultipleMapDto, MapDataDto } from '../../../roborockCommunication/models/home/index.js';
   import decodeComponent from '../../../roborockCommunication/helper/nameDecoder.js';

   export interface MapEntry {
     id: number;
     name: string | undefined;
     rooms: MapRoomDto[];
   }

   /** Application model: Aggregates and processes map information */
   export class MapInfo {
     public readonly maps: MapEntry[] = [];
     public readonly allRooms: MapRoomDto[] = [];

     constructor(multimap: MultipleMapDto) {
       this.maps = multimap.map_info.map((mapInfo: MapDataDto) => {
         const rooms = mapInfo.rooms?.map(room => ({
           ...room,
           mapId: mapInfo.mapFlag,
         })) ?? [];

         this.allRooms.push(...rooms);
         return {
           id: mapInfo.mapFlag,
           name: decodeComponent(mapInfo.name),
           rooms,
         };
       });
     }

     getById(id: number): string | undefined {
       return this.maps.find(m => m.id === id)?.name;
     }

     getByName(name: string): number | undefined {
       return this.maps.find(m => m.name?.toLowerCase() === name.toLowerCase())?.id;
     }
   }
   ```

5. **Move and refactor `RoomMap.ts`**:

   - Move from `src/model/` to `src/core/application/models/`
   - Update to use `RoomMapping` application model
   - Add static factory methods:

     ```typescript
     import { RoomMapping } from './RoomMapping.js';
     import { MapRoomDto, RoomDto } from '../../../roborockCommunication/models/home/index.js';

     export interface MapReference {
       id: number;
       name: string | undefined;
     }

     export class RoomMap {
       constructor(
         private readonly roomMappings: RoomMapping[],
       ) {}

       public get hasRooms(): boolean {
         return this.roomMappings.length > 0;
       }

       public getRooms(map_info: MapReference[], enableMultipleMap = false): RoomMapping[] {
         const mapid = map_info[0]?.id ?? 0;
         return enableMultipleMap
           ? this.roomMappings
           : this.roomMappings.filter(room => room.mapId === undefined || room.mapId === mapid);
       }

       /**
        * Get room map for device (with caching).
        * Replaces getRoomMap() helper.
        */
       static async fromDevice(
         duid: string,
         platform: RoborockMatterbridgePlatform
       ): Promise<RoomMap | undefined>

       /**
        * Get room map directly from device without caching.
        * Replaces getRoomMapFromDevice() helper.
        */
       static async fromDeviceDirect(
         device: Device,
         platform: RoborockMatterbridgePlatform
       ): Promise<RoomMap>
     }
     ```

6. **Move `RoomIndexMap.ts`**:
   - Move from `src/model/` to `src/core/application/models/`
   - Update import references

### Phase 3: Refactor Dispatchers with DTO Mapping

1. **Update `V01MessageDispatcher.getRoomMappings()`**:

   **Before** (returns mixed models):

   ```typescript
   public async getRoomMappings(duid: string, activeMap: number, rooms: Room[]): Promise<RoomMap> {
     const response = await this.client.get<number[][]>(duid, request);
     // ... processing ...
     return new RoomMap(roomInfo, rooms);
   }
   ```

   **After** (DTOs → Mapper → Application Models):

   ```typescript
   import { MapRoomDto, RoomDto, HomeModelMapper } from '../../models/home/index.js';
   import { RoomMapping } from '../../../core/application/models/RoomMapping.js';
   import { RoomMap } from '../../../core/application/models/RoomMap.js';

   public async getRoomMappings(duid: string, activeMap: number, rooms: RoomDto[]): Promise<RoomMap> {
     const request = new RequestMessage({ method: 'get_room_mapping' });
     const response = await this.client.get<number[][]>(duid, request);

     if (response) {
       // Step 1: Raw API response → DTO
       const mapRoomDtos: MapRoomDto[] = response.map(raw =>
         HomeModelMapper.rawArrayToMapRoomDto(raw, activeMap)
       );

       // Step 2: DTO → Application model via mapper
       const roomMappings: RoomMapping[] = mapRoomDtos.map(dto =>
         HomeModelMapper.toRoomMapping(dto, rooms)
       );

       // Step 3: Create application model
       const roomMap = new RoomMap(roomMappings);
       this.logger.debug(`Room mappings for device ${duid}: ${debugStringify(roomMap)}`);
       return roomMap;
     }

     return new RoomMap([]);
   }
   ```

   **Key changes**:

   - API response (`number[][]`) → `MapRoomDto[]` (DTO layer)
   - `MapRoomDto[]` → `RoomMapping[]` via `HomeModelMapper` (mapping layer)
   - `RoomMapping[]` → `RoomMap` (application model)
   - Clear separation: API ↔ DTO ↔ Mapper ↔ Application Model

2. **Update `Q7MessageDispatcher` and `Q10MessageDispatcher`**: Same pattern

3. **Update `abstractMessageDispatcher.ts`**:

   ```typescript
   import { RoomDto } from '../models/home/index.js';
   import { RoomMap } from '../../core/application/models/index.js';

   export interface AbstractMessageDispatcher {
     getRoomMappings(duid: string, activeMap: number, rooms: RoomDto[]): Promise<RoomMap>;
   }
   ```

4. **Update all dispatcher call sites**:
   - Change `Room[]` parameter type to `RoomDto[]`
   - Ensure DTOs are passed from API responses

### Phase 4: Remove Helper Functions

1. **In `src/share/helper.ts`**:

   - Delete `getRoomMap()` function
   - Delete `getRoomMapFromDevice()` function
   - Delete `createRoomDataMap()` function

2. **Update all call sites**:
   - Replace `getRoomMap(duid, platform)` with `RoomMap.fromDevice(duid, platform)`
   - Replace `getRoomMapFromDevice(device, platform)` with `RoomMap.fromDeviceDirect(device, platform)`

### Phase 5: Update Tests

1. **Move test files**:

   - Create `src/tests/roborockCommunication/models/home/` directory
   - Move/create tests for DTOs

2. **Update test imports**: Reflect new paths

3. **Add tests for new static methods**: `RoomMap.fromDevice()`, `RoomMap.fromDeviceDirect()`

### Phase 6: Documentation

1. **Update `docs/CODE_STRUCTURE.md`**: Document new model structure

2. **Add JSDoc comments**:
   - Explain domain vs API vs application models
   - Document the relationship between local room IDs and global room IDs

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         API Layer                                   │
│  Roborock Cloud API → Raw Response (number[][], JSON)               │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      DTO Layer (API Models)                         │
│  src/roborockCommunication/models/home/                             │
│  - RoomDto, MapRoomDto, MapDataDto, MultipleMapDto                  │
│  - Naming: *Dto suffix                                              │
│  - Purpose: Exact API response structure                            │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Mapper Layer                                   │
│  src/roborockCommunication/models/home/mappers.ts                   │
│  - HomeModelMapper.toRoomMapping()                                  │
│  - HomeModelMapper.rawArrayToMapRoomDto()                           │
│  - Purpose: Transform DTOs → Application Models                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 Application Model Layer                             │
│  src/core/application/models/                                       │
│  - RoomMapping, MapRoom, MapInfo, RoomMap, RoomIndexMap             │
│  - Naming: Clean names (no suffix)                                  │
│  - Purpose: Business logic, aggregation, domain operations          │
└─────────────────────────────────────────────────────────────────────┘
```

### Example Flow: `getRoomMappings()`

```typescript
// 1. API Response (raw)
const apiResponse: number[][] = [[1, 100, 0], [2, 101, 1]]

// 2. Map to DTO (exact API structure)
const dtos: MapRoomDto[] = apiResponse.map(raw => ({
  id: raw[0],           // Local ID: 1, 2
  globalId: raw[1],     // Global ID: 100, 101
  iot_name_id: String(raw[1]),
  tag: raw[2],
  mapId: activeMap,
}))

// 3. Map to Application Model (enriched, business logic)
const roomMappings: RoomMapping[] = dtos.map(dto => ({
  id: dto.id,
  globalId: dto.globalId,
  iot_name_id: dto.iot_name_id,
  tag: dto.tag,
  mapId: dto.mapId,
  displayName: rooms.find(r => r.id === dto.globalId)?.name ?? `Room ${dto.id}`,  // ← Business logic
}))

// 4. Create aggregated application model
const roomMap = new RoomMap(roomMappings)
```

## Benefits

### Clarity

- **API DTOs** (`*Dto` suffix): Exact API response structure, no business logic
- **Application models** (clean names): Business logic, aggregation, domain operations
- **Mapper layer**: Single responsibility for transformation
- **Domain entities** (separate): Pure business concepts

### Separation of Concerns

- **API changes**: Only update DTOs and mappers
- **Business logic changes**: Only update application models
- **No mixing**: DTOs never contain business logic; application models never exposed to API layer

### Maintainability

- **Single source of truth**: No duplicate interfaces
- **Clear boundaries**: API ↔ DTO ↔ Mapper ↔ Application Model
- **Encapsulation**: Helper functions → class methods
- **Testability**: Mock DTOs for mapper tests, mock mappers for service tests

### Discoverability

- **Logical grouping**: Related models in `home/` subfolder
- **Clear naming**: `*Dto` suffix immediately identifies API models
- **No name collisions**: `MapInfoDto` (API) vs `MapInfo` (app model)

## Migration Checklist

- [ ] Phase 1: Consolidate API DTOs in `src/roborockCommunication/models/home/`
- [ ] Phase 2: Move application models to `src/core/application/models/`
- [ ] Phase 3: Refactor message dispatchers
- [ ] Phase 4: Remove helper functions
- [ ] Phase 5: Update tests
- [ ] Phase 6: Update documentation
- [ ] Run `npm run build:local` and `npm test` after each phase
- [ ] Update `docs/claude_history.md` with progress

## Breaking Changes

None. This is an internal refactoring that does not affect the public API or behavior.

## Estimated Scope

### New Files

- `src/roborockCommunication/models/home/RoomDto.ts`
- `src/roborockCommunication/models/home/MapRoomDto.ts`
- `src/roborockCommunication/models/home/MapDataDto.ts`
- `src/roborockCommunication/models/home/MultipleMapDto.ts`
- `src/roborockCommunication/models/home/mappers.ts`
- `src/roborockCommunication/models/home/index.ts`
- `src/core/application/models/RoomMapping.ts`
- `src/core/application/models/MapRoom.ts`
- `src/core/application/models/MapInfo.ts`
- `src/core/application/models/index.ts`

### Files to Move

- `src/model/RoomMap.ts` → `src/core/application/models/RoomMap.ts`
- `src/model/RoomIndexMap.ts` → `src/core/application/models/RoomIndexMap.ts`

### Files to Delete (after migration)

- `src/roborockCommunication/models/room.ts`
- `src/roborockCommunication/models/map.ts`
- `src/roborockCommunication/models/mapInfo.ts`
- `src/roborockCommunication/models/multipleMap.ts`
- `src/roborockCommunication/models/roomInfo.ts`
- Helper functions in `src/share/helper.ts` (partial deletion)

### Files to Modify

- `src/roborockCommunication/protocol/dispatcher/V01MessageDispatcher.ts`
- `src/roborockCommunication/protocol/dispatcher/Q7MessageDispatcher.ts`
- `src/roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.ts`
- `src/roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.ts`
- `src/roborockCommunication/models/index.ts`
- `src/services/roborockService.ts`
- `src/services/messageRoutingService.ts`
- `src/services/areaManagementService.ts`
- `src/share/helper.ts`
- `src/initialData/getSupportedAreas.ts`
- All files importing from `src/model/RoomMap.ts` (~13 files)

### Tests to Create/Update

- `src/tests/roborockCommunication/models/home/mappers.test.ts` (new)
- `src/tests/core/application/models/RoomMap.test.ts` (new)
- `src/tests/core/application/models/RoomMapping.test.ts` (new)
- `src/tests/core/application/models/MapInfo.test.ts` (move + update)
- `src/tests/roborockCommunication/protocol/dispatcher/*.test.ts` (update)
- `src/tests/services/*.test.ts` (update imports)

**Total**:

- Create: ~10 files
- Move: 2 files
- Delete: 5 files
- Modify: ~15 files
- Tests: ~10 files
