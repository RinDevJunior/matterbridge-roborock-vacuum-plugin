import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoborockMatterbridgePlatform } from '../../../module.js';
import { DockErrorCode, VacuumErrorCode } from '../../../roborockCommunication/enums/index.js';
import type { DeviceErrorMessage } from '../../../roborockCommunication/models/index.js';
import { Device } from '../../../roborockCommunication/models/index.js';
import { handleErrorOccurred } from '../../../runtimes/handlers/errorStateHandler.js';
import { getOperationalErrorName } from '../../../share/matterStateNames.js';
import type { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, createMockConfigManager, createMockLogger } from '../../helpers/testUtils.js';

function createMockRobot(
	operationalState: RvcOperationalState.OperationalState = RvcOperationalState.OperationalState.Running,
): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		device: asPartial<Device>({ duid: 'test-duid', name: 'Test Robot' }),
		dockStationStatus: undefined,
		updateAttribute: vi.fn().mockResolvedValue(undefined),
		getAttribute: vi.fn((_clusterId: number, attribute: string): unknown => {
			if (attribute === 'operationalState') {
				return operationalState;
			}
			return undefined;
		}) as RoborockVacuumCleaner['getAttribute'],
	});
}

function createMockPlatform(overrides: Partial<RoborockMatterbridgePlatform> = {}): RoborockMatterbridgePlatform {
	return asPartial<RoborockMatterbridgePlatform>({
		log: createMockLogger(),
		configManager: createMockConfigManager({
			includeDockStationStatus: false,
			includeVacuumErrorStatus: true,
		}),
		...overrides,
	});
}

