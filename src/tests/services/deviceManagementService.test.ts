import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DeviceManagementService } from '../../services/deviceManagementService.js';
import { DeviceError, DeviceNotFoundError } from '../../errors/index.js';
import { Device, Home, Protocol, UserData } from '../../roborockCommunication/models/index.js';

describe('DeviceManagementService', () => {
  let deviceService: DeviceManagementService;
  let mockLogger: any;
  let mockClientManager: any;
  let mockIotApiFactory: any;
  let mockLoginApi: any;
  let mockIotApi: any;
  let mockClientRouter: any;
  let mockMessageRoutingService: any;

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
      r: { host: 'test-host' } as any,
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
    rooms: [],
    scenes: [],
    deviceStatus: {
      [Protocol.battery]: 85,
    },
    serialNumber: 'SN12345',
    activeTime: 0,
    createTime: 0,
    online: true,
    schema: [],
    data: {
      id: 'device-123',
      firmwareVersion: '1.0.0',
      serialNumber: 'SN12345',
      model: 's5_max' as any,
      category: 'vacuum',
      batteryLevel: 85,
    },
    store: {
      userData: mockUserData,
      localKey: 'local-key-789',
      pv: 'A01',
      model: 'Test Model',
    },
  };

  const mockHomeData: Home = {
    id: 12345,
    name: 'Test Home',
    products: [
      {
        id: 'prod-456',
        name: 'Test Product',
        model: 's5_max' as any,
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

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    } as any;

    mockClientRouter = {
      registerDevice: vi.fn(),
      registerMessageListener: vi.fn(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(true),
      registerClient: vi.fn().mockReturnValue({
        connect: vi.fn(),
        disconnect: vi.fn(),
        isConnected: vi.fn().mockReturnValue(true),
      }),
      updateNonce: vi.fn(),
    } as any;

    mockIotApi = {
      getHomev2: vi.fn().mockResolvedValue(mockHomeData),
      getHomev3: vi.fn(),
      getHome: vi.fn(),
      getScenes: vi.fn().mockResolvedValue([]),
      getHomeWithProducts: vi.fn().mockResolvedValue(mockHomeData),
    } as any;

    mockIotApiFactory = vi.fn().mockReturnValue(mockIotApi);

    mockLoginApi = {
      getHomeDetails: vi.fn().mockResolvedValue({
        rrHomeId: 12345,
      }),
    } as any;

    mockClientManager = {
      get: vi.fn().mockReturnValue(mockClientRouter),
      destroy: vi.fn(),
      destroyAll: vi.fn(),
    } as any;

    mockMessageRoutingService = {
      subscribeToMessages: vi.fn(),
      unsubscribeFromMessages: vi.fn(),
      setMqttAlwaysOn: vi.fn(),
      clearAll: vi.fn(),
      registerMessageProcessor: vi.fn(),
    } as any;

    deviceService = new DeviceManagementService(mockIotApiFactory, mockLogger, mockLoginApi);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('initialization and configuration', () => {
    it('should set authentication data correctly', () => {
      deviceService.setAuthentication(mockUserData);

      expect(mockIotApiFactory).toHaveBeenCalledWith(mockLogger, mockUserData);
    });
  });

  describe('listDevices', () => {
    beforeEach(() => {
      deviceService.setAuthentication(mockUserData);
    });

    it('should throw error when not authenticated', async () => {
      const unauthenticatedService = new DeviceManagementService(mockIotApiFactory, mockLogger, mockLoginApi);

      await expect(unauthenticatedService.listDevices()).rejects.toThrow('Not authenticated. Please login first.');
    });

    it('should throw DeviceNotFoundError when no home found', async () => {
      mockLoginApi.getHomeDetails.mockResolvedValue(undefined);

      await expect(deviceService.listDevices()).rejects.toThrow(DeviceNotFoundError);
      await expect(deviceService.listDevices()).rejects.toThrow('No home found for user');
    });

    it('should throw error when home details missing rrHomeId', async () => {
      mockLoginApi.getHomeDetails.mockResolvedValue(undefined);

      await expect(deviceService.listDevices()).rejects.toThrow(DeviceNotFoundError);
    });

    it('should throw DeviceError when homeData cannot be retrieved', async () => {
      mockIotApi.getHomeWithProducts.mockResolvedValue(undefined);

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
        rooms: mockHomeData.rooms,
        scenes: [],
        data: {
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

      expect(mockLoginApi.getHomeDetails).toHaveBeenCalled();
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
      mockIotApi.getHomev2.mockResolvedValue(homeDataWithReceivedDevices);

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
      ] as any;
      mockIotApi.getScenes.mockResolvedValue(mockScenes);

      const result = await deviceService.listDevices();

      expect(result[0].scenes).toHaveLength(1);
      expect(result[0]?.scenes?.[0]?.id).toBe(1);
    });

    it('should fallback battery level to 100 if not present', async () => {
      const deviceWithoutBattery = { ...mockDevice, deviceStatus: {} };
      const homeDataNoBattery = { ...mockHomeData, devices: [deviceWithoutBattery] };
      mockIotApi.getHomeWithProducts.mockResolvedValue(homeDataNoBattery);

      const result = await deviceService.listDevices();

      expect(result[0].data.batteryLevel).toBe(100);
    });

    it('should handle API errors and wrap them in DeviceError', async () => {
      mockIotApi.getHomeWithProducts.mockRejectedValue(new Error('API Error'));

      await expect(deviceService.listDevices()).rejects.toThrow(DeviceError);
      await expect(deviceService.listDevices()).rejects.toThrow('Failed to retrieve device list');
    });
  });

  describe('getHomeDataForUpdating', () => {
    beforeEach(() => {
      deviceService.setAuthentication(mockUserData);
    });

    it('should return undefined when not authenticated', async () => {
      const unauthenticatedService = new DeviceManagementService(mockIotApiFactory, mockLogger, mockLoginApi);

      const result = await unauthenticatedService.getHomeDataForUpdating(12345);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Not authenticated');
    });

    it('should return undefined when homeData cannot be retrieved', async () => {
      mockIotApi.getHomev2.mockResolvedValue(undefined);

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
        rooms: mockHomeData.rooms,
        data: expect.objectContaining({
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
      mockIotApi.getHomev3.mockResolvedValue({ ...mockHomeData, rooms: v3Rooms });

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
      mockIotApi.getHomev3.mockResolvedValue(undefined);
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
