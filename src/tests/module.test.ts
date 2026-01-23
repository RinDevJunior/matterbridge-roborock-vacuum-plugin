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
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    logLevel: 'info',
    log: vi.fn((level: LogLevel, message: string, ...parameters: unknown[]) => {
      switch (level) {
        case LogLevel.DEBUG:
          logger.debug(message, ...parameters);
          break;
        case LogLevel.INFO:
          logger.info(message, ...parameters);
          break;
        case LogLevel.WARN:
          logger.warn(message, ...parameters);
          break;
        case LogLevel.ERROR:
          logger.error(message, ...parameters);
          break;
        case LogLevel.NOTICE:
          logger.notice(message, ...parameters);
          break;
        default:
          break;
      }
    }),
  } as unknown as AnsiLogger;
  return logger;
}

class TestRoborockMatterbridgePlatform extends RoborockMatterbridgePlatform {
  public async testAuthenticateWithPassword(username: string, password: string) {
    return this.authenticateWithPassword(username, password);
  }
  public async testAuthenticate2FA(username: string, code: string) {
    return this.authenticate2FA(username, code);
  }
  public async testStartDeviceDiscovery() {
    return this.startDeviceDiscovery();
  }
  public async testAuthenticate(deviceId: string) {
    return this.authenticate(deviceId);
  }
  public async testOnConfigureDevice() {
    return this.onConfigureDevice();
  }
  public async testConfigureDevice(vacuum: any) {
    return this.configureDevice(vacuum);
  }
  public testLogVerificationCodeBanner(email: string, wasPreviouslySent: boolean) {
    this.logVerificationCodeBanner(email, wasPreviouslySent);
  }
  public async testAddDevice(device: any) {
    return this.addDevice(device);
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
      testPlatform.authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
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
      testPlatform.testLogVerificationCodeBanner('test@example.com', false);
      expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('ACTION REQUIRED'));
      testPlatform.testLogVerificationCodeBanner('test@example.com', true);
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
    platform.authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform.startDeviceDiscovery();
    expect(platform.persist.setItem).toHaveBeenCalledWith('deviceId', expect.any(String));
  });
  it('should set deviceId in persist if not present (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    const persist = platform.persist;
    (persist.getItem as any) = vi.fn().mockResolvedValueOnce(undefined);
    (persist.setItem as any) = vi.fn().mockResolvedValue(undefined);
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as unknown as RoborockService;
    (platform as any).authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform.startDeviceDiscovery();
    expect(persist.setItem as any).toHaveBeenCalledWith('deviceId', expect.any(String));
  });

  it('should use cached deviceId if present', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.persist.getItem = vi.fn().mockResolvedValueOnce('cached-device-id');
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as any;
    platform.authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform.startDeviceDiscovery();
    expect(platform.persist.setItem).not.toHaveBeenCalledWith('deviceId', expect.any(String));
  });
  it('should use cached deviceId if present (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    const persist = platform.persist;
    (persist.getItem as any) = vi.fn().mockResolvedValueOnce('cached-device-id');
    (persist.setItem as any) = vi.fn();
    platform.roborockService = { listDevices: vi.fn().mockResolvedValue([]) } as unknown as RoborockService;
    (platform as any).authenticate = vi.fn().mockResolvedValue({ shouldContinue: false });
    await platform.startDeviceDiscovery();
    expect(persist.setItem as any).not.toHaveBeenCalledWith('deviceId', expect.any(String));
  });

  it('should log and throw error in authenticateWithPassword if service not initialized', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform.authenticateWithPassword('user', 'pw')).rejects.toThrow('RoborockService is not initialized');
  });
  it('should log and throw error in authenticateWithPassword if service not initialized (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform.authenticateWithPassword('user', 'pw')).rejects.toThrow('RoborockService is not initialized');
  });

  it('should log and throw error in authenticate2FA if service not initialized', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform.authenticate2FA('user', '123456')).rejects.toThrow('RoborockService is not initialized');
  });
  it('should log and throw error in authenticate2FA if service not initialized (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    await expect(platform.authenticate2FA('user', '123456')).rejects.toThrow('RoborockService is not initialized');
  });

  it('should return shouldContinue false if authenticateWithPassword throws', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.roborockService = { loginWithPassword: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    await expect(platform.authenticateWithPassword('user', 'pw')).rejects.toThrow('fail');
  });
  it('should return shouldContinue false if authenticateWithPassword throws (fixed async)', async () => {
    platform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.roborockService = { loginWithPassword: vi.fn().mockRejectedValue(new Error('fail')) } as unknown as RoborockService;
    await expect(platform.authenticateWithPassword('user', 'pw')).rejects.toThrow('fail');
  });

  it('should return shouldContinue false if authenticate2FA throws', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.roborockService = { loginWithVerificationCode: vi.fn().mockRejectedValue(new Error('fail')) } as any;
    platform.persist.getItem = vi.fn().mockResolvedValue(undefined);
    await expect(platform.authenticate2FA('user', '123456')).rejects.toThrow('fail');
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
    platform.isStartPluginCompleted = false;
    const superOnConfigure = vi.spyOn(MatterbridgeDynamicPlatform.prototype, 'onConfigure');
    await platform.onConfigure();
    expect(superOnConfigure).not.toHaveBeenCalled();
    superOnConfigure.mockRestore();
  });

  it('should call super.onConfigure and set interval if isStartPluginCompleted is true', async () => {
    platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    platform.isStartPluginCompleted = true;
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
    expect(platform.isStartPluginCompleted).toBe(false);
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

  describe('authenticate method', () => {
    let testPlatform: TestRoborockMatterbridgePlatform;

    beforeEach(() => {
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    });

    it('should authenticate with VerificationCode method successfully', async () => {
      const configWithVerificationCode = {
        ...config,
        authentication: {
          authenticationMethod: 'VerificationCode' as const,
          verificationCode: '123456',
        },
      };
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, configWithVerificationCode);

      const mockUserData = { uid: 123, token: 'test-token', rruid: 'rr123', region: 'us' };
      testPlatform.authenticate2FA = vi.fn().mockResolvedValue(mockUserData);

      const result = await testPlatform.testAuthenticate('device-id-123');

      expect(result.shouldContinue).toBe(true);
      expect(result.userData).toEqual(mockUserData);
    });

    it('should authenticate with Password method successfully', async () => {
      const configWithPassword = {
        ...config,
        authentication: {
          authenticationMethod: 'Password' as const,
          password: 'test-password',
        },
      };
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, configWithPassword);

      const mockUserData = { uid: 123, token: 'test-token', rruid: 'rr123', region: 'us' };
      testPlatform.authenticateWithPassword = vi.fn().mockResolvedValue(mockUserData);

      const result = await testPlatform.testAuthenticate('device-id-123');

      expect(result.shouldContinue).toBe(true);
      expect(result.userData).toEqual(mockUserData);
    });

    it('should return shouldContinue false when userData is undefined', async () => {
      testPlatform.authenticate2FA = vi.fn().mockResolvedValue(undefined);
      const configWithVerificationCode = {
        ...config,
        authentication: {
          authenticationMethod: 'VerificationCode' as const,
          verificationCode: '',
        },
      };
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, configWithVerificationCode);
      testPlatform.authenticate2FA = vi.fn().mockResolvedValue(undefined);

      const result = await testPlatform.testAuthenticate('device-id-123');

      expect(result.shouldContinue).toBe(false);
    });

    it('should return shouldContinue false when authentication throws', async () => {
      const configWithPassword = {
        ...config,
        authentication: {
          authenticationMethod: 'Password' as const,
          password: 'test-password',
        },
      };
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, configWithPassword);
      testPlatform.authenticateWithPassword = vi.fn().mockRejectedValue(new Error('Auth failed'));

      const result = await testPlatform.testAuthenticate('device-id-123');

      expect(result.shouldContinue).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Authentication failed'));
    });
  });

  describe('authenticate2FA method', () => {
    let testPlatform: TestRoborockMatterbridgePlatform;

    beforeEach(() => {
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    });

    it('should use cached token when available and valid', async () => {
      const savedUserData = { uid: 123, token: 'cached-token', rruid: 'rr123', region: 'us' };
      testPlatform.persist.getItem = vi.fn().mockResolvedValue(savedUserData);
      testPlatform.roborockService = {
        loginWithCachedToken: vi.fn().mockResolvedValue(savedUserData),
      } as any;

      const result = await testPlatform.testAuthenticate2FA('user@test.com', '');

      expect(testPlatform.roborockService?.loginWithCachedToken).toHaveBeenCalledWith('user@test.com', savedUserData);
      expect(result).toEqual(savedUserData);
    });

    it('should request verification code when no code provided and no cached token', async () => {
      testPlatform.persist.getItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.persist.setItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.roborockService = {
        requestVerificationCode: vi.fn().mockResolvedValue(undefined),
      } as any;

      const result = await testPlatform.testAuthenticate2FA('user@test.com', '');

      expect(testPlatform.roborockService?.requestVerificationCode).toHaveBeenCalledWith('user@test.com');
      expect(result).toBeUndefined();
    });

    it('should respect rate limit when requesting verification code', async () => {
      const recentAuthState = {
        email: 'user@test.com',
        codeRequestedAt: Date.now() - 30000, // 30 seconds ago (within rate limit)
      };
      testPlatform.persist.getItem = vi.fn().mockImplementation((key) => {
        if (key === 'authenticateFlowState') return Promise.resolve(recentAuthState);
        return Promise.resolve(undefined);
      });
      testPlatform.roborockService = {
        requestVerificationCode: vi.fn(),
      } as any;

      const result = await testPlatform.testAuthenticate2FA('user@test.com', '');

      expect(testPlatform.roborockService?.requestVerificationCode).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Please wait'));
      expect(result).toBeUndefined();
    });

    it('should login with verification code when code is provided', async () => {
      const mockUserData = { uid: 123, token: 'new-token', rruid: 'rr123', region: 'us' };
      testPlatform.persist.getItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.persist.setItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.persist.removeItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.roborockService = {
        loginWithVerificationCode: vi.fn().mockImplementation(async (_username, _code, callback) => {
          await callback(mockUserData);
          return mockUserData;
        }),
      } as any;

      const result = await testPlatform.testAuthenticate2FA('user@test.com', '123456');

      expect(testPlatform.roborockService?.loginWithVerificationCode).toHaveBeenCalled();
      expect(result).toEqual(mockUserData);
    });

    it('should clear cached token and request new code when cached token is invalid', async () => {
      const savedUserData = { uid: 123, token: 'expired-token', rruid: 'rr123', region: 'us' };
      testPlatform.persist.getItem = vi.fn().mockImplementation((key) => {
        if (key === 'userData') return Promise.resolve(savedUserData);
        return Promise.resolve(undefined);
      });
      testPlatform.persist.removeItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.persist.setItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.roborockService = {
        loginWithCachedToken: vi.fn().mockRejectedValue(new Error('Token expired')),
        requestVerificationCode: vi.fn().mockResolvedValue(undefined),
      } as any;

      const result = await testPlatform.testAuthenticate2FA('user@test.com', '');

      expect(testPlatform.persist.removeItem).toHaveBeenCalledWith('userData');
      expect(testPlatform.roborockService?.requestVerificationCode).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should skip cached token when alwaysExecuteAuthentication is enabled', async () => {
      const configWithAlwaysAuth = {
        ...config,
        enableExperimental: {
          enableExperimentalFeature: true,
          advancedFeature: {
            alwaysExecuteAuthentication: true,
          },
        },
      };
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, configWithAlwaysAuth as any);
      testPlatform.persist.getItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.persist.setItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.roborockService = {
        requestVerificationCode: vi.fn().mockResolvedValue(undefined),
      } as any;
      testPlatform.enableExperimentalFeature = configWithAlwaysAuth.enableExperimental as any;

      const result = await testPlatform.testAuthenticate2FA('user@test.com', '');

      expect(testPlatform.roborockService?.requestVerificationCode).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('authenticateWithPassword method', () => {
    let testPlatform: TestRoborockMatterbridgePlatform;

    beforeEach(() => {
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    });

    it('should authenticate successfully and save userData', async () => {
      const mockUserData = { uid: 123, token: 'test-token', rruid: 'rr123', region: 'us' };
      testPlatform.persist.getItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.persist.setItem = vi.fn().mockResolvedValue(undefined);
      testPlatform.roborockService = {
        loginWithPassword: vi.fn().mockImplementation(async (_username, _password, loadCallback, saveCallback) => {
          await loadCallback();
          await saveCallback(mockUserData);
          return mockUserData;
        }),
      } as any;

      const result = await testPlatform.testAuthenticateWithPassword('user@test.com', 'password123');

      expect(result).toEqual(mockUserData);
      expect(testPlatform.persist.setItem).toHaveBeenCalledWith('userData', mockUserData);
    });

    it('should use saved userData when available', async () => {
      const savedUserData = { uid: 123, token: 'cached-token', rruid: 'rr123', region: 'us' };
      testPlatform.persist.getItem = vi.fn().mockResolvedValue(savedUserData);
      testPlatform.roborockService = {
        loginWithPassword: vi.fn().mockImplementation(async (_username, _password, loadCallback) => {
          const cached = await loadCallback();
          return cached ?? savedUserData;
        }),
      } as any;

      const result = await testPlatform.testAuthenticateWithPassword('user@test.com', 'password123');

      expect(result).toEqual(savedUserData);
    });
  });

  describe('startDeviceDiscovery', () => {
    let testPlatform: TestRoborockMatterbridgePlatform;

    beforeEach(() => {
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    });

    it('should return true when authentication and device listing succeeds', async () => {
      const mockUserData = { uid: 123, token: 'test-token', rruid: 'rr123', region: 'us' };
      const mockDevice = {
        duid: 'test-duid',
        serialNumber: 'SN123',
        name: 'Test Vacuum',
        data: { model: 'roborock.vacuum.a51' },
      };

      testPlatform.persist.getItem = vi.fn().mockResolvedValue('cached-device-id');
      testPlatform.authenticate = vi.fn().mockResolvedValue({ shouldContinue: true, userData: mockUserData });
      testPlatform.roborockService = {
        listDevices: vi.fn().mockResolvedValue([mockDevice]),
        initializeMessageClient: vi.fn().mockResolvedValue(undefined),
      } as any;

      const result = await testPlatform.testStartDeviceDiscovery();

      expect(result).toBe(true);
      expect(testPlatform.devices.size).toBe(1);
    });

    it('should return false when no devices found', async () => {
      const mockUserData = { uid: 123, token: 'test-token', rruid: 'rr123', region: 'us' };

      testPlatform.persist.getItem = vi.fn().mockResolvedValue('cached-device-id');
      testPlatform.authenticate = vi.fn().mockResolvedValue({ shouldContinue: true, userData: mockUserData });
      testPlatform.roborockService = {
        listDevices: vi.fn().mockResolvedValue([]),
      } as any;

      const result = await testPlatform.testStartDeviceDiscovery();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Initializing: No device found');
    });

    it('should filter devices by whitelist', async () => {
      const configWithWhitelist = {
        ...config,
        whiteList: ['Vacuum - duid1'],
      };
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, configWithWhitelist as any);

      const mockUserData = { uid: 123, token: 'test-token', rruid: 'rr123', region: 'us' };
      const mockDevices = [
        { duid: 'duid1', serialNumber: 'SN1', name: 'Vacuum 1', data: { model: 'roborock.vacuum.a51' } },
        { duid: 'duid2', serialNumber: 'SN2', name: 'Vacuum 2', data: { model: 'roborock.vacuum.a51' } },
      ];

      testPlatform.persist.getItem = vi.fn().mockResolvedValue('cached-device-id');
      testPlatform.authenticate = vi.fn().mockResolvedValue({ shouldContinue: true, userData: mockUserData });
      testPlatform.roborockService = {
        listDevices: vi.fn().mockResolvedValue(mockDevices),
        initializeMessageClient: vi.fn().mockResolvedValue(undefined),
      } as any;

      const result = await testPlatform.testStartDeviceDiscovery();

      expect(result).toBe(true);
      expect(testPlatform.devices.size).toBe(1);
      expect(testPlatform.devices.has('SN1')).toBe(true);
    });

    it('should enable experimental clean mode settings when configured', async () => {
      const configWithExperimental = {
        ...config,
        enableExperimental: {
          enableExperimentalFeature: true,
          cleanModeSettings: {
            enableCleanModeMapping: true,
          },
          advancedFeature: {},
        },
      };
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, configWithExperimental as any);

      const mockUserData = { uid: 123, token: 'test-token', rruid: 'rr123', region: 'us' };
      const mockDevice = {
        duid: 'test-duid',
        serialNumber: 'SN123',
        name: 'Test Vacuum',
        data: { model: 'roborock.vacuum.a51' },
      };

      testPlatform.persist.getItem = vi.fn().mockResolvedValue('cached-device-id');
      testPlatform.authenticate = vi.fn().mockResolvedValue({ shouldContinue: true, userData: mockUserData });
      testPlatform.roborockService = {
        listDevices: vi.fn().mockResolvedValue([mockDevice]),
        initializeMessageClient: vi.fn().mockResolvedValue(undefined),
      } as any;

      await testPlatform.testStartDeviceDiscovery();

      expect(testPlatform.cleanModeSettings).toBeDefined();
      expect(mockLogger.notice).toHaveBeenCalledWith(expect.stringContaining('Experimental Feature enabled'));
    });
  });

  describe('onConfigureDevice', () => {
    let testPlatform: TestRoborockMatterbridgePlatform;

    beforeEach(() => {
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    });

    it('should log error when no devices found', async () => {
      testPlatform.platformRunner = {} as any;
      testPlatform.roborockService = {} as any;
      testPlatform.devices = new Map();

      await testPlatform.testOnConfigureDevice();

      expect(mockLogger.error).toHaveBeenCalledWith('Initializing: No supported devices found');
    });

    it('should configure devices and set up notification handler', async () => {
      const mockDevice = {
        duid: 'test-duid',
        serialNumber: 'SN123',
        name: 'Test Vacuum',
        data: { model: 'roborock.vacuum.a51' },
        rrHomeId: 12345,
      };

      testPlatform.devices.set('SN123', mockDevice as any);
      testPlatform.platformRunner = {
        updateRobot: vi.fn(),
        requestHomeData: vi.fn().mockResolvedValue(undefined),
      } as any;
      testPlatform.roborockService = {
        setDeviceNotify: vi.fn(),
        activateDeviceNotify: vi.fn(),
      } as any;
      testPlatform.configureDevice = vi.fn().mockResolvedValue(true);
      testPlatform.robots.set('test-duid', { device: mockDevice } as any);

      await testPlatform.testOnConfigureDevice();

      expect(testPlatform.roborockService?.setDeviceNotify).toHaveBeenCalled();
      expect(testPlatform.roborockService?.activateDeviceNotify).toHaveBeenCalled();
      expect(testPlatform.platformRunner?.requestHomeData).toHaveBeenCalled();
    });

    it('should handle requestHomeData error gracefully', async () => {
      const mockDevice = {
        duid: 'test-duid',
        serialNumber: 'SN123',
        name: 'Test Vacuum',
        data: { model: 'roborock.vacuum.a51' },
        rrHomeId: 12345,
      };

      testPlatform.devices.set('SN123', mockDevice as any);
      testPlatform.platformRunner = {
        updateRobot: vi.fn(),
        requestHomeData: vi.fn().mockRejectedValue(new Error('Network error')),
      } as any;
      testPlatform.roborockService = {
        setDeviceNotify: vi.fn(),
        activateDeviceNotify: vi.fn(),
      } as any;
      testPlatform.configureDevice = vi.fn().mockResolvedValue(true);
      testPlatform.robots.set('test-duid', { device: mockDevice } as any);

      await testPlatform.testOnConfigureDevice();

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('requestHomeData (initial) failed'));
    });
  });

  describe('configureDevice', () => {
    let testPlatform: TestRoborockMatterbridgePlatform;

    beforeEach(() => {
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    });

    it('should return false when local network connection fails', async () => {
      const mockDevice = {
        duid: 'test-duid',
        name: 'Test Vacuum',
        rooms: [],
        data: { model: 'roborock.vacuum.a51' },
      };

      testPlatform.platformRunner = {} as any;
      testPlatform.roborockService = {
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(false),
      } as any;

      const result = await testPlatform.testConfigureDevice(mockDevice);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to connect to local network'));
    });

    it('should fetch map information when rooms are empty', async () => {
      const mockDevice = {
        duid: 'test-duid',
        name: 'Test Vacuum',
        rooms: [] as any[],
        data: { model: 'roborock.vacuum.a51' },
      };

      const mockMapInfo = {
        allRooms: [
          { globalId: 1, displayName: 'Kitchen' },
          { globalId: 2, displayName: 'Bedroom' },
        ],
      };

      testPlatform.platformRunner = {} as any;
      testPlatform.roborockService = {
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
        getMapInformation: vi.fn().mockResolvedValue(mockMapInfo),
        setSupportedAreas: vi.fn(),
        setSupportedAreaIndexMap: vi.fn(),
        setSupportedScenes: vi.fn(),
      } as any;

      // Call the method but expect it to fail validation (we're testing map info fetch)
      // The device validation will fail since we're mocking, but the map info should be fetched
      try {
        await testPlatform.testConfigureDevice(mockDevice);
      } catch {
        // Expected to fail due to missing data
      }

      expect(testPlatform.roborockService?.getMapInformation).toHaveBeenCalledWith('test-duid');
      expect(mockDevice.rooms.length).toBe(2);
    });
  });

  describe('addDevice', () => {
    let testPlatform: TestRoborockMatterbridgePlatform;

    beforeEach(() => {
      testPlatform = new TestRoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
    });

    it('should return undefined when device validation fails', async () => {
      const mockDevice = {
        serialNumber: 'SN123',
        deviceName: 'Test Vacuum',
        device: { data: { firmwareVersion: '1.0.0' } },
        getClusterServerOptions: vi.fn().mockReturnValue(null),
      };

      testPlatform.validateDevice = vi.fn().mockReturnValue(false);

      const result = await testPlatform.testAddDevice(mockDevice);

      expect(result).toBeUndefined();
    });

    it('should set version info and register device when valid', async () => {
      const mockDevice = {
        serialNumber: 'SN123',
        deviceName: 'Test Vacuum',
        device: { data: { firmwareVersion: '1.0.0' }, fv: '1.0.0' },
        getClusterServerOptions: vi.fn().mockReturnValue({ softwareVersion: 1 }),
        deviceTypes: new Map(),
        mode: 'childbridge',
      };

      testPlatform.validateDevice = vi.fn().mockReturnValue(true);
      testPlatform.setSelectDevice = vi.fn();
      testPlatform.registerDevice = vi.fn().mockResolvedValue(undefined);
      testPlatform.version = '1.0.0';

      const result = await testPlatform.testAddDevice(mockDevice);

      expect(result).toBeDefined();
      expect(testPlatform.registerDevice).toHaveBeenCalledWith(mockDevice);
      expect(testPlatform.robots.has('SN123')).toBe(true);
    });
  });

  describe('onConfigure interval error handling', () => {
    it('should log error when requestHomeData fails in interval', async () => {
      vi.useFakeTimers();

      platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
      platform.isStartPluginCompleted = true;
      platform.platformRunner = {
        requestHomeData: vi.fn().mockRejectedValue(new Error('Interval error')),
      } as any;

      const superOnConfigure = vi.spyOn(MatterbridgeDynamicPlatform.prototype, 'onConfigure').mockResolvedValue(undefined);

      await platform.onConfigure();

      // Fast-forward past the interval
      await vi.advanceTimersByTimeAsync(65000);

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('requestHomeData (interval) failed'));

      if (platform.rvcInterval) {
        clearInterval(platform.rvcInterval);
      }
      superOnConfigure.mockRestore();
      vi.useRealTimers();
    });
  });

  describe('onStart success path', () => {
    it('should complete startup successfully when all steps pass', async () => {
      platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);

      Object.defineProperty(platform, 'ready', { value: Promise.resolve(), writable: true });
      platform.clearSelect = vi.fn().mockResolvedValue(undefined);
      platform.persist.init = vi.fn().mockResolvedValue(undefined);
      platform.startDeviceDiscovery = vi.fn().mockResolvedValue(true);
      platform.onConfigureDevice = vi.fn().mockResolvedValue(undefined);

      await platform.onStart('test reason');

      expect(platform.isStartPluginCompleted).toBe(true);
      expect(mockLogger.notice).toHaveBeenCalledWith('onStart finished');
    });

    it('should set isStartPluginCompleted to false when device discovery fails', async () => {
      platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);

      Object.defineProperty(platform, 'ready', { value: Promise.resolve(), writable: true });
      platform.clearSelect = vi.fn().mockResolvedValue(undefined);
      platform.persist.init = vi.fn().mockResolvedValue(undefined);
      platform.startDeviceDiscovery = vi.fn().mockResolvedValue(false);

      await platform.onStart('test reason');

      expect(platform.isStartPluginCompleted).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Device discovery failed to start.');
    });
  });
});
