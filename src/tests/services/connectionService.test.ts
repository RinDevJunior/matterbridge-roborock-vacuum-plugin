import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionService } from '../../services/connectionService.js';
import ClientManager from '../../services/clientManager.js';
import { DeviceConnectionError, DeviceInitializationError } from '../../errors/index.js';
import { Device, DeviceSpecs, DeviceModel, HeaderMessage, ResponseMessage, UserData } from '../../roborockCommunication/models/index.js';
import { ClientRouter } from '../../roborockCommunication/routing/clientRouter.js';
import { AnsiLogger } from 'matterbridge/logger';
import { MessageRoutingService } from '../../services/messageRoutingService.js';
import type { Client } from '../../roborockCommunication/routing/client.js';
import { makeLogger, makeLocalClientStub, makeMockClientRouter, asPartial, asType } from '../testUtils.js';

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
    specs: { model: 'roborock.vacuum.a187' },
    store: { pv: '1.0', model: 'roborock.vacuum.a187' },
  } as Device;

  const mockUserData: UserData = asPartial<UserData>({
    rriot: {
      u: 'user-id-123',
      s: 'session-token-abc',
      h: 'h-value',
      k: 'k-value',
      r: {
        r: 'r-value',
        a: 'a-value',
        m: 'm-value',
        l: 'l-value',
      },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockClientRouter = createMockClientRouter();
    mockClientManager = createMockClientManager(mockClientRouter);
    mockMessageRoutingService = createMockMessageRoutingService();
    service = new ConnectionService(
      mockClientManager as Partial<ClientManager> as ClientManager,
      mockLogger as Partial<AnsiLogger> as AnsiLogger,
      mockMessageRoutingService as Partial<MessageRoutingService> as MessageRoutingService,
    );
  });

  function createMockLogger(): ReturnType<typeof makeLogger> {
    return makeLogger();
  }

  function createMockClientRouter() {
    return makeMockClientRouter();
  }

  function createMockClientManager(mockClientRouter: ReturnType<typeof createMockClientRouter>) {
    return {
      get: vi.fn().mockReturnValue(mockClientRouter),
      destroy: vi.fn(),
      destroyAll: vi.fn(),
      logger: mockLogger,
      clients: new Map(),
    } as Partial<ClientManager> as ClientManager;
  }

  function createMockMessageRoutingService() {
    return {
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
        asType<ClientManager>(undefined),
        asPartial<AnsiLogger>(mockLogger),
        asPartial<MessageRoutingService>(mockMessageRoutingService),
      );

      await expect(serviceWithoutManager.initializeMessageClient(mockDevice, mockUserData)).rejects.toThrow(DeviceInitializationError);
    });

    it('should successfully initialize MQTT client and connect', async () => {
      vi.spyOn(mockClientRouter, 'isReady').mockReturnValue(true);
      mockClientRouter.get = vi.fn().mockResolvedValue(mockClientRouter);

      await service.initializeMessageClient(mockDevice, mockUserData);

      expect(mockClientManager.get).toHaveBeenCalledWith(mockUserData);
      expect(mockClientRouter.registerDevice).toHaveBeenCalledWith(mockDevice.duid, mockDevice.localKey, mockDevice.pv, undefined);
      expect(mockClientRouter.connect).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('clientRouter connected for device:', mockDevice.duid);
    });

    it('should ignore battery protocol messages', async () => {
      vi.spyOn(mockClientRouter, 'isConnected').mockReturnValue(true);
      const mockCallback = vi.fn();
      service.setDeviceNotify(mockCallback);

      await service.initializeMessageClient(mockDevice, mockUserData);
      await service.initializeMessageClientForLocal(mockDevice);

      const listenerCall = vi.mocked(mockClientRouter.registerMessageListener).mock.calls[0][0];
      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 2, 0, Date.now(), 0), undefined);
      mockMessage.isForProtocol = vi.fn().mockReturnValue(true);

      listenerCall.onMessage(mockMessage);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should not call deviceNotify when callback is not set', async () => {
      vi.spyOn(mockClientRouter, 'isConnected').mockReturnValue(true);
      service.setDeviceNotify(vi.fn());

      await service.initializeMessageClient(mockDevice, mockUserData);
      await service.initializeMessageClientForLocal(mockDevice);

      service.deviceNotify = undefined;

      const listenerCall = vi.mocked(mockClientRouter.registerMessageListener).mock.calls[0][0];
      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 4, 0, Date.now(), 0), undefined);
      mockMessage.isForProtocol = vi.fn().mockReturnValue(false);

      expect(() => listenerCall.onMessage(mockMessage)).not.toThrow();
    });

    it('should throw DeviceConnectionError when connection times out', async () => {
      vi.spyOn(mockClientRouter, 'isConnected').mockReturnValue(false);
      vi.spyOn(asType<{ waitForConnection: (...args: unknown[]) => Promise<number> }>(service), 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      await expect(service.initializeMessageClient(mockDevice, mockUserData)).rejects.toThrow(DeviceConnectionError);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should wrap non-DeviceError exceptions in DeviceInitializationError', async () => {
      asType<{ get: ReturnType<typeof vi.fn> }>(mockClientManager).get.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await expect(service.initializeMessageClient(mockDevice, mockUserData)).rejects.toThrow(DeviceInitializationError);
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to initialize message client:', expect.any(Error));
    });

    it('should re-throw DeviceError without wrapping', async () => {
      vi.spyOn(mockClientRouter, 'isConnected').mockReturnValue(false);
      vi.spyOn(asType<{ waitForConnection: (...args: unknown[]) => Promise<number> }>(service), 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      await expect(service.initializeMessageClient(mockDevice, mockUserData)).rejects.toThrow(DeviceConnectionError);
    });
  });

  describe('getMessageClient', () => {
    it('should return undefined when message client is not initialized', () => {
      expect(service.getMessageClient()).toBeUndefined();
    });

    it('should return the message client when initialized', () => {
      service.clientRouter = asPartial<ClientRouter>(mockClientRouter);
      expect(service.getMessageClient()).toBe(mockClientRouter);
    });
  });

  describe('shutdown', () => {
    it('should clear message client and device notify callback', async () => {
      service.clientRouter = asPartial<ClientRouter>(mockClientRouter);
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
      vi.spyOn(mockClientRouter, 'isConnected').mockImplementation(() => {
        connectionAttempts++;
        return connectionAttempts >= 2;
      });

      await service.initializeMessageClient(mockDevice, mockUserData);

      expect(mockClientRouter.isReady).toHaveBeenCalled();
    });
  });
});

