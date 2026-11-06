import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoborockMatterbridgePlatform } from '../../../module.js';
import { OperationStatusCode } from '../../../roborockCommunication/enums/index.js';
import { Device, StatusChangeMessage } from '../../../roborockCommunication/models/index.js';
import { triggerDssError } from '../../../runtimes/handleLocalMessage.js';
import {
	handleDeviceStatusSimpleUpdate,
	handleDeviceStatusUpdate,
} from '../../../runtimes/handlers/deviceStateHandler.js';
import { resolveDeviceState, type ResolvedState } from '../../../share/stateResolver.js';
import type { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, createMockConfigManager, createMockLogger } from '../../helpers/testUtils.js';

vi.mock('../../../runtimes/handleLocalMessage.js', () => ({
	triggerDssError: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../share/stateResolver.js', () => ({
	resolveDeviceState: vi.fn(),
}));

vi.mock('../../../runtimes/handlers/operationCompletionTracker.js', () => ({
	captureSessionSnapshot: vi.fn().mockReturnValue({}),
	captureSessionSnapshotFromResolved: vi.fn().mockReturnValue({}),
	maybeEmitOperationCompletion: vi.fn().mockResolvedValue(undefined),
	trackOperationSessionTiming: vi.fn(),
}));

function createMockRobot(currentOperationState: RvcOperationalState.OperationalState, currentRunMode: number) {
	return asPartial<RoborockVacuumCleaner>({
		device: asPartial<Device>({ duid: 'test-duid', name: 'Test Robot' }),
		dockStationStatus: undefined,
		updateAttribute: vi.fn().mockResolvedValue(true),
		getAttribute: vi.fn((_clusterId: number, attribute: string): unknown =>
			attribute === 'operationalState' ? currentOperationState : currentRunMode,
		) as RoborockVacuumCleaner['getAttribute'],
	});
}

function createMockPlatform(includeDockStationStatus: boolean): RoborockMatterbridgePlatform {
	return asPartial<RoborockMatterbridgePlatform>({
		log: createMockLogger(),
		configManager: createMockConfigManager({ includeDockStationStatus }),
	});
}

describe('deviceStateHandler gap coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('handleDeviceStatusUpdate', () => {
		it('should treat a missing dockStationStatus as no DSS error when DSS reporting is enabled', async () => {
			const robot = createMockRobot(RvcOperationalState.OperationalState.Running, RvcRunMode.ModeTag.Cleaning);
			const platform = createMockPlatform(true);
			vi.mocked(resolveDeviceState).mockReturnValue(
				asPartial<ResolvedState>({
					runMode: RvcRunMode.ModeTag.Cleaning,
					operationalState: RvcOperationalState.OperationalState.Running,
				}),
			);

			const isActive = await handleDeviceStatusUpdate(
				robot,
				asPartial<StatusChangeMessage>({ duid: 'test-duid' }),
				platform,
			);

			expect(triggerDssError).not.toHaveBeenCalled();
			expect(robot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalState',
				RvcOperationalState.OperationalState.Running,
				platform.log,
			);
			expect(isActive).toBe(true);
		});

		it('should skip the Docked update and return false when the device is still charging', async () => {
			const robot = createMockRobot(RvcOperationalState.OperationalState.Charging, RvcRunMode.ModeTag.Idle);
			const platform = createMockPlatform(false);
			vi.mocked(resolveDeviceState).mockReturnValue(
				asPartial<ResolvedState>({
					runMode: RvcRunMode.ModeTag.Idle,
					operationalState: RvcOperationalState.OperationalState.Docked,
				}),
			);

			const isActive = await handleDeviceStatusUpdate(
				robot,
				asPartial<StatusChangeMessage>({ duid: 'test-duid' }),
				platform,
			);

			expect(isActive).toBe(false);
			expect(platform.log.debug).toHaveBeenCalledWith('Device is still charging, skipping Docked state update');
			expect(robot.updateAttribute).not.toHaveBeenCalled();
		});
	});

	describe('handleDeviceStatusSimpleUpdate', () => {
		it('should treat a missing dockStationStatus as no DSS error when DSS reporting is enabled', async () => {
			const robot = createMockRobot(RvcOperationalState.OperationalState.Docked, RvcRunMode.ModeTag.Idle);
			const platform = createMockPlatform(true);
			vi.mocked(resolveDeviceState).mockReturnValue(
				asPartial<ResolvedState>({
					runMode: RvcRunMode.ModeTag.Idle,
					operationalState: RvcOperationalState.OperationalState.Docked,
				}),
			);

			await handleDeviceStatusSimpleUpdate(
				robot,
				{ duid: 'test-duid', status: OperationStatusCode.Cleaning },
				platform,
			);

			expect(triggerDssError).not.toHaveBeenCalled();
			expect(robot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalState',
				RvcOperationalState.OperationalState.Docked,
				platform.log,
			);
		});
	});
});
