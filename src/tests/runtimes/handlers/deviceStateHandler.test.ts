import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RunModeDisplayLabel, RunModeLabelInfo } from '../../../behaviors/roborock.vacuum/core/runModeConfig.js';
import type { DockStationStatus } from '../../../model/DockStationStatus.js';
import type { RoborockMatterbridgePlatform } from '../../../module.js';
import { OperationStatusCode } from '../../../roborockCommunication/enums/index.js';
import { Device } from '../../../roborockCommunication/models/index.js';
import { StatusChangeMessage } from '../../../roborockCommunication/models/index.js';
import {
	handleDeviceStatusSimpleUpdate,
	handleDeviceStatusUpdate,
} from '../../../runtimes/handlers/deviceStateHandler.js';
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

describe('handleDeviceStatusSimpleUpdate with shared applyResolvedStateUpdates', () => {
	let robot: RoborockVacuumCleaner;
	let platform: RoborockMatterbridgePlatform;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-07-05T12:00:30.000Z'));
		robot = createMockRobot();
		platform = createMockPlatform();
	});

	describe('basic path', () => {
		it('should update currentMode and operationalState attributes for Idle status', async () => {
			const message = { duid: 'test-duid', status: OperationStatusCode.Idle };

			await handleDeviceStatusSimpleUpdate(robot, message, platform);

			expect(robot.updateAttribute).toHaveBeenCalledTimes(2);
			expect(robot.updateAttribute).toHaveBeenNthCalledWith(
				1,
				RvcRunMode.id,
				'currentMode',
				expect.any(Number),
				platform.log,
			);
			expect(robot.updateAttribute).toHaveBeenNthCalledWith(
				2,
				RvcOperationalState.id,
				'operationalState',
				RvcOperationalState.OperationalState.Docked,
				platform.log,
			);
		});

		it('should update currentMode and operationalState attributes for Cleaning status', async () => {
			const message = { duid: 'test-duid', status: OperationStatusCode.Cleaning };

			await handleDeviceStatusSimpleUpdate(robot, message, platform);

			expect(robot.updateAttribute).toHaveBeenCalledTimes(2);
			expect(robot.updateAttribute).toHaveBeenNthCalledWith(
				1,
				RvcRunMode.id,
				'currentMode',
				expect.any(Number),
				platform.log,
			);
			expect(robot.updateAttribute).toHaveBeenNthCalledWith(
				2,
				RvcOperationalState.id,
				'operationalState',
				RvcOperationalState.OperationalState.Running,
				platform.log,
			);
		});
	});

	describe('operationalError path', () => {
		it('should update operationalError attribute when status resolves to ChargingError', async () => {
			const message = { duid: 'test-duid', status: OperationStatusCode.ChargingError };

			await handleDeviceStatusSimpleUpdate(robot, message, platform);

			expect(robot.updateAttribute).toHaveBeenCalledTimes(3);
			expect(robot.updateAttribute).toHaveBeenNthCalledWith(
				1,
				RvcRunMode.id,
				'currentMode',
				expect.any(Number),
				platform.log,
			);
			expect(robot.updateAttribute).toHaveBeenNthCalledWith(
				2,
				RvcOperationalState.id,
				'operationalState',
				RvcOperationalState.OperationalState.Error,
				platform.log,
			);
			expect(robot.updateAttribute).toHaveBeenNthCalledWith(
				3,
				RvcOperationalState.id,
				'operationalError',
				{ errorStateId: RvcOperationalState.ErrorState.FailedToFindChargingDock },
				platform.log,
			);
		});
	});

	describe('dock station error short-circuit', () => {
		it('should call triggerDssError and not update attributes when dock station has error', async () => {
			const mockDockStationStatus = asPartial<DockStationStatus>({
				hasError: vi.fn().mockReturnValue(true),
				cleanFluidStatus: 0,
				waterBoxFilterStatus: 0,
				dustBagStatus: 0,
				dirtyWaterBoxStatus: 0,
				clearWaterBoxStatus: 0,
				isUpdownWaterReady: 0,
			});
			robot.dockStationStatus = mockDockStationStatus;
			const configWithDss = asPartial<RoborockMatterbridgePlatform>({
				log: platform.log,
				configManager: createMockConfigManager({ includeDockStationStatus: true }),
			});
			const message = { duid: 'test-duid', status: OperationStatusCode.Idle };

			await handleDeviceStatusSimpleUpdate(robot, message, configWithDss);

			expect(robot.updateAttribute).not.toHaveBeenCalled();
			expect(robot.triggerEvent).not.toHaveBeenCalled();
		});
	});

	describe('operation completion tracking', () => {
		it('should track operation session timing and emit completion when transitioning from Cleaning to Idle', async () => {
			const message = { duid: 'test-duid', status: OperationStatusCode.Idle };

			await handleDeviceStatusSimpleUpdate(robot, message, platform);

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

		it('should not emit operationCompletion when status remains Idle', async () => {
			const message = { duid: 'test-duid', status: OperationStatusCode.Idle };

			await handleDeviceStatusSimpleUpdate(robot, message, platform);

			expect(robot.triggerEvent).toHaveBeenCalledTimes(1);
			expect(robot.triggerEvent).toHaveBeenCalledWith(
				RvcOperationalState,
				'operationCompletion',
				expect.anything(),
				platform.log,
			);
		});
	});
});
