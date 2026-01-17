# Vitest Migration Plan

This document outlines the step-by-step plan to migrate all test files in the project from Jest to Vitest. Jest has now been fully removed; Vitest is the only test runner.

## 1. Preparation ✅ Completed

- Ensure Vitest and related plugins are installed:
  ```sh
  npm install --save-dev --save-exact vitest @vitest/coverage-v8 @vitest/eslint-plugin
  ```
- Add Vitest scripts to `package.json`:
  ```json
  "scripts": {
    "test:vitest": "vitest run"
  }
  ```
- (Optional) Create `vitest.config.ts` for custom configuration.

## 2. Migration Steps ✅ Completed

### 2.1 Inventory ✅ Completed

- There are 76 test files matching `*.test.ts` or `*.spec.ts`.
- List all test files for tracking progress (see checklist below).

### 2.2 One-by-One Migration ✅ Completed

For each file:

1. **Pre-migration:** ✅ Completed
   - Run all tests in that file using the test runner (Vitest).
   - Always search for an existing row for the test file in the migration table and only update its values (before/after/migrated).
   - If a row exists, update it; you must not add a new one.
   - If no row exists, ask the user for permission before adding a new row.
   - Note the total number of tests for that file in the checklist as "before".
2. **Migration:** ✅ Completed
   - Update imports: Use `vitest` (`import { describe, it, expect, beforeEach, vi } from 'vitest'`).
   - Use `vi.fn()` and `vi.mock()` for mocking.
   - Use `vi.clearAllMocks()` for clearing mocks.
   - Update any remaining test setup to Vitest equivalents.
3. **Post-migration:** ✅ Completed
   - Run all tests in that file using Vitest and note the total as "after".
   - Do not remove or skip any existing tests during migration.
   - Run the migrated file with `npm run test:vitest -- <file>` to verify migration is correct before proceeding to the next file.

**Example:**

```
- [ ] src/tests/share/runtimeHelper.test.ts (before: 3 tests, after: 3 tests)
```

This ensures that test coverage is preserved and that no tests are lost or skipped during migration.

4. **Mocking and Setup** ✅ Completed

   - All global and manual mocks are compatible with Vitest.
   - All setup files are compatible with Vitest.

5. **CI Integration** ✅ Completed

   - CI scripts updated to run Vitest tests only.
   - Coverage and reporting are configured for Vitest.

6. **Cleanup**

   - Remove Jest dependencies and scripts (done).
   - Update documentation to reflect Vitest usage.

