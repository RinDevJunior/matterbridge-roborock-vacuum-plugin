import { HepaFilterMonitoring, ResourceMonitoring } from 'matterbridge/matter/clusters';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RoborockMatterbridgePlatform } from '../../../module.js';
import { handleConsumableUpdate } from '../../../runtimes/handlers/consumableStateHandler.js';
import type { RoborockVacuumCleaner } from '../../../types/roborockVacuumCleaner.js';
import { asPartial, createMockLogger } from '../../helpers/testUtils.js';

describe('consumableStateHandler', () => {
	let mockRobot: ReturnType<typeof createMockRobot>;
	let mockPlatform: ReturnType<typeof createMockPlatform>;

	function createMockRobot(): RoborockVacuumCleaner {
		return asPartial<RoborockVacuumCleaner>({
			updateAttribute: vi.fn().mockResolvedValue(undefined),
		});
	}

	function createMockPlatform() {
		return asPartial<RoborockMatterbridgePlatform>({
			log: createMockLogger(),
		});
	}

	beforeEach(() => {
		vi.clearAllMocks();
		mockRobot = createMockRobot();
		mockPlatform = createMockPlatform();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('handleConsumableUpdate', () => {
		it('should update condition to 50 and changeIndication to Ok when filterWorkTimeSec is 270000', async () => {
			// Arrange
			const data = {
				duid: 'test-duid',
				filterWorkTimeSec: 270000,
			};

			// Act
			await handleConsumableUpdate(mockRobot, data, mockPlatform as any); // asPartial requires cast due to TypeScript structural typing

			// Assert
			expect(mockRobot.updateAttribute).toHaveBeenCalledWith(
				HepaFilterMonitoring.id,
				'condition',
				50,
				mockPlatform.log,
			);
			expect(mockRobot.updateAttribute).toHaveBeenCalledWith(
				HepaFilterMonitoring.id,
				'changeIndication',
				ResourceMonitoring.ChangeIndication.Ok,
				mockPlatform.log,
			);
			expect(mockRobot.updateAttribute).toHaveBeenCalledTimes(2);
		});

		it('should update with Warning when filter is 90% used (10% remaining)', async () => {
			// Arrange: 540000 - (540000 * 0.9) = 54000 (about 10% remaining)
			const data = {
				duid: 'test-duid',
				filterWorkTimeSec: 486000,
			};

			// Act
			await handleConsumableUpdate(mockRobot, data, mockPlatform as any); // asPartial requires cast due to TypeScript structural typing

			// Assert
			expect(mockRobot.updateAttribute).toHaveBeenCalledWith(
				HepaFilterMonitoring.id,
				'condition',
				10,
				mockPlatform.log,
			);
			expect(mockRobot.updateAttribute).toHaveBeenCalledWith(
				HepaFilterMonitoring.id,
				'changeIndication',
				ResourceMonitoring.ChangeIndication.Warning,
				mockPlatform.log,
			);
		});

		it('should update with Critical when filter is 97% used (3% remaining)', async () => {
			// Arrange: 540000 - (540000 * 0.97) = 16200 (about 3% remaining)
			const data = {
				duid: 'test-duid',
				filterWorkTimeSec: 523800,
			};

			// Act
			await handleConsumableUpdate(mockRobot, data, mockPlatform as any); // asPartial requires cast due to TypeScript structural typing

			// Assert
			expect(mockRobot.updateAttribute).toHaveBeenCalledWith(HepaFilterMonitoring.id, 'condition', 3, mockPlatform.log);
			expect(mockRobot.updateAttribute).toHaveBeenCalledWith(
				HepaFilterMonitoring.id,
				'changeIndication',
				ResourceMonitoring.ChangeIndication.Critical,
				mockPlatform.log,
			);
		});

		it('should update condition to 100 for fresh filter (filterWorkTimeSec: 0)', async () => {
			// Arrange
			const data = {
				duid: 'test-duid',
				filterWorkTimeSec: 0,
			};

			// Act
			await handleConsumableUpdate(mockRobot, data, mockPlatform as any); // asPartial requires cast due to TypeScript structural typing

			// Assert
			expect(mockRobot.updateAttribute).toHaveBeenCalledWith(
				HepaFilterMonitoring.id,
				'condition',
				100,
				mockPlatform.log,
			);
			expect(mockRobot.updateAttribute).toHaveBeenCalledWith(
				HepaFilterMonitoring.id,
				'changeIndication',
				ResourceMonitoring.ChangeIndication.Ok,
				mockPlatform.log,
			);
		});
	});
});
