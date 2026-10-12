import { type AnsiLogger, debugStringify } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
	CleanModeDisplayLabel,
	CleanModeLabelInfo,
} from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig/index.js';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import type { HandlerContext } from '../../../../behaviors/roborock.vacuum/core/modeHandler.js';
import {
	CleanSequenceType,
	MopRoute,
	MopWaterFlow,
	VacuumSuctionPower,
} from '../../../../behaviors/roborock.vacuum/enums/index.js';
import { DefaultCleanModeHandler } from '../../../../behaviors/roborock.vacuum/handlers/defaultCleanModeHandler.js';
import { createDefaultCleanModeSettings } from '../../../../model/RoborockPluginPlatformConfig.js';
import { RoborockService } from '../../../../services/roborockService.js';
import { asPartial, createMockLogger } from '../../../helpers/testUtils.js';

describe('DefaultCleanModeHandler gap coverage', () => {
	let handler: DefaultCleanModeHandler;
	let context: HandlerContext;
	let changeCleanMode: Mock<RoborockService['changeCleanMode']>;
	const duid = 'test-duid';
	const defaultMode = CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode;
	const defaultSetting = new CleanModeSetting(
		VacuumSuctionPower.Balanced,
		MopWaterFlow.Medium,
		0,
		MopRoute.Standard,
		CleanSequenceType.Persist,
	);

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new DefaultCleanModeHandler();
		changeCleanMode = vi.fn<RoborockService['changeCleanMode']>().mockResolvedValue(undefined);
		context = {
			roborockService: asPartial<RoborockService>({ changeCleanMode }),
			logger: asPartial<AnsiLogger>(createMockLogger()),
			enableCleanModeMapping: false,
			cleanModeSettings: undefined,
			cleanSettings: { [defaultMode]: defaultSetting },
			behaviorName: 'TestBehavior',
		};
	});

	describe('handle', () => {
		it('should use cleanSettings[mode] when the mapped setting is undefined for an unknown activity', async () => {
			context.enableCleanModeMapping = true;
			context.cleanModeSettings = createDefaultCleanModeSettings();

			await handler.handle(duid, defaultMode, 'Unknown Activity', context);

			expect(changeCleanMode).toHaveBeenCalledWith(duid, defaultSetting);
		});

		it('should log an empty setting and skip changeCleanMode when no setting resolves from either source', async () => {
			context.enableCleanModeMapping = true;
			context.cleanModeSettings = createDefaultCleanModeSettings();
			context.cleanSettings = {};

			await handler.handle(duid, defaultMode, 'Unknown Activity', context);

			expect(context.logger.notice).toHaveBeenCalledWith(expect.stringContaining(`setting: ${debugStringify({})}`));
			expect(changeCleanMode).not.toHaveBeenCalled();
		});

		it('should log an empty setting and skip changeCleanMode when cleanSettings has no entry for the mode', async () => {
			context.cleanSettings = {};

			await handler.handle(duid, defaultMode, CleanModeDisplayLabel.VacuumDefault, context);

			expect(context.logger.notice).toHaveBeenCalledWith(expect.stringContaining(`setting: ${debugStringify({})}`));
			expect(changeCleanMode).not.toHaveBeenCalled();
		});
	});
});
