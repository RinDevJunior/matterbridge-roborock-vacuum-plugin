import { describe, expect, it } from 'vitest';

import {
	CleanModeDisplayLabel,
	CleanModeLabelInfo,
	smartCleanModeConfigs,
} from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig/index.js';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { createSmartModeResolver } from '../../../../behaviors/roborock.vacuum/core/modeResolver.js';
import { CleanSequenceType } from '../../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../../../behaviors/roborock.vacuum/enums/index.js';
import { asType } from '../../../testUtils.js';

const smartModeResolver = createSmartModeResolver(smartCleanModeConfigs);

describe('getCurrentCleanModeSmart', () => {
	it('returns undefined if input is undefined', () => {
		expect(smartModeResolver.resolve(asType<CleanModeSetting>(undefined))).toBeUndefined();
	});

	it('returns the correct key if an exact CleanSetting match exists', () => {
		// Exact match for 'Vac & Mop Default' (key 5)
		expect(
			smartModeResolver.resolve(
				new CleanModeSetting(
					VacuumSuctionPower.Balanced,
					MopWaterFlow.Medium,
					0,
					MopRoute.Standard,
					CleanSequenceType.Persist,
				),
			),
		).toBe(5);
	});

	it('returns 12 for MopMax', () => {
		expect(
			smartModeResolver.resolve(
				new CleanModeSetting(
					VacuumSuctionPower.Off,
					MopWaterFlow.High,
					0,
					MopRoute.Standard,
					CleanSequenceType.Persist,
				),
			),
		).toBe(32);
	});

	it('returns 16 for Vacuum Default if waterFlow is Off', () => {
		expect(
			smartModeResolver.resolve(
				new CleanModeSetting(
					VacuumSuctionPower.Balanced,
					MopWaterFlow.Off,
					0,
					MopRoute.Standard,
					CleanSequenceType.Persist,
				),
			),
		).toBe(66);
	});

	it('returns 5 for Vac & Mop Default if neither suctionPower nor waterFlow is Off', () => {
		expect(
			smartModeResolver.resolve(
				new CleanModeSetting(
					VacuumSuctionPower.Balanced,
					MopWaterFlow.Medium,
					1,
					MopRoute.Standard,
					CleanSequenceType.Persist,
				),
			),
		).toBe(5);
	});

	it('returns 5 if no match and no fallback applies', () => {
		expect(smartModeResolver.resolve(new CleanModeSetting(999, 999, 999, 999, CleanSequenceType.Persist))).toBe(
			CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode,
		); // should return MopAndVacuumCustom mode
	});
});