describe('ConnectionService additional coverage', () => {
  let service: ConnectionService;
  let mockClientManager: ClientManager;
  let mockLogger: ReturnType<typeof makeLogger>;
  let mockClientRouter: ReturnType<typeof makeMockClientRouter>;
  let mockLocalClient: ReturnType<typeof makeLocalClientStub>;
  let mockMessageRoutingService: Partial<MessageRoutingService>;
  const mockDevice: Device = {
    duid: 'test-duid-123',
    name: 'Test Vacuum',
    localKey: 'test-local-key',
    pv: '1.0',
    store: { pv: '1.0', model: DeviceModel.S6 },
    specs: asPartial<DeviceSpecs>({ model: DeviceModel.S6 }),
  } as Device;

  beforeEach(() => {
    mockLogger = makeLogger();
    mockClientRouter = makeMockClientRouter();
    mockLocalClient = makeLocalClientStub();
    mockClientManager = asPartial<ClientManager>({ get: vi.fn().mockReturnValue(mockClientRouter) });
    mockMessageRoutingService = { registerMessageDispatcher: vi.fn() };
    service = new ConnectionService(mockClientManager, mockLogger, mockMessageRoutingService as MessageRoutingService);
  });

  it('should handle B01 protocol and UDP client setup', async () => {
    const device: Device = asPartial<Device>({
      ...mockDevice,
      specs: asPartial<DeviceSpecs>({ model: DeviceModel.S6, hasRealTimeConnection: false }),
      pv: 'B01',
      duid: 'b01-duid',
      deviceStatus: { 101: { 81: { ipAddress: '1.2.3.4' } } },
    });
    service.setDeviceNotify(vi.fn());
    service.clientRouter = asPartial<ClientRouter>(mockClientRouter);
    const result = await service.initializeMessageClientForLocal(device);
    expect(result).toBe(true);
  });

  it('should fallback to UDP broadcast if setupLocalClient fails', async () => {
    const device: Device = asPartial<Device>({
      ...mockDevice,
      specs: asPartial<DeviceSpecs>({ model: DeviceModel.S6, hasRealTimeConnection: false }),
      pv: 'B01',
      duid: 'b01-duid',
      deviceStatus: { 101: { 82: { ipAddress: '1.2.3.4' } } },
    });
    service.setDeviceNotify(vi.fn());
    service.clientRouter = asPartial<ClientRouter>(mockClientRouter);
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
    service.clientRouter = asPartial<ClientRouter>(mockClientRouter);

    const result = await service.initializeMessageClientForLocal(mockDevice);
    expect(result).toBe(false);
  });

  it('should return true when local client connects successfully', async () => {
    service.clientRouter = asPartial<ClientRouter>(mockClientRouter);
    vi.spyOn(mockClientRouter, 'registerClient').mockReturnValue(asType<Client>(mockLocalClient));
    const result = await asType<{
      setupLocalClient: (
        {
          duid,
          specs: { hasRealTimeConnection },
        }: { duid: string; specs: DeviceSpecs },
        ip: string,
      ) => Promise<boolean>;
    }>(service).setupLocalClient.call(service, { duid: 'duid', specs: mockDevice.specs }, '1.2.3.4');
    expect(result).toBe(true);
  });

  it('should return false and log error if registerClient returns undefined', async () => {
    service.clientRouter = asPartial<ClientRouter>(mockClientRouter);
    vi.spyOn(mockClientRouter, 'registerClient').mockReturnValue(asType<Client>(undefined));
    const result = await asType<{ setupLocalClient: ({ duid, specs }: { duid: string; specs: DeviceSpecs }, ip: string) => Promise<boolean> }>(service).setupLocalClient.call(
      service,
      { duid: 'duid', specs: mockDevice.specs },
      '1.2.3.4',
    );
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to create local client for device duid at IP 1.2.3.4');
  });

  it('should return false and log error if exception is thrown', async () => {
    service.clientRouter = asPartial<ClientRouter>(mockClientRouter);
    vi.spyOn(mockClientRouter, 'registerClient').mockImplementation(() => {
      throw new Error('fail');
    });
    const result = await asType<{ setupLocalClient: ({ duid, specs }: { duid: string; specs: DeviceSpecs }, ip: string) => Promise<boolean> }>(service).setupLocalClient.call(
      service,
      { duid: 'duid', specs: mockDevice.specs },
      '1.2.3.4',
    );
    expect(result).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith('Error setting up local client for device duid at IP 1.2.3.4:', expect.any(Error));
  });

  it('should log error if disconnect throws', async () => {
    service.clientRouter = asPartial<ClientRouter>({
      disconnect: vi.fn().mockImplementation(() => {
        throw new Error('fail');
      }),
    });
    await service.shutdown();
    expect(mockLogger.error).toHaveBeenCalledWith('Error disconnecting message client:', expect.any(Error));
  });

  it('should log error if local client disconnect throws', async () => {
    const badClient = asPartial<Client>({
      disconnect: vi.fn().mockImplementation(() => {
        throw new Error('fail');
      }),
    });
    service.localClientMap.set('test-duid', badClient);
    await service.shutdown();
    expect(mockLogger.error).toHaveBeenCalledWith('Error disconnecting local client test-duid:', expect.any(Error));
  });

  it('should clear ipMap and localClientMap on shutdown', async () => {
    service.ipMap.set('a', '1.2.3.4');
    service.localClientMap.set('a', asPartial<Client>({}));
    await service.shutdown();
    expect(service.ipMap.size).toBe(0);
    expect(service.localClientMap.size).toBe(0);
  });
});
