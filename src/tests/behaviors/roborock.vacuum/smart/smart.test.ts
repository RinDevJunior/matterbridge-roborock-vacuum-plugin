import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric } from '../../../../behaviors/BehaviorDeviceGeneric.js';
import { setCommandHandlerSmart, MopRouteSmart, VacuumSuctionPowerSmart, MopWaterFlowSmart } from '../../../../behaviors/roborock.vacuum/smart/smart.js';
import { CleanModeSettings } from '../../../../model/ExperimentalFeatureSetting.js';
import { RoborockService } from '../../../../roborockService.js';

describe('setCommandHandlerSmart', () => {
  let handler: BehaviorDeviceGeneric<any>;
  let logger: AnsiLogger;
  let roborockService: RoborockService;
  let cleanModeSettings: CleanModeSettings;
  const duid = 'test-duid';

  beforeEach(() => {
    handler = {
      setCommandHandler: vi.fn(),
    } as any;

    logger = {
      notice: vi.fn(),
      warn: vi.fn(),
    } as any;

    roborockService = {
      startClean: vi.fn(),
      changeCleanMode: vi.fn(),
      setSelectedAreas: vi.fn(),
      pauseClean: vi.fn(),
      resumeClean: vi.fn(),
      stopAndGoHome: vi.fn(),
      playSoundToLocate: vi.fn(),
      // Provide stubs for required properties to satisfy type
      container: undefined as any,
      authService: undefined as any,
      deviceService: undefined as any,
      areaService: undefined as any,
      messageRoutingService: undefined as any,
      pollingService: undefined as any,
    } as unknown as RoborockService;

    cleanModeSettings = {
      vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
      mopping: { waterFlowMode: 'High', mopRouteMode: 'Fast', distanceOff: 25 },
      vacmop: {
        fanMode: 'Turbo',
        waterFlowMode: 'Low',
        mopRouteMode: 'Deep',
        distanceOff: 25,
      },
      enableCleanModeMapping: true,
    };
  });

  it('should set all command handlers', () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    expect(handler.setCommandHandler).toHaveBeenCalledWith('changeToMode', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('selectAreas', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('resume', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('goHome', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('playSoundToLocate', expect.any(Function));
  });

  it('should call startClean for Cleaning mode', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter((args) => args[0] === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(2); // 2 = Cleaning
    expect(roborockService.startClean).toHaveBeenCalledWith(duid);
  });

  it('should call changeCleanMode for Smart Plan', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter((args) => args[0] === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(4); // 4 = Smart Plan
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: 0,
      waterFlow: 0,
      distance_off: 0,
      mopRoute: MopRouteSmart.Smart,
    });
  });

  it('should call changeCleanMode for Mop with correct values', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, undefined);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter((args) => args[0] === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(31); // 31 = Mop Default
    // mopping: { waterFlowMode: 'High', mopRouteMode: 'Fast', distanceOff: 85 },
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPowerSmart.Off,
      waterFlow: MopWaterFlowSmart.Medium,
      mopRoute: MopRouteSmart.Standard,
      distance_off: 0,
    });
  });

  it('should call changeCleanMode for Mop with custom values', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, {
      vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
      mopping: { waterFlowMode: 'CustomizeWithDistanceOff', mopRouteMode: 'Fast', distanceOff: 25 },
      vacmop: {
        fanMode: 'Turbo',
        waterFlowMode: 'Low',
        mopRouteMode: 'Deep',
        distanceOff: 25,
      },
      enableCleanModeMapping: true,
    });
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(31); // 31 = Mop Default
    // vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPowerSmart.Off,
      waterFlow: MopWaterFlowSmart.CustomizeWithDistanceOff,
      mopRoute: MopRouteSmart.Fast,
      distance_off: 85,
    });
  });

  it('should call changeCleanMode for Vacuum with correct values', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, undefined);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(66); // 66 = Vacuum Default
    // vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPowerSmart.Balanced,
      waterFlow: MopWaterFlowSmart.Off,
      mopRoute: MopRouteSmart.Standard,
      distance_off: 0,
    });
  });

  it('should call changeCleanMode for Vacuum with custom values', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(66); // 66 = Vacuum Default
    // vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPowerSmart.Max,
      waterFlow: MopWaterFlowSmart.Off,
      mopRoute: MopRouteSmart.DeepPlus,
      distance_off: 0,
    });
  });

  it('should call changeCleanMode for Vac & Mop with correct values', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, undefined);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(5); // 5 = Vac & Mop Default
    /*
    vacmop: {
        fanMode: 'Turbo',
        waterFlowMode: 'Low',
        mopRouteMode: 'Deep',
        distanceOff: 85,
    },
    */

    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPowerSmart.Balanced,
      waterFlow: MopWaterFlowSmart.Medium,
      mopRoute: MopRouteSmart.Standard,
      distance_off: 0,
    });
  });

  it('should call changeCleanMode for Vac & Mop with custom values', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, {
      vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
      mopping: { waterFlowMode: 'CustomizeWithDistanceOff', mopRouteMode: 'Fast', distanceOff: 25 },
      vacmop: {
        fanMode: 'Turbo',
        waterFlowMode: 'CustomizeWithDistanceOff',
        mopRouteMode: 'Deep',
        distanceOff: 25,
      },
      enableCleanModeMapping: true,
    });
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter((args) => args[0] === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(5); // 5 = Vac & Mop Default
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPowerSmart.Turbo,
      waterFlow: MopWaterFlowSmart.CustomizeWithDistanceOff,
      mopRoute: MopRouteSmart.Deep,
      distance_off: 85,
    });
  });

  it('should call setSelectedAreas', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, selectAreasHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter(([cmd]) => cmd === 'selectAreas');
    await (selectAreasHandler as (areas: number[]) => Promise<void>)([1, 2, 3]);
    expect(roborockService.setSelectedAreas).toHaveBeenCalledWith(duid, [1, 2, 3]);
  });

  it('should call pauseClean', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, pauseHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter(([cmd]) => cmd === 'pause');
    await (pauseHandler as () => Promise<void>)();
    expect(roborockService.pauseClean).toHaveBeenCalledWith(duid);
  });

  it('should call resumeClean', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, resumeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter(([cmd]) => cmd === 'resume');
    await (resumeHandler as () => Promise<void>)();
    expect(roborockService.resumeClean).toHaveBeenCalledWith(duid);
  });

  it('should call stopAndGoHome', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, goHomeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter(([cmd]) => cmd === 'goHome');
    await (goHomeHandler as () => Promise<void>)();
    expect(roborockService.stopAndGoHome).toHaveBeenCalledWith(duid);
  });

  it('should call playSoundToLocate', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, playSoundHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter(([cmd]) => cmd === 'playSoundToLocate');
    await (playSoundHandler as (arg: number) => Promise<void>)(1);
    expect(roborockService.playSoundToLocate).toHaveBeenCalledWith(duid);
  });

  it('should handle Go Vacation mode', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter((args) => args[0] === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(99); // 99 = Go Vacation
    expect(roborockService.stopAndGoHome).toHaveBeenCalledWith(duid);
  });

  it('should handle Mop & Vacuum: Quick mode', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter((args) => args[0] === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(6); // 6 = Mop & Vacuum: Quick
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle unknown mode', async () => {
    setCommandHandlerSmart(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as ReturnType<typeof vi.fn>).mock.calls.filter((args) => args[0] === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(9999); // Unknown mode
    expect(logger.notice).toHaveBeenCalledWith('BehaviorSmart-changeToMode-Unknown: ', 9999);
  });
});
