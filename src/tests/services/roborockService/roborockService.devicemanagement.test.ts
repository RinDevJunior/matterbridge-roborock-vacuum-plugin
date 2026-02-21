import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockService } from '../../../services/roborockService.js';
import { ServiceContainer } from '../../../services/serviceContainer.js';
import { makeLogger, createMockLocalStorage, asPartial, asType } from '../../testUtils.js';
import { localStorageMock } from '../../testData/localStorageMock.js';
import { PlatformConfigManager as PlatformConfigManagerStatic } from '../../../platform/platformConfigManager.js';
import type { RoborockPluginPlatformConfig } from '../../../model/RoborockPluginPlatformConfig.js';
import { RoborockAuthenticateApi } from '../../../roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from '../../../roborockCommunication/api/iotClient.js';
import { Device, DeviceInformation, DeviceSpecs } from '../../../roborockCommunication/models/device.js';

describe('RoborockService - listDevices', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;

  beforeEach(async () => {
    mockLogger = makeLogger();

    const persist = createMockLocalStorage();

    const PlatformConfigManager = PlatformConfigManagerStatic;
    const config = {
      name: 'test',
      type: 'test',
      version: '1.0',
      debug: false,
      unregisterOnShutdown: false,
      authentication: {
        username: 'test',
        region: 'US',
        forceAuthentication: false,
        authenticationMethod: 'Password',
        password: '',
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
    } as RoborockPluginPlatformConfig;
    Object.assign(config, { name: 'test', type: 'test', version: '1.0', debug: false, unregisterOnShutdown: false });
    const configManager = PlatformConfigManager.create(
      Object.assign({ name: 'test', type: 'test', version: '1.0', debug: false, unregisterOnShutdown: false }, config),
      mockLogger as AnsiLogger,
    );

    roborockService = new RoborockService(
      {
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: persist,
        configManager: configManager,
        toastMessage: vi.fn(),
      },
      mockLogger,
      configManager,
    );
  });

  it('should throw if not authenticated', async () => {
    await expect(roborockService.listDevices()).rejects.toThrow();
  });

  it('should throw if homeDetails is missing', async () => {
    const mockDeviceService = {
      iotApi: {},
      userdata: {},
      listDevices: vi.fn().mockRejectedValue(new Error('No home found for user')),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    await expect(roborockService.listDevices()).rejects.toThrow('No home found for user');
  });

  it('should return empty array if homeData is missing', async () => {
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue([]),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result).toEqual([]);
  });

  it('should return devices with correct mapping', async () => {
    const mockDevices = [
      { duid: '1', rrHomeId: 123, rooms: [], localKey: 'lk', pv: 'pv', sn: 'sn', scenes: [], data: {}, store: {} },
    ];
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue(mockDevices),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result).toEqual(mockDevices);
  });

  it('should throw if getHomev3 fails when v3 API is needed', async () => {
    const mockDeviceService = {
      listDevices: vi.fn().mockRejectedValue(new Error('getHomev3 failed')),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    await expect(roborockService.listDevices()).rejects.toThrow('getHomev3 failed');
  });

  it('should merge v3 devices and receivedDevices if v3 API is needed', async () => {
    const mergedDevices = [
      { duid: '1', rrHomeId: 123 },
      { duid: '2', rrHomeId: 123 },
    ];
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue(mergedDevices),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result).toEqual(mergedDevices);
  });

  it('should fallback batteryLevel to 100 if not present', async () => {
    const device = {
      duid: '1',
      specs: {},
      store: {},
      rrHomeId: 123,
      rooms: [],
      localKey: '',
      pv: '',
      sn: '',
      scenes: [],
      batteryLevel: undefined,
    };
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue([{ ...device, specs: { batteryLevel: undefined } }]),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result[0].specs.batteryLevel ?? 100).toBe(100);
  });

  it('should filter scenes correctly for devices', async () => {
    const scenes = [{ param: '{"action":{"items":[{"entityId":"1"}]}}' }];
    const device = { duid: '1', specs: {}, store: {}, rrHomeId: 123, rooms: [], localKey: '', pv: '', sn: '', scenes };
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue([device]),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result[0].scenes).toEqual(scenes);
  });

  it('should handle rooms fallback from v2 and v3 APIs', async () => {
    const device = asPartial<Device>({
      duid: '1',
      specs: asPartial<DeviceSpecs>({}),
      store: asPartial<DeviceInformation>({
        homeData: {
          id: 123,
          name: 'Test Home',
          products: [],
          devices: [],
          receivedDevices: [],
          rooms: [{ id: 1, name: 'Living Room' }],
        },
      }),
      rrHomeId: 123,
      localKey: '',
      pv: '',
      sn: '',
      scenes: [],
    });
    const mockDeviceService = {
      listDevices: vi.fn().mockResolvedValue([device]),
    };
    roborockService = Object.create(roborockService, {
      deviceService: { value: mockDeviceService },
    });
    const result = await roborockService.listDevices();
    expect(result[0].store.homeData.rooms).toEqual([{ id: 1, name: 'Living Room' }]);
  });
});

