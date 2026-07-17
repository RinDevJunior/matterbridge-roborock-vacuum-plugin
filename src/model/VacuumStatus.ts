import { RvcOperationalState } from 'matterbridge/matter/clusters';

import { VacuumErrorCode } from '../roborockCommunication/enums/index.js';

export const VACUUM_ERROR_TO_MATTER: ReadonlyMap<VacuumErrorCode, RvcOperationalState.ErrorState> = new Map([
	[VacuumErrorCode.None, RvcOperationalState.ErrorState.NoError],
	[VacuumErrorCode.LidarBlocked, RvcOperationalState.ErrorState.NavigationSensorObscured],
	[VacuumErrorCode.CompassError, RvcOperationalState.ErrorState.NavigationSensorObscured],
	[VacuumErrorCode.CliffSensorError, RvcOperationalState.ErrorState.NavigationSensorObscured],
	[VacuumErrorCode.OpticalFlowSensorDirt, RvcOperationalState.ErrorState.NavigationSensorObscured],
	[VacuumErrorCode.WallSensorDirty, RvcOperationalState.ErrorState.NavigationSensorObscured],
	[VacuumErrorCode.CameraError, RvcOperationalState.ErrorState.NavigationSensorObscured],
	[VacuumErrorCode.WallSensorError, RvcOperationalState.ErrorState.NavigationSensorObscured],
	[VacuumErrorCode.BumperStuck, RvcOperationalState.ErrorState.Stuck],
	[VacuumErrorCode.RobotTrapped, RvcOperationalState.ErrorState.Stuck],
	[VacuumErrorCode.RobotTilted, RvcOperationalState.ErrorState.Stuck],
	[VacuumErrorCode.VerticalBumperPressed, RvcOperationalState.ErrorState.Stuck],
	[VacuumErrorCode.VibrariseJammed, RvcOperationalState.ErrorState.Stuck],
	[VacuumErrorCode.RobotOnCarpet, RvcOperationalState.ErrorState.Stuck],
	[VacuumErrorCode.WheelsSuspended, RvcOperationalState.ErrorState.WheelsJammed],
	[VacuumErrorCode.WheelsJammed, RvcOperationalState.ErrorState.WheelsJammed],
	[VacuumErrorCode.MainBrushJammed, RvcOperationalState.ErrorState.BrushJammed],
	[VacuumErrorCode.SideBrushJammed, RvcOperationalState.ErrorState.BrushJammed],
	[VacuumErrorCode.SideBrushError, RvcOperationalState.ErrorState.BrushJammed],
	[VacuumErrorCode.ClearBrushPositioningError, RvcOperationalState.ErrorState.BrushJammed],
	[VacuumErrorCode.MoppingRollerJammed, RvcOperationalState.ErrorState.BrushJammed],
	[VacuumErrorCode.MoppingRollerJammed2, RvcOperationalState.ErrorState.BrushJammed],
	[VacuumErrorCode.NoDustbin, RvcOperationalState.ErrorState.DustBinMissing],
	[VacuumErrorCode.StrainerError, RvcOperationalState.ErrorState.DustBinFull],
	[VacuumErrorCode.CleanAutoEmptyDock, RvcOperationalState.ErrorState.DustBinFull],
	[VacuumErrorCode.AutoEmptyDockFanError, RvcOperationalState.ErrorState.DustBinFull],
	[VacuumErrorCode.FilterBlocked, RvcOperationalState.ErrorState.DustBinFull],
	[VacuumErrorCode.LowBattery, RvcOperationalState.ErrorState.LowBattery],
	[VacuumErrorCode.ChargingError, RvcOperationalState.ErrorState.UnableToStartOrResume],
	[VacuumErrorCode.DockNotConnectedToPower, RvcOperationalState.ErrorState.FailedToFindChargingDock],
	[VacuumErrorCode.ReturnToDockFail, RvcOperationalState.ErrorState.FailedToFindChargingDock],
	[VacuumErrorCode.DockLocatorError, RvcOperationalState.ErrorState.FailedToFindChargingDock],
	[VacuumErrorCode.NogoZoneDetected, RvcOperationalState.ErrorState.CannotReachTargetArea],
	[VacuumErrorCode.InvisibleWallDetected, RvcOperationalState.ErrorState.CannotReachTargetArea],
	[VacuumErrorCode.CannotCrossCarpet, RvcOperationalState.ErrorState.CannotReachTargetArea],
	[VacuumErrorCode.InternalError, RvcOperationalState.ErrorState.UnableToCompleteOperation],
	[VacuumErrorCode.TemperatureProtection, RvcOperationalState.ErrorState.UnableToCompleteOperation],
	[VacuumErrorCode.CleanCarouselException, RvcOperationalState.ErrorState.UnableToCompleteOperation],
	[VacuumErrorCode.FanError, RvcOperationalState.ErrorState.UnableToCompleteOperation],
	[VacuumErrorCode.BatteryError, RvcOperationalState.ErrorState.UnableToCompleteOperation],
	[VacuumErrorCode.AutoEmptyDockVoltage, RvcOperationalState.ErrorState.UnableToCompleteOperation],
	[VacuumErrorCode.AudioError, RvcOperationalState.ErrorState.UnableToCompleteOperation],
	[VacuumErrorCode.MoppingRollerNotLowered, RvcOperationalState.ErrorState.BrushJammed],
	[VacuumErrorCode.SinkStrainerHoare, RvcOperationalState.ErrorState.WaterTankMissing],
	[VacuumErrorCode.CheckCleanCarouse, RvcOperationalState.ErrorState.UnableToCompleteOperation],
	[VacuumErrorCode.ClearWaterBoxHoare, RvcOperationalState.ErrorState.WaterTankMissing],
	[VacuumErrorCode.ClearBrushInstalledProperly, RvcOperationalState.ErrorState.WaterTankMissing],
	[VacuumErrorCode.FilterScreenException, RvcOperationalState.ErrorState.WaterTankLidOpen],
	[VacuumErrorCode.UpWaterException, RvcOperationalState.ErrorState.WaterTankMissing],
	[VacuumErrorCode.WaterCarriageDrop, RvcOperationalState.ErrorState.MopCleaningPadMissing],
	[VacuumErrorCode.ClearWaterTankEmpty, RvcOperationalState.ErrorState.WaterTankEmpty],
	[VacuumErrorCode.DirtyWaterBoxHoare, RvcOperationalState.ErrorState.DirtyWaterTankMissing],
	[VacuumErrorCode.DrainWaterException, RvcOperationalState.ErrorState.DirtyWaterTankFull],
	[VacuumErrorCode.CleanCarouselWaterFull, RvcOperationalState.ErrorState.DirtyWaterTankFull],
]);

export class VacuumStatus {
	constructor(private readonly errorCode: number) {}

	public hasError(): boolean {
		return this.errorCode !== VacuumErrorCode.None;
	}

	public getErrorState(): RvcOperationalState.ErrorState {
		return VACUUM_ERROR_TO_MATTER.get(this.errorCode) ?? RvcOperationalState.ErrorState.UnableToCompleteOperation;
	}
}
