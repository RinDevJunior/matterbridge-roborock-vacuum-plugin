# Refactor Message Handling Implementation Plan

## Overview

**Status: Phase 1-4 Complete ✅ | Phase 5-6 In Progress**

Refactor message handling to improve type safety, testability, and maintainability by:

1. ✅ Using type-safe `MessagePayload` instead of `unknown` in `DeviceNotifyCallback`
2. 🔄 Extracting message handlers into focused, testable methods

## Completed Work (Phases 1-4)

**Phase 1:** Added `DeviceStatusPayload`, updated `DeviceNotifyCallback` signature
**Phase 2:** Updated message producers (SimpleMessageHandler, PollingService, ConnectionService)
**Phase 3:** Simplified module.ts callback, removed unsafe casts
**Phase 4:** All tests passing (1238/1238), type-check clean, build successful

## Remaining Work

### Phase 5: Documentation and Cleanup

**Status:** Pending

#### Tasks

- [ ] **5.1** Update JSDoc comments

  - Update `DeviceNotifyCallback` documentation
  - Update `MessagePayload` usage examples
  - Add migration notes if needed

- [ ] **5.2** Code cleanup

  - Remove unused imports
  - Remove obsolete defensive type checks
  - Run `npm run lint` and fix any issues

- [ ] **5.3** Documentation updates
  - Update `docs/claude_history.md` with refactor summary
  - Update `docs/to_do.md` to mark refactor complete

---

### Phase 6: Refactor Message Handler Methods

**Status:** Planned

#### Objective

Extract message handling logic from `updateFromMQTTMessage` switch statement into focused, testable private methods.

#### Current Issues

1. `updateFromMQTTMessage` is 58 lines with complex switch logic
2. Error and battery handlers are inline (not reusable or testable in isolation)
3. Inconsistent pattern (LocalMessage/CloudMessage delegate, but Error/Battery don't)
4. Violates Single Responsibility Principle

#### Implementation Steps

**File:** `src/platformRunner.ts`

**Step 6.1:** Extract error handler

- Create `private handleErrorOccurred(robot: RoborockVacuumCleaner, message: DeviceErrorMessage): void`
- Move lines 88-94 logic into new method
- Update switch case to call `this.handleErrorOccurred(robot, message)`

**Step 6.2:** Extract battery handler

- Create `private handleBatteryUpdate(robot: RoborockVacuumCleaner, message: BatteryMessage): void`
- Move lines 97-103 logic into new method
- Update switch case to call `this.handleBatteryUpdate(robot, message)`

**Step 6.3:** Simplify switch statement

- Verify all cases now delegate to focused methods
- Remove inline logic from switch cases
- Ensure consistent delegation pattern

**Step 6.4:** Add unit tests

- Test `handleErrorOccurred` in isolation
- Test `handleBatteryUpdate` in isolation
- Verify existing integration tests still pass

**Verification:**

- TypeScript compilation succeeds
- All tests pass
- Methods follow Single Responsibility Principle
- Improved testability and maintainability

---

### Phase 5: Documentation and Cleanup

#### Step 5.1: Update Code Comments

**Action:** Update JSDoc comments to reflect new type-safe approach

- Update `DeviceNotifyCallback` documentation
- Update `MessagePayload` usage examples
- Add migration notes if needed

---

#### Step 5.2: Remove Unused Code

**Action:** Clean up any obsolete type assertions or helper code

- Remove unused imports
- Remove defensive type checks that are now compile-time guarantees
- Follow coding standards from CLAUDE.md

---

## Success Criteria

**Completed (Phases 1-4):**

- ✅ No unsafe type casts in message handling code
- ✅ All message types have corresponding MessagePayload interface
- ✅ DeviceNotifyCallback uses MessagePayload parameter
- ✅ All tests pass (1238/1238)
- ✅ TypeScript compiles without errors
- ✅ No runtime behavior changes

**Remaining (Phases 5-6):**

- 🔄 JSDoc and documentation updated
- 🔄 Unused code removed
- 🔄 Message handlers extracted into focused methods
- 🔄 Handler methods unit tested

---

## Implementation Notes

- Each phase should be committed separately
- Run `npm test` after each phase
- Keep changes focused and atomic
- Follow TypeScript Development guidelines from CLAUDE.md

---

## Completed Phases Summary

<details>
<summary>Phase 1: Type System Updates ✅</summary>

- Added `DeviceStatusPayload` interface
- Updated `DeviceNotifyCallback` signature: `(payload: MessagePayload) => void`
- Added type guard `isDeviceStatus()`
</details>

<details>
<summary>Phase 2: Update Message Producers ✅</summary>

- Updated SimpleMessageHandler (`onError`, `onBatteryUpdate`, `onStatusChanged`)
- Updated PollingService to construct `LocalMessagePayload`
- Verified ConnectionService (no changes needed)
</details>

<details>
<summary>Phase 3: Update Message Consumer ✅</summary>

- Simplified module.ts callback to single line
- Removed all unsafe casts (`as unknown`, `as { duid?: string }`)
</details>

<details>
<summary>Phase 4: Testing and Validation ✅</summary>

- Fixed 8 TypeScript compilation errors
- Updated 7 test files with new signatures
- All 1238 tests passing
- Build successful
</details>
