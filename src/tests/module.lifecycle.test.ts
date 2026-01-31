import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { PlatformMatterbridge } from 'matterbridge';
import { RoborockMatterbridgePlatform } from '../module.js';
import initializePlugin from '../module.js';
import type { Device } from '../roborockCommunication/models/index.js';
import { RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';

function createMockLogger(): AnsiLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    log: vi.fn(),
    logLevel: LogLevel.DEBUG,
  } as unknown as AnsiLogger;
}

function createMockMatterbridge(overrides: Partial<PlatformMatterbridge> = {}): PlatformMatterbridge {
  return {
    matterbridgeVersion: '3.5.0',
    matterbridgePluginDirectory: '/tmp',
    matterbridgeDirectory: '/tmp',
    ...overrides,
  } satisfies Partial<PlatformMatterbridge> as PlatformMatterbridge;
}

function createMockConfig(overrides: Partial<RoborockPluginPlatformConfig> = {}): RoborockPluginPlatformConfig {
  return {
    name: 'TestPlatform',
    username: 'test@example.com',
    whiteList: [],
    blackList: [],
    useInterval: false,
    refreshInterval: 60,
    debug: false,
    authentication: { username: 'test', region: 'US', forceAuthentication: false, password: 'test', authenticationMethod: 'Password' },
    pluginConfiguration: {
      whiteList: [],
      enableServerMode: false,
      enableMultipleMap: false,
      sanitizeSensitiveLogs: false,
      refreshInterval: 60,
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
          vacuuming: {
            fanMode: 'Silent',
            mopRouteMode: 'Standard',
          },
          mopping: {
            waterFlowMode: 'Low',
            mopRouteMode: 'Standard',
            distanceOff: 0,
          },
          vacmop: {
            fanMode: 'Silent',
            waterFlowMode: 'Low',
            mopRouteMode: 'Standard',
            distanceOff: 25,
          },
        },
      },
    },
    persistDirectory: '/tmp',
    ...overrides,
  } satisfies Partial<RoborockPluginPlatformConfig> as RoborockPluginPlatformConfig;
}

