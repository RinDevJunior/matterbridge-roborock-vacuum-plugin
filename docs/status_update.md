# Status Update Analysis

**Date:** 2026-02-07
**Status:** Matrix Completed - Ready for Implementation

## Problem Statement

The `handleDeviceStatusUpdate` method in [platformRunner.ts:163-180](../src/platformRunner.ts#L163-L180) currently determines Matter robot endpoint status using only `message.status` (OperationStatusCode). However, `StatusChangeMessage` contains additional contextual properties that may be needed to correctly determine the robot's actual state in certain scenarios.

## Current Implementation

### StatusChangeMessage Structure

```typescript
// src/roborockCommunication/models/deviceStatus.ts
class StatusChangeMessage {
  constructor(
    public readonly duid: string,
    public readonly status: OperationStatusCode,     // ✅ Currently used
    public readonly inCleaning: boolean | undefined,  // ❌ Not used
    public readonly inReturning: boolean | undefined, // ❌ Not used
    public readonly inFreshState: boolean | undefined,// ❌ Not used
    public readonly isLocating: boolean | undefined,  // ❌ Not used
    public readonly isExploring: boolean | undefined, // ❌ Not used
    public readonly inWarmup: boolean | undefined,    // ❌ Not used
  ) {}
}
```

### Current Handler

```typescript
// src/platformRunner.ts:163-180
private handleDeviceStatusUpdate(robot: RoborockVacuumCleaner, message: StatusChangeMessage): void {
  this.platform.log.debug(`Handling device status update: ${debugStringify(message)}`);

  const state = state_to_matter_state(message.status);
  if (state) {
    robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(state), this.platform.log);
  }

  const includeDockStationStatus = this.platform.configManager.includeDockStationStatus;
  const operationalStateId = state_to_matter_operational_status(state);
  const dssHasError = includeDockStationStatus && hasDockingStationError(robot.dockStationStatus);
  if (dssHasError) {
    triggerDssError(robot, this.platform);
    return;
  }
  if (operationalStateId !== undefined) robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, this.platform.log);
}
```

## Data Flow Analysis

### Where StatusChangeMessage is Created

1. **simpleMessageListener.ts** (MQTT real-time updates)

   ```typescript
   // Lines 61-70 - All flags populated from messageBody
   const statusChangeMessage = new StatusChangeMessage(
     message.duid,
     state,
     messageBody.in_cleaning !== undefined ? Boolean(messageBody.in_cleaning) : undefined,
     messageBody.in_returning !== undefined ? Boolean(messageBody.in_returning) : undefined,
     messageBody.in_fresh_state !== undefined ? Boolean(messageBody.in_fresh_state) : undefined,
     messageBody.is_locating !== undefined ? Boolean(messageBody.is_locating) : undefined,
     messageBody.is_exploring !== undefined ? Boolean(messageBody.is_exploring) : undefined,
     messageBody.in_warmup !== undefined ? Boolean(messageBody.in_warmup) : undefined,
   );
   ```

2. **handleHomeDataMessage.ts** (REST API polling)
   ```typescript
   // Lines 65-79 - All flags set to undefined (data not available from REST API)
   platform.platformRunner.updateRobotWithPayload({
     type: NotifyMessageTypes.DeviceStatus,
     data: {
       duid: device.duid,
       status: state,
       inCleaning: undefined,    // ⚠️ TODO: Add real values if available
       inReturning: undefined,
       inFreshState: undefined,
       isLocating: undefined,
       isExploring: undefined,
       inWarmup: undefined,
     },
   });
   ```

### CloudMessageResult Fields (MQTT Data Source)

```typescript
// src/roborockCommunication/models/messageResult.ts
export interface CloudMessageResult {
  state: number;              // ✅ Used to determine status
  in_cleaning: number;        // ⚠️ Available but unused
  in_returning: number;       // ⚠️ Available but unused
  in_fresh_state: number;     // ⚠️ Available but unused
  is_locating: number;        // ⚠️ Available but unused
  is_exploring?: number;      // ⚠️ Available but unused
  in_warmup?: number;         // ⚠️ Available but unused
  // ... 50+ other fields
}
```

## Identified Edge Cases

### Scenario 1: Returning While "Cleaning"

**Symptom:** Robot shows as "Running" when it's actually returning to dock

```
status = 5 (Cleaning)
inReturning = true           // ⚠️ Robot is actually seeking charger
```

**Expected:** `RvcOperationalState.SeekingCharger`
**Actual:** `RvcOperationalState.Running`

### Scenario 2: Locating During Operation

**Symptom:** Robot may appear to be cleaning when it's actually locating itself

```
status = 5 (Cleaning)
isLocating = true            // ⚠️ Robot is re-positioning
```

**Expected:** Different operational state or special handling
**Actual:** `RvcOperationalState.Running`

### Scenario 3: Fresh State After Cleaning

**Symptom:** Robot completed cleaning but state still shows as active

```
status = 5 (Cleaning)
inFreshState = true          // ⚠️ Robot just finished cleaning
```

**Expected:** Transition to idle/docked state
**Actual:** May remain in cleaning state

### Scenario 4: Warmup Phase

**Symptom:** Robot is warming up before operation

```
status = 22 (EmptyingDustContainer)
inWarmup = true              // ⚠️ Robot preparing for operation
```

**Expected:** Special warmup state handling
**Actual:** Current behavior unknown

### Scenario 5: Exploring/Mapping Mode

**Symptom:** Robot is exploring but status doesn't clearly indicate mapping

```
status = 29 (Mapping) OR status = 5 (Cleaning)
isExploring = true           // ⚠️ Robot is in exploration mode
```

**Expected:** `RvcRunMode.ModeTag.Mapping`
**Actual:** Depends on status code only

## State Mapping Functions Analysis

### state_to_matter_state()

Maps OperationStatusCode → RvcRunMode.ModeTag (Cleaning, Mapping, Idle)

**Current Logic:**

- Many status codes → `Cleaning`
- `Mapping` → `Mapping`
- Default/Idle states → `Idle`

**Issues:**

- No consideration of contextual flags
- `status=5 (Cleaning) + inReturning=true` still maps to Cleaning

### state_to_matter_operational_status()

Maps OperationStatusCode → RvcOperationalState

**Current Logic:**

- Running, Error, Paused, Stopped, SeekingCharger, Docked

**Issues:**

- No use of contextual flags
- `status=5 + inReturning=true` should be SeekingCharger, not Running

## Comparison with Other Handlers

### handleCloudMessage (Deprecated)

- Lines 33-48: Uses only status number from `data.dps[Protocol.status_update]`
- No use of contextual flags

### handleLocalMessage (Deprecated)

- Lines 42-45: Uses only `data.state` via `state_to_matter_state()`
- No use of contextual flags from CloudMessageResult

## Root Cause Analysis

1. **Historical Implementation**

   - Original code used direct status codes
   - Contextual flags added later but not integrated

2. **Data Source Inconsistency**

   - MQTT messages provide full contextual flags
   - REST API polling doesn't provide these flags
   - Handler must work with both data sources

3. **Missing Business Logic**
   - No documented rules for how flags modify base status
   - Unclear priority when flags conflict with status code

## Implemented Solution: Comprehensive State Resolution Matrix

A complete **56-row state resolution matrix** has been designed and documented to address all identified edge cases. Invalid state combinations have been removed (Cleaning+inFreshState, Charging+isExploring/isLocating).

**Matrix Location:** [state_resolution_matrix.md](./state_resolution_matrix.md)

### Matrix Features

#### Status Override Rules (Highest Priority)

Certain status codes ignore ALL modifier flags:

- **Status 3 (Idle)**: Always → Idle (16384) + Docked (66)
- **Status 22 (EmptyingDustContainer)**: Always → Cleaning (16385) + EmptyingDustBin (67)
- **Status 23 (WashingTheMop)**: Always → Cleaning (16385) + CleaningMop (68)
- **Status 26 (WashingMop)**: Always → Cleaning (16385) + CleaningMop (68)
- **Status 29 (Mapping)**: Always → Mapping (16386) + Running (1)

#### Cleaning Status Special Overrides

When `status = 5` (Cleaning), certain flags override all others:

- **inWarmup=true**: → Cleaning (16385) + CleaningMop (68)
- **isLocating=true**: → Cleaning (16385) + UpdatingMaps (70)
- **isExploring=true**: → Cleaning (16385) + UpdatingMaps (70)

#### Modifier Priority Chain

For other statuses, modifiers apply in priority order:

1. **inReturning** (High Priority) - Sets SeekingCharger operational state (except Paused status → keeps Paused state)
2. **isExploring** (Medium Priority) - Changes run mode to Mapping (blocked on Charging status)
3. **inFreshState** (Low Priority) - Transitions to Idle/Docked (only for status=8 Charging)

### Flags Usage Summary

**Implemented:**

- ✅ `inReturning` - High priority modifier, overrides to SeekingCharger
- ✅ `isExploring` - Medium priority modifier, overrides to Mapping mode
- ✅ `inFreshState` - Low priority modifier, transitions to Idle/Docked
- ✅ `inWarmup` - Status override for Cleaning (Status 5), sets CleaningMop state
- ✅ `isLocating` - Status override for Cleaning (Status 5), sets UpdatingMaps state

**Not Used:**

- ⚠️ `inCleaning` - Available but not used in state resolution

### Edge Cases Resolved

All identified edge cases are now covered by the matrix:

| Scenario                   | Status | Flags          | Resolved State             | Matrix Row |
| -------------------------- | ------ | -------------- | -------------------------- | ---------- |
| Returning While Cleaning   | 5      | inReturning=T  | Cleaning + SeekingCharger  | Row 16     |
| Locating During Cleaning   | 5      | isLocating=T   | Cleaning + UpdatingMaps    | Row 14     |
| Exploring During Cleaning  | 5      | isExploring=T  | Cleaning + UpdatingMaps    | Row 15     |
| Fresh State After Cleaning | 5      | inFreshState=T | Idle + Docked              | Row 18     |
| Fresh State While Charging | 8      | inFreshState=T | Idle + Docked              | Row 31     |
| Warmup Phase               | 5      | inWarmup=T     | Cleaning + CleaningMop     | Row 13     |
| Washing Mop                | 23     | (any)          | Cleaning + CleaningMop     | Row 59     |
| Returning to Wash Mop      | 26     | (any)          | Cleaning + CleaningMop     | Row 60     |
| Drying Mop                 | 28     | (any)          | Idle + CleaningMop         | Row 61     |
| Emptying Dust Container    | 22     | (any)          | Cleaning + EmptyingDustBin | Row 58     |

### Matrix Validation

The matrix has been validated against real cleaning log data:

- **Log File:** [cleanning_process.log](../exampleData/cleanning_process.log)
- **Analysis:** [cleaning_process_analysis.md](./cleaning_process_analysis.md)
- **Coverage:** All 31 state transitions correctly mapped
- **Confirmed:** Status Override Rules and modifier priority chain working as expected

## Original Proposed Solutions (Historical)

### Option 1: Enhanced State Resolution (Recommended)

Create a new function that considers all contextual flags:

```typescript
function resolveActualState(message: StatusChangeMessage): {
  runMode: RvcRunMode.ModeTag;
  operationalState: RvcOperationalState.OperationalState;
} {
  const baseState = state_to_matter_state(message.status);
  const baseOperationalState = state_to_matter_operational_status(message.status);

  // Override based on contextual flags
  if (message.inReturning === true) {
    return {
      runMode: RvcRunMode.ModeTag.Cleaning,
      operationalState: RvcOperationalState.OperationalState.SeekingCharger
    };
  }

  if (message.isExploring === true) {
    return {
      runMode: RvcRunMode.ModeTag.Mapping,
      operationalState: baseOperationalState
    };
  }

  if (message.inFreshState === true && message.status === OperationStatusCode.Cleaning) {
    // Robot just finished, transition to appropriate state
    return {
      runMode: RvcRunMode.ModeTag.Idle,
      operationalState: RvcOperationalState.OperationalState.Docked
    };
  }

  // ... handle other flags

  return { runMode: baseState, operationalState: baseOperationalState };
}
```

**Pros:**

- Handles all edge cases
- Maintains backward compatibility
- Clear business logic

**Cons:**

- Requires understanding Roborock flag semantics
- May need testing with real devices

### Option 2: Flag-Based State Modifiers

Create separate modifier functions for each flag:

```typescript
function applyInReturningModifier(state: State, message: StatusChangeMessage): State {
  if (message.inReturning === true) {
    return { ...state, operationalState: RvcOperationalState.OperationalState.SeekingCharger };
  }
  return state;
}

function applyIsExploringModifier(state: State, message: StatusChangeMessage): State {
  if (message.isExploring === true) {
    return { ...state, runMode: RvcRunMode.ModeTag.Mapping };
  }
  return state;
}

// Chain modifiers
let state = getBaseState(message.status);
state = applyInReturningModifier(state, message);
state = applyIsExploringModifier(state, message);
// ... apply other modifiers
```

**Pros:**

- Modular and testable
- Easy to add new modifiers
- Clear separation of concerns

**Cons:**

- Order of modifiers matters
- Potential for conflicting modifications

### Option 3: Minimal Fix - Priority Flags Only

Only handle the most critical flags that cause incorrect status:

```typescript
private handleDeviceStatusUpdate(robot: RoborockVacuumCleaner, message: StatusChangeMessage): void {
  this.platform.log.debug(`Handling device status update: ${debugStringify(message)}`);

  // Check inReturning flag first - highest priority
  if (message.inReturning === true) {
    robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(RvcRunMode.ModeTag.Cleaning), this.platform.log);
    robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', RvcOperationalState.OperationalState.SeekingCharger, this.platform.log);
    return;
  }

  // Existing logic for other cases
  const state = state_to_matter_state(message.status);
  // ... rest of current implementation
}
```

**Pros:**

- Minimal changes
- Quick fix for most common issues
- Low risk

**Cons:**

- Doesn't handle all edge cases
- Technical debt

## Testing Requirements

### Unit Tests Needed

1. **Status with inReturning flag**

   ```typescript
   test('should map to SeekingCharger when inReturning is true', () => {
     const message = new StatusChangeMessage(
       'test-duid',
       OperationStatusCode.Cleaning,
       undefined,
       true,  // inReturning
       undefined,
       undefined,
       undefined,
       undefined
     );
     // Assert: operationalState = SeekingCharger
   });
   ```

2. **Status with isExploring flag**
3. **Status with inFreshState flag**
4. **Multiple flags active**
5. **Flags from MQTT vs REST API**

### Integration Tests Needed

1. Robot returning to dock during cleaning
2. Robot exploring new area
3. Robot completing cleaning cycle
4. Robot warming up before operation

## Data Collection Needs

To implement proper flag handling, we need:

1. **Real-world message samples**

   - Capture actual MQTT messages with various flag combinations
   - Document when each flag is `true` vs `false`

2. **Flag semantics documentation**

   - What does each flag actually mean?
   - Can multiple flags be true simultaneously?
   - What's the priority when flags conflict?

3. **Roborock API documentation**
   - Official meaning of each flag
   - Expected behavior for each combination

## Implementation Roadmap

### Phase 1: Core Implementation ✅ READY

**Prerequisites (Completed):**

- ✅ State resolution matrix designed (56 rows, invalid states removed)
- ✅ Matrix validated against real cleaning log
- ✅ All edge cases documented and mapped
- ✅ Modifier priority chain defined

**Next Steps:**

1. Create `stateResolver.ts` module in `src/share/`
2. Implement state resolution function based on matrix
3. Add comprehensive unit tests for all 56 matrix rows
4. Update `handleDeviceStatusUpdate` to use new resolver

**Implementation Pattern:**

```typescript
// src/share/stateResolver.ts
export function resolveRobotState(message: StatusChangeMessage): {
  runMode: RvcRunMode.ModeTag;
  operationalState: RvcOperationalState.OperationalState;
} {
  // 1. Check Status Override Rules first (highest priority)
  if (status === 3) return { runMode: Idle, operationalState: Docked };
  if (status === 22) return { runMode: Cleaning, operationalState: EmptyingDustBin };
  // ... other status overrides

  // 2. Check Cleaning + modifier overrides (Status 5 only)
  if (status === 5 && inWarmup === true) return { runMode: Cleaning, operationalState: CleaningMop };
  if (status === 5 && isLocating === true) return { runMode: Cleaning, operationalState: UpdatingMaps };
  if (status === 5 && isExploring === true) return { runMode: Cleaning, operationalState: UpdatingMaps };

  // 3. Apply modifiers in priority order
  if (inReturning === true) return { runMode: Cleaning, operationalState: SeekingCharger };
  if (isExploring === true) return { runMode: Mapping, operationalState: baseOpState };
  if (inFreshState === true && (status === 5 || status === 8)) return { runMode: Idle, operationalState: Docked };

  // 4. Fall back to base state mapping
  return { runMode: baseRunMode, operationalState: baseOpState };
}
```

### Phase 2: Testing & Validation

1. **Unit Tests** (Required before merge)

   - All 56 matrix rows covered
   - Status override rules tested
   - Modifier priority chain tested
   - Edge cases (multiple flags active)
   - REST API scenarios (all flags undefined)

2. **Integration Tests** (Nice to have)
   - Test with real MQTT messages
   - Verify state transitions during cleaning cycle
   - Confirm behavior matches cleaning_process.log

### Phase 3: Code Organization

1. **File Structure:**

   ```
   src/share/
   ├── stateResolver.ts          (new - state resolution logic)
   └── function.ts                (existing - keep backward compatibility)

   src/tests/share/
   └── stateResolver.test.ts      (new - comprehensive tests)
   ```

2. **Deprecation Path:**
   - Keep existing `state_to_matter_state()` and `state_to_matter_operational_status()` for backward compatibility
   - Mark as deprecated with JSDoc comments
   - Gradually migrate all call sites to new `resolveRobotState()`

### Phase 4: Documentation

1. **Code Documentation:**

   - Add JSDoc comments to `resolveRobotState()`
   - Document each status override rule
   - Document modifier priority chain
   - Add examples for common scenarios

2. **User Documentation:**
   - Update README if needed
   - Add troubleshooting guide for state resolution issues

### Phase 5: Monitoring & Refinement

1. **Add Debug Logging:**

   ```typescript
   this.platform.log.debug(`State resolution: status=${message.status}, ` +
     `flags={inReturning=${message.inReturning}, isExploring=${message.isExploring}, ...}, ` +
     `resolved={runMode=${resolved.runMode}, operationalState=${resolved.operationalState}}`);
   ```

2. **Monitor for Edge Cases:**
   - Watch logs for unexpected flag combinations
   - Validate against user-reported issues
   - Refine matrix if new scenarios discovered

## References

### Key Files

- [platformRunner.ts](../src/platformRunner.ts) - Status update handler
- [deviceStatus.ts](../src/roborockCommunication/models/deviceStatus.ts) - StatusChangeMessage model
- [messageResult.ts](../src/roborockCommunication/models/messageResult.ts) - CloudMessageResult interface
- [function.ts](../src/share/function.ts) - State mapping functions
- [simpleMessageListener.ts](../src/roborockCommunication/routing/listeners/implementation/simpleMessageListener.ts) - Message parsing

### Related Code

- [handleHomeDataMessage.ts](../src/runtimes/handleHomeDataMessage.ts) - REST API polling
- [handleCloudMessage.ts](../src/runtimes/handleCloudMessage.ts) - Deprecated cloud handler
- [handleLocalMessage.ts](../src/runtimes/handleLocalMessage.ts) - Deprecated local handler

## Next Steps

### Completed ✅

1. [x] Review and discuss proposed solutions
2. [x] Decide on implementation approach (Option 1 - Enhanced State Resolution)
3. [x] Gather real-world message data (cleaning_process.log analyzed)
4. [x] Define flag semantics (documented in state_resolution_matrix.md)
5. [x] Design comprehensive state resolution matrix (56 rows)
6. [x] Validate matrix against real cleaning cycle data

### Pending Implementation 🚧

1. [ ] Create `src/share/stateResolver.ts` module
2. [ ] Implement `resolveRobotState()` function based on matrix
3. [ ] Write comprehensive unit tests for all 56 matrix rows
4. [ ] Update `handleDeviceStatusUpdate` in platformRunner.ts
5. [ ] Add debug logging for state resolution
6. [ ] Test with real devices
7. [ ] Update code documentation
