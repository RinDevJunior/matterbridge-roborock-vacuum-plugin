import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
	smartPlanModeConfig,
	vacFollowedByMopModeConfig,
} from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig/index.js';
import {
	getAllKnownModeConfigs,
	getExtraModes,
	hasSmartPlan,
} from '../../../../behaviors/roborock.vacuum/core/deviceCapabilityRegistry.js';
import { decodeFeatureSet, type DeviceFeatures } from '../../../../share/featureSetDecoder.js';
import { asPartial } from '../../../helpers/testUtils.js';

vi.mock('../../../../share/featureSetDecoder.js', () => ({
	decodeFeatureSet: vi.fn(),
}));

// Duplicate mode number appended to the base list; the dedupe must keep the first (vacFollowedByMop) entry.
vi.mock('../../../../behaviors/roborock.vacuum/core/cleanModeConfig/index.js', async (importOriginal) => {
	const actual =
		await importOriginal<typeof import('../../../../behaviors/roborock.vacuum/core/cleanModeConfig/index.js')>();
	return {
		...actual,
		baseCleanModeConfigs: [...actual.baseCleanModeConfigs, { ...actual.vacFollowedByMopModeConfig }],
	};
});

function featuresWith(overrides: Partial<DeviceFeatures>): DeviceFeatures {
	return asPartial<DeviceFeatures>({
		is_smart_clean_mode_set_supported: false,
		is_clean_then_mop_mode_supported: false,
		...overrides,
	});
}

describe('deviceCapabilityRegistry gap coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getExtraModes', () => {
		it('should return no extra modes and skip decoding when no feature set context is provided', () => {
			const result = getExtraModes('roborock.vacuum.a27');

			expect(result).toEqual([]);
			expect(decodeFeatureSet).not.toHaveBeenCalled();
		});

		it('should include the smart plan mode when is_smart_clean_mode_set_supported is true', () => {
			vi.mocked(decodeFeatureSet).mockReturnValue(featuresWith({ is_smart_clean_mode_set_supported: true }));

			const result = getExtraModes('roborock.vacuum.a27', 'featureSet');

			expect(result).toContain(smartPlanModeConfig);
		});

		it('should not include the smart plan mode when is_smart_clean_mode_set_supported is false', () => {
			vi.mocked(decodeFeatureSet).mockReturnValue(featuresWith({ is_smart_clean_mode_set_supported: false }));

			const result = getExtraModes('roborock.vacuum.a27', 'featureSet');

			expect(result).not.toContain(smartPlanModeConfig);
		});

		it('should include the vac-then-mop mode when is_clean_then_mop_mode_supported is true', () => {
			vi.mocked(decodeFeatureSet).mockReturnValue(featuresWith({ is_clean_then_mop_mode_supported: true }));

			const result = getExtraModes('roborock.vacuum.a27', undefined, 'newFeatureSet');

			expect(result).toEqual([vacFollowedByMopModeConfig]);
		});
	});

	describe('hasSmartPlan', () => {
		it.each([true, false])('should return %s when is_smart_clean_mode_set_supported is %s', (expected) => {
			vi.mocked(decodeFeatureSet).mockReturnValue(featuresWith({ is_smart_clean_mode_set_supported: expected }));

			expect(hasSmartPlan('roborock.vacuum.a27', 'featureSet')).toBe(expected);
		});
	});

	describe('getAllKnownModeConfigs', () => {
		it('should keep only the first config for a duplicated mode number', () => {
			const known = getAllKnownModeConfigs();
			const matches = known.filter((config) => config.mode === vacFollowedByMopModeConfig.mode);

			expect(matches).toHaveLength(1);
			expect(matches[0]).toBe(vacFollowedByMopModeConfig);
		});

		it('should return exactly one config per unique mode number', () => {
			const known = getAllKnownModeConfigs();
			const uniqueModes = new Set(known.map((config) => config.mode));

			expect(known).toHaveLength(uniqueModes.size);
		});
	});
});
