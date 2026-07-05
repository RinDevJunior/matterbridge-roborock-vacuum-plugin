import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RunModeDisplayLabel, RunModeLabelInfo } from '../../../behaviors/roborock.vacuum/core/runModeConfig.js';
import type { RoborockMatterbridgePlatform } from '../../../module.js';
import { OperationStatusCode } from '../../../roborockCommunication/enums/index.js';
import { Device } from '../../../roborockCommunication/models/index.js';
import { StatusChangeMessage } from '../../../roborockCommunication/models/index.js';
import { handleDeviceStatusUpdate } from '../../../runtimes/handlers/deviceStateHandler.js';
import type { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, createMockConfigManager, createMockLogger } from '../../helpers/testUtils.js';

function createMockRobot(): RoborockVacuumCleaner {
	const cleaningMode = RunModeLabelInfo[RunModeDisplayLabel.Cleaning].mode;

	return asPartial<RoborockVacuumCleaner>({
		device: asPartial<Device>({ duid: 'test-duid', name: 'Test Robot' }),
		dockStationStatus: undefined,
		operationSessionStartMs: new Date('2026-07-05T12:00:00.000Z').getTime(),
		operationPausedSinceMs: null,
		operationPausedAccumMs: 0,
		updateAttribute: vi.fn().mockResolvedValue(undefined),
		triggerEvent: vi.fn().mockResolvedValue(true),
		getAttribute: vi.fn((_clusterId: number, attribute: string): unknown => {
			if (attribute === 'currentMode') {
				return cleaningMode;
			}
			if (attribute === 'operationalState') {
				return RvcOperationalState.OperationalState.Running;
			}
			if (attribute === 'operationalError') {
				return { errorStateId: RvcOperationalState.ErrorState.NoError };
			}
			return undefined;
		}) as RoborockVacuumCleaner['getAttribute'],
	});
}

function createMockPlatform(): RoborockMatterbridgePlatform {
	return asPartial<RoborockMatterbridgePlatform>({
		log: createMockLogger(),
		configManager: createMockConfigManager({ includeDockStationStatus: false }),
	});
}

describe('handleDeviceStatusUpdate operationCompletion integration', () => {
	let robot: RoborockVacuumCleaner;
	let platform: RoborockMatterbridgePlatform;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-05T12:00:30.000Z'));
		robot = createMockRobot();
		platform = createMockPlatform();
	});

	it('should emit operationCompletion once when prior runMode was Cleaning and new status is Idle', async () => {
		const message = new StatusChangeMessage(
			'test-duid',
			OperationStatusCode.Idle,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
		);

		await handleDeviceStatusUpdate(robot, message, platform);

		expect(robot.triggerEvent).toHaveBeenCalledTimes(1);
		expect(robot.triggerEvent).toHaveBeenCalledWith(
			RvcOperationalState,
			'operationCompletion',
			expect.objectContaining({
				completionErrorCode: RvcOperationalState.ErrorState.NoError,
				totalOperationalTime: 30,
			}),
			platform.log,
		);
		expect(robot.operationSessionStartMs).toBeNull();
	});
});
