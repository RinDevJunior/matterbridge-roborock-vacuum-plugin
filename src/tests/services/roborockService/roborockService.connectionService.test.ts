import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoborockService } from '../../../services/roborockService.js';
import { makeLogger } from '../../testUtils.js';
import { createMockLocalStorage } from '../../testUtils.js';
import type { RoborockPluginPlatformConfig } from '../../../model/RoborockPluginPlatformConfig.js';
import type { AnsiLogger } from 'matterbridge/logger';
import { PlatformConfigManager as PlatformConfigManagerStatic } from '../../../platform/platformConfigManager.js';
import { makeDeviceFixture } from '../../helpers/fixtures.js';

describe('initializeMessageClientForLocal', () => {
  let service: RoborockService;
  let mockLogger: AnsiLogger;
  let mockDevice: any;

  beforeEach(async () => {
    mockLogger = makeLogger();
    mockDevice = makeDeviceFixture({ duid: 'd1', pv: 'pv', localKey: 'lk' });

    const persist = createMockLocalStorage();

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
          clearStorageOnStartup: false,
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

    service = new RoborockService(
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

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false if messageClient is not initialized', async () => {
    // Without message client setup, should throw error
    await expect(service.initializeMessageClientForLocal(mockDevice)).rejects.toThrow('Message client not initialized in ConnectionService');
  });
});
