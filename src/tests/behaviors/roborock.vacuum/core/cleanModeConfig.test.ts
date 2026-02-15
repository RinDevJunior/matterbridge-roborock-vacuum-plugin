import { describe, it, expect } from 'vitest';
import {
  baseCleanModeConfigs,
  smartCleanModeConfigs,
  CleanModeDisplayLabel,
  CleanModeLabelInfo,
  getModeDisplayMap,
  getModeSettingsMap,
  getModeOptions,
} from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig.js';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';

describe('cleanModeConfig', () => {
  describe('getModeDisplayMap', () => {
    it('should return a record mapping mode numbers to labels for base configs', () => {
      const map = getModeDisplayMap(baseCleanModeConfigs);
      expect(map[CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode]).toBe(CleanModeDisplayLabel.MopAndVacuumDefault);
      expect(map[CleanModeLabelInfo[CleanModeDisplayLabel.VacuumDefault].mode]).toBe(CleanModeDisplayLabel.VacuumDefault);
      expect(map[CleanModeLabelInfo[CleanModeDisplayLabel.MopDefault].mode]).toBe(CleanModeDisplayLabel.MopDefault);
    });

    it('should include VacFollowedByMop entry', () => {
      const map = getModeDisplayMap(baseCleanModeConfigs);
      expect(map[CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode]).toBe(CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop);
    });

    it('should include EnergySaving entry', () => {
      const map = getModeDisplayMap(baseCleanModeConfigs);
      expect(map[CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumEnergySaving].mode]).toBe(CleanModeDisplayLabel.MopAndVacuumEnergySaving);
    });

    it('should include SmartPlan in smart configs', () => {
      const map = getModeDisplayMap(smartCleanModeConfigs);
      expect(map[CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode]).toBe(CleanModeDisplayLabel.SmartPlan);
    });
  });

  describe('getModeSettingsMap', () => {
    it('should return a record mapping mode numbers to CleanModeSetting instances', () => {
      const map = getModeSettingsMap(baseCleanModeConfigs);
      const defaultMode = CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode;
      const setting = map[defaultMode];
      expect(setting).toBeInstanceOf(CleanModeSetting);
      expect(setting.hasFullSettings).toBe(true);
    });

    it('should contain all base config entries', () => {
      const map = getModeSettingsMap(baseCleanModeConfigs);
      expect(Object.keys(map).length).toBe(baseCleanModeConfigs.length);
    });

    it('should contain smart config entries including SmartPlan', () => {
      const map = getModeSettingsMap(smartCleanModeConfigs);
      const smartMode = CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode;
      expect(map[smartMode]).toBeDefined();
      expect(Object.keys(map).length).toBe(smartCleanModeConfigs.length);
    });
  });

  describe('getModeOptions', () => {
    it('should return array of ModeOptions with mode, label, and modeTags', () => {
      const options = getModeOptions(baseCleanModeConfigs);
      expect(options.length).toBe(baseCleanModeConfigs.length);
      const first = options[0];
      expect(first).toHaveProperty('mode');
      expect(first).toHaveProperty('label');
      expect(first).toHaveProperty('modeTags');
      expect(Array.isArray(first.modeTags)).toBe(true);
    });

    it('should not include setting property in options', () => {
      const options = getModeOptions(baseCleanModeConfigs);
      const first = options[0] as Record<string, unknown>;
      expect(first['setting']).toBeUndefined();
    });
  });

  describe('CleanModeLabelInfo', () => {
    it('should have correct mode number for VacFollowedByMop', () => {
      expect(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode).toBe(11);
    });

    it('should have correct mode number for EnergySaving', () => {
      expect(CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumEnergySaving].mode).toBe(10);
    });

    it('should have correct label for GoVacation', () => {
      expect(CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].label).toBe('Go Vacation');
      expect(CleanModeLabelInfo[CleanModeDisplayLabel.GoVacation].mode).toBe(99);
    });
  });

  describe('baseCleanModeConfigs', () => {
    it('should contain VacFollowedByMop config with OneTime sequenceType', () => {
      const vacFollowedByMop = baseCleanModeConfigs.find(
        (c) => c.mode === CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode,
      );
      expect(vacFollowedByMop).toBeDefined();
      expect(vacFollowedByMop!.setting.sequenceType).toBe(1); // CleanSequenceType.OneTime
    });

    it('should have Persist sequenceType for standard modes', () => {
      const defaultMode = baseCleanModeConfigs.find(
        (c) => c.mode === CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode,
      );
      expect(defaultMode).toBeDefined();
      expect(defaultMode!.setting.sequenceType).toBe(0); // CleanSequenceType.Persist
    });
  });

  describe('smartCleanModeConfigs', () => {
    it('should include SmartPlan as first entry', () => {
      expect(smartCleanModeConfigs[0].mode).toBe(CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode);
    });

    it('should include all base configs plus SmartPlan', () => {
      expect(smartCleanModeConfigs.length).toBe(baseCleanModeConfigs.length + 1);
    });
  });
});
