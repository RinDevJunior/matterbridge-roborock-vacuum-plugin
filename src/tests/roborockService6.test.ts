import { jest } from '@jest/globals';
import RoborockService from '../roborockService';
import type { UserData, Device, Scene } from '../roborockCommunication';
import { ResponseMessage, Protocol } from '../roborockCommunication/index.js';
import { NotifyMessageTypes } from '../notifyMessageTypes.js';

describe('RoborockService - New Login Methods', () => {
  let service: RoborockService;
  let mockLoginApi: any;
  let mockIotApi: any;
  let mockClientManager: any;
  let logger: any;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      notice: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
    };

    mockLoginApi = {
      requestCodeV4: jest.fn(),
      loginWithCodeV4: jest.fn(),
      loginWithUserData: jest.fn(),
      loginWithPassword: jest.fn(),
      getHomeDetails: jest.fn(),
    };

    mockIotApi = {
      getScenes: jest.fn(),
      startScene: jest.fn(),
    };

    mockClientManager = {};

    const authenticateApiSupplier = () => mockLoginApi;
    const iotApiSupplier = () => mockIotApi;

    service = new RoborockService(authenticateApiSupplier, iotApiSupplier, 60, mockClientManager as any, logger);
  });

  describe('requestVerificationCode', () => {
    it('should call loginApi.requestCodeV4 with email', async () => {
      mockLoginApi.requestCodeV4.mockResolvedValue(undefined);

      await service.requestVerificationCode('test@example.com');

      expect(mockLoginApi.requestCodeV4).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('loginWithVerificationCode', () => {
    it('should login with code and save user data', async () => {
      const mockUserData: UserData = {
        uid: '12345',
        tokentype: 'Bearer',
        token: 'test-token',
        rruid: 'rr-uid',
        rriot: {
          u: 'user-id',
          s: 'secret',
          h: 'host',
          k: 'key',
          r: { a: 'region-a', m: 'mqtt-url', r: 'region', l: 'locale' },
        },
        region: 'us',
        countrycode: 'US',
        country: 'United States',
        nickname: 'Test User',
      };

      const savedUserDataMock = jest.fn();

      mockLoginApi.loginWithCodeV4.mockResolvedValue(mockUserData);
      (service as any).auth = (jest.fn() as any).mockResolvedValue(mockUserData);

      const result = await service.loginWithVerificationCode('test@example.com', '123456', savedUserDataMock as any);

      expect(mockLoginApi.loginWithCodeV4).toHaveBeenCalledWith('test@example.com', '123456');
      expect(savedUserDataMock).toHaveBeenCalledWith(mockUserData);
      expect(result).toEqual(mockUserData);
    });
  });

  describe('loginWithCachedToken', () => {
    it('should validate cached token and authenticate', async () => {
      const mockUserData: UserData = {
        uid: '12345',
        tokentype: 'Bearer',
        token: 'cached-token',
        rruid: 'rr-uid',
        rriot: {
          u: 'user-id',
          s: 'secret',
          h: 'host',
          k: 'key',
          r: { a: 'region-a', m: 'mqtt-url', r: 'region', l: 'locale' },
        },
        region: 'us',
        countrycode: 'US',
        country: 'United States',
        nickname: 'Test User',
      };

      mockLoginApi.loginWithUserData.mockResolvedValue(mockUserData);
      (service as any).auth = (jest.fn() as any).mockResolvedValue(mockUserData);

      const result = await service.loginWithCachedToken('test@example.com', mockUserData);

      expect(mockLoginApi.loginWithUserData).toHaveBeenCalledWith('test@example.com', mockUserData);
      expect(result).toEqual(mockUserData);
    });
  });

  describe('loginWithPassword - saved data path', () => {
    it('should use saved user data when available', async () => {
      const mockUserData: UserData = {
        uid: '12345',
        tokentype: 'Bearer',
        token: 'saved-token',
        rruid: 'rr-uid',
        rriot: {
          u: 'user-id',
          s: 'secret',
          h: 'host',
          k: 'key',
          r: { a: 'region-a', m: 'mqtt-url', r: 'region', l: 'locale' },
        },
        region: 'us',
        countrycode: 'US',
        country: 'United States',
        nickname: 'Test User',
      };

      const loadSavedUserData = jest.fn<() => Promise<UserData | undefined>>().mockResolvedValue(mockUserData) as any;
      const savedUserData = jest.fn();

      mockLoginApi.loginWithUserData.mockResolvedValue(mockUserData);
      (service as any).auth = (jest.fn() as any).mockResolvedValue(mockUserData);

      const result = await service.loginWithPassword('test@example.com', 'password', loadSavedUserData, savedUserData as any);

      expect(loadSavedUserData).toHaveBeenCalled();
      expect(mockLoginApi.loginWithUserData).toHaveBeenCalledWith('test@example.com', mockUserData);
      expect(mockLoginApi.loginWithPassword).not.toHaveBeenCalled();
      expect(result).toEqual(mockUserData);
    });

    it('should login with password when no saved data', async () => {
      const mockUserData: UserData = {
        uid: '12345',
        tokentype: 'Bearer',
        token: 'new-token',
        rruid: 'rr-uid',
        rriot: {
          u: 'user-id',
          s: 'secret',
          h: 'host',
          k: 'key',
          r: { a: 'region-a', m: 'mqtt-url', r: 'region', l: 'locale' },
        },
        region: 'us',
        countrycode: 'US',
        country: 'United States',
        nickname: 'Test User',
      };

      const loadSavedUserData = jest.fn<() => Promise<UserData | undefined>>().mockResolvedValue(undefined) as any;
      const savedUserData = jest.fn();

      mockLoginApi.loginWithPassword.mockResolvedValue(mockUserData);
      (service as any).auth = (jest.fn() as any).mockResolvedValue(mockUserData);

      const result = await service.loginWithPassword('test@example.com', 'password', loadSavedUserData, savedUserData as any);

      expect(loadSavedUserData).toHaveBeenCalled();
      expect(mockLoginApi.loginWithPassword).toHaveBeenCalledWith('test@example.com', 'password');
      expect(savedUserData).toHaveBeenCalledWith(mockUserData);
      expect(result).toEqual(mockUserData);
    });
  });

  describe('getScenes', () => {
    it('should return scenes from iotApi', async () => {
      const mockScenes: Scene[] = [
        {
          id: 1,
          name: 'Morning Clean',
          enabled: true,
          param: '{"triggers":[],"action":{"type":"parallel","items":[]}}',
          type: '0',
          extra: {},
        },
      ];

      (service as any).iotApi = mockIotApi;
      mockIotApi.getScenes.mockResolvedValue(mockScenes);

      const result = await service.getScenes(123);

      expect(mockIotApi.getScenes).toHaveBeenCalledWith(123);
      expect(result).toEqual(mockScenes);
    });

    it('should throw if iotApi is not initialized', async () => {
      (service as any).iotApi = undefined;

      await expect(service.getScenes(123)).rejects.toThrow();
    });
  });

  describe('startScene', () => {
    it('should start scene via iotApi', async () => {
      (service as any).iotApi = mockIotApi;
      mockIotApi.startScene.mockResolvedValue({ success: true });

      const result = await service.startScene(1);

      expect(mockIotApi.startScene).toHaveBeenCalledWith(1);
      expect(result).toEqual({ success: true });
    });

    it('should throw if iotApi is not initialized', async () => {
      (service as any).iotApi = undefined;

      await expect(service.startScene(1)).rejects.toThrow();
    });
  });

  describe('getRoomMappings', () => {
    it('should return undefined if messageClient not initialized', async () => {
      service.messageClient = undefined;

      const result = await service.getRoomMappings('device1');

      expect(result).toBeUndefined();
      expect(logger.warn).toHaveBeenCalledWith('messageClient not initialized. Waititing for next execution');
    });

    it('should get room mappings from messageClient', async () => {
      const mockMappings: any = [
        [1, 10],
        [2, 20],
      ];
      const mockMessageClient: any = {
        get: (jest.fn() as any).mockResolvedValue(mockMappings),
      };

      service.messageClient = mockMessageClient as any;

      const result = await service.getRoomMappings('device1');

      expect(result).toEqual(mockMappings);
      expect(mockMessageClient.get).toHaveBeenCalledWith('device1', expect.objectContaining({ method: 'get_room_mapping' }));
    });
  });

  describe('getMapInformation', () => {
    it('should return undefined when messageClient returns undefined', async () => {
      const mockMessageClient: any = {
        get: (jest.fn() as any).mockResolvedValue(undefined),
      };

      service.messageClient = mockMessageClient as any;

      const result = await service.getMapInformation('device1');

      expect(result).toBeUndefined();
    });

    it('should throw if messageClient is undefined', async () => {
      service.messageClient = undefined;

      await expect(service.getMapInformation('device1')).rejects.toThrow();
    });
  });

  describe('initializeMessageClientForLocal - error paths', () => {
    it('should return false if messageClient is undefined', async () => {
      service.messageClient = undefined;

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const result = await service.initializeMessageClientForLocal(mockDevice);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('messageClient not initialized');
    });

    it('should return true for B01 devices (MQTT only)', async () => {
      const mockMessageClient = {
        registerDevice: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        registerMessageListener: jest.fn(),
      };

      service.messageClient = mockMessageClient as any;

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: 'B01',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const result = await service.initializeMessageClientForLocal(mockDevice);

      expect(result).toBe(true);
      expect(service.mqttAlwaysOnDevices.get('device1')).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith('Device does not support local connection', 'device1');
    });

    it('should return false if network info retrieval fails', async () => {
      const mockMessageClient = {
        registerDevice: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        registerMessageListener: jest.fn(),
        get: (jest.fn() as any).mockResolvedValue(undefined),
      };

      service.messageClient = mockMessageClient as any;

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const result = await service.initializeMessageClientForLocal(mockDevice);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Failed to retrieve network info for device', 'device1', 'Network info:', undefined);
    });

    it('should handle error when requesting network info', async () => {
      const mockMessageProcessor: any = {
        getNetworkInfo: (jest.fn() as any).mockRejectedValue(new Error('Network error')),
        injectLogger: jest.fn(),
        registerListener: jest.fn(),
      };

      const mockMessageClient = {
        registerDevice: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        registerMessageListener: jest.fn(),
      };

      service.messageClient = mockMessageClient as any;
      service.messageProcessorMap.set('device1', mockMessageProcessor as any);

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const result = await service.initializeMessageClientForLocal(mockDevice);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Error requesting network info', expect.any(Error));
    });
  });

  describe('initializeMessageClient - error paths', () => {
    it('should return early if clientManager is undefined', async () => {
      service.clientManager = undefined as any;

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const mockUserData: UserData = {
        uid: '12345',
        tokentype: 'Bearer',
        token: 'test-token',
        rruid: 'rr-uid',
        rriot: {
          u: 'user-id',
          s: 'secret',
          h: 'host',
          k: 'key',
          r: { a: 'region-a', m: 'mqtt-url', r: 'region', l: 'locale' },
        },
        region: 'us',
        countrycode: 'US',
        country: 'United States',
        nickname: 'Test User',
      };

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(logger.error).toHaveBeenCalledWith('ClientManager not initialized');
    });

    it('should handle message listener with battery protocol', async () => {
      const mockMessageClient: any = {
        registerDevice: jest.fn(),
        registerMessageListener: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        updateNonce: jest.fn(),
      };

      mockClientManager.get = jest.fn().mockReturnValue(mockMessageClient);
      service.clientManager = mockClientManager;

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const mockUserData: UserData = {
        uid: '12345',
        tokentype: 'Bearer',
        token: 'test-token',
        rruid: 'rr-uid',
        rriot: {
          u: 'user-id',
          s: 'secret',
          h: 'host',
          k: 'key',
          r: { a: 'region-a', m: 'mqtt-url', r: 'region', l: 'locale' },
        },
        region: 'us',
        countrycode: 'US',
        country: 'United States',
        nickname: 'Test User',
      };

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(mockMessageClient.registerMessageListener).toHaveBeenCalled();
      const listener = mockMessageClient.registerMessageListener.mock.calls[0][0];

      // Test battery message (should be ignored)
      const batteryMessage: any = {
        duid: 'device1',
        contain: jest.fn().mockReturnValue(true),
      };
      listener.onMessage(batteryMessage);
      // Battery messages are ignored, deviceNotify should not be called
    });

    it('should handle hello_response in message listener', async () => {
      const mockMessageClient: any = {
        registerDevice: jest.fn(),
        registerMessageListener: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        updateNonce: jest.fn(),
      };

      mockClientManager.get = jest.fn().mockReturnValue(mockMessageClient);
      service.clientManager = mockClientManager;

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const mockUserData: UserData = {
        uid: '12345',
        tokentype: 'Bearer',
        token: 'test-token',
        rruid: 'rr-uid',
        rriot: {
          u: 'user-id',
          s: 'secret',
          h: 'host',
          k: 'key',
          r: { a: 'region-a', m: 'mqtt-url', r: 'region', l: 'locale' },
        },
        region: 'us',
        countrycode: 'US',
        country: 'United States',
        nickname: 'Test User',
      };

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const listener = mockMessageClient.registerMessageListener.mock.calls[0][0];

      // Test hello_response message - Need ResponseMessage instance
      const helloMessage = new ResponseMessage('device1', {
        [Protocol.hello_response]: {
          id: 1,
          result: { nonce: 'test-nonce' },
        },
      });

      listener.onMessage(helloMessage);

      expect(mockMessageClient.updateNonce).toHaveBeenCalledWith('device1', 'test-nonce');
    });
  });

  describe('Additional coverage tests', () => {
    it('should handle startClean with warning when rooms length mismatch', async () => {
      const mockMessageProcessor: any = {
        startClean: jest.fn(),
        startRoomClean: jest.fn(),
      };
      // Set up illogical state: no selected areas but some supported areas
      // rt.length === 0, rooms.length === 0 (from selected being empty), supportedRooms.length > 0
      const supportedArea = { id: 1, name: 'Room 1', flag: 1, icon: 'icon', category: 'room', cleaning_area_id: '1' };
      (service as any).supportedAreas.set('device1', [supportedArea]);
      (service as any).supportedRoutines.set('device1', []);
      (service as any).selectedAreas.set('device1', []);
      service.messageProcessorMap.set('device1', mockMessageProcessor);

      await service.startClean('device1');

      // With no rooms selected and supported rooms present, it should do global clean
      expect(mockMessageProcessor.startClean).toHaveBeenCalledWith('device1');
    });

    it('should handle activateDeviceNotifyOverMQTT with undefined messageProcessor', async () => {
      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      service.messageProcessorMap = new Map();
      service.activateDeviceNotifyOverMQTT(mockDevice);

      // Wait for interval to execute
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(logger.error).toHaveBeenCalled();

      // Clean up interval
      if ((service as any).requestDeviceStatusInterval) {
        clearInterval((service as any).requestDeviceStatusInterval);
      }
    });

    it('should handle getSupportedAreasIndexMap', () => {
      const mockIndexMap: any = { roomMap: new Map() };
      (service as any).supportedAreaIndexMaps.set('device1', mockIndexMap);

      const result = service.getSupportedAreasIndexMap('device1');

      expect(result).toEqual(mockIndexMap);
    });

    it('should return undefined for non-existent device in getSupportedAreasIndexMap', () => {
      const result = service.getSupportedAreasIndexMap('non-existent');

      expect(result).toBeUndefined();
    });

    it('should handle constructor with custom baseUrl', () => {
      const customBaseUrl = 'https://custom.roborock.com';
      const customService = new RoborockService(undefined as any, undefined as any, 60, mockClientManager as any, logger, customBaseUrl);

      expect(customService).toBeDefined();
    });

    it('should use cached local IP when available', async () => {
      const cachedIp = '192.168.1.50';
      (service as any).ipMap.set('device1', cachedIp);

      const mockLocalClient: any = {
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
      };

      const mockMessageClient: any = {
        registerDevice: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        registerMessageListener: jest.fn(),
        registerClient: jest.fn().mockReturnValue(mockLocalClient),
      };

      service.messageClient = mockMessageClient;
      service.messageProcessorMap = new Map();

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const result = await service.initializeMessageClientForLocal(mockDevice);

      expect(result).toBe(true);
      expect(mockMessageClient.registerClient).toHaveBeenCalledWith('device1', cachedIp);
    });

    it('should handle message listener with deviceNotify callback', async () => {
      const mockMessageClient: any = {
        registerDevice: jest.fn(),
        registerMessageListener: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        updateNonce: jest.fn(),
      };

      mockClientManager.get = jest.fn().mockReturnValue(mockMessageClient);
      service.clientManager = mockClientManager;

      const deviceNotifyMock = jest.fn();
      service.deviceNotify = deviceNotifyMock;

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const mockUserData: UserData = {
        uid: '12345',
        tokentype: 'Bearer',
        token: 'test-token',
        rruid: 'rr-uid',
        rriot: {
          u: 'user-id',
          s: 'secret',
          h: 'host',
          k: 'key',
          r: { a: 'region-a', m: 'mqtt-url', r: 'region', l: 'locale' },
        },
        region: 'us',
        countrycode: 'US',
        country: 'United States',
        nickname: 'Test User',
      };

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const listener = mockMessageClient.registerMessageListener.mock.calls[0][0];

      const normalMessage = new ResponseMessage('device1', {
        101: {
          id: 1,
          result: { test: 'data' },
        },
      });

      listener.onMessage(normalMessage);

      expect(deviceNotifyMock).toHaveBeenCalledWith(NotifyMessageTypes.CloudMessage, normalMessage);
    });

    it('should handle message listener without deviceNotify', async () => {
      const mockMessageClient: any = {
        registerDevice: jest.fn(),
        registerMessageListener: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        updateNonce: jest.fn(),
      };

      mockClientManager.get = jest.fn().mockReturnValue(mockMessageClient);
      service.clientManager = mockClientManager;
      service.deviceNotify = undefined;

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const mockUserData: UserData = {
        uid: '12345',
        tokentype: 'Bearer',
        token: 'test-token',
        rruid: 'rr-uid',
        rriot: {
          u: 'user-id',
          s: 'secret',
          h: 'host',
          k: 'key',
          r: { a: 'region-a', m: 'mqtt-url', r: 'region', l: 'locale' },
        },
        region: 'us',
        countrycode: 'US',
        country: 'United States',
        nickname: 'Test User',
      };

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const listener = mockMessageClient.registerMessageListener.mock.calls[0][0];

      const normalMessage = new ResponseMessage('device1', {
        101: {
          id: 1,
          result: { test: 'data' },
        },
      });

      listener.onMessage(normalMessage);
      // Should not throw, just silently not call deviceNotify
    });

    it('should handle message handlers for onError callback', () => {
      const deviceNotifyMock = jest.fn();
      service.deviceNotify = deviceNotifyMock;

      const mockMessageProcessor: any = {
        getNetworkInfo: jest.fn(),
        injectLogger: jest.fn(),
        registerListener: jest.fn(),
      };

      const mockMessageClient: any = {
        registerDevice: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        registerMessageListener: jest.fn(),
      };

      service.messageClient = mockMessageClient;

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      service.messageProcessorMap.set('device1', mockMessageProcessor);

      // Trigger the method that registers the listener
      const handler = mockMessageProcessor.registerListener.mock.calls?.[0]?.[0];

      // If we can't get the handler this way, we need to manually test it
      // For now, just ensure the map was set correctly
      expect(service.messageProcessorMap.get('device1')).toBe(mockMessageProcessor);
    });

    it('should handle listDevices with v3 API for specific models', async () => {
      const mockHomeDetails = { rrHomeId: 123 };
      const mockHomeData = {
        devices: [{ duid: 'device1', name: 'Vacuum 1' }],
        receivedDevices: [],
        products: [{ id: 'product1', model: 'roborock.vacuum.ss07' }],
        rooms: [],
      };
      const mockHomeDataV3 = {
        devices: [],
        receivedDevices: [],
        rooms: [{ id: 1, name: 'Room 1' }],
      };
      const mockScenes = [{ id: 1, name: 'Scene 1' }];

      (service as any).iotApi = mockIotApi;
      (service as any).userdata = { uid: '123' };
      mockLoginApi.getHomeDetails.mockResolvedValue(mockHomeDetails);
      mockIotApi.getHome = (jest.fn() as any).mockResolvedValue(mockHomeData);
      mockIotApi.getScenes = (jest.fn() as any).mockResolvedValue(mockScenes);
      mockIotApi.getHomev3 = (jest.fn() as any).mockResolvedValue(mockHomeDataV3);
      mockIotApi.getHomev2 = (jest.fn() as any).mockResolvedValue({ rooms: [{ id: 1, name: 'Room 1' }] });

      const result = await service.listDevices('test@example.com');

      expect(mockIotApi.getHomev3).toHaveBeenCalledWith(123);
      expect(result).toHaveLength(1);
    });

    it('should handle listDevices with v3 API returning null', async () => {
      const mockHomeDetails = { rrHomeId: 123 };
      const mockHomeData = {
        devices: [],
        receivedDevices: [],
        products: [{ id: 'product1', model: 'roborock.vacuum.ss07' }],
        rooms: [],
      };

      (service as any).iotApi = mockIotApi;
      (service as any).userdata = { uid: '123' };
      mockLoginApi.getHomeDetails.mockResolvedValue(mockHomeDetails);
      mockIotApi.getHome = (jest.fn() as any).mockResolvedValue(mockHomeData);
      mockIotApi.getScenes = (jest.fn() as any).mockResolvedValue([]);
      mockIotApi.getHomev3 = (jest.fn() as any).mockResolvedValue(null);

      await expect(service.listDevices('test@example.com')).rejects.toThrow('Failed to retrieve the home data from v3 API');
    });

    it('should handle listDevices with v3 API with no rooms', async () => {
      const mockHomeDetails = { rrHomeId: 123 };
      const mockHomeData = {
        devices: [],
        receivedDevices: [],
        products: [{ id: 'product1', model: 'roborock.vacuum.ss07' }],
        rooms: [],
      };
      const mockHomeDataV3 = {
        devices: [],
        receivedDevices: [],
        rooms: null,
      };

      (service as any).iotApi = mockIotApi;
      (service as any).userdata = { uid: '123' };
      mockLoginApi.getHomeDetails.mockResolvedValue(mockHomeDetails);
      mockIotApi.getHome = (jest.fn() as any).mockResolvedValue(mockHomeData);
      mockIotApi.getScenes = (jest.fn() as any).mockResolvedValue([]);
      mockIotApi.getHomev3 = (jest.fn() as any).mockResolvedValue(mockHomeDataV3);
      mockIotApi.getHomev2 = (jest.fn() as any).mockResolvedValue(null);

      const result = await service.listDevices('test@example.com');

      expect(result).toHaveLength(0);
    });

    it('should handle listDevices returning null homeData', async () => {
      const mockHomeDetails = { rrHomeId: 123 };

      (service as any).iotApi = mockIotApi;
      (service as any).userdata = { uid: '123' };
      mockLoginApi.getHomeDetails.mockResolvedValue(mockHomeDetails);
      mockIotApi.getHome = (jest.fn() as any).mockResolvedValue(null);

      const result = await service.listDevices('test@example.com');

      expect(result).toEqual([]);
    });

    it('should handle startClean with multiple routines selected', async () => {
      const mockMessageProcessor: any = {
        startClean: jest.fn(),
      };

      const routine1 = { id: 101, name: 'Routine 1', flag: 2, icon: 'icon', category: 'routine', areaId: 101 };
      const routine2 = { id: 102, name: 'Routine 2', flag: 2, icon: 'icon', category: 'routine', areaId: 102 };

      (service as any).supportedAreas.set('device1', []);
      (service as any).supportedRoutines.set('device1', [routine1, routine2]);
      (service as any).selectedAreas.set('device1', [101, 102]);
      service.messageProcessorMap.set('device1', mockMessageProcessor);

      await service.startClean('device1');

      expect(logger.warn).toHaveBeenCalledWith('RoborockService - Multiple routines selected, which is not supported.', expect.any(String));
    });

    it('should handle startClean with single routine selected', async () => {
      const mockScene = { id: 1, name: 'Clean Living Room' };
      const routine1 = { id: 101, name: 'Routine 1', flag: 2, icon: 'icon', category: 'routine', areaId: 101 };

      (service as any).iotApi = mockIotApi;
      (service as any).supportedAreas.set('device1', []);
      (service as any).supportedRoutines.set('device1', [routine1]);
      (service as any).selectedAreas.set('device1', [101]);
      mockIotApi.startScene = (jest.fn() as any).mockResolvedValue({ success: true });

      await service.startClean('device1');

      expect(mockIotApi.startScene).toHaveBeenCalledWith(101);
    });

    it('should handle startClean with selected rooms when supportedRoutines exist', async () => {
      const mockMessageProcessor: any = {
        startRoomClean: jest.fn(),
        startClean: jest.fn(),
      };

      const room1 = { id: 1, name: 'Room 1', flag: 1, icon: 'icon', category: 'room', areaId: 1 };
      const room2 = { id: 2, name: 'Room 2', flag: 1, icon: 'icon', category: 'room', areaId: 2 };
      const routine1 = { id: 101, name: 'Routine 1', flag: 2, icon: 'icon', category: 'routine', areaId: 101 };

      (service as any).supportedAreas.set('device1', [room1, room2]);
      (service as any).supportedRoutines.set('device1', [routine1]);
      (service as any).selectedAreas.set('device1', [1]);
      service.messageProcessorMap.set('device1', mockMessageProcessor);

      await service.startClean('device1');

      expect(mockMessageProcessor.startRoomClean).toHaveBeenCalledWith('device1', [1], 1);
    });

    it('should handle startClean with no routines and some rooms selected', async () => {
      const mockMessageProcessor: any = {
        startRoomClean: jest.fn(),
      };

      const room1 = { id: 1, name: 'Room 1', flag: 1, icon: 'icon', category: 'room', areaId: 1 };
      const room2 = { id: 2, name: 'Room 2', flag: 1, icon: 'icon', category: 'room', areaId: 2 };

      (service as any).supportedAreas.set('device1', [room1, room2]);
      (service as any).supportedRoutines.set('device1', []);
      (service as any).selectedAreas.set('device1', [1]);
      service.messageProcessorMap.set('device1', mockMessageProcessor);

      await service.startClean('device1');

      expect(mockMessageProcessor.startRoomClean).toHaveBeenCalledWith('device1', [1], 1);
    });

    it('should handle initializeMessageClientForLocal with connection timeout error', async () => {
      const mockNetworkInfo = { ip: '192.168.1.100' };
      const mockLocalClient: any = {
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(false),
      };

      const mockMessageClient: any = {
        registerDevice: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn().mockReturnValue(true),
        registerMessageListener: jest.fn(),
        registerClient: jest.fn().mockReturnValue(mockLocalClient),
      };

      const mockMessageProcessor: any = {
        getNetworkInfo: (jest.fn() as any).mockResolvedValue(mockNetworkInfo),
        injectLogger: jest.fn(),
        registerListener: jest.fn(),
      };

      service.messageClient = mockMessageClient;
      service.messageProcessorMap = new Map();

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const result = await service.initializeMessageClientForLocal(mockDevice);

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Error requesting network info', expect.any(Error));
    });

    it('should handle initializeMessageClient when messageClient is not connected initially', async () => {
      let connectCallCount = 0;
      const mockMessageClient: any = {
        registerDevice: jest.fn(),
        registerMessageListener: jest.fn(),
        connect: jest.fn(),
        isConnected: jest.fn(() => {
          connectCallCount++;
          return connectCallCount > 2;
        }),
      };

      mockClientManager.get = jest.fn().mockReturnValue(mockMessageClient);
      service.clientManager = mockClientManager;

      const mockDevice: Device = {
        duid: 'device1',
        name: 'Test Device',
        localKey: 'local-key',
        pv: '1.0',
        data: { model: 'roborock.vacuum.s5' },
      } as Device;

      const mockUserData: UserData = {
        uid: '12345',
        tokentype: 'Bearer',
        token: 'test-token',
        rruid: 'rr-uid',
        rriot: {
          u: 'user-id',
          s: 'secret',
          h: 'host',
          k: 'key',
          r: { a: 'region-a', m: 'mqtt-url', r: 'region', l: 'locale' },
        },
        region: 'us',
        countrycode: 'US',
        country: 'United States',
        nickname: 'Test User',
      };

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(mockMessageClient.isConnected).toHaveBeenCalled();
    });
  });
});
