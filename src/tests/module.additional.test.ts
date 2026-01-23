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

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockMatterbridge = {
      matterbridgeVersion: '3.5.0',
      matterbridgePluginDirectory: '/tmp',
      matterbridgeDirectory: '/tmp',
      verifyMatterbridgeVersion: () => true,
    } as any;
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
      device: { data: { firmwareVersion: 'v1.2.3' }, fv: undefined },
    };

    const result = await (platform as any).addDevice(device as any);
    expect(result).toBeDefined();
    expect(platform.robots.has('SN123')).toBe(true);
    // bridged node should be registered in deviceTypes map
    expect((device.deviceTypes as Map<number, any>).size).toBeGreaterThan(0);
  });
});
