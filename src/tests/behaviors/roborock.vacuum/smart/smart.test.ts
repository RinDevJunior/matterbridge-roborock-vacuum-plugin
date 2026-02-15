import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, DeviceCommands } from '../../../../behaviors/BehaviorDeviceGeneric.js';
import { RoborockService } from '../../../../services/roborockService.js';
import { configureBehavior } from '../../../../share/behaviorFactory.js';
import { DeviceModel } from '../../../../roborockCommunication/models/deviceModel.js';
import { CleanSequenceType, MopRoute, MopWaterFlow, VacuumSuctionPower } from '../../../../behaviors/roborock.vacuum/enums/index.js';
import { CleanModeSettings } from '../../../../model/RoborockPluginPlatformConfig.js';
import { asPartial, asType, createMockLogger } from '../../../testUtils.js';

describe('setCommandHandlerSmart', () => {
  let handler: BehaviorDeviceGeneric<DeviceCommands>;
  let logger: AnsiLogger;
  let roborockService: RoborockService;
  let cleanModeSettings: CleanModeSettings;
  const duid = 'test-duid';

  beforeEach(() => {
    handler = asPartial<BehaviorDeviceGeneric<DeviceCommands>>({
      setCommandHandler: vi.fn(),
    });

    logger = createMockLogger();

    roborockService = asPartial<RoborockService>({
      startClean: vi.fn(),
      changeCleanMode: vi.fn(),
      setSelectedAreas: vi.fn(),
      pauseClean: vi.fn(),
      resumeClean: vi.fn(),
      stopAndGoHome: vi.fn(),
      playSoundToLocate: vi.fn(),
    });

    cleanModeSettings = {
      vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
      mopping: { waterFlowMode: 'High', mopRouteMode: 'Fast', distanceOff: 25 },
      vacmop: {
        fanMode: 'Turbo',
        waterFlowMode: 'Low',
        mopRouteMode: 'Deep',
        distanceOff: 25,
      },
    };
  });

  it('should call startClean for Cleaning mode', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 2); // 2 = Cleaning
    expect(roborockService.startClean).toHaveBeenCalledWith(duid);
  });

  it('should call changeCleanMode for Smart Plan', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 4); // 4 = Smart Plan
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: 0,
      waterFlow: 0,
      distance_off: 0,
      mopRoute: MopRoute.Smart,
      sequenceType: CleanSequenceType.Persist,
    });
  });

  it('should call changeCleanMode for Mop with correct values', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 31); // 31 = Mop Default
    // mopping: { waterFlowMode: 'High', mopRouteMode: 'Fast', distanceOff: 85 },
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Off,
      waterFlow: MopWaterFlow.Medium,
      mopRoute: MopRoute.Standard,
      distance_off: 0,
      sequenceType: CleanSequenceType.Persist,
    });
  });

  it('should call changeCleanMode for Mop with custom values', async () => {
    const handler = configureBehavior(
      DeviceModel.QREVO_EDGE_5V1,
      duid,
      roborockService,
      true,
      {
        vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
        mopping: { waterFlowMode: 'CustomizeWithDistanceOff', mopRouteMode: 'Fast', distanceOff: 25 },
        vacmop: {
          fanMode: 'Turbo',
          waterFlowMode: 'Low',
          mopRouteMode: 'Deep',
          distanceOff: 25,
        },
      },
      false,
      logger,
    );
    await handler.executeCommand('changeToMode', 31); // 31 = Mop Default
    // vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Off,
      waterFlow: MopWaterFlow.CustomizeWithDistanceOff,
      mopRoute: MopRoute.Fast,
      distance_off: 85,
      sequenceType: CleanSequenceType.Persist,
    });
  });

  it('should call changeCleanMode for Vacuum with correct values', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 66); // 66 = Vacuum Default
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Balanced,
      waterFlow: MopWaterFlow.Off,
      mopRoute: MopRoute.Standard,
      distance_off: 0,
      sequenceType: CleanSequenceType.Persist,
    });
  });

  it('should call changeCleanMode for Vacuum with custom values', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, true, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 66); // 66 = Vacuum Default
    // vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Max,
      waterFlow: MopWaterFlow.Off,
      mopRoute: MopRoute.DeepPlus,
      distance_off: 0,
      sequenceType: CleanSequenceType.Persist,
    });
  });

  it('should call changeCleanMode for Vac & Mop with correct values', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, undefined, false, logger);
    await handler.executeCommand('changeToMode', 5); // 5 = Vac & Mop Default
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Balanced,
      waterFlow: MopWaterFlow.Medium,
      mopRoute: MopRoute.Standard,
      distance_off: 0,
      sequenceType: CleanSequenceType.Persist,
    });
  });

  it('should call changeCleanMode for Vac & Mop with custom values', async () => {
    const handler = configureBehavior(
      DeviceModel.QREVO_EDGE_5V1,
      duid,
      roborockService,
      true,
      {
        vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
        mopping: { waterFlowMode: 'CustomizeWithDistanceOff', mopRouteMode: 'Fast', distanceOff: 25 },
        vacmop: {
          fanMode: 'Turbo',
          waterFlowMode: 'CustomizeWithDistanceOff',
          mopRouteMode: 'Deep',
          distanceOff: 25,
        },
      },
      false,
      logger,
    );
    await handler.executeCommand('changeToMode', 5); // 5 = Vac & Mop Default
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Turbo,
      waterFlow: MopWaterFlow.CustomizeWithDistanceOff,
      mopRoute: MopRoute.Deep,
      distance_off: 85,
      sequenceType: CleanSequenceType.Persist,
    });
  });

  it('should call setSelectedAreas', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('selectAreas', [1, 2, 3]);
    expect(roborockService.setSelectedAreas).toHaveBeenCalledWith(duid, [1, 2, 3]);
  });

  it('should call pauseClean', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('pause');
    expect(roborockService.pauseClean).toHaveBeenCalledWith(duid);
  });

  it('should call resumeClean', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('resume');
    expect(roborockService.resumeClean).toHaveBeenCalledWith(duid);
  });

  it('should call stopAndGoHome', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('goHome');
    expect(roborockService.stopAndGoHome).toHaveBeenCalledWith(duid);
  });

  it('should call playSoundToLocate', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('identify', 5);
    expect(roborockService.playSoundToLocate).toHaveBeenCalledWith(duid);
  });

  it('should handle Go Vacation mode', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 99); // 99 = Go Vacation
    expect(roborockService.stopAndGoHome).toHaveBeenCalledWith(duid);
  });

  it('should handle Mop & Vacuum: Quick mode', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 6); // 6 = Mop & Vacuum: Quick
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle unknown mode', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 9999);
    expect(logger.notice).toHaveBeenCalledWith('BehaviorSmart-changeToMode-Unknown: ', 9999);
  });

  it('should handle Mop & Vacuum: Energy Saving mode', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 10); // 10 = Energy Saving
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop & Vacuum: Vac Follow by Mop mode as unknown since no handler matches', async () => {
    const handler = configureBehavior(DeviceModel.QREVO_EDGE_5V1, duid, roborockService, false, cleanModeSettings, false, logger);
    await handler.executeCommand('changeToMode', 11); // 11 = Mop & Vacuum: Vac Follow by Mop
    expect(logger.notice).toHaveBeenCalledWith('BehaviorSmart-changeToMode-Unknown: ', 11);
  });
});
