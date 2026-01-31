import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { PlatformMatterbridge } from 'matterbridge';
import { RoborockMatterbridgePlatform } from '../module.js';
import { AdvancedFeatureConfiguration, PluginConfiguration, RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';

function createMockLogger(): AnsiLogger {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    logLevel: 'info',
    log: vi.fn(),
  } as unknown as AnsiLogger;
  return logger;
}

describe('module additional tests', () => {
  let mockLogger: AnsiLogger;
  let mockMatterbridge: PlatformMatterbridge;
  let mockRegistry: any;
  let mockConfigManager: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockMatterbridge = {
      matterbridgeVersion: '3.5.0',
      matterbridgePluginDirectory: '/tmp',
      matterbridgeDirectory: '/tmp',
      verifyMatterbridgeVersion: () => true,
    } as any;
    mockRegistry = {
      robotsMap: new Map(),
      devicesMap: new Map(),
      getRobot: (duid: string) => mockRegistry.robotsMap.get(duid),
      registerRobot: vi.fn((robot: any) => {
        if (robot && robot.serialNumber) {
          mockRegistry.robotsMap.set(robot.serialNumber, robot);
        }
      }),
      clear: () => {
        mockRegistry.robotsMap.clear();
        mockRegistry.devicesMap.clear();
      },
    };
    mockConfigManager = {
      get isMultipleMapEnabled() {
        return false;
      },
      cleanModeSettings: undefined,
    };
  });

  // Note: environment sets up Matterbridge helpers on the prototype, so
  // asserting constructor throws for version checks is unreliable in tests.

  it('addDevice adds a valid device and registers bridged node info', async () => {
    const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, {
      name: 'TestPlatform',
      type: 'roborock',
      username: 'tesa',
      whiteList: [],
      blackList: [],
      useInterval: false,
      refreshInterval: 60,
      debug: false,
      version: '1.0.0',
      authentication: { username: 'test', region: 'US', forceAuthentication: false, password: 'test', authenticationMethod: 'Password' },
      pluginConfiguration: {
        whiteList: [],
        enableServerMode: false,
        enableMultipleMap: false,
        refreshInterval: 60,
        debug: false,
        unregisterOnShutdown: false,
        sanitizeSensitiveLogs: true,
      } satisfies PluginConfiguration,
      advancedFeature: {
        enableAdvancedFeature: true,
        settings: {
          showRoutinesAsRoom: false,
          includeDockStationStatus: false,
          forceRunAtDefault: false,
          useVacationModeToSendVacuumToDock: false,
          enableCleanModeMapping: false,
          cleanModeSettings: {
            vacuuming: { fanMode: 'Silent', mopRouteMode: 'Standard' },
            mopping: { waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 0 },
            vacmop: { fanMode: 'Silent', waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 0 },
          },
        },
      } as AdvancedFeatureConfiguration,
    } as unknown as RoborockPluginPlatformConfig);

    // Patch registry and configManager
    (platform as any).registry = mockRegistry;
    (platform as any).configManager = mockConfigManager;

    const device: any = {
      serialNumber: 'SN123',
      deviceName: 'Vacuum 1',
      vendorId: 1,
      vendorName: 'V',
      productName: 'P',
      deviceTypes: new Map<number, any>(),
      mode: undefined,
      getClusterServerOptions: (id: number) => ({ deviceTypeList: [] }),
      createDefaultBridgedDeviceBasicInformationClusterServer: vi.fn(),
      createDefaultIdentifyClusterServer: vi.fn(),
      device: { data: { firmwareVersion: 'v1.2.3' }, fv: undefined },
    };

    const result = await (platform as any).addDevice(device as any);
    expect(result).toBeDefined();
    expect(platform.registry.robotsMap.has('SN123')).toBe(true);
    // bridged node should be registered in deviceTypes map
    expect((device.deviceTypes as Map<number, any>).size).toBeGreaterThan(0);
  });
});
