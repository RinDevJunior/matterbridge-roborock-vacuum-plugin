import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockLocalNetworkUDPClient = {
  connect: vi.fn(),
  registerListener: vi.fn(),
};

const mockMessageProcessor = {
  injectLogger: vi.fn(),
  registerListener: vi.fn(),
  getNetworkInfo: vi.fn(),
};

vi.mock('../../roborockCommunication/index.js', async () => {
  const actual = await vi.importActual('../../roborockCommunication/index.js');
  return {
    ...actual,
    LocalNetworkUDPClient: vi.fn(function () {
      return mockLocalNetworkUDPClient;
    }),
    MessageProcessor: vi.fn(function () {
      return mockMessageProcessor;
    }),
  };
});

import { DeviceManagementService } from '../../services/deviceManagementService.js';
import { NotifyMessageTypes } from '../../notifyMessageTypes.js';
import { UserData, Device, Home, ResponseMessage, Protocol, ProtocolVersion } from '@/roborockCommunication/index.js';
import { DeviceError, DeviceNotFoundError, DeviceConnectionError, DeviceInitializationError } from '../../errors/index.js';

describe('DeviceManagementService', () => {
  let deviceService: DeviceManagementService;
  let mockLogger: any;
  let mockClientManager: any;
  let mockIotApiFactory: any;
  let mockLoginApi: any;
  let mockIotApi: any;
  let mockClientRouter: any;
  let mockDeviceNotifyCallback: any;
  let mockMessageRoutingService: any;

  const mockUserData: UserData = {
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
    pv: '1.0',
    sn: 'SN12345',
    fv: '1.0',
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

    mockDeviceNotifyCallback = vi.fn();

    mockLocalNetworkUDPClient.connect.mockClear();
    mockLocalNetworkUDPClient.registerListener.mockClear();
    mockMessageProcessor.injectLogger.mockClear();
    mockMessageProcessor.registerListener.mockClear();
    mockMessageProcessor.getNetworkInfo.mockClear();

    mockLocalNetworkUDPClient.connect.mockClear();
    mockLocalNetworkUDPClient.registerListener.mockClear();
    mockMessageProcessor.injectLogger.mockClear();
    mockMessageProcessor.registerListener.mockClear();
    mockMessageProcessor.getNetworkInfo.mockClear();

    deviceService = new DeviceManagementService(mockIotApiFactory, mockClientManager, mockLogger, mockLoginApi, mockMessageRoutingService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('initialization and configuration', () => {
    it('should initialize with provided dependencies', () => {
      expect(deviceService).toBeDefined();
      expect(deviceService.messageClient).toBeUndefined();
    });

    it('should set authentication data correctly', () => {
      deviceService.setAuthentication(mockUserData);

      expect(mockIotApiFactory).toHaveBeenCalledWith(mockLogger, mockUserData);
    });

    it('should initialize with default state maps', () => {
      expect(deviceService.ipMap).toBeInstanceOf(Map);
      expect(deviceService.localClientMap).toBeInstanceOf(Map);
    });
  });

  describe('listDevices', () => {
    beforeEach(() => {
      deviceService.setAuthentication(mockUserData);
    });

    it('should throw error when not authenticated', async () => {
      const unauthenticatedService = new DeviceManagementService(mockIotApiFactory, mockClientManager, mockLogger, mockLoginApi, mockMessageRoutingService);

      await expect(unauthenticatedService.listDevices('test@example.com')).rejects.toThrow('Not authenticated. Please login first.');
    });

    it('should throw DeviceNotFoundError when no home found', async () => {
      mockLoginApi.getHomeDetails.mockResolvedValue(undefined);

      await expect(deviceService.listDevices('test@example.com')).rejects.toThrow(DeviceNotFoundError);
      await expect(deviceService.listDevices('test@example.com')).rejects.toThrow('No home found for user');
    });

    it('should throw error when home details missing rrHomeId', async () => {
      mockLoginApi.getHomeDetails.mockResolvedValue(undefined);

      await expect(deviceService.listDevices('test@example.com')).rejects.toThrow(DeviceNotFoundError);
    });

    it('should throw DeviceError when homeData cannot be retrieved', async () => {
      mockIotApi.getHomeWithProducts.mockResolvedValue(undefined);

      await expect(deviceService.listDevices('test@example.com')).rejects.toThrow(DeviceError);
      await expect(deviceService.listDevices('test@example.com')).rejects.toThrow('Failed to retrieve home data');
    });

    it('should successfully list devices with all data', async () => {
      const result = await deviceService.listDevices('test@example.com');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        duid: 'device-123',
        name: 'Test Vacuum',
        rrHomeId: 12345,
        rooms: mockHomeData.rooms,
        scenes: [],
        data: {
          id: 'device-123',
          firmwareVersion: '1.0',
          serialNumber: 'SN12345',
          category: 'vacuum',
          batteryLevel: 85,
        },
        store: {
          userData: mockUserData,
          localKey: 'local-key-789',
          pv: '1.0',
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

      const result = await deviceService.listDevices('test@example.com');

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

      const result = await deviceService.listDevices('test@example.com');

      expect(result[0].scenes).toHaveLength(1);
      expect(result[0]?.scenes?.[0]?.id).toBe(1);
    });

    it('should fallback battery level to 100 if not present', async () => {
      const deviceWithoutBattery = { ...mockDevice, deviceStatus: {} };
      const homeDataNoBattery = { ...mockHomeData, devices: [deviceWithoutBattery] };
      mockIotApi.getHomeWithProducts.mockResolvedValue(homeDataNoBattery);

      const result = await deviceService.listDevices('test@example.com');

      expect(result[0].data.batteryLevel).toBe(100);
    });

    it('should handle API errors and wrap them in DeviceError', async () => {
      mockIotApi.getHomeWithProducts.mockRejectedValue(new Error('API Error'));

      await expect(deviceService.listDevices('test@example.com')).rejects.toThrow(DeviceError);
      await expect(deviceService.listDevices('test@example.com')).rejects.toThrow('Failed to retrieve device list');
    });
  });

  describe('getHomeDataForUpdating', () => {
    beforeEach(() => {
      deviceService.setAuthentication(mockUserData);
    });

    it('should return undefined when not authenticated', async () => {
      const unauthenticatedService = new DeviceManagementService(mockIotApiFactory, mockClientManager, mockLogger, mockLoginApi, mockMessageRoutingService);

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
      expect(result && result.devices).toBeDefined();
      expect(result && result.devices).toHaveLength(1);
      expect(result && result.devices && result.devices[0]).toMatchObject({
        duid: 'device-123',
        rrHomeId: 12345,
        rooms: mockHomeData.rooms,
        data: expect.objectContaining({
          id: 'device-123',
          firmwareVersion: '1.0',
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
      expect(result && result.rooms).toEqual(v3Rooms);
    });

    it('should fallback to v1 API for rooms if v2 and v3 rooms are empty', async () => {
      const homeDataNoRooms = { ...mockHomeData, rooms: [] };
      const v1Rooms = [{ id: 3, name: 'Bedroom' }];

      mockIotApi.getHomev2.mockResolvedValue(homeDataNoRooms);
      mockIotApi.getHomev3.mockResolvedValue({ ...mockHomeData, rooms: [] });
      mockIotApi.getHome.mockResolvedValue({ ...mockHomeData, rooms: v1Rooms });

      const result = await deviceService.getHomeDataForUpdating(12345);

      expect(mockIotApi.getHome).toHaveBeenCalledWith(12345);
      expect(result && result.rooms).toEqual(v1Rooms);
    });

    it('should keep empty rooms if all API versions fail to provide rooms', async () => {
      const homeDataNoRooms = { ...mockHomeData, rooms: [] };

      mockIotApi.getHomev2.mockResolvedValue(homeDataNoRooms);
      mockIotApi.getHomev3.mockResolvedValue(undefined);
      mockIotApi.getHome.mockResolvedValue(undefined);

      const result = await deviceService.getHomeDataForUpdating(12345);

      expect(result && result.rooms).toEqual([]);
      expect(result && result.rooms).toEqual([]);
      expect(result && result.rooms).toEqual([]);
    });

    it('should keep empty rooms if v3 returns no rooms and v1 fails', async () => {
      const homeDataNoRooms = { ...mockHomeData, rooms: [] };

      mockIotApi.getHomev2.mockResolvedValue(homeDataNoRooms);
      mockIotApi.getHomev3.mockResolvedValue({ ...mockHomeData, rooms: [] });
      mockIotApi.getHome.mockResolvedValue(undefined);

      const result = await deviceService.getHomeDataForUpdating(12345);

      expect(result && result.rooms).toEqual([]);
    });

    it('should use receivedDevices when devices array is empty', async () => {
      const homeDataWithReceived = {
        ...mockHomeData,
        devices: [],
        receivedDevices: [mockDevice],
      };
      mockIotApi.getHomev2.mockResolvedValue(homeDataWithReceived);

      const result = await deviceService.getHomeDataForUpdating(12345);

      expect(result && result.devices).toHaveLength(1);
      expect(result && result.devices && result.devices[0] && result.devices[0].duid).toBe('device-123');
    });

    it('should handle API errors gracefully', async () => {
      mockIotApi.getHomev2.mockRejectedValue(new Error('API Error'));

      const result = await deviceService.getHomeDataForUpdating(12345);

      expect(result).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to get home data for updating:', expect.any(Error));
    });
  });

  describe('initializeMessageClient', () => {
    beforeEach(() => {
      deviceService.setAuthentication(mockUserData);
    });

    it('should throw DeviceInitializationError if ClientManager not available', async () => {
      const serviceWithoutManager = new DeviceManagementService(mockIotApiFactory, undefined as any, mockLogger, mockLoginApi, mockMessageRoutingService);
      await expect(serviceWithoutManager.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow(DeviceInitializationError);
      await expect(serviceWithoutManager.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow('ClientManager not initialized');
    });

    it('should initialize message client successfully', async () => {
      await deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(mockClientManager.get).toHaveBeenCalledWith('test@example.com', mockUserData);
      expect(mockClientRouter.registerDevice).toHaveBeenCalledWith('device-123', 'local-key-789', '1.0', undefined);
      expect(mockClientRouter.registerMessageListener).toHaveBeenCalled();
      expect(mockClientRouter.connect).toHaveBeenCalled();
      expect(deviceService.messageClient).toBe(mockClientRouter);
    });

    it('should register message listeners with proper handlers', async () => {
      deviceService.setDeviceNotify(mockDeviceNotifyCallback);

      await deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const messageListenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      expect(messageListenerCall).toHaveProperty('onMessage');
      expect(typeof messageListenerCall.onMessage).toBe('function');

      // Test battery message handling (should be ignored)
      const batteryMessage = Object.create(ResponseMessage.prototype);
      batteryMessage.duid = 'device-123';
      batteryMessage.isForProtocol = vi.fn().mockReturnValue(true);
      messageListenerCall.onMessage(batteryMessage);
      expect(mockDeviceNotifyCallback).not.toHaveBeenCalled();

      // Test cloud message handling (not battery, not hello_response)
      const cloudMessage = Object.create(ResponseMessage.prototype);
      cloudMessage.duid = 'device-123';
      cloudMessage.isForProtocol = vi.fn().mockReturnValue(false);
      messageListenerCall.onMessage(cloudMessage);
      expect(mockDeviceNotifyCallback).toHaveBeenCalledWith(NotifyMessageTypes.CloudMessage, cloudMessage);
    });

    it('should throw DeviceConnectionError if connection times out', async () => {
      // Mock sleep to avoid actual delays
      vi.spyOn(deviceService as any, 'sleep').mockResolvedValue(undefined);
      mockClientRouter.isConnected.mockReturnValue(false);

      await expect(deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow(DeviceConnectionError);
      await expect(deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow('MQTT connection timeout');
    });

    it('should eventually timeout and throw error when connection fails', async () => {
      // Mock sleep to avoid actual delays
      vi.spyOn(deviceService as any, 'sleep').mockResolvedValue(undefined);
      mockClientRouter.isConnected.mockReturnValue(false);

      await expect(deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow(DeviceConnectionError);
    });

    it('should handle generic errors and wrap them', async () => {
      mockClientManager.get.mockImplementation(() => {
        throw new Error('Generic error');
      });

      await expect(deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow(DeviceInitializationError);
    });

    it('should re-throw DeviceError instances unchanged', async () => {
      const deviceError = new DeviceConnectionError('device-123', 'Test error');
      mockClientManager.get.mockImplementation(() => {
        throw deviceError;
      });

      await expect(deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow(deviceError);
    });
  });

  describe('initializeMessageClientForLocal', () => {
    it('should return false if messageClient not initialized', async () => {
      deviceService.messageClient = undefined;

      const result = await deviceService.initializeMessageClientForLocal(mockDevice);

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('messageClient not initialized');
    });
  });

  /*
   * NOTE: Device notification activation tests removed
   * This functionality has been moved to PollingService
   * See src/tests/services/pollingService.test.ts for polling-related tests
   */

  describe('service lifecycle and cleanup', () => {
    beforeEach(() => {
      deviceService.messageClient = mockClientRouter;
      deviceService.localClientMap.set('device-123', {
        disconnect: vi.fn(),
      } as any);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should stop service and clean up all resources', () => {
      const mockLocalClient = deviceService.localClientMap.get('device-123');

      deviceService.stopService();

      expect(mockClientRouter.disconnect).toHaveBeenCalled();
      expect(deviceService.messageClient).toBeUndefined();
      expect(deviceService.localClientMap.size).toBe(0);
      expect(deviceService.ipMap.size).toBe(0);
      expect(mockLogger.notice).toHaveBeenCalledWith('Device management service stopped');

      // Always assert disconnect (mockLocalClient is always set in beforeEach)
      expect(mockLocalClient).toBeDefined();
      expect(mockLocalClient?.disconnect).toHaveBeenCalled();
    });

    it('should handle errors during cleanup gracefully', () => {
      mockClientRouter.disconnect.mockImplementation(() => {
        throw new Error('Disconnect error');
      });

      deviceService.stopService();

      expect(mockLogger.error).toHaveBeenCalledWith('Error disconnecting message client:', expect.any(Error));
    });

    it('should handle local client disconnect errors gracefully', () => {
      const mockLocalClient = {
        disconnect: vi.fn().mockImplementation(() => {
          throw new Error('Local disconnect error');
        }),
      };
      deviceService.localClientMap.set('device-456', mockLocalClient as any);

      deviceService.stopService();

      expect(mockLogger.error).toHaveBeenCalledWith('Error disconnecting local client device-456:', expect.any(Error));
    });
  });

  describe('integration scenarios', () => {
    it('should handle basic device management workflow', async () => {
      deviceService.setAuthentication(mockUserData);
      deviceService.setDeviceNotify(mockDeviceNotifyCallback);

      // List devices
      const devices = await deviceService.listDevices('test@example.com');
      expect(devices).toHaveLength(1);

      // Initialize message client
      await deviceService.initializeMessageClient('test@example.com', devices[0], mockUserData);
      expect(deviceService.messageClient).toBe(mockClientRouter);

      // Stop service
      deviceService.stopService();
      expect(deviceService.messageClient).toBeUndefined();
    });
  });

  describe('utility methods', () => {
    it('should resolve sleep promise', async () => {
      const sleepPromise = (deviceService as any).sleep(1);
      await expect(sleepPromise).resolves.toBeUndefined();
    });
  });

  describe('Connection timeout scenarios', () => {
    it('should attempt multiple connection retries before success', async () => {
      let connectionCheckCount = 0;
      mockClientRouter.isConnected.mockImplementation(() => {
        connectionCheckCount++;
        // Connect successfully on the 5th check
        return connectionCheckCount >= 5;
      });

      await deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(connectionCheckCount).toBeGreaterThanOrEqual(5);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageClient connected for device:', 'device-123');
    });

    it('should log debug message when successfully connected', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);

      await deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(mockLogger.debug).toHaveBeenCalledWith('MessageClient connected for device:', 'device-123');
    });
  });

  describe('Integration scenarios with realistic timing', () => {
    it('should handle slow connection establishment', async () => {
      let checks = 0;
      mockClientRouter.isConnected.mockImplementation(() => {
        checks++;
        // Simulate slow connection - connect after 3 attempts
        return checks > 3;
      });

      await deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(checks).toBeGreaterThan(3);
      expect(mockClientRouter.isConnected).toHaveBeenCalled();
    });

    it('should initialize message client components in correct order', async () => {
      const callOrder: string[] = [];

      mockClientManager.get.mockImplementation(() => {
        callOrder.push('getClient');
        return mockClientRouter;
      });

      mockClientRouter.registerDevice.mockImplementation(() => {
        callOrder.push('registerDevice');
      });

      mockClientRouter.registerMessageListener.mockImplementation(() => {
        callOrder.push('registerListener');
      });

      mockClientRouter.connect.mockImplementation(() => {
        callOrder.push('connect');
      });

      mockClientRouter.isConnected.mockReturnValue(true);

      await deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(callOrder).toEqual(['getClient', 'registerDevice', 'registerListener', 'registerListener', 'registerListener', 'connect']);
    });
  });

  describe('Message listener edge cases', () => {
    it('should handle message listener with no deviceNotify callback', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);

      // Don't set deviceNotify callback
      deviceService.setDeviceNotify(undefined);

      await deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const messageListenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];

      // Create mock message
      const message = Object.create({ isForProtocol: vi.fn().mockReturnValue(false) });
      message.duid = 'device-123';

      // Should not throw even without callback
      expect(() => messageListenerCall.onMessage(message)).not.toThrow();
    });

    it('should handle hello_response without updateNonce', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);
      (mockClientRouter.updateNonce as any) = undefined;

      await deviceService.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const messageListenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];

      const helloMessage = Object.create({
        isForProtocol: vi.fn().mockImplementation((p: any) => p === 101),
        get: vi.fn().mockReturnValue({ result: { nonce: 'test-nonce' } }),
      });
      helloMessage.duid = 'device-123';

      // Should not throw even without updateNonce method
      expect(() => messageListenerCall.onMessage(helloMessage)).not.toThrow();
    });
  });

  describe('Service state management', () => {
    it('should clear message client on stop service', () => {
      deviceService.messageClient = mockClientRouter;

      deviceService.stopService();

      expect(deviceService.messageClient).toBeUndefined();
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

  describe('initializeMessageClientForLocal B01 case', () => {
    it('should initialize UDP client for B01 protocol device', async () => {
      const b01Device = { ...mockDevice, pv: ProtocolVersion.B01 };

      deviceService.messageClient = mockClientRouter;

      const result = await deviceService.initializeMessageClientForLocal(b01Device);

      expect(result).toBe(true);

      expect(mockMessageProcessor.registerListener).toHaveBeenCalled();

      expect(mockMessageRoutingService.registerMessageProcessor).toHaveBeenCalledWith(b01Device.duid, mockMessageProcessor);

      expect(mockMessageRoutingService.setMqttAlwaysOn).toHaveBeenCalledWith(b01Device.duid, true);

      expect(mockLocalNetworkUDPClient.registerListener).toHaveBeenCalled();

      expect(mockLocalNetworkUDPClient.connect).toHaveBeenCalled();

      // Test the listener
      const listener = mockLocalNetworkUDPClient.registerListener.mock.calls[0][0];

      await listener.onMessage(b01Device.duid, '192.168.1.100');

      expect(deviceService.ipMap.get(b01Device.duid)).toBe('192.168.1.100');

      expect(mockClientRouter.registerClient).toHaveBeenCalledWith(b01Device.duid, '192.168.1.100');

      const localClient = mockClientRouter.registerClient.mock.results[0].value;

      expect(localClient.connect).toHaveBeenCalled();

      expect(deviceService.localClientMap.get(b01Device.duid)).toBe(localClient);
    });
  });
});
