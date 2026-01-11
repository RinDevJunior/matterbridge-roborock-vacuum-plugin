import { BehaviorDeviceGeneric } from '../../../../behaviors/BehaviorDeviceGeneric.js';
import { AnsiLogger } from 'matterbridge/logger';
import RoborockService from '../../../../roborockService.js';
import { CleanModeSettings } from '../../../../model/ExperimentalFeatureSetting.js';
import { MopRoute, MopWaterFlow, setDefaultCommandHandler, VacuumSuctionPower } from '../../../../behaviors/roborock.vacuum/default/default.js';

describe('setDefaultCommandHandler', () => {
  let handler: BehaviorDeviceGeneric<any>;
  let logger: AnsiLogger;
  let roborockService: jest.Mocked<RoborockService>;
  let cleanModeSettings: CleanModeSettings;
  const duid = 'test-duid';

  beforeEach(() => {
    handler = {
      setCommandHandler: jest.fn(),
    } as any;

    logger = {
      notice: jest.fn(),
      warn: jest.fn(),
    } as any;

    roborockService = {
      startClean: jest.fn(),
      changeCleanMode: jest.fn(),
      setSelectedAreas: jest.fn(),
      pauseClean: jest.fn(),
      resumeClean: jest.fn(),
      stopAndGoHome: jest.fn(),
      playSoundToLocate: jest.fn(),
    } as any;

    cleanModeSettings = {
      vacuuming: { fanMode: 'Max', mopRouteMode: 'DeepPlus' },
      mopping: { waterFlowMode: 'High', mopRouteMode: 'Fast', distanceOff: 85 },
      vacmop: {
        fanMode: 'Turbo',
        waterFlowMode: 'Low',
        mopRouteMode: 'Deep',
        distanceOff: 85,
      },
      enableCleanModeMapping: true,
    };
  });

  it('should set all command handlers', () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    expect(handler.setCommandHandler).toHaveBeenCalledWith('changeToMode', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('selectAreas', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('resume', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('goHome', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('playSoundToLocate', expect.any(Function));
  });

  it('should call startClean for Cleaning mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(2); // 2 = Cleaning
    expect(roborockService.startClean).toHaveBeenCalledWith(duid);
  });

  it('should call changeCleanMode for Mop with correct values', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(31); // 31 = Mop Default
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Off,
      waterFlow: MopWaterFlow.High,
      mopRoute: MopRoute.Fast,
      distance_off: 0,
    });
  });

  it('should call changeCleanMode for Vacuum with correct values', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(66); // 66 = Vacuum Default
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Max,
      waterFlow: MopWaterFlow.Off,
      mopRoute: MopRoute.DeepPlus,
      distance_off: 0,
    });
  });

  it('should call changeCleanMode for Vac & Mop with correct values', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(5); // 5 = Vac & Mop Default
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPower.Turbo,
      waterFlow: MopWaterFlow.Low,
      mopRoute: MopRoute.Deep,
      distance_off: 0,
    });
  });

  it('should call setSelectedAreas', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, selectAreasHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'selectAreas');
    await (selectAreasHandler as (areas: number[]) => Promise<void>)([1, 2, 3]);
    expect(roborockService.setSelectedAreas).toHaveBeenCalledWith(duid, [1, 2, 3]);
  });

  it('should call pauseClean', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, pauseHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'pause');
    await (pauseHandler as () => Promise<void>)();
    expect(roborockService.pauseClean).toHaveBeenCalledWith(duid);
  });

  it('should call resumeClean', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, resumeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'resume');
    await (resumeHandler as () => Promise<void>)();
    expect(roborockService.resumeClean).toHaveBeenCalledWith(duid);
  });

  it('should call stopAndGoHome', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, goHomeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'goHome');
    await (goHomeHandler as () => Promise<void>)();
    expect(roborockService.stopAndGoHome).toHaveBeenCalledWith(duid);
  });

  it('should call playSoundToLocate', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, playSoundHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'playSoundToLocate');
    await (playSoundHandler as (arg: number) => Promise<void>)(1);
    expect(roborockService.playSoundToLocate).toHaveBeenCalledWith(duid);
  });

  it('should handle Go Vacation mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(99); // 99 = Go Vacation
    expect(roborockService.stopAndGoHome).toHaveBeenCalledWith(duid);
  });

  it('should handle Mop & Vacuum: Quick mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(6); // 6 = Mop & Vacuum: Quick
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Vacuum: Max mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(67); // 67 = Vacuum: Max
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop: Min mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(33); // 33 = Mop: Min
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle unknown mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(9999); // Unknown mode
    expect(logger.notice).toHaveBeenCalledWith('DefaultBehavior-changeToMode-Unknown: ', 9999);
  });

  it('should handle cleanModeSettings being undefined for Default modes', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, undefined);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(31); // 31 = Mop Default
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Vacuum: Min mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(68); // 68 = Vacuum: Quiet (Min in list)
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop: DeepClean mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(35); // 35 = Mop: DeepClean
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop & Vacuum: Max mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(7); // 7 = Mop & Vacuum: Max
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop & Vacuum: Min mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(8); // 8 = Mop & Vacuum: Min
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop & Vacuum: Quiet mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(9); // 9 = Mop & Vacuum: Quiet
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Vacuum: Quick mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(69); // 69 = Vacuum: Quick
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop: Quick mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(34); // 34 = Mop: Quick
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop & Vacuum: Custom mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(10); // 10 = Mop & Vacuum: Custom
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });

  it('should handle Mop: Max mode', async () => {
    setDefaultCommandHandler(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(32); // 32 = Mop: Max
    expect(roborockService.changeCleanMode).toHaveBeenCalled();
  });
});
