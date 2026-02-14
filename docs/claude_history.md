# Claude History

## 2026-02-14

### Refactoring: Split `PlatformLifecycle` into 3 classes

**Problem:** `PlatformLifecycle` (~430 lines) handled three distinct concerns: lifecycle orchestration, device configuration, and device discovery.

**Solution:**

- Extracted `DeviceDiscovery` class — owns `roborockService`, handles authentication and device listing
- Extracted `DeviceConfigurator` class — owns `rrHomeId`, handles device setup, room mapping, and Matterbridge registration
- Slimmed `PlatformLifecycle` to orchestrator (~180 lines) — delegates to `discovery` and `configurator`
- Added `roborockService` guard in lifecycle before calling configurator
- Getter/setter delegation chain: `module.ts` → `lifecycle` → `discovery`/`configurator`

**Files created:**

- `src/platform/deviceDiscovery.ts` — `DeviceDiscovery` class
- `src/platform/deviceConfigurator.ts` — `DeviceConfigurator` class

**Files modified:**

- `src/platform/platformLifecycle.ts` — Slimmed to orchestrator, delegates to `discovery` and `configurator`
- `src/tests/platform/platformLifecycle.test.ts` — Updated spies to target `discovery`/`configurator`, set `roborockService` in discovery mocks
- `src/tests/module.lifecycle.test.ts` — Updated discovery spies
- `src/tests/module.startup.test.ts` — Updated discovery spies
- `src/tests/module.complete.coverage.test.ts` — Updated bracket-access to `configurator`, pass `roborockService` args

### Refactoring: Move `onConfigureDevice`, `configureDevice`, `addDevice` to `PlatformLifecycle`

**Problem:** Device configuration methods (`onConfigureDevice`, `configureDevice`, `addDevice`) in `module.ts` were lifecycle concerns connected via callback indirection (`LifecycleDependencies.onConfigureDevice`).

**Solution:**

- Moved all three methods from `module.ts` to `PlatformLifecycle` as private methods
- `PlatformLifecycle` now owns `rrHomeId` property (set during device configuration)
- Added getter/setter for `rrHomeId` on `RoborockMatterbridgePlatform` delegating to lifecycle (backward compatibility for `platformRunner.ts`)
- Removed `onConfigureDevice` from `LifecycleDependencies` interface
- Created `MapInfoPlatformContext` interface in `RoomMap.ts` to decouple `fromMapInfo` from concrete `RoborockMatterbridgePlatform` type
- Methods access parent class methods (`validateDevice`, `registerDevice`, `setSelectDevice`, `version`, `matterbridge`) via `this.platform`
- Cleaned up unused imports from `module.ts`

**Files modified:**

- `src/platform/platformLifecycle.ts` — Added three methods, `rrHomeId`, new imports
- `src/module.ts` — Removed three methods, added `rrHomeId` getter/setter, cleaned imports
- `src/core/application/models/RoomMap.ts` — Added `MapInfoPlatformContext` interface, changed `fromMapInfo` parameter type
- `src/tests/platform/platformLifecycle.test.ts` — Removed `onConfigureDevice` from mock deps, added `onConfigureDevice` spy to onStart tests
- `src/tests/module.lifecycle.test.ts` — Removed `onConfigureDevice` mock from device config tests
- `src/tests/module.complete.coverage.test.ts` — Updated bracket-access to go through `platform.lifecycle`

### Refactoring: Move `discoverDevices` to `PlatformLifecycle`

**Problem:** `discoverDevices` in `module.ts` was a lifecycle concern called during `onStart` but lived in the platform class, connected via callback indirection (`LifecycleDependencies.startDeviceDiscovery`).

**Solution:**

- Moved `discoverDevices` method from `module.ts` to `PlatformLifecycle` as a private method
- `PlatformLifecycle` now owns `roborockService` (creates it during discovery, cleans it up on shutdown)
- Added `DeviceRegistry` as a constructor parameter to `PlatformLifecycle`
- Removed `startDeviceDiscovery` and `getRoborockService` from `LifecycleDependencies` interface
- Added getter/setter for `roborockService` on `RoborockMatterbridgePlatform` delegating to lifecycle (backward compatibility for `platformRunner.ts` and tests)
- Removed unused `rvcInterval` property from `module.ts`
- Cleaned up unused imports from `module.ts` (`axios`, `crypto`, `getBaseUrl`, `RoborockAuthenticateApi`, `RoborockIoTApi`, `isSupportedDevice`, `DEFAULT_REFRESH_INTERVAL_SECONDS`)

**Files modified:**

