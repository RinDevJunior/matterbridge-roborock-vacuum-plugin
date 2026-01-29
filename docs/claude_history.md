# Claude History

## 2026-01-26

### Room/Map Models Refactoring Plan

- Analyzed current room/map model structure across codebase
- Identified issues:
  - 4 duplicate room representations (Room, RoomEntity, RoomInformation, RoomEntry)
  - 3 duplicate room-with-map-context models (MapRoom, RoomSpec, RoomMapEntry)
  - 2 duplicate MapInfo types (interface vs class)
  - Helper functions in `src/share/helper.ts` that should be class methods
  - Models scattered across `src/core/domain/entities/`, `src/model/`, and `src/roborockCommunication/models/`
  - No clear separation between API responses and application models
- Created comprehensive refactoring plan:
  - **API DTOs**: `src/roborockCommunication/models/home/` with `Dto` suffix (RoomDto, MapRoomDto, etc.)
  - **Application models**: `src/core/application/models/` with clean names (RoomMapping, MapRoom, MapInfo, RoomMap)
  - **Mapper layer**: `HomeModelMapper` to transform DTOs → Application models
  - **Data flow**: API → DTO → Mapper → Application Model
  - Convert helper functions to static/instance methods on classes
  - Remove duplicates and create clear separation of concerns
- Documentation:
  - Created `docs/refactor_room.md` with 6-phase refactoring plan
  - Added data flow architecture diagram showing API → DTO → Mapper → App Model
  - Updated `docs/to_do.md` with new refactoring tasks
- Benefits:
  - Single source of truth for each model type
  - Clear naming convention: `*Dto` suffix for API models, clean names for application models
  - Separation of concerns: API changes only affect DTOs/mappers, business logic only in app models
  - Better encapsulation and testability
  - Improved discoverability through logical grouping
- Example transformation in `getRoomMappings()`:
  - API response (`number[][]`) → `MapRoomDto[]` → `RoomMapping[]` → `RoomMap`
  - Each layer has single responsibility

### Room/Map Models Refactoring - Phase 1: API DTOs

- Created `src/roborockCommunication/models/home/` directory for API DTOs
- Created API DTOs with `Dto` suffix:
  - `RoomDto.ts` - Base room from home data with id and name
  - `MapRoomDto.ts` - Room with map context (id, globalId, iot_name_id, tag, displayName, mapId)
  - `MapDataDto.ts` - Map information with MapBackupDto interface
  - `MultipleMapDto.ts` - Container for multiple maps
- Created `home/index.ts` barrel export for all DTOs
- Updated `src/roborockCommunication/models/index.ts` to re-export home DTOs
- Note: Mapper layer (`HomeModelMapper`) deferred to Phase 2 since it depends on application models
- Type errors present from previous branch work; will be addressed in Phase 5 (test updates)

### Room/Map Models Refactoring - Phase 2: Application Models

- Created `src/core/application/models/` directory for application models
- Created application models with clean names (no suffix):
  - `RoomMapping.ts` - Room with local/global ID mapping (id, globalId, iot_name_id, tag, mapId, displayName)
  - `MapRoom.ts` - Room with full map context, includes `fromDto()` static factory method
  - `MapInfo.ts` - Aggregates and processes map information (maps, allRooms, getById, getByName methods)
  - `RoomMap.ts` - Refactored from `src/model/`, now uses `RoomMapping[]` instead of `MapRoom[]` and `Room[]`
  - `RoomIndexMap.ts` - Moved from `src/model/`, updated import path for MapInfo from getSupportedAreas
- Created `application/models/index.ts` barrel export
- Created `src/roborockCommunication/models/home/mappers.ts` with `HomeModelMapper` class:
  - `toRoomMapping()` - Maps MapRoomDto + RoomDto[] to RoomMapping
  - `rawArrayToMapRoomDto()` - Maps raw number[][] from API to MapRoomDto
  - `toMapInfo()` - Maps MultipleMapDto to MapInfo
- Updated `home/index.ts` to export mappers
- Key changes in RoomMap refactoring:
  - Removed `RoomMapEntry` interface (replaced by `RoomMapping`)
  - Removed `MapInfo` interface (now exists as application model class)
  - Introduced `MapReference` interface for map_info parameter
  - Simplified constructor to accept only `RoomMapping[]`
  - Updated `getRooms()` to return `RoomMapping[]`
- Type errors expected from previous branch work; will be fixed in Phase 3 (dispatchers) and Phase 5 (tests)

### Room/Map Models Refactoring - Phase 3: Dispatcher Refactoring

- Updated `src/roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.ts`:
  - Changed `getRoomMappings()` signature from `rooms: Room[]` to `rooms: RoomDto[]`
  - Updated import from `src/model/RoomMap.js` to `src/core/application/models/index.js`
