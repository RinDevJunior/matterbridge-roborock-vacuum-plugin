# To Do

### Test Suite Maintenance

- [x] Fix unit test failures after message handling refactor (13 tests)
  - [x] Update handleHomeDataMessage.test.ts for payload-based architecture
  - [x] Fix pollingService.test.ts callback expectations
  - [x] Update iotClient.test.ts httpsAgent assertion
  - [x] Fix simpleMessageHandler.test.ts payload structure
  - [x] Update pendingResponseTracker.test.ts error handling expectations
- [x] Create unit tests for MapInfo class
  - [x] Test constructor with/without rooms
  - [x] Test getById() and getByName() methods
  - [x] Test hasRooms getter
  - [x] Test case-insensitive name search

### Code Refactoring

- [x] Simplify networkInfo extraction in ConnectionService
  - [x] Extract helper method getNetworkInfoFromDeviceStatus()
  - [x] Update documentation