- `src/platform/platformLifecycle.ts` — Added `discoverDevices`, `roborockService` ownership, `DeviceRegistry` param
- `src/module.ts` — Removed `discoverDevices`, added getter/setter, cleaned imports
- `src/tests/platform/platformLifecycle.test.ts` — Updated mock deps, constructor calls, shutdown assertions
- `src/tests/module.lifecycle.test.ts` — Removed discovery simulation tests, updated `startDeviceDiscovery` overrides to spy on lifecycle
- `src/tests/module.startup.test.ts` — Updated `startDeviceDiscovery` override to spy on lifecycle

## 2026-02-13

### Verification: Authentication Behaviors Audit

**Problem:** Verify three authentication behaviors: (1) cache on success + clear forceAuthentication, (2) prevent start on failure + empty MFA code, (3) handle missing credentials per method.

**Findings:**

- Behavior 1 (auth success): Fully implemented. User data cached via `UserDataRepository.saveUserData()`, `forceAuthentication` reset in `module.ts:161-165`.
- Behavior 2 (auth failed): Partially implemented. Plugin start is prevented and errors are logged, but MFA code is NOT cleared from config on failure.
- Behavior 3 (auth not set): Partially implemented. `validateAuthentication()` exists in `PlatformConfigManager` but is never called. Password method sends empty string to API instead of failing early with clear message.

**Documentation:**

- Created `docs/auth_process.md` with detailed analysis and gap identification.

## 2026-02-10

### Release: Version 1.1.3-rc16

**Changes:**

- Updated version from 1.1.3-rc15 to 1.1.3-rc16
- Updated package.json version and build:package script
- Updated matterbridge-roborock-vacuum-plugin.schema.json description
- Updated matterbridge-roborock-vacuum-plugin.config.json version
- Requires matterbridge@3.5.3

**Files modified:**

- `package.json`
- `matterbridge-roborock-vacuum-plugin.schema.json`
- `matterbridge-roborock-vacuum-plugin.config.json`

### Feature: Auth Error Backoff with Selective Reconnection

**Problem:** MQTT service blocks connection due to excessive failed auth requests, and mqtt.js built-in auto-reconnect continues indefinitely after auth errors.

**Solution:**

- Keep mqtt.js auto-reconnect enabled for normal errors (network issues, timeouts, etc.)
- Implement auth error backoff mode in `MQTTClient`:
  - Track consecutive auth errors (MQTT error code 5)
  - After 5 consecutive auth errors: terminate connection, wait 60 minutes, then reconnect
  - Reset counter on successful connection
  - Properties: `consecutiveAuthErrors`, `authErrorBackoffTimeout`
- Implement `terminateConnection()` method:
  - Clears `keepConnectionAliveInterval` and `authErrorBackoffTimeout`
  - Calls `mqttClient.end(true)` to force-close and stop auto-reconnect
  - Cleans up state
- Fix `ConnectionStateListener.onConnected()`:
  - Reset `shouldReconnect = true` on successful connection
  - Restores manual reconnect capability after auth error recovery
- Added `.unref()` to intervals/timeouts for clean process exit

**Files modified:**

- `src/roborockCommunication/mqtt/mqttClient.ts`
- `src/roborockCommunication/routing/listeners/implementation/connectionStateListener.ts`

### Fix: Axios Type Incompatibility in Tests

**Problem:** TypeScript error in `iotClient.test.ts` due to module resolution mismatch between axios and axios-mock-adapter types.

**Solution:**

- Added type cast `as any` when passing axios instance to MockAdapter constructor
- Resolves TypeScript error without affecting test functionality

**Files modified:**

- `src/tests/roborockCommunication/api/iotClient.test.ts`

### Review: handleErrorOccurred Implementation Analysis (Initial)

**Problem:** Code review requested for error handling logic in platformRunner.

**Findings:**

- Critical bug: Early return prevents error clearing when vacuum is running (line 183-184)
- Type coercion issue: Using `==` instead of `===` (line 183)
- Falsy value bug: `dockStationStatus = 0` is valid but treated as falsy (line 181)
- Inconsistent state management between error setting and clearing
- Complex control flow with 4 exit points

**Files reviewed:**

- `src/platformRunner.ts:167-205`
- `src/model/VacuumStatus.ts`
- `src/model/DockStationStatus.ts`

**Documentation:**

- Created `docs/handleErrorOccured_error.md` with detailed analysis and suggested fixes

### Review: handleErrorOccurred Second Review (After User Fixes)

**Problem:** User implemented fixes from first review, second review requested.

**Previous Issues Fixed:**

- ✅ Type coercion: `==` → `===`
- ✅ Falsy value check: Added explicit null/undefined check for `dockStationStatus`
- ✅ JSDoc comment completed
- ⚠️ Error clearing partially fixed but introduced new issues

