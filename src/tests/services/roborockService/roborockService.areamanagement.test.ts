import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoborockService } from '../../../services/roborockService.js';
import { RoomIndexMap } from '../../../core/application/models/index.js';
import { createMockIotApi, createMockAuthApi, createMockLocalStorage, createMockLogger } from '../../testUtils.js';
import { PlatformConfigManager as PlatformConfigManagerStatic } from '../../../platform/platformConfigManager.js';
import type { AnsiLogger } from 'matterbridge/logger';
import type { RoborockPluginPlatformConfig } from '../../../model/RoborockPluginPlatformConfig.js';

describe('RoborockService - Area Management', () => {
  let roborockService: RoborockService;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockLogger = createMockLogger();

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

    roborockService = new RoborockService(
      {
        authenticateApiFactory: () => createMockAuthApi(),
        iotApiFactory: () => createMockIotApi(),
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: createMockLocalStorage(),
        configManager: configManager,
      },
      mockLogger,
      configManager,
    );

    roborockService.setSupportedAreaIndexMap(
      'duid-123',
      new RoomIndexMap(
        new Map([
          [1, { roomId: 1, mapId: 1 }],
          [2, { roomId: 2, mapId: 2 }],
        ]),
      ),
    );
  });

  it('should set selected areas', () => {
    roborockService.setSelectedAreas('duid-123', [1, 2]);
    expect(roborockService.getSelectedAreas('duid-123')).toEqual([1, 2]);
  });

  it('should clear selected areas', () => {
    roborockService.setSelectedAreas('duid-123', []);
    expect(roborockService.getSelectedAreas('duid-123')).toEqual([]);
  });

  it('should filter out invalid areas', () => {
    roborockService.setSelectedAreas('duid-123', [7, 8]);
    expect(roborockService.getSelectedAreas('duid-123')).toEqual([]);
  });
});
