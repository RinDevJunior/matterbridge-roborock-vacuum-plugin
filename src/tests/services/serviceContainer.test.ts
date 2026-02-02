import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { ServiceContainer, ServiceContainerConfig } from '../../services/serviceContainer.js';
import { AuthenticationService } from '../../services/authenticationService.js';
import { DeviceManagementService } from '../../services/deviceManagementService.js';
import { AreaManagementService } from '../../services/areaManagementService.js';
import { MessageRoutingService } from '../../services/messageRoutingService.js';
import { RoborockAuthenticateApi } from '../../roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import { UserData } from '../../roborockCommunication/models/index.js';
import { localStorageMock } from '../testData/localStorageMock.js';
import { makeLogger, makeMockClientRouter, createMockLocalStorage, createMockAuthApi, createMockIotApi, asPartial } from '../testUtils.js';
import { ClientRouter } from '../../roborockCommunication/routing/clientRouter.js';
import type { LocalStorage } from 'node-persist';
import type { PlatformConfigManager } from '../../platform/platformConfig.js';

describe('ServiceContainer', () => {
  let container: ServiceContainer;
  let mockLogger: AnsiLogger;
  let mockAuthApi: RoborockAuthenticateApi;
  let mockIotApi: RoborockIoTApi;
  let config: ServiceContainerConfig;
  let mockUserData: UserData;

  beforeEach(() => {
    mockLogger = makeLogger();

    mockAuthApi = createMockAuthApi();

    mockIotApi = createMockIotApi();

    mockUserData = {
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
        u: 'test-user',
        s: 'test-secret',
        h: 'test-host',
        k: 'test-key',
        r: { a: 'test-region-a', m: 'test-mqtt', r: '', l: '' },
      },
    } as UserData;

    config = {
      baseUrl: 'https://test.roborock.com',
      refreshInterval: 30000,
      authenticateApiFactory: vi.fn(() => mockAuthApi),
      iotApiFactory: vi.fn(() => mockIotApi),
      persist: createMockLocalStorage({ storage: localStorageMock }) as LocalStorage,
      configManager: asPartial<PlatformConfigManager>({}),
    };

    container = new ServiceContainer(mockLogger, config);
  });

  afterEach(async () => {
    await container.destroy();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create container with provided dependencies', () => {
      expect(container).toBeInstanceOf(ServiceContainer);
      expect(container.getLogger()).toBe(mockLogger);
      expect(container.getClientManager()).not.toBeUndefined();
    });

    it('should use custom factories when provided', () => {
      expect(config.authenticateApiFactory).toHaveBeenCalledWith(mockLogger, config.baseUrl);
    });

    it('should create default factories when not provided', async () => {
      const defaultConfig = {
        baseUrl: 'https://default.com',
        refreshInterval: 10000,
        persist: {} as LocalStorage,
        configManager: asPartial<PlatformConfigManager>({}),
      };

      const defaultContainer = new ServiceContainer(mockLogger, defaultConfig);

      expect(defaultContainer).toBeInstanceOf(ServiceContainer);
      await defaultContainer.destroy();
    });
  });

  describe('setUserData', () => {
    it('should set user data and create IoT API', () => {
      container.setUserData(mockUserData);

      expect(config.iotApiFactory).toHaveBeenCalledWith(mockLogger, mockUserData);
      expect(container.getUserData()).toBe(mockUserData);
    });

    it('should update existing DeviceManagementService when user data is set', () => {
      const deviceService = container.getDeviceManagementService();
      const setAuthSpy = vi.spyOn(deviceService, 'setAuthentication');

      container.setUserData(mockUserData);

      expect(setAuthSpy).toHaveBeenCalledWith(mockUserData);
    });

    it('should update existing AreaManagementService when user data is set', () => {
      const areaService = container.getAreaManagementService();
      const setIotApiSpy = vi.spyOn(areaService, 'setIotApi');

      container.setUserData(mockUserData);

      expect(setIotApiSpy).toHaveBeenCalledWith(mockIotApi);
    });

    it('should update existing MessageRoutingService when user data is set', () => {
      const messageService = container.getMessageRoutingService();
      const setIotApiSpy = vi.spyOn(messageService, 'setIotApi');

      container.setUserData(mockUserData);

      expect(setIotApiSpy).toHaveBeenCalledWith(mockIotApi);
    });
  });

  describe('getAuthenticationService', () => {
    it('should create and return AuthenticationService singleton', () => {
      const service1 = container.getAuthenticationService();
      const service2 = container.getAuthenticationService();

      expect(service1).toBeInstanceOf(AuthenticationService);
      expect(service1).toBe(service2); // Same instance
    });

    it('should initialize AuthenticationService with correct dependencies', () => {
      const service = container.getAuthenticationService();

      expect(service).toBeDefined();
    });
  });

  describe('getDeviceManagementService', () => {
    it('should create and return DeviceManagementService singleton', () => {
      const service1 = container.getDeviceManagementService();
      const service2 = container.getDeviceManagementService();

      expect(service1).toBeInstanceOf(DeviceManagementService);
      expect(service1).toBe(service2); // Same instance
    });

    it('should initialize DeviceManagementService with correct dependencies', () => {
      const service = container.getDeviceManagementService();

      expect(service).toBeDefined();
    });
  });

  describe('getAreaManagementService', () => {
    it('should create and return AreaManagementService singleton', () => {
      const service1 = container.getAreaManagementService();
      const service2 = container.getAreaManagementService();

      expect(service1).toBeInstanceOf(AreaManagementService);
      expect(service1).toBe(service2); // Same instance
    });

    it('should initialize AreaManagementService with correct dependencies', () => {
      const service = container.getAreaManagementService();

      expect(service).toBeDefined();
    });
  });

  describe('getMessageRoutingService', () => {
    it('should create and return MessageRoutingService singleton', () => {
      const service1 = container.getMessageRoutingService();
      const service2 = container.getMessageRoutingService();

      expect(service1).toBeInstanceOf(MessageRoutingService);
      expect(service1).toBe(service2); // Same instance
    });

    it('should initialize MessageRoutingService with correct dependencies', () => {
      const service = container.getMessageRoutingService();

      expect(service).toBeDefined();
    });
  });

  describe('getPollingService', () => {
    it('should create and return PollingService singleton', () => {
      const service1 = container.getPollingService();
      const service2 = container.getPollingService();

      expect(service1).toBeDefined();
      expect(service1).toBe(service2); // Same instance
    });

    it('should initialize PollingService with refresh interval from config', () => {
      const service = container.getPollingService();

      expect(service).toBeDefined();
    });
  });

  describe('getConnectionService', () => {
    it('should create and return ConnectionService singleton', () => {
      const service1 = container.getConnectionService();
      const service2 = container.getConnectionService();

      expect(service1).toBeDefined();
      expect(service1).toBe(service2); // Same instance
    });
  });

  describe('synchronizeMessageClients', () => {
    it('should synchronize message clients when clientRouter is initialized', () => {
      const connectionService = container.getConnectionService();
      const areaService = container.getAreaManagementService();

      // Mock clientRouter to be defined
      const mockClientRouter = makeMockClientRouter();
      connectionService.clientRouter = asPartial<ClientRouter>(mockClientRouter);

      const setMessageClientSpy = vi.spyOn(areaService, 'setMessageClient');

      container.synchronizeMessageClients();

      expect(setMessageClientSpy).toHaveBeenCalledWith(mockClientRouter);
    });

    it('should throw error when ConnectionService is not initialized', () => {
      expect(() => container.synchronizeMessageClients()).toThrow('Message client not initialized in ConnectionService');
    });

    it('should throw error when clientRouter is undefined', () => {
      container.getConnectionService();

      expect(() => container.synchronizeMessageClients()).toThrow('Message client not initialized in ConnectionService');
    });
  });

  describe('getIotApi', () => {
    it('should return undefined when user is not authenticated', () => {
      expect(container.getIotApi()).toBeUndefined();
    });

    it('should return IoT API after user authentication', () => {
      container.setUserData(mockUserData);

      const iotApi = container.getIotApi();

      expect(iotApi).toBe(mockIotApi);
    });
  });

  describe('getAllServices', () => {
    it('should return all services in a bundle', () => {
      const services = container.getAllServices();

      expect(services).toHaveProperty('authentication');
      expect(services).toHaveProperty('deviceManagement');
      expect(services).toHaveProperty('areaManagement');
      expect(services).toHaveProperty('messageRouting');
      expect(services).toHaveProperty('polling');
      expect(services).toHaveProperty('connection');

      expect(services.authentication).toBeInstanceOf(AuthenticationService);
      expect(services.deviceManagement).toBeInstanceOf(DeviceManagementService);
      expect(services.areaManagement).toBeInstanceOf(AreaManagementService);
      expect(services.messageRouting).toBeInstanceOf(MessageRoutingService);
    });

    it('should return same instances on multiple calls', () => {
      const services1 = container.getAllServices();
      const services2 = container.getAllServices();

      expect(services1.authentication).toBe(services2.authentication);
      expect(services1.deviceManagement).toBe(services2.deviceManagement);
      expect(services1.areaManagement).toBe(services2.areaManagement);
      expect(services1.messageRouting).toBe(services2.messageRouting);
      expect(services1.polling).toBe(services2.polling);
      expect(services1.connection).toBe(services2.connection);
    });
  });

  describe('destroy', () => {
    it('should clear all service references', async () => {
      // Create all services first
      container.getAuthenticationService();
      container.getDeviceManagementService();
      container.getAreaManagementService();
      container.getMessageRoutingService();
      container.getPollingService();
      container.getConnectionService();

      await container.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith('ServiceContainer destroyed');
    });

    it('should clear user data', async () => {
      container.setUserData(mockUserData);

      expect(container.getUserData()).toBe(mockUserData);

      await container.destroy();

      expect(container.getUserData()).toBeUndefined();
    });

    it('should create new instances after destroy', async () => {
      const service1 = container.getAuthenticationService();

      await container.destroy();

      const service2 = container.getAuthenticationService();

      expect(service1).not.toBe(service2); // Different instances
    });

    it('should shutdown polling service before clearing references', async () => {
      const pollingService = container.getPollingService();
      const shutdownSpy = vi.spyOn(pollingService, 'shutdown');

      await container.destroy();

      expect(shutdownSpy).toHaveBeenCalled();
    });

    it('should clear IoT API on destroy', async () => {
      container.setUserData(mockUserData);

      expect(container.getIotApi()).toBeDefined();

      await container.destroy();

      expect(container.getIotApi()).toBeUndefined();
    });
  });

  describe('getLogger', () => {
    it('should return the logger instance', () => {
      const logger = container.getLogger();

      expect(logger).toBe(mockLogger);
    });
  });

  describe('getClientManager', () => {
    it('should return the ClientManager instance', () => {
      const clientManager = container.getClientManager();

      expect(clientManager).not.toBeUndefined();
    });
  });

  describe('getUserData', () => {
    it('should return undefined when not authenticated', () => {
      expect(container.getUserData()).toBeUndefined();
    });

    it('should return user data after authentication', () => {
      container.setUserData(mockUserData);

      expect(container.getUserData()).toBe(mockUserData);
    });
  });

  describe('integration scenarios', () => {
    it('should support complete workflow: login -> set user data -> get services', () => {
      // 1. Get authentication service
      const authService = container.getAuthenticationService();
      expect(authService).toBeInstanceOf(AuthenticationService);

      // 2. Simulate successful login
      container.setUserData(mockUserData);

      // 3. Get device services
      const services = container.getAllServices();
      expect(services.deviceManagement).toBeInstanceOf(DeviceManagementService);
      expect(services.areaManagement).toBeInstanceOf(AreaManagementService);
      expect(services.messageRouting).toBeInstanceOf(MessageRoutingService);

      // 4. Verify user data is set
      expect(container.getUserData()).toBe(mockUserData);
    });

    it('should handle service creation before authentication', () => {
      // Create services before setting user data
      const deviceService = container.getDeviceManagementService();
      const areaService = container.getAreaManagementService();
      const messageService = container.getMessageRoutingService();

      expect(deviceService).toBeInstanceOf(DeviceManagementService);
      expect(areaService).toBeInstanceOf(AreaManagementService);
      expect(messageService).toBeInstanceOf(MessageRoutingService);

      // Now authenticate
      container.setUserData(mockUserData);

      // Services should be updated
      expect(container.getUserData()).toBe(mockUserData);
    });
  });
});
