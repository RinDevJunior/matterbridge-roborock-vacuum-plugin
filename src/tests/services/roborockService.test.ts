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
import type { ServiceArea } from 'matterbridge/matter/clusters';
import type { RoomIndexMap } from '../../core/application/models/index.js';
import { SCENE_AREA_ID_MIN } from '../../constants/index.js';

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
      setSupportedRoutines: vi.fn(),
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
      startClean: vi.fn().mockResolvedValue(undefined),
      pauseClean: vi.fn(),
      stopAndGoHome: vi.fn(),
      resumeClean: vi.fn(),
      stopClean: vi.fn().mockResolvedValue(undefined),
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
      synchronizeMessageClients: vi.fn(),
      destroy: vi.fn(),
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

  describe('stopClean', () => {
    it('should delegate to messageRoutingService.stopClean', async () => {
      await service.stopClean('duid-1');
      expect(mockMessageService.stopClean).toHaveBeenCalledWith('duid-1');
    });
  });

  describe('setDeviceNotify', () => {
    it('should set deviceNotify and delegate to pollingService and connectionService', () => {
      const cb = vi.fn();
      service.setDeviceNotify(cb);
      expect(service.deviceNotify).toBe(cb);
      expect(mockPollingService.setDeviceNotify).toHaveBeenCalledWith(cb);
    });
  });

  describe('initializeMessageClientForLocal', () => {
    it('should delegate to connectionService and return its result', async () => {
      const mockConnectionService = vi.mocked(mockContainer.getConnectionService)?.();
      vi.mocked(mockConnectionService?.initializeMessageClientForLocal)?.mockResolvedValue(true);

      const result = await service.initializeMessageClientForLocal(asPartial<Device>({ duid: 'duid-1' }));
      expect(result).toBe(true);
    });
  });

  describe('startClean - buildCleanCommand branches', () => {
    const duid = 'test-duid';

    function makeArea(areaId: number, mapId: number, name = ''): ServiceArea.Area {
      return asPartial<ServiceArea.Area>({
        areaId,
        mapId,
        areaInfo: { locationInfo: { locationName: name, floorNumber: 0, areaType: 1 }, landmarkInfo: null },
      });
    }

    it('should send routine command when selected area matches a routine', async () => {
      const routineAreaId = SCENE_AREA_ID_MIN + 10;
      vi.mocked(mockAreaService.getSelectedAreas)?.mockReturnValue([routineAreaId]);
      vi.mocked(mockAreaService.getSupportedRoutines)?.mockReturnValue([makeArea(routineAreaId, 0)]);
      vi.mocked(mockAreaService.getSupportedAreas)?.mockReturnValue([]);
      vi.mocked(mockAreaService.getSupportedAreasIndexMap)?.mockReturnValue(undefined);

      await service.startClean(duid);

      expect(mockMessageService.startClean).toHaveBeenCalledWith(
        duid,
        expect.objectContaining({ type: 'routine', routineId: 10 }),
      );
    });

    it('should send global command when no areas are selected', async () => {
      vi.mocked(mockAreaService.getSelectedAreas)?.mockReturnValue([]);
      vi.mocked(mockAreaService.getSupportedRoutines)?.mockReturnValue([]);
      vi.mocked(mockAreaService.getSupportedAreas)?.mockReturnValue([makeArea(1, 1), makeArea(2, 1)]);
      vi.mocked(mockAreaService.getSupportedAreasIndexMap)?.mockReturnValue(undefined);

      await service.startClean(duid);

      expect(mockMessageService.startClean).toHaveBeenCalledWith(duid, { type: 'global' });
    });

    it('should send global command when all rooms in active map are selected', async () => {
      const room1 = makeArea(1, 1);
      const room2 = makeArea(2, 1);
      const indexMap = asPartial<RoomIndexMap>({ getRoomId: vi.fn().mockImplementation((id: number) => id + 100) });

      vi.mocked(mockAreaService.getSelectedAreas)?.mockReturnValue([1, 2]);
      vi.mocked(mockAreaService.getSupportedRoutines)?.mockReturnValue([]);
      vi.mocked(mockAreaService.getSupportedAreas)?.mockReturnValue([room1, room2]);
      vi.mocked(mockAreaService.getSupportedAreasIndexMap)?.mockReturnValue(indexMap);

      await service.startClean(duid);

      expect(mockMessageService.startClean).toHaveBeenCalledWith(duid, { type: 'global' });
    });

    it('should send room command when specific rooms are selected (not all)', async () => {
      const room1 = makeArea(1, 1);
      const room2 = makeArea(2, 1);
      const room3 = makeArea(3, 1);
      const indexMap = asPartial<RoomIndexMap>({ getRoomId: vi.fn().mockImplementation((id: number) => id + 100) });

      vi.mocked(mockAreaService.getSelectedAreas)?.mockReturnValue([1]);
      vi.mocked(mockAreaService.getSupportedRoutines)?.mockReturnValue([]);
      vi.mocked(mockAreaService.getSupportedAreas)?.mockReturnValue([room1, room2, room3]);
      vi.mocked(mockAreaService.getSupportedAreasIndexMap)?.mockReturnValue(indexMap);

      await service.startClean(duid);

      expect(mockMessageService.startClean).toHaveBeenCalledWith(
        duid,
        expect.objectContaining({ type: 'room', roomIds: [101] }),
      );
    });

    it('should send global command when selected area has no matching room in indexMap', async () => {
      const room1 = makeArea(1, 1);
      const indexMap = asPartial<RoomIndexMap>({ getRoomId: vi.fn().mockReturnValue(undefined) });

      vi.mocked(mockAreaService.getSelectedAreas)?.mockReturnValue([1]);
      vi.mocked(mockAreaService.getSupportedRoutines)?.mockReturnValue([]);
      vi.mocked(mockAreaService.getSupportedAreas)?.mockReturnValue([room1]);
      vi.mocked(mockAreaService.getSupportedAreasIndexMap)?.mockReturnValue(indexMap);

      await service.startClean(duid);

      expect(mockMessageService.startClean).toHaveBeenCalledWith(duid, { type: 'global' });
    });
  });
});
