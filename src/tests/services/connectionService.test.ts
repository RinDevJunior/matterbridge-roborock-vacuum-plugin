import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClientManager, ConnectionService } from '@/services/index.js';
import { Device, UserData, Protocol, ResponseMessage, DpsPayload, HeaderMessage } from '@/roborockCommunication/index.js';
import { DeviceConnectionError, DeviceInitializationError } from '@/errors/index.js';
import { NotifyMessageTypes } from '@/notifyMessageTypes.js';

describe('ConnectionService', () => {
  let service: ConnectionService;
  let mockClientManager: ReturnType<typeof createMockClientManager>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockClientRouter: ReturnType<typeof createMockClientRouter>;
  let mockLocalClient: ReturnType<typeof createMockLocalClient>;

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
    service = new ConnectionService(mockClientManager as unknown as ClientManager, mockLogger as unknown as import('matterbridge/logger').AnsiLogger);
  });

  function createMockLogger() {
    return {
      debug: vi.fn(),
      notice: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      _extLog: vi.fn(),
      _logName: '',
      _logFilePath: '',
      _logFileSize: 0,
      _logFileMaxSize: 0,
      _logFileStream: undefined,
      _logFileWrite: vi.fn(),
      _logFileRotate: vi.fn(),
      _logFileCheck: vi.fn(),
      _logFileCleanup: vi.fn(),
      _logFileWriteQueue: [],
      _logFileWriteInProgress: false,
      _logFileWriteScheduled: false,
      _logFileWritePromise: Promise.resolve(),
      _logFileWriteResolve: vi.fn(),
      _logFileWriteReject: vi.fn(),
      _logFileWriteError: undefined,
      _logFileWriteErrorCount: 0,
      _logFileWriteErrorMax: 0,
      _logFileWriteErrorTimeout: 0,
      _logFileWriteErrorTimer: undefined,
      _logFileWriteErrorPromise: Promise.resolve(),
      _logFileWriteErrorResolve: vi.fn(),
      _logFileWriteErrorReject: vi.fn(),
      _logFileWriteErrorHandler: vi.fn(),
      _logFileWriteErrorHandlerTimeout: 0,
      _logFileWriteErrorHandlerTimer: undefined,
      _logFileWriteErrorHandlerPromise: Promise.resolve(),
      _logFileWriteErrorHandlerResolve: vi.fn(),
      _logFileWriteErrorHandlerReject: vi.fn(),
      _logFileWriteErrorHandlerError: undefined,
      _logFileWriteErrorHandlerErrorCount: 0,
      _logFileWriteErrorHandlerErrorMax: 0,
      _logFileWriteErrorHandlerErrorTimeout: 0,
      _logFileWriteErrorHandlerErrorTimer: undefined,
      _logFileWriteErrorHandlerErrorPromise: Promise.resolve(),
      _logFileWriteErrorHandlerErrorResolve: vi.fn(),
      _logFileWriteErrorHandlerErrorReject: vi.fn(),
    };
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
      expect(checkConnection).toHaveBeenCalledTimes(1);
    });

    it('should retry until connection is established', async () => {
      let callCount = 0;
      const checkConnection = vi.fn(() => {
        callCount++;
        return callCount >= 3;
      });

      const attempts = await service.waitForConnection(checkConnection, 5, 0);

      expect(attempts).toBe(2);
      expect(checkConnection).toHaveBeenCalledTimes(3);
    });

    it('should throw error when max attempts exceeded', async () => {
      const checkConnection = vi.fn().mockReturnValue(false);

      await expect(service.waitForConnection(checkConnection, 3, 0)).rejects.toThrow('Connection timeout after 3 attempts');
      expect(checkConnection).toHaveBeenCalledTimes(4);
    });

    it('should use default max attempts and delay', async () => {
      const checkConnection = vi.fn().mockReturnValue(true);
      const attempts = await service.waitForConnection(checkConnection);

      expect(attempts).toBe(0);
      expect(checkConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('initializeMessageClient', () => {
    it('should throw DeviceInitializationError when ClientManager is not initialized', async () => {
      const serviceWithoutManager = new ConnectionService(undefined as unknown as ClientManager, mockLogger as unknown as import('matterbridge/logger').AnsiLogger);

      await expect(serviceWithoutManager.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow(DeviceInitializationError);
    });

    it('should successfully initialize MQTT client and connect', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(mockClientManager.get).toHaveBeenCalledWith('test@example.com', mockUserData);
      expect(mockClientRouter.registerDevice).toHaveBeenCalledWith(mockDevice.duid, mockDevice.localKey, mockDevice.pv, undefined);
      expect(mockClientRouter.registerMessageListener).toHaveBeenCalled();
      expect(mockClientRouter.connect).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageClient connected for device:', mockDevice.duid);
    });

    it('should handle message listener for non-battery protocol messages', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

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

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const listenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 2, 0, Date.now(), 0));
      mockMessage.isForProtocol = vi.fn().mockReturnValue(true);

      listenerCall.onMessage(mockMessage);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle hello_response protocol and update nonce', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const listenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 3, 0, Date.now(), 0));
      mockMessage.isForProtocol = vi.fn((protocol: Protocol) => protocol === Protocol.hello_response);
      mockMessage.get = vi.fn().mockReturnValue({ result: { nonce: 'test-nonce-456' } } as DpsPayload);

      listenerCall.onMessage(mockMessage);

      expect(mockClientRouter.updateNonce).toHaveBeenCalledWith(mockDevice.duid, 'test-nonce-456');
    });

    it('should not call deviceNotify when callback is not set', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const listenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 4, 0, Date.now(), 0));
      mockMessage.isForProtocol = vi.fn().mockReturnValue(false);

      expect(() => listenerCall.onMessage(mockMessage)).not.toThrow();
    });

    it('should throw DeviceConnectionError when connection times out', async () => {
      mockClientRouter.isConnected.mockReturnValue(false);
      vi.spyOn(service as any, 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      await expect(service.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow(DeviceConnectionError);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should wrap non-DeviceError exceptions in DeviceInitializationError', async () => {
      mockClientManager.get.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(service.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow(DeviceInitializationError);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize message client:', expect.any(Error));
    });

    it('should re-throw DeviceError without wrapping', async () => {
      mockClientRouter.isConnected.mockReturnValue(false);
      vi.spyOn(service as any, 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      await expect(service.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow(DeviceConnectionError);
    });
  });

  describe('registerLocalClient', () => {
    beforeEach(() => {
      service.messageClient = mockClientRouter as unknown as import('../../roborockCommunication/broadcast/clientRouter.js').ClientRouter;
    });

    it('should throw DeviceConnectionError when message client is not initialized', async () => {
      service.messageClient = undefined;

      await expect(service.registerLocalClient(mockDevice, '192.168.1.100')).rejects.toThrow(DeviceConnectionError);
    });

    it('should successfully register and connect local client', async () => {
      mockClientRouter.registerClient.mockReturnValue(mockLocalClient);
      mockLocalClient.isConnected.mockReturnValue(true);

      const result = await service.registerLocalClient(mockDevice, '192.168.1.100');

      expect(mockLogger.debug).toHaveBeenCalledWith('Initializing the local connection for this client towards 192.168.1.100');
      expect(mockClientRouter.registerClient).toHaveBeenCalledWith(mockDevice.duid, '192.168.1.100');
      expect(mockLocalClient.connect).toHaveBeenCalled();
      expect(mockLogger.notice).toHaveBeenCalledWith(`Local connection established for device ${mockDevice.duid} at 192.168.1.100`);
      expect(result).toBe(mockLocalClient);
    });

    it('should throw DeviceConnectionError when local client fails to connect', async () => {
      mockClientRouter.registerClient.mockReturnValue(mockLocalClient);
      mockLocalClient.isConnected.mockReturnValue(false);
      vi.spyOn(service as any, 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      await expect(service.registerLocalClient(mockDevice, '192.168.1.100')).rejects.toThrow(DeviceConnectionError);
    });

    it('should include IP address in error context', async () => {
      mockClientRouter.registerClient.mockReturnValue(mockLocalClient);
      mockLocalClient.isConnected.mockReturnValue(false);
      vi.spyOn(service as any, 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      let caughtError;
      try {
        await service.registerLocalClient(mockDevice, '192.168.1.100');
        expect(false).toBe(true); // Should have thrown DeviceConnectionError
      } catch (error) {
        caughtError = error;
      }
      expect(caughtError).toBeInstanceOf(DeviceConnectionError);
      expect((caughtError as DeviceConnectionError).metadata).toMatchObject({ ip: '192.168.1.100' });
    });
  });

  describe('getMessageClient', () => {
    it('should return undefined when message client is not initialized', () => {
      expect(service.getMessageClient()).toBeUndefined();
    });

    it('should return the message client when initialized', () => {
      service.messageClient = mockClientRouter as unknown as import('../../roborockCommunication/broadcast/clientRouter.js').ClientRouter;
      expect(service.getMessageClient()).toBe(mockClientRouter);
    });
  });

  describe('shutdown', () => {
    it('should clear message client and device notify callback', async () => {
      service.messageClient = mockClientRouter as unknown as import('../../roborockCommunication/broadcast/clientRouter.js').ClientRouter;
      service.deviceNotify = vi.fn();

      await service.shutdown();

      expect(service.messageClient).toBeUndefined();
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

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(mockClientRouter.isConnected).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageClient connected for device:', mockDevice.duid);
    });

    it('should handle local client registration after MQTT initialization', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);
      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      mockClientRouter.registerClient.mockReturnValue(mockLocalClient);
      mockLocalClient.isConnected.mockReturnValue(true);

      const localClient = await service.registerLocalClient(mockDevice, '192.168.1.100');

      expect(localClient).toBe(mockLocalClient);
      expect(service.getMessageClient()).toBe(mockClientRouter);
    });
  });
});
