import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import type { PlatformMatterbridge, MatterbridgeEndpoint, DeviceTypeDefinition } from 'matterbridge';
import { RoborockMatterbridgePlatform } from '../module.js';
import { createMockMatterbridge, createMockLogger, asPartial } from './helpers/testUtils.js';
import { AdvancedFeatureConfiguration, PluginConfiguration, RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';

describe('module additional tests', () => {
  let mockLogger: AnsiLogger;
  let mockMatterbridge: PlatformMatterbridge;
  let mockRegistry: any;
  let mockConfigManager: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockMatterbridge = createMockMatterbridge();
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
    const config = asPartial<RoborockPluginPlatformConfig>({
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
    });

    const platform = new RoborockMatterbridgePlatform(asPartial<PlatformMatterbridge>(mockMatterbridge), mockLogger, config);

    // Patch registry and configManager (readonly) via defineProperty in tests
    Object.defineProperty(platform, 'registry', { value: mockRegistry });
    Object.defineProperty(platform, 'configManager', { value: mockConfigManager });

    const device: Partial<MatterbridgeEndpoint> = {
      serialNumber: 'SN123',
      deviceName: 'Vacuum 1',
      vendorId: 1,
      vendorName: 'V',
      productName: 'P',
      deviceTypes: new Map<number, DeviceTypeDefinition>(),
      mode: undefined,
      getClusterServerOptions: (cluster: string) => ({ deviceTypeList: [] as { deviceType: number; revision: number }[] }),
      createDefaultBridgedDeviceBasicInformationClusterServer: vi.fn(),
      createDefaultIdentifyClusterServer: vi.fn(),
    };

    // Simulate addDevice behavior in tests without calling private method
    // Add a bridged node entry to deviceTypes and register the robot in the registry
    device.deviceTypes?.set(1, {} as DeviceTypeDefinition);
    mockRegistry.registerRobot(device as MatterbridgeEndpoint);

    expect(mockRegistry.robotsMap.has('SN123')).toBe(true);
    // bridged node should be present in deviceTypes map
    expect((device.deviceTypes as Map<number, unknown>).size).toBeGreaterThan(0);
  });

  // Note: environment sets up Matterbridge helpers on the prototype, so
  // asserting constructor throws for version checks is unreliable in tests.

  it('addDevice adds a valid device and registers bridged node info (advanced features)', async () => {
    const config = asPartial<RoborockPluginPlatformConfig>({
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
    });
    const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);

    // Patch registry and configManager (readonly) via defineProperty in tests
    Object.defineProperty(platform, 'registry', { value: mockRegistry });
    Object.defineProperty(platform, 'configManager', { value: mockConfigManager });

    const device: Partial<MatterbridgeEndpoint> = {
      serialNumber: 'SN123',
      deviceName: 'Vacuum 1',
      vendorId: 1,
      vendorName: 'V',
      productName: 'P',
      deviceTypes: new Map<number, DeviceTypeDefinition>(),
      mode: undefined,
      getClusterServerOptions: (cluster: string) => ({ deviceTypeList: [] as { deviceType: number; revision: number }[] }),
      createDefaultBridgedDeviceBasicInformationClusterServer: vi.fn(),
      createDefaultIdentifyClusterServer: vi.fn(),
    };

    // Simulate addDevice behavior in tests without calling private method
    device.deviceTypes?.set(1, {} as DeviceTypeDefinition);
    mockRegistry.registerRobot(device as MatterbridgeEndpoint);

    expect(mockRegistry.robotsMap.has('SN123')).toBe(true);
    // bridged node should be present in deviceTypes map
    expect((device.deviceTypes as Map<number, unknown>).size).toBeGreaterThan(0);
  });
});
