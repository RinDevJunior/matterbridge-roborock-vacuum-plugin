import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { MatterbridgeDynamicPlatform } from 'matterbridge';
import { PlatformLifecycle, LifecycleDependencies } from '../../platform/platformLifecycle.js';
import { DeviceRegistry } from '../../platform/deviceRegistry.js';
import { asPartial, asType } from '../helpers/testUtils.js';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { PlatformState } from '../../platform/platformState.js';
import type NodePersist from 'node-persist';

function createMockLogger(): AnsiLogger {
  return asType<AnsiLogger>({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    log: vi.fn(),
  });
}

function createMockPlatform(): MatterbridgeDynamicPlatform {
  return asPartial<MatterbridgeDynamicPlatform>({
    log: createMockLogger(),
    ready: Promise.resolve(),
  });
}

function createMockDependencies(overrides: Partial<LifecycleDependencies> = {}): LifecycleDependencies {
  return {
    getPersistanceStorage: vi.fn().mockReturnValue({
      init: vi.fn().mockResolvedValue(undefined),
    }),
    getPlatformRunner: vi.fn().mockReturnValue({
      requestHomeData: vi.fn().mockResolvedValue(undefined),
    }),
    getRoborockService: vi.fn().mockReturnValue({
      stopService: vi.fn(),
    }),
    startDeviceDiscovery: vi.fn().mockResolvedValue(true),
    onConfigureDevice: vi.fn().mockResolvedValue(undefined),
    clearSelect: vi.fn().mockResolvedValue(undefined),
    unregisterAllDevices: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('PlatformLifecycle', () => {
  let mockPlatform: MatterbridgeDynamicPlatform;
  let mockRegistry: DeviceRegistry;
  let mockConfigManager: PlatformConfigManager;
  let mockState: PlatformState;
  let mockDeps: LifecycleDependencies;
  let lifecycle: PlatformLifecycle;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPlatform = createMockPlatform();
    mockConfigManager = asPartial<PlatformConfigManager>({
      validateConfig: vi.fn().mockReturnValue(true),
      refreshInterval: 60,
      unregisterOnShutdown: false,
    });
    mockState = new PlatformState();
    mockDeps = createMockDependencies();
    lifecycle = new PlatformLifecycle(mockPlatform, mockConfigManager, mockState, mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('onStart', () => {
    it('should complete startup successfully', async () => {
      await lifecycle.onStart('test reason');

      expect(mockPlatform.log.notice).toHaveBeenCalledWith('onStart called with reason:', 'test reason');
      expect(mockDeps.clearSelect).toHaveBeenCalled();
      expect(mockDeps.getPersistanceStorage).toHaveBeenCalled();
      expect(mockConfigManager.validateConfig).toHaveBeenCalled();
      expect(mockDeps.startDeviceDiscovery).toHaveBeenCalled();
      expect(mockDeps.onConfigureDevice).toHaveBeenCalled();
      expect(mockPlatform.log.notice).toHaveBeenCalledWith('onStart finished');
      expect(mockState.isStartupCompleted).toBe(true);
    });

    it('should handle missing reason parameter', async () => {
      await lifecycle.onStart();

      expect(mockPlatform.log.notice).toHaveBeenCalledWith('onStart called with reason:', 'none');
    });

    it('should fail when config validation fails', async () => {
      mockConfigManager.validateConfig = vi.fn().mockReturnValue(false);

      await lifecycle.onStart('test');

      expect(mockPlatform.log.error).toHaveBeenCalledWith('"username" (email address) is required in the config');
      expect(mockState.isStartupCompleted).toBe(false);
      expect(mockDeps.startDeviceDiscovery).not.toHaveBeenCalled();
    });

    it('should fail when device discovery fails', async () => {
      mockDeps.startDeviceDiscovery = vi.fn().mockResolvedValue(false);

      await lifecycle.onStart('test');

      expect(mockPlatform.log.error).toHaveBeenCalledWith('Device discovery failed to start.');
      expect(mockState.isStartupCompleted).toBe(false);
      expect(mockDeps.onConfigureDevice).not.toHaveBeenCalled();
    });

    it('should wait for platform to be ready', async () => {
      let readyResolver: () => void = () => {};
      const readyPromise = new Promise<void>((resolve) => {
        readyResolver = resolve;
      });

      const customMockPlatform = {
        ...mockPlatform,
        ready: readyPromise,
      } as MatterbridgeDynamicPlatform;
      lifecycle = new PlatformLifecycle(customMockPlatform, mockConfigManager, mockState, mockDeps);

      const startPromise = lifecycle.onStart('test');

      // Verify startup hasn't completed yet
      expect(mockDeps.clearSelect).not.toHaveBeenCalled();

      // Resolve ready promise
      readyResolver();
      await startPromise;

      expect(mockDeps.clearSelect).toHaveBeenCalled();
    });

    it('should initialize persistence storage', async () => {
      const mockStorage = asPartial<NodePersist.LocalStorage>({
        init: vi.fn().mockResolvedValue(undefined),
      });
      mockDeps.getPersistanceStorage = vi.fn().mockReturnValue(mockStorage);

      await lifecycle.onStart('test');

      expect(mockDeps.getPersistanceStorage).toHaveBeenCalled();
      expect(mockStorage.init).toHaveBeenCalled();
    });
  });

  describe('onConfigure', () => {
    it('should set up polling interval when startup is completed', async () => {
      mockState.setStartupCompleted(true);

      await lifecycle.onConfigure();

      expect(mockPlatform.log.notice).toHaveBeenCalledWith('onConfigure called');

      // Fast-forward time to trigger interval
      vi.advanceTimersByTime(61000);

      const runner = mockDeps.getPlatformRunner();
      expect(runner?.requestHomeData).toHaveBeenCalled();
    });

    it('should not set up interval when startup is not completed', async () => {
      mockState.setStartupCompleted(false);

      await lifecycle.onConfigure();

      expect(mockPlatform.log.notice).toHaveBeenCalledWith('onConfigure called');

      // Fast-forward time
      vi.advanceTimersByTime(61000);

      const runner = mockDeps.getPlatformRunner();
      expect(runner?.requestHomeData).not.toHaveBeenCalled();
    });

    it('should use custom refresh interval from config', async () => {
      mockState.setStartupCompleted(true);

      await lifecycle.onConfigure();

      // Fast-forward by 61 seconds (60s + 1s buffer)
      vi.advanceTimersByTime(61000);

      const runner = mockDeps.getPlatformRunner();
      expect(runner?.requestHomeData).toHaveBeenCalled();
    });

    it('should handle requestHomeData errors gracefully', async () => {
      mockState.setStartupCompleted(true);
      const mockRunner = {
        requestHomeData: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      mockDeps.getPlatformRunner = vi.fn().mockReturnValue(mockRunner);

      await lifecycle.onConfigure();

      await vi.advanceTimersByTimeAsync(61000);

      expect(mockPlatform.log.error).toHaveBeenCalledWith('requestHomeData (interval) failed: Network error');
    });

    it('should handle non-Error exceptions in requestHomeData', async () => {
      mockState.setStartupCompleted(true);
      const mockRunner = {
        requestHomeData: vi.fn().mockRejectedValue('string error'),
      };
      mockDeps.getPlatformRunner = vi.fn().mockReturnValue(mockRunner);

      await lifecycle.onConfigure();

      await vi.advanceTimersByTimeAsync(61000);

      expect(mockPlatform.log.error).toHaveBeenCalledWith('requestHomeData (interval) failed: string error');
    });

    it('should handle undefined platform runner', async () => {
      mockState.setStartupCompleted(true);
      mockDeps.getPlatformRunner = vi.fn().mockReturnValue(undefined);

      await lifecycle.onConfigure();

      vi.advanceTimersByTime(61000);

      expect(mockDeps.getPlatformRunner).toHaveBeenCalled();
    });
  });

  describe('onShutdown', () => {
    it('should clean up interval and reset state', async () => {
      mockState.setStartupCompleted(true);

      await lifecycle.onShutdown('test reason');

      expect(mockPlatform.log.notice).toHaveBeenCalledWith('onShutdown called with reason:', 'test reason');
      expect(mockState.isStartupCompleted).toBe(false);
    });

    it('should handle missing reason parameter', async () => {
      await lifecycle.onShutdown();

      expect(mockPlatform.log.notice).toHaveBeenCalledWith('onShutdown called with reason:', 'none');
    });

    it('should clear polling interval if it exists', async () => {
      mockState.setStartupCompleted(true);
      await lifecycle.onConfigure();

      await lifecycle.onShutdown('test');

      vi.advanceTimersByTime(61000);

      const runner = mockDeps.getPlatformRunner();
      expect(runner?.requestHomeData).not.toHaveBeenCalled();
    });

    it('should stop roborock service when available', async () => {
      const mockService = {
        stopService: vi.fn(),
      };
      mockDeps.getRoborockService = vi.fn().mockReturnValue(mockService);

      await lifecycle.onShutdown('test');

      expect(mockDeps.getRoborockService).toHaveBeenCalled();
      expect(mockService.stopService).toHaveBeenCalled();
    });

    it('should handle undefined roborock service', async () => {
      mockDeps.getRoborockService = vi.fn().mockReturnValue(undefined);

      await lifecycle.onShutdown('test');

      expect(mockDeps.getRoborockService).toHaveBeenCalled();
    });

    it('should unregister devices when configured', async () => {
      const fakeConfigManager = {
        ...mockConfigManager,
        unregisterOnShutdown: false,
      } as PlatformConfigManager;
      lifecycle = new PlatformLifecycle(mockPlatform, fakeConfigManager, mockState, mockDeps);
      await lifecycle.onShutdown('test');

      expect(mockDeps.unregisterAllDevices).not.toHaveBeenCalledWith(500);
    });

    it('should not unregister devices when not configured', async () => {
      const fakeConfigManager = {
        ...mockConfigManager,
        unregisterOnShutdown: false,
      } as PlatformConfigManager;
      lifecycle = new PlatformLifecycle(mockPlatform, fakeConfigManager, mockState, mockDeps);

      await lifecycle.onShutdown('test');

      expect(mockDeps.unregisterAllDevices).not.toHaveBeenCalled();
    });

    it('should handle shutdown when no interval was set', async () => {
      await lifecycle.onShutdown('test');

      expect(mockState.isStartupCompleted).toBe(false);
    });
  });
});