describe('getHomeDataForUpdating', () => {
  let service: RoborockService;
  let mockLogger: AnsiLogger;
  const homeid = 123;

  beforeEach(async () => {
    mockLogger = makeLogger();

    const persist = createMockLocalStorage();

    const PlatformConfigManager = PlatformConfigManagerStatic;
    const config = {
      name: 'test',
      type: 'test',
      version: '1.0',
      debug: false,
      unregisterOnShutdown: false,
      authentication: {
        username: 'test',
        region: 'US',
        forceAuthentication: false,
        authenticationMethod: 'Password',
        password: '',
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
    } as RoborockPluginPlatformConfig;
    const configManager = PlatformConfigManager.create(
      Object.assign({ name: 'test', type: 'test', version: '1.0', debug: false, unregisterOnShutdown: false }, config),
      mockLogger,
    );

    service = new RoborockService(
      {
        authenticateApiFactory: () => asType<RoborockAuthenticateApi>(undefined),
        iotApiFactory: () => asType<RoborockIoTApi>(undefined),
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: persist,
        configManager: configManager,
        toastMessage: vi.fn(),
      },
      mockLogger,
      configManager,
    );
  });

  it('should throw if not authenticated', async () => {
    const result = await service.getHomeDataForUpdating(homeid);
    expect(result).toBeUndefined();
  });
});

describe('Device Management Methods', () => {
  let service: RoborockService;
  let mockLogger: AnsiLogger;
  let mockContainer: ServiceContainer;
  const homeid = 123;

  beforeEach(async () => {
    mockLogger = makeLogger();
    mockContainer = asPartial<ServiceContainer>({
      setUserData: vi.fn(),
      getIotApi: vi.fn(),
      getAuthenticationCoordinator: vi.fn().mockReturnValue({}),
      getDeviceManagementService: vi
        .fn()
        .mockReturnValue({ getHomeDataForUpdating: vi.fn().mockResolvedValue(undefined) }),
      getAreaManagementService: vi.fn().mockReturnValue({}),
      getMessageRoutingService: vi.fn().mockReturnValue({}),
      getPollingService: vi.fn().mockReturnValue({}),
      getConnectionService: vi.fn().mockReturnValue({
        initializeMessageClient: vi.fn(),
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(false),
        setDeviceNotify: vi.fn(),
      }),
    });

    const persist = createMockLocalStorage({
      getItem: localStorageMock.getItem,
      setItem: localStorageMock.setItem,
      clear: localStorageMock.clear,
    });

    const PlatformConfigManager = PlatformConfigManagerStatic;
    const config = {
      name: 'test',
      type: 'test',
      version: '1.0',
      debug: false,
      unregisterOnShutdown: false,
      authentication: {
        username: 'test',
        region: 'US',
        forceAuthentication: false,
        authenticationMethod: 'Password',
        password: '',
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
    } as RoborockPluginPlatformConfig;
    const configManager = PlatformConfigManager.create(
      Object.assign({ name: 'test', type: 'test', version: '1.0', debug: false, unregisterOnShutdown: false }, config),
      mockLogger,
    );

    service = new RoborockService(
      {
        authenticateApiFactory: () => asPartial<RoborockAuthenticateApi>({}),
        iotApiFactory: () => asPartial<RoborockIoTApi>({}),
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: persist,
        configManager: configManager,
        container: mockContainer,
        toastMessage: vi.fn(),
      },
      mockLogger,
      configManager,
    );
  });

  it('should throw error when getting custom API without IoT API', async () => {
    (mockContainer.getIotApi as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    await expect(service.getCustomAPI('/test')).rejects.toThrow('IoT API not initialized. Please login first.');
  });

  it('should throw if not authenticated', async () => {
    const result = await service.getHomeDataForUpdating(homeid);
    expect(result).toBeUndefined();
  });
});
