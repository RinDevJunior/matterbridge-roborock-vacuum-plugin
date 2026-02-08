import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoborockMatterbridgePlatform } from '../module.js';
import { LogLevel } from 'matterbridge/logger';
import type { RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';
import { createMockLogger, createMockMatterbridge, asPartial } from './helpers/testUtils.js';
import type { PlatformMatterbridge } from 'matterbridge';

vi.mock('../platform/platformLifecycle.js');
vi.mock('../services/roborockService.js');
vi.mock('../types/roborockVacuumCleaner.js');
vi.mock('node-persist');

function createMockConfig(overrides: Partial<RoborockPluginPlatformConfig> = {}): RoborockPluginPlatformConfig {
  return asPartial<RoborockPluginPlatformConfig>({
    name: 'Test Platform',
    type: 'DynamicPlatform',
    authentication: {
      username: 'test@example.com',
      region: 'US',
      forceAuthentication: false,
      authenticationMethod: 'VerificationCode',
    },
    pluginConfiguration: {
      whiteList: [],
      enableServerMode: false,
      enableMultipleMap: false,
      sanitizeSensitiveLogs: false,
      refreshInterval: 30,
      debug: false,
      unregisterOnShutdown: false,
    },
    advancedFeature: {
      enableAdvancedFeature: false,
      settings: {
        showRoutinesAsRoom: false,
        includeDockStationStatus: false,
        forceRunAtDefault: false,
        useVacationModeToSendVacuumToDock: false,
        enableCleanModeMapping: false,
        cleanModeSettings: {
          vacuuming: { fanMode: 'Balanced', mopRouteMode: 'Standard' },
          mopping: { waterFlowMode: 'Medium', mopRouteMode: 'Standard', distanceOff: 25 },
          vacmop: { fanMode: 'Balanced', waterFlowMode: 'Medium', mopRouteMode: 'Standard', distanceOff: 25 },
        },
      },
    },
    ...overrides,
  });
}

describe('RoborockMatterbridgePlatform', () => {
  let mockMatterbridge: PlatformMatterbridge;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockConfig: RoborockPluginPlatformConfig;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockMatterbridge = createMockMatterbridge();
    mockConfig = createMockConfig();
  });

  describe('constructor', () => {
    it('should set debug log level when debug is enabled', () => {
      const debugConfig = createMockConfig({
        pluginConfiguration: {
          ...mockConfig.pluginConfiguration,
          debug: true,
        },
      });
      const validMatterbridge = createMockMatterbridge({});

      const platform = new RoborockMatterbridgePlatform(validMatterbridge, mockLogger, debugConfig);
      platform.verifyMatterbridgeVersion = vi.fn().mockReturnValue(true);

      expect(platform.log.logLevel).toBe(LogLevel.DEBUG);
    });
  });

  describe('lifecycle methods', () => {
    it('should delegate onStart to lifecycle', async () => {
      const validMatterbridge = createMockMatterbridge({});
      const platform = new RoborockMatterbridgePlatform(validMatterbridge, mockLogger, mockConfig);
      platform.verifyMatterbridgeVersion = vi.fn().mockReturnValue(true);

      platform.lifecycle.onStart = vi.fn().mockResolvedValue(undefined);
      await platform.onStart('test reason');

      expect(platform.lifecycle.onStart).toHaveBeenCalledWith('test reason');
    });

    it('should delegate onConfigure to lifecycle', async () => {
      const validMatterbridge = createMockMatterbridge({});
      const platform = new RoborockMatterbridgePlatform(validMatterbridge, mockLogger, mockConfig);
      platform.verifyMatterbridgeVersion = vi.fn().mockReturnValue(true);

      platform.lifecycle.onConfigure = vi.fn().mockResolvedValue(undefined);
      await platform.onConfigure();

      expect(platform.lifecycle.onConfigure).toHaveBeenCalled();
    });

    it('should change logger level when onChangeLoggerLevel is called', async () => {
      const validMatterbridge = createMockMatterbridge({});
      const platform = new RoborockMatterbridgePlatform(validMatterbridge, mockLogger, mockConfig);
      platform.verifyMatterbridgeVersion = vi.fn().mockReturnValue(true);

      await platform.onChangeLoggerLevel(LogLevel.ERROR);

      expect(platform.log.logLevel).toBe(LogLevel.ERROR);
    });
  });
});
