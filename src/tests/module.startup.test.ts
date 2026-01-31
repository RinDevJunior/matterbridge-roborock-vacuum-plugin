import { describe, it, expect, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockMatterbridgePlatform } from '../module.js';
import { AuthenticationConfiguration, RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    log: vi.fn(),
    logLevel: 'info',
  } as unknown as AnsiLogger;
}

function makeMatterbridge(overrides: Record<string, unknown> = {}) {
  return {
    matterbridgeVersion: '3.5.1',
    matterbridgePluginDirectory: '/tmp',
    matterbridgeDirectory: '/tmp',
    verifyMatterbridgeVersion: () => true,
    ...overrides,
  } as any;
}

describe('RoborockMatterbridgePlatform - startup branches', () => {
  it('onStart returns early when username is undefined', async () => {
    const logger = makeLogger();
    const config = { name: 'Test', authentication: { username: undefined, password: 'pass' }, pluginConfiguration: { whiteList: [], sanitizeSensitiveLogs: false } } as any;
    const platform = new RoborockMatterbridgePlatform(makeMatterbridge(), logger, config);
    // ready and persist stubs
    (platform as any).ready = Promise.resolve();
    (platform as any).persist = { init: async () => {}, getItem: async () => undefined, setItem: async () => {} };

    await platform.onStart();
    expect(logger.log as any).toHaveBeenCalled();
  });

  it('onStart logs error when startDeviceDiscovery returns false', async () => {
    const logger = makeLogger();
    const config = {
      name: 'Test',
      authentication: { username: 'u@example.com', password: 'pass' },
      pluginConfiguration: { whiteList: [], sanitizeSensitiveLogs: false },
    } as any;
    const platform = new RoborockMatterbridgePlatform(makeMatterbridge(), logger, config);
    (platform as any).ready = Promise.resolve();
    (platform as any).persist = { init: async () => {}, getItem: async () => undefined, setItem: async () => {} };

    // force startDeviceDiscovery to return false
    (platform as any).startDeviceDiscovery = async () => false;

    await platform.onStart();

    expect(logger.log as any).toHaveBeenCalledWith('error', 'Device discovery failed to start.');
  });

  it('onConfigure returns early if not started', async () => {
    const logger = makeLogger();
    const authentication = { username: 'abc', region: 'US', password: 'pass', authenticationMethod: 'Password', forceAuthentication: false } satisfies AuthenticationConfiguration;
    const pluginConfiguration = {
      whiteList: [],
      sanitizeSensitiveLogs: false,
      enableServerMode: false,
      enableMultipleMap: false,
      unregisterOnShutdown: false,
      refreshInterval: 60,
      debug: false,
    } satisfies RoborockPluginPlatformConfig['pluginConfiguration'];
    const advancedFeature = {
      enableAdvancedFeature: false,
      settings: {
        showRoutinesAsRoom: false,
        includeDockStationStatus: false,
        forceRunAtDefault: false,
        useVacationModeToSendVacuumToDock: false,
        enableCleanModeMapping: false,
        cleanModeSettings: {
          vacuuming: { fanMode: 'Silent', mopRouteMode: 'Standard' },
          mopping: { waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 500 },
          vacmop: { fanMode: 'Silent', waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 500 },
        },
      },
    } satisfies RoborockPluginPlatformConfig['advancedFeature'];
    const config = {
      name: 'Test',
      authentication,
      pluginConfiguration,
      advancedFeature,
      type: 'DynamicPlatform',
      version: '1.0.0',
      debug: false,
      unregisterOnShutdown: false,
    } satisfies RoborockPluginPlatformConfig;
    const platform = new RoborockMatterbridgePlatform(makeMatterbridge(), logger, config);
    // isStartPluginCompleted defaults to false - ensure no exception
    await platform.onConfigure();
    expect(logger.log as any).toHaveBeenCalled();
  });

  it('configureDevice returns false when roborockService undefined', async () => {
    const logger = makeLogger();
    const cfg: any = {
      name: 'Test',
      username: 'u@example.com',
      authentication: { username: 'u@example.com', password: 'pass' },
      pluginConfiguration: { whiteList: [], sanitizeSensitiveLogs: false },
    };
    const platform = new RoborockMatterbridgePlatform(makeMatterbridge(), logger, cfg);
    const vacuum = { duid: 'duid-1', name: 'Vac', serialNumber: 's1' } as any;

    const result = await (platform as any).configureDevice(vacuum);
    expect(result).toBe(false);
    expect(logger.log as any).toHaveBeenCalledWith('error', 'Initializing: RoborockService is undefined');
  });
});
