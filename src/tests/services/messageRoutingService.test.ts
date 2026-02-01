import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { MessageRoutingService } from '../../services/messageRoutingService.js';
import { DeviceError } from '../../errors/index.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import { RequestMessage } from '../../roborockCommunication/models/index.js';
import { V01MessageDispatcher } from '../../roborockCommunication/protocol/dispatcher/V01MessageDispatcher.js';
import { CleanModeSetting } from '../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { asPartial } from '../testUtils.js';

function createIntegrationLogger() {
  return { debug: vi.fn(), notice: vi.fn(), warn: vi.fn() } as Partial<AnsiLogger> as AnsiLogger;
}

describe('MessageRoutingService (integration)', () => {
  let logger: ReturnType<typeof createIntegrationLogger>;

  beforeEach(() => {
    logger = createIntegrationLogger();
  });

  it('throws when getting an unregistered MessageDispatcher', () => {
    const service = new MessageRoutingService(logger);
    expect(() => service.getMessageDispatcher('missing')).toThrow();
  });

  it('registers and returns a MessageDispatcher', () => {
    const service = new MessageRoutingService(logger);
    const duid = 'dev1';
    const mp: any = { some: 'processor' };
    service.registerMessageDispatcher(duid, mp);
    expect(service.getMessageDispatcher(duid)).toBe(mp);
  });

  it('uses IoT API to start a single selected routine', async () => {
    const duid = 'dev-routine';
    const selected = [42];
    const supportedRooms: ServiceArea.Area[] = [];
    const supportedRoutines: ServiceArea.Area[] = [asPartial<ServiceArea.Area>({ areaId: 42, mapId: null, areaInfo: asPartial({}) })];

    const iotApi: Partial<RoborockIoTApi> = { startScene: vi.fn(async () => {}) };
    const service = new MessageRoutingService(logger, iotApi as RoborockIoTApi);

    await service.startClean(duid, selected, supportedRooms, supportedRoutines);
    expect(iotApi.startScene).toHaveBeenCalledWith(selected[0]);
  });

  it('falls back to global clean when multiple routines selected', async () => {
    const duid = 'dev-multi';
    const selected = [1, 2];
    const supportedRooms: ServiceArea.Area[] = [];
    const supportedRoutines: ServiceArea.Area[] = [
      asPartial<ServiceArea.Area>({ areaId: 1, mapId: null, areaInfo: asPartial({}) }),
      asPartial<ServiceArea.Area>({ areaId: 2, mapId: null, areaInfo: asPartial({}) }),
    ];

    const startCleaning = vi.fn(async () => {});
    const mp: any = { startCleaning };

    const service = new MessageRoutingService(logger);
    service.registerMessageDispatcher(duid, mp);

    await service.startClean(duid, selected, supportedRooms, supportedRoutines);
    expect(startCleaning).toHaveBeenCalled();
  });

  it('throws when getCleanModeData returns no data', async () => {
    const duid = 'dev-nodata';
    const mp: any = { getCleanModeData: vi.fn(async () => undefined) };
    const service = new MessageRoutingService(logger);
    service.registerMessageDispatcher(duid, mp);
    await expect(service.getCleanModeData(duid)).rejects.toThrow();
  });
});

