import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import { ModeBase } from 'matterbridge/matter/clusters';
import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorFactoryResult } from '../share/behaviorFactory.js';

function createMockLogger(): AnsiLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    logLevel: 'info',
  } as unknown as AnsiLogger;
}

describe('RoborockVacuumCleaner', () => {
  let device: any;
  let roomMap: any;
  let routineAsRoom: any[];
  let enableExperimentalFeature: any;
  let logger: AnsiLogger;
  let vacuum: RoborockVacuumCleaner;

  beforeEach(() => {
    device = {
      duid: 'duid-123',
      data: { model: 'roborock.s5', firmwareVersion: '1.0.0' },
      serialNumber: 'serial-123',
      deviceName: 'TestVac',
      name: 'TestVac',
      rooms: [],
      scenes: [],
    };
    roomMap = { rooms: [] };
    routineAsRoom = [];
    enableExperimentalFeature = undefined;
    logger = createMockLogger();
    vacuum = new RoborockVacuumCleaner('user@example.com', device, roomMap, routineAsRoom, enableExperimentalFeature, logger);
  });

  it('should construct with correct properties', () => {
    expect(vacuum).toBeInstanceOf(RoborockVacuumCleaner);
    expect(vacuum.device).toBe(device);
    expect(vacuum.username).toBe('user@example.com');
  });

  it('should call behaviorHandler for identify command', async () => {
    const behaviorHandler = {
      executeCommand: vi.fn(),
      setCommandHandler: vi.fn(),
      log: logger,
      commands: {},
    } satisfies BehaviorFactoryResult;
    vacuum.configureHandler(behaviorHandler);
    await vacuum.executeCommandHandler('identify', { request: { identifyTime: 5 }, cluster: 1, attributes: {}, endpoint: 1 });
    expect(behaviorHandler.executeCommand).toHaveBeenCalledWith('playSoundToLocate', 5);
  });

  it('should warn if selectAreas called with empty areas', async () => {
    const behaviorHandler = { executeCommand: vi.fn(), setCommandHandler: vi.fn(), log: logger, commands: {} } satisfies BehaviorFactoryResult;
    vacuum.configureHandler(behaviorHandler);
    await vacuum.executeCommandHandler('selectAreas', { request: { newAreas: [] } });
    expect(behaviorHandler.executeCommand).not.toHaveBeenCalled();
  });

  it('should call behaviorHandler for selectAreas command', async () => {
    const behaviorHandler = { executeCommand: vi.fn(), setCommandHandler: vi.fn(), log: logger, commands: {} } satisfies BehaviorFactoryResult;
    vacuum.configureHandler(behaviorHandler);
    await vacuum.executeCommandHandler('selectAreas', { newAreas: [1, 2] });
    expect(behaviorHandler.executeCommand).toHaveBeenCalledWith('selectAreas', [1, 2]);
  });

  it('should call behaviorHandler for changeToMode command', async () => {
    const behaviorHandler = { executeCommand: vi.fn(), setCommandHandler: vi.fn(), log: logger, commands: {} } satisfies BehaviorFactoryResult;
    vacuum.configureHandler(behaviorHandler);
    const request = { newMode: 42 } satisfies ModeBase.ChangeToModeRequest;
    await vacuum.executeCommandHandler('changeToMode', request);
    expect(behaviorHandler.executeCommand).toHaveBeenCalledWith('changeToMode', 42);
  });

  it('should call behaviorHandler for pause command', async () => {
    const behaviorHandler = { executeCommand: vi.fn(), setCommandHandler: vi.fn(), log: logger, commands: {} } satisfies BehaviorFactoryResult;
    vacuum.configureHandler(behaviorHandler);
    await vacuum.executeCommandHandler('pause', { request: {} });
    expect(behaviorHandler.executeCommand).toHaveBeenCalledWith('pause');
  });

  it('should call behaviorHandler for resume command', async () => {
    const behaviorHandler = { executeCommand: vi.fn(), setCommandHandler: vi.fn(), log: logger, commands: {} } satisfies BehaviorFactoryResult;
    vacuum.configureHandler(behaviorHandler);
    await vacuum.executeCommandHandler('resume', { request: {} });
    expect(behaviorHandler.executeCommand).toHaveBeenCalledWith('resume');
  });

  it('should call behaviorHandler for goHome command', async () => {
    const behaviorHandler = { executeCommand: vi.fn(), setCommandHandler: vi.fn(), log: logger, commands: {} } satisfies BehaviorFactoryResult;
    vacuum.configureHandler(behaviorHandler);
    await vacuum.executeCommandHandler('goHome', { request: {} });
    expect(behaviorHandler.executeCommand).toHaveBeenCalledWith('goHome');
  });

  it('should cover initializeDeviceConfiguration with experimental features', () => {
    const expLogger = createMockLogger();
    const expFeature = {
      enableExperimentalFeature: true,
      advancedFeature: {
        enableMultipleMap: true,
        enableServerMode: true,
        forceRunAtDefault: true,
      },
    };
    const dev = { ...device, data: { model: 'roborock.s7', firmwareVersion: '2.0.0' } };
    const result = (RoborockVacuumCleaner as any).initializeDeviceConfiguration(dev, roomMap, [{ areaId: 1 }], expFeature, expLogger);
    expect(result.cleanModes).toBeDefined();
    expect(result.supportedRunModes).toBeDefined();
    expect(result.supportedAreas).toBeDefined();
    expect(result.supportedMaps).toBeDefined();
    expect(result.supportedAreaAndRoutines).toBeDefined();
    expect(result.deviceName).toContain(dev.name);
    expect(result.bridgeMode).toBe('server');
  });

  it('should cover initializeDeviceConfiguration with minimal config', () => {
    const minLogger = createMockLogger();
    const result = (RoborockVacuumCleaner as any).initializeDeviceConfiguration(device, roomMap, [], undefined, minLogger);
    expect(result.cleanModes).toBeDefined();
    expect(result.supportedRunModes).toBeDefined();
    expect(result.supportedAreas).toBeDefined();
    expect(result.supportedMaps).toBeDefined();
    expect(result.supportedAreaAndRoutines).toBeDefined();
    expect(result.deviceName).toContain(device.name);
    expect(result.bridgeMode).toBe('matter');
  });
});
