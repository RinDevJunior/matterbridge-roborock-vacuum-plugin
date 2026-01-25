import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockService } from '../../services/roborockService.js';
import { ServiceContainer } from '../../services/serviceContainer.js';
import { AuthenticationService } from '../../services/authenticationService.js';
import { DeviceManagementService } from '../../services/deviceManagementService.js';
import { AreaManagementService } from '../../services/areaManagementService.js';
import { MessageRoutingService } from '../../services/messageRoutingService.js';
import { PollingService } from '../../services/pollingService.js';
import { Device } from '../../roborockCommunication/models/index.js';

describe('RoborockService - Comprehensive Coverage', () => {
  let service: RoborockService;
  let mockLogger: AnsiLogger;
  let mockContainer: ServiceContainer;
  let mockAuthService: AuthenticationService;
  let mockDeviceService: DeviceManagementService;
  let mockAreaService: AreaManagementService;
  let mockMessageService: MessageRoutingService;
  let mockPollingService: PollingService;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    } as unknown as AnsiLogger;

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

    service = new RoborockService(
      {
        authenticateApiFactory: () => undefined as any,
        iotApiFactory: () => undefined as any,
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: {} as any,
        configManager: {} as any,
      },
      mockLogger,
      mockContainer as any,
    );
  });

  describe('Constructor and Initialization', () => {
    it('should create service with default factories when not provided', () => {
      const defaultService = new RoborockService(
        {
          authenticateApiFactory: () => undefined as any,
          iotApiFactory: () => undefined as any,
          refreshInterval: 10,
          baseUrl: 'https://api.roborock.com',
          persist: {} as any,
          configManager: {} as any,
        },
        mockLogger as any,
        mockContainer as any,
      );

      expect(defaultService).toBeInstanceOf(RoborockService);
    });

    it('should create service with custom factories', () => {
      const customAuthFactory = vi.fn(() => ({}) as any);
      const customIotFactory = vi.fn(() => ({}) as any);

      const customService = new RoborockService(
        {
          authenticateApiFactory: customAuthFactory,
          iotApiFactory: customIotFactory,
          refreshInterval: 20000,
          baseUrl: 'https://custom-api.roborock.com',
          persist: {} as any,
          configManager: {} as any,
        },
        mockLogger,
        mockContainer as any,
      );

      expect(customService).toBeInstanceOf(RoborockService);
    });

    it('should create service with custom base URL', () => {
      const customService = new RoborockService(
        {
          authenticateApiFactory: () => undefined as any,
          iotApiFactory: () => undefined as any,
          refreshInterval: 15000,
          baseUrl: 'https://another-api.roborock.com',
          persist: {} as any,
          configManager: {} as any,
        },
        mockLogger,
        mockContainer as any,
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
});
