import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import RoborockService from '@/roborockService.js';
import { ClientManager, AreaManagementService, MessageRoutingService, DeviceManagementService, AuthenticationService, PollingService, ServiceContainer } from '@/services/index.js';
import { UserData, Device, MessageProcessor } from '@/roborockCommunication/index.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { RoomIndexMap } from '@/model/RoomIndexMap.js';

describe('RoborockService - Comprehensive Coverage', () => {
  let service: RoborockService;
  let mockLogger: AnsiLogger;
  let mockClientManager: ClientManager;
  let mockContainer: ServiceContainer;
  let mockAuthService: AuthenticationService;
  let mockDeviceService: DeviceManagementService;
  let mockAreaService: AreaManagementService;
  let mockMessageService: MessageRoutingService;
  let mockPollingService: PollingService;
  let mockUserData: UserData;
  let mockDevice: Device;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    } as unknown as AnsiLogger;

    mockClientManager = {
      get: vi.fn(),
      destroy: vi.fn(),
      destroyAll: vi.fn(),
    } as unknown as ClientManager;

    mockAuthService = {
      requestVerificationCode: vi.fn(),
      loginWithVerificationCode: vi.fn(),
      loginWithCachedToken: vi.fn(),
      loginWithPassword: vi.fn(),
    } as unknown as AuthenticationService;

    mockDeviceService = {
      listDevices: vi.fn(),
      getHomeDataForUpdating: vi.fn(),
      initializeMessageClient: vi.fn(),
      initializeMessageClientForLocal: vi.fn(),
      setDeviceNotify: vi.fn(),
      activateDeviceNotifyOverMQTT: vi.fn(),
      stopService: vi.fn(),
      setAuthentication: vi.fn(),
      messageClient: undefined,
      messageProcessorMap: new Map(),
      mqttAlwaysOnDevices: new Map(),
    } as unknown as DeviceManagementService;

    mockAreaService = {
      setSelectedAreas: vi.fn(),
      getSelectedAreas: vi.fn(),
      setSupportedAreas: vi.fn(),
      setSupportedAreaIndexMap: vi.fn(),
      setSupportedScenes: vi.fn(),
      getSupportedAreas: vi.fn(),
      getSupportedAreasIndexMap: vi.fn(),
      getSupportedRoutines: vi.fn(),
      getMapInformation: vi.fn(),
      getRoomMappings: vi.fn(),
      getScenes: vi.fn(),
      startScene: vi.fn(),
      setMessageClient: vi.fn(),
      setIotApi: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as AreaManagementService;

    mockMessageService = {
      getMessageProcessor: vi.fn(),
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
      registerMessageProcessor: vi.fn(),
      setMqttAlwaysOn: vi.fn(),
      getMqttAlwaysOn: vi.fn(),
      setIotApi: vi.fn(),
      clearAll: vi.fn(),
    } as unknown as MessageRoutingService;

    mockPollingService = {
      setDeviceNotify: vi.fn(),
      activateDeviceNotifyOverLocal: vi.fn(),
      activateDeviceNotifyOverMQTT: vi.fn(),
      stopPolling: vi.fn(),
      shutdown: vi.fn(),
    } as unknown as PollingService;

    mockContainer = {
      getAuthenticationService: vi.fn().mockReturnValue(mockAuthService),
      getDeviceManagementService: vi.fn().mockReturnValue(mockDeviceService),
      getAreaManagementService: vi.fn().mockReturnValue(mockAreaService),
      getMessageRoutingService: vi.fn().mockReturnValue(mockMessageService),
      getPollingService: vi.fn().mockReturnValue(mockPollingService),
      setUserData: vi.fn(),
      getIotApi: vi.fn(),
    } as unknown as ServiceContainer;

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

    mockDevice = {
      duid: 'device-123',
      name: 'Test Vacuum',
      localKey: 'local-key-789',
      pv: 'A01',
      productId: 'product-456',
      runtimeEnv: { featureSet: 123 },
    } as unknown as Device;

    service = new RoborockService(undefined, undefined, 30000, mockClientManager, mockLogger, undefined, mockContainer);
  });

  describe('Authentication Methods', () => {
    it('should request verification code', async () => {
      await service.requestVerificationCode('test@example.com');

      expect(mockAuthService.requestVerificationCode).toHaveBeenCalledWith('test@example.com');
    });

    it('should login with verification code and set user data', async () => {
      const saveCallback = vi.fn();
      (mockAuthService.loginWithVerificationCode as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserData);

      const result = await service.loginWithVerificationCode('test@example.com', '123456', saveCallback);

      expect(mockAuthService.loginWithVerificationCode).toHaveBeenCalledWith('test@example.com', '123456', saveCallback);
      expect(mockContainer.setUserData).toHaveBeenCalledWith(mockUserData);
      expect(result).toBe(mockUserData);
    });

    it('should login with cached token and set user data', async () => {
      (mockAuthService.loginWithCachedToken as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserData);

      const result = await service.loginWithCachedToken('test@example.com', mockUserData);

      expect(mockAuthService.loginWithCachedToken).toHaveBeenCalledWith('test@example.com', mockUserData);
      expect(mockContainer.setUserData).toHaveBeenCalledWith(mockUserData);
      expect(result).toBe(mockUserData);
    });

    it('should login with password and set user data', async () => {
      const loadCallback = vi.fn().mockResolvedValue(undefined);
      const saveCallback = vi.fn();
      (mockAuthService.loginWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue(mockUserData);

      const result = await service.loginWithPassword('user@test.com', 'password', loadCallback, saveCallback);

      expect(mockAuthService.loginWithPassword).toHaveBeenCalledWith('user@test.com', 'password', loadCallback, saveCallback);
      expect(mockContainer.setUserData).toHaveBeenCalledWith(mockUserData);
      expect(result).toBe(mockUserData);
    });
  });

  describe('Device Management Methods', () => {
    it('should list devices', async () => {
      const devices = [mockDevice];
      (mockDeviceService.listDevices as ReturnType<typeof vi.fn>).mockResolvedValue(devices);

      const result = await service.listDevices('test@example.com');

      expect(mockDeviceService.listDevices).toHaveBeenCalledWith('test@example.com');
      expect(result).toBe(devices);
    });

    it('should get home data for updating', async () => {
      const homeData = { id: 1, name: 'My Home' } as any;
      (mockDeviceService.getHomeDataForUpdating as ReturnType<typeof vi.fn>).mockResolvedValue(homeData);

      const result = await service.getHomeDataForUpdating(1);

      expect(mockDeviceService.getHomeDataForUpdating).toHaveBeenCalledWith(1);
      expect(result).toBe(homeData);
    });

    it('should initialize message client and register processor', async () => {
      mockDeviceService.messageClient = { on: vi.fn(), request: vi.fn() } as any;

      await service.initializeMessageClient('test@example.com', mockDevice, mockUserData);

      expect(mockDeviceService.initializeMessageClient).toHaveBeenCalledWith('test@example.com', mockDevice, mockUserData);
      // messageService.registerMessageProcessor is called internally by deviceService
      expect(service.messageClient).toBe(mockDeviceService.messageClient);
    });

    it('should initialize local client and sync MQTT status', async () => {
      mockDeviceService.messageClient = { on: vi.fn(), request: vi.fn() } as any;
      (mockDeviceService.initializeMessageClientForLocal as ReturnType<typeof vi.fn>).mockResolvedValue(true);

      const result = await service.initializeMessageClientForLocal(mockDevice);

      expect(mockDeviceService.initializeMessageClientForLocal).toHaveBeenCalledWith(mockDevice);
      // messageService.setMqttAlwaysOn and registerMessageProcessor are called internally by deviceService
      expect(service.messageClient).toBe(mockDeviceService.messageClient);
      expect(result).toBe(true);
    });

    it('should set device notify callback', async () => {
      const callback = vi.fn();

      service.setDeviceNotify(callback);

      expect(mockPollingService.setDeviceNotify).toHaveBeenCalledWith(callback);
      expect(service.deviceNotify).toBe(callback);
    });

    it('should activate device notify', () => {
      service.activateDeviceNotify(mockDevice);

      expect(mockPollingService.activateDeviceNotifyOverLocal).toHaveBeenCalledWith(mockDevice);
    });

    it('should activate device notify over MQTT', () => {
      service.activateDeviceNotifyOverMQTT(mockDevice);

      expect(mockPollingService.activateDeviceNotifyOverMQTT).toHaveBeenCalledWith(mockDevice);
    });

    it('should stop service and clean up all services', () => {
      service.stopService();

      expect(mockDeviceService.stopService).toHaveBeenCalled();
      expect(mockAreaService.clearAll).toHaveBeenCalled();
      expect(mockMessageService.clearAll).toHaveBeenCalled();
      expect(service.messageClient).toBeUndefined();
    });
  });

  describe('Area Management Methods', () => {
    it('should set selected areas', () => {
      service.setSelectedAreas('device-123', [1, 2, 3]);

      expect(mockAreaService.setSelectedAreas).toHaveBeenCalledWith('device-123', [1, 2, 3]);
    });

    it('should get selected areas', () => {
      (mockAreaService.getSelectedAreas as ReturnType<typeof vi.fn>).mockReturnValue([1, 2]);

      const result = service.getSelectedAreas('device-123');

      expect(mockAreaService.getSelectedAreas).toHaveBeenCalledWith('device-123');
      expect(result).toEqual([1, 2]);
    });

    it('should set supported areas', () => {
      const areas = [{ rawValue: 1, label: 'Kitchen' } as unknown as ServiceArea.Area];

      service.setSupportedAreas('device-123', areas);

      expect(mockAreaService.setSupportedAreas).toHaveBeenCalledWith('device-123', areas);
    });

    it('should set supported area index map', () => {
      const indexMap = { 1: 10, 2: 20 } as unknown as RoomIndexMap;

      service.setSupportedAreaIndexMap('device-123', indexMap);

      expect(mockAreaService.setSupportedAreaIndexMap).toHaveBeenCalledWith('device-123', indexMap);
    });

    it('should set supported scenes', () => {
      const scenes = [{ rawValue: 1, label: 'Quick Clean' } as unknown as ServiceArea.Area];

      service.setSupportedScenes('device-123', scenes);

      expect(mockAreaService.setSupportedScenes).toHaveBeenCalledWith('device-123', scenes);
    });

    it('should get supported areas', () => {
      const areas = [{ rawValue: 1, label: 'Kitchen' } as unknown as ServiceArea.Area];
      (mockAreaService.getSupportedAreas as ReturnType<typeof vi.fn>).mockReturnValue(areas);

      const result = service.getSupportedAreas('device-123');

      expect(mockAreaService.getSupportedAreas).toHaveBeenCalledWith('device-123');
      expect(result).toBe(areas);
    });

    it('should get supported areas index map', () => {
      const indexMap = { 1: 10 } as unknown as RoomIndexMap;
      (mockAreaService.getSupportedAreasIndexMap as ReturnType<typeof vi.fn>).mockReturnValue(indexMap);

      const result = service.getSupportedAreasIndexMap('device-123');

      expect(mockAreaService.getSupportedAreasIndexMap).toHaveBeenCalledWith('device-123');
      expect(result).toBe(indexMap);
    });

    it('should get map information and set message client', async () => {
      const mockClient = {} as any;
      mockDeviceService.messageClient = mockClient;
      service.messageClient = mockClient;
      const mapInfo = { name: 'map1' } as any;
      (mockAreaService.getMapInformation as ReturnType<typeof vi.fn>).mockResolvedValue(mapInfo);

      const result = await service.getMapInformation('device-123');

      expect(mockAreaService.setMessageClient).toHaveBeenCalledWith(mockClient);
      expect(mockAreaService.getMapInformation).toHaveBeenCalledWith('device-123');
      expect(result).toBe(mapInfo);
    });

    it('should get room mappings with MQTT status', async () => {
      const mockClient = {} as any;
      service.messageClient = mockClient;
      (mockMessageService.getMqttAlwaysOn as ReturnType<typeof vi.fn>).mockReturnValue(true);
      const mappings = [
        [1, 2],
        [3, 4],
      ];
      (mockAreaService.getRoomMappings as ReturnType<typeof vi.fn>).mockResolvedValue(mappings);

      const result = await service.getRoomMappings('device-123');

      expect(mockAreaService.setMessageClient).toHaveBeenCalledWith(mockClient);
      expect(mockAreaService.getRoomMappings).toHaveBeenCalledWith('device-123', true);
      expect(result).toBe(mappings);
    });

    it('should get scenes', async () => {
      const scenes = [{ id: 1, name: 'Scene 1' }] as any;
      (mockAreaService.getScenes as ReturnType<typeof vi.fn>).mockResolvedValue(scenes);

      const result = await service.getScenes(123);

      expect(mockAreaService.getScenes).toHaveBeenCalledWith(123);
      expect(result).toBe(scenes);
    });

    it('should start scene', async () => {
      const sceneResult = { status: 'started' };
      (mockAreaService.startScene as ReturnType<typeof vi.fn>).mockResolvedValue(sceneResult);

      const result = await service.startScene(456);

      expect(mockAreaService.startScene).toHaveBeenCalledWith(456);
      expect(result).toBe(sceneResult);
    });
  });

  describe('Message Routing Methods', () => {
    it('should get message processor', () => {
      const processor = {} as MessageProcessor;
      (mockMessageService.getMessageProcessor as ReturnType<typeof vi.fn>).mockReturnValue(processor);

      const result = service.getMessageProcessor('device-123');

      expect(mockMessageService.getMessageProcessor).toHaveBeenCalledWith('device-123');
      expect(result).toBe(processor);
    });

    it('should get clean mode data', async () => {
      const cleanMode = { fanSpeed: 100, mopMode: 2 } as any;
      (mockMessageService.getCleanModeData as ReturnType<typeof vi.fn>).mockResolvedValue(cleanMode);

      const result = await service.getCleanModeData('device-123');

      expect(mockMessageService.getCleanModeData).toHaveBeenCalledWith('device-123');
      expect(result).toBe(cleanMode);
    });

    it('should get room ID from map', async () => {
      (mockMessageService.getRoomIdFromMap as ReturnType<typeof vi.fn>).mockResolvedValue(5);

      const result = await service.getRoomIdFromMap('device-123');

      expect(mockMessageService.getRoomIdFromMap).toHaveBeenCalledWith('device-123');
      expect(result).toBe(5);
    });

    it('should change clean mode', async () => {
      const settings = { fanSpeed: 75, mopMode: 1 } as any;

      await service.changeCleanMode('device-123', settings);

      expect(mockMessageService.changeCleanMode).toHaveBeenCalledWith('device-123', settings);
    });

    it('should start clean with selected areas and routines', async () => {
      const selectedAreas = [1, 2];
      const supportedRooms = [{ rawValue: 1, label: 'Kitchen' } as unknown as ServiceArea.Area];
      const supportedRoutines = [{ rawValue: 10, label: 'Quick' } as unknown as ServiceArea.Area];

      (mockAreaService.getSelectedAreas as ReturnType<typeof vi.fn>).mockReturnValue(selectedAreas);
      (mockAreaService.getSupportedAreas as ReturnType<typeof vi.fn>).mockReturnValue(supportedRooms);
      (mockAreaService.getSupportedRoutines as ReturnType<typeof vi.fn>).mockReturnValue(supportedRoutines);

      await service.startClean('device-123');

      expect(mockMessageService.startClean).toHaveBeenCalledWith('device-123', selectedAreas, supportedRooms, supportedRoutines);
    });

    it('should pause clean', async () => {
      await service.pauseClean('device-123');

      expect(mockMessageService.pauseClean).toHaveBeenCalledWith('device-123');
    });

    it('should stop and go home', async () => {
      await service.stopAndGoHome('device-123');

      expect(mockMessageService.stopAndGoHome).toHaveBeenCalledWith('device-123');
    });

    it('should resume clean', async () => {
      await service.resumeClean('device-123');

      expect(mockMessageService.resumeClean).toHaveBeenCalledWith('device-123');
    });

    it('should play sound to locate', async () => {
      await service.playSoundToLocate('device-123');

      expect(mockMessageService.playSoundToLocate).toHaveBeenCalledWith('device-123');
    });

    it('should execute custom get', async () => {
      const request = {} as any;
      const response = { data: 'test' };
      (mockMessageService.customGet as ReturnType<typeof vi.fn>).mockResolvedValue(response);

      const result = await service.customGet('device-123', request);

      expect(mockMessageService.customGet).toHaveBeenCalledWith('device-123', request);
      expect(result).toBe(response);
    });

    it('should execute custom send', async () => {
      const request = {} as any;

      await service.customSend('device-123', request);

      expect(mockMessageService.customSend).toHaveBeenCalledWith('device-123', request);
    });

    it('should execute custom API get', async () => {
      const mockIotApi = {
        getCustom: vi.fn().mockResolvedValue({ result: 'success' }),
      } as any;
      (mockContainer.getIotApi as ReturnType<typeof vi.fn>).mockReturnValue(mockIotApi);

      const result = await service.getCustomAPI('/custom/endpoint');

      expect(mockIotApi.getCustom).toHaveBeenCalledWith('/custom/endpoint');
      expect(result).toEqual({ result: 'success' });
    });

    it('should throw error when getting custom API without IoT API', async () => {
      (mockContainer.getIotApi as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

      await expect(service.getCustomAPI('/test')).rejects.toThrow('IoT API not initialized. Please login first.');
    });
  });

  describe('Constructor and Initialization', () => {
    it('should create service with default factories when not provided', () => {
      const defaultService = new RoborockService(undefined, undefined, 30000, mockClientManager, mockLogger);

      expect(defaultService).toBeInstanceOf(RoborockService);
    });

    it('should create service with custom factories', () => {
      const customAuthFactory = vi.fn(() => ({}) as any);
      const customIotFactory = vi.fn(() => ({}) as any);

      const customService = new RoborockService(customAuthFactory, customIotFactory, 30000, mockClientManager, mockLogger);

      expect(customService).toBeInstanceOf(RoborockService);
    });

    it('should create service with custom base URL', () => {
      const customService = new RoborockService(undefined, undefined, 30000, mockClientManager, mockLogger, 'https://custom.roborock.com');

      expect(customService).toBeInstanceOf(RoborockService);
    });
  });
});
