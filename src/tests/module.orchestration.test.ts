import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PlatformMatterbridge } from 'matterbridge';
import type { LocalStorage } from 'node-persist';
import { RoborockMatterbridgePlatform } from '../module.js';
import { asPartial, createMockLogger, createMockMatterbridge, createMockLocalStorage } from './helpers/testUtils.js';
import type { RoborockService } from '../services/roborockService.js';
import type { PlatformRunner } from '../platformRunner.js';
import type { RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';

function createMockConfig(overrides: Partial<RoborockPluginPlatformConfig> = {}): RoborockPluginPlatformConfig {
  return {
    name: 'TestPlatform',
    authentication: {
      username: 'test',
      region: 'US',
      forceAuthentication: false,
      password: 'test',
      authenticationMethod: 'Password',
    },
    pluginConfiguration: {
      whiteList: [],
      sanitizeSensitiveLogs: false,
      enableMultipleMap: false,
      unregisterOnShutdown: false,
      refreshInterval: 60,
      debug: false,
      enableServerMode: false,
    },
    advancedFeature: {
      enableAdvancedFeature: false,
      settings: {
        clearStorageOnStartup: false,
        showRoutinesAsRoom: false,
        includeDockStationStatus: false,
        includeVacuumErrorStatus: false,
        forceRunAtDefault: false,
        useVacationModeToSendVacuumToDock: false,
        enableCleanModeMapping: false,
        cleanModeSettings: {
          vacuuming: { fanMode: 'Silent', mopRouteMode: 'Standard' },
          mopping: { waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 0 },
          vacmop: { fanMode: 'Silent', waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 0 },
        },
        overrideMatterConfiguration: false,
        matterOverrideSettings: {
          matterVendorName: 'xxx',
          matterVendorId: 123,
          matterProductName: 'yy',
          matterProductId: 456,
        },
      },
    },
    ...overrides,
  } satisfies Partial<RoborockPluginPlatformConfig> as RoborockPluginPlatformConfig;
}

describe('RoborockMatterbridgePlatform - orchestration', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockMatterbridge: PlatformMatterbridge;
  let mockPersist: LocalStorage;
  let platform: RoborockMatterbridgePlatform;

  beforeEach(() => {
    vi.useFakeTimers();
    mockLogger = createMockLogger();
    mockMatterbridge = createMockMatterbridge();
    mockPersist = createMockLocalStorage({
      init: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    });

    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
    // Replace the FilterLogger-wrapped log with the mock logger so spy assertions work
    (platform as any).log = mockLogger;
    (platform as { ready?: Promise<void> }).ready = Promise.resolve();
    platform.persist = mockPersist;
    vi.spyOn(platform.configManager, 'validateConfig');
    Object.defineProperty(platform, 'clearSelect', { value: vi.fn().mockResolvedValue(undefined), configurable: true });
    Object.defineProperty(platform, 'unregisterAllDevices', {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('onStart', () => {
    it('should complete startup successfully', async () => {
      vi.spyOn(platform.discovery, 'discoverDevices').mockImplementation(async () => {
        platform.discovery.roborockService = asPartial<RoborockService>({});
        return true;
      });
      const onConfigureSpy = vi.spyOn(platform.configurator, 'onConfigureDevice').mockResolvedValue(undefined);

      await platform.onStart('test reason');

      expect(platform.log.notice).toHaveBeenCalledWith('onStart called with reason:', 'test reason');
      expect(platform.configManager.validateConfig).toHaveBeenCalled();
      expect(onConfigureSpy).toHaveBeenCalled();
      expect(platform.log.notice).toHaveBeenCalledWith('onStart finished');
      expect(platform.state.isStartupCompleted).toBe(true);
    });

    it('should handle missing reason parameter', async () => {
      vi.spyOn(platform.discovery, 'discoverDevices').mockImplementation(async () => {
        platform.discovery.roborockService = asPartial<RoborockService>({});
        return true;
      });
      vi.spyOn(platform.configurator, 'onConfigureDevice').mockResolvedValue(undefined);

      await platform.onStart();

      expect(platform.log.notice).toHaveBeenCalledWith('onStart called with reason:', 'none');
    });

    it('should fail when config validation fails', async () => {
      platform.configManager.validateConfig = vi.fn().mockReturnValue(false);

      await platform.onStart('test');

      expect(platform.log.error).toHaveBeenCalledWith('"username" (email address) is required in the config');
      expect(platform.state.isStartupCompleted).toBe(false);
    });

    it('should fail when device discovery fails', async () => {
      vi.spyOn(platform.discovery, 'discoverDevices').mockResolvedValue(false);

      await platform.onStart('test');

      expect(platform.log.error).toHaveBeenCalledWith('Device discovery failed to start.');
      expect(platform.state.isStartupCompleted).toBe(false);
    });

    it('should wait for platform to be ready', async () => {
      let readyResolver: () => void = () => {};
      const readyPromise = new Promise<void>((resolve) => {
        readyResolver = resolve;
      });
      (platform as { ready?: Promise<void> }).ready = readyPromise;

      vi.spyOn(platform.discovery, 'discoverDevices').mockImplementation(async () => {
        platform.discovery.roborockService = asPartial<RoborockService>({});
        return true;
      });
      vi.spyOn(platform.configurator, 'onConfigureDevice').mockResolvedValue(undefined);

      const clearSelectSpy = (platform as any).clearSelect;
      const startPromise = platform.onStart('test');

      expect(clearSelectSpy).not.toHaveBeenCalled();

      readyResolver();
      await startPromise;

      expect(clearSelectSpy).toHaveBeenCalled();
    });

    it('should initialize persistence storage', async () => {
      vi.spyOn(platform.discovery, 'discoverDevices').mockImplementation(async () => {
        platform.discovery.roborockService = asPartial<RoborockService>({});
        return true;
      });
      vi.spyOn(platform.configurator, 'onConfigureDevice').mockResolvedValue(undefined);

      await platform.onStart('test');

      expect(mockPersist.init).toHaveBeenCalled();
    });

    it('should return early when clearStorageOnStartup is enabled', async () => {
      Object.defineProperty(platform.configManager, 'isClearStorageOnStartupEnabled', {
        get: () => true,
        configurable: true,
      });

      await platform.onStart('test');

      expect(mockPersist.init).toHaveBeenCalled();
      expect(platform.configManager.validateConfig).not.toHaveBeenCalled();
    });

    it('should clear persistence when alwaysExecuteAuthentication is true', async () => {
      Object.defineProperty(platform.configManager, 'alwaysExecuteAuthentication', {
        get: () => true,
        configurable: true,
      });
      vi.spyOn(platform.discovery, 'discoverDevices').mockImplementation(async () => {
        platform.discovery.roborockService = asPartial<RoborockService>({});
        return true;
      });
      vi.spyOn(platform.configurator, 'onConfigureDevice').mockResolvedValue(undefined);

      await platform.onStart('test');

      expect(mockPersist.clear).toHaveBeenCalled();
    });

    it('should fail when roborockService is undefined after discovery', async () => {
      vi.spyOn(platform.discovery, 'discoverDevices').mockImplementation(async () => {
        platform.discovery.roborockService = undefined;
        return true;
      });

      await platform.onStart('test');

      expect(platform.log.error).toHaveBeenCalledWith('Initializing: RoborockService is undefined');
      expect(platform.state.isStartupCompleted).toBe(false);
    });
  });

  describe('onConfigure', () => {
    it('should set up polling interval when startup is completed', async () => {
      platform.state.setStartupCompleted(true);
      platform.platformRunner = asPartial<PlatformRunner>({ requestHomeData: vi.fn().mockResolvedValue(undefined) });

      await platform.onConfigure();

      expect(platform.log.notice).toHaveBeenCalledWith('onConfigure called');

      vi.advanceTimersByTime(61000);

      expect(platform.platformRunner.requestHomeData).toHaveBeenCalled();
    });

    it('should not set up interval when startup is not completed', async () => {
      platform.state.setStartupCompleted(false);
      platform.platformRunner = asPartial<PlatformRunner>({ requestHomeData: vi.fn().mockResolvedValue(undefined) });

      await platform.onConfigure();

      expect(platform.log.notice).toHaveBeenCalledWith('onConfigure called');

      vi.advanceTimersByTime(61000);

      expect(platform.platformRunner.requestHomeData).not.toHaveBeenCalled();
    });

    it('should handle requestHomeData errors gracefully', async () => {
      platform.state.setStartupCompleted(true);
      platform.platformRunner = asPartial<PlatformRunner>({
        requestHomeData: vi.fn().mockRejectedValue(new Error('Network error')),
      });

      await platform.onConfigure();

      await vi.advanceTimersByTimeAsync(61000);

      expect(platform.log.error).toHaveBeenCalledWith('requestHomeData (interval) failed: Network error');
    });

    it('should handle non-Error exceptions in requestHomeData', async () => {
      platform.state.setStartupCompleted(true);
      platform.platformRunner = asPartial<PlatformRunner>({
        requestHomeData: vi.fn().mockRejectedValue('string error'),
      });

      await platform.onConfigure();

      await vi.advanceTimersByTimeAsync(61000);

      expect(platform.log.error).toHaveBeenCalledWith('requestHomeData (interval) failed: string error');
    });

    it('should clear storage and unregister when clearStorageOnStartup is enabled', async () => {
      Object.defineProperty(platform.configManager, 'isClearStorageOnStartupEnabled', {
        get: () => true,
        configurable: true,
      });
      Object.defineProperty(platform.configManager, 'rawConfig', {
        get: () => ({
          authentication: { verificationCode: 'abc' },
          advancedFeature: { settings: { clearStorageOnStartup: true } },
        }),
        configurable: true,
      });
      Object.defineProperty(platform, 'onConfigChanged', {
        value: vi.fn().mockResolvedValue(undefined),
        configurable: true,
      });

      await platform.onConfigure();

      expect(platform.log.warn).toHaveBeenCalledWith('Clearing persistence storage as per configuration.');
      expect(mockPersist.clear).toHaveBeenCalled();
      expect((platform as any).unregisterAllDevices).toHaveBeenCalled();
    });

    it('should handle error during clearStorage flow', async () => {
      Object.defineProperty(platform.configManager, 'isClearStorageOnStartupEnabled', {
        get: () => true,
        configurable: true,
      });
      mockPersist.clear = vi.fn().mockRejectedValue(new Error('Storage error'));

      await platform.onConfigure();

      expect(platform.log.error).toHaveBeenCalledWith(expect.stringContaining('Error clearing persistence storage'));
    });
  });

  describe('onShutdown', () => {
    it('should clean up interval and reset state', async () => {
      platform.state.setStartupCompleted(true);

      await platform.onShutdown('test reason');

      expect(platform.log.notice).toHaveBeenCalledWith('onShutdown called with reason:', 'test reason');
      expect(platform.state.isStartupCompleted).toBe(false);
    });

    it('should handle missing reason parameter', async () => {
      await platform.onShutdown();

      expect(platform.log.notice).toHaveBeenCalledWith('onShutdown called with reason:', 'none');
    });

    it('should clear polling interval if it exists', async () => {
      platform.state.setStartupCompleted(true);
      platform.platformRunner = asPartial<PlatformRunner>({ requestHomeData: vi.fn().mockResolvedValue(undefined) });

      await platform.onConfigure();
      await platform.onShutdown('test');

      vi.advanceTimersByTime(61000);

      expect(platform.platformRunner.requestHomeData).not.toHaveBeenCalled();
    });

    it('should stop roborock service when available', async () => {
      const mockService = asPartial<RoborockService>({
        stopService: vi.fn(),
      });
      platform.roborockService = mockService;

      await platform.onShutdown('test');

      expect(mockService.stopService).toHaveBeenCalled();
      expect(platform.roborockService).toBeUndefined();
    });

    it('should handle undefined roborock service', async () => {
      platform.roborockService = undefined;

      await platform.onShutdown('test');

      expect(platform.roborockService).toBeUndefined();
    });

    it('should unregister devices when configured', async () => {
      const p = new RoborockMatterbridgePlatform(
        mockMatterbridge,
        mockLogger,
        createMockConfig({
          pluginConfiguration: {
            whiteList: [],
            sanitizeSensitiveLogs: false,
            enableMultipleMap: false,
            unregisterOnShutdown: true,
            refreshInterval: 60,
            debug: false,
            enableServerMode: false,
          },
        }),
      );
      (p as { ready?: Promise<void> }).ready = Promise.resolve();
      Object.defineProperty(p, 'unregisterAllDevices', {
        value: vi.fn().mockResolvedValue(undefined),
        configurable: true,
      });

      await p.onShutdown('test');

      expect((p as any).unregisterAllDevices).toHaveBeenCalledWith(500);
    });

    it('should not unregister devices when not configured', async () => {
      await platform.onShutdown('test');

      expect((platform as any).unregisterAllDevices).not.toHaveBeenCalled();
    });

    it('should handle shutdown when no interval was set', async () => {
      await platform.onShutdown('test');

      expect(platform.state.isStartupCompleted).toBe(false);
    });
  });
});
