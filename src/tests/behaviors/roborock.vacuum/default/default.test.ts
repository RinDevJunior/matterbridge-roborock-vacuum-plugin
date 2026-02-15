import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockService } from '../../../../services/roborockService.js';
import { createMockLogger } from '../../../testUtils.js';

import { CleanSequenceType, MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../../../behaviors/roborock.vacuum/enums/index.js';
import { configureBehavior } from '../../../../share/behaviorFactory.js';
import { DeviceModel } from '../../../../roborockCommunication/models/deviceModel.js';
import { CleanModeSettings } from '../../../../model/RoborockPluginPlatformConfig.js';

describe('setDefaultCommandHandler', () => {
  let logger: AnsiLogger;
  let roborockService: Partial<RoborockService>;
  let cleanModeSettings: CleanModeSettings;
  const duid = 'test-duid';

  beforeEach(() => {
    logger = createMockLogger();

    roborockService = {
      startClean: vi.fn(),
      changeCleanMode: vi.fn(),
      setSelectedAreas: vi.fn(),
      pauseClean: vi.fn(),
      resumeClean: vi.fn(),
      stopAndGoHome: vi.fn(),
      playSoundToLocate: vi.fn(),
    };

    cleanModeSettings = {
      vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
      mopping: { waterFlowMode: 'High', mopRouteMode: 'Fast', distanceOff: 85 },
      vacmop: {
        fanMode: 'Turbo',
        waterFlowMode: 'Low',
        mopRouteMode: 'Deep',
        distanceOff: 85,
      },
    };
  });

  it('should call startClean for Cleaning mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 2); // 2 = Cleaning
    expect(roborockService.startClean).toHaveBeenCalledWith(duid);
  });

  it('should call changeCleanMode for Mop with correct values', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, true, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 31); // 31 = Mop Default
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Off,
      waterFlow: MopWaterFlow.High,
      mopRoute: MopRoute.Fast,
      distance_off: 0,
      sequenceType: CleanSequenceType.Persist,
    });
  });

  it('should call changeCleanMode for Vacuum with correct values', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, true, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 66); // 66 = Vacuum Default
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Max,
      waterFlow: MopWaterFlow.Off,
      mopRoute: MopRoute.DeepPlus,
      distance_off: 0,
      sequenceType: CleanSequenceType.Persist,
    });
  });

  it('should call changeCleanMode for Vac & Mop with correct values', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, true, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 5); // 5 = Vac & Mop Default
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Turbo,
      waterFlow: MopWaterFlow.Low,
      mopRoute: MopRoute.Deep,
      distance_off: 0,
      sequenceType: CleanSequenceType.Persist,
    });
  });

  it('should call setSelectedAreas', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('selectAreas', [1, 2, 3]);
    expect(roborockService.setSelectedAreas).toHaveBeenCalledWith(duid, [1, 2, 3]);
  });

  it('should call pauseClean', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('pause');
    expect(roborockService.pauseClean).toHaveBeenCalledWith(duid);
  });

  it('should call resumeClean', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('resume');
    expect(roborockService.resumeClean).toHaveBeenCalledWith(duid);
  });

  it('should call stopAndGoHome', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('goHome');
    expect(roborockService.stopAndGoHome).toHaveBeenCalledWith(duid);
  });

  it('should call playSoundToLocate', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('identify', 1);
    expect(roborockService.playSoundToLocate).toHaveBeenCalledWith(duid);
  });

  it('should handle Go Vacation mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 99); // 99 = Go Vacation
    expect(roborockService.stopAndGoHome).toHaveBeenCalledWith(duid);
  });

  it('should handle Mop & Vacuum: Quick mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 6); // 6 = Mop & Vacuum: Quick
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Vacuum: Max mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 67); // 67 = Vacuum: Max
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop: Min mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 33); // 33 = Mop: Min
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle unknown mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 9999); // Unknown mode
    expect(logger.notice).toHaveBeenCalledWith('DefaultBehavior-changeToMode-Unknown: ', 9999);
  });

  it('should handle cleanModeSettings being undefined for Default modes', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, undefined, false, logger);
    await handler.executeCommand('changeToMode', 31); // 31 = Mop Default
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Vacuum: Min mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 68); // 68 = Vacuum: Quiet (Min in list)
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop: DeepClean mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 35); // 35 = Mop: DeepClean
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop & Vacuum: Max mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 7); // 7 = Mop & Vacuum: Max
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop & Vacuum: Min mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 8); // 8 = Mop & Vacuum: Min
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop & Vacuum: Quiet mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 9); // 9 = Mop & Vacuum: Quiet
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Vacuum: Quick mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 69); // 69 = Vacuum: Quick
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop: Quick mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 34); // 34 = Mop: Quick
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop & Vacuum: Energy Saving mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 10); // 10 = Mop & Vacuum: Energy Saving
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop & Vacuum: Vac Follow by Mop mode as unknown since no handler matches', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 11); // 11 = Mop & Vacuum: Vac Follow by Mop
    expect(logger.notice).toHaveBeenCalledWith('DefaultBehavior-changeToMode-Unknown: ', 11);
  });

  it('should handle Mop: Max mode', async () => {
    const handler = configureBehavior(DeviceModel.Q5, duid, roborockService as RoborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 32); // 32 = Mop: Max
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });
});
