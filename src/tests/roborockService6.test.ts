import { jest } from '@jest/globals';
import RoborockService from '../roborockService';
import type { UserData, Device, Scene } from '../roborockCommunication';

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
      (service as any).auth = jest.fn().mockResolvedValue(mockUserData) as any;

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
      (service as any).auth = jest.fn().mockResolvedValue(mockUserData) as any;

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
      (service as any).auth = jest.fn().mockResolvedValue(mockUserData) as any;

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
      (service as any).auth = jest.fn().mockResolvedValue(mockUserData) as any;

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
        get: jest.fn().mockResolvedValue(mockMappings) as any,
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
        get: jest.fn().mockResolvedValue(undefined) as any,
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
        get: jest.fn().mockResolvedValue(undefined) as any,
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
        getNetworkInfo: jest.fn().mockRejectedValue(new Error('Network error')) as any,
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
  });
});