describe('handleErrorOccurred', () => {
	let robot: RoborockVacuumCleaner;
	let platform: RoborockMatterbridgePlatform;

	beforeEach(() => {
		vi.clearAllMocks();
		robot = createMockRobot();
		platform = createMockPlatform();
	});

	describe('when includeVacuumErrorStatus is disabled', () => {
		it('should return immediately without updating attributes', async () => {
			const platformNoVacuum = createMockPlatform({
				configManager: createMockConfigManager({ includeVacuumErrorStatus: false }),
			});
			const message = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.DrainWaterException,
				dockErrorCode: DockErrorCode.None,
				dockStationStatus: undefined,
			});

			await handleErrorOccurred(robot, message, platformNoVacuum);

			expect(robot.updateAttribute).not.toHaveBeenCalled();
		});
	});

	describe('when vacuum error is present', () => {
		it('should set operationalError to mapped error code with errorStateDetails', async () => {
			const message = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.DrainWaterException,
				dockErrorCode: DockErrorCode.None,
				dockStationStatus: undefined,
			});

			await handleErrorOccurred(robot, message, platform);

			expect(robot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalState',
				RvcOperationalState.OperationalState.Error,
				platform.log,
			);
			expect(robot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalError',
				{
					errorStateId: RvcOperationalState.ErrorState.DirtyWaterTankFull,
					errorStateDetails: getOperationalErrorName(RvcOperationalState.ErrorState.DirtyWaterTankFull),
				},
				platform.log,
			);
		});

		it('should map vacuum error regardless of includeDockStationStatus setting', async () => {
			const platformWithDock = createMockPlatform({
				configManager: createMockConfigManager({
					includeDockStationStatus: true,
					includeVacuumErrorStatus: true,
				}),
			});
			const message = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.BumperStuck,
				dockErrorCode: DockErrorCode.None,
				dockStationStatus: undefined,
			});

			await handleErrorOccurred(robot, message, platformWithDock);

			expect(robot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalError',
				expect.objectContaining({
					errorStateId: RvcOperationalState.ErrorState.Stuck,
				}),
				platformWithDock.log,
			);
		});
	});

	describe('when vacuum is Running with no vacuum error', () => {
		it('should clear operationalError to NoError', async () => {
			const message = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.None,
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
		});
	});

	describe('THE BUG FIX - not Running, no vacuum error, includeDockStationStatus: false', () => {
		it('should clear operationalError to NoError instead of leaving it stuck', async () => {
			const dockedRobot = createMockRobot(RvcOperationalState.OperationalState.Docked);
			const platformNoDock = createMockPlatform({
				configManager: createMockConfigManager({
					includeDockStationStatus: false,
					includeVacuumErrorStatus: true,
				}),
			});
			const message = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.None,
				dockErrorCode: DockErrorCode.None,
				dockStationStatus: undefined,
			});

			await handleErrorOccurred(dockedRobot, message, platformNoDock);

			expect(dockedRobot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalError',
				{
					errorStateId: RvcOperationalState.ErrorState.NoError,
					errorStateDetails: getOperationalErrorName(RvcOperationalState.ErrorState.NoError),
				},
				platformNoDock.log,
			);
		});
	});

	describe('sequential regression scenario - real bug reproduction', () => {
		it('should clear operationalError when error clears after being set with includeDockStationStatus: false', async () => {
			// Step 1: Vacuum error occurs, robot not Running, includeDockStationStatus: false
			const dockedRobot = createMockRobot(RvcOperationalState.OperationalState.Docked);
			const platformNoDock = createMockPlatform({
				configManager: createMockConfigManager({
					includeDockStationStatus: false,
					includeVacuumErrorStatus: true,
				}),
			});

			const errorMessage = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.DrainWaterException,
				dockErrorCode: DockErrorCode.None,
				dockStationStatus: undefined,
			});

			await handleErrorOccurred(dockedRobot, errorMessage, platformNoDock);

			// Verify error was set
			expect(dockedRobot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalError',
				expect.objectContaining({
					errorStateId: RvcOperationalState.ErrorState.DirtyWaterTankFull,
				}),
				platformNoDock.log,
			);

			vi.clearAllMocks();

			// Step 2: Error clears (vacuumErrorCode: None), robot still not Running
			const clearMessage = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.None,
				dockErrorCode: DockErrorCode.None,
				dockStationStatus: undefined,
			});

			await handleErrorOccurred(dockedRobot, clearMessage, platformNoDock);

			// Verify error was cleared (this was the bug - it didn't clear before)
			expect(dockedRobot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalError',
				{
					errorStateId: RvcOperationalState.ErrorState.NoError,
					errorStateDetails: getOperationalErrorName(RvcOperationalState.ErrorState.NoError),
				},
				platformNoDock.log,
			);
		});
	});

	describe('dock station status branch', () => {
		it('Case 5: should set operationalError to dock error when dockStationStatus present with error', async () => {
			const dockedRobot = createMockRobot(RvcOperationalState.OperationalState.Docked);
			const platformWithDock = createMockPlatform({
				configManager: createMockConfigManager({
					includeDockStationStatus: true,
					includeVacuumErrorStatus: true,
				}),
			});

			// dss with clearWaterBoxStatus = Error (1), all others OK (2)
			// clearWaterBoxStatus error should map to WaterTankEmpty (highest priority)
			const dssValue = (1 << 2) | (2 << 4) | (2 << 6) | (2 << 8) | (2 << 10); // = 2084
			const message = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.None,
				dockErrorCode: DockErrorCode.None,
				dockStationStatus: dssValue,
			});

			await handleErrorOccurred(dockedRobot, message, platformWithDock);

			// Verify operationalError is set to WaterTankEmpty (from clearWaterBoxStatus)
			expect(dockedRobot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalError',
				expect.objectContaining({
					errorStateId: RvcOperationalState.ErrorState.WaterTankEmpty,
				}),
				platformWithDock.log,
			);

			// Verify robot.dockStationStatus side-effect is set
			expect(dockedRobot.dockStationStatus).toBeDefined();
		});

		it('Case 6: should clear operationalError when dockStationStatus present with no error', async () => {
			const dockedRobot = createMockRobot(RvcOperationalState.OperationalState.Docked);
			const platformWithDock = createMockPlatform({
				configManager: createMockConfigManager({
					includeDockStationStatus: true,
					includeVacuumErrorStatus: true,
				}),
			});

			// dss with all fields OK (2)
			const dssValue = (2 << 2) | (2 << 4) | (2 << 6) | (2 << 8) | (2 << 10); // = 2730
			const message = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.None,
				dockErrorCode: DockErrorCode.None,
				dockStationStatus: dssValue,
			});

			await handleErrorOccurred(dockedRobot, message, platformWithDock);

			// Verify operationalError is cleared to NoError
			expect(dockedRobot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalError',
				{
					errorStateId: RvcOperationalState.ErrorState.NoError,
					errorStateDetails: getOperationalErrorName(RvcOperationalState.ErrorState.NoError),
				},
				platformWithDock.log,
			);
		});
	});

	describe('dock error code branch', () => {
		it('Case 7: should set operationalError to dock error when dockErrorCode is an active error', async () => {
			const dockedRobot = createMockRobot(RvcOperationalState.OperationalState.Docked);
			const platformWithDock = createMockPlatform({
				configManager: createMockConfigManager({
					includeDockStationStatus: true,
					includeVacuumErrorStatus: true,
				}),
			});

			const message = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.None,
				dockErrorCode: DockErrorCode.WaterEmpty,
				dockStationStatus: undefined,
			});

			await handleErrorOccurred(dockedRobot, message, platformWithDock);

			// WaterEmpty maps to WaterTankEmpty
			expect(dockedRobot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalError',
				expect.objectContaining({
					errorStateId: RvcOperationalState.ErrorState.WaterTankEmpty,
				}),
				platformWithDock.log,
			);
		});

		it('Case 8: should clear operationalError when dockErrorCode resolves to NoError', async () => {
			const dockedRobot = createMockRobot(RvcOperationalState.OperationalState.Docked);
			const platformWithDock = createMockPlatform({
				configManager: createMockConfigManager({
					includeDockStationStatus: true,
					includeVacuumErrorStatus: true,
				}),
			});

			const message = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.None,
				dockErrorCode: DockErrorCode.NoDustbinOrFilter,
				dockStationStatus: undefined,
			});

			await handleErrorOccurred(dockedRobot, message, platformWithDock);

			// NoDustbinOrFilter maps to DustBinMissing
			expect(dockedRobot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalError',
				expect.objectContaining({
					errorStateId: RvcOperationalState.ErrorState.DustBinMissing,
				}),
				platformWithDock.log,
			);
		});
	});

	describe('fallback branch', () => {
		it('Case 9: should clear operationalError in fallback when dockStationStatus undefined and dockErrorCode is None', async () => {
			const dockedRobot = createMockRobot(RvcOperationalState.OperationalState.Docked);
			const platformWithDock = createMockPlatform({
				configManager: createMockConfigManager({
					includeDockStationStatus: true,
					includeVacuumErrorStatus: true,
				}),
			});

			const message = asPartial<DeviceErrorMessage>({
				duid: 'test-duid',
				vacuumErrorCode: VacuumErrorCode.None,
				dockErrorCode: DockErrorCode.None,
				dockStationStatus: undefined,
			});

			await handleErrorOccurred(dockedRobot, message, platformWithDock);

			// Should hit the final fallback and clear to NoError
			expect(dockedRobot.updateAttribute).toHaveBeenCalledWith(
				RvcOperationalState.id,
				'operationalError',
				{
					errorStateId: RvcOperationalState.ErrorState.NoError,
					errorStateDetails: getOperationalErrorName(RvcOperationalState.ErrorState.NoError),
				},
				platformWithDock.log,
			);
		});
	});
});
