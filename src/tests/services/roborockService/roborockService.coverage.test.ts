import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { RoborockService } from '../../../services/roborockService.js';
import { ServiceContainer } from '../../../services/serviceContainer.js';
import { AuthenticationCoordinator } from '../../../services/authentication/AuthenticationCoordinator.js';
import { DeviceManagementService } from '../../../services/deviceManagementService.js';
import { AreaManagementService } from '../../../services/areaManagementService.js';
import { MessageRoutingService } from '../../../services/messageRoutingService.js';
import { PollingService } from '../../../services/pollingService.js';
import { ConnectionService } from '../../../services/connectionService.js';
import { Device, UserData, Scene, RawRoomMappingData, Home } from '../../../roborockCommunication/models/index.js';
import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { MapInfo, RoomIndexMap } from '../../../core/application/models/index.js';
import { RequestMessage } from '../../../roborockCommunication/models/index.js';
import { asPartial, asType } from '../../testUtils.js';
import type { LocalStorage } from 'node-persist';
import type { PlatformConfigManager } from '../../../platform/platformConfigManager.js';
import { RoborockIoTApi } from '../../../roborockCommunication/api/iotClient.js';
import { CleanSequenceType } from '../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';

describe('RoborockService - Complete Coverage', () => {
  let service: RoborockService;
  let mockLogger: Partial<AnsiLogger>;
  let mockContainer: ServiceContainer;
  let mockAuthCoordinator: AuthenticationCoordinator;
  let mockDeviceService: DeviceManagementService;
  let mockAreaService: AreaManagementService;
  let mockMessageService: MessageRoutingService;
  let mockPollingService: Partial<PollingService>;
  let mockConnectionService: ConnectionService;
  let mockPersist: Partial<LocalStorage>;
  let mockConfigManager: Partial<PlatformConfigManager> & { verificationCode?: string };

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    };

    mockAuthCoordinator = asPartial<AuthenticationCoordinator>({
      authenticate: vi.fn(),
    });

    mockDeviceService = asPartial<DeviceManagementService>({
      listDevices: vi.fn(),
      getHomeDataForUpdating: vi.fn(),
    });

    mockAreaService = asPartial<AreaManagementService>({
      setSelectedAreas: vi.fn(),
      getSelectedAreas: vi.fn().mockReturnValue([]),
      setSupportedAreas: vi.fn(),
      setSupportedAreaIndexMap: vi.fn(),
      setSupportedScenes: vi.fn(),
      getSupportedAreas: vi.fn().mockReturnValue([]),
      getSupportedAreasIndexMap: vi.fn(),
      getSupportedRoutines: vi.fn().mockReturnValue([]),
      getMapInfo: vi.fn(),
      getRoomMap: vi.fn(),
      getScenes: vi.fn(),
      startScene: vi.fn(),
    });

    mockMessageService = asPartial<MessageRoutingService>({
      getCleanModeData: vi.fn(),
      getRoomIdFromMap: vi.fn(),
      changeCleanMode: vi.fn(),
      startClean: vi.fn(),
      pauseClean: vi.fn(),
      stopAndGoHome: vi.fn(),
      resumeClean: vi.fn(),
      stopClean: vi.fn(),
      playSoundToLocate: vi.fn(),
      customGet: vi.fn(),
      customSend: vi.fn(),
    });

    mockPollingService = {
      setDeviceNotify: vi.fn(),
      activateDeviceNotifyOverLocal: vi.fn(),
    };

    mockConnectionService = asPartial<ConnectionService>({
      initializeMessageClient: vi.fn(),
      initializeMessageClientForLocal: vi.fn().mockResolvedValue(true),
      setDeviceNotify: vi.fn(),
    });

    mockContainer = asPartial<ServiceContainer>({
      getAuthenticationCoordinator: vi.fn().mockReturnValue(mockAuthCoordinator),
      getDeviceManagementService: vi.fn().mockReturnValue(mockDeviceService),
      getAreaManagementService: vi.fn().mockReturnValue(mockAreaService),
      getMessageRoutingService: vi.fn().mockReturnValue(mockMessageService),
      getPollingService: vi.fn().mockReturnValue(mockPollingService),
      getConnectionService: vi.fn().mockReturnValue(mockConnectionService),
      setUserData: vi.fn(),
      getIotApi: vi.fn(),
      synchronizeMessageClients: vi.fn(),
      destroy: vi.fn(),
    });

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

  describe('Authentication', () => {
    it('should throw error when configManager is not provided', async () => {
      const serviceWithoutConfig = new RoborockService(
        {
          refreshInterval: 10,
          baseUrl: 'https://api.roborock.com',
          persist: mockPersist as LocalStorage,
          configManager: mockConfigManager as PlatformConfigManager,
          container: mockContainer as ServiceContainer,
          toastMessage: vi.fn(),
        },
        mockLogger as AnsiLogger,
        undefined as unknown as PlatformConfigManager,
      );

      await expect(serviceWithoutConfig.authenticate()).rejects.toThrow('PlatformConfigManager not provided. Cannot authenticate.');
    });

    it('should log password as masked when provided', async () => {
      vi.mocked(mockAuthCoordinator.authenticate).mockResolvedValue({
        nickname: 'Test',
        username: 'test',
      } as UserData);

      await service.authenticate();

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('******'));
    });

    it('should log verification code as masked when provided', async () => {
      mockConfigManager.verificationCode = '123456';
      vi.mocked(mockAuthCoordinator.authenticate).mockResolvedValue({
        nickname: 'Test',
        username: 'test',
      } as UserData);

      await service.authenticate();

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('******'));
    });

    it('should log success message with user nickname and username', async () => {
      const userData = { nickname: 'TestUser', username: 'test@example.com' } as UserData;
      vi.mocked(mockAuthCoordinator.authenticate).mockResolvedValue(userData);

      await service.authenticate();

      expect(mockLogger.info).toHaveBeenCalledWith('Authentication successful for user: TestUser (test@example.com)');
    });

    it('should call setUserData on container when authentication succeeds', async () => {
      const userData = { nickname: 'Test', username: 'test' } as UserData;
      vi.mocked(mockAuthCoordinator.authenticate).mockResolvedValue(userData);

      await service.authenticate();

      expect(mockContainer.setUserData).toHaveBeenCalledWith(userData);
    });
  });

  describe('Device Management', () => {
    it('should delegate listDevices to deviceService', async () => {
      const devices = [{ duid: 'test-device' }] as Device[];
      vi.mocked(mockDeviceService.listDevices).mockResolvedValue(devices);

      const result = await service.listDevices();

      expect(result).toEqual(devices);
      expect(mockDeviceService.listDevices).toHaveBeenCalled();
    });

    it('should delegate getHomeDataForUpdating to deviceService', async () => {
      const homeData = { id: 123, name: 'Test Home' };
      vi.mocked(mockDeviceService.getHomeDataForUpdating).mockResolvedValue(asPartial<Home>(homeData));

      const result = await service.getHomeDataForUpdating(123);

      expect(result).toEqual(homeData);
      expect(mockDeviceService.getHomeDataForUpdating).toHaveBeenCalledWith(123);
    });

    it('should initialize message client and synchronize', async () => {
      const device = { duid: 'test' } as Device;
      const userData = { username: 'test' } as UserData;

      await service.initializeMessageClient(device, userData);

      expect(mockConnectionService.initializeMessageClient).toHaveBeenCalledWith(device, userData);
      expect(mockContainer.synchronizeMessageClients).toHaveBeenCalled();
    });

    it('should initialize local message client and synchronize', async () => {
      const device = { duid: 'test' } as Device;
      vi.mocked(mockConnectionService.initializeMessageClientForLocal).mockResolvedValue(true);

      const result = await service.initializeMessageClientForLocal(device);

      expect(result).toBe(true);
      expect(mockConnectionService.initializeMessageClientForLocal).toHaveBeenCalledWith(device);
      expect(mockContainer.synchronizeMessageClients).toHaveBeenCalled();
    });

    it('should handle local message client initialization failure', async () => {
      const device = { duid: 'test' } as Device;
      vi.mocked(mockConnectionService.initializeMessageClientForLocal).mockResolvedValue(false);

      const result = await service.initializeMessageClientForLocal(device);

      expect(result).toBe(false);
      expect(mockContainer.synchronizeMessageClients).toHaveBeenCalled();
    });

    it('should set device notify callback on both polling and connection services', () => {
      const callback = vi.fn();

      service.setDeviceNotify(callback);

      expect(service.deviceNotify).toBe(callback);
      expect(mockPollingService.setDeviceNotify).toHaveBeenCalledWith(callback);
      expect(mockConnectionService.setDeviceNotify).toHaveBeenCalledWith(callback);
    });

    it('should activate device notify for local network', () => {
      const device = { duid: 'test' } as Device;

      service.activateDeviceNotify(device);

      expect(mockPollingService.activateDeviceNotifyOverLocal).toHaveBeenCalledWith(device);
    });

    it('should destroy container when stopping service', () => {
      service.stopService();

      expect(mockContainer.destroy).toHaveBeenCalled();
    });
  });

  describe('Area Management', () => {
    it('should delegate setSelectedAreas to areaService', () => {
      service.setSelectedAreas('duid', [1, 2, 3]);

      expect(mockAreaService.setSelectedAreas).toHaveBeenCalledWith('duid', [1, 2, 3]);
    });

    it('should delegate getSelectedAreas to areaService', () => {
      vi.mocked(mockAreaService.getSelectedAreas).mockReturnValue([1, 2]);

      const result = service.getSelectedAreas('duid');

      expect(result).toEqual([1, 2]);
      expect(mockAreaService.getSelectedAreas).toHaveBeenCalledWith('duid');
    });

    it('should delegate setSupportedAreas to areaService', () => {
      const areas = [asPartial<ServiceArea.Area>({ areaId: 1 })];

      service.setSupportedAreas('duid', areas as ServiceArea.Area[]);

      expect(mockAreaService.setSupportedAreas).toHaveBeenCalledWith('duid', areas);
    });

    it('should delegate setSupportedAreaIndexMap to areaService', () => {
      const indexMap = new RoomIndexMap(new Map());

      service.setSupportedAreaIndexMap('duid', indexMap);

      expect(mockAreaService.setSupportedAreaIndexMap).toHaveBeenCalledWith('duid', indexMap);
    });

    it('should delegate setSupportedScenes to areaService', () => {
      const scenes = [asPartial<ServiceArea.Area>({ areaId: 1 })];

      service.setSupportedScenes('duid', scenes as ServiceArea.Area[]);

      expect(mockAreaService.setSupportedScenes).toHaveBeenCalledWith('duid', scenes);
    });

    it('should delegate getSupportedAreas to areaService', () => {
      const areas = [asPartial<ServiceArea.Area>({ areaId: 1 })];
      vi.mocked(mockAreaService.getSupportedAreas).mockReturnValue(areas);

      const result = service.getSupportedAreas('duid');

      expect(result).toEqual(areas);
      expect(mockAreaService.getSupportedAreas).toHaveBeenCalledWith('duid');
    });

    it('should delegate getSupportedAreasIndexMap to areaService', () => {
      const indexMap = new RoomIndexMap(new Map());
      vi.mocked(mockAreaService.getSupportedAreasIndexMap).mockReturnValue(indexMap);

      const result = service.getSupportedAreasIndexMap('duid');

      expect(result).toEqual(indexMap);
      expect(mockAreaService.getSupportedAreasIndexMap).toHaveBeenCalledWith('duid');
    });

    it('should return undefined when getSupportedAreasIndexMap has no data', () => {
      vi.mocked(mockAreaService.getSupportedAreasIndexMap).mockReturnValue(undefined);

      const result = service.getSupportedAreasIndexMap('duid');

      expect(result).toBeUndefined();
    });

    it('should delegate getMapInfo to areaService', async () => {
      const mapInfo = MapInfo.empty();
      vi.mocked(mockAreaService.getMapInfo).mockResolvedValue(mapInfo);

      const result = await service.getMapInfo('duid');

      expect(result).toEqual(mapInfo);
      expect(mockAreaService.getMapInfo).toHaveBeenCalledWith('duid');
    });

    it('should delegate getRoomMap to areaService', async () => {
      const roomMap = asPartial<RawRoomMappingData>([]);
      vi.mocked(mockAreaService.getRoomMap).mockResolvedValue(roomMap);

      const result = await service.getRoomMap('duid', 1);

      expect(result).toEqual(roomMap);
      expect(mockAreaService.getRoomMap).toHaveBeenCalledWith('duid', 1);
    });

    it('should delegate getScenes to areaService', async () => {
      const scenes = [{ id: 1, name: 'Scene 1' }] as Scene[];
      vi.mocked(mockAreaService.getScenes).mockResolvedValue(scenes);

      const result = await service.getScenes(123);

      expect(result).toEqual(scenes);
      expect(mockAreaService.getScenes).toHaveBeenCalledWith(123);
    });

    it('should return undefined when getScenes has no data', async () => {
      vi.mocked(mockAreaService.getScenes).mockResolvedValue(undefined);

      const result = await service.getScenes(123);

      expect(result).toBeUndefined();
    });

    it('should delegate startScene to areaService', async () => {
      vi.mocked(mockAreaService.startScene).mockResolvedValue({ success: true });

      const result = await service.startScene(1);

      expect(result).toEqual({ success: true });
      expect(mockAreaService.startScene).toHaveBeenCalledWith(1);
    });
  });

  describe('Message Routing', () => {
    it('should delegate getCleanModeData to messageService', async () => {
      const cleanMode = new CleanModeSetting(100, 200, 25, 300, CleanSequenceType.Persist);
      vi.mocked(mockMessageService.getCleanModeData).mockResolvedValue(cleanMode);

      const result = await service.getCleanModeData('duid');

      expect(result).toEqual(cleanMode);
      expect(mockMessageService.getCleanModeData).toHaveBeenCalledWith('duid');
    });

    it('should delegate getRoomIdFromMap to messageService', async () => {
      vi.mocked(mockMessageService.getRoomIdFromMap).mockResolvedValue(5);

      const result = await service.getRoomIdFromMap('duid');

      expect(result).toBe(5);
      expect(mockMessageService.getRoomIdFromMap).toHaveBeenCalledWith('duid');
    });

    it('should return undefined when getRoomIdFromMap has no data', async () => {
      vi.mocked(mockMessageService.getRoomIdFromMap).mockResolvedValue(undefined);

      const result = await service.getRoomIdFromMap('duid');

      expect(result).toBeUndefined();
    });

    it('should delegate changeCleanMode to messageService', async () => {
      const settings = new CleanModeSetting(102, 203, 25, 300, CleanSequenceType.Persist);

      await service.changeCleanMode('duid', settings);

      expect(mockMessageService.changeCleanMode).toHaveBeenCalledWith('duid', settings);
    });

    it('should delegate startClean with selected and supported areas', async () => {
      const selectedAreas = [1, 2];
      const supportedRooms = [asPartial<ServiceArea.Area>({ areaId: 1 })];
      const supportedRoutines = [asPartial<ServiceArea.Area>({ areaId: 3 })];

      vi.mocked(mockAreaService.getSelectedAreas).mockReturnValue(selectedAreas);
      vi.mocked(mockAreaService.getSupportedAreas).mockReturnValue(supportedRooms);
      vi.mocked(mockAreaService.getSupportedRoutines).mockReturnValue(supportedRoutines);

      await service.startClean('duid');

      expect(mockMessageService.startClean).toHaveBeenCalledWith('duid', selectedAreas, supportedRooms, supportedRoutines);
    });

    it('should handle startClean with empty supported areas', async () => {
      vi.mocked(mockAreaService.getSelectedAreas).mockReturnValue([1]);
      vi.mocked(mockAreaService.getSupportedAreas).mockReturnValue(asType<ServiceArea.Area[]>(undefined));
      vi.mocked(mockAreaService.getSupportedRoutines).mockReturnValue(asType<ServiceArea.Area[]>(undefined));

      await service.startClean('duid');

      expect(mockMessageService.startClean).toHaveBeenCalledWith('duid', [1], [], []);
    });

    it('should delegate pauseClean to messageService', async () => {
      await service.pauseClean('duid');

      expect(mockMessageService.pauseClean).toHaveBeenCalledWith('duid');
    });

    it('should delegate stopAndGoHome to messageService', async () => {
      await service.stopAndGoHome('duid');

      expect(mockMessageService.stopAndGoHome).toHaveBeenCalledWith('duid');
    });

    it('should delegate resumeClean to messageService', async () => {
      await service.resumeClean('duid');

      expect(mockMessageService.resumeClean).toHaveBeenCalledWith('duid');
    });

    it('should delegate stopClean to messageService', async () => {
      await service.stopClean('duid');

      expect(mockMessageService.stopClean).toHaveBeenCalledWith('duid');
    });

    it('should delegate playSoundToLocate to messageService', async () => {
      await service.playSoundToLocate('duid');

      expect(mockMessageService.playSoundToLocate).toHaveBeenCalledWith('duid');
    });

    it('should delegate customGet to messageService', async () => {
      const request = { method: 'get_status' } as RequestMessage;
      const response = { state: 8 };
      vi.mocked(mockMessageService.customGet).mockResolvedValue(response);

      const result = await service.customGet('duid', request);

      expect(result).toEqual(response);
      expect(mockMessageService.customGet).toHaveBeenCalledWith('duid', request);
    });

    it('should delegate customSend to messageService', async () => {
      const request = { method: 'app_start' } as RequestMessage;

      await service.customSend('duid', request);

      expect(mockMessageService.customSend).toHaveBeenCalledWith('duid', request);
    });
  });

  describe('Custom API', () => {
    it('should call iotApi.getCustom when initialized', async () => {
      const mockIotApi = { getCustom: vi.fn().mockResolvedValue({ result: 'success' }) };
      vi.mocked(mockContainer.getIotApi).mockReturnValue(asPartial<RoborockIoTApi>(mockIotApi));

      const result = await service.getCustomAPI<{ result: string }>('/custom/endpoint');

      expect(result).toEqual({ result: 'success' });
      expect(mockIotApi.getCustom).toHaveBeenCalledWith('/custom/endpoint');
    });
  });
});
