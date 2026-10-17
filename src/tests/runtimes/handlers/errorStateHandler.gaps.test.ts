import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoborockMatterbridgePlatform } from '../../../module.js';
import { DockErrorCode } from '../../../roborockCommunication/enums/index.js';
import { Device, type DeviceErrorMessage } from '../../../roborockCommunication/models/index.js';
import { handleErrorOccurred } from '../../../runtimes/handlers/errorStateHandler.js';
import { getOperationalErrorName } from '../../../share/matterStateNames.js';
import type { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, asType, createMockConfigManager, createMockLogger } from '../../helpers/testUtils.js';

function createMockRobot(operationalState: RvcOperationalState.OperationalState): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		device: asPartial<Device>({ duid: 'test-duid', name: 'Test Robot' }),
		dockStationStatus: undefined,
		updateAttribute: vi.fn().mockResolvedValue(undefined),
		getAttribute: vi.fn((_clusterId: number, attribute: string): unknown =>
			attribute === 'operationalState' ? operationalState : undefined,
		) as RoborockVacuumCleaner['getAttribute'],
	});
}

function createMockPlatform(includeDockStationStatus: boolean): RoborockMatterbridgePlatform {
	return asPartial<RoborockMatterbridgePlatform>({
		log: createMockLogger(),
		configManager: createMockConfigManager({ includeDockStationStatus, includeVacuumErrorStatus: true }),
	});
}

describe('handleErrorOccurred gap coverage', () => {
	let platform: RoborockMatterbridgePlatform;

	beforeEach(() => {
		vi.clearAllMocks();
		platform = createMockPlatform(true);
	});

	it('should treat an undefined vacuumErrorCode as no vacuum error and clear the operational error', async () => {
		const robot = createMockRobot(RvcOperationalState.OperationalState.Running);
		const message = asPartial<DeviceErrorMessage>({
			duid: 'test-duid',
			vacuumErrorCode: undefined,
			dockErrorCode: DockErrorCode.None,
			dockStationStatus: undefined,
		});

		await handleErrorOccurred(robot, message, platform);

		expect(robot.updateAttribute).toHaveBeenCalledWith(
			RvcOperationalState.id,
			'operationalError',
			{
				errorStateId: RvcOperationalState.ErrorState.NoError,
				errorStateDetails: getOperationalErrorName(RvcOperationalState.ErrorState.NoError),
			},
			platform.log,
		);
		expect(robot.updateAttribute).not.toHaveBeenCalledWith(
			RvcOperationalState.id,
			'operationalState',
			expect.anything(),
			expect.anything(),
		);
	});

	it('should map an unrecognized dock error code to UnableToCompleteOperation and warn', async () => {
		const robot = createMockRobot(RvcOperationalState.OperationalState.Docked);
		const unknownDockCode = asType<DockErrorCode>(9999);
		const message = asPartial<DeviceErrorMessage>({
			duid: 'test-duid',
			vacuumErrorCode: undefined,
			dockErrorCode: unknownDockCode,
			dockStationStatus: undefined,
		});
		const expectedError = RvcOperationalState.ErrorState.UnableToCompleteOperation;

		await handleErrorOccurred(robot, message, platform);

		expect(platform.log.warn).toHaveBeenCalledWith(
			`Docking station error detected: ${getOperationalErrorName(expectedError)}`,
		);
		expect(robot.updateAttribute).toHaveBeenCalledWith(
			RvcOperationalState.id,
			'operationalError',
			{ errorStateId: expectedError, errorStateDetails: getOperationalErrorName(expectedError) },
			platform.log,
		);
	});
});
