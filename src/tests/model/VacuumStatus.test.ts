import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { describe, expect, it } from 'vitest';

import { VACUUM_ERROR_TO_MATTER, VacuumStatus } from '../../model/VacuumStatus.js';
import { VacuumErrorCode } from '../../roborockCommunication/enums/vacuumAndDockErrorCode.js';

describe('VacuumStatus', () => {
	describe('getErrorState', () => {
		it.each([
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
			[VacuumErrorCode.MoppingRollerNotLowered, RvcOperationalState.ErrorState.BrushJammed],
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
			[VacuumErrorCode.CheckCleanCarouse, RvcOperationalState.ErrorState.UnableToCompleteOperation],
			[VacuumErrorCode.ClearWaterBoxHoare, RvcOperationalState.ErrorState.WaterTankMissing],
			[VacuumErrorCode.ClearBrushInstalledProperly, RvcOperationalState.ErrorState.WaterTankMissing],
			[VacuumErrorCode.UpWaterException, RvcOperationalState.ErrorState.WaterTankMissing],
			[VacuumErrorCode.SinkStrainerHoare, RvcOperationalState.ErrorState.WaterTankMissing],
			[VacuumErrorCode.FilterScreenException, RvcOperationalState.ErrorState.WaterTankLidOpen],
			[VacuumErrorCode.WaterCarriageDrop, RvcOperationalState.ErrorState.MopCleaningPadMissing],
			[VacuumErrorCode.ClearWaterTankEmpty, RvcOperationalState.ErrorState.WaterTankEmpty],
			[VacuumErrorCode.DirtyWaterBoxHoare, RvcOperationalState.ErrorState.DirtyWaterTankMissing],
			[VacuumErrorCode.DrainWaterException, RvcOperationalState.ErrorState.DirtyWaterTankFull],
			[VacuumErrorCode.CleanCarouselWaterFull, RvcOperationalState.ErrorState.DirtyWaterTankFull],
			[999 as VacuumErrorCode, RvcOperationalState.ErrorState.UnableToCompleteOperation],
			[47 as VacuumErrorCode, RvcOperationalState.ErrorState.UnableToCompleteOperation],
		] as const)('should map vacuum error code %i to %s', (code, expected) => {
			expect(new VacuumStatus(code).getErrorState()).toBe(expected);
		});
	});

	describe('hasError', () => {
		it('should return false when error code is None', () => {
			expect(new VacuumStatus(VacuumErrorCode.None).hasError()).toBe(false);
		});

		it('should return true when error code is unknown non-zero', () => {
			expect(new VacuumStatus(999).hasError()).toBe(true);
		});

		it('should return true when error code is AutoEmptyDockFanError', () => {
			expect(new VacuumStatus(VacuumErrorCode.AutoEmptyDockFanError).hasError()).toBe(true);
		});
	});

	describe('VACUUM_ERROR_TO_MATTER', () => {
		it('should map None to NoError', () => {
			expect(VACUUM_ERROR_TO_MATTER.get(VacuumErrorCode.None)).toBe(RvcOperationalState.ErrorState.NoError);
		});

		it('should contain an entry for every VacuumErrorCode enum member', () => {
			const enumMemberCount = Object.values(VacuumErrorCode).filter((value) => typeof value === 'number').length;
			expect(VACUUM_ERROR_TO_MATTER.size).toBe(enumMemberCount);
		});
	});
});
