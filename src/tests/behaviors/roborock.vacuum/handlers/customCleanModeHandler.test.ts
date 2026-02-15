import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CustomCleanModeHandler } from '../../../../behaviors/roborock.vacuum/handlers/customCleanModeHandler.js';
import { CleanModeDisplayLabel } from '../../../../behaviors/roborock.vacuum/core/cleanModeConfig.js';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType, MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../../../behaviors/roborock.vacuum/enums/index.js';
import { HandlerContext } from '../../../../behaviors/roborock.vacuum/core/modeHandler.js';
import { asPartial } from '../../../testUtils.js';
import { RoborockService } from '../../../../services/roborockService.js';
import { AnsiLogger } from 'matterbridge/logger';

describe('CustomCleanModeHandler', () => {
  let handler: CustomCleanModeHandler;

  beforeEach(() => {
    handler = new CustomCleanModeHandler();
  });

  describe('canHandle', () => {
    it('should return true for MopAndVacuumEnergySaving', () => {
      expect(handler.canHandle(10, CleanModeDisplayLabel.MopAndVacuumEnergySaving)).toBe(true);
    });

    it('should return false for other modes', () => {
      expect(handler.canHandle(5, CleanModeDisplayLabel.MopAndVacuumDefault)).toBe(false);
    });
  });

  describe('handle', () => {
    it('should call changeCleanMode with the provided setting', async () => {
      const mockRoborockService: Partial<RoborockService> = { changeCleanMode: vi.fn() };
      const mockLogger: Partial<AnsiLogger> = { notice: vi.fn(), debug: vi.fn() };
      const setting = new CleanModeSetting(VacuumSuctionPower.Custom, MopWaterFlow.Custom, 0, MopRoute.Custom, CleanSequenceType.Persist);

      const context: HandlerContext = {
        roborockService: asPartial<RoborockService>(mockRoborockService),
        logger: asPartial<AnsiLogger>(mockLogger),
        enableCleanModeMapping: false,
        cleanModeSettings: undefined,
        cleanSettings: { 10: setting },
        behaviorName: 'TestBehavior',
      };

      await handler.handle('duid', 10, CleanModeDisplayLabel.MopAndVacuumEnergySaving, context);
      expect(mockRoborockService.changeCleanMode).toHaveBeenCalledWith('duid', setting);
    });
  });
});
