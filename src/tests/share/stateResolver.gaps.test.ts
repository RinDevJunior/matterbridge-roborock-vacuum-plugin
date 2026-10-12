import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { describe, expect, it } from 'vitest';

import { OperationStatusCode } from '../../roborockCommunication/enums/index.js';
import { StatusChangeMessage } from '../../roborockCommunication/models/deviceStatus.js';
import { resolveDeviceState } from '../../share/stateResolver.js';
import { asType } from '../helpers/testUtils.js';

interface FlagOverrides {
	inCleaning?: boolean;
	inReturning?: boolean;
	inFreshState?: boolean;
	isLocating?: boolean;
	isExploring?: boolean;
	inWarmup?: boolean;
	washStatus?: number;
	replenishMode?: number;
}

function createMessage(status: OperationStatusCode, flags: FlagOverrides = {}): StatusChangeMessage {
	return new StatusChangeMessage(
		'test-duid',
		status,
		flags.inCleaning,
		flags.inReturning,
		flags.inFreshState,
		flags.isLocating,
		flags.isExploring,
		flags.inWarmup,
		flags.washStatus,
		flags.replenishMode,
	);
}

const CLEANING_STATUSES: OperationStatusCode[] = [
	OperationStatusCode.Cleaning,
	OperationStatusCode.ManualMode,
	OperationStatusCode.RoomClean,
	OperationStatusCode.ZoneClean,
	OperationStatusCode.SpotCleaning,
	OperationStatusCode.CleanMopCleaning,
	OperationStatusCode.CleanMopMopping,
	OperationStatusCode.RoomCleanMopCleaning,
	OperationStatusCode.RoomCleanMopMopping,
	OperationStatusCode.ZoneCleanMopCleaning,
	OperationStatusCode.ZoneCleanMopMopping,
	OperationStatusCode.RoomMopping,
	OperationStatusCode.ZoneMopping,
];

describe('resolveDeviceState gap coverage', () => {
	describe('Sleeping status override', () => {
		it('should return Mapping/Paused when Sleeping with isExploring and no inCleaning', () => {
			// Arrange
			const message = createMessage(OperationStatusCode.Sleeping, { isExploring: true });

			// Act
			const result = resolveDeviceState(message);

			// Assert
			expect(result.runMode).toBe(RvcRunMode.ModeTag.Mapping);
			expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Paused);
		});
	});

	describe('InError status override', () => {
		it('should return Cleaning/Error when InError with inCleaning', () => {
			// Arrange
			const message = createMessage(OperationStatusCode.InError, { inCleaning: true });

			// Act
			const result = resolveDeviceState(message);

			// Assert
			expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
			expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Error);
		});

		it('should return Mapping/Error when InError with isExploring and no inCleaning', () => {
			// Arrange
			const message = createMessage(OperationStatusCode.InError, { isExploring: true });

			// Act
			const result = resolveDeviceState(message);

			// Assert
			expect(result.runMode).toBe(RvcRunMode.ModeTag.Mapping);
			expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Error);
		});
	});

	describe('Cleaning status special overrides', () => {
		it.each(CLEANING_STATUSES)(
			'should return Cleaning/UpdatingMaps when status %s has isLocating',
			(status: OperationStatusCode) => {
				// Arrange
				const message = createMessage(status, { isLocating: true });

				// Act
				const result = resolveDeviceState(message);

				// Assert
				expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
				expect(result.operationalState).toBe(RvcOperationalState.OperationalState.UpdatingMaps);
			},
		);
	});

	describe('WashingTheMop filling-water-tank phase', () => {
		it('should return FillingWaterTank when replenishMode is greater than zero', () => {
			// Arrange
			const message = createMessage(OperationStatusCode.WashingTheMop, { replenishMode: 1 });

			// Act
			const result = resolveDeviceState(message);

			// Assert
			expect(result.operationalState).toBe(RvcOperationalState.OperationalState.FillingWaterTank);
		});

		it('should return FillingWaterTank when washStatus is greater than zero', () => {
			// Arrange
			const message = createMessage(OperationStatusCode.WashingTheMop, { washStatus: 1 });

			// Act
			const result = resolveDeviceState(message);

			// Assert
			expect(result.operationalState).toBe(RvcOperationalState.OperationalState.FillingWaterTank);
		});

		it('should return CleaningMop when replenishMode and washStatus are both zero', () => {
			// Arrange
			const message = createMessage(OperationStatusCode.WashingTheMop, { replenishMode: 0, washStatus: 0 });

			// Act
			const result = resolveDeviceState(message);

			// Assert
			expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
			expect(result.operationalState).toBe(RvcOperationalState.OperationalState.CleaningMop);
		});
	});

	describe('unknown status code', () => {
		it('should return Idle/Docked when status code is not recognized', () => {
			// Arrange
			const message = createMessage(asType<OperationStatusCode>(9999));

			// Act
			const result = resolveDeviceState(message);

			// Assert
			expect(result.runMode).toBe(RvcRunMode.ModeTag.Idle);
			expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Docked);
		});
	});

	describe('inReturning modifier skip list', () => {
		it('should keep Cleaning/Paused when Paused with inReturning', () => {
			// Arrange
			const message = createMessage(OperationStatusCode.Paused, { inReturning: true });

			// Act
			const result = resolveDeviceState(message);

			// Assert
			expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
			expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Paused);
		});

		it.each([OperationStatusCode.ReturnToDock, OperationStatusCode.ReturningDock])(
			'should ignore inReturning and match the base state when status %s',
			(status: OperationStatusCode) => {
				// Arrange
				const withReturning = createMessage(status, { inReturning: true });
				const withoutReturning = createMessage(status);

				// Act
				const resultWith = resolveDeviceState(withReturning);
				const resultWithout = resolveDeviceState(withoutReturning);

				// Assert
				expect(resultWith).toEqual(resultWithout);
			},
		);
	});

	describe('inFreshState modifier', () => {
		it('should return Cleaning/SeekingCharger when Charging with inFreshState and inReturning', () => {
			// Arrange
			const message = createMessage(OperationStatusCode.Charging, { inFreshState: true, inReturning: true });

			// Act
			const result = resolveDeviceState(message);

			// Assert
			expect(result.runMode).toBe(RvcRunMode.ModeTag.Cleaning);
			expect(result.operationalState).toBe(RvcOperationalState.OperationalState.SeekingCharger);
		});

		it('should return Idle/Docked when Charging with inFreshState and no inReturning', () => {
			// Arrange
			const message = createMessage(OperationStatusCode.Charging, { inFreshState: true });

			// Act
			const result = resolveDeviceState(message);

			// Assert
			expect(result.runMode).toBe(RvcRunMode.ModeTag.Idle);
			expect(result.operationalState).toBe(RvcOperationalState.OperationalState.Docked);
		});
	});
});