| Migrated | Test File Path                                                                                      | Before | After | Migrated Failed |
| -------- | --------------------------------------------------------------------------------------------------- | ------ | ----- | --------------- |
| ✅       | src/tests/share/runtimeHelper.test.ts                                                               | 3      | 3     |
| ✅       | src/tests/share/function.test.ts                                                                    | 11     | 11    |
| ✅       | src/tests/initialData/getSupportedAreas.test.ts                                                     | 8      | 8     |
| ✅       | src/tests/initialData/getSupportedCleanModes.test.ts                                                | 3      | 3     |
| ✅       | src/tests/initialData/getSupportedRunModes.test.ts                                                  | 3      | 3     |
| ✅       | src/tests/initialData/getSupportedScenes.test.ts                                                    | 2      | 2     |
| ✅       | src/tests/initialData/getBatteryStatus.test.ts                                                      | 3      | 3     |
| ✅       | src/tests/initialData/getOperationalStates.test.ts                                                  | 9      | 9     |
| ✅       | src/tests/services/serviceContainer.test.ts                                                         | 26     | 26    |
| ✅       | src/tests/services/authenticationService.test.ts                                                    | 22     | 22    |
| ✅       | src/tests/services/clientManager.test.ts                                                            | 6      | 6     |
| ✅       | src/tests/services/pollingService.test.ts                                                           | 25     | 25    |
| ✅       | src/tests/services/messageRoutingService.test.ts                                                    | 50     | 50    |
| ✅       | src/tests/services/deviceManagementService.test.ts                                                  | 45     | 45    |
| ✅       | src/tests/services/connectionService.test.ts                                                        | 24     | 24    |
| ✅       | src/tests/services/areaManagementService.test.ts                                                    | 46     | 46    |
| ✅       | src/tests/platform.region.test.ts                                                                   | 4      | 4     |
| ✅       | src/tests/errors/CommunicationError.test.ts                                                         | 21     | 21    |
| ✅       | src/tests/errors/ValidationError.test.ts                                                            | 15     | 15    |
| ✅       | src/tests/errors/AuthenticationError.test.ts                                                        | 17     | 17    |
| ✅       | src/tests/errors/DeviceError.test.ts                                                                | 21     | 21    |
| ✅       | src/tests/errors/ConfigurationError.test.ts                                                         | 14     | 14    |
| ✅       | src/tests/roborockService4.test.ts                                                                  | 5      | 5     |
| ✅       | src/tests/model/DockingStationStatus.test.ts                                                        | 3      | 3     |
| ✅       | src/tests/platformRunner2.test.ts                                                                   | 5      | 5     |
| ✅       | src/tests/roborockService.unit.test.ts                                                              | 20     | 20    |
| ✅       | src/tests/behaviors/roborock.vacuum/default/runtimes.test.ts                                        | 6      | 6     |
| ✅       | src/tests/behaviors/roborock.vacuum/default/default.test.ts                                         | 25     | 25    |
| ✅       | src/tests/behaviors/roborock.vacuum/default/initialData.test.ts                                     | 4      | 4     |
| ✅       | src/tests/behaviors/BehaviorDeviceGeneric.test.ts                                                   | 3      | 3     |
| ✅       | src/tests/platformRunner3.test.ts                                                                   | 1      | 1     |
| ✅       | src/tests/roborockService5.test.ts                                                                  | 3      | 3     |
| ✅       | src/tests/roborockService.setSelectedAreas.test.ts                                                  | 1      | 1     |
| ✅       | src/tests/roborockService.test.ts                                                                   | 39     | 39    |
| ✅       | src/tests/roborockService3.test.ts                                                                  | 9      | 9     |
| ✅       | src/tests/platformRunner.test.ts                                                                    | 18     | 18    |
| ✅       | src/tests/helper.test.ts                                                                            | 9      | 9     |
| ✅       | src/tests/roborockService2.test.ts                                                                  | 3      | 3     |
| ✅       | src/tests/runtimes/handleCloudMessage.test.ts                                                       |        |       |
| ✅       | src/tests/runtimes/handleLocalMessage.test.ts                                                       | 25     | 25    |
| ✅       | src/tests/runtimes/handleHomeDataMessage.test.ts                                                    | 17     | 17    |
| ✅       | src/tests/behaviors/roborock.vacuum/smart/initialData.test.ts                                       | 1      | 1     |
| ✅       | src/tests/behaviors/roborock.vacuum/smart/smart.test.ts                                             | 17     | 17    |
| ✅       | src/tests/behaviors/roborock.vacuum/smart/runtimes.test.ts                                          | 6      | 6     |
| ✅       | src/tests/roborockCommunication/serializer/L01Serializer.test.ts                                    | 2      | 2     |
| ✅       | src/tests/roborockCommunication/Zmodel/mapInfo.test.ts                                              | 2      | 2     |
| ✅       | src/tests/roborockCommunication/Zmodel/deviceStatus.test.ts                                         | 2      | 2     |
| ✅       | src/tests/roborockCommunication/Zmodel/dockInfo.test.ts                                             | 1      | 1     |
| ✅       | src/tests/roborockCommunication/Zmodel/vacuumError.test.ts                                          | 5      | 5     |
| ✅       | src/tests/roborockCommunication/helper/messageBodyBuilderFactory.test.ts                            | 2      | 2     |
| ✅       | src/tests/roborockCommunication/builder/L01MessageBodyBuilder.test.ts                               | 2      | 2     |
| ✅       | src/tests/roborockCommunication/helper/sequence.test.ts                                             | 6      | 6     |
| ✅       | src/tests/roborockCommunication/builder/UnknownMessageBodyBuilder.test.ts                           | 2      | 2     |
| ✅       | src/tests/roborockCommunication/helper/nameDecoder.test.ts                                          | 9      | 9     |
| ✅       | src/tests/roborockCommunication/helper/chunkBuffer.test.ts                                          | 1      | 1     |
| ✅       | src/tests/roborockCommunication/helper/messageSerializerDeserializer.A01B01.test.ts                 | 2      | 2     |
| ✅       | src/tests/roborockCommunication/helper/cryptoHelper.test.ts                                         | 4      | 4     |
| ✅       | src/tests/roborockCommunication/helper/messageSerializerDeserializer.test.ts                        | 3      | 3     |
| ✅       | src/tests/roborockCommunication/helper/messageDeserializer.unit.test.ts                             | 1      | 1     |
| ✅       | src/tests/roborockCommunication/RESTAPI/roborockIoTApi.test.ts                                      | 21     | 21    |
| ✅       | src/tests/roborockCommunication/RESTAPI/roborockAuthenticateApi.test.ts                             | 28     | 28    |
| ✅       | src/tests/roborockCommunication/RESTAPI/roborockAuthenticateApi.unit.test.ts                        | 7      | 7     |
| ✅       | src/tests/roborockCommunication/broadcast/client/LocalNetworkClient.test.ts                         | 28     | 28    |                 |
| ✅       | src/tests/roborockCommunication/broadcast/client/MQTTClient.test.ts                                 | 26     | 26    |
| ✅       | src/tests/roborockCommunication/broadcast/abstractClient.test.ts                                    | 6      | 6     |
| ✅       | src/tests/roborockCommunication/broadcast/messageProcessor.test.ts                                  | 30     | 30    |
| ✅       | src/tests/roborockCommunication/broadcast/clientRouter.test.ts                                      | 11     | 11    |
| ✅       | src/tests/roborockCommunication/broadcast/listener/implementation/chainedConnectionListener.test.ts | 5      | 5     |
| ✅       | src/tests/roborockCommunication/broadcast/listener/implementation/simpleMessageListener.test.ts     | 7      | 7     |
| ✅       | src/tests/roborockCommunication/broadcast/listener/implementation/chainedMessageListener.test.ts    | 3      | 3     |
| ✅       | src/tests/roborockCommunication/broadcast/listener/implementation/syncMessageListener.test.ts       | 11     | 11    |
| ✅       | src/tests/roborockCommunication/broadcast/listener/implementation/connectionStateListener.test.ts   | 8      | 8     |
| ✅       | src/tests/roborockCommunication/broadcast/model/messageContext.test.ts                              | 4      | 4     |
| ✅       | src/tests/roborockCommunication/broadcast/model/responseMessage.test.ts                             | 1      | 1     |
| ✅       | src/tests/roborockCommunication/broadcast/model/requestMessage.test.ts                              | 5      | 5     |
|          | pluginTemplate/src/module.test.ts                                                                   |        |       |

## 4. Tips

## Important Note

**Do not create duplicated records in the migrated table. Each test file should have only one entry showing its migration status and before/after test counts.**

- Migrate and run tests incrementally to catch issues early.
- Use Vitest documentation for advanced features and migration help: https://vitest.dev/

// Jest has been fully removed. All tests now run on Vitest.//

---

**Migration started: src/tests/runtimes/handleCloudMessage.test.ts migrated to Vitest.**
