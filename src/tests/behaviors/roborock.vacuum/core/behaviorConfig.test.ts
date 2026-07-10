import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	createDefaultBehaviorConfig,
	createSmartBehaviorConfig,
} from '../../../../behaviors/roborock.vacuum/core/behaviorConfig.js';
import {
	CleanModeDisplayLabel,
	CleanModeLabelInfo,
} from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig/index.js';
import { HandlerContext } from '../../../../behaviors/roborock.vacuum/core/modeHandler.js';
import { RunModeDisplayLabel } from '../../../../behaviors/roborock.vacuum/core/runModeConfig.js';
import { RoborockService } from '../../../../services/roborockService.js';
import { asPartial, createMockLogger } from '../../../helpers/testUtils.js';

describe('behaviorConfig', () => {
	let mockRoborockService: Partial<RoborockService>;
	let mockLogger: ReturnType<typeof createMockLogger>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockRoborockService = {
			pauseClean: vi.fn().mockResolvedValue(undefined),
		};
		mockLogger = createMockLogger();
	});

	describe('createDefaultBehaviorConfig', () => {
		it('should have name DefaultBehavior', () => {
			const config = createDefaultBehaviorConfig();
			expect(config.name).toBe('DefaultBehavior');
		});

		it('should include GoVacation in cleanModes', () => {
			const config = createDefaultBehaviorConfig();
			const goVacationMode = CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].mode;
			expect(config.cleanModes[goVacationMode]).toBe(CleanModeDisplayLabel.GoVacation);
		});

		it('should include EnergySaving in cleanModes', () => {
			const config = createDefaultBehaviorConfig();
			const mode = CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopEnergySaving].mode;
			expect(config.cleanModes[mode]).toBe(CleanModeDisplayLabel.VacuumAndMopEnergySaving);
		});

		it('should have cleanSettings for all base modes', () => {
			const config = createDefaultBehaviorConfig();
			const defaultMode = CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode;
			expect(config.cleanSettings[defaultMode]).toBeDefined();
			expect(config.cleanSettings[defaultMode].hasFullSettings).toBe(true);
		});

		it('should have runModeConfigs', () => {
			const config = createDefaultBehaviorConfig();
			expect(config.runModeConfigs.length).toBeGreaterThan(0);
		});

		it('should not include SmartPlan in cleanModes', () => {
			const config = createDefaultBehaviorConfig();
			const smartPlanMode = CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode;
			expect(config.cleanModes[smartPlanMode]).toBeUndefined();
		});

		it('should route Idle activity to IdleModeHandler', async () => {
			const config = createDefaultBehaviorConfig();
			const context: HandlerContext = {
				roborockService: asPartial<RoborockService>(mockRoborockService),
				logger: mockLogger,
				enableCleanModeMapping: false,
				cleanSettings: {},
				behaviorName: 'DefaultBehavior',
			};

			await config.registry.handle('test-duid', 1, RunModeDisplayLabel.Idle, context);

			expect(mockRoborockService.pauseClean).toHaveBeenCalledWith('test-duid');
		});

		it('should call logger when handling Idle activity', async () => {
			const config = createDefaultBehaviorConfig();
			const context: HandlerContext = {
				roborockService: asPartial<RoborockService>(mockRoborockService),
				logger: mockLogger,
				enableCleanModeMapping: false,
				cleanSettings: {},
				behaviorName: 'DefaultBehavior',
			};

			await config.registry.handle('test-duid', 1, RunModeDisplayLabel.Idle, context);

			expect(mockLogger.notice).toHaveBeenCalledWith('DefaultBehavior-ChangeRunMode to:', RunModeDisplayLabel.Idle);
		});
	});

	describe('createSmartBehaviorConfig', () => {
		it('should have name BehaviorSmart', () => {
			const config = createSmartBehaviorConfig();
			expect(config.name).toBe('BehaviorSmart');
		});

		it('should include SmartPlan in cleanModes', () => {
			const config = createSmartBehaviorConfig();
			const smartPlanMode = CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode;
			expect(config.cleanModes[smartPlanMode]).toBe(CleanModeDisplayLabel.SmartPlan);
		});

		it('should include GoVacation in cleanModes', () => {
			const config = createSmartBehaviorConfig();
			const goVacationMode = CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].mode;
			expect(config.cleanModes[goVacationMode]).toBe(CleanModeDisplayLabel.GoVacation);
		});

		it('should include VacFollowedByMop in cleanModes', () => {
			const config = createSmartBehaviorConfig();
			const mode = CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode;
			expect(config.cleanModes[mode]).toBe(CleanModeDisplayLabel.VacFollowedByMop);
		});

		it('should have cleanSettings including SmartPlan', () => {
			const config = createSmartBehaviorConfig();
			const smartPlanMode = CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode;
			expect(config.cleanSettings[smartPlanMode]).toBeDefined();
		});

		it('should route Idle activity to IdleModeHandler', async () => {
			const config = createSmartBehaviorConfig();
			const context: HandlerContext = {
				roborockService: asPartial<RoborockService>(mockRoborockService),
				logger: mockLogger,
				enableCleanModeMapping: false,
				cleanSettings: {},
				behaviorName: 'BehaviorSmart',
			};

			await config.registry.handle('test-duid', 1, RunModeDisplayLabel.Idle, context);

			expect(mockRoborockService.pauseClean).toHaveBeenCalledWith('test-duid');
		});

		it('should call logger when handling Idle activity', async () => {
			const config = createSmartBehaviorConfig();
			const context: HandlerContext = {
				roborockService: asPartial<RoborockService>(mockRoborockService),
				logger: mockLogger,
				enableCleanModeMapping: false,
				cleanSettings: {},
				behaviorName: 'BehaviorSmart',
			};

			await config.registry.handle('test-duid', 1, RunModeDisplayLabel.Idle, context);

			expect(mockLogger.notice).toHaveBeenCalledWith('BehaviorSmart-ChangeRunMode to:', RunModeDisplayLabel.Idle);
		});
	});
});
