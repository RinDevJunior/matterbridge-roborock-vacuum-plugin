import { AnsiLogger } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { HandlerContext } from '../../../../behaviors/roborock.vacuum/core/modeHandler.js';
import { RunModeDisplayLabel } from '../../../../behaviors/roborock.vacuum/core/runModeConfig.js';
import { CleaningModeHandler } from '../../../../behaviors/roborock.vacuum/handlers/cleaningModeHandler.js';
import { RoborockService } from '../../../../services/roborockService.js';
import { asPartial, createMockLogger } from '../../../helpers/testUtils.js';

describe('CleaningModeHandler', () => {
	let handler: CleaningModeHandler;
	let setProgress: Mock<(...args: never[]) => void>;
	let startClean: Mock<(...args: never[]) => Promise<void>>;
	let onCleaningStart: Mock<(...args: never[]) => void | Promise<void>>;
	let mockLogger: Partial<AnsiLogger>;
	let context: HandlerContext;
	const duid = 'test-duid';

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new CleaningModeHandler();
		setProgress = vi.fn<(...args: never[]) => void>();
		startClean = vi.fn<(...args: never[]) => Promise<void>>().mockResolvedValue(undefined);
		onCleaningStart = vi.fn<(...args: never[]) => void | Promise<void>>();
		mockLogger = createMockLogger();

		context = {
			roborockService: asPartial<RoborockService>({ setProgress, startClean }),
			logger: asPartial<AnsiLogger>(mockLogger),
			enableCleanModeMapping: false,
			cleanSettings: {},
			behaviorName: 'TestBehavior',
			onCleaningStart,
		};
	});

	describe('canHandle', () => {
		it('should return true only for the Cleaning run mode label', () => {
			expect(handler.canHandle(2, RunModeDisplayLabel.Cleaning)).toBe(true);
		});

		it('should return false for Idle and Mapping run mode labels', () => {
			expect(handler.canHandle(1, RunModeDisplayLabel.Idle)).toBe(false);
			expect(handler.canHandle(3, RunModeDisplayLabel.Mapping)).toBe(false);
		});
	});

	describe('handle', () => {
		it('should call setProgress, startClean, then onCleaningStart in that order', async () => {
			// Arrange
			const callOrder: string[] = [];
			setProgress.mockImplementation(() => {
				callOrder.push('setProgress');
			});
			startClean.mockImplementation(async () => {
				callOrder.push('startClean');
			});
			onCleaningStart.mockImplementation(() => {
				callOrder.push('onCleaningStart');
			});

			// Act
			await handler.handle(duid, 2, RunModeDisplayLabel.Cleaning, context);

			// Assert
			expect(setProgress).toHaveBeenCalledWith(duid, []);
			expect(callOrder).toEqual(['setProgress', 'startClean', 'onCleaningStart']);
		});

		it('should still call startClean when onCleaningStart is undefined', async () => {
			// Arrange
			context = { ...context, onCleaningStart: undefined };

			// Act
			await handler.handle(duid, 2, RunModeDisplayLabel.Cleaning, context);

			// Assert
			expect(startClean).toHaveBeenCalledWith(duid);
		});

		it('should log a warning and resolve when onCleaningStart rejects', async () => {
			// Arrange
			onCleaningStart.mockRejectedValue(new Error('reset failed'));

			// Act
			await expect(handler.handle(duid, 2, RunModeDisplayLabel.Cleaning, context)).resolves.toBeUndefined();

			// Assert
			expect(startClean).toHaveBeenCalledWith(duid);
			expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('onCleaningStart failed'));
		});

		it('should reject and not call onCleaningStart when startClean rejects', async () => {
			// Arrange
			startClean.mockRejectedValue(new Error('start failed'));

			// Act
			await expect(handler.handle(duid, 2, RunModeDisplayLabel.Cleaning, context)).rejects.toThrow('start failed');

			// Assert
			expect(onCleaningStart).not.toHaveBeenCalled();
		});
	});
});
