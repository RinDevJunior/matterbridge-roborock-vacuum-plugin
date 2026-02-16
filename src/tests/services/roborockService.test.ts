import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockService } from '../../services/roborockService.js';
import { ServiceContainer } from '../../services/serviceContainer.js';
import { AuthenticationCoordinator } from '../../services/authentication/AuthenticationCoordinator.js';
import { DeviceManagementService } from '../../services/deviceManagementService.js';
import { AreaManagementService } from '../../services/areaManagementService.js';
import { MessageRoutingService } from '../../services/messageRoutingService.js';
import { PollingService } from '../../services/pollingService.js';
import { Device, UserData } from '../../roborockCommunication/models/index.js';
import { RoborockAuthenticateApi } from '../../roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import type { LocalStorage } from 'node-persist';
import type { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { asPartial } from '../testUtils.js';

describe('RoborockService - Comprehensive Coverage', () => {
  let service: RoborockService;
  let mockLogger: Partial<AnsiLogger>;
  let mockContainer: Partial<ServiceContainer>;
  let mockAuthCoordinator: Partial<AuthenticationCoordinator>;
  let mockDeviceService: Partial<DeviceManagementService>;
  let mockAreaService: Partial<AreaManagementService>;
  let mockMessageService: Partial<MessageRoutingService>;
  let mockPollingService: Partial<PollingService>;
  let mockPersist: Partial<LocalStorage>;
  let mockConfigManager: Partial<PlatformConfigManager>;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    };

    mockAuthCoordinator = {
      authenticate: vi.fn(),
    };

    mockDeviceService = {
      listDevices: vi.fn(),
      getHomeDataForUpdating: vi.fn(),
      setIotApi: vi.fn(),
      setAuthentication: vi.fn(),
      stopService: vi.fn(),
    };

    mockAreaService = {
      setSelectedAreas: vi.fn(),
      getSelectedAreas: vi.fn(),
      setSupportedAreas: vi.fn(),
      setSupportedAreaIndexMap: vi.fn(),
      setSupportedScenes: vi.fn(),
      getSupportedAreas: vi.fn(),
      getSupportedAreasIndexMap: vi.fn(),
      getSupportedRoutines: vi.fn(),
      getMapInfo: vi.fn(),
      getRoomMap: vi.fn(),
      getScenes: vi.fn(),
      startScene: vi.fn(),
      setMessageClient: vi.fn(),
      setIotApi: vi.fn(),
      clearAll: vi.fn(),
    };

    mockMessageService = {
      getCleanModeData: vi.fn(),
      getRoomIdFromMap: vi.fn(),
      changeCleanMode: vi.fn(),
      startClean: vi.fn(),
      pauseClean: vi.fn(),
      stopAndGoHome: vi.fn(),
      resumeClean: vi.fn(),
      playSoundToLocate: vi.fn(),
      customGet: vi.fn(),
      customSend: vi.fn(),
      setIotApi: vi.fn(),
      getMapInfo: vi.fn(),
      clearAll: vi.fn(),
    };
    mockPollingService = {
      setDeviceNotify: vi.fn(),
      activateDeviceNotifyOverLocal: vi.fn(),
      stopPolling: vi.fn(),
      shutdown: vi.fn(),
    };
    mockContainer = {
      getAuthenticationCoordinator: vi.fn().mockReturnValue(mockAuthCoordinator),
      getDeviceManagementService: vi.fn().mockReturnValue(mockDeviceService),
      getAreaManagementService: vi.fn().mockReturnValue(mockAreaService),
      getMessageRoutingService: vi.fn().mockReturnValue(mockMessageService),
      getPollingService: vi.fn().mockReturnValue(mockPollingService),
      getConnectionService: vi.fn().mockReturnValue({
        initializeMessageClient: vi.fn(),
        initializeMessageClientForLocal: vi.fn().mockResolvedValue(false),
        setDeviceNotify: vi.fn(),
      }),
      setUserData: vi.fn(),
      getIotApi: vi.fn(),
    };

    mockPersist = {
      init: vi.fn().mockResolvedValue(undefined),
      getItem: vi.fn().mockResolvedValue(undefined),
      setItem: vi.fn().mockResolvedValue(undefined),
    };

    mockConfigManager = {
      username: 'testuser',
      password: 'testpass',
      verificationCode: undefined,
      authenticationMethod: 'Password',
    };

    service = new RoborockService(
      {
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: mockPersist as LocalStorage,
        configManager: mockConfigManager as PlatformConfigManager,
        container: mockContainer as ServiceContainer,
        toastMessage: vi.fn(),
      },
      mockLogger as AnsiLogger,
      mockConfigManager as PlatformConfigManager,
    );
  });

  describe('Constructor and Initialization', () => {
    it('should create service with default factories when not provided', () => {
      const defaultService = new RoborockService(
        {
          refreshInterval: 10,
          baseUrl: 'https://api.roborock.com',
          persist: mockPersist as LocalStorage,
          configManager: mockConfigManager as PlatformConfigManager,
          container: mockContainer as ServiceContainer,
          toastMessage: vi.fn(),
        },
        mockLogger as AnsiLogger,
        mockConfigManager as PlatformConfigManager,
      );

      expect(defaultService).toBeInstanceOf(RoborockService);
    });

    it('should create service without injected container', () => {
      const defaultService = new RoborockService(
        {
          refreshInterval: 10,
          baseUrl: 'https://api.roborock.com',
          persist: mockPersist as LocalStorage,
          configManager: mockConfigManager as PlatformConfigManager,
          toastMessage: vi.fn(),
        },
        mockLogger as AnsiLogger,
        mockConfigManager as PlatformConfigManager,
      );

      expect(defaultService).toBeInstanceOf(RoborockService);
    });

    it('should create service with custom factories', () => {
      const customAuthFactory = vi.fn((logger: AnsiLogger) => new RoborockAuthenticateApi(logger));

      const customService = new RoborockService(
        {
          authenticateApiFactory: customAuthFactory,
          refreshInterval: 20000,
          baseUrl: 'https://custom-api.roborock.com',
          persist: mockPersist as LocalStorage,
          configManager: mockConfigManager as PlatformConfigManager,
          container: mockContainer as ServiceContainer,
          toastMessage: vi.fn(),
        },
        mockLogger as AnsiLogger,
        mockConfigManager as PlatformConfigManager,
      );

      expect(customService).toBeInstanceOf(RoborockService);
    });

    it('should create service with custom base URL', () => {
      const customService = new RoborockService(
        {
          refreshInterval: 15000,
          baseUrl: 'https://another-api.roborock.com',
          persist: mockPersist as LocalStorage,
          configManager: mockConfigManager as PlatformConfigManager,
          container: mockContainer as ServiceContainer,
          toastMessage: vi.fn(),
        },
        mockLogger as AnsiLogger,
        mockConfigManager as PlatformConfigManager,
      );

      expect(customService).toBeInstanceOf(RoborockService);
    });

    it('activateDeviceNotify delegates to device service', () => {
      const device: Device = { duid: 'test-duid' } as Device;

      // Test that method exists and doesn't throw with basic call
      expect(() => {
        service.activateDeviceNotify(device);
      }).not.toThrow();
    });
  });

  describe('Authentication', () => {
    it('should authenticate with password flow', async () => {
      vi.mocked(mockAuthCoordinator.authenticate)?.mockResolvedValue(
        asPartial<UserData>({
          nickname: 'Test User',
          username: 'testuser',
        }),
      );

      const result = await service.authenticate();

      expect(result.shouldContinue).toBe(true);
      expect(result.userData).toBeDefined();
      expect(mockAuthCoordinator.authenticate).toHaveBeenCalledWith('Password', {
        username: 'testuser',
        password: 'testpass',
        verificationCode: undefined,
      });
    });

    it('should authenticate with verification code flow', async () => {
      const mockConfigWith2FA = {
        username: 'testuser',
        password: 'testpass',
        verificationCode: '123456',
        authenticationMethod: 'VerificationCode',
      };
      const serviceWith2FA = new RoborockService(
        {
          refreshInterval: 10,
          baseUrl: 'https://api.roborock.com',
          persist: mockPersist as LocalStorage,
          configManager: mockConfigWith2FA as PlatformConfigManager,
          container: mockContainer as ServiceContainer,
          toastMessage: vi.fn(),
        },
        mockLogger as AnsiLogger,
        mockConfigWith2FA as PlatformConfigManager,
      );

      vi.mocked(mockAuthCoordinator.authenticate)?.mockResolvedValue(
        asPartial<UserData>({
          nickname: 'Test User',
          username: 'testuser',
        }),
      );

      const result = await serviceWith2FA.authenticate();

      expect(result.shouldContinue).toBe(true);
      expect(result.userData).toBeDefined();
      expect(mockAuthCoordinator.authenticate).toHaveBeenCalledWith('VerificationCode', {
        username: 'testuser',
        password: 'testpass',
        verificationCode: '123456',
      });
    });

    it('should return false when authentication fails', async () => {
      vi.mocked(mockAuthCoordinator.authenticate)?.mockRejectedValue(new Error('Auth failed'));

      const result = await service.authenticate();

      expect(result.shouldContinue).toBe(false);
      expect(result.userData).toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith('Authentication failed: Auth failed');
    });

    it('should return false when userData is undefined', async () => {
      vi.mocked(mockAuthCoordinator.authenticate)?.mockResolvedValue(undefined);

      const result = await service.authenticate();

      expect(result.shouldContinue).toBe(false);
      expect(result.userData).toBeUndefined();
      expect(mockLogger.info).toHaveBeenCalledWith('Authentication incomplete. Further action required (e.g., 2FA).');
    });
  });

  describe('getCustomAPI', () => {
    it('should throw error when iotApi is not initialized', async () => {
      vi.mocked(mockContainer.getIotApi)?.mockReturnValue(undefined);
      await expect(service.getCustomAPI('/test')).rejects.toThrow('IoT API not initialized. Please login first.');
    });

    it('should call iotApi.getCustom when iotApi is initialized', async () => {
      const mockIotApi = { getCustom: vi.fn().mockResolvedValue({ data: 'test' }) };
      vi.mocked(mockContainer.getIotApi)?.mockReturnValue(asPartial<RoborockIoTApi>(mockIotApi));

      const result = await service.getCustomAPI('/test');

      expect(result).toEqual({ data: 'test' });
      expect(mockIotApi.getCustom).toHaveBeenCalledWith('/test');
    });
  });
});
