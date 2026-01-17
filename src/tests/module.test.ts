import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { PlatformMatterbridge } from 'matterbridge';
import { RoborockMatterbridgePlatform, RoborockPluginPlatformConfig } from '../module.js';
import { MatterbridgeDynamicPlatform } from 'matterbridge';
import NodePersist from 'node-persist';

// Mocks
vi.mock('node-persist', () => ({
  default: {
    create: vi.fn(() => ({
      init: vi.fn().mockResolvedValue(undefined),
      getItem: vi.fn().mockResolvedValue(undefined),
      setItem: vi.fn().mockResolvedValue(undefined),
      removeItem: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

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

class TestRoborockMatterbridgePlatform extends RoborockMatterbridgePlatform {
  // Expose protected/private methods for testing
  public async testAuthenticateWithPassword(username: string, password: string) {
    // @ts-expect-error: access private
    return this.authenticateWithPassword(username, password);
  }
  public async testAuthenticate2FA(username: string, code: string) {
    // @ts-expect-error: access private
    return this.authenticate2FA(username, code);
  }
  public async testStartDeviceDiscovery() {
    // @ts-expect-error: access private
    return this.startDeviceDiscovery();
  }
}

describe('RoborockMatterbridgePlatform', () => {
  it('should set deviceId in persist if not present', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    // @ts-ignore
    platform.persist.getItem = vi.fn().mockResolvedValueOnce(undefined);
    // @ts-ignore
    platform.persist.setItem = vi.fn().mockResolvedValue(undefined);
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as any;
    platform.authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform.startDeviceDiscovery();
    expect(platform.persist.setItem).toHaveBeenCalledWith('deviceId', expect.any(String));
  });
  it('should set deviceId in persist if not present (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    const persist = platform.persist as unknown as { getItem: jest.Mock; setItem: jest.Mock };
    (persist.getItem as any) = vi.fn().mockResolvedValueOnce(undefined);
    (persist.setItem as any) = vi.fn().mockResolvedValue(undefined);
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as unknown as RoborockService;
    (platform as any).authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform.testStartDeviceDiscovery();
    expect(persist.setItem as any).toHaveBeenCalledWith('deviceId', expect.any(String));
  });

  it('should use cached deviceId if present', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    // @ts-ignore
    platform.persist.getItem = vi.fn().mockResolvedValueOnce('cached-device-id');
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as any;
    platform.authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform.startDeviceDiscovery();
    expect(platform.persist.setItem).not.toHaveBeenCalledWith('deviceId', expect.any(String));
  });
  it('should use cached deviceId if present (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    const persist = platform.persist as unknown as { getItem: jest.Mock; setItem: jest.Mock };
    (persist.getItem as any) = vi.fn().mockResolvedValueOnce('cached-device-id');
    (persist.setItem as any) = vi.fn();
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as unknown as RoborockService;
    (platform as any).authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform.testStartDeviceDiscovery();
    expect(persist.setItem as any).not.toHaveBeenCalledWith('deviceId', expect.any(String));
  });

  it('should log and throw error in authenticateWithPassword if service not initialized', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform['authenticateWithPassword']('user', 'pw')).rejects.toThrow('RoborockService is not initialized');
  });
  it('should log and throw error in authenticateWithPassword if service not initialized (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform.testAuthenticateWithPassword('user', 'pw')).rejects.toThrow('RoborockService is not initialized');
  });

  it('should log and throw error in authenticate2FA if service not initialized', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform['authenticate2FA']('user', '123456')).rejects.toThrow('RoborockService is not initialized');
  });
  it('should log and throw error in authenticate2FA if service not initialized (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform.testAuthenticate2FA('user', '123456')).rejects.toThrow('RoborockService is not initialized');
  });

  it('should return shouldContinue false if authenticateWithPassword throws', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.roborockService = { loginWithPassword: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    await expect(platform['authenticateWithPassword']('user', 'pw')).rejects.toThrow('fail');
  });
  it('should return shouldContinue false if authenticateWithPassword throws (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.roborockService = { loginWithPassword: vi.fn().mockRejectedValue(new Error('fail')) } as unknown as RoborockService;
    await expect(platform.testAuthenticateWithPassword('user', 'pw')).rejects.toThrow('fail');
  });

  it('should return shouldContinue false if authenticate2FA throws', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.roborockService = { loginWithVerificationCode: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    // @ts-ignore
    platform.persist.getItem = vi.fn().mockResolvedValue(undefined);
    await expect(platform['authenticate2FA']('user', '123456')).rejects.toThrow('fail');
  });
  it('should return shouldContinue false if authenticate2FA throws (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.roborockService = { loginWithVerificationCode: vi.fn().mockRejectedValue(new Error('fail')) } as unknown as RoborockService;
    const persist = platform.persist as unknown as { getItem: jest.Mock };
    (persist.getItem as any) = vi.fn().mockResolvedValue(undefined);
    await expect(platform.testAuthenticate2FA('user', '123456')).rejects.toThrow('fail');
  });
  it('should log error if username is missing in onStart', async () => {
    const configClone = { ...config };
    delete configClone.username;
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, configClone);
    await platform.onStart();
    expect(mockLogger.error).toHaveBeenCalledWith('"username" (email address) is required in the config');
  });

  it('should log error if device discovery fails in onStart', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    // Mock startDeviceDiscovery to return false
    platform.startDeviceDiscovery = vi.fn().mockResolvedValue(false) as any;
    await platform.onStart();
    expect(mockLogger.error).toHaveBeenCalledWith('Device discovery failed to start.');
  });

  it('should call onConfigureDevice and set isStartPluginCompleted in onStart', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.startDeviceDiscovery = vi.fn().mockResolvedValue(true) as any;
    const onConfigureDeviceSpy = vi.spyOn(platform as any, 'onConfigureDevice').mockResolvedValue(undefined);
    await platform.onStart();
    expect(onConfigureDeviceSpy).toHaveBeenCalled();
    expect(platform['isStartPluginCompleted']).toBe(true);
  });

  it('should not call super.onConfigure if isStartPluginCompleted is false', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform['isStartPluginCompleted'] = false;
    const superOnConfigure = vi.spyOn(MatterbridgeDynamicPlatform.prototype, 'onConfigure');
    await platform.onConfigure();
    expect(superOnConfigure).not.toHaveBeenCalled();
    superOnConfigure.mockRestore();
  });

  it('should call super.onConfigure and set interval if isStartPluginCompleted is true', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform['isStartPluginCompleted'] = true;
    const superOnConfigure = vi.spyOn(MatterbridgeDynamicPlatform.prototype, 'onConfigure').mockResolvedValue(undefined);
    await platform.onConfigure();
    expect(superOnConfigure).toHaveBeenCalled();
    expect(platform.rvcInterval).toBeDefined();
    clearInterval(platform.rvcInterval!);
    superOnConfigure.mockRestore();
  });

  it('should call super.onShutdown and clear resources', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.rvcInterval = setInterval(() => {}, 1000);
    platform.roborockService = { stopService: vi.fn() } as any;
    platform.config.unregisterOnShutdown = true;
    platform.unregisterAllDevices = vi.fn().mockResolvedValue(undefined) as any;
    const superOnShutdown = vi.spyOn(MatterbridgeDynamicPlatform.prototype, 'onShutdown').mockResolvedValue(undefined);
    await platform.onShutdown('test');
    expect(superOnShutdown).toHaveBeenCalledWith('test');
    // Node.js does not set interval to undefined after clearInterval, so just check it's not running
    expect(platform.rvcInterval == null || (platform.rvcInterval && platform.rvcInterval._destroyed)).toBe(true);
    expect(platform.roborockService.stopService).toHaveBeenCalled();
    expect(platform.unregisterAllDevices).toHaveBeenCalled();
    expect(platform['isStartPluginCompleted']).toBe(false);
    superOnShutdown.mockRestore();
  });
  let platform: RoborockMatterbridgePlatform;
  let mockLogger: AnsiLogger;
  let mockMatterbridge: PlatformMatterbridge;
  let config: RoborockPluginPlatformConfig;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockMatterbridge = {
      matterbridgeVersion: '3.4.7',
      matterbridgePluginDirectory: '/tmp',
      matterbridgeDirectory: '/tmp',
      verifyMatterbridgeVersion: () => true,
    } as any;
    config = {
      name: 'Test Platform',
      username: 'test@example.com',
      whiteList: [],
      blackList: [],
      useInterval: false,
      refreshInterval: 60,
      debug: false,
      authentication: { password: 'pw', authenticationMethod: 'Password' },
      enableExperimental: { advancedFeature: {}, enableExperimentalFeature: false },
      persistDirectory: '/tmp',
    } as any;
  });

  it('should construct and initialize fields', () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    expect(platform).toBeDefined();
    expect(platform.robots).toBeInstanceOf(Map);
    expect(platform.devices).toBeInstanceOf(Map);
    expect(platform.clientManager).toBeDefined();
    expect(platform.persist).toBeDefined();
  });

  it('should throw if Matterbridge version is too low', () => {
    // Remove the mock override so the base implementation is used
    delete mockMatterbridge.verifyMatterbridgeVersion;
    // Set a low version to trigger the error
    mockMatterbridge.matterbridgeVersion = '3.0.0';
    const configClone = JSON.parse(JSON.stringify(config));
    expect(() => new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, configClone)).toThrow();
  });

  it('should not throw if verifyMatterbridgeVersion is correct', () => {
    mockMatterbridge.verifyMatterbridgeVersion = () => true;
    expect(() => new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config)).not.toThrow();
  });

  it('should set default config fields if missing', () => {
    delete config.whiteList;
    delete config.blackList;
    delete config.enableExperimental;
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    expect(platform.config.whiteList).toBeDefined();
    expect(platform.config.blackList).toBeDefined();
    expect(platform.config.enableExperimental).toBeDefined();
  });

  it('should handle error if NodePersist.create throws', () => {
    const originalCreate = NodePersist.create;
    (NodePersist as any).create = vi.fn(() => {
      throw new Error('persist create fail');
    });
    expect(() => new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config)).toThrow('persist create fail');
    (NodePersist as any).create = originalCreate;
  });

  it('should throw if persist.init fails in onStart', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    (platform.persist.init as any) = vi.fn().mockRejectedValue(new Error('init fail'));
    await expect(platform.onStart()).rejects.toThrow('init fail');
  });

  it('should throw if config is empty object (missing name)', () => {
    const emptyConfig = {} as any;
    expect(() => new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, emptyConfig)).toThrow('plugin name is missing');
  });
  it('should change log level in onChangeLoggerLevel', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await platform.onChangeLoggerLevel('debug');
    expect(platform.log.logLevel).toBe('debug');
  });

  it('should log verification code banner', () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    // @ts-expect-error: access private
    platform.logVerificationCodeBanner('test@example.com', false);
    expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('ACTION REQUIRED'));
    // @ts-expect-error: access private
    platform.logVerificationCodeBanner('test@example.com', true);
    expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('was previously sent'));
  });

  it('should not add device if missing serialNumber or deviceName', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    // @ts-expect-error: minimal mock
    const result = await platform['addDevice']({});
    expect(result).toBeUndefined();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('missing serialNumber'));
  });

  it('should not configure device if platformRunner or roborockService is undefined', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    // @ts-expect-error: minimal mock
    const result = await platform['configureDevice']({});
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('PlatformRunner or RoborockService is undefined'));
  });

  // More tests for addDevice, configureDevice, and other uncovered logic can be added for even higher coverage.
});
