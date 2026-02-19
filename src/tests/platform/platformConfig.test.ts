import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import type { AnsiLogger } from 'matterbridge/logger';
import { asPartial, asType } from '../helpers/testUtils.js';
import { AuthenticationConfiguration, createDefaultAdvancedFeature, PluginConfiguration, RoborockPluginPlatformConfig } from '../../model/RoborockPluginPlatformConfig.js';

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

function createMockConfig(overrides: Partial<RoborockPluginPlatformConfig> = {}): RoborockPluginPlatformConfig {
  return {
    authentication: {
      username: 'testuser',
      region: 'US',
      forceAuthentication: false,
      authenticationMethod: 'Password',
      password: 'pass',
    },
    pluginConfiguration: {
      whiteList: [],
      enableServerMode: false,
      enableMultipleMap: false,
      sanitizeSensitiveLogs: true,
      refreshInterval: 60,
      debug: false,
      unregisterOnShutdown: false,
    } satisfies PluginConfiguration,
    advancedFeature: createDefaultAdvancedFeature(),
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
      config.authentication.username = '';
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.validateConfig()).toBe(false);
    });
  });

  describe('validateAuthentication', () => {
    it('should return true for valid password auth', () => {
      expect(manager.validateAuthentication()).toBe(true);
    });
    it('should return false and log error if authentication is missing', () => {
      config = asPartial<RoborockPluginPlatformConfig>({ ...config, authentication: undefined });
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.validateAuthentication()).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Platform config validation failed: "authentication" object is required');
    });
    it('should return false and log info if password is missing', () => {
      config.authentication = asPartial<AuthenticationConfiguration>({ authenticationMethod: 'Password' });
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.validateAuthentication()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Platform config validation: password not provided');
    });
    it('should return false and log info if verificationCode is missing for VerificationCode method', () => {
      config.authentication = asPartial<AuthenticationConfiguration>({ authenticationMethod: 'VerificationCode' });
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.validateAuthentication()).toBe(false);
      expect(mockLogger.info).toHaveBeenCalledWith('Platform config validation: verification code not provided');
    });
    it('should return true if verificationCode is present for VerificationCode method', () => {
      config.authentication = asPartial<AuthenticationConfiguration>({ authenticationMethod: 'VerificationCode', verificationCode: '1234' });
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.validateAuthentication()).toBe(true);
    });
  });

  describe('getters', () => {
    it('should return username, password, verificationCode, authenticationMethod', () => {
      expect(manager.username).toBe('testuser');
      expect(manager.password).toBe('pass');
      expect(manager.verificationCode).toBe('');
      expect(manager.authenticationMethod).toBe('Password');
    });
    it('should return region in uppercase or default to US', () => {
      expect(manager.region).toBe('US');
      config.authentication.region = 'EU';
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.region).toBe('EU');
    });
    it('should return refreshInterval or default', () => {
      expect(manager.refreshInterval).toBe(60);
      config.pluginConfiguration = asPartial<PluginConfiguration>({ ...config.pluginConfiguration, refreshInterval: undefined });
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.refreshInterval).toBeDefined();
    });
    it('should return unregisterOnShutdown, rawConfig', () => {
      expect(manager.unregisterOnShutdown).toBe(false);
      expect(manager.rawConfig).toBe(config);
    });
  });

  describe('experimental features', () => {
    it('should return experimental feature flags and settings', () => {
      expect(manager.isAdvancedFeatureEnabled).toBe(manager.rawConfig.advancedFeature.enableAdvancedFeature);
      expect(manager.advancedFeatureSettings).toBe(manager.rawConfig.advancedFeature.settings);
    });
    it('should return cleanModeSettings in all cases when enabled', () => {
      expect(manager.cleanModeSettings).not.toBeUndefined();
      config.advancedFeature.enableAdvancedFeature = true;
      config.advancedFeature.settings = {
        clearStorageOnStartup: false,
        showRoutinesAsRoom: false,
        forceRunAtDefault: false,
        includeDockStationStatus: false,
        includeVacuumErrorStatus: false,
        enableCleanModeMapping: true,
        useVacationModeToSendVacuumToDock: false,
        cleanModeSettings: createDefaultAdvancedFeature().settings.cleanModeSettings,
        overrideMatterConfiguration: false,
        matterOverrideSettings: {
          matterVendorName: 'xxx',
          matterVendorId: 123,
          matterProductName: 'yy',
          matterProductId: 456,
        },
      };
      config.advancedFeature.enableAdvancedFeature = true;
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.cleanModeSettings).toBeDefined();
    });
    it('should return correct advanced feature flags', () => {
      config.advancedFeature = {
        enableAdvancedFeature: true,
        settings: {
          clearStorageOnStartup: true,
          showRoutinesAsRoom: true,
          forceRunAtDefault: true,
          includeDockStationStatus: true,
          includeVacuumErrorStatus: false,
          enableCleanModeMapping: false,
          useVacationModeToSendVacuumToDock: false,
          cleanModeSettings: createDefaultAdvancedFeature().settings.cleanModeSettings,
          overrideMatterConfiguration: false,
          matterOverrideSettings: {
            matterVendorName: 'xxx',
            matterVendorId: 123,
            matterProductName: 'yy',
            matterProductId: 456,
          },
        },
      };
      config.pluginConfiguration.enableServerMode = true;
      config.pluginConfiguration.enableMultipleMap = false;
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.isServerModeEnabled).toBe(true);
      expect(manager.isMultipleMapEnabled).toBe(false);
      expect(manager.showRoutinesAsRoom).toBe(true);
      expect(manager.forceRunAtDefault).toBe(true);
      expect(manager.alwaysExecuteAuthentication).toBe(false);
      expect(manager.includeDockStationStatus).toBe(true);
    });

    it('should return includeVacuumErrorStatus from settings when advanced feature is enabled', () => {
      config.advancedFeature = {
        enableAdvancedFeature: true,
        settings: { ...createDefaultAdvancedFeature().settings, includeVacuumErrorStatus: true },
      };
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.includeVacuumErrorStatus).toBe(true);
    });

    it('should return false for includeVacuumErrorStatus when advanced feature is disabled', () => {
      config.advancedFeature = {
        enableAdvancedFeature: false,
        settings: { ...createDefaultAdvancedFeature().settings, includeVacuumErrorStatus: true },
      };
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.includeVacuumErrorStatus).toBe(false);
    });
  });

  describe('device filtering', () => {
    it('should allow device if whitelist is empty', () => {
      expect(manager.isDeviceAllowed({ duid: 'abc', deviceName: 'dev1' })).toBe(true);
    });
    it('should allow device if whitelisted', () => {
      config.pluginConfiguration.whiteList = ['dev1-abc'];
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.isDeviceAllowed({ duid: 'abc', deviceName: 'dev1' })).toBe(true);
    });
    it('should deny device if not in whitelist', () => {
      config.pluginConfiguration.whiteList = ['dev2-abc'];
      manager = PlatformConfigManager.create(config, mockLogger);
      expect(manager.isDeviceAllowed({ duid: 'abcd', deviceName: 'dev1' })).toBe(false);
    });
    it('should extract duid from whitelist entry', () => {
      expect(manager.extractDuidFromWhitelistEntry('name - duid123')).toBe('duid123');
      expect(manager.extractDuidFromWhitelistEntry('single')).toBeUndefined();
    });
    it('should match list entry by duid or name', () => {
      expect(manager['matchesListEntry']('abc', 'abc', 'dev1')).toBe(true);
      expect(manager['matchesListEntry']('dev1', 'abc', 'dev1')).toBe(true);
      expect(manager['matchesListEntry']('other', 'abc', 'dev1')).toBe(false);
    });
    it('should extract duid from device name', () => {
      expect(manager['extractDuidFromDeviceName']('name - duid123')).toBe('duid123');
      expect(manager['extractDuidFromDeviceName']('single')).toBeUndefined();
    });
  });
});
