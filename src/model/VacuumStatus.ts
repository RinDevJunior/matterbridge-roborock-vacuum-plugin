import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { VacuumErrorCode } from '../roborockCommunication/enums/index.js';

export class VacuumStatus {
  constructor(private readonly errorCode: number) {}

  public hasError(): boolean {
    return this.errorCode !== VacuumErrorCode.None;
  }

  public getErrorState(): RvcOperationalState.ErrorState {
    switch (this.errorCode) {
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
}
