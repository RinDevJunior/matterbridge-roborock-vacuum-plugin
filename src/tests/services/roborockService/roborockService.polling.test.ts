import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoborockService } from '../../../services/roborockService.js';
import { Device } from '../../../roborockCommunication/models/index.js';
import { localStorageMock } from '../../testData/localStorageMock.js';
import { createMockLocalStorage, createMockLogger } from '../../testUtils.js';
import { PlatformConfigManager as PlatformConfigManagerStatic } from '../../../platform/platformConfig.js';
import type { RoborockPluginPlatformConfig } from '../../../model/RoborockPluginPlatformConfig.js';
import type { AnsiLogger } from 'matterbridge/logger';

describe('RoborockService - Polling', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;

  beforeEach(async () => {
    mockLogger = createMockLogger();

    // Use localStorage mock for tests
    const persist = createMockLocalStorage();

    // Create a minimal valid platform config manager for tests
    const PlatformConfigManager = PlatformConfigManagerStatic;
    const config = {
      authentication: { username: 'test', region: 'US', forceAuthentication: false, authenticationMethod: 'Password', password: '' },
      pluginConfiguration: {
        whiteList: [],
        enableServerMode: false,
        enableMultipleMap: false,
        sanitizeSensitiveLogs: false,
        refreshInterval: 10,
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
    } as Partial<RoborockPluginPlatformConfig> as RoborockPluginPlatformConfig;
    const configManager = PlatformConfigManager.create(config, mockLogger as AnsiLogger);

    roborockService = new RoborockService(
      {
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: persist,
        configManager: configManager,
      },
      mockLogger,
      configManager,
    );
  });

  it('activateDeviceNotify delegates to device service', () => {
    const device: Device = { duid: 'test-duid' } as Device;

    // Test that method exists and doesn't throw with basic call
    expect(() => {
      roborockService.activateDeviceNotify(device);
    }).not.toThrow();
  });
});
