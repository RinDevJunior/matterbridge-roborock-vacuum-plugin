import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoborockService } from '../../../services/roborockService.js';
import type { RoborockPluginPlatformConfig } from '../../../model/RoborockPluginPlatformConfig.js';
import type { AnsiLogger } from 'matterbridge/logger';
import { makeLogger, createMockLocalStorage } from '../../testUtils.js';
import { localStorageMock } from '../../testData/localStorageMock.js';
import { PlatformConfigManager as PlatformConfigManagerStatic } from '../../../platform/platformConfigManager.js';

describe('RoborockService - Authentication', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockContainer: any;
  let mockAuthCoordinator: any;

  beforeEach(async () => {
    mockLogger = makeLogger();

    mockAuthCoordinator = {
      authenticate: vi.fn(),
    };

    mockContainer = {
      getAuthenticationCoordinator: vi.fn(() => mockAuthCoordinator),
      getDeviceManagementService: vi.fn(() => ({})),
      getAreaManagementService: vi.fn(() => ({})),
      getMessageRoutingService: vi.fn(() => ({})),
      getPollingService: vi.fn(() => ({})),
      getConnectionService: vi.fn(() => ({})),
      setUserData: vi.fn(),
    };

    const persist = createMockLocalStorage();

    const PlatformConfigManager = PlatformConfigManagerStatic;
    const config = {
      authentication: {
        username: 'test@example.com',
        region: 'US',
        forceAuthentication: false,
        authenticationMethod: 'Password',
        password: 'password123',
      },
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
          includeVacuumErrorStatus: false,
          forceRunAtDefault: false,
          useVacationModeToSendVacuumToDock: false,
          enableCleanModeMapping: false,
          cleanModeSettings: {
            vacuuming: { fanMode: 'Balanced', mopRouteMode: 'Standard' },
            mopping: { waterFlowMode: 'Medium', mopRouteMode: 'Standard', distanceOff: 25 },
            vacmop: { fanMode: 'Balanced', waterFlowMode: 'Medium', mopRouteMode: 'Standard', distanceOff: 25 },
          },
          overrideMatterConfiguration: false,
          matterOverrideSettings: {
            matterVendorName: 'xxx',
            matterVendorId: 123,
            matterProductName: 'yy',
            matterProductId: 456,
          },
        },
      },
    } as Partial<RoborockPluginPlatformConfig> as RoborockPluginPlatformConfig;
    const mockConfigManager = PlatformConfigManager.create(config, mockLogger as AnsiLogger);

    roborockService = new RoborockService(
      {
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: persist,
        configManager: mockConfigManager,
        container: mockContainer,
        toastMessage: vi.fn(),
      },
      mockLogger,
      mockConfigManager,
    );
  });

  it('should return success when authentication succeeds', async () => {
    const mockUserData = { username: 'test@example.com', nickname: 'Test' };
    mockAuthCoordinator.authenticate.mockResolvedValue(mockUserData);

    const result = await roborockService.authenticate();

    expect(result.userData).toEqual(mockUserData);
    expect(result.shouldContinue).toBe(true);
    expect(result.isSuccess).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Authentication successful'));
  });

  it('should call logger.error and return failure when authentication throws', async () => {
    mockAuthCoordinator.authenticate.mockRejectedValue(new Error('auth failed'));

    const result = await roborockService.authenticate();

    expect(result.userData).toBeUndefined();
    expect(result.shouldContinue).toBe(false);
    expect(result.isSuccess).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Authentication failed: auth failed'));
  });
});
