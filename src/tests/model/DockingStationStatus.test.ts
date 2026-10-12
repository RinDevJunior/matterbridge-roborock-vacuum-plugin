import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { describe, expect, it } from 'vitest';

import { DockStationStatus, DockStationStatusCode } from '../../model/DockStationStatus.js';
import { DockErrorCode } from '../../roborockCommunication/enums/vacuumAndDockErrorCode.js';

const OK = DockStationStatusCode.OK;
const ERR = DockStationStatusCode.Error;

function createDockStatus(
	overrides: Partial<{
		cleanFluidStatus: DockStationStatusCode;
		waterBoxFilterStatus: DockStationStatusCode;
		dustBagStatus: DockStationStatusCode;
		dirtyWaterBoxStatus: DockStationStatusCode;
		clearWaterBoxStatus: DockStationStatusCode;
		isUpdownWaterReady: DockStationStatusCode;
	}> = {},
): DockStationStatus {
	return new DockStationStatus(
		overrides.cleanFluidStatus ?? OK,
		overrides.waterBoxFilterStatus ?? OK,
		overrides.dustBagStatus ?? OK,
		overrides.dirtyWaterBoxStatus ?? OK,
		overrides.clearWaterBoxStatus ?? OK,
		overrides.isUpdownWaterReady ?? OK,
	);
}

