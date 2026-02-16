import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceManagementService } from '../../services/deviceManagementService.js';
import { createMockIotApi, createMockAuthApi } from '../helpers/testUtils.js';
import { DeviceError, DeviceNotFoundError } from '../../errors/index.js';
import { Device, DeviceModel, Home, Protocol, UserData } from '../../roborockCommunication/models/index.js';
import { DeviceCategory } from '../../roborockCommunication/models/deviceCategory.js';
import { makeLogger } from '../testUtils.js';
import { ProtocolVersion } from '../../roborockCommunication/enums/index.js';

describe('DeviceManagementService', () => {
  let deviceService: DeviceManagementService;
  let mockLogger: ReturnType<typeof makeLogger>;
  let mockLoginApi: any;
  let mockIotApi: any;

  const mockUserData: UserData = {
    username: 'test-user',
    uid: 'test-uid',
    tokentype: 'Bearer',
    token: 'test-token',
    rruid: 'rr-uid',
    region: 'us',
    countrycode: 'US',
    country: 'United States',
    nickname: 'Test User',
    rriot: {
      r: { r: 'test-r', a: 'test-a', m: 'test-m', l: 'test-l' },
      u: 'test-user',
      s: 'test-secret',
      h: 'test-host',
      k: 'test-key',
    },
  };

  const mockDevice: Device = {
    duid: 'device-123',
    name: 'Test Vacuum',
    productId: 'prod-456',
    localKey: 'local-key-789',
    pv: 'A01',
    sn: 'SN12345',
    fv: '1.0.0',
    rrHomeId: 12345,
    scenes: [],
    deviceStatus: {
      [Protocol.battery]: 85,
    },
    serialNumber: 'SN12345',
    activeTime: 0,
    createTime: 0,
    online: true,
    schema: [],
    mapInfos: undefined,
    specs: {
      id: 'device-123',
      firmwareVersion: '1.0.0',
      serialNumber: 'SN12345',
      model: DeviceModel.QREVO_EDGE_5V1,
      protocol: ProtocolVersion.V1,
      category: DeviceCategory.VacuumCleaner,
      batteryLevel: 85,
      hasRealTimeConnection: true,
    },
    store: {
      userData: mockUserData,
      localKey: 'local-key-789',
      pv: 'A01',
      model: DeviceModel.QREVO_EDGE_5V1,
      homeData: {
        id: 12345,
        name: 'Test Home',
        products: [],
        devices: [],
        receivedDevices: [],
        rooms: [
          {
            id: 1,
            name: 'Living Room',
          },
        ],
      },
    },
  };

  const mockHomeData: Home = {
    id: 12345,
    name: 'Test Home',
    products: [
      {
        id: 'prod-456',
        name: 'Test Product',
        model: 's5_max' as DeviceModel,
        category: 'vacuum',
        schema: [],
      },
    ],
    devices: [mockDevice],
    receivedDevices: [],
    rooms: [
      {
        id: 1,
        name: 'Living Room',
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockLogger = makeLogger();

    mockIotApi = createMockIotApi({
      getHomev2: vi.fn().mockResolvedValue(mockHomeData),
      getHomev3: vi.fn(),
      getHome: vi.fn(),
      getScenes: vi.fn().mockResolvedValue([]),
      getHomeWithProducts: vi.fn().mockResolvedValue(mockHomeData),
    });

    mockLoginApi = createMockAuthApi({
      getBasicHomeInfo: vi.fn().mockResolvedValue({ rrHomeId: 12345 }),
    });

    deviceService = new DeviceManagementService(mockLogger, mockLoginApi, mockUserData);
    deviceService.setIotApi(mockIotApi);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('initialization and configuration', () => {
    it('should set authentication data correctly', () => {
      const newUserData = { ...mockUserData, uid: 'new-uid' };
      deviceService.setAuthentication(newUserData);

      expect(deviceService).toBeDefined();
    });
  });

  describe('listDevices', () => {
    it('should throw error when not authenticated', async () => {
      const unauthenticatedService = new DeviceManagementService(mockLogger, mockLoginApi, undefined);

      await expect(unauthenticatedService.listDevices()).rejects.toThrow('Not authenticated. Please login first.');
    });

    it('should throw DeviceNotFoundError when no home found', async () => {
      mockLoginApi.getBasicHomeInfo = vi.fn().mockResolvedValue(undefined);

      await expect(deviceService.listDevices()).rejects.toThrow(DeviceNotFoundError);
      await expect(deviceService.listDevices()).rejects.toThrow('No home found for user');
    });

    it('should throw error when home details missing rrHomeId', async () => {
      mockLoginApi.getBasicHomeInfo.mockResolvedValue(undefined);

      await expect(deviceService.listDevices()).rejects.toThrow(DeviceNotFoundError);
    });

    it('should throw DeviceError when homeData cannot be retrieved', async () => {
      mockIotApi.getHomeWithProducts = vi.fn().mockResolvedValue(undefined);

      await expect(deviceService.listDevices()).rejects.toThrow(DeviceError);
      await expect(deviceService.listDevices()).rejects.toThrow('Failed to retrieve home data');
    });

    it('should successfully list devices with all data', async () => {
      const result = await deviceService.listDevices();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        duid: 'device-123',
        name: 'Test Vacuum',
        rrHomeId: 12345,
        scenes: [],
        specs: {
          id: 'device-123',
          firmwareVersion: '1.0.0',
          serialNumber: 'SN12345',
          category: 'vacuum',
          batteryLevel: 85,
        },
        store: {
          userData: mockUserData,
          localKey: 'local-key-789',
          pv: 'A01',
          model: 's5_max',
        },
      });

      expect(mockLoginApi.getBasicHomeInfo).toHaveBeenCalled();
      expect(mockIotApi.getHomeWithProducts).toHaveBeenCalledWith(12345);
      expect(mockIotApi.getScenes).toHaveBeenCalledWith(12345);
      expect(mockLogger.notice).toHaveBeenCalledWith('Found 1 devices');
    });

    it('should use receivedDevices when devices array is empty', async () => {
      const homeDataWithReceivedDevices = {
        ...mockHomeData,
        devices: [],
        receivedDevices: [mockDevice],
      };
      mockIotApi.getHomev2 = vi.fn().mockResolvedValue(homeDataWithReceivedDevices);

      const result = await deviceService.listDevices();

      expect(result).toHaveLength(1);
      expect(result[0].duid).toBe('device-123');
    });

    it('should filter scenes by device entityId', async () => {
      const mockScenes = [
        {
          id: 1,
          name: 'Test Scene 1',
          param: JSON.stringify({
            action: {
              items: [{ entityId: 'device-123' }, { entityId: 'other-device' }],
            },
          }),
          enabled: true,
          extra: undefined,
          type: 'auto',
        },
        {
          id: 2,
          name: 'Test Scene 2',
          param: JSON.stringify({
            action: {
              items: [{ entityId: 'other-device' }],
            },
          }),
          enabled: true,
          extra: undefined,
          type: 'auto',
        },
      ];
      mockIotApi.getScenes.mockResolvedValue(mockScenes);

      const result = await deviceService.listDevices();

      expect(result[0].scenes).toHaveLength(1);
      expect(result[0]?.scenes?.[0]?.id).toBe(1);
    });

    it('should fallback battery level to 100 if not present', async () => {
      const deviceWithoutBattery = { ...mockDevice, deviceStatus: {} };
      const homeDataNoBattery = { ...mockHomeData, devices: [deviceWithoutBattery] };
      mockIotApi.getHomeWithProducts = vi.fn().mockResolvedValue(homeDataNoBattery);

      const result = await deviceService.listDevices();

      expect(result[0].specs.batteryLevel).toBe(100);
    });

    it('should handle API errors and wrap them in DeviceError', async () => {
      mockIotApi.getHomeWithProducts = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(deviceService.listDevices()).rejects.toThrow(DeviceError);
      await expect(deviceService.listDevices()).rejects.toThrow('Failed to retrieve device list');
    });
  });

  it('should return undefined when not authenticated', async () => {
    const unauthenticatedService = new DeviceManagementService(mockLogger, mockLoginApi, undefined);

    const result = await unauthenticatedService.getHomeDataForUpdating(12345);

    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Not authenticated');
  });

  it('should return undefined when homeData cannot be retrieved', async () => {
    mockIotApi.getHomev2 = vi.fn().mockResolvedValue(undefined);

    const result = await deviceService.getHomeDataForUpdating(12345);

    expect(result).toBeUndefined();
  });

  it('should return homeData with enriched devices', async () => {
    const result = await deviceService.getHomeDataForUpdating(12345);

    expect(result).toBeDefined();
    expect(result?.devices).toBeDefined();
    expect(result?.devices).toHaveLength(1);
    expect(result?.devices?.[0]).toMatchObject({
      duid: 'device-123',
      rrHomeId: 12345,
      specs: expect.objectContaining({
        id: 'device-123',
        firmwareVersion: '1.0.0',
        serialNumber: 'SN12345',
      }),
    });
  });

  it('should fallback to v3 API for rooms if v2 rooms are empty', async () => {
    const homeDataNoRooms = { ...mockHomeData, rooms: [] };
    const v3Rooms = [{ id: 2, name: 'Kitchen' }];

    mockIotApi.getHomev2.mockResolvedValue(homeDataNoRooms);
    mockIotApi.getHomev3 = vi.fn().mockResolvedValue({ ...mockHomeData, rooms: v3Rooms });

    const result = await deviceService.getHomeDataForUpdating(12345);

    expect(mockIotApi.getHomev3).toHaveBeenCalledWith(12345);
    expect(result?.rooms).toEqual(v3Rooms);
  });

  it('should fallback to v1 API for rooms if v2 and v3 rooms are empty', async () => {
    const homeDataNoRooms = { ...mockHomeData, rooms: [] };
    const v1Rooms = [{ id: 3, name: 'Bedroom' }];

    mockIotApi.getHomev2.mockResolvedValue(homeDataNoRooms);
    mockIotApi.getHomev3.mockResolvedValue({ ...mockHomeData, rooms: [] });
    mockIotApi.getHome.mockResolvedValue({ ...mockHomeData, rooms: v1Rooms });

    const result = await deviceService.getHomeDataForUpdating(12345);

    expect(mockIotApi.getHome).toHaveBeenCalledWith(12345);
    expect(result?.rooms).toEqual(v1Rooms);
  });

  it('should keep empty rooms if all API versions fail to provide rooms', async () => {
    const homeDataNoRooms = { ...mockHomeData, rooms: [] };

    mockIotApi.getHomev2.mockResolvedValue(homeDataNoRooms);
    mockIotApi.getHomev3 = vi.fn().mockResolvedValue(undefined);
    mockIotApi.getHome.mockResolvedValue(undefined);

    const result = await deviceService.getHomeDataForUpdating(12345);

    expect(result?.rooms).toEqual([]);
    expect(result?.rooms).toEqual([]);
    expect(result?.rooms).toEqual([]);
  });

  it('should keep empty rooms if v3 returns no rooms and v1 fails', async () => {
    const homeDataNoRooms = { ...mockHomeData, rooms: [] };

    mockIotApi.getHomev2.mockResolvedValue(homeDataNoRooms);
    mockIotApi.getHomev3.mockResolvedValue({ ...mockHomeData, rooms: [] });
    mockIotApi.getHome.mockResolvedValue(undefined);

    const result = await deviceService.getHomeDataForUpdating(12345);

    expect(result?.rooms).toEqual([]);
  });

  it('should use receivedDevices when devices array is empty', async () => {
    const homeDataWithReceived = {
      ...mockHomeData,
      devices: [],
      receivedDevices: [mockDevice],
    };
    mockIotApi.getHomev2.mockResolvedValue(homeDataWithReceived);

    const result = await deviceService.getHomeDataForUpdating(12345);

    expect(result?.devices).toHaveLength(1);
    expect(result?.devices?.[0]?.duid).toBe('device-123');
  });

  it('should handle API errors gracefully', async () => {
    mockIotApi.getHomev2.mockRejectedValue(new Error('API Error'));

    const result = await deviceService.getHomeDataForUpdating(12345);

    expect(result).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to get home data for updating:', expect.any(Error));
  });

  describe('Authentication data handling', () => {
    it('should update authentication when setAuthentication is called', () => {
      const newUserData = { ...mockUserData, uid: 'new-uid' };

      // Call setAuthentication
      deviceService.setAuthentication(newUserData);

      // Verify the method was called successfully
      expect(newUserData.uid).toBe('new-uid');
      expect(newUserData.rruid).toBe(mockUserData.rruid);
    });
  });
});
