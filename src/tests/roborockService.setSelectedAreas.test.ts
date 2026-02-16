import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockService } from '../services/roborockService.js';
import { makeLogger, createMockLocalStorage } from './testUtils.js';
import { localStorageMock } from './testData/localStorageMock.js';
import { PlatformConfigManager as PlatformConfigManagerStatic } from '../platform/platformConfigManager.js';
import type { RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';
import ClientManager from '../services/clientManager.js';
import { RoomIndexMap } from '../core/application/models/index.js';

describe('RoborockService - startClean', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let clientManager: ClientManager;

  beforeEach(async () => {
    mockLogger = makeLogger();

    clientManager = {} as ClientManager;

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

    roborockService = new RoborockService(
      {
        authenticateApiFactory: vi.fn(),
        iotApiFactory: vi.fn(),
        baseUrl: 'https://api.roborock.com',
        refreshInterval: 60000,
        persist: persist,
        configManager: configManager,
        toastMessage: vi.fn(),
      },
      mockLogger,
      configManager,
    );
  });

  it('setSelectedAreas should set selected areas', () => {
    roborockService.setSupportedAreaIndexMap(
      'duid',
      new RoomIndexMap(
        new Map([
          [100, { roomId: 1, mapId: 0 }],
          [101, { roomId: 2, mapId: 0 }],
          [102, { roomId: 3, mapId: 0 }],
          [103, { roomId: 4, mapId: 0 }],
          [104, { roomId: 1, mapId: 1 }],
          [105, { roomId: 2, mapId: 1 }],
          [106, { roomId: 3, mapId: 1 }],
          [107, { roomId: 4, mapId: 1 }],
          [108, { roomId: 5, mapId: 1 }],
        ]),
      ),
    );
    roborockService.setSelectedAreas('duid', [106, 108]);

    // Use public API to verify selected areas instead of accessing private state
    expect(roborockService.getSelectedAreas('duid')).toEqual([3, 5]);
    expect(mockLogger.debug).toHaveBeenCalledWith('AreaManagementService - setSelectedAreas - roomIds', [3, 5]);
  });
});