describe('DockStationStatus', () => {
	it('should parse docking station status correctly', () => {
		const dss = 2729;
		const status = DockStationStatus.parseDockStationStatus(dss);

		expect(status.cleanFluidStatus).toBe(2);
		expect(status.waterBoxFilterStatus).toBe(2);
		expect(status.dustBagStatus).toBe(2);
		expect(status.dirtyWaterBoxStatus).toBe(2);
		expect(status.clearWaterBoxStatus).toBe(2);
		expect(status.isUpdownWaterReady).toBe(1);
	});

	it('should detect no error when all status fields are OK', () => {
		const dss = 168;
		const status = DockStationStatus.parseDockStationStatus(dss);
		expect(status.hasError()).toBe(false);
	});

	it('should detect error in any status field', () => {
		const status = createDockStatus({ dustBagStatus: ERR });
		expect(status.hasError()).toBe(true);
	});

	it('should return false when only isUpdownWaterReady is Error', () => {
		const status = createDockStatus({ isUpdownWaterReady: ERR });
		expect(status.hasError()).toBe(false);
	});

	it('should return true when clearWater and isUpdownWaterReady are both Error', () => {
		const status = createDockStatus({ clearWaterBoxStatus: ERR, isUpdownWaterReady: ERR });
		expect(status.hasError()).toBe(true);
	});

	it('should return false for dss=2729 (isUpdownWaterReady is not treated as a dock error)', () => {
		const status = DockStationStatus.parseDockStationStatus(2729);
		expect(status.hasError()).toBe(false);
	});

	it('should handle missing clean water tank status gracefully', () => {
		const dss = 164; // Missing clean water tank status
		const status = DockStationStatus.parseDockStationStatus(dss);
		expect(status.cleanFluidStatus).toBe(DockStationStatusCode.Unknown);
		expect(status.waterBoxFilterStatus).toBe(DockStationStatusCode.Unknown);
		expect(status.dustBagStatus).toBe(DockStationStatusCode.OK);
		expect(status.dirtyWaterBoxStatus).toBe(DockStationStatusCode.OK);
		expect(status.clearWaterBoxStatus).toBe(DockStationStatusCode.Error);
		expect(status.hasError()).toBe(true);
	});

	it('should handle missing dirty water box status gracefully', () => {
		const dss = 152; // Missing dirty water box status
		const status = DockStationStatus.parseDockStationStatus(dss);
		expect(status.cleanFluidStatus).toBe(DockStationStatusCode.Unknown);
		expect(status.waterBoxFilterStatus).toBe(DockStationStatusCode.Unknown);
		expect(status.dustBagStatus).toBe(DockStationStatusCode.OK);
		expect(status.dirtyWaterBoxStatus).toBe(DockStationStatusCode.Error);
		expect(status.clearWaterBoxStatus).toBe(DockStationStatusCode.OK);
		expect(status.hasError()).toBe(true);
	});

	describe('getMatterOperationalError', () => {
		it.each([
			['clearWaterBoxStatus', { clearWaterBoxStatus: ERR }, RvcOperationalState.ErrorState.WaterTankEmpty],
			['dirtyWaterBoxStatus', { dirtyWaterBoxStatus: ERR }, RvcOperationalState.ErrorState.DirtyWaterTankFull],
			['dustBagStatus', { dustBagStatus: ERR }, RvcOperationalState.ErrorState.DustBinMissing],
			['cleanFluidStatus', { cleanFluidStatus: ERR }, RvcOperationalState.ErrorState.WaterTankMissing],
			['waterBoxFilterStatus', { waterBoxFilterStatus: ERR }, RvcOperationalState.ErrorState.WaterTankMissing],
		] as const)('should return expected ErrorState when %s is Error', (_field, overrides, expected) => {
			const status = createDockStatus(overrides);
			expect(status.getMatterOperationalError()).toBe(expected);
		});

		it('should return NoError when no errors', () => {
			expect(createDockStatus().getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.NoError);
		});

		it('should return WaterTankEmpty when clearWater and dustBag are both Error', () => {
			const status = createDockStatus({ clearWaterBoxStatus: ERR, dustBagStatus: ERR });
			expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.WaterTankEmpty);
		});

		it('should return DirtyWaterTankFull when dirtyWater and cleanFluid are both Error', () => {
			const status = createDockStatus({ dirtyWaterBoxStatus: ERR, cleanFluidStatus: ERR });
			expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.DirtyWaterTankFull);
		});

		it('should return DustBinMissing when dustBag and cleanFluid are both Error', () => {
			const status = createDockStatus({ dustBagStatus: ERR, cleanFluidStatus: ERR });
			expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.DustBinMissing);
		});

		it('should return WaterTankMissing when filter and cleanFluid are both Error', () => {
			const status = createDockStatus({ waterBoxFilterStatus: ERR, cleanFluidStatus: ERR });
			expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.WaterTankMissing);
		});

		it('should return NoError when only isUpdownWaterReady is Error', () => {
			const status = createDockStatus({ isUpdownWaterReady: ERR });
			expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.NoError);
		});

		it('should return WaterTankEmpty for python-roborock dss=149 fixture', () => {
			const status = DockStationStatus.parseDockStationStatus(149);
			expect(status.clearWaterBoxStatus).toBe(DockStationStatusCode.Error);
			expect(status.dirtyWaterBoxStatus).toBe(DockStationStatusCode.Error);
			expect(status.getMatterOperationalError()).toBe(RvcOperationalState.ErrorState.WaterTankEmpty);
		});
	});

	describe('parseDockErrorCode', () => {
		it.each([
			[DockErrorCode.None, RvcOperationalState.ErrorState.NoError],
			[DockErrorCode.NoDustbinOrFilter, RvcOperationalState.ErrorState.DustBinMissing],
			[DockErrorCode.AutoEmptyDockFanError, RvcOperationalState.ErrorState.DustBinFull],
			[DockErrorCode.AutoEmptyDockVoltageError, RvcOperationalState.ErrorState.UnableToCompleteOperation],
			[DockErrorCode.DuctBlockage, RvcOperationalState.ErrorState.DustBinFull],
			[DockErrorCode.WaterEmpty, RvcOperationalState.ErrorState.WaterTankEmpty],
			[DockErrorCode.WasteWaterTankFull, RvcOperationalState.ErrorState.DirtyWaterTankFull],
			[DockErrorCode.CleaningTankFullOrBlocked, RvcOperationalState.ErrorState.DirtyWaterTankFull],
			[DockErrorCode.MaintenanceBrushJammed, RvcOperationalState.ErrorState.BrushJammed],
			[DockErrorCode.DirtyTankLatchOpen, RvcOperationalState.ErrorState.DirtyWaterTankMissing],
			[DockErrorCode.NoDustbin, RvcOperationalState.ErrorState.DustBinMissing],
			[999 as DockErrorCode, RvcOperationalState.ErrorState.UnableToCompleteOperation],
		] as const)('should map dock error code %i to %s', (code, expected) => {
			expect(DockStationStatus.parseDockErrorCode(code)).toBe(expected);
		});
	});
});
