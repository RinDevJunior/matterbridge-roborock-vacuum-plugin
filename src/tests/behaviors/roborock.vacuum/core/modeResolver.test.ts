import { describe, it, expect } from 'vitest';
import { ModeResolver, createDefaultModeResolver, createSmartModeResolver } from '../../../../behaviors/roborock.vacuum/core/modeResolver.js';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { baseCleanModeConfigs, smartCleanModeConfigs, CleanModeDisplayLabel, CleanModeLabelInfo } from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig.js';
import { CleanSequenceType, MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../../../behaviors/roborock.vacuum/enums/index.js';

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
      const setting = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode);
    });

    it('should resolve exact match for VacuumDefault setting', () => {
      const resolver = new ModeResolver(baseCleanModeConfigs);
      const setting = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Off, 0, MopRoute.Standard, CleanSequenceType.Persist);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode);
    });

    it('should resolve exact match for MopDefault setting', () => {
      const resolver = new ModeResolver(baseCleanModeConfigs);
      const setting = new CleanModeSetting(VacuumSuctionPower.Off, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist);
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
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode);
    });

    it('should use customCheckFn when provided', () => {
      const resolver = new ModeResolver(baseCleanModeConfigs, () => 42);
      const setting = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist);
      expect(resolver.resolve(setting)).toBe(42);
    });

    it('should fall through customCheckFn when it returns undefined', () => {
      const resolver = new ModeResolver(baseCleanModeConfigs, () => undefined);
      const setting = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode);
    });
  });

  describe('createDefaultModeResolver', () => {
    it('should resolve OneTime sequenceType to VacFollowedByMop mode', () => {
      const resolver = createDefaultModeResolver(baseCleanModeConfigs);
      const setting = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.OneTime);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode);
    });

    it('should resolve custom mode to EnergySaving', () => {
      const resolver = createDefaultModeResolver(baseCleanModeConfigs);
      const setting = new CleanModeSetting(VacuumSuctionPower.Custom, MopWaterFlow.Custom, 0, MopRoute.Custom, CleanSequenceType.Persist);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumEnergySaving].mode);
    });

    it('should resolve normal settings via exact match', () => {
      const resolver = createDefaultModeResolver(baseCleanModeConfigs);
      const setting = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode);
    });

    it('should have default behavior type', () => {
      const resolver = createDefaultModeResolver(baseCleanModeConfigs);
      expect(resolver.behavior).toBe('default');
    });

    it('should prioritize OneTime over custom mode', () => {
      const resolver = createDefaultModeResolver(baseCleanModeConfigs);
      const setting = new CleanModeSetting(VacuumSuctionPower.Custom, MopWaterFlow.Custom, 0, MopRoute.Custom, CleanSequenceType.OneTime);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode);
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
      const setting = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.OneTime);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode);
    });

    it('should resolve custom mode to EnergySaving', () => {
      const resolver = createSmartModeResolver(smartCleanModeConfigs);
      const setting = new CleanModeSetting(VacuumSuctionPower.Custom, MopWaterFlow.Custom, 0, MopRoute.Custom, CleanSequenceType.Persist);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumEnergySaving].mode);
    });

    it('should have smart behavior type', () => {
      const resolver = createSmartModeResolver(smartCleanModeConfigs);
      expect(resolver.behavior).toBe('smart');
    });

    it('should prioritize smart mode over OneTime', () => {
      const resolver = createSmartModeResolver(smartCleanModeConfigs);
      const setting = new CleanModeSetting(VacuumSuctionPower.Smart, MopWaterFlow.Smart, 0, MopRoute.Smart, CleanSequenceType.OneTime);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode);
    });

    it('should prioritize OneTime over custom mode', () => {
      const resolver = createSmartModeResolver(smartCleanModeConfigs);
      const setting = new CleanModeSetting(VacuumSuctionPower.Custom, MopWaterFlow.Custom, 0, MopRoute.Custom, CleanSequenceType.OneTime);
      expect(resolver.resolve(setting)).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode);
    });
  });
});