- Updated `src/roborockCommunication/protocol/dispatcher/V01MessageDispatcher.ts`:
  - Refactored `getRoomMappings()` to use DTO → Mapper → Application Model pattern:
    - Transform API response `number[][]` → `MapRoomDto[]` using `HomeModelMapper.rawArrayToMapRoomDto()`
    - Transform `MapRoomDto[]` → `RoomMapping[]` using `HomeModelMapper.toRoomMapping()`
    - Create `RoomMap` from `RoomMapping[]` (single parameter constructor)
  - Updated imports: replaced `Room, MapRoom, RoomSpec` with `RoomDto`, replaced old RoomMap import
  - Removed direct use of `decodeComponent` (now handled by mapper)
  - Simplified from three chained `.map()` calls to two clean transformation steps
- Updated `src/roborockCommunication/protocol/dispatcher/Q7MessageDispatcher.ts`:
  - Changed `getRoomMappings()` parameter from `rooms: Room[]` to `rooms: RoomDto[]`
  - Updated `RoomMap` constructor call to single parameter (empty array for TODO implementation)
  - Updated imports to use RoomDto and new RoomMap location
- Updated `src/roborockCommunication/protocol/dispatcher/Q10MessageDispatcher.ts`:
  - Changed `getRoomMappings()` parameter from `rooms: Room[]` to `rooms: RoomDto[]`
  - Updated `RoomMap` constructor call to single parameter (empty array for TODO implementation)
  - Updated imports to use RoomDto and new RoomMap location
- Updated service layer to propagate RoomDto type:
  - `src/services/messageRoutingService.ts` - Updated method signature and imports
  - `src/services/areaManagementService.ts` - Updated method signature and imports
  - `src/services/roborockService.ts` - Updated method signature and imports
- Established complete data flow: **API → DTO → Mapper → Application Model**
- Remaining type errors (50 errors) are expected:
  - Old RoomMap usage in helper.ts (Phase 4 - remove helper functions)
  - Test files using old MapInfo and RoomMap constructors (Phase 5 - update tests)
  - getSupportedAreas.ts using private RoomMap properties (Phase 4)

### Room/Map Models Refactoring - Phase 4: Remove Helper Functions

- Added static factory methods to `src/core/application/models/RoomMap.ts`:
  - `RoomMap.fromDevice(duid, platform)` - Get room map with caching (replaces getRoomMap)
  - `RoomMap.fromDeviceDirect(device, platform)` - Get room map without caching (replaces getRoomMapFromDevice)
  - Added public `rooms` getter to expose roomMappings for backwards compatibility
- Updated call sites to use new static methods:
  - `src/runtimes/handleLocalMessage.ts` - Changed `getRoomMap()` to `RoomMap.fromDevice()`
  - `src/runtimes/handleCloudMessage.ts` - Changed `getRoomMapFromDevice()` to `RoomMap.fromDeviceDirect()`
  - `src/module.ts` - Changed `getRoomMapFromDevice()` to `RoomMap.fromDeviceDirect()`
- Removed deprecated helper functions from `src/share/helper.ts`:
  - Deleted `getRoomMap()` function (57 lines)
  - Deleted `getRoomMapFromDevice()` function (20 lines)
  - Deleted `createRoomDataMap()` function (10 lines)
  - Cleaned up unused imports (RoomMap, RoborockMatterbridgePlatform, MapRoom, debugStringify)
- Updated `src/initialData/getSupportedAreas.ts`:
  - Changed parameter type from `Room[]` to `RoomDto[]`
  - Added `mapInfos: MapEntry[]` parameter for multiple map support
  - Updated imports to use new application models from `src/core/application/models/`
  - Changed `getSupportedMaps()` to use `MapEntry[]` instead of accessing roomMap.mapInfo
- Updated `src/types/roborockVacuumCleaner.ts`:
  - Changed `mapInfos` property type from `MapInfo[]` to `MapEntry[]`
  - Updated imports to use `MapEntry` from application models
- Reduced type errors from 50 to 39 (11 errors fixed)
- Remaining errors (39 total) are all in test files, to be addressed in Phase 5

### Room/Map Models Refactoring - Type Safety Improvements

- Created `RawRoomMappingData` type for `number[][]` from API room mapping response
- Added type to `src/roborockCommunication/models/home/mappers.ts`:
  - `export type RawRoomMappingData = number[][]`
- Updated `src/roborockCommunication/models/home/index.ts`:
  - Explicit export: `export { HomeModelMapper, type RawRoomMappingData } from './mappers.js'`
- Updated `src/roborockCommunication/protocol/dispatcher/V01MessageDispatcher.ts`:
  - Changed `this.client.get<number[][]>(duid, request)` to `this.client.get<RawRoomMappingData>(duid, request)`
  - Added import: `RawRoomMappingData` from `../../models/home/index.js`
- Improved type clarity and maintainability by replacing generic array type with semantic type name
