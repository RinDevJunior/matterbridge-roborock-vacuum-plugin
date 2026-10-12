import { type AnsiLogger, debugStringify } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import {
	CleanModeDisplayLabel,
	CleanModeLabelInfo,
} from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig/index.js';
import type { HandlerContext } from '../../../../behaviors/roborock.vacuum/core/modeHandler.js';
import { PresetCleanModeHandler } from '../../../../behaviors/roborock.vacuum/handlers/presetCleanModeHandler.js';
import { RoborockService } from '../../../../services/roborockService.js';
import { asPartial, createMockLogger } from '../../../helpers/testUtils.js';

describe('PresetCleanModeHandler gap coverage', () => {
	let handler: PresetCleanModeHandler;
	let context: HandlerContext;
	let changeCleanMode: Mock<RoborockService['changeCleanMode']>;
	const duid = 'test-duid';
	const presetMode = CleanModeLabelInfo[CleanModeDisplayLabel.VacuumMax].mode;

	beforeEach(() => {
		vi.clearAllMocks();
		handler = new PresetCleanModeHandler();
		changeCleanMode = vi.fn<RoborockService['changeCleanMode']>().mockResolvedValue(undefined);
		context = {
			roborockService: asPartial<RoborockService>({ changeCleanMode }),
			logger: asPartial<AnsiLogger>(createMockLogger()),
			enableCleanModeMapping: false,
			cleanModeSettings: undefined,
			cleanSettings: {},
			behaviorName: 'TestBehavior',
		};
	});

	describe('handle', () => {
		it('should log an empty setting and skip changeCleanMode when cleanSettings has no entry for the mode', async () => {
			await handler.handle(duid, presetMode, CleanModeDisplayLabel.VacuumMax, context);

			expect(context.logger.notice).toHaveBeenCalledWith(expect.stringContaining(`setting: ${debugStringify({})}`));
			expect(changeCleanMode).not.toHaveBeenCalled();
		});
	});
});
