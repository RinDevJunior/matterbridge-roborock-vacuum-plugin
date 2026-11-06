import { RvcCleanMode } from 'matterbridge/matter/clusters';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType } from '../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../../behaviors/roborock.vacuum/enums/index.js';
import type { RoborockMatterbridgePlatform } from '../../../module.js';
import { Device, DeviceModel } from '../../../roborockCommunication/models/index.js';
import { handleCleanModeUpdate } from '../../../runtimes/handlers/cleanModeHandler.js';
import type { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, createMockConfigManager, createMockLogger } from '../../helpers/testUtils.js';

function createMockRobot(): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		device: asPartial<Device>({
			duid: 'test-duid',
			specs: asPartial<Device['specs']>({ model: DeviceModel.S5 }),
		}),
		cleanModeSetting: undefined,
		updateAttribute: vi.fn().mockResolvedValue(true),
	});
}

function createMockPlatform(): RoborockMatterbridgePlatform {
	return asPartial<RoborockMatterbridgePlatform>({
		log: createMockLogger(),
		configManager: createMockConfigManager({ forceRunAtDefault: false }),
	});
}

describe('handleCleanModeUpdate gap coverage', () => {
	let robot: RoborockVacuumCleaner;
	let platform: RoborockMatterbridgePlatform;

	beforeEach(() => {
		vi.clearAllMocks();
		robot = createMockRobot();
		platform = createMockPlatform();
	});

	it('should store the setting with Persist sequence type when seq_type is undefined', async () => {
		await handleCleanModeUpdate(
			robot,
			{
				suctionPower: VacuumSuctionPower.Balanced,
				waterFlow: MopWaterFlow.Off,
				distance_off: 0,
				mopRoute: MopRoute.Standard,
				seq_type: undefined,
			},
			platform,
		);

		expect(robot.cleanModeSetting).toEqual(
			new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Off,
				0,
				MopRoute.Standard,
				CleanSequenceType.Persist,
			),
		);
	});

	it('should keep the provided sequence type when seq_type is set', async () => {
		await handleCleanModeUpdate(
			robot,
			{
				suctionPower: VacuumSuctionPower.Balanced,
				waterFlow: MopWaterFlow.Off,
				distance_off: 0,
				mopRoute: MopRoute.Standard,
				seq_type: CleanSequenceType.OneTime,
			},
			platform,
		);

		expect(robot.cleanModeSetting?.sequenceType).toBe(CleanSequenceType.OneTime);
	});

	it('should skip the clean mode update when mopRoute is undefined', async () => {
		await handleCleanModeUpdate(
			robot,
			{
				suctionPower: VacuumSuctionPower.Balanced,
				waterFlow: MopWaterFlow.Off,
				distance_off: 0,
				mopRoute: undefined,
				seq_type: CleanSequenceType.Persist,
			},
			platform,
		);

		expect(robot.cleanModeSetting).toBeUndefined();
		expect(robot.updateAttribute).not.toHaveBeenCalledWith(
			RvcCleanMode.id,
			'currentMode',
			expect.anything(),
			expect.anything(),
		);
	});
});
