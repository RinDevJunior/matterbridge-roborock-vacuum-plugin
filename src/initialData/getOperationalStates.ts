import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { getDefaultOperationalStates } from '../behaviors/roborock.vacuum/default/initalData.js';
import { VacuumErrorCode } from '../roborockCommunication/Zenum/vacuumAndDockErrorCode.js';
import { DockingStationStatus, DockingStationStatusType, hasDockingStationError } from '../model/DockingStationStatus.js';

export function getOperationalStates(): RvcOperationalState.OperationalStateStruct[] {
  return getDefaultOperationalStates();
}

export function getOperationalErrorState(errorCode: VacuumErrorCode): RvcOperationalState.OperationalState | undefined {
  switch (errorCode) {
    case VacuumErrorCode.None:
      return undefined;
    default: {
      return RvcOperationalState.OperationalState.Error;
    }
  }
}

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

export function getErrorFromDSS(status: DockingStationStatus): RvcOperationalState.ErrorStateStruct | undefined {
  if (!status) {
    return {
      errorStateId: RvcOperationalState.ErrorState.NoError,
      errorStateLabel: 'No Docking Station Status',
      errorStateDetails: 'Docking station status is not available.',
    };
  }

  const hasError = hasDockingStationError(status);

  if (hasError) {
    if (status.cleanFluidStatus === DockingStationStatusType.Error) {
      return {
        errorStateId: RvcOperationalState.ErrorState.MopCleaningPadMissing,
        errorStateLabel: 'Clean Fluid Error',
        errorStateDetails: 'The clean fluid is not available or has an issue.',
      };
    }

    if (status.waterBoxFilterStatus === DockingStationStatusType.Error) {
      return {
        errorStateId: RvcOperationalState.ErrorState.WaterTankEmpty,
        errorStateLabel: 'Water Box Filter Error',
        errorStateDetails: 'The water box filter is not available or has an issue.',
      };
    }

    if (status.dustBagStatus === DockingStationStatusType.Error) {
      return {
        errorStateId: RvcOperationalState.ErrorState.DustBinMissing,
        errorStateLabel: 'Dust Bag Error',
        errorStateDetails: 'The dust bag is not available or has an issue.',
      };
    }

    if (status.dirtyWaterBoxStatus === DockingStationStatusType.Error) {
      return {
        errorStateId: RvcOperationalState.ErrorState.WaterTankEmpty, // TODO: Check if this is correct
        errorStateLabel: 'Dirty Water Box Error',
        errorStateDetails: 'The dirty water box is not available or has an issue.',
      };
    }

    if (status.clearWaterBoxStatus === DockingStationStatusType.Error) {
      return {
        errorStateId: RvcOperationalState.ErrorState.WaterTankEmpty,
        errorStateLabel: 'Clear Water Box Error',
        errorStateDetails: 'The clear water box is not available or has an issue.',
      };
    }

    if (status.isUpdownWaterReady === DockingStationStatusType.Error) {
      return {
        errorStateId: RvcOperationalState.ErrorState.WaterTankMissing,
        errorStateLabel: 'Updown Water Ready Error',
        errorStateDetails: 'The updown water tank is not ready or has an issue.',
      };
    }
  }

  return undefined;
}
