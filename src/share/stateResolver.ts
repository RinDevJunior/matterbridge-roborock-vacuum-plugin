import { RvcRunMode, RvcOperationalState } from 'matterbridge/matter/clusters';
import { StatusChangeMessage } from '../roborockCommunication/models/deviceStatus.js';
import { OperationStatusCode } from '../roborockCommunication/enums/operationStatusCode.js';
import { state_to_matter_operational_status, state_to_matter_state } from './function.js';

export interface ResolvedState {
  runMode: RvcRunMode.ModeTag;
  operationalState: RvcOperationalState.OperationalState;
}

/**
 * Resolves the robot's state based on status code and modifier flags.
 *
 * Implements a 56-row state resolution matrix with three priority levels:
 *
 * 1. **Status Override Rules** (Highest Priority)
 *    - Certain status codes ignore ALL modifier flags
 *    - Examples: Idle (3), WashingTheMop (23), GoingToWashTheMop (26), etc.
 *
 * 2. **Cleaning Status Special Overrides**
 *    - When status = 5 (Cleaning), modifiers apply in explicit priority order:
 *      a. inWarmup (Highest) - Sets CleaningMop operational state
 *      b. inReturning (Second) - Sets SeekingCharger operational state
 *      c. isLocating/isExploring (Third) - Sets UpdatingMaps operational state
 *      d. inFreshState (N/A) - Not applicable to Cleaning status
 *
 * 3. **Modifier Priority Chain**
 *    - For all other cases, modifiers apply in priority order:
 *      a. inReturning (High) - Sets SeekingCharger operational state (except Paused → Paused)
 *      b. isExploring (Medium) - Changes run mode to Mapping (blocked on Charging)
 *      c. inFreshState (Low) - Transitions to Idle/Docked (only for status 8 Charging)
 *
 * @param message StatusChangeMessage containing status code and modifier flags
 * @returns ResolvedState with runMode and operationalState
 *
 * @see misc/state_resolution_matrix.md - Complete 56-row matrix documentation
 */
