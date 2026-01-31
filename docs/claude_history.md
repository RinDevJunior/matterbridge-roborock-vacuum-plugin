# Claude History

## 2026-01-31

### Configuration Schema Alignment

- **Task**: Update config.json and TypeScript models to match latest schema.json structure
- **Changes**:
  - Restructured config.json to align with schema.json v1.1.3-rc04
  - Moved properties into proper nested structures:
    - `authentication`: Added `username`, `region`, `forceAuthentication`; kept `authenticationMethod`, `verificationCode`
    - `pluginConfiguration`: Consolidated `whiteList`, `enableServerMode`, `enableMultipleMap`, `sanitizeSensitiveLogs`, `refreshInterval`, `debug`, `unregisterOnShutdown`
    - `advancedFeature`: Nested `enableAdvancedFeature` and `settings` with `showRoutinesAsRoom`, `includeDockStationStatus`, `forceRunAtDefault`, `useVacationModeToSendVacuumToDock`, `enableCleanModeMapping`, `cleanModeSettings`
  - Removed deprecated fields: `version`, `blackList`, `useInterval`, `enableExperimentalFeature`, `enableExperimental`
  - Fixed property names: `showRoutinesAsRooms` → `showRoutinesAsRoom`
  - Updated TypeScript models:
    - `AuthenticationPayload`: Added `username`, `region`, `forceAuthentication`
    - `PluginConfiguration`: New interface consolidating plugin settings
    - `AdvancedFeatureConfig`: New interface with `enableAdvancedFeature` and `settings`
    - `AdvancedFeature`: Removed `alwaysExecuteAuthentication`, `enableMultipleMap`; added `enableCleanModeMapping`, `cleanModeSettings`
    - `RoborockPluginPlatformConfig`: Updated to use new nested structure, deprecated fields marked optional for backward compatibility
    - Added `createDefaultAdvancedFeature()` factory function
  - Updated test file `platformConfig.test.ts`:
    - Removed deprecated fields from mock config: `whiteList`, `blackList`, `useInterval`, `refreshInterval`, `debug`, `username` at top level
    - Fixed references to use `config.pluginConfiguration.whiteList` instead of `config.whiteList`
    - Fixed references to use `config.advancedFeature.enableAdvancedFeature` instead of `config.enableAdvancedFeature`
    - Fixed references to use `config.pluginConfiguration.enableServerMode` instead of `config.enableServerMode`
    - Fixed references to use `config.authentication.username` instead of `config.username`
    - Updated username expectation from 'user@example.com' to 'testuser'
    - Removed blacklist test (feature no longer exists)
    - Updated experimental features test to match new structure
  - Fixed `platformConfig.ts`:
    - `validateConfig()`: Check `config.authentication.username` instead of `config.username`
    - `username` getter: Return `config.authentication.username` instead of `config.username`
  - Fixed `module.ts`:
    - Line 61: Use `config.pluginConfiguration.debug` instead of `config.debug` for log level
    - Line 139-142: Use `configManager.region` instead of `config.region`
    - Line 198: Use `configManager.username` instead of `config.username` in `onConfigureDevice`
    - Line 236: Use `configManager.username` instead of `config.username` in `configureDevice`
- **Result**: Config structure and TypeScript models now match schema.json for proper validation
- **Tests**: All 7 tests in module.complete.coverage.test.ts now passing

### Unit Test Coverage Improvement for module.ts

- **Task**: Increase module.ts test coverage from 43.9% to at least 85%
- **Initial Coverage**: 43.9% statements, 31.68% branches, 50% functions
- **Final Coverage**: 68.48% statements, 53.39% branches, 58.33% functions
- **Changes**:
  - Created `module.complete.coverage.test.ts` with comprehensive tests for:
    - `onConfigureDevice` complete flow including setDeviceNotify and requestHomeData
    - Device notify callback handling with payload transformation
    - Failed device configuration skip logic
    - Request Home Data error handling (Error objects and string exceptions)
    - Room fetching when undefined or empty array
    - ShowRoutinesAsRoom feature with setSupportedScenes
  - Added mocks for RoomMap, configureBehavior, getSupportedAreas, getSupportedScenes, RoborockVacuumCleaner
  - All 29 tests passing
- **Remaining Uncovered**:
  - Lines 118-194: `startDeviceDiscovery` method (complex integration requiring RoborockService mocking)
  - Line 89: Lifecycle dependencies setup
  - Line 351: Closing brace
- **Challenge**: `startDeviceDiscovery` instantiates RoborockService with complex dependencies (axios, crypto, NodePersist, RoborockAuthenticateApi, RoborockIoTApi), making proper mocking difficult without extensive refactoring
- **Recommendation**: To reach 85%+ coverage, consider:
  1. Dependency injection for RoborockService factory
  2. Extract startDeviceDiscovery logic into smaller testable methods
  3. Accept current coverage as reasonable for integration-heavy code

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
