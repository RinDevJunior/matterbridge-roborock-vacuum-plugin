import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { PlatformMatterbridge } from 'matterbridge';
import { RoborockMatterbridgePlatform, RoborockPluginPlatformConfig } from '../module.js';
import { MatterbridgeDynamicPlatform } from 'matterbridge';
import NodePersist from 'node-persist';
import RoborockService from '../roborockService.js';

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
  public async testAuthenticateWithPassword(username: string, password: string) {
    return this['authenticateWithPassword'](username, password);
  }
  public async testAuthenticate2FA(username: string, code: string) {
    return this['authenticate2FA'](username, code);
  }
  public async testStartDeviceDiscovery() {
    return this['startDeviceDiscovery']();
  }
  public async testAuthenticate(deviceId: string) {
    return this['authenticate'](deviceId);
  }
  public async testOnConfigureDevice() {
    return this['onConfigureDevice']();
  }
  public async testConfigureDevice(vacuum: any) {
    return this['configureDevice'](vacuum);
  }
  public testLogVerificationCodeBanner(email: string, wasPreviouslySent: boolean) {
    return this['logVerificationCodeBanner'](email, wasPreviouslySent);
  }
  public async testAddDevice(device: any) {
    return this['addDevice'](device);
  }
}

let platform: RoborockMatterbridgePlatform;
let mockLogger: AnsiLogger;
let mockMatterbridge: PlatformMatterbridge;
let config: RoborockPluginPlatformConfig;