**New Critical Issues Found:**

- Line 203: Restores `operationalState` to `Error` when clearing dock errors (prevents error→normal transition)
- Lines 179-183: Forces state to `Running` based on old state, not actual device status
- Architectural issue: Conflicting state management between `handleErrorOccurred` and `handleDeviceStatusUpdate`
- Code flow redundancy between lines 179-183 and 187-188

**Recommendations:**

- `handleErrorOccurred` should manage ONLY `operationalError`, not `operationalState` (except setting to Error)
- Remove line 203 that restores state when clearing dock errors
- Remove line 182 that redundantly sets state to Running
- Let `handleDeviceStatusUpdate` be single source of truth for state transitions

**Documentation:**

- Updated `docs/handleErrorOccured_error.md` with second review findings and improved implementation suggestion

### Verification: First Review Issues Status Check

**Problem:** User requested verification of which first review issues are still valid.

**Verification Results:**

✅ **Fully Fixed (3/7):**

- Type coercion `==` → `===`
- Falsy value check for `dockStationStatus`
- Truncated JSDoc comment

⚠️ **Partially Fixed (2/7):**

- Early return bug: Error clearing added but introduced new issues
- Inconsistent state management: Now updates both but line 203 restores Error state

❌ **Not Fixed (2/7):**

- Complex control flow (4 exit points)
- Method complexity (multiple responsibilities)

**Critical Finding:**

Line 203 bug is the SAME root cause as first review Issue #4, manifesting differently:

- First review: Didn't update state → stuck in Error
- Current: Updates state incorrectly → restored to Error

**Documentation:**

- Added verification section to `docs/handleErrorOccured_error.md` with detailed status table and comparison

### Cleanup: Documentation Simplification

**Problem:** User requested to clean up documentation and keep only active issues.

**Action:**

- Removed historical context from first review (already fixed issues)
- Removed verification section (historical comparison)
- Kept only active critical issues and implementation suggestions
- Document now focuses on 4 active issues:
  - Line 203: Restores Error state when clearing dock errors
  - Lines 179-183: Incorrect state assumption
  - Architectural issue: Conflicting state management
  - Code flow redundancy

**Files modified:**

- `docs/handleErrorOccured_error.md`

### Review: handleErrorOccurred Third Review (After Critical Fixes)

**Problem:** User implemented suggested fixes, requested final review.

**Changes Verified:**

- ✅ Removed line 203 that was restoring Error state when clearing dock errors
- ✅ Removed redundant state update to Running (line 182)
- ✅ Simplified control flow by removing redundant condition
- ✅ Now only manages `operationalError` when clearing errors, not `operationalState`

**Assessment:**

✅ **APPROVED** - All critical bugs resolved:

- Critical bug: Error state restoration → FIXED
- Redundant state updates → FIXED
- State management architecture → IMPROVED (follows Single Responsibility Principle)

**Remaining Considerations:**

- ⚠️ Potential race condition with `handleDeviceStatusUpdate` (theoretical, needs verification)
- ℹ️ Message timing and ordering questions (low priority)
- Code complexity acceptable (4 exit points justified)

**Code Quality:**

| Aspect           | Status      |
| ---------------- | ----------- |
| Critical bugs    | ✅ Fixed    |
| Type safety      | ✅ Good     |
| State management | ✅ Improved |
| Error handling   | ✅ Good     |
| Code clarity     | ✅ Good     |
| Testability      | ✅ Good     |

**Recommendations:**

1. Deploy and monitor - production-ready
2. Add unit tests for critical scenarios
3. Optionally review `handleDeviceStatusUpdate` for race condition mitigation

**Files reviewed:**

- `src/platformRunner.ts:167-208`

**Documentation:**

- Updated `docs/handleErrorOccured_error.md` with final review and approval

### Fix: ESLint Vitest Plugin Configuration Error

**Problem:** ESLint failing with `TypeError: Cannot read properties of undefined (reading 'additionalTestBlockFunctions')` when running lint command.

**Root Cause:** Bug in `@vitest/eslint-plugin` version 1.6.6 where the `vitest/no-standalone-expect` rule incorrectly destructures options parameter in ESLint flat config.

**Solution:**

- Updated `@vitest/eslint-plugin` from 1.6.6 to 1.6.7
- Properly configured vitest in ESLint flat config by spreading the recommended config
- Added vitest environment globals to languageOptions
- Removed unused import `getOperationalErrorState` from `src/platformRunner.ts`

**Files modified:**

- `package.json` - Updated `@vitest/eslint-plugin` to 1.6.7
- `eslint.config.js` - Properly spread vitest recommended config, added vitest globals
- `src/platformRunner.ts` - Removed unused import
