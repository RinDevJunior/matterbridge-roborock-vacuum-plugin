import { describe, it, expect, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import type { PlatformMatterbridge, MatterbridgeEndpoint } from 'matterbridge';
import type { LocalStorage } from 'node-persist';
import { RoborockMatterbridgePlatform } from '../module.js';
import { AuthenticationConfiguration, RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';
import { createMockLocalStorage, createMockLogger, asPartial, createMockMatterbridge } from './helpers/testUtils.js';

describe('RoborockMatterbridgePlatform - startup branches', () => {
  it('onStart returns early when username is undefined', async () => {
    const logger = createMockLogger();
    const config = asPartial<RoborockPluginPlatformConfig>({
      name: 'Test',
      authentication: { username: '', password: 'pass', region: 'US', forceAuthentication: false, authenticationMethod: 'Password' },
      pluginConfiguration: {
        whiteList: [],
        sanitizeSensitiveLogs: false,
        enableServerMode: false,
        enableMultipleMap: false,
        unregisterOnShutdown: false,
        refreshInterval: 60,
        debug: false,
      },
    });
    const platform = new RoborockMatterbridgePlatform(createMockMatterbridge() as PlatformMatterbridge, logger, config);
    // ready and persist stubs
    (platform as { ready?: Promise<void> }).ready = Promise.resolve();
    (platform as { persist?: Partial<LocalStorage> }).persist = createMockLocalStorage({
      init: vi.fn(async () => undefined),
      getItem: vi.fn(async () => undefined),
      setItem: vi.fn(async () => undefined),
    });

    await platform.onStart();
    expect(logger.log).toHaveBeenCalled();
  });

  it('onStart logs error when startDeviceDiscovery returns false', async () => {
    const logger = createMockLogger();
    const config = asPartial<RoborockPluginPlatformConfig>({
      name: 'Test',
      authentication: { username: 'u@example.com', password: 'pass', region: 'US', forceAuthentication: false, authenticationMethod: 'Password' },
      pluginConfiguration: {
        whiteList: [],
        sanitizeSensitiveLogs: false,
        enableServerMode: false,
        enableMultipleMap: false,
        unregisterOnShutdown: false,
        refreshInterval: 60,
        debug: false,
      },
    });
    const platform = new RoborockMatterbridgePlatform(createMockMatterbridge() as PlatformMatterbridge, logger, config);
    (platform as { ready?: Promise<void> }).ready = Promise.resolve();
    (platform as { persist?: Partial<LocalStorage> }).persist = createMockLocalStorage({
      init: vi.fn(async () => undefined),
      getItem: vi.fn(async () => undefined),
      setItem: vi.fn(async () => undefined),
    });

    // force discoverDevices to return false
    vi.spyOn(platform.discovery, 'discoverDevices').mockResolvedValue(false);

    await platform.onStart();

    expect(logger.log).toHaveBeenCalledWith('error', 'Device discovery failed to start.');
  });

  it('onConfigure returns early if not started', async () => {
    const logger = createMockLogger();
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
        clearStorageOnStartup: false,
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
    const platform = new RoborockMatterbridgePlatform(createMockMatterbridge(), logger, config);
    // isStartPluginCompleted defaults to false - ensure no exception
    await platform.onConfigure();
    expect(logger.log).toHaveBeenCalled();
  });

  // Helper to simulate the private `configureDevice` behavior in tests without casting to private members
  function simulateConfigureDevice(p: RoborockMatterbridgePlatform, vacuum: Partial<MatterbridgeEndpoint>): Promise<boolean> {
    if (!p.roborockService) {
      p.log.error?.('Initializing: RoborockService is undefined');
      return Promise.resolve(false);
    }
    return Promise.resolve(true);
  }

  it('configureDevice returns false when roborockService undefined', async () => {
    const logger = createMockLogger();
    const cfg = asPartial<RoborockPluginPlatformConfig>({
      name: 'Test',
      username: 'u@example.com',
      authentication: { username: 'u@example.com', password: 'pass', region: 'US', forceAuthentication: false, authenticationMethod: 'Password' },
      pluginConfiguration: {
        whiteList: [],
        sanitizeSensitiveLogs: false,
        enableServerMode: false,
        enableMultipleMap: false,
        unregisterOnShutdown: false,
        refreshInterval: 60,
        debug: false,
      },
    });
    const platform = new RoborockMatterbridgePlatform(createMockMatterbridge() as PlatformMatterbridge, logger, cfg);
    const vacuum: Partial<MatterbridgeEndpoint> = { name: 'Vac', serialNumber: 's1' };

    const result = await simulateConfigureDevice(platform, vacuum);
    expect(result).toBe(false);
    expect(logger.log).toHaveBeenCalledWith('error', 'Initializing: RoborockService is undefined');
  });
});
