import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import { ModeBase, ServiceArea } from 'matterbridge/matter/clusters';
import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorFactoryResult } from '../share/behaviorFactory.js';
import { asPartial, asType } from './testUtils.js';
import { PlatformConfigManager } from '../platform/platformConfig.js';
import { PluginConfiguration, RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';

function createMockLogger(): AnsiLogger {
  return asType<AnsiLogger>({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    logLevel: 'info',
  });
}

describe('RoborockVacuumCleaner', () => {
  let device: any;
  let roomMap: any;
  let routineAsRoom: any[];
  let logger: AnsiLogger;
  let vacuum: RoborockVacuumCleaner;
  let configManager: PlatformConfigManager;

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
    configManager = PlatformConfigManager.create(
      asPartial<RoborockPluginPlatformConfig>({
        pluginConfiguration: asPartial<PluginConfiguration>({
          enableMultipleMap: false,
          enableServerMode: false,
        }),
      }),
      createMockLogger(),
    );
    logger = createMockLogger();
    vacuum = new RoborockVacuumCleaner('user@example.com', device, roomMap, routineAsRoom, configManager, logger, []);
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
    expect(behaviorHandler.executeCommand).toHaveBeenCalledWith('identify', 5);
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
    const expConfig = asPartial<RoborockPluginPlatformConfig>({
      authentication: {
        username: 'user',
        region: 'US',
        forceAuthentication: false,
        authenticationMethod: 'Password',
      },
      pluginConfiguration: {
        whiteList: [],
        enableServerMode: true,
        enableMultipleMap: true,
        sanitizeSensitiveLogs: false,
        refreshInterval: 60,
        debug: false,
        unregisterOnShutdown: false,
      },
      advancedFeature: {
        enableAdvancedFeature: true,
        settings: {
          showRoutinesAsRoom: false,
          includeDockStationStatus: false,
          forceRunAtDefault: true,
          useVacationModeToSendVacuumToDock: false,
          enableCleanModeMapping: false,
          cleanModeSettings: {} as any,
        },
      },
    });
    const configManager = PlatformConfigManager.create(expConfig, expLogger);
    const dev = { ...device, data: { model: 'roborock.s7', firmwareVersion: '2.0.0' } };
    const result = RoborockVacuumCleaner['initializeDeviceConfiguration'](dev, roomMap, [asPartial<ServiceArea.Area>({ areaId: 1 })], configManager, expLogger, []);
    expect(result.cleanModes).toBeDefined();
    expect(result.supportedAreas).toBeDefined();
    expect(result.supportedMaps).toBeDefined();
    expect(result.supportedAreaAndRoutines).toBeDefined();
    expect(result.deviceName).toContain(dev.name);
    expect(result.bridgeMode).toBe('server');
  });

  it('should cover initializeDeviceConfiguration with minimal config', () => {
    const minLogger = createMockLogger();
    const minConfig = asPartial<RoborockPluginPlatformConfig>({
      authentication: {
        username: 'user',
        region: 'US',
        forceAuthentication: false,
        authenticationMethod: 'Password',
      },
      pluginConfiguration: {
        whiteList: [],
        enableServerMode: false,
        enableMultipleMap: false,
        sanitizeSensitiveLogs: false,
        refreshInterval: 60,
        debug: false,
        unregisterOnShutdown: false,
      },
      advancedFeature: {
        enableAdvancedFeature: false,
        settings: {
          showRoutinesAsRoom: false,
          includeDockStationStatus: false,
          forceRunAtDefault: false,
          useVacationModeToSendVacuumToDock: false,
          enableCleanModeMapping: false,
          cleanModeSettings: {} as any,
        },
      },
    });
    const configManager = PlatformConfigManager.create(minConfig, minLogger);
    const result = RoborockVacuumCleaner['initializeDeviceConfiguration'](device, roomMap, [], configManager, minLogger, []);
    expect(result.cleanModes).toBeDefined();
    expect(result.supportedAreas).toBeDefined();
    expect(result.supportedMaps).toBeDefined();
    expect(result.supportedAreaAndRoutines).toBeDefined();
    expect(result.deviceName).toContain(device.name);
    expect(result.bridgeMode).toBe('matter');
  });
});
