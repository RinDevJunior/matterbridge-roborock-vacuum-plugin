import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultCleanModeHandler } from '../../../../behaviors/roborock.vacuum/handlers/defaultCleanModeHandler.js';
import { CleanModeDisplayLabel, CleanModeLabelInfo } from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig.js';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType, MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../../../behaviors/roborock.vacuum/enums/index.js';
import { HandlerContext } from '../../../../behaviors/roborock.vacuum/core/modeHandler.js';
import { asPartial } from '../../../testUtils.js';
import { RoborockService } from '../../../../services/roborockService.js';
import { AnsiLogger } from 'matterbridge/logger';

describe('DefaultCleanModeHandler', () => {
  let handler: DefaultCleanModeHandler;
  let mockRoborockService: Partial<RoborockService>;
  let mockLogger: Partial<AnsiLogger>;
  let context: HandlerContext;
  const duid = 'test-duid';

  const defaultSetting = new CleanModeSetting(VacuumSuctionPower.Balanced, MopWaterFlow.Medium, 0, MopRoute.Standard, CleanSequenceType.Persist);

  beforeEach(() => {
    handler = new DefaultCleanModeHandler();
    mockRoborockService = { changeCleanMode: vi.fn() };
    mockLogger = { notice: vi.fn(), debug: vi.fn(), error: vi.fn() };

    const defaultMode = CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode;
    context = {
      roborockService: asPartial<RoborockService>(mockRoborockService),
      logger: asPartial<AnsiLogger>(mockLogger),
      enableCleanModeMapping: false,
      cleanModeSettings: undefined,
      cleanSettings: { [defaultMode]: defaultSetting },
      behaviorName: 'TestBehavior',
    };
  });

  describe('canHandle', () => {
    it('should return true for MopAndVacuumDefault', () => {
      expect(handler.canHandle(5, CleanModeDisplayLabel.MopAndVacuumDefault)).toBe(true);
    });

    it('should return true for MopDefault', () => {
      expect(handler.canHandle(31, CleanModeDisplayLabel.MopDefault)).toBe(true);
    });

    it('should return true for VacuumDefault', () => {
      expect(handler.canHandle(66, CleanModeDisplayLabel.VacuumDefault)).toBe(true);
    });

    it('should return false for non-default modes', () => {
      expect(handler.canHandle(6, CleanModeDisplayLabel.MopAndVacuumQuick)).toBe(false);
    });
  });

  describe('handle', () => {
    it('should remap VacFollowedByMop mode to MopAndVacuumDefault mode', async () => {
      const vacFollowedByMopMode = CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVaccum_VacFollowedByMop].mode;
      await handler.handle(duid, vacFollowedByMopMode, CleanModeDisplayLabel.MopAndVacuumDefault, context);
      expect(mockRoborockService.changeCleanMode).toHaveBeenCalledWith(duid, defaultSetting);
    });

    it('should use clean settings for default mode', async () => {
      const defaultMode = CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode;
      await handler.handle(duid, defaultMode, CleanModeDisplayLabel.MopAndVacuumDefault, context);
      expect(mockRoborockService.changeCleanMode).toHaveBeenCalledWith(duid, defaultSetting);
    });

    it('should not call changeCleanMode when setting is undefined', async () => {
      context.cleanSettings = {};
      const defaultMode = CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode;
      await handler.handle(duid, defaultMode, CleanModeDisplayLabel.MopAndVacuumDefault, context);
      expect(mockRoborockService.changeCleanMode).not.toHaveBeenCalled();
    });

    it('should use cleanModeSettings when enableCleanModeMapping is true', async () => {
      context.enableCleanModeMapping = true;
      context.cleanModeSettings = {
        vacmop: { fanMode: 'Max', waterFlowMode: 'High', mopRouteMode: 'Fast' },
      };
      const defaultMode = CleanModeLabelInfo[CleanModeDisplayLabel.MopAndVacuumDefault].mode;
      await handler.handle(duid, defaultMode, CleanModeDisplayLabel.MopAndVacuumDefault, context);
      expect(mockRoborockService.changeCleanMode).toHaveBeenCalled();
    });
  });
});
