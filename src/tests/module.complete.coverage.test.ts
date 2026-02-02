import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { PlatformMatterbridge } from 'matterbridge';
import { RoborockMatterbridgePlatform } from '../module.js';
import { DeviceData, RawRoomMappingData, type Device, type RoomDto } from '../roborockCommunication/models/index.js';
import { AdvancedFeatureConfiguration, AdvancedFeatureSetting, RoborockPluginPlatformConfig } from '../model/RoborockPluginPlatformConfig.js';
import type { LocalStorage } from 'node-persist';
import type { RoborockService } from '../services/roborockService.js';
import type { PlatformRunner } from '../platformRunner.js';
import { DeviceModel } from '../roborockCommunication/models/deviceModel.js';
import { DeviceCategory } from '../roborockCommunication/models/deviceCategory.js';
import { asPartial } from './helpers/testUtils.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';

vi.mock('../share/behaviorFactory.js', () => ({
  configureBehavior: vi.fn().mockReturnValue({ handler: vi.fn() }),
}));

vi.mock('../initialData/index.js', async (importOriginal) => {
  const original: any = await importOriginal();
  return {
    ...original,
    getSupportedAreas: vi.fn().mockReturnValue({ supportedAreas: [], roomIndexMap: new Map() }),
    getSupportedScenes: vi.fn().mockReturnValue([]),
  };
});

vi.mock('../types/roborockVacuumCleaner.js', () => {
  class MockVacuum {
    username: string;
    device: any;
    serialNumber: string;
    deviceName: string;
    vendorId = 1;
    vendorName = 'Roborock';
    productName: string;
    deviceTypes = new Map();
    mode = undefined;
    configureHandler = vi.fn();
    getClusterServerOptions = vi.fn().mockReturnValue({ deviceTypeList: [] });
    createDefaultBridgedDeviceBasicInformationClusterServer = vi.fn();
    createDefaultIdentifyClusterServer = vi.fn();

    constructor(username: string, device: any) {
      this.username = username;
      this.device = device;
      this.serialNumber = device.duid;
      this.deviceName = device.name;
      this.productName = device.name;
    }
  }

  return { RoborockVacuumCleaner: MockVacuum };
});

function createMockLogger(): AnsiLogger {
  return asPartial<AnsiLogger>({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    log: vi.fn(),
    logLevel: LogLevel.DEBUG,
  });
}

function createMockMatterbridge(): PlatformMatterbridge {
  return {
    matterbridgeVersion: '3.5.0',
    matterbridgePluginDirectory: '/tmp',
    matterbridgeDirectory: '/tmp',
  } satisfies Partial<PlatformMatterbridge> as PlatformMatterbridge;
}

function createMockConfig(overrides: Partial<RoborockPluginPlatformConfig> = {}): RoborockPluginPlatformConfig {
  return {
    name: 'TestPlatform',
    authentication: { username: 'test', region: 'US', forceAuthentication: false, password: 'test', authenticationMethod: 'Password' },
    pluginConfiguration: {
      whiteList: [],
      sanitizeSensitiveLogs: false,
      enableMultipleMap: false,
      unregisterOnShutdown: false,
      refreshInterval: 60,
      debug: false,
      enableServerMode: false,
    },
    advancedFeature: {
      enableAdvancedFeature: true,
      settings: {
        showRoutinesAsRoom: false,
        includeDockStationStatus: false,
        forceRunAtDefault: false,
        useVacationModeToSendVacuumToDock: false,
        enableCleanModeMapping: true,
        cleanModeSettings: {
          vacuuming: { fanMode: 'Silent', mopRouteMode: 'Standard' },
          mopping: { waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 0 },
          vacmop: { fanMode: 'Silent', waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 0 },
        },
      } satisfies AdvancedFeatureSetting,
    } satisfies AdvancedFeatureConfiguration,
    persistDirectory: '/tmp',
    ...overrides,
  } satisfies Partial<RoborockPluginPlatformConfig> as RoborockPluginPlatformConfig;
}

