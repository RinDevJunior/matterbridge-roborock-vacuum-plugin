import { AnsiLogger } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HandlerContext } from '../../../../behaviors/roborock.vacuum/core/modeHandler.js';
import { RunModeDisplayLabel } from '../../../../behaviors/roborock.vacuum/core/runModeConfig.js';
import { IdleModeHandler } from '../../../../behaviors/roborock.vacuum/handlers/idleModeHandler.js';
import { RoborockService } from '../../../../services/roborockService.js';
import { asPartial, createMockLogger } from '../../../helpers/testUtils.js';

describe('IdleModeHandler', () => {
	let handler: IdleModeHandler;
	let mockRoborockService: Partial<RoborockService>;
	let mockLogger: Partial<AnsiLogger>;
	let context: HandlerContext;
	const duid = 'test-duid';

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new IdleModeHandler();
		mockRoborockService = {
			pauseClean: vi.fn().mockResolvedValue(undefined),
		};
		mockLogger = createMockLogger();

		context = {
			roborockService: asPartial<RoborockService>(mockRoborockService),
			logger: asPartial<AnsiLogger>(mockLogger),
			enableCleanModeMapping: false,
			cleanSettings: {},
			behaviorName: 'TestBehavior',
		};
	});

	describe('canHandle', () => {
		it('should return true for Idle activity', () => {
			expect(handler.canHandle(1, RunModeDisplayLabel.Idle)).toBe(true);
		});

		it('should return true for Idle activity regardless of mode value', () => {
			expect(handler.canHandle(0, RunModeDisplayLabel.Idle)).toBe(true);
			expect(handler.canHandle(999, RunModeDisplayLabel.Idle)).toBe(true);
		});

		it('should return false for Cleaning activity', () => {
			expect(handler.canHandle(1, RunModeDisplayLabel.Cleaning)).toBe(false);
		});

		it('should return false for Mapping activity', () => {
			expect(handler.canHandle(1, RunModeDisplayLabel.Mapping)).toBe(false);
		});

		it('should return false for unknown activity', () => {
			expect(handler.canHandle(1, 'Unknown')).toBe(false);
		});
	});

	describe('handle', () => {
		it('should call roborockService.pauseClean with correct duid', async () => {
			await handler.handle(duid, 1, RunModeDisplayLabel.Idle, context);

			expect(mockRoborockService.pauseClean).toHaveBeenCalledWith(duid);
			expect(mockRoborockService.pauseClean).toHaveBeenCalledTimes(1);
		});

		it('should call logger.notice with correct format', async () => {
			await handler.handle(duid, 1, RunModeDisplayLabel.Idle, context);

			expect(mockLogger.notice).toHaveBeenCalledWith(
				`${context.behaviorName}-ChangeRunMode to:`,
				RunModeDisplayLabel.Idle,
			);
		});

		it('should await pauseClean before resolving', async () => {
			const pauseCleanSpy = vi.fn().mockImplementation(async () => {
				// Simulate async work
				await new Promise((resolve) => setTimeout(resolve, 10));
			});
			mockRoborockService.pauseClean = pauseCleanSpy;

			const handlePromise = handler.handle(duid, 1, RunModeDisplayLabel.Idle, context);

			// pauseClean should be called before promise resolves
			expect(pauseCleanSpy).toHaveBeenCalled();
			await handlePromise;
			expect(pauseCleanSpy).toHaveBeenCalledTimes(1);
		});

		it('should call both logger and pauseClean', async () => {
			await handler.handle(duid, 1, RunModeDisplayLabel.Idle, context);

			expect(mockLogger.notice).toHaveBeenCalled();
			expect(mockRoborockService.pauseClean).toHaveBeenCalled();
		});

		it('should handle different behavior names', async () => {
			context.behaviorName = 'BehaviorSmart';
			await handler.handle(duid, 1, RunModeDisplayLabel.Idle, context);

			expect(mockLogger.notice).toHaveBeenCalledWith('BehaviorSmart-ChangeRunMode to:', RunModeDisplayLabel.Idle);
		});
	});
});
