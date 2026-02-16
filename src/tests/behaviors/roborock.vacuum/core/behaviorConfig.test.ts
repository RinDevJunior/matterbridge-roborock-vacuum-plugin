import { describe, it, expect } from 'vitest';
import { createDefaultBehaviorConfig, createSmartBehaviorConfig } from '../../../../behaviors/roborock.vacuum/core/behaviorConfig.js';
import { CleanModeDisplayLabel, CleanModeLabelInfo } from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig.js';

describe('behaviorConfig', () => {
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
      const mode = CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumEnergySaving].mode;
      expect(config.cleanModes[mode]).toBe(CleanModeDisplayLabel.MopAndVacuumEnergySaving);
    });

    it('should have cleanSettings for all base modes', () => {
      const config = createDefaultBehaviorConfig();
      const defaultMode = CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode;
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
      const mode = CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode;
      expect(config.cleanModes[mode]).toBe(CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop);
    });

    it('should have cleanSettings including SmartPlan', () => {
      const config = createSmartBehaviorConfig();
      const smartPlanMode = CleanModeLabelInfo[CleanModeDisplayLabel.SmartPlan].mode;
      expect(config.cleanSettings[smartPlanMode]).toBeDefined();
    });

    it('should include VacFollowedByMop in cleanModes', () => {
      const config = createSmartBehaviorConfig();
      const mode = CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode;
      expect(config.cleanModes[mode]).toBe(CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop);
    });
  });
});