describe('MessageRoutingService', () => {
  let messageService: MessageRoutingService;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockIotApi: ReturnType<typeof createMockIotApi>;
  let mockDispatcher: ReturnType<typeof createMockDispatcher>;

  function createMockLogger() {
    return asPartial<AnsiLogger>({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    });
  }

  function createMockIotApi(): any {
    return {
      getMapRoomDetail: vi.fn(),
      getCleaningSummaryForUpdatingDevice: vi.fn(),
      startScene: vi.fn(),
    };
  }

  function createMockDispatcher(): any {
    return {
      getCleanModeData: vi.fn(),
      changeCleanMode: vi.fn(),
      getRooms: vi.fn(),
      startCleaning: vi.fn(),
      startRoomCleaning: vi.fn(),
      pauseCleaning: vi.fn(),
      resumeCleaning: vi.fn(),
      goHome: vi.fn(),
      findMyRobot: vi.fn(),
      getHomeMap: vi.fn(),
      getCustomMessage: vi.fn(),
      sendCustomMessage: vi.fn(),
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockIotApi = createMockIotApi();
    mockDispatcher = createMockDispatcher();
    messageService = new MessageRoutingService(mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with logger only', () => {
      expect(messageService).toBeDefined();
      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should initialize with logger and iotApi', () => {
      const service = new MessageRoutingService(mockLogger, mockIotApi as RoborockIoTApi);
      expect(service).toBeDefined();
    });

    it('should set iotApi after initialization', () => {
      messageService.setIotApi(mockIotApi as RoborockIoTApi);
      expect(() => {
        messageService.setIotApi(mockIotApi);
      }).not.toThrow();
    });
  });

  describe('Processor Registration and Retrieval', () => {
    const testDuid = 'test-device-123';

    it('should register a message processor', () => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
      expect(() => messageService.getMessageDispatcher(testDuid)).not.toThrow();
    });

    it('should retrieve registered processor', () => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
      const processor = messageService.getMessageDispatcher(testDuid);
      expect(processor).toBe(mockDispatcher);
    });

    it('should throw DeviceError when processor not found', () => {
      expect(() => messageService.getMessageDispatcher('unknown-device')).toThrow(DeviceError);
      expect(() => messageService.getMessageDispatcher('unknown-device')).toThrow('MessageDispatcher not initialized for device unknown-device');
    });

    it('should allow multiple processors to be registered', () => {
      const mockProcessor2 = createMockDispatcher();
      messageService.registerMessageDispatcher('device-1', mockDispatcher as V01MessageDispatcher);
      messageService.registerMessageDispatcher('device-2', mockProcessor2 as V01MessageDispatcher);

      expect(messageService.getMessageDispatcher('device-1')).toBe(mockDispatcher);
      expect(messageService.getMessageDispatcher('device-2')).toBe(mockProcessor2);
    });
  });

  describe('getCleanModeData', () => {
    const testDuid = 'test-device-456';
    const mockCleanMode = new CleanModeSetting(100, 200, 0, 302);

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
    });

    it('should retrieve clean mode data successfully', async () => {
      mockDispatcher.getCleanModeData.mockResolvedValue(mockCleanMode);

      const result = await messageService.getCleanModeData(testDuid);

      expect(result).toEqual(mockCleanMode);
      expect(mockDispatcher.getCleanModeData).toHaveBeenCalledWith(testDuid);
      expect(mockLogger.notice).toHaveBeenCalledWith('MessageRoutingService - getCleanModeData');
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.getCleanModeData('unknown-device')).rejects.toThrow(DeviceError);
    });

    it('should propagate processor errors', async () => {
      mockDispatcher.getCleanModeData.mockRejectedValue(new Error('API failure'));

      await expect(messageService.getCleanModeData(testDuid)).rejects.toThrow('API failure');
    });
  });

  describe('getRoomIdFromMap', () => {
    const testDuid = 'test-device-789';
    const mockMapData = {
      vacuumRoom: 16,
    };

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
    });

    it('should retrieve room ID from map successfully', async () => {
      mockDispatcher.getHomeMap.mockResolvedValue(mockMapData);

      const result = await messageService.getRoomIdFromMap(testDuid);

      expect(result).toEqual(16);
      expect(mockDispatcher.getHomeMap).toHaveBeenCalled();
    });

    it('should handle missing map data', async () => {
      mockDispatcher.getHomeMap.mockResolvedValue(undefined);

      const result = await messageService.getRoomIdFromMap(testDuid);

      expect(result).toBeUndefined();
    });

    it('should handle map data without vacuumRoom', async () => {
      mockDispatcher.getHomeMap.mockResolvedValue({});

      const result = await messageService.getRoomIdFromMap(testDuid);

      expect(result).toBeUndefined();
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.getRoomIdFromMap('unknown-device')).rejects.toThrow(DeviceError);
    });
  });

  describe('changeCleanMode', () => {
    const testDuid = 'test-device-clean-mode';

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
    });

    it('should change clean mode successfully', async () => {
      const settings = new CleanModeSetting(105, 203, 0, 302);
      await messageService.changeCleanMode(testDuid, settings);

      expect(mockDispatcher.changeCleanMode).toHaveBeenCalledWith(testDuid, 105, 203, 302, 0);
      expect(mockLogger.notice).toHaveBeenCalledWith('MessageRoutingService - changeCleanMode');
    });

    it('should handle zero values in clean mode', async () => {
      const settings = new CleanModeSetting(0, 0, 0, 0);
      await messageService.changeCleanMode(testDuid, settings);

      expect(mockDispatcher.changeCleanMode).toHaveBeenCalledWith(testDuid, 0, 0, 0, 0);
    });

    it('should throw DeviceError when processor not found', async () => {
      const settings = new CleanModeSetting(105, 203, 0, 302);
      await expect(messageService.changeCleanMode('unknown-device', settings)).rejects.toThrow(DeviceError);
    });
  });

  describe('startClean', () => {
    const testDuid = 'test-device-start-clean';

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
    });

    it('should start global clean when no areas selected', async () => {
      await messageService.startClean(testDuid, [], [], []);

      expect(mockDispatcher.startCleaning).toHaveBeenCalledWith(testDuid);
      expect(mockDispatcher.startRoomCleaning).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Starting global clean');
    });

    it('should start room-based clean with selected rooms', async () => {
      const selectedRooms = [16, 17];
      const supportedRooms: ServiceArea.Area[] = [{ areaId: 16 } as ServiceArea.Area, { areaId: 17 } as ServiceArea.Area, { areaId: 18 } as ServiceArea.Area];

      await messageService.startClean(testDuid, selectedRooms, supportedRooms, []);

      expect(mockDispatcher.startRoomCleaning).toHaveBeenCalledWith(testDuid, selectedRooms, 1);
      expect(mockDispatcher.startCleaning).not.toHaveBeenCalled();
    });

    it('should start routine clean when routine is selected', async () => {
      const selectedRoutines = [1];
      const supportedRoutines: ServiceArea.Area[] = [{ areaId: 1 } as ServiceArea.Area, { areaId: 2 } as ServiceArea.Area, { areaId: 3 } as ServiceArea.Area];
      mockIotApi.startScene = vi.fn().mockResolvedValue(undefined);
      messageService.setIotApi(mockIotApi);

      await messageService.startClean(testDuid, selectedRoutines, [], supportedRoutines);

      expect(mockIotApi.startScene).toHaveBeenCalledWith(1);
    });

    it('should fallback to room-based clean when room selected from routines', async () => {
      // When a routine area ID exists but also matches a room, it treats as room
      const selectedRooms = [999];
      const supportedRooms: ServiceArea.Area[] = [
        { areaId: 999 } as ServiceArea.Area,
        { areaId: 1000 } as ServiceArea.Area, // Need at least 2 rooms to avoid global clean
      ];
      const supportedRoutines: ServiceArea.Area[] = [{ areaId: 1 } as ServiceArea.Area];

      await messageService.startClean(testDuid, selectedRooms, supportedRooms, supportedRoutines);

      expect(mockDispatcher.startRoomCleaning).toHaveBeenCalledWith(testDuid, selectedRooms, 1);
    });

    it('should handle multiple room selection', async () => {
      const selectedRooms = [16, 17, 18, 19];
      const supportedRooms: ServiceArea.Area[] = [
        { areaId: 16 } as ServiceArea.Area,
        { areaId: 17 } as ServiceArea.Area,
        { areaId: 18 } as ServiceArea.Area,
        { areaId: 19 } as ServiceArea.Area,
        { areaId: 20 } as ServiceArea.Area,
      ];

      await messageService.startClean(testDuid, selectedRooms, supportedRooms, []);

      expect(mockDispatcher.startRoomCleaning).toHaveBeenCalledWith(testDuid, selectedRooms, 1);
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.startClean('unknown-device', [], [], [])).rejects.toThrow(DeviceError);
    });
  });

  describe('pauseClean', () => {
    const testDuid = 'test-device-pause';

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
    });

    it('should pause cleaning operation', async () => {
      await messageService.pauseClean(testDuid);

      expect(mockDispatcher.pauseCleaning).toHaveBeenCalledWith(testDuid);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - pauseClean');
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.pauseClean('unknown-device')).rejects.toThrow(DeviceError);
    });
  });

  describe('resumeClean', () => {
    const testDuid = 'test-device-resume';

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
    });

    it('should resume cleaning operation', async () => {
      await messageService.resumeClean(testDuid);

      expect(mockDispatcher.resumeCleaning).toHaveBeenCalledWith(testDuid);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - resumeClean');
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.resumeClean('unknown-device')).rejects.toThrow(DeviceError);
    });
  });

  describe('stopAndGoHome', () => {
    const testDuid = 'test-device-stop';

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
    });

    it('should stop cleaning and return to dock', async () => {
      await messageService.stopAndGoHome(testDuid);

      expect(mockDispatcher.goHome).toHaveBeenCalledWith(testDuid);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - stopAndGoHome');
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.stopAndGoHome('unknown-device')).rejects.toThrow(DeviceError);
    });
  });

  describe('playSoundToLocate', () => {
    const testDuid = 'test-device-locate';

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
    });

    it('should play sound to locate vacuum', async () => {
      await messageService.playSoundToLocate(testDuid);

      expect(mockDispatcher.findMyRobot).toHaveBeenCalledWith(testDuid);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - findMe');
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.playSoundToLocate('unknown-device')).rejects.toThrow(DeviceError);
    });
  });

  describe('customGet', () => {
    const testDuid = 'test-device-custom-get';
    const mockRequest = new RequestMessage({ method: 'get_status', params: [] });
    const mockResponse = { status: 'cleaning' };

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
    });

    it('should execute custom GET request with typed response', async () => {
      mockDispatcher.getCustomMessage.mockResolvedValue(mockResponse);

      const result = await messageService.customGet<{ status: string }>(testDuid, mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockDispatcher.getCustomMessage).toHaveBeenCalledWith(testDuid, mockRequest);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - customSend-message', 'get_status', [], false);
    });

    it('should execute custom GET request with unknown response type', async () => {
      mockDispatcher.getCustomMessage.mockResolvedValue(mockResponse);

      const result = await messageService.customGet(testDuid, mockRequest);

      expect(result).toEqual(mockResponse);
    });

    it('should handle secure request flag', async () => {
      const secureRequest = new RequestMessage({ method: 'get_status', params: [], secure: true });
      mockDispatcher.getCustomMessage.mockResolvedValue(mockResponse);

      await messageService.customGet(testDuid, secureRequest);

      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - customSend-message', 'get_status', [], true);
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.customGet('unknown-device', mockRequest)).rejects.toThrow(DeviceError);
    });
  });

  describe('customSend', () => {
    const testDuid = 'test-device-custom-send';
    const mockRequest = new RequestMessage({ method: 'set_mop_mode', params: [302] });

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher as V01MessageDispatcher);
    });

    it('should send custom command successfully', async () => {
      await messageService.customSend(testDuid, mockRequest);

      expect(mockDispatcher.sendCustomMessage).toHaveBeenCalledWith(testDuid, mockRequest);
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.customSend('unknown-device', mockRequest)).rejects.toThrow(DeviceError);
    });

    it('should handle command without params', async () => {
      const simpleRequest = new RequestMessage({ method: 'app_start' });

      await messageService.customSend(testDuid, simpleRequest);

      expect(mockDispatcher.sendCustomMessage).toHaveBeenCalledWith(testDuid, simpleRequest);
    });
  });

  describe('clearAll', () => {
    it('should clear all processors and MQTT devices', () => {
      const testDuid1 = 'device-1';
      const testDuid2 = 'device-2';

      messageService.registerMessageDispatcher(testDuid1, mockDispatcher as V01MessageDispatcher);
      messageService.registerMessageDispatcher(testDuid2, mockDispatcher as V01MessageDispatcher);

      messageService.clearAll();

      expect(() => messageService.getMessageDispatcher(testDuid1)).toThrow(DeviceError);
      expect(() => messageService.getMessageDispatcher(testDuid2)).toThrow(DeviceError);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - All data cleared');
    });

    it('should be safe to call multiple times', () => {
      messageService.clearAll();
      messageService.clearAll();

      expect(() => {
        messageService.clearAll();
      }).not.toThrow();
    });

    it('should clear empty service without errors', () => {
      const newService = new MessageRoutingService(mockLogger);
      expect(() => {
        newService.clearAll();
      }).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    const testDuid = 'integration-device';

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher);
      messageService.setIotApi(mockIotApi);
    });

    it('should complete full cleaning workflow', async () => {
      const selectedRooms = [16, 17];
      const supportedRooms: ServiceArea.Area[] = [{ areaId: 16 } as ServiceArea.Area, { areaId: 17 } as ServiceArea.Area, { areaId: 18 } as ServiceArea.Area];

      // Start room clean
      await messageService.startClean(testDuid, selectedRooms, supportedRooms, []);
      expect(mockDispatcher.startRoomCleaning).toHaveBeenCalledWith(testDuid, selectedRooms, 1);

      // Pause
      await messageService.pauseClean(testDuid);
      expect(mockDispatcher.pauseCleaning).toHaveBeenCalledWith(testDuid);
      // Resume
      await messageService.resumeClean(testDuid);
      expect(mockDispatcher.resumeCleaning).toHaveBeenCalledWith(testDuid);

      // Stop and go home
      await messageService.stopAndGoHome(testDuid);
      expect(mockDispatcher.goHome).toHaveBeenCalledWith(testDuid);
    });

    it('should handle clean mode adjustment workflow', async () => {
      const mockCleanMode = new CleanModeSetting(101, 202, 0, 302);

      mockDispatcher.getCleanModeData.mockResolvedValue(mockCleanMode);

      // Get current clean mode
      const currentMode = await messageService.getCleanModeData(testDuid);
      expect(currentMode).toEqual(mockCleanMode);

      // Change clean mode
      const settings = new CleanModeSetting(105, 203, 0, 302);
      await messageService.changeCleanMode(testDuid, settings);
      expect(mockDispatcher.changeCleanMode).toHaveBeenCalledWith(testDuid, 105, 203, 302, 0);
    });
  });

  describe('Error Handling', () => {
    const testDuid = 'error-device';

    beforeEach(() => {
      messageService.registerMessageDispatcher(testDuid, mockDispatcher);
    });

    it('should propagate MessageDispatcher errors', async () => {
      const error = new Error('Communication timeout');
      mockDispatcher.startCleaning.mockRejectedValue(error);

      await expect(messageService.startClean(testDuid, [], [], [])).rejects.toThrow('Communication timeout');
    });

    it('should throw DeviceError when routine requires iotApi but not initialized', async () => {
      const serviceWithoutApi = new MessageRoutingService(mockLogger);
      serviceWithoutApi.registerMessageDispatcher(testDuid, mockDispatcher);
      const supportedRoutines: ServiceArea.Area[] = [{ areaId: 1 } as ServiceArea.Area];

      await expect(serviceWithoutApi.startClean(testDuid, [1], [], supportedRoutines)).rejects.toThrow(DeviceError);
      await expect(serviceWithoutApi.startClean(testDuid, [1], [], supportedRoutines)).rejects.toThrow('IoT API must be initialized to start scene');
    });

    it('should throw meaningful errors for missing processors', async () => {
      const unknownDuid = 'non-existent-device';

      await expect(messageService.getCleanModeData(unknownDuid)).rejects.toThrow(`MessageDispatcher not initialized for device ${unknownDuid}`);
      await expect(messageService.startClean(unknownDuid, [], [], [])).rejects.toThrow(`MessageDispatcher not initialized for device ${unknownDuid}`);
      await expect(messageService.pauseClean(unknownDuid)).rejects.toThrow(`MessageDispatcher not initialized for device ${unknownDuid}`);
    });
  });
});
