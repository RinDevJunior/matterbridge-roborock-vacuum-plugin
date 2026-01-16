import { AnsiLogger } from 'matterbridge/logger';
import { ConnectionService } from '../../services/connectionService.js';
import ClientManager from '../../services/clientManager.js';
import { Device, UserData, ClientRouter, Protocol, ResponseMessage } from '../../roborockCommunication/index.js';
import { LocalNetworkClient } from '../../roborockCommunication/broadcast/client/LocalNetworkClient.js';
import { DpsPayload } from '../../roborockCommunication/broadcast/model/dps.js';
import { DeviceConnectionError, DeviceInitializationError } from '../../errors/index.js';
import { NotifyMessageTypes } from '../../notifyMessageTypes.js';
import { HeaderMessage } from '../../roborockCommunication/broadcast/model/headerMessage.js';

describe('ConnectionService', () => {
  let service: ConnectionService;
  let mockClientManager: jest.Mocked<ClientManager>;
  let mockLogger: jest.Mocked<AnsiLogger>;
  let mockClientRouter: jest.Mocked<ClientRouter>;
  let mockLocalClient: jest.Mocked<LocalNetworkClient>;

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
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      notice: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    } as unknown as jest.Mocked<AnsiLogger>;

    mockClientRouter = {
      registerDevice: jest.fn(),
      registerMessageListener: jest.fn(),
      connect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(false),
      registerClient: jest.fn(),
      updateNonce: jest.fn(),
    } as unknown as jest.Mocked<ClientRouter>;

    mockLocalClient = {
      connect: jest.fn(),
      isConnected: jest.fn().mockReturnValue(false),
    } as unknown as jest.Mocked<LocalNetworkClient>;

    mockClientManager = {
      get: jest.fn().mockReturnValue(mockClientRouter),
    } as unknown as jest.Mocked<ClientManager>;

    service = new ConnectionService(mockClientManager, mockLogger);
  });

  describe('setDeviceNotify', () => {
    it('should set the device notification callback', () => {
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);
      expect(service.deviceNotify).toBe(mockCallback);
    });
  });

  describe('waitForConnection', () => {
    it('should return immediately when connection is already established', async () => {
      const checkConnection = jest.fn().mockReturnValue(true);
      const attempts = await service.waitForConnection(checkConnection, 5, 0);

      expect(attempts).toBe(0);
      expect(checkConnection).toHaveBeenCalledTimes(1);
    });

    it('should retry until connection is established', async () => {
      let callCount = 0;
      const checkConnection = jest.fn(() => {
        callCount++;
        return callCount >= 3;
      });

      const attempts = await service.waitForConnection(checkConnection, 5, 0);

      expect(attempts).toBe(2);
      expect(checkConnection).toHaveBeenCalledTimes(3);
    });

    it('should throw error when max attempts exceeded', async () => {
      const checkConnection = jest.fn().mockReturnValue(false);

      await expect(service.waitForConnection(checkConnection, 3, 0)).rejects.toThrow('Connection timeout after 3 attempts');
      expect(checkConnection).toHaveBeenCalledTimes(4);
    });

    it('should use default max attempts and delay', async () => {
      const checkConnection = jest.fn().mockReturnValue(true);
      const attempts = await service.waitForConnection(checkConnection);

      expect(attempts).toBe(0);
      expect(checkConnection).toHaveBeenCalledTimes(1);
    });
  });

  describe('initializeMessageClient', () => {
    it('should throw DeviceInitializationError when ClientManager is not initialized', async () => {
      const serviceWithoutManager = new ConnectionService(undefined as unknown as ClientManager, mockLogger);

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
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const listenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      expect(listenerCall).toHaveProperty('onMessage');

      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 1, 0, Date.now(), 0));
      mockMessage.isForProtocol = jest.fn().mockReturnValue(false);

      listenerCall.onMessage(mockMessage);

      expect(mockCallback).toHaveBeenCalledWith(NotifyMessageTypes.CloudMessage, mockMessage);
    });

    it('should ignore battery protocol messages', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);
      const mockCallback = jest.fn();
      service.setDeviceNotify(mockCallback);

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const listenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 2, 0, Date.now(), 0));
      mockMessage.isForProtocol = jest.fn().mockReturnValue(true);

      listenerCall.onMessage(mockMessage);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should handle hello_response protocol and update nonce', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const listenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 3, 0, Date.now(), 0));
      mockMessage.isForProtocol = jest.fn((protocol: Protocol) => protocol === Protocol.hello_response);
      mockMessage.get = jest.fn().mockReturnValue({ result: { nonce: 'test-nonce-456' } } as DpsPayload);

      listenerCall.onMessage(mockMessage);

      expect(mockClientRouter.updateNonce).toHaveBeenCalledWith(mockDevice.duid, 'test-nonce-456');
    });

    it('should not call deviceNotify when callback is not set', async () => {
      mockClientRouter.isConnected.mockReturnValue(true);

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      const listenerCall = mockClientRouter.registerMessageListener.mock.calls[0][0];
      const mockMessage = new ResponseMessage(mockDevice.duid, new HeaderMessage('1.0', 4, 0, Date.now(), 0));
      mockMessage.isForProtocol = jest.fn().mockReturnValue(false);

      expect(() => listenerCall.onMessage(mockMessage)).not.toThrow();
    });

    it('should throw DeviceConnectionError when connection times out', async () => {
      mockClientRouter.isConnected.mockReturnValue(false);
      jest.spyOn(service as any, 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

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
      jest.spyOn(service as any, 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      await expect(service.initializeMessageClient('test@example.com', mockDevice, mockUserData)).rejects.toThrow(DeviceConnectionError);
    });
  });

  describe('registerLocalClient', () => {
    beforeEach(() => {
      service.messageClient = mockClientRouter;
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
      jest.spyOn(service as any, 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      await expect(service.registerLocalClient(mockDevice, '192.168.1.100')).rejects.toThrow(DeviceConnectionError);
    });

    it('should include IP address in error context', async () => {
      mockClientRouter.registerClient.mockReturnValue(mockLocalClient);
      mockLocalClient.isConnected.mockReturnValue(false);
      jest.spyOn(service as any, 'waitForConnection').mockRejectedValue(new Error('Connection timeout'));

      try {
        await service.registerLocalClient(mockDevice, '192.168.1.100');
        fail('Should have thrown DeviceConnectionError');
      } catch (error) {
        expect(error).toBeInstanceOf(DeviceConnectionError);
        if (error instanceof DeviceConnectionError) {
          expect(error.metadata).toMatchObject({ ip: '192.168.1.100' });
        }
      }
    });
  });

  describe('getMessageClient', () => {
    it('should return undefined when message client is not initialized', () => {
      expect(service.getMessageClient()).toBeUndefined();
    });

    it('should return the message client when initialized', () => {
      service.messageClient = mockClientRouter;
      expect(service.getMessageClient()).toBe(mockClientRouter);
    });
  });

  describe('shutdown', () => {
    it('should clear message client and device notify callback', async () => {
      service.messageClient = mockClientRouter;
      service.deviceNotify = jest.fn();

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