export function resolveDeviceState(message: StatusChangeMessage): ResolvedState {
  const status = message.status;

  // ═══════════════════════════════════════════════════════════════════════════
  // Priority 0: Status Override Rules (Highest Priority)
  // ═══════════════════════════════════════════════════════════════════════════
  // These status codes ignore ALL modifier flags and always return fixed states

  // Idle Status Override - Row 11
  if (status === OperationStatusCode.Idle) {
    return {
      runMode: RvcRunMode.ModeTag.Idle,
      operationalState: RvcOperationalState.OperationalState.Docked,
    };
  }

  // EmptyingDustContainer Status Override - Row 53
  if (status === OperationStatusCode.EmptyingDustContainer) {
    return {
      runMode: RvcRunMode.ModeTag.Cleaning,
      operationalState: RvcOperationalState.OperationalState.EmptyingDustBin,
    };
  }

  // WashingTheMop Status Override - Row 54
  if (status === OperationStatusCode.WashingTheMop) {
    return {
      runMode: RvcRunMode.ModeTag.Cleaning,
      operationalState: RvcOperationalState.OperationalState.CleaningMop,
    };
  }

  // GoingToWashTheMop Status Override - Row 55
  if (status === OperationStatusCode.GoingToWashTheMop) {
    return {
      runMode: RvcRunMode.ModeTag.Cleaning,
      operationalState: RvcOperationalState.OperationalState.CleaningMop,
    };
  }

  // Mapping Status Override - Row 56
  if (status === OperationStatusCode.Mapping) {
    return {
      runMode: RvcRunMode.ModeTag.Mapping,
      operationalState: RvcOperationalState.OperationalState.Running,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Priority 1: Cleaning Status Special Overrides
  // ═══════════════════════════════════════════════════════════════════════════
  // When status = 5 (Cleaning), apply modifiers in explicit priority order

  if (status === OperationStatusCode.Cleaning) {
    // Priority 1: inWarmup (Highest) - Row 13
    // Overrides ALL other flags including inReturning
    if (message.inWarmup === true) {
      return {
        runMode: RvcRunMode.ModeTag.Cleaning,
        operationalState: RvcOperationalState.OperationalState.CleaningMop,
      };
    }

    // Priority 2: inReturning (Second) - Rows 16-19
    // Vacuum returning to dock overrides map updates
    if (message.inReturning === true) {
      return {
        runMode: RvcRunMode.ModeTag.Cleaning,
        operationalState: RvcOperationalState.OperationalState.SeekingCharger,
      };
    }

    // Priority 3: isLocating/isExploring (Third) - Rows 14-15
    // Map update operations during cleaning
    if (message.isLocating === true || message.isExploring === true) {
      return {
        runMode: RvcRunMode.ModeTag.Cleaning,
        operationalState: RvcOperationalState.OperationalState.UpdatingMaps,
      };
    }

    // Priority 4: inFreshState not applicable to Cleaning status
    // Falls through to base state (Cleaning + Running) - Row 12
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Priority 2: Modifier Priority Chain
  // ═══════════════════════════════════════════════════════════════════════════
  // Apply modifiers in priority order for all other statuses

  // Get base state from status code
  let state = getBaseState(message);

  // Priority 2a: inReturning modifier (High Priority)
  state = applyInReturningModifier(state, message);

  // Priority 2b: isExploring modifier (Medium Priority)
  state = applyIsExploringModifier(state, message);

  // Priority 2c: inFreshState modifier (Low Priority)
  state = applyInFreshStateModifier(state, message);

  return state;
}

/**
 * Gets the base state from status code using legacy mapping functions.
 * Falls back to Idle/Docked if status code is not recognized.
 *
 * @param message StatusChangeMessage
 * @returns ResolvedState with base runMode and operationalState
 */
function getBaseState(message: StatusChangeMessage): ResolvedState {
  // Special case: Unknown status (0) should return Idle/Docked, not Idle/Error
  if (message.status === OperationStatusCode.Unknown) {
    return {
      runMode: RvcRunMode.ModeTag.Idle,
      operationalState: RvcOperationalState.OperationalState.Docked,
    };
  }

  if (message.status === OperationStatusCode.Paused && message.isExploring === true) {
    return {
      runMode: RvcRunMode.ModeTag.Mapping,
      operationalState: RvcOperationalState.OperationalState.Paused,
    };
  }

  // Special case: Paused status (10) should always return Cleaning/Paused
  if (message.status === OperationStatusCode.Paused) {
    return {
      runMode: RvcRunMode.ModeTag.Cleaning,
      operationalState: RvcOperationalState.OperationalState.Paused,
    };
  }

  const runMode = state_to_matter_state(message.status);
  const operationalState = state_to_matter_operational_status(message.status);

  if (runMode === undefined || operationalState === undefined) {
    // Unknown status code - default to Idle/Docked
    return {
      runMode: RvcRunMode.ModeTag.Idle,
      operationalState: RvcOperationalState.OperationalState.Docked,
    };
  }

  return { runMode, operationalState };
}

/**
 * Applies inReturning modifier (High Priority).
 *
 * When inReturning=true, robot is seeking charger regardless of other flags.
 * Sets runMode to Cleaning and operationalState to SeekingCharger.
 *
 * Special Case: When status is Paused (10), maintains Paused operational state
 * instead of changing to SeekingCharger.
 *
 * Matrix Coverage: Rows 2, 4, 6, 9, 16-19, 21, 24, 27, 29-31, 33, 36, 39, 42, 45, 48, 51
 *
 * @param state Current resolved state
 * @param message StatusChangeMessage
 * @returns Updated state with inReturning applied
 */
function applyInReturningModifier(state: ResolvedState, message: StatusChangeMessage): ResolvedState {
  if (message.inReturning === true) {
    // Special case: Paused status maintains Paused operational state
    if (message.status === OperationStatusCode.Paused) {
      return {
        runMode: RvcRunMode.ModeTag.Cleaning,
        operationalState: RvcOperationalState.OperationalState.Paused,
      };
    }

    return {
      runMode: RvcRunMode.ModeTag.Cleaning,
      operationalState: RvcOperationalState.OperationalState.SeekingCharger,
    };
  }
  return state;
}

/**
 * Applies isExploring modifier (Medium Priority).
 *
 * When isExploring=true and inReturning is not true, robot is in mapping mode.
 * Changes runMode to Mapping while preserving operationalState.
 *
 * Note: This modifier is skipped if inReturning was already applied (higher priority).
 * Note: This modifier is blocked when status is Charging (8) as the vacuum
 * cannot charge and explore simultaneously.
 *
 * Matrix Coverage: Rows 3, 7, 10, 22, 25, 34, 37, 40, 43, 46, 49, 52
 *
 * @param state Current resolved state
 * @param message StatusChangeMessage
 * @returns Updated state with isExploring applied
 */
function applyIsExploringModifier(state: ResolvedState, message: StatusChangeMessage): ResolvedState {
  // Block isExploring when status is Charging (8) - invalid state
  const isCharging = message.status === OperationStatusCode.Charging;

  if (message.isExploring === true && message.inReturning !== true && !isCharging) {
    return {
      ...state,
      runMode: RvcRunMode.ModeTag.Mapping,
    };
  }
  return state;
}

/**
 * Applies inFreshState modifier (Low Priority).
 *
 * When inFreshState=true and status is Charging (8),
 * robot has just completed cleaning and transitions to Idle/Docked.
 *
 * Note: This modifier only applies to status 8 (Charging).
 * For other statuses, including Cleaning (5), inFreshState has no effect
 * as the vacuum does not go to fresh state during active cleaning.
 *
 * Matrix Coverage: Row 28
 *
 * @param state Current resolved state
 * @param message StatusChangeMessage
 * @returns Updated state with inFreshState applied
 */
function applyInFreshStateModifier(state: ResolvedState, message: StatusChangeMessage): ResolvedState {
  if (message.inFreshState === true && message.status === OperationStatusCode.Charging && message.inReturning !== true) {
    return {
      runMode: RvcRunMode.ModeTag.Idle,
      operationalState: RvcOperationalState.OperationalState.Docked,
    };
  }
  return state;
}