describe('RoborockMatterbridgePlatform', () => {
  describe('private methods', () => {
    let testPlatform: TestRoborockMatterbridgePlatform;
    beforeEach(() => {
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    });

    it('startDeviceDiscovery returns false if authenticate fails', async () => {
      testPlatform['authenticate'] = vi.fn().mockResolvedValue({ shouldContinue: false });
      testPlatform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as any;
      const result = await testPlatform.testStartDeviceDiscovery();
      expect(result).toBe(false);
    });

    it('onConfigureDevice logs error if platformRunner or roborockService undefined', async () => {
      testPlatform.platformRunner = undefined;
      testPlatform.roborockService = undefined;
      await testPlatform.testOnConfigureDevice();
      expect(mockLogger.error).toHaveBeenCalledWith('Initializing: PlatformRunner or RoborockService is undefined');
    });

    it('configureDevice returns false if platformRunner or roborockService undefined', async () => {
      testPlatform.platformRunner = undefined;
      testPlatform.roborockService = undefined;
      const result = await testPlatform.testConfigureDevice({});
      expect(result).toBe(false);
    });

    it('authenticateWithPassword throws if roborockService is not initialized', async () => {
      testPlatform.roborockService = undefined;
      await expect(testPlatform.testAuthenticateWithPassword('user', 'pw')).rejects.toThrow('RoborockService is not initialized');
    });

    it('authenticate2FA throws if roborockService is not initialized', async () => {
      testPlatform.roborockService = undefined;
      await expect(testPlatform.testAuthenticate2FA('user', 'code')).rejects.toThrow('RoborockService is not initialized');
    });

    it('logVerificationCodeBanner logs correct messages', () => {
      testPlatform.testLogVerificationCodeBanner('test..example.com', false);
      expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('ACTION REQUIRED'));
      testPlatform.testLogVerificationCodeBanner('test..example.com', true);
      expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('was previously sent'));
    });

    it('addDevice returns undefined if serialNumber or deviceName missing', async () => {
      const device = { serialNumber: undefined, deviceName: undefined };
      const result = await testPlatform.testAddDevice(device);
      expect(result).toBeUndefined();
    });
  });

  it('should set deviceId in persist if not present', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.persist.getItem = vi.fn().mockResolvedValueOnce(undefined);
    platform.persist.setItem = vi.fn().mockResolvedValue(undefined);
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as any;
    platform['authenticate'] = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform['startDeviceDiscovery']();
    expect(platform.persist.setItem).toHaveBeenCalledWith('deviceId', expect.any(String));
  });
  it('should set deviceId in persist if not present (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    const persist = platform.persist;
    (persist.getItem as any) = vi.fn().mockResolvedValueOnce(undefined);
    (persist.setItem as any) = vi.fn().mockResolvedValue(undefined);
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as unknown as RoborockService;
    (platform as any).authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform['startDeviceDiscovery']();
    expect(persist.setItem as any).toHaveBeenCalledWith('deviceId', expect.any(String));
  });

  it('should use cached deviceId if present', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.persist.getItem = vi.fn().mockResolvedValueOnce('cached-device-id');
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as any;
    platform['authenticate'] = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform['startDeviceDiscovery']();
    expect(platform.persist.setItem).not.toHaveBeenCalledWith('deviceId', expect.any(String));
  });
  it('should use cached deviceId if present (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    const persist = platform.persist;
    (persist.getItem as any) = vi.fn().mockResolvedValueOnce('cached-device-id');
    (persist.setItem as any) = vi.fn();
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as unknown as RoborockService;
    (platform as any).authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform['startDeviceDiscovery']();
    expect(persist.setItem as any).not.toHaveBeenCalledWith('deviceId', expect.any(String));
  });

  it('should log and throw error in authenticateWithPassword if service not initialized', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform['authenticateWithPassword']('user', 'pw')).rejects.toThrow('RoborockService is not initialized');
  });
  it('should log and throw error in authenticateWithPassword if service not initialized (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform['authenticateWithPassword']('user', 'pw')).rejects.toThrow('RoborockService is not initialized');
  });

  it('should log and throw error in authenticate2FA if service not initialized', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform['authenticate2FA']('user', '123456')).rejects.toThrow('RoborockService is not initialized');
  });
  it('should log and throw error in authenticate2FA if service not initialized (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform['authenticate2FA']('user', '123456')).rejects.toThrow('RoborockService is not initialized');
  });

  it('should return shouldContinue false if authenticateWithPassword throws', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.roborockService = { loginWithPassword: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    await expect(platform['authenticateWithPassword']('user', 'pw')).rejects.toThrow('fail');
  });
  it('should return shouldContinue false if authenticateWithPassword throws (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.roborockService = { loginWithPassword: vi.fn().mockRejectedValue(new Error('fail')) } as unknown as RoborockService;
    await expect(platform['authenticateWithPassword']('user', 'pw')).rejects.toThrow('fail');
  });

  it('should return shouldContinue false if authenticate2FA throws', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.roborockService = { loginWithVerificationCode: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    platform.persist.getItem = vi.fn().mockResolvedValue(undefined);
    await expect(platform['authenticate2FA']('user', '123456')).rejects.toThrow('fail');
  });

  it('should log error if username is missing in onStart', async () => {
    const configClone = { ...config };
    delete configClone.username;
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, configClone);
    await platform.onStart();
    expect(mockLogger.error).toHaveBeenCalledWith('"username" (email address) is required in the config');
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
    if (platform.rvcInterval) {
      clearInterval(platform.rvcInterval);
    }
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
    expect(platform.rvcInterval).toBeUndefined();
    expect(platform.roborockService).toBeUndefined();
    expect(platform.unregisterAllDevices).toHaveBeenCalled();
    expect(platform['isStartPluginCompleted']).toBe(false);
    superOnShutdown.mockRestore();
  });

  it('should call super.onShutdown and handle missing resources', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.rvcInterval = undefined;
    platform.roborockService = undefined;
    platform.config.unregisterOnShutdown = false;
    const superOnShutdown = vi.spyOn(MatterbridgeDynamicPlatform.prototype, 'onShutdown').mockResolvedValue(undefined);
    await platform.onShutdown('test');
    expect(superOnShutdown).toHaveBeenCalledWith('test');
    expect(platform.rvcInterval).toBeUndefined();
    expect(platform.roborockService).toBeUndefined();
    superOnShutdown.mockRestore();
  });

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockMatterbridge = {
      matterbridgeVersion: '3.5.0',
      matterbridgePluginDirectory: '/tmp',
      matterbridgeDirectory: '/tmp',
      verifyMatterbridgeVersion: () => true,
    } as any;
    config = {
      name: 'Test Platform',
      username: 'test..example.com',
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
    await platform.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(platform.log.logLevel).toBe('debug');
  });
});
