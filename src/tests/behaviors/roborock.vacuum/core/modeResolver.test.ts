import { describe, expect, it } from 'vitest';

import {
	baseCleanModeConfigs,
	CleanModeDisplayLabel,
	CleanModeLabelInfo,
	mopOnlyModeConfigs,
	smartCleanModeConfigs,
	smartPlanModeConfig,
	vacFollowedByMopModeConfig,
	vacuumAndMopModeConfigs,
	vacuumOnlyModeConfigs,
} from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig/index.js';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import {
	createDefaultModeResolver,
	createSmartModeResolver,
	ModeResolver,
} from '../../../../behaviors/roborock.vacuum/core/modeResolver.js';
import {
	CleanSequenceType,
	MopRoute,
	MopWaterFlow,
	VacuumSuctionPower,
} from '../../../../behaviors/roborock.vacuum/enums/index.js';

describe('ModeResolver', () => {
	describe('resolve', () => {
		it('should return undefined for null/undefined input', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			expect(resolver.resolve(undefined as unknown as CleanModeSetting)).toBeUndefined();
			expect(resolver.resolve(null as unknown as CleanModeSetting)).toBeUndefined();
		});

		it('should return undefined for non-object input', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			expect(resolver.resolve('invalid' as unknown as CleanModeSetting)).toBeUndefined();
		});

		it('should resolve exact match for MopAndVacuumDefault setting', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Medium,
				0,
				MopRoute.Standard,
				CleanSequenceType.Persist,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode);
		});

		it('should resolve exact match for VacuumDefault setting', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Off,
				0,
				MopRoute.Standard,
				CleanSequenceType.Persist,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode);
		});

		it('should resolve exact match for MopDefault setting', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Off,
				MopWaterFlow.Medium,
				0,
				MopRoute.Standard,
				CleanSequenceType.Persist,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].mode);
		});

		it('should fallback to MopDefault when suctionPower is Off', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			const setting = new CleanModeSetting(VacuumSuctionPower.Off, 999, 0, 999, CleanSequenceType.Persist);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].mode);
		});

		it('should fallback to VacuumDefault when waterFlow is Off', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			const setting = new CleanModeSetting(999, MopWaterFlow.Off, 0, 999, CleanSequenceType.Persist);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode);
		});

		it('should fallback to MopAndVacuumDefault when both suctionPower and waterFlow are non-zero/non-off', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			const setting = new CleanModeSetting(999, 999, 0, 999, CleanSequenceType.Persist);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode);
		});

		it('should use customCheckFn when provided', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs, () => 42);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Medium,
				0,
				MopRoute.Standard,
				CleanSequenceType.Persist,
			);
			expect(resolver.resolve(setting)).toBe(42);
		});

		it('should fall through customCheckFn when it returns undefined', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs, () => undefined);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Medium,
				0,
				MopRoute.Standard,
				CleanSequenceType.Persist,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode);
		});
	});

	describe('resolveFallback — category-aware matching (rc02 fix)', () => {
		it('should match vacuum+mop category by suction power when exact triple does not match', () => {
			const resolver = new ModeResolver(vacuumAndMopModeConfigs);
			// Max suction with a non-canonical water flow/route combination
			// Should resolve to VacuumAndMopMax mode instead of VacuumAndMopDefault
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Max,
				MopWaterFlow.High, // Non-canonical combo
				0,
				MopRoute.DeepPlus, // Non-canonical combo
				CleanSequenceType.Persist,
			);
			const result = resolver.resolve(setting);
			// Should find a VacuumAndMopMax config that matches the suction power
			const vacuumAndMopMaxConfigs = vacuumAndMopModeConfigs.filter(
				(c) => c.setting.suctionPower === VacuumSuctionPower.Max && c.setting.waterFlow !== MopWaterFlow.Off,
			);
			expect(vacuumAndMopMaxConfigs.length).toBeGreaterThan(0);
			expect(result).toBe(vacuumAndMopMaxConfigs[0].mode);
		});

		it('should match vacuum-only category by suction power when mop is off', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			// Max suction with mop off and non-canonical mop route
			// Should resolve to VacuumMax mode, not VacuumDefault
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Max,
				MopWaterFlow.Off,
				0,
				MopRoute.Deep, // Non-canonical but mop is off
				CleanSequenceType.Persist,
			);
			const result = resolver.resolve(setting);
			// Should find a VacuumMax config
			const vacuumMaxConfigs = vacuumOnlyModeConfigs.filter(
				(c) => c.setting.suctionPower === VacuumSuctionPower.Max && c.setting.waterFlow === MopWaterFlow.Off,
			);
			expect(vacuumMaxConfigs.length).toBeGreaterThan(0);
			expect(result).toBe(vacuumMaxConfigs[0].mode);
		});

		it('should match mop-only category by water flow when vacuum is off', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			// Mop with High water flow and mop vacuum off with non-canonical route
			// Should resolve to MopMax mode, not MopDefault
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Off,
				MopWaterFlow.High,
				0,
				MopRoute.Fast, // Non-canonical but vacuum is off
				CleanSequenceType.Persist,
			);
			const result = resolver.resolve(setting);
			// Should find a MopHigh config (mop-only category)
			const mopHighConfigs = mopOnlyModeConfigs.filter(
				(c) => c.setting.suctionPower === VacuumSuctionPower.Off && c.setting.waterFlow === MopWaterFlow.High,
			);
			expect(mopHighConfigs.length).toBeGreaterThan(0);
			expect(result).toBe(mopHighConfigs[0].mode);
		});

		it('should fall back to category default when no same-category match exists', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			// Unrecognized suction power + active water flow
			// No vacuum-only mode exists for this suction value, should fall to VacuumAndMopDefault
			const setting = new CleanModeSetting(
				999, // Unrecognized suction power
				MopWaterFlow.High,
				0,
				MopRoute.Standard,
				CleanSequenceType.Persist,
			);
			const result = resolver.resolve(setting);
			expect(result).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode);
		});

		it('should preserve exact-match priority over fallback matching', () => {
			const resolver = new ModeResolver(baseCleanModeConfigs);
			// Exact match for VacuumAndMopQuiet triple should take priority
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Quiet,
				MopWaterFlow.Low,
				0,
				MopRoute.Standard,
				CleanSequenceType.Persist,
			);
			const result = resolver.resolve(setting);
			// Should resolve via exact match, not fallback
			expect(result).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopQuiet].mode);
		});

		it('should match vacuum+mop balanced suction with different water flow', () => {
			const resolver = new ModeResolver(vacuumAndMopModeConfigs);
			// Balanced suction with non-canonical water flow
			// Should find a BalancedMop config by suction power match
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Low, // Non-canonical combo (e.g., Balanced typically pairs with Medium)
				0,
				MopRoute.Custom,
				CleanSequenceType.Persist,
			);
			const result = resolver.resolve(setting);
			// Should find a config with Balanced suction in vacuum+mop category
			const balancedConfigs = vacuumAndMopModeConfigs.filter(
				(c) => c.setting.suctionPower === VacuumSuctionPower.Balanced && c.setting.waterFlow !== MopWaterFlow.Off,
			);
			expect(balancedConfigs.length).toBeGreaterThan(0);
			expect(result).toBe(balancedConfigs[0].mode);
		});
	});

	describe('createDefaultModeResolver', () => {
		it('should fall through when VacFollowedByMop is unsupported with OneTime sequenceType', () => {
			const resolver = createDefaultModeResolver(baseCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Medium,
				0,
				MopRoute.Standard,
				CleanSequenceType.OneTime,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode);
		});

		it('should resolve custom mode to EnergySaving', () => {
			const resolver = createDefaultModeResolver(baseCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Custom,
				MopWaterFlow.Custom,
				0,
				MopRoute.Custom,
				CleanSequenceType.Persist,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopEnergySaving].mode);
		});

		it('should resolve normal settings via exact match', () => {
			const resolver = createDefaultModeResolver(baseCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Medium,
				0,
				MopRoute.Standard,
				CleanSequenceType.Persist,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode);
		});

		it('should have default behavior type', () => {
			const resolver = createDefaultModeResolver(baseCleanModeConfigs);
			expect(resolver.behavior).toBe('default');
		});

		it('should fall through to custom mode when VacFollowedByMop is unsupported with OneTime sequenceType', () => {
			const resolver = createDefaultModeResolver(baseCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Custom,
				MopWaterFlow.Custom,
				0,
				MopRoute.Custom,
				CleanSequenceType.OneTime,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopEnergySaving].mode);
		});

		it('should resolve OneTime sequenceType to VacFollowedByMop mode when supported', () => {
			const resolver = createDefaultModeResolver([vacFollowedByMopModeConfig, ...baseCleanModeConfigs]);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Medium,
				0,
				MopRoute.Standard,
				CleanSequenceType.OneTime,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode);
		});

		it('should prioritize OneTime over custom mode when VacFollowedByMop is supported', () => {
			const resolver = createDefaultModeResolver([vacFollowedByMopModeConfig, ...baseCleanModeConfigs]);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Custom,
				MopWaterFlow.Custom,
				0,
				MopRoute.Custom,
				CleanSequenceType.OneTime,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode);
		});
	});

	describe('createSmartModeResolver', () => {
		it('should resolve smart mode to SmartPlan', () => {
			const resolver = createSmartModeResolver(smartCleanModeConfigs);
			const setting = new CleanModeSetting(0, 0, 0, MopRoute.Smart, CleanSequenceType.Persist);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode);
		});

		it('should resolve OneTime sequenceType to VacFollowedByMop mode', () => {
			const resolver = createSmartModeResolver(smartCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Medium,
				0,
				MopRoute.Standard,
				CleanSequenceType.OneTime,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode);
		});

		it('should resolve custom mode to EnergySaving', () => {
			const resolver = createSmartModeResolver(smartCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Custom,
				MopWaterFlow.Custom,
				0,
				MopRoute.Custom,
				CleanSequenceType.Persist,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopEnergySaving].mode);
		});

		it('should have smart behavior type', () => {
			const resolver = createSmartModeResolver(smartCleanModeConfigs);
			expect(resolver.behavior).toBe('smart');
		});

		it('should prioritize smart mode over OneTime', () => {
			const resolver = createSmartModeResolver(smartCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Smart,
				MopWaterFlow.Smart,
				0,
				MopRoute.Smart,
				CleanSequenceType.OneTime,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode);
		});

		it('should prioritize OneTime over custom mode', () => {
			const resolver = createSmartModeResolver(smartCleanModeConfigs);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Custom,
				MopWaterFlow.Custom,
				0,
				MopRoute.Custom,
				CleanSequenceType.OneTime,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacFollowedByMop].mode);
		});

		it('should fall through when VacFollowedByMop is unsupported in smart mode with OneTime sequenceType', () => {
			const resolver = createSmartModeResolver([smartPlanModeConfig, ...baseCleanModeConfigs]);
			const setting = new CleanModeSetting(
				VacuumSuctionPower.Balanced,
				MopWaterFlow.Medium,
				0,
				MopRoute.Standard,
				CleanSequenceType.OneTime,
			);
			expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumAndMopDefault].mode);
		});
	});
});
