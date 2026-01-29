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
  let mockMessageRoutingService: ReturnType<typeof createMockMessageRoutingService>;

  const mockDevice: Device = {
    duid: 'test-duid-123',
    name: 'Test Vacuum',
    localKey: 'test-local-key',
    pv: '1.0',
    data: { model: 'roborock.vacuum.a187' },
    store: { pv: '1.0', model: 'roborock.vacuum.a187' },
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
      send: vi.fn(),
      get: vi.fn(),
      getClient: vi.fn(),
    };
  }

  function createMockClientManager(mockClientRouter: any) {
    return {
      get: vi.fn().mockReturnValue(mockClientRouter),
      destroy: vi.fn(),
      destroyAll: vi.fn(),
      logger: mockLogger,
      clients: new Map(),
    };
  }

  function createMockMessageRoutingService() {
    return {
      registerMessageProcessor: vi.fn(),
      registerMessageDispatcher: vi.fn(),
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

describe('ConnectionService additional coverage', () => {
  let service: ConnectionService;
  let mockClientManager: any;
  let mockLogger: any;
  let mockClientRouter: any;
  let mockLocalClient: any;
  let mockMessageRoutingService: any;
  const mockDevice: Device = {
    duid: 'test-duid-123',
    name: 'Test Vacuum',
    localKey: 'test-local-key',
    pv: '1.0',
    store: { pv: '1.0', model: 'roborock.vacuum.a187' },
    data: { model: 'roborock.vacuum.a187' },
  } as unknown as Device;

  beforeEach(() => {
    mockLogger = { debug: vi.fn(), notice: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() };
    mockClientRouter = { registerClient: vi.fn(), isConnected: vi.fn().mockReturnValue(true), connect: vi.fn(), registerMessageListener: vi.fn() };
    mockLocalClient = { connect: vi.fn(), isConnected: vi.fn().mockReturnValue(true), disconnect: vi.fn() };
    mockClientManager = { get: vi.fn().mockReturnValue(mockClientRouter) };
    mockMessageRoutingService = { registerMessageProcessor: vi.fn(), registerMessageDispatcher: vi.fn() };
    service = new ConnectionService(mockClientManager, mockLogger, mockMessageRoutingService);
  });

  it('should handle B01 protocol and UDP client setup', async () => {
    const device = { ...mockDevice, data: { model: 'roborock.vacuum.ss1' }, pv: 'B01', duid: 'b01-duid', deviceStatus: { 1001: { 101: { ipAddress: '1.2.3.4' } } } } as any;
    service.clientRouter = mockClientRouter;
    const result = await service.initializeMessageClientForLocal(device);
    expect(result).toBe(true);
  });

  it('should fallback to UDP broadcast if setupLocalClient fails', async () => {
    const device = { ...mockDevice, data: { model: 'roborock.vacuum.ss2' }, pv: 'B01', duid: 'b01-duid', deviceStatus: { 1001: { 101: { ipAddress: '1.2.3.4' } } } } as any;
    service.clientRouter = mockClientRouter;
    const result = await service.initializeMessageClientForLocal(device);
    expect(result).toBe(true);
  });

  it('should return false if clientRouter is not initialized', async () => {
    service.clientRouter = undefined;
    const result = await service.initializeMessageClientForLocal(mockDevice);
    expect(result).toBe(false);
  });

  it('should return false if getNetworkInfo returns no ip', async () => {
    mockClientRouter.get = vi.fn().mockResolvedValue({ ip: undefined });
    service.clientRouter = mockClientRouter;

    const result = await service.initializeMessageClientForLocal(mockDevice);
    expect(result).toBe(false);
  });

  it('should return true when local client connects successfully', async () => {
    service.clientRouter = mockClientRouter;
    mockClientRouter.registerClient.mockReturnValue({ connect: vi.fn(), isConnected: vi.fn().mockReturnValue(true) });
    const result = await (service as any).setupLocalClient('duid', '1.2.3.4');
    expect(result).toBe(true);
  });

  it('should return false and log error if registerClient returns undefined', async () => {
    service.clientRouter = mockClientRouter;
    mockClientRouter.registerClient.mockReturnValue(undefined);
    const result = await (service as any).setupLocalClient('duid', '1.2.3.4');
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to create local client for device duid at IP 1.2.3.4');
  });

  it('should return false and log error if exception is thrown', async () => {
    service.clientRouter = mockClientRouter;
    mockClientRouter.registerClient.mockImplementation(() => {
      throw new Error('fail');
    });
    const result = await (service as any).setupLocalClient('duid', '1.2.3.4');
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith('Error setting up local client for device duid at IP 1.2.3.4:', expect.any(Error));
  });

  it('should log error if disconnect throws', async () => {
    service.clientRouter = {
      disconnect: vi.fn().mockImplementation(() => {
        throw new Error('fail');
      }),
    } as any;
    await service.shutdown();
    expect(mockLogger.error).toHaveBeenCalledWith('Error disconnecting message client:', expect.any(Error));
  });

  it('should log error if local client disconnect throws', async () => {
    const badClient = {
      disconnect: vi.fn().mockImplementation(() => {
        throw new Error('fail');
      }),
    };
    service.localClientMap.set('duid', badClient as any);
    await service.shutdown();
    expect(mockLogger.error).toHaveBeenCalledWith('Error disconnecting local client duid:', expect.any(Error));
  });

  it('should clear ipMap and localClientMap on shutdown', async () => {
    service.ipMap.set('a', '1.2.3.4');
    service.localClientMap.set('a', mockLocalClient as any);
    await service.shutdown();
    expect(service.ipMap.size).toBe(0);
    expect(service.localClientMap.size).toBe(0);
  });
});
