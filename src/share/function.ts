import { OperationStatusCode } from '../roborockCommunication/enums/index.js';
import { RvcRunMode, RvcOperationalState } from 'matterbridge/matter/clusters';

/**
 * Convert device operational status code to Matter run mode tag.
 * Maps various cleaning, mapping, and idle states to appropriate Matter mode tags.
 * @param state - The device operational status code
 * @returns Matter run mode tag (Cleaning, Mapping, or Idle). Returns undefined for null, defaults to Idle for undefined/unknown states.
 */
export function state_to_matter_state(state: number): RvcRunMode.ModeTag {
  switch (state) {
    case OperationStatusCode.RemoteControl:
    case OperationStatusCode.Cleaning:
    case OperationStatusCode.ReturningDock:
    case OperationStatusCode.ManualMode:
    case OperationStatusCode.SpotCleaning:
    case OperationStatusCode.ReturnToDock:
    case OperationStatusCode.GoTo:
    case OperationStatusCode.ZoneClean:
    case OperationStatusCode.RoomClean:
    case OperationStatusCode.WashingTheMop:
    case OperationStatusCode.GoingToWashTheMop:
    case OperationStatusCode.EmptyingDustContainer:
    case OperationStatusCode.Initiating:
    case OperationStatusCode.Paused:
    case OperationStatusCode.AirDryingStopping:
    case OperationStatusCode.CleanMopCleaning:
    case OperationStatusCode.CleanMopMopping:
    case OperationStatusCode.RoomMopping:
    case OperationStatusCode.RoomCleanMopCleaning:
    case OperationStatusCode.RoomCleanMopMopping:
    case OperationStatusCode.ZoneMopping:
    case OperationStatusCode.ZoneCleanMopCleaning:
    case OperationStatusCode.ZoneCleanMopMopping:
    case OperationStatusCode.BackToDockWashingDuster:
      return RvcRunMode.ModeTag.Cleaning;

    case OperationStatusCode.Mapping:
      return RvcRunMode.ModeTag.Mapping;

    case OperationStatusCode.Idle:
    case OperationStatusCode.Sleeping:
    case OperationStatusCode.Charging:
    case OperationStatusCode.FullyCharged:
    default:
      return RvcRunMode.ModeTag.Idle;
  }
}

/**
 * Convert device operational status code to Matter operational state.
 * Maps device states to Running, Error, Paused, Stopped, SeekingCharger, or Docked states.
 * @param state - The device operational status code
 * @returns Matter operational state, or null for docked/idle states
 */
export function state_to_matter_operational_status(state: number | undefined): RvcOperationalState.OperationalState {
  switch (state) {
    case OperationStatusCode.Initiating:
    case OperationStatusCode.RemoteControl:
    case OperationStatusCode.Cleaning:
    case OperationStatusCode.ManualMode:
    case OperationStatusCode.SpotCleaning:
    case OperationStatusCode.GoTo:
    case OperationStatusCode.ZoneClean:
    case OperationStatusCode.RoomClean:
    case OperationStatusCode.InCall:
    case OperationStatusCode.Mapping:
    case OperationStatusCode.Patrol:
    case OperationStatusCode.CleanMopCleaning:
    case OperationStatusCode.CleanMopMopping:
    case OperationStatusCode.RoomMopping:
    case OperationStatusCode.RoomCleanMopCleaning:
    case OperationStatusCode.RoomCleanMopMopping:
    case OperationStatusCode.ZoneMopping:
    case OperationStatusCode.ZoneCleanMopCleaning:
    case OperationStatusCode.ZoneCleanMopMopping:
    case OperationStatusCode.RobotStatusMopping:
      return RvcOperationalState.OperationalState.Running;

    case OperationStatusCode.InError:
    case OperationStatusCode.ChargingError:
    case OperationStatusCode.Unknown:
    case OperationStatusCode.DeviceOffline:
    case OperationStatusCode.Locked:
    case OperationStatusCode.AirDryingStopping:
      return RvcOperationalState.OperationalState.Error;

    case OperationStatusCode.Paused:
      return RvcOperationalState.OperationalState.Paused;

    case OperationStatusCode.ShuttingDown:
      return RvcOperationalState.OperationalState.Stopped;

    case OperationStatusCode.ReturnToDock:
    case OperationStatusCode.ReturningDock:
    case OperationStatusCode.WashingTheMop:
    case OperationStatusCode.WashingTheMop2:
    case OperationStatusCode.GoingToWashTheMop:
    case OperationStatusCode.BackToDockWashingDuster:
    case OperationStatusCode.EmptyingDustContainer:
      return RvcOperationalState.OperationalState.SeekingCharger;

    case OperationStatusCode.Idle:
    case OperationStatusCode.Sleeping:
    case OperationStatusCode.Updating:
    case OperationStatusCode.FullyCharged:
    case OperationStatusCode.Charging:
    default:
      return RvcOperationalState.OperationalState.Docked;
  }
}
