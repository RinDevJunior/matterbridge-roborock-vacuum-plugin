import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { describe, expect, it } from 'vitest';

import { getErrorFromDSS } from '../../initialData/getOperationalStates.js';
import { DockStationStatus, DockStationStatusCode } from '../../model/DockStationStatus.js';

const OK = DockStationStatusCode.OK;
const ERR = DockStationStatusCode.Error;

describe('getErrorFromDSS gap coverage', () => {
	it('should return WaterTankEmpty with Clear Water Box Error when only clearWaterBoxStatus is in error', () => {
		// Arrange
		const status = new DockStationStatus(OK, OK, OK, OK, ERR, OK);

		// Act
		const result = getErrorFromDSS(status);

		// Assert
		expect(result).toEqual({
			errorStateId: RvcOperationalState.ErrorState.WaterTankEmpty,
			errorStateLabel: 'Clear Water Box Error',
			errorStateDetails: 'The clear water box is not available or has an issue.',
		});
	});

	it('should return undefined when only isUpdownWaterReady is in error', () => {
		// Arrange
		// isUpdownWaterReady is parsed but excluded from hasError() (Jul 22, 2026 fix),
		// so the WaterTankMissing branch is not reachable and no error is reported.
		const status = new DockStationStatus(OK, OK, OK, OK, OK, ERR);

		// Act
		const result = getErrorFromDSS(status);

		// Assert
		expect(result).toBeUndefined();
	});
});
