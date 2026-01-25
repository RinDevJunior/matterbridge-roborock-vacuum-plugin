import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { ServiceContainer } from '../../core/ServiceContainer.js';
import { RoborockAuthenticateApi } from '../../roborockCommunication/api/authClient.js';
import { UserData } from '../../roborockCommunication/models/index.js';
import type { IDeviceGateway } from '../../core/ports/IDeviceGateway.js';
import type { IAuthGateway } from '../../core/ports/IAuthGateway.js';

function createMockLogger(): AnsiLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    log: vi.fn(),
  } as unknown as AnsiLogger;
}

function createMockAuthenticateApi(): RoborockAuthenticateApi {
  return {
    getUserDetails: vi.fn(),
    loginWithPassword: vi.fn(),
    sendEmailCode: vi.fn(),
    loginWithCode: vi.fn(),
  } as unknown as RoborockAuthenticateApi;
}

function createMockUserData(): UserData {
  return {
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
}

describe('ServiceContainer', () => {
  let container: ServiceContainer;
  let mockLogger: AnsiLogger;
  let mockAuthApi: RoborockAuthenticateApi;
  let mockUserData: UserData;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockAuthApi = createMockAuthenticateApi();
    mockUserData = createMockUserData();

    container = new ServiceContainer(mockLogger, mockAuthApi);
  });

  afterEach(async () => {
    await container.dispose();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create container with provided dependencies', () => {
      expect(container).toBeInstanceOf(ServiceContainer);
    });

    it('should create authGateway immediately', () => {
      const authGateway = container.getAuthGateway();
      expect(authGateway).toBeDefined();
    });
  });

  describe('initialize', () => {
    it('should create clientRouter and deviceGateway', () => {
      container.initialize(mockUserData);

      const deviceGateway = container.getDeviceGateway();
      const clientRouter = container.getClientRouter();

      expect(deviceGateway).toBeDefined();
      expect(clientRouter).toBeDefined();
    });

    it('should log info message when initialized', () => {
      container.initialize(mockUserData);

      expect(mockLogger.info).toHaveBeenCalledWith('Service container initialized with user data');
    });

    it('should allow multiple initializations', () => {
      container.initialize(mockUserData);
      container.initialize(mockUserData);

      const deviceGateway = container.getDeviceGateway();
      expect(deviceGateway).toBeDefined();
    });
  });

  describe('getDeviceGateway', () => {
    it('should return deviceGateway after initialization', () => {
      container.initialize(mockUserData);

      const deviceGateway = container.getDeviceGateway();

      expect(deviceGateway).toBeDefined();
      expect(deviceGateway.sendCommand).toBeDefined();
      expect(deviceGateway.getStatus).toBeDefined();
      expect(deviceGateway.subscribe).toBeDefined();
    });

    it('should throw error when not initialized', () => {
      expect(() => container.getDeviceGateway()).toThrow('ServiceContainer not initialized. Call initialize() first.');
    });

    it('should return same instance on multiple calls', () => {
      container.initialize(mockUserData);

      const deviceGateway1 = container.getDeviceGateway();
      const deviceGateway2 = container.getDeviceGateway();

      expect(deviceGateway1).toBe(deviceGateway2);
    });
  });

  describe('getAuthGateway', () => {
    it('should return authGateway without initialization', () => {
      const authGateway = container.getAuthGateway();

      expect(authGateway).toBeDefined();
      expect(authGateway.requestVerificationCode).toBeDefined();
      expect(authGateway.authenticate2FA).toBeDefined();
      expect(authGateway.authenticatePassword).toBeDefined();
      expect(authGateway.refreshToken).toBeDefined();
    });

    it('should return same instance on multiple calls', () => {
      const authGateway1 = container.getAuthGateway();
      const authGateway2 = container.getAuthGateway();

      expect(authGateway1).toBe(authGateway2);
    });

    it('should be available after initialization', () => {
      container.initialize(mockUserData);

      const authGateway = container.getAuthGateway();

      expect(authGateway).toBeDefined();
    });
  });

  describe('getClientRouter', () => {
    it('should return clientRouter after initialization', () => {
      container.initialize(mockUserData);

      const clientRouter = container.getClientRouter();

      expect(clientRouter).toBeDefined();
    });

    it('should throw error when not initialized', () => {
      expect(() => container.getClientRouter()).toThrow('ServiceContainer not initialized. Call initialize() first.');
    });

    it('should return same instance on multiple calls', () => {
      container.initialize(mockUserData);

      const clientRouter1 = container.getClientRouter();
      const clientRouter2 = container.getClientRouter();

      expect(clientRouter1).toBe(clientRouter2);
    });
  });

  describe('dispose', () => {
    it('should disconnect clientRouter when initialized', async () => {
      container.initialize(mockUserData);
      const clientRouter = container.getClientRouter();
      const disconnectSpy = vi.spyOn(clientRouter, 'disconnect');

      await container.dispose();

      expect(disconnectSpy).toHaveBeenCalled();
    });

    it('should log info message when disposed', async () => {
      container.initialize(mockUserData);

      await container.dispose();

      expect(mockLogger.info).toHaveBeenCalledWith('Service container disposed');
    });

    it('should not throw when disposing without initialization', async () => {
      await expect(container.dispose()).resolves.not.toThrow();
    });

    it('should log info even when not initialized', async () => {
      await container.dispose();

      expect(mockLogger.info).toHaveBeenCalledWith('Service container disposed');
    });

    it('should handle multiple dispose calls', async () => {
      container.initialize(mockUserData);

      await container.dispose();
      await container.dispose();

      expect(mockLogger.info).toHaveBeenCalledTimes(3);
    });
  });

  describe('integration scenarios', () => {
    it('should support complete workflow: construct -> initialize -> get services -> dispose', async () => {
      // 1. Construct container
      expect(container).toBeInstanceOf(ServiceContainer);

      // 2. Get auth gateway (available immediately)
      const authGateway = container.getAuthGateway();
      expect(authGateway).toBeDefined();

      // 3. Initialize with user data
      container.initialize(mockUserData);
      expect(mockLogger.info).toHaveBeenCalledWith('Service container initialized with user data');

      // 4. Get device services
      const deviceGateway = container.getDeviceGateway();
      const clientRouter = container.getClientRouter();
      expect(deviceGateway).toBeDefined();
      expect(clientRouter).toBeDefined();

      // 5. Dispose
      await container.dispose();
      expect(mockLogger.info).toHaveBeenCalledWith('Service container disposed');
    });

    it('should throw appropriate errors when accessing uninitialized services', () => {
      expect(() => container.getDeviceGateway()).toThrow('ServiceContainer not initialized. Call initialize() first.');
      expect(() => container.getClientRouter()).toThrow('ServiceContainer not initialized. Call initialize() first.');
    });

    it('should maintain singleton pattern for all gateways', () => {
      container.initialize(mockUserData);

      const authGateway1 = container.getAuthGateway();
      const authGateway2 = container.getAuthGateway();
      const deviceGateway1 = container.getDeviceGateway();
      const deviceGateway2 = container.getDeviceGateway();
      const clientRouter1 = container.getClientRouter();
      const clientRouter2 = container.getClientRouter();

      expect(authGateway1).toBe(authGateway2);
      expect(deviceGateway1).toBe(deviceGateway2);
      expect(clientRouter1).toBe(clientRouter2);
    });
  });
});
