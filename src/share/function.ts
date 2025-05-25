import { OperationStatusCode } from '../roborockCommunication/Zenum/operationStatusCode.js';
import { RvcRunMode, RvcOperationalState } from 'matterbridge/matter/clusters';
import { DeviceModel } from '../roborockCommunication/Zmodel/deviceModel.js';
import { MopWaterFlowA187, VacuumSuctionPowerA187 } from '../behaviors/roborock.vacuum/QREVO_EDGE_5V1/a187.js';

export function state_to_matter_state(state: number | undefined): RvcRunMode.ModeTag | undefined {
  if (state === null) {
    return undefined;
  }

  switch (state) {
    case OperationStatusCode.RemoteControl:
    case OperationStatusCode.Cleaning:
    case OperationStatusCode.ReturningDock:
    case OperationStatusCode.ManualMode:
    case OperationStatusCode.SpotCleaning:
    case OperationStatusCode.Docking:
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
    case OperationStatusCode.Docking:
    case OperationStatusCode.Charging:
    case OperationStatusCode.FullyCharged:
    default:
      return RvcRunMode.ModeTag.Idle;
  }
}

export function state_to_matter_operational_status(state: number | undefined): RvcOperationalState.OperationalState | null {
  switch (state) {
    case OperationStatusCode.Initiating:
    case OperationStatusCode.RemoteControl:
    case OperationStatusCode.Cleaning:
    case OperationStatusCode.ManualMode:
    case OperationStatusCode.SpotCleaning:
    case OperationStatusCode.GoTo:
    case OperationStatusCode.ZoneClean:
    case OperationStatusCode.RoomClean:
    case OperationStatusCode.Initiating:
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
    case OperationStatusCode.WashingTheMop:
    case OperationStatusCode.WashingTheMop2:
    case OperationStatusCode.Docking:
    case OperationStatusCode.GoingToWashTheMop:
    case OperationStatusCode.BackToDockWashingDuster:
    case OperationStatusCode.EmptyingDustContainer:
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
    case OperationStatusCode.Locked:
      return RvcOperationalState.OperationalState.Stopped;

    case OperationStatusCode.ReturningDock:
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

export function getCurrentCleanMode(fan_power: number | undefined, water_box_mode: number | undefined, model: string): number | undefined {
  if (!fan_power || !water_box_mode) return undefined;
  switch (model) {
    case DeviceModel.QREVO_EDGE_5V1: {
      if (fan_power == VacuumSuctionPowerA187.Smart || water_box_mode == MopWaterFlowA187.Smart) return 4; // 'Smart Plan',
      if (fan_power == VacuumSuctionPowerA187.Custom || water_box_mode == MopWaterFlowA187.Custom) return 8; // 'Custom',
      if (fan_power == VacuumSuctionPowerA187.Off) return 5; // 'Mop',
      if (water_box_mode == MopWaterFlowA187.Off)
        return 6; // 'Vacuum',
      else return 7; //Vac & Mop
    }
    default: {
      return undefined;
    }
  }
}
