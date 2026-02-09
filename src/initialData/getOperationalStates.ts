import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { VacuumErrorCode } from '../roborockCommunication/enums/index.js';
import { DockingStationStatus, DockingStationStatusCode } from '../model/DockingStationStatus.js';
import { getDefaultOperationalStates } from '../behaviors/roborock.vacuum/core/runModeConfig.js';

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
    default:
      return RvcOperationalState.OperationalState.Error;
  }
}

/**
 * Create error state structure from vacuum error code.
 * @param errorCode - Vacuum error code
 * @returns Error state structure or undefined if no error
 */
export function getErrorFromErrorCode(errorCode: VacuumErrorCode): RvcOperationalState.ErrorState | undefined {
  switch (errorCode) {
    case VacuumErrorCode.None:
      return RvcOperationalState.ErrorState.NoError;
    case VacuumErrorCode.LidarBlocked:
    case VacuumErrorCode.CompassError:
    case VacuumErrorCode.CliffSensorError:
    case VacuumErrorCode.OpticalFlowSensorDirt:
    case VacuumErrorCode.WallSensorDirty:
    case VacuumErrorCode.CameraError:
    case VacuumErrorCode.WallSensorError:
      return RvcOperationalState.ErrorState.NavigationSensorObscured;
    case VacuumErrorCode.BumperStuck:
    case VacuumErrorCode.RobotTrapped:
    case VacuumErrorCode.RobotTilted:
    case VacuumErrorCode.VerticalBumperPressed:
    case VacuumErrorCode.VibrariseJammed:
    case VacuumErrorCode.RobotOnCarpet:
      return RvcOperationalState.ErrorState.Stuck;
    case VacuumErrorCode.WheelsSuspended:
    case VacuumErrorCode.WheelsJammed:
      return RvcOperationalState.ErrorState.WheelsJammed;
    case VacuumErrorCode.MainBrushJammed:
    case VacuumErrorCode.SideBrushJammed:
    case VacuumErrorCode.SideBrushError:
    case VacuumErrorCode.ClearBrushPositioningError:
    case VacuumErrorCode.MoppingRollerJammed:
    case VacuumErrorCode.MoppingRollerJammed2:
      return RvcOperationalState.ErrorState.BrushJammed;
    case VacuumErrorCode.NoDustbin:
    case VacuumErrorCode.StrainerError:
    case VacuumErrorCode.CleanAutoEmptyDock:
      return RvcOperationalState.ErrorState.DustBinMissing;
    case VacuumErrorCode.FilterBlocked:
      return RvcOperationalState.ErrorState.DustBinFull;
    case VacuumErrorCode.LowBattery:
      return RvcOperationalState.ErrorState.LowBattery;
    case VacuumErrorCode.ChargingError:
      return RvcOperationalState.ErrorState.UnableToStartOrResume;
    case VacuumErrorCode.DockNotConnectedToPower:
    case VacuumErrorCode.ReturnToDockFail:
    case VacuumErrorCode.DockLocatorError:
      return RvcOperationalState.ErrorState.FailedToFindChargingDock;
    case VacuumErrorCode.NogoZoneDetected:
    case VacuumErrorCode.InvisibleWallDetected:
    case VacuumErrorCode.CannotCrossCarpet:
      return RvcOperationalState.ErrorState.CannotReachTargetArea;
    case VacuumErrorCode.InternalError:
    case VacuumErrorCode.TemperatureProtection:
    case VacuumErrorCode.CleanCarouselException:
    case VacuumErrorCode.FanError:
    case VacuumErrorCode.BatteryError:
    case VacuumErrorCode.AutoEmptyDockVoltage:
    case VacuumErrorCode.AudioError:
    case VacuumErrorCode.MoppingRollerNotLowered:
    case VacuumErrorCode.SinkStrainerHoare:
    case VacuumErrorCode.CheckCleanCarouse:
      return RvcOperationalState.ErrorState.UnableToCompleteOperation;
    case VacuumErrorCode.ClearWaterBoxHoare:
    case VacuumErrorCode.ClearBrushInstalledProperly:
    case VacuumErrorCode.FilterScreenException:
    case VacuumErrorCode.UpWaterException:
      return RvcOperationalState.ErrorState.WaterTankMissing;
    case VacuumErrorCode.ClearWaterTankEmpty:
      return RvcOperationalState.ErrorState.WaterTankEmpty;
    case VacuumErrorCode.DirtyWaterBoxHoare:
    case VacuumErrorCode.DrainWaterException:
    case VacuumErrorCode.CleanCarouselWaterFull:
      return RvcOperationalState.ErrorState.DirtyWaterTankFull;
    case VacuumErrorCode.WaterCarriageDrop:
      return RvcOperationalState.ErrorState.WaterTankMissing;

    default:
      return RvcOperationalState.ErrorState.NoError;
  }
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

  const hasError = status.hasError();

  if (hasError) {
    if (status.cleanFluidStatus === DockingStationStatusCode.Error) {
      return createErrorState(RvcOperationalState.ErrorState.MopCleaningPadMissing, 'Clean Fluid Error', 'The clean fluid is not available or has an issue.');
    }

    if (status.waterBoxFilterStatus === DockingStationStatusCode.Error) {
      return createErrorState(RvcOperationalState.ErrorState.WaterTankEmpty, 'Water Box Filter Error', 'The water box filter is not available or has an issue.');
    }

    if (status.dustBagStatus === DockingStationStatusCode.Error) {
      return createErrorState(RvcOperationalState.ErrorState.DustBinMissing, 'Dust Bag Error', 'The dust bag is not available or has an issue.');
    }

    if (status.dirtyWaterBoxStatus === DockingStationStatusCode.Error) {
      return createErrorState(RvcOperationalState.ErrorState.WaterTankEmpty, 'Dirty Water Box Error', 'The dirty water box is not available or has an issue.');
    }

    if (status.clearWaterBoxStatus === DockingStationStatusCode.Error) {
      return createErrorState(RvcOperationalState.ErrorState.WaterTankEmpty, 'Clear Water Box Error', 'The clear water box is not available or has an issue.');
    }

    if (status.isUpdownWaterReady === DockingStationStatusCode.Error) {
      return createErrorState(RvcOperationalState.ErrorState.WaterTankMissing, 'Updown Water Ready Error', 'The updown water tank is not ready or has an issue.');
    }
  }

  return undefined;
}
