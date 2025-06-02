import { setCommandHandlerA27, VacuumSuctionPowerA27, MopWaterFlowA27, MopRouteA27 } from './a27';
import { BehaviorDeviceGeneric } from '../../BehaviorDeviceGeneric';
import { AnsiLogger } from 'matterbridge/logger';
import RoborockService from '../../../roborockService';
import { CleanModeSettings } from '../../../model/CleanModeSettings';
import { jest } from '@jest/globals';

describe('setCommandHandlerA27', () => {
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
    };
  });

  it('should set all command handlers', () => {
    setCommandHandlerA27(duid, handler, logger, roborockService, cleanModeSettings);
    expect(handler.setCommandHandler).toHaveBeenCalledWith('changeToMode', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('selectAreas', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('resume', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('goHome', expect.any(Function));
    expect(handler.setCommandHandler).toHaveBeenCalledWith('PlaySoundToLocate', expect.any(Function));
  });

  it('should call startClean for Cleaning mode', async () => {
    setCommandHandlerA27(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(2); // 2 = Cleaning
    expect(roborockService.startClean).toHaveBeenCalledWith(duid);
  });

  it('should call changeCleanMode for Mop with correct values', async () => {
    setCommandHandlerA27(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(5); // 5 = Mop
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPowerA27.Off,
      waterFlow: MopWaterFlowA27.High,
      mopRoute: MopRouteA27.Fast,
      distance_off: 0,
    });
  });

  it('should call changeCleanMode for Vacuum with correct values', async () => {
    setCommandHandlerA27(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(6); // 6 = Vacuum
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPowerA27.Max,
      waterFlow: MopWaterFlowA27.Off,
      mopRoute: MopRouteA27.DeepPlus,
      distance_off: 0,
    });
  });

  it('should call changeCleanMode for Vac & Mop with correct values', async () => {
    setCommandHandlerA27(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, changeToModeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'changeToMode');
    await (changeToModeHandler as (mode: number) => Promise<void>)(7); // 7 = Vac & Mop
    expect(roborockService.changeCleanMode).toHaveBeenCalledWith(duid, {
      suctionPower: VacuumSuctionPowerA27.Turbo,
      waterFlow: MopWaterFlowA27.Low,
      mopRoute: MopRouteA27.Deep,
      distance_off: 0,
    });
  });

  it('should call setSelectedAreas', async () => {
    setCommandHandlerA27(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, selectAreasHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'selectAreas');
    await (selectAreasHandler as (areas: number[]) => Promise<void>)([1, 2, 3]);
    expect(roborockService.setSelectedAreas).toHaveBeenCalledWith(duid, [1, 2, 3]);
  });

  it('should call pauseClean', async () => {
    setCommandHandlerA27(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, pauseHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'pause');
    await (pauseHandler as () => Promise<void>)();
    expect(roborockService.pauseClean).toHaveBeenCalledWith(duid);
  });

  it('should call resumeClean', async () => {
    setCommandHandlerA27(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, resumeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'resume');
    await (resumeHandler as () => Promise<void>)();
    expect(roborockService.resumeClean).toHaveBeenCalledWith(duid);
  });

  it('should call stopAndGoHome', async () => {
    setCommandHandlerA27(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, goHomeHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'goHome');
    await (goHomeHandler as () => Promise<void>)();
    expect(roborockService.stopAndGoHome).toHaveBeenCalledWith(duid);
  });

  it('should call playSoundToLocate', async () => {
    setCommandHandlerA27(duid, handler, logger, roborockService, cleanModeSettings);
    const [[, playSoundHandler]] = (handler.setCommandHandler as jest.Mock).mock.calls.filter(([cmd]) => cmd === 'PlaySoundToLocate');
    await (playSoundHandler as (arg: number) => Promise<void>)(1);
    expect(roborockService.playSoundToLocate).toHaveBeenCalledWith(duid);
  });
});
