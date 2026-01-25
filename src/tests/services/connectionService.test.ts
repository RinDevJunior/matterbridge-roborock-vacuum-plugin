import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionService } from '../../services/connectionService.js';
import ClientManager from '../../services/clientManager.js';
import { DeviceConnectionError, DeviceInitializationError } from '../../errors/index.js';
import { NotifyMessageTypes } from '../../types/notifyMessageTypes.js';
import { Device, HeaderMessage, ResponseMessage, UserData } from '../../roborockCommunication/models/index.js';
import { ClientRouter } from '../../roborockCommunication/routing/clientRouter.js';
import { AnsiLogger } from 'matterbridge/logger';
import { MessageRoutingService } from '../../services/messageRoutingService.js';

describe('ConnectionService', () => {
  let service: ConnectionService;
  let mockClientManager: ReturnType<typeof createMockClientManager>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockClientRouter: ReturnType<typeof createMockClientRouter>;
  let mockLocalClient: ReturnType<typeof createMockLocalClient>;
  let mockMessageRoutingService: ReturnType<typeof createMockMessageRoutingService>;

  const mockDevice: Device = {
    duid: 'test-duid-123',
    name: 'Test Vacuum',
    localKey: 'test-local-key',
    pv: '1.0',
  } as Device;

  const mockUserData: UserData = {
    rriot: {
      user: { email: 'test@example.com' },
    },
  } as unknown as UserData;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockClientRouter = createMockClientRouter();
    mockLocalClient = createMockLocalClient();
    mockClientManager = createMockClientManager(mockClientRouter);
    mockMessageRoutingService = createMockMessageRoutingService();
    service = new ConnectionService(
      mockClientManager as unknown as ClientManager,
      mockLogger as unknown as AnsiLogger,
      mockMessageRoutingService as unknown as MessageRoutingService,
    );
  });

  function createMockLogger() {
    return {
      debug: vi.fn(),
      notice: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    } satisfies Partial<AnsiLogger>;
  }

  function createMockClientRouter() {
    return {
      registerDevice: vi.fn(),
      registerMessageListener: vi.fn(),
      connect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      registerClient: vi.fn(),
      updateNonce: vi.fn(),
      unregisterClient: vi.fn(),
      registerConnectionListener: vi.fn(),
      connectionListeners: { register: vi.fn() },
      messageListeners: { register: vi.fn() },
      context: {},
      localClients: new Map(),
      logger: mockLogger,
      mqttClient: {},
      disconnect: vi.fn(),
      // Add required methods for ClientRouter
      send: vi.fn(),
      get: vi.fn(),
      getClient: vi.fn(),
    };
  }

  function createMockLocalClient() {
    return {
      connect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
    };
  }

  function createMockClientManager(mockClientRouter: any) {
    return {
      get: vi.fn().mockReturnValue(mockClientRouter),
      destroy: vi.fn(),
      destroyAll: vi.fn(),
      logger: mockLogger,
      // Add required property for ClientManager
      clients: new Map(),
    };
  }

  function createMockMessageRoutingService() {
    return {
      registerMessageProcessor: vi.fn(),
      setMqttAlwaysOn: vi.fn(),
    } satisfies Partial<MessageRoutingService>;
  }

  describe('setDeviceNotify', () => {
    it('should set the device notification callback', () => {
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);
      expect(service.deviceNotify).toBe(mockCallback);
    });
  });

  describe('waitForConnection', () => {
    it('should return immediately when connection is already established', async () => {
      const checkConnection = vi.fn().mockReturnValue(true);
      const attempts = await service.waitForConnection(checkConnection, 5, 0);

      expect(attempts).toBe(0);
      expect(checkConnection).toHaveBeenCalledTimes(2);
    });

    it('should retry until connection is established', async () => {
      let callCount = 0;
      const checkConnection = vi.fn(() => {
        callCount++;
        return callCount >= 3;
      });

      const attempts = await service.waitForConnection(checkConnection, 5, 0);

      expect(attempts).toBe(2);
      expect(checkConnection).toHaveBeenCalledTimes(4);
    });

    it('should throw error when max attempts exceeded', async () => {
      const checkConnection = vi.fn().mockReturnValue(false);

      await expect(service.waitForConnection(checkConnection, 3, 0)).rejects.toThrow('Connection timeout after 3 attempts');
      expect(checkConnection).toHaveBeenCalledTimes(5);
    });

    it('should use default max attempts and delay', async () => {
      const checkConnection = vi.fn().mockReturnValue(true);
      const attempts = await service.waitForConnection(checkConnection);

      expect(attempts).toBe(0);
      expect(checkConnection).toHaveBeenCalledTimes(2);
    });
  });

  describe('initializeMessageClient', () => {
    it('should throw DeviceInitializationError when ClientManager is not initialized', async () => {
      const serviceWithoutManager = new ConnectionService(
        undefined as unknown as ClientManager,
        mockLogger as unknown as AnsiLogger,
        mockMessageRoutingService as unknown as MessageRoutingService,
      );

      await expect(serviceWithoutManager.initializeMessageClient(mockDevice, mockUserData)).rejects.toThrow(DeviceInitializationError);
    });

    it('should successfully initialize MQTT client and connect', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);
      mockClientRouter.get = vi.fn().mockResolvedValue(mockClientRouter);

      await service.initializeMessageClient(mockDevice, mockUserData);

      expect(mockClientManager.get).toHaveBeenCalledWith(mockUserData);
      expect(mockClientRouter.registerDevice).toHaveBeenCalledWith(mockDevice.duid, mockDevice.localKey, mockDevice.pv, undefined);
      expect(mockClientRouter.connect).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('clientRouter connected for device:', mockDevice.duid);
    });

    it('should handle message listener for non-battery protocol messages', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);

      await service.initializeMessageClient(mockDevice, mockUserData);
      await service.initializeMessageClientForLocal(mockDevice);

      const listenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      expect(listenerCall).toHaveProperty('onMessage');

      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 1, 0, Date.now(), 0));
      mockMessage.isForProtocol = vi.fn().mockReturnValue(false);

      listenerCall.onMessage(mockMessage);

      expect(mockCallback).toHaveBeenCalledWith(NotifyMessageTypes.CloudMessage, mockMessage);
    });

    it('should ignore battery protocol messages', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);

      await service.initializeMessageClient(mockDevice, mockUserData);
      await service.initializeMessageClientForLocal(mockDevice);

      const listenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 2, 0, Date.now(), 0));
      mockMessage.isForProtocol = vi.fn().mockReturnValue(true);

      listenerCall.onMessage(mockMessage);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should not call deviceNotify when callback is not set', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);

      await service.initializeMessageClient(mockDevice, mockUserData);
      await service.initializeMessageClientForLocal(mockDevice);

      const listenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 4, 0, Date.now(), 0));
      mockMessage.isForProtocol = vi.fn().mockReturnValue(false);

      expect(() => listenerCall.onMessage(mockMessage)).not.toThrow();
    });

    it('should throw DeviceConnectionError when connection times out', async () => {
      mockClientRouter.isConnected.mockReturnValue(false);
      vi.spyOn(service as any, 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      await expect(service.initializeMessageClient(mockDevice, mockUserData)).rejects.toThrow(DeviceConnectionError);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should wrap non-DeviceError exceptions in DeviceInitializationError', async () => {
      mockClientManager.get.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(service.initializeMessageClient(mockDevice, mockUserData)).rejects.toThrow(DeviceInitializationError);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize message client:', expect.any(Error));
    });

    it('should re-throw DeviceError without wrapping', async () => {
      mockClientRouter.isConnected.mockReturnValue(false);
      vi.spyOn(service as any, 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      await expect(service.initializeMessageClient(mockDevice, mockUserData)).rejects.toThrow(DeviceConnectionError);
    });
  });

  describe('getMessageClient', () => {
    it('should return undefined when message client is not initialized', () => {
      expect(service.getMessageClient()).toBeUndefined();
    });

    it('should return the message client when initialized', () => {
      service.clientRouter = mockClientRouter as unknown as ClientRouter;
      expect(service.getMessageClient()).toBe(mockClientRouter);
    });
  });

  describe('shutdown', () => {
    it('should clear message client and device notify callback', async () => {
      service.clientRouter = mockClientRouter as unknown as ClientRouter;
      service.deviceNotify = vi.fn();

      await service.shutdown();

      expect(service.clientRouter).toBeUndefined();
      expect(service.deviceNotify).toBeUndefined();
    });

    it('should handle shutdown when nothing is initialized', async () => {
      await expect(service.shutdown()).resolves.not.toThrow();
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete initialization flow with retries', async () => {
      let connectionAttempts = 0;
      mockClientRouter.isConnected.mockImplementation(() => {
        connectionAttempts++;
        return connectionAttempts >= 2;
      });

      await service.initializeMessageClient(mockDevice, mockUserData);

      expect(mockClientRouter.isConnected).toHaveBeenCalled();
    });
  });
});
