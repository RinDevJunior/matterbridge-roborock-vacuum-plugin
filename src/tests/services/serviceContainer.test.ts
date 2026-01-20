import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockAuthenticateApi, RoborockIoTApi, UserData } from '@/roborockCommunication/index.js';
import {
  ClientManager,
  ServiceContainer,
  ServiceContainerConfig,
  AuthenticationService,
  DeviceManagementService,
  AreaManagementService,
  MessageRoutingService,
} from '@/services/index.js';

describe('ServiceContainer', () => {
  let container: ServiceContainer;
  let mockLogger: AnsiLogger;
  let mockClientManager: ClientManager;
  let mockAuthApi: RoborockAuthenticateApi;
  let mockIotApi: RoborockIoTApi;
  let config: ServiceContainerConfig;
  let mockUserData: UserData;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    } as any;

    mockClientManager = {
      get: vi.fn(),
      has: vi.fn(),
      remove: vi.fn(),
    } as any;

    mockAuthApi = {
      getUserDetails: vi.fn(),
      loginWithPassword: vi.fn(),
      sendEmailCode: vi.fn(),
      loginWithCode: vi.fn(),
    } as any;

    mockIotApi = {
      getHomev2: vi.fn(),
      getHomev3: vi.fn(),
      getHome: vi.fn(),
      getRoomMapping: vi.fn(),
      subscribeToMQTT: vi.fn(),
    } as any;

    mockUserData = {
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
        r: { a: 'test-region-a', m: 'test-mqtt' },
      },
    } as UserData;

    config = {
      baseUrl: 'https://test.roborock.com',
      refreshInterval: 30000,
      authenticateApiFactory: vi.fn(() => mockAuthApi),
      iotApiFactory: vi.fn(() => mockIotApi),
    };

    container = new ServiceContainer(mockLogger, mockClientManager, config);
  });

  afterEach(() => {
    container.destroy();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create container with provided dependencies', () => {
      expect(container).toBeInstanceOf(ServiceContainer);
      expect(container.getLogger()).toBe(mockLogger);
      expect(container.getClientManager()).toBe(mockClientManager);
    });

    it('should use custom factories when provided', () => {
      expect(config.authenticateApiFactory).toHaveBeenCalledWith(mockLogger, config.baseUrl);
    });

    it('should create default factories when not provided', () => {
      const defaultConfig = {
        baseUrl: 'https://default.com',
        refreshInterval: 10000,
      };

      const defaultContainer = new ServiceContainer(mockLogger, mockClientManager, defaultConfig);

      expect(defaultContainer).toBeInstanceOf(ServiceContainer);
      defaultContainer.destroy();
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

  describe('getAllServices', () => {
    it('should return all services in a bundle', () => {
      const services = container.getAllServices();

      expect(services).toHaveProperty('authentication');
      expect(services).toHaveProperty('deviceManagement');
      expect(services).toHaveProperty('areaManagement');
      expect(services).toHaveProperty('messageRouting');

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
    });
  });

  describe('destroy', () => {
    it('should clear all service references', () => {
      // Create all services first
      container.getAuthenticationService();
      container.getDeviceManagementService();
      container.getAreaManagementService();
      container.getMessageRoutingService();

      container.destroy();

      expect(mockLogger.debug).toHaveBeenCalledWith('ServiceContainer destroyed');
    });

    it('should clear user data', () => {
      container.setUserData(mockUserData);

      expect(container.getUserData()).toBe(mockUserData);

      container.destroy();

      expect(container.getUserData()).toBeUndefined();
    });

    it('should create new instances after destroy', () => {
      const service1 = container.getAuthenticationService();

      container.destroy();

      const service2 = container.getAuthenticationService();

      expect(service1).not.toBe(service2); // Different instances
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

      expect(clientManager).toBe(mockClientManager);
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
