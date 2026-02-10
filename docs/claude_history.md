# Claude History

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
