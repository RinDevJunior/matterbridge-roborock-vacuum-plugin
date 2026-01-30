import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlatformConfigManager, RoborockPluginPlatformConfig } from '../../platform/platformConfig.js';
import type { AnsiLogger } from 'matterbridge/logger';
import { createDefaultExperimentalFeatureSetting } from '../../model/ExperimentalFeatureSetting.js';

function createMockLogger(): AnsiLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    log: vi.fn(),
  } as unknown as AnsiLogger;
}

function createMockConfig(overrides: Partial<RoborockPluginPlatformConfig> = {}): RoborockPluginPlatformConfig {
  return {
    username: 'user@example.com',
    whiteList: [],
    blackList: [],
    useInterval: true,
    refreshInterval: 60,
    debug: false,
    authentication: {
      authenticationMethod: 'Password',
      password: 'pass',
    },
    enableExperimental: createDefaultExperimentalFeatureSetting(),
    ...overrides,
  } as RoborockPluginPlatformConfig;
}

describe('PlatformConfigManager', () => {
  let mockLogger: AnsiLogger;
  let config: RoborockPluginPlatformConfig;
  let manager: PlatformConfigManager;

  beforeEach(() => {
    mockLogger = createMockLogger();
    config = createMockConfig();
    manager = PlatformConfigManager.create(config, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('validateConfig', () => {
    it('should return true for valid config', () => {
      expect(manager.validateConfig()).toBe(true);
    });
    it('should return false and log error if username is missing', () => {
      config.username = '';
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.validateConfig()).toBe(false);
    });
  });

  describe('validateAuthentication', () => {
    it('should return true for valid password auth', () => {
      expect(manager.validateAuthentication()).toBe(true);
    });
    it('should return false and log error if authentication is missing', () => {
      config.authentication = undefined as any;
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.validateAuthentication()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Platform config validation failed: "authentication" object is required');
    });
    it('should return false and log info if password is missing', () => {
      config.authentication = { authenticationMethod: 'Password' } as any;
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.validateAuthentication()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Platform config validation: password not provided');
    });
    it('should return false and log info if verificationCode is missing for VerificationCode method', () => {
      config.authentication = { authenticationMethod: 'VerificationCode' } as any;
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.validateAuthentication()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Platform config validation: verification code not provided');
    });
    it('should return true if verificationCode is present for VerificationCode method', () => {
      config.authentication = { authenticationMethod: 'VerificationCode', verificationCode: '1234' } as any;
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.validateAuthentication()).toBe(true);
    });
  });

  describe('getters', () => {
    it('should return username, password, verificationCode, authenticationMethod', () => {
      expect(manager.username).toBe('user@example.com');
      expect(manager.password).toBe('pass');
      expect(manager.verificationCode).toBe('');
      expect(manager.authenticationMethod).toBe('Password');
    });
    it('should return region in uppercase or default to US', () => {
      expect(manager.region).toBe('US');
      config.region = 'eu';
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.region).toBe('EU');
    });
    it('should return refreshInterval or default', () => {
      expect(manager.refreshInterval).toBe(60);
      config.refreshInterval = undefined as any;
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.refreshInterval).toBeDefined();
    });
    it('should return whiteList, blackList, unregisterOnShutdown, rawConfig', () => {
      expect(manager.whiteList).toEqual([]);
      expect(manager.blackList).toEqual([]);
      expect(manager.unregisterOnShutdown).toBe(false);
      expect(manager.rawConfig).toBe(config);
    });
  });

  describe('experimental features', () => {
    it('should return experimental feature flags and settings', () => {
      expect(manager.isExperimentalEnabled).toBe(manager.experimentalSettings.enableExperimentalFeature);
      expect(manager.advancedFeatures).toBe(manager.experimentalSettings.advancedFeature);
    });
    it('should return cleanModeSettings only if enabled', () => {
      expect(manager.cleanModeSettings).toBeUndefined();
      config.enableExperimental.cleanModeSettings = { enableCleanModeMapping: true } as any;
      config.enableExperimental.enableExperimentalFeature = true;
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.cleanModeSettings).toBeDefined();
    });
    it('should return correct advanced feature flags', () => {
      config.enableExperimental.advancedFeature = {
        enableServerMode: true,
        enableMultipleMap: true,
        showRoutinesAsRoom: true,
        forceRunAtDefault: true,
        alwaysExecuteAuthentication: false,
        includeDockStationStatus: true,
      } as any;
      config.enableServerMode = true;
      config.enableExperimental.enableExperimentalFeature = true;
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.isServerModeEnabled).toBe(true);
      // Multiple map is always false by constructor override
      expect(manager.isMultipleMapEnabled).toBe(false);
      expect(manager.showRoutinesAsRoom).toBe(true);
      expect(manager.forceRunAtDefault).toBe(true);
      expect(manager.alwaysExecuteAuthentication).toBe(false);
      expect(manager.includeDockStationStatus).toBe(true);
    });
  });

  describe('device filtering', () => {
    it('should allow device if not blacklisted and whitelist is empty', () => {
      expect(manager.isDeviceAllowed({ duid: 'abc', deviceName: 'dev1' })).toBe(true);
    });
    it('should deny device if blacklisted', () => {
      config.blackList = ['abc'];
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.isDeviceAllowed({ duid: 'abc', deviceName: 'dev1' })).toBe(false);
    });
    it('should allow device if whitelisted', () => {
      config.whiteList = ['abc'];
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.isDeviceAllowed({ duid: 'abc', deviceName: 'dev1' })).toBe(true);
    });
    it('should deny device if not in whitelist', () => {
      config.whiteList = ['other'];
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.isDeviceAllowed({ duid: 'abc', deviceName: 'dev1' })).toBe(false);
    });
    it('should extract duid from whitelist entry', () => {
      expect(manager.extractDuidFromWhitelistEntry('name - duid123')).toBe('duid123');
      expect(manager.extractDuidFromWhitelistEntry('single')).toBeUndefined();
    });
    it('should match list entry by duid or name', () => {
      expect((manager as any).matchesListEntry('abc', 'abc', 'dev1')).toBe(true);
      expect((manager as any).matchesListEntry('dev1', 'abc', 'dev1')).toBe(true);
      expect((manager as any).matchesListEntry('other', 'abc', 'dev1')).toBe(false);
    });
    it('should extract duid from device name', () => {
      expect((manager as any).extractDuidFromDeviceName('name - duid123')).toBe('duid123');
      expect((manager as any).extractDuidFromDeviceName('single')).toBeUndefined();
    });
  });
});
