# Claude History

## 2026-01-30

### GitHub Actions: Conditional npm Tag Publishing

- **Task**: Update publish workflow to use different npm tags based on release type
- **Changes**:
  - Use `github.event.release.prerelease` flag instead of string matching for reliability
  - If prerelease (e.g., `1.1.1-rc13`), publish with `--tag dev`
  - If stable release (e.g., `1.2.3`), publish with `--tag latest`
  - Fixed duplicate "Install dependencies" step names
  - Consolidated to `npm ci` (removed redundant `npm install`)
  - Separated preparation (precondition/deepClean) from installation
- **File**: [.github/workflows/publish.yml](.github/workflows/publish.yml)

## 2026-01-30

### API Refactoring: send() vs get() Pattern

- **Issue**: `send()` and `get()` methods in AbstractClient were identical (both waited for responses)
- **Solution**: Refactored to clear semantic distinction - `send()` for fire-and-forget commands, `get()` for queries needing responses
- **Changes**:
  - `send()`: Fire-and-forget pattern (Promise<void>) - for commands like pauseCleaning, startCleaning, goHome
  - `get()`: Wait for response pattern (Promise<T | undefined>) - for queries like getNetworkInfo, getCustomMessage
  - Removed `noResponseNeededMethods` array (no longer needed)
  - Updated MQTTClient.test.ts mock to include `getProtocolVersion` method
- **Result**: More intuitive API, eliminated duplicate code, clearer separation between commands and queries
- **Tests**: All 1222 tests passing

### Architecture Review: Message Dispatch Call Chain

- Reviewed call chain: commonCommand → RoborockService → MessageRoutingService → AbstractMessageDispatcher → V01MessageDispatcher
- Analysis result: Architecture NOT over-layered, each layer serves distinct purpose
- Layers: (1) Framework integration, (2) Facade coordinating 6 services, (3) Multi-device routing, (4) Protocol abstraction (V01/Q7/Q10), (5) Protocol implementation
- Recommendation: Keep current structure for multi-protocol/multi-device support

### CODE_STRUCTURE.md Updates

- Redesigned service dependencies diagram with clear layer separation (Platform, Service Container, Communication)
- Updated v3.0 → v4.0: application models layer, behaviors refactor (core/handlers/enums/b01), protocol dispatchers (Q7/Q10/V01), DTOs/mappers
- Added DTO → Mapper → Application Model data flow documentation

## 2026-01-26

### Room/Map Models Refactoring (5 Phases)

- **Issue**: 4 duplicate room types, 3 duplicate map-room types, scattered models, no API/domain separation
- **Solution**: API DTOs (`*Dto` suffix) in `roborockCommunication/models/home/`, app models in `core/application/models/`, `HomeModelMapper` for transformations
- **Phase 1**: Created RoomDto, MapRoomDto, MapDataDto, MultipleMapDto + barrel exports
- **Phase 2**: Created RoomMapping, MapRoom, MapInfo, RoomMap, RoomIndexMap + HomeModelMapper (toRoomMapping, rawArrayToMapRoomDto, toMapInfo)
- **Phase 3**: Updated dispatchers (V01/Q7/Q10) + services to use RoomDto, implemented DTO→Mapper→Model pattern in getRoomMappings()
- **Phase 4**: Moved helpers to RoomMap static methods (fromDevice, fromDeviceDirect), removed 3 deprecated helper functions (87 lines), updated getSupportedAreas
- **Phase 5**: Added `RawRoomMappingData` type for `number[][]` API responses