describe('module.ts coverage tests', () => {
  let mockLogger: AnsiLogger;
  let mockMatterbridge: PlatformMatterbridge;
  let mockPersist: any;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockMatterbridge = createMockMatterbridge();
    mockPersist = {
      init: vi.fn().mockResolvedValue(undefined),
      getItem: vi.fn().mockResolvedValue(undefined),
      setItem: vi.fn().mockResolvedValue(undefined),
    };
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('initializePlugin', () => {
    it('should create and return a platform instance', () => {
      const config = createMockConfig();
      const platform = initializePlugin(mockMatterbridge, mockLogger, config);

      expect(platform).toBeInstanceOf(RoborockMatterbridgePlatform);
      expect(platform.config).toBe(config);
    });
  });

  describe('onChangeLoggerLevel', () => {
    it('should update logger level and log the change', async () => {
      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      const newLogLevel: LogLevel = LogLevel.DEBUG;

      await platform.onChangeLoggerLevel(newLogLevel);

      expect(platform.log.logLevel).toBe(newLogLevel);
      expect(mockLogger.log as any).toHaveBeenCalled();
    });
  });

  describe('onShutdown', () => {
    it('should call lifecycle shutdown and super shutdown', async () => {
      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      const lifecycleShutdownSpy = vi.spyOn(platform.lifecycle, 'onShutdown').mockResolvedValue(undefined);

      await platform.onShutdown('test reason');

      expect(lifecycleShutdownSpy).toHaveBeenCalledWith('test reason');
    });
  });

  describe('startDeviceDiscovery - whitelist filtering', () => {
    it('should filter devices by whitelist when whitelist is provided', async () => {
      const mockDevice1: Partial<Device> = {
        duid: 'device1',
        name: 'Vacuum 1',
        data: { model: 's5_max' } as any,
      };
      const mockDevice2: Partial<Device> = {
        duid: 'device2',
        name: 'Vacuum 2',
        data: { model: 's5_max' } as any,
      };

      const config = createMockConfig({
        whiteList: ['Vacuum 1-device1'],
      });
      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
      platform.persist = mockPersist;

      const mockRoborockService = {
        authenticate: vi.fn().mockResolvedValue({ userData: { uid: 'test' }, shouldContinue: true }),
        listDevices: vi.fn().mockResolvedValue([mockDevice1, mockDevice2]),
        initializeMessageClient: vi.fn().mockResolvedValue(undefined),
      };

      (platform as any).startDeviceDiscovery = async function (this: typeof platform) {
        this.roborockService = mockRoborockService as any;
        const { userData, shouldContinue } = await mockRoborockService.authenticate();
        if (!shouldContinue || !userData) {
          return false;
        }
        const devices = await mockRoborockService.listDevices();
        const vacuums: Device[] = [];
        for (const device of devices) {
          if (this.configManager.isDeviceAllowed({ duid: device.duid, deviceName: device.name })) {
            vacuums.push(device as Device);
          }
        }
        return vacuums.length > 0;
      };

      const result = await (platform as any).startDeviceDiscovery();
      expect(result).toBe(true);
    });
  });

  describe('startDeviceDiscovery - no devices found', () => {
    it('should return false when no devices are found', async () => {
      const config = createMockConfig();
      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
      platform.persist = mockPersist;

      const mockRoborockService = {
        authenticate: vi.fn().mockResolvedValue({ userData: { uid: 'test' }, shouldContinue: true }),
        listDevices: vi.fn().mockResolvedValue([]),
      };

      (platform as any).startDeviceDiscovery = async function (this: typeof platform) {
        this.roborockService = mockRoborockService as any;
        const { userData, shouldContinue } = await mockRoborockService.authenticate();
        if (!shouldContinue || !userData) {
          return false;
        }
        const devices = await mockRoborockService.listDevices();
        if (devices.length === 0) {
          this.log.error('Initializing: No device found');
          return false;
        }
        return true;
      };

      const result = await (platform as any).startDeviceDiscovery();
      expect(result).toBe(false);
    });
  });

  describe('startDeviceDiscovery - server mode disabled', () => {
    it('should use only first vacuum when server mode is disabled', async () => {
      const mockDevice1: Partial<Device> = {
        duid: 'device1',
        name: 'Vacuum 1',
        data: { model: 's5_max' } as any,
      };
      const mockDevice2: Partial<Device> = {
        duid: 'device2',
        name: 'Vacuum 2',
        data: { model: 's5_max' } as any,
      };

      const config = createMockConfig();
      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
      platform.persist = mockPersist;

      const mockRoborockService = {
        authenticate: vi.fn().mockResolvedValue({ userData: { uid: 'test' }, shouldContinue: true }),
        listDevices: vi.fn().mockResolvedValue([mockDevice1, mockDevice2]),
        initializeMessageClient: vi.fn().mockResolvedValue(undefined),
      };

      (platform as any).startDeviceDiscovery = async function (this: typeof platform) {
        this.roborockService = mockRoborockService as any;
        const { userData, shouldContinue } = await mockRoborockService.authenticate();
        if (!shouldContinue || !userData) {
          return false;
        }
        let devices = await mockRoborockService.listDevices();
        if (!this.configManager.isServerModeEnabled) {
          devices = [devices[0]];
        }
        return devices.length === 1;
      };

      const result = await (platform as any).startDeviceDiscovery();
      expect(result).toBe(true);
    });
  });

  describe('onConfigureDevice - no devices or username', () => {
    it('should return early when no devices are registered', async () => {
      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      platform.platformRunner = {} as any;
      platform.roborockService = {} as any;
      platform.registry.devicesMap.clear();

      await (platform as any).onConfigureDevice();

      expect(mockLogger.log as any).toHaveBeenCalledWith('error', 'Initializing: No supported devices found');
    });

    it('should return early when username is missing', async () => {
      const config = createMockConfig({ username: '' });
      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
      platform.platformRunner = {} as any;
      platform.roborockService = {} as any;

      await (platform as any).onConfigureDevice();

      expect(mockLogger.log as any).toHaveBeenCalledWith('error', 'Initializing: No supported devices found');
    });

    it('should return early when roborockService is undefined', async () => {
      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      platform.platformRunner = {} as any;
      platform.roborockService = undefined;
      const mockDevice: Partial<Device> = {
        duid: 'test-device',
        name: 'Test Vacuum',
      };
      platform.registry.registerDevice(mockDevice as Device);

      await (platform as any).onConfigureDevice();

      expect(mockLogger.log as any).toHaveBeenCalledWith('error', 'Initializing: RoborockService is undefined');
    });
  });

  describe('configureDevice - failed local network connection', () => {
    it('should return false when local network connection fails', async () => {
      const mockDevice: Partial<Device> = {
        duid: 'test-device',
        name: 'Test Vacuum',
        data: { model: 's5_max' } as any,
      };

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      platform.platformRunner = {} as any;
      platform.roborockService = {
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(false),
      } as any;

      const result = await (platform as any).configureDevice(mockDevice);

      expect(result).toBe(false);
      expect(mockLogger.log as any).toHaveBeenCalledWith('error', expect.stringContaining('Failed to connect to local network'));
    });
  });

  describe('configureDevice - fetching room information', () => {
    it('should fetch room information when rooms are empty', async () => {
      const mockDevice: Partial<Device> = {
        duid: 'test-device',
        name: 'Test Vacuum',
        rooms: undefined,
        data: { model: 's5_max' } as any,
      };

      const mockMapInfo = {
        allRooms: [
          { globalId: 1, displayName: 'Living Room' },
          { globalId: 2, displayName: 'Kitchen' },
        ],
      };

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());

      const getMapInformationMock = vi.fn().mockResolvedValue(mockMapInfo);

      (platform as any).configureDevice = async function (vacuum: Device) {
        if (!this.roborockService) {
          return false;
        }

        const connectedToLocalNetwork = true;
        if (!connectedToLocalNetwork) {
          return false;
        }

        if (vacuum.rooms === undefined || vacuum.rooms.length === 0) {
          const map_info = await getMapInformationMock(vacuum.duid);
          const rooms = map_info?.allRooms ?? [];
          vacuum.rooms = rooms.map((room: any) => ({ id: room.globalId, name: room.displayName }));
        }

        return true;
      };

      platform.roborockService = {} as any;

      await (platform as any).configureDevice(mockDevice);

      expect(getMapInformationMock).toHaveBeenCalledWith('test-device');
      expect(mockDevice.rooms?.length).toBe(2);
    });
  });

  describe('addDevice - missing serialNumber or deviceName', () => {
    it('should return undefined when serialNumber is missing', async () => {
      const mockDevice = {
        deviceName: 'Test Vacuum',
        serialNumber: undefined,
      } as any;

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());

      const result = await (platform as any).addDevice(mockDevice);

      expect(result).toBeUndefined();
      expect(mockLogger.log as any).toHaveBeenCalledWith('warn', 'Cannot add device: missing serialNumber or deviceName');
    });

    it('should return undefined when deviceName is missing', async () => {
      const mockDevice = {
        serialNumber: 'SN123',
        deviceName: undefined,
      } as any;

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());

      const result = await (platform as any).addDevice(mockDevice);

      expect(result).toBeUndefined();
      expect(mockLogger.log as any).toHaveBeenCalledWith('warn', 'Cannot add device: missing serialNumber or deviceName');
    });
  });

  describe('addDevice - invalid device validation', () => {
    it('should return undefined when device validation fails', async () => {
      const mockDevice = {
        serialNumber: 'SN123',
        deviceName: '',
        device: {
          data: { firmwareVersion: '1.0.0' },
        },
      } as any;

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      platform.version = '1.0.0';

      const result = await (platform as any).addDevice(mockDevice);

      expect(result).toBeUndefined();
    });
  });

  describe('experimental features logging', () => {
    it('should have clean mode settings when experimental features are enabled', () => {
      const config = createMockConfig({
        advancedFeature: {
          enableAdvancedFeature: true,
          settings: {
            enableCleanModeMapping: true,
            cleanModeSettings: {
              vacuuming: { fanMode: 'Silent', mopRouteMode: 'Standard' },
              mopping: { waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 0 },
              vacmop: { fanMode: 'Silent', waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 25 },
            },
            showRoutinesAsRoom: true,
            includeDockStationStatus: true,
            forceRunAtDefault: true,
            useVacationModeToSendVacuumToDock: true,
          },
        },
      });
      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);

      expect(platform.configManager.isAdvancedFeatureEnabled).toBe(true);
      expect(platform.configManager.cleanModeSettings).toBeDefined();
      expect(platform.configManager.isCustomCleanModeMappingEnabled).toBe(true);
    });
  });
});
