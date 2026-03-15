import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoborockMatterbridgePlatform } from '../../module.js';
import { triggerDssError } from '../../runtimes/handleLocalMessage.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger } from '../helpers/testUtils.js';

function createMockRobot(operationalState: RvcOperationalState.OperationalState): RoborockVacuumCleaner {
	return asPartial<RoborockVacuumCleaner>({
		getAttribute: vi.fn().mockReturnValue(operationalState),
		updateAttribute: vi.fn().mockResolvedValue(true),
	});
}

function createMockPlatform(): RoborockMatterbridgePlatform {
	return asPartial<RoborockMatterbridgePlatform>({
		log: createMockLogger(),
	});
}

describe('triggerDssError', () => {
	let platform: RoborockMatterbridgePlatform;

	beforeEach(() => {
		vi.clearAllMocks();
		platform = createMockPlatform();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should return true and not update when already in Error state', async () => {
		const robot = createMockRobot(RvcOperationalState.OperationalState.Error);

		const result = await triggerDssError(robot, platform);

		expect(result).toBe(true);
		expect(robot.updateAttribute).not.toHaveBeenCalled();
	});

	it('should update to Error and return true when state is Docked', async () => {
		const robot = createMockRobot(RvcOperationalState.OperationalState.Docked);

		const result = await triggerDssError(robot, platform);

		expect(result).toBe(true);
		expect(robot.updateAttribute).toHaveBeenCalledWith(
			RvcOperationalState.Cluster.id,
			'operationalState',
			RvcOperationalState.OperationalState.Error,
			platform.log,
		);
	});

	it('should return false when state is Running', async () => {
		const robot = createMockRobot(RvcOperationalState.OperationalState.Running);

		const result = await triggerDssError(robot, platform);

		expect(result).toBe(false);
		expect(robot.updateAttribute).not.toHaveBeenCalled();
	});

	it('should return false when state is SeekingCharger', async () => {
		const robot = createMockRobot(RvcOperationalState.OperationalState.SeekingCharger);

		const result = await triggerDssError(robot, platform);

		expect(result).toBe(false);
		expect(robot.updateAttribute).not.toHaveBeenCalled();
	});
});
