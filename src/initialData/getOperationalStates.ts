import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { VacuumErrorCode } from '../roborockCommunication/enums/index.js';
import { DockingStationStatus, DockingStationStatusType, hasDockingStationError } from '../model/DockingStationStatus.js';
import { getDefaultOperationalStates } from '../behaviors/roborock.vacuum/core/initialData.js';

/**
 * Get supported operational states for the vacuum.
 * @returns Array of operational state configurations
 */
export function getOperationalStates(): RvcOperationalState.OperationalStateStruct[] {
  return getDefaultOperationalStates();
}

/**
 * Map vacuum error code to Matter operational state.
 * @param errorCode - Vacuum error code from device
 * @returns Error operational state or undefined if no error
 */
export function getOperationalErrorState(errorCode: VacuumErrorCode): RvcOperationalState.OperationalState | undefined {
  switch (errorCode) {
    case VacuumErrorCode.None:
      return undefined;
    default: {
      return RvcOperationalState.OperationalState.Error;
    }
  }
}

/**
 * Create error state structure from vacuum error code.
 * @param errorCode - Vacuum error code
 * @returns Error state structure or undefined if no error
 */
export function getErrorFromErrorCode(errorCode: VacuumErrorCode): RvcOperationalState.ErrorStateStruct | undefined {
  const operationalState = getOperationalErrorState(errorCode);
  if (operationalState) {
    return {
      errorStateId: RvcOperationalState.ErrorState.NoError,
      errorStateLabel: `${RvcOperationalState.ErrorState.NoError}`,
      errorStateDetails: `Error code: ${errorCode}`,
    };
  }
  return undefined;
}

/**
 * Create an error state structure.
 * @param errorStateId - Matter error state identifier
 * @param errorStateLabel - Human-readable error label
 * @param errorStateDetails - Detailed error description
 * @returns Error state structure
 */
function createErrorState(errorStateId: RvcOperationalState.ErrorState, errorStateLabel: string, errorStateDetails: string): RvcOperationalState.ErrorStateStruct {
  return { errorStateId, errorStateLabel, errorStateDetails };
}

/**
 * Create error state structure from docking station status.
 * Maps various docking station component errors to Matter error states.
 * @param status - Docking station status containing component states
 * @returns Error state structure or undefined if no error
 */
export function getErrorFromDSS(status: DockingStationStatus): RvcOperationalState.ErrorStateStruct | undefined {
  if (!status) {
    return createErrorState(RvcOperationalState.ErrorState.NoError, 'No Docking Station Status', 'Docking station status is not available.');
  }

  const hasError = hasDockingStationError(status);

  if (hasError) {
    if (status.cleanFluidStatus === DockingStationStatusType.Error) {
      return createErrorState(RvcOperationalState.ErrorState.MopCleaningPadMissing, 'Clean Fluid Error', 'The clean fluid is not available or has an issue.');
    }

    if (status.waterBoxFilterStatus === DockingStationStatusType.Error) {
      return createErrorState(RvcOperationalState.ErrorState.WaterTankEmpty, 'Water Box Filter Error', 'The water box filter is not available or has an issue.');
    }

    if (status.dustBagStatus === DockingStationStatusType.Error) {
      return createErrorState(RvcOperationalState.ErrorState.DustBinMissing, 'Dust Bag Error', 'The dust bag is not available or has an issue.');
    }

    if (status.dirtyWaterBoxStatus === DockingStationStatusType.Error) {
      return createErrorState(RvcOperationalState.ErrorState.WaterTankEmpty, 'Dirty Water Box Error', 'The dirty water box is not available or has an issue.');
    }

    if (status.clearWaterBoxStatus === DockingStationStatusType.Error) {
      return createErrorState(RvcOperationalState.ErrorState.WaterTankEmpty, 'Clear Water Box Error', 'The clear water box is not available or has an issue.');
    }

    if (status.isUpdownWaterReady === DockingStationStatusType.Error) {
      return createErrorState(RvcOperationalState.ErrorState.WaterTankMissing, 'Updown Water Ready Error', 'The updown water tank is not ready or has an issue.');
    }
  }

  return undefined;
}