describe('module.ts - complete coverage', () => {
  let mockLogger: AnsiLogger;
  let mockMatterbridge: PlatformMatterbridge;
  let mockPersist: LocalStorage;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockMatterbridge = createMockMatterbridge();
    mockPersist = asPartial<LocalStorage>({
      init: vi.fn().mockResolvedValue(undefined),
      getItem: vi.fn().mockResolvedValue(undefined),
      setItem: vi.fn().mockResolvedValue(undefined),
    });
    vi.clearAllMocks();
  });

  describe('onConfigureDevice complete flow', () => {
    it('should execute full onConfigureDevice including setDeviceNotify and requestHomeData', async () => {
      const mockDevice = asPartial<Device>({
        duid: 'device1',
        serialNumber: 'device1',
        name: 'Vacuum 1',
        rooms: [{ id: 1, name: 'Room 1' }] as RoomDto[],
        data: { id: 'device1', firmwareVersion: '1.0', serialNumber: 'device1', model: DeviceModel.QREVO_EDGE_5V1, category: DeviceCategory.VacuumCleaner, batteryLevel: 100 },
        rrHomeId: 123,
      });

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      platform.persist = mockPersist;
      platform.version = '1.0.0';

      let capturedCallback: (payload: unknown) => void = () => {};
      const roomData = [
        [1, '11100845', 14],
        [2, '11100849', 9],
        [3, '11100842', 6],
        [4, '11100847', 1],
      ] as Partial<RawRoomMappingData> as RawRoomMappingData;

      const mockRoborockService = asPartial<RoborockService>({
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
        getMapInfo: vi.fn().mockResolvedValue({ allRooms: [] }),
        setSupportedAreas: vi.fn(),
        setSupportedAreaIndexMap: vi.fn(),
        setDeviceNotify: vi.fn().mockImplementation((cb: (payload: unknown) => void) => {
          capturedCallback = cb;
        }),
        activateDeviceNotify: vi.fn(),
        getRoomMap: vi.fn().mockResolvedValue(roomData),
      });
      platform.roborockService = mockRoborockService;

      const mockPlatformRunner = asPartial<PlatformRunner>({
        updateRobotWithPayload: vi.fn().mockResolvedValue(undefined),
        requestHomeData: vi.fn().mockResolvedValue(undefined),
      });
      platform.platformRunner = mockPlatformRunner;

      platform.registry.registerDevice(mockDevice as Device);
      platform.validateDevice = vi.fn().mockReturnValue(true);
      platform.registerDevice = vi.fn().mockResolvedValue(undefined);
      platform.setSelectDevice = vi.fn();

      await platform['configureDevice'](mockDevice);
      const mockRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: 'device1', device: mockDevice });
      platform.registry.registerRobot(mockRobot);

      await platform['onConfigureDevice']();

      expect(mockRoborockService.setDeviceNotify).toHaveBeenCalled();
      expect(capturedCallback).toBeDefined();

      const testPayload = {
        type: 'status',
        data: { duid: 'device1', battery: 90 },
        duid: 'device1',
      };
      await capturedCallback(testPayload);
      expect(mockPlatformRunner.updateRobotWithPayload).toHaveBeenCalledWith(testPayload);

      expect(mockRoborockService.activateDeviceNotify).toHaveBeenCalledWith(mockDevice);
      expect(mockPlatformRunner.requestHomeData).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith('info', 'onConfigureDevice finished');
    });

    it('should skip activating notify for failed device configurations', async () => {
      const mockDevice1 = asPartial<Device>({
        duid: 'device1',
        serialNumber: 'device1',
        name: 'Vacuum 1',
        rooms: [{ id: 1, name: 'Room 1' }] as RoomDto[],
        data: asPartial<DeviceData>({ model: DeviceModel.S7 }),
        rrHomeId: 123,
      });

      const mockDevice2 = asPartial<Device>({
        duid: 'device2',
        serialNumber: 'device2',
        name: 'Vacuum 2',
        rooms: [{ id: 1, name: 'Room 2' }] as RoomDto[],
        data: asPartial<DeviceData>({ model: DeviceModel.S6 }),
        rrHomeId: 456,
      });

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      platform.persist = mockPersist;
      platform.version = '1.0.0';
      const roomData = [
        [1, '11100845', 14],
        [2, '11100849', 9],
        [3, '11100842', 6],
        [4, '11100847', 1],
      ] as Partial<RawRoomMappingData> as RawRoomMappingData;

      const mockRoborockService = asPartial<RoborockService>({
        initializeMessageClientForLocal: vi.fn().mockImplementation((d: Device) => Promise.resolve(d.duid === 'device1')),
        getMapInfo: vi.fn().mockResolvedValue({ allRooms: [] }),
        setSupportedAreas: vi.fn(),
        setSupportedAreaIndexMap: vi.fn(),
        setDeviceNotify: vi.fn(),
        activateDeviceNotify: vi.fn(),
        getRoomMap: vi.fn().mockResolvedValue(roomData),
      });
      platform.roborockService = mockRoborockService;

      const mockPlatformRunner = asPartial<PlatformRunner>({
        updateRobotWithPayload: vi.fn().mockResolvedValue(undefined),
        requestHomeData: vi.fn().mockResolvedValue(undefined),
      });
      platform.platformRunner = mockPlatformRunner;

      platform.registry.registerDevice(mockDevice1 as Device);
      platform.registry.registerDevice(mockDevice2 as Device);
      platform.validateDevice = vi.fn().mockReturnValue(true);
      platform.registerDevice = vi.fn().mockResolvedValue(undefined);
      platform.setSelectDevice = vi.fn();

      await asPartial<RoborockMatterbridgePlatform>(platform)['configureDevice'](mockDevice1);
      await asPartial<RoborockMatterbridgePlatform>(platform)['configureDevice'](mockDevice2);

      const mockRobot1 = { serialNumber: 'device1', device: mockDevice1 };
      const mockRobot2 = { serialNumber: 'device2', device: mockDevice2 };
      platform.registry.registerRobot(asPartial<RoborockVacuumCleaner>(mockRobot1));
      platform.registry.registerRobot(asPartial<RoborockVacuumCleaner>(mockRobot2));

      await asPartial<RoborockMatterbridgePlatform>(platform)['onConfigureDevice']();

      expect(mockRoborockService.activateDeviceNotify).toHaveBeenCalledTimes(1);
      expect(mockRoborockService.activateDeviceNotify).toHaveBeenCalledWith(mockDevice1);
    });

    it('should handle requestHomeData Error exception', async () => {
      const mockDevice = asPartial<Device>({
        duid: 'device1',
        serialNumber: 'device1',
        name: 'Vacuum 1',
        rooms: [{ id: 1, name: 'Room 1' }] as RoomDto[],
        data: asPartial<DeviceData>({ model: DeviceModel.S7 }),
        rrHomeId: 123,
      });

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      platform.persist = mockPersist;
      platform.version = '1.0.0';
      const roomData = [
        [1, '11100845', 14],
        [2, '11100849', 9],
        [3, '11100842', 6],
        [4, '11100847', 1],
      ] as Partial<RawRoomMappingData> as RawRoomMappingData;

      const mockRoborockService = asPartial<RoborockService>({
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
        getMapInfo: vi.fn().mockResolvedValue({ allRooms: [] }),
        setSupportedAreas: vi.fn(),
        setSupportedAreaIndexMap: vi.fn(),
        setDeviceNotify: vi.fn(),
        activateDeviceNotify: vi.fn(),
        getRoomMap: vi.fn().mockResolvedValue(roomData),
      });
      platform.roborockService = mockRoborockService;

      const mockPlatformRunner = {
        updateRobotWithPayload: vi.fn().mockResolvedValue(undefined),
        requestHomeData: vi.fn().mockRejectedValue(new Error('Network timeout')),
      };
      platform.platformRunner = asPartial<PlatformRunner>(mockPlatformRunner);

      platform.registry.registerDevice(mockDevice as Device);
      platform.validateDevice = vi.fn().mockReturnValue(true);
      platform.registerDevice = vi.fn().mockResolvedValue(undefined);
      platform.setSelectDevice = vi.fn();

      await platform['configureDevice'](mockDevice);
      const mockRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: 'device1', device: mockDevice });
      platform.registry.registerRobot(mockRobot);

      await platform['onConfigureDevice']();

      expect(mockLogger.log).toHaveBeenCalledWith('error', 'requestHomeData (initial) failed: Network timeout');
    });

    it('should handle requestHomeData string exception', async () => {
      const mockDevice = asPartial<Device>({
        duid: 'device1',
        serialNumber: 'device1',
        name: 'Vacuum 1',
        rooms: [{ id: 1, name: 'Room 1' }] as RoomDto[],
        data: asPartial<DeviceData>({ model: DeviceModel.S7 }),
        rrHomeId: 123,
      });

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      platform.persist = mockPersist;
      platform.version = '1.0.0';
      const roomData = [
        [1, '11100845', 14],
        [2, '11100849', 9],
        [3, '11100842', 6],
        [4, '11100847', 1],
      ] as Partial<RawRoomMappingData> as RawRoomMappingData;

      const mockRoborockService = asPartial<RoborockService>({
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
        getMapInfo: vi.fn().mockResolvedValue({ allRooms: [] }),
        setSupportedAreas: vi.fn(),
        setSupportedAreaIndexMap: vi.fn(),
        setDeviceNotify: vi.fn(),
        activateDeviceNotify: vi.fn(),
        getRoomMap: vi.fn().mockResolvedValue(roomData),
      });
      platform.roborockService = mockRoborockService;

      const mockPlatformRunner = {
        updateRobotWithPayload: vi.fn().mockResolvedValue(undefined),
        requestHomeData: vi.fn().mockRejectedValue('Connection failed'),
      };
      platform.platformRunner = asPartial<PlatformRunner>(mockPlatformRunner);

      platform.registry.registerDevice(mockDevice as Device);
      platform.validateDevice = vi.fn().mockReturnValue(true);
      platform.registerDevice = vi.fn().mockResolvedValue(undefined);
      platform.setSelectDevice = vi.fn();

      await platform['configureDevice'](mockDevice);
      const mockRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: 'device1', device: mockDevice });
      platform.registry.registerRobot(mockRobot);

      await platform['onConfigureDevice']();

      expect(mockLogger.log).toHaveBeenCalledWith('error', 'requestHomeData (initial) failed: Connection failed');
    });
  });

  describe('configureDevice room fetching', () => {
    it('should fetch rooms when undefined', async () => {
      const mockDevice = asPartial<Device>({
        duid: 'device1',
        serialNumber: 'device1',
        name: 'Vacuum 1',
        rooms: undefined,
        data: asPartial<DeviceData>({ model: DeviceModel.S7 }),
        rrHomeId: 123,
      });

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      platform.persist = mockPersist;
      platform.version = '1.0.0';

      const mockMapInfo = {
        maps: [],
        allRooms: [
          { id: 1, iot_name: 'Living Room', tag: 0, iot_name_id: 'room1' },
          { id: 2, iot_name: 'Kitchen', tag: 0, iot_name_id: 'room2' },
        ],
        hasRooms: true,
      };

      const mockRoborockService = asPartial<RoborockService>({
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
        getMapInfo: vi.fn().mockResolvedValue(mockMapInfo),
        setSupportedAreas: vi.fn(),
        setSupportedAreaIndexMap: vi.fn(),
      });
      platform.roborockService = asPartial<RoborockService>(mockRoborockService);

      platform.validateDevice = vi.fn().mockReturnValue(true);
      platform.registerDevice = vi.fn().mockResolvedValue(undefined);
      platform.setSelectDevice = vi.fn();

      mockDevice.rooms = mockDevice.rooms ?? [];
      const mockRobot = asPartial<RoborockVacuumCleaner>({
        serialNumber: 'device1',
        device: mockDevice,
        roomInfo: undefined,
      });
      platform.registry.registerRobot(mockRobot);

      const result = await platform['configureDevice'](mockDevice);

      expect(result).toBe(true);
      expect(mockRoborockService.getMapInfo).toHaveBeenCalledWith('device1');
      expect(mockDevice.rooms).toEqual([
        { id: 1, name: 'Living Room' },
        { id: 2, name: 'Kitchen' },
      ]);
    });

    it('should fetch rooms when array is empty', async () => {
      const mockDevice = asPartial<Device>({
        duid: 'device1',
        serialNumber: 'device1',
        name: 'Vacuum 1',
        rooms: [],
        data: asPartial<DeviceData>({ model: DeviceModel.S7 }),
        rrHomeId: 123,
      });

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, createMockConfig());
      platform.persist = mockPersist;
      platform.version = '1.0.0';

      const mockMapInfo = {
        maps: [],
        allRooms: [{ id: 5, iot_name: 'Bedroom', tag: 0, iot_name_id: 'room5' }],
        hasRooms: true,
      };

      const mockRoborockService = {
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
        getMapInfo: vi.fn().mockResolvedValue(mockMapInfo),
        setSupportedAreas: vi.fn(),
        setSupportedAreaIndexMap: vi.fn(),
      };
      platform.roborockService = asPartial<RoborockService>(mockRoborockService);

      platform.validateDevice = vi.fn().mockReturnValue(true);
      platform.registerDevice = vi.fn().mockResolvedValue(undefined);
      platform.setSelectDevice = vi.fn();

      mockDevice.rooms = mockDevice.rooms ?? [];
      const mockRobot = asPartial<RoborockVacuumCleaner>({
        serialNumber: 'device1',
        device: mockDevice,
        roomInfo: undefined,
      });
      platform.registry.registerRobot(mockRobot);

      const result = await platform['configureDevice'](mockDevice);

      expect(result).toBe(true);
      expect(mockDevice.rooms).toEqual([{ id: 5, name: 'Bedroom' }]);
    });

    it('should call setSupportedScenes when showRoutinesAsRoom is enabled and scenes exist', async () => {
      const mockDevice = asPartial<Device>({
        duid: 'device1',
        serialNumber: 'device1',
        name: 'Vacuum 1',
        rooms: [{ id: 1, name: 'Room 1' }] as RoomDto[],
        scenes: [],
        data: asPartial<DeviceData>({ model: DeviceModel.S7 }),
        rrHomeId: 123,
      });

      const config = createMockConfig({
        advancedFeature: {
          enableAdvancedFeature: true,
          settings: {
            showRoutinesAsRoom: true,
            includeDockStationStatus: false,
            forceRunAtDefault: false,
            useVacationModeToSendVacuumToDock: false,
            enableCleanModeMapping: true,
            cleanModeSettings: {
              vacuuming: { fanMode: 'Silent', mopRouteMode: 'Standard' },
              mopping: { waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 0 },
              vacmop: { fanMode: 'Silent', waterFlowMode: 'Low', mopRouteMode: 'Standard', distanceOff: 0 },
            },
          } satisfies AdvancedFeatureSetting,
        } satisfies AdvancedFeatureConfiguration,
      });

      const platform = new RoborockMatterbridgePlatform(mockMatterbridge, mockLogger, config);
      platform.persist = mockPersist;
      platform.version = '1.0.0';
      const roomData = [
        [1, '11100845', 14],
        [2, '11100849', 9],
        [3, '11100842', 6],
        [4, '11100847', 1],
      ] as Partial<RawRoomMappingData> as RawRoomMappingData;

      const mockRoborockService = {
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
        getMapInfo: vi.fn().mockResolvedValue({ allRooms: [] }),
        setSupportedAreas: vi.fn(),
        setSupportedAreaIndexMap: vi.fn(),
        setSupportedScenes: vi.fn(),
        getRoomMap: vi.fn().mockResolvedValue(roomData),
      };
      platform.roborockService = asPartial<RoborockService>(mockRoborockService);

      platform.validateDevice = vi.fn().mockReturnValue(true);
      platform.registerDevice = vi.fn().mockResolvedValue(undefined);
      platform.setSelectDevice = vi.fn();

      const result = await platform['configureDevice'](mockDevice);

      expect(result).toBe(true);
      expect(mockRoborockService.setSupportedScenes).toHaveBeenCalledWith('device1', expect.any(Array));
    });
  });
});
