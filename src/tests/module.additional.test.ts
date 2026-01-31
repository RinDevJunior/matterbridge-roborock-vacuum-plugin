import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { PlatformMatterbridge } from 'matterbridge';
import { RoborockMatterbridgePlatform } from '../module.js';

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
      name: 'X',
      username: 'a',
      whiteList: [],
      blackList: [],
      useInterval: false,
      refreshInterval: 60,
      debug: false,
      authentication: { password: '', authenticationMethod: 'Password' },
      enableExperimental: { advancedFeature: {}, enableExperimentalFeature: false },
      persistDirectory: '/tmp',
    } as any);

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
