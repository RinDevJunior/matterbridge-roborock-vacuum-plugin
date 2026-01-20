import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { MessageRoutingService } from '../../services/messageRoutingService.js';
import { MessageProcessor, RequestMessage, RoborockIoTApi } from '../../roborockCommunication/index.js';
import { DeviceError } from '../../errors/index.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { CleanModeDTO } from '@/behaviors/index.js';

describe('MessageRoutingService', () => {
  let messageService: MessageRoutingService;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockIotApi: ReturnType<typeof createMockIotApi>;
  let mockProcessor: ReturnType<typeof createMockProcessor>;

  function createMockLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    } as unknown as AnsiLogger;
  }

  function createMockIotApi(): any {
    return {
      getMapRoomDetail: vi.fn(),
      getCleaningSummaryForUpdatingDevice: vi.fn(),
      startScene: vi.fn(),
    };
  }

  function createMockProcessor(): any {
    return {
      getCleanModeData: vi.fn(),
      changeCleanMode: vi.fn(),
      getRooms: vi.fn(),
      startClean: vi.fn(),
      startRoomClean: vi.fn(),
      pauseClean: vi.fn(),
      resumeClean: vi.fn(),
      gotoDock: vi.fn(),
      findMyRobot: vi.fn(),
      getCustomMessage: vi.fn(),
      sendCustomMessage: vi.fn(),
    };
  }

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockIotApi = createMockIotApi();
    mockProcessor = createMockProcessor();
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
      expect(() => messageService.setIotApi(mockIotApi)).not.toThrow();
    });
  });

  describe('Processor Registration and Retrieval', () => {
    const testDuid = 'test-device-123';

    it('should register a message processor', () => {
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
      expect(() => messageService.getMessageProcessor(testDuid)).not.toThrow();
    });

    it('should retrieve registered processor', () => {
      messageService.registerMessageProcessor(testDuid, mockProcessor);
      const processor = messageService.getMessageProcessor(testDuid);
      expect(processor).toBe(mockProcessor);
    });

    it('should throw DeviceError when processor not found', () => {
      expect(() => messageService.getMessageProcessor('unknown-device')).toThrow(DeviceError);
      expect(() => messageService.getMessageProcessor('unknown-device')).toThrow('MessageProcessor not initialized for device unknown-device');
    });

    it('should allow multiple processors to be registered', () => {
      const mockProcessor2 = createMockProcessor();
      messageService.registerMessageProcessor('device-1', mockProcessor as MessageProcessor);
      messageService.registerMessageProcessor('device-2', mockProcessor2 as MessageProcessor);

      expect(messageService.getMessageProcessor('device-1')).toBe(mockProcessor);
      expect(messageService.getMessageProcessor('device-2')).toBe(mockProcessor2);
    });
  });

  describe('MQTT Always-On Device Management', () => {
    const testDuid = 'mqtt-device-123';

    it('should set MQTT always-on status to true', () => {
      messageService.setMqttAlwaysOn(testDuid, true);
      // Verify no error thrown and service handles it correctly
      expect(() => messageService.setMqttAlwaysOn(testDuid, true)).not.toThrow();
    });

    it('should set MQTT always-on status to false', () => {
      messageService.setMqttAlwaysOn(testDuid, false);
      expect(() => messageService.setMqttAlwaysOn(testDuid, false)).not.toThrow();
    });

    it('should update existing MQTT status', () => {
      messageService.setMqttAlwaysOn(testDuid, true);
      messageService.setMqttAlwaysOn(testDuid, false);
      expect(() => messageService.setMqttAlwaysOn(testDuid, false)).not.toThrow();
    });
  });

  describe('getCleanModeData', () => {
    const testDuid = 'test-device-456';
    const mockCleanMode: CleanModeDTO = {
      suctionPower: 100,
      waterFlow: 200,
      distance_off: 0,
      mopRoute: 302,
    };

    beforeEach(() => {
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
    });

    it('should retrieve clean mode data successfully', async () => {
      mockProcessor.getCleanModeData.mockResolvedValue(mockCleanMode);

      const result = await messageService.getCleanModeData(testDuid);

      expect(result).toEqual(mockCleanMode);
      expect(mockProcessor.getCleanModeData).toHaveBeenCalledWith(testDuid);
      expect(mockLogger.notice).toHaveBeenCalledWith('MessageRoutingService - getCleanModeData');
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.getCleanModeData('unknown-device')).rejects.toThrow(DeviceError);
    });

    it('should propagate processor errors', async () => {
      mockProcessor.getCleanModeData.mockRejectedValue(new Error('API failure'));

      await expect(messageService.getCleanModeData(testDuid)).rejects.toThrow('API failure');
    });
  });

  describe('getRoomIdFromMap', () => {
    const testDuid = 'test-device-789';
    const mockMapData = {
      vacuumRoom: 16,
    };

    beforeEach(() => {
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
    });

    it('should retrieve room ID from map successfully', async () => {
      mockProcessor.getCustomMessage.mockResolvedValue(mockMapData);

      const result = await messageService.getRoomIdFromMap(testDuid);

      expect(result).toEqual(16);
      expect(mockProcessor.getCustomMessage).toHaveBeenCalled();
    });

    it('should handle missing map data', async () => {
      mockProcessor.getCustomMessage.mockResolvedValue(undefined);

      const result = await messageService.getRoomIdFromMap(testDuid);

      expect(result).toBeUndefined();
    });

    it('should handle map data without vacuumRoom', async () => {
      mockProcessor.getCustomMessage.mockResolvedValue({});

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
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
    });

    it('should change clean mode successfully', async () => {
      const settings: CleanModeDTO = { suctionPower: 105, waterFlow: 203, mopRoute: 302, distance_off: 0 };
      await messageService.changeCleanMode(testDuid, settings);

      expect(mockProcessor.changeCleanMode).toHaveBeenCalledWith(testDuid, 105, 203, 302, 0);
      expect(mockLogger.notice).toHaveBeenCalledWith('MessageRoutingService - changeCleanMode');
    });

    it('should handle zero values in clean mode', async () => {
      const settings: CleanModeDTO = { suctionPower: 0, waterFlow: 0, mopRoute: 0, distance_off: 0 };
      await messageService.changeCleanMode(testDuid, settings);

      expect(mockProcessor.changeCleanMode).toHaveBeenCalledWith(testDuid, 0, 0, 0, 0);
    });

    it('should throw DeviceError when processor not found', async () => {
      const settings: CleanModeDTO = { suctionPower: 105, waterFlow: 203, mopRoute: 302, distance_off: 0 };
      await expect(messageService.changeCleanMode('unknown-device', settings)).rejects.toThrow(DeviceError);
    });
  });

  describe('startClean', () => {
    const testDuid = 'test-device-start-clean';

    beforeEach(() => {
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
    });

    it('should start global clean when no areas selected', async () => {
      await messageService.startClean(testDuid, [], [], []);

      expect(mockProcessor.startClean).toHaveBeenCalledWith(testDuid);
      expect(mockProcessor.startRoomClean).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('Starting global clean');
    });

    it('should start room-based clean with selected rooms', async () => {
      const selectedRooms = [16, 17];
      const supportedRooms: ServiceArea.Area[] = [{ areaId: 16 } as ServiceArea.Area, { areaId: 17 } as ServiceArea.Area, { areaId: 18 } as ServiceArea.Area];

      await messageService.startClean(testDuid, selectedRooms, supportedRooms, []);

      expect(mockProcessor.startRoomClean).toHaveBeenCalledWith(testDuid, selectedRooms, 1);
      expect(mockProcessor.startClean).not.toHaveBeenCalled();
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

      expect(mockProcessor.startRoomClean).toHaveBeenCalledWith(testDuid, selectedRooms, 1);
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

      expect(mockProcessor.startRoomClean).toHaveBeenCalledWith(testDuid, selectedRooms, 1);
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.startClean('unknown-device', [], [], [])).rejects.toThrow(DeviceError);
    });
  });

  describe('pauseClean', () => {
    const testDuid = 'test-device-pause';

    beforeEach(() => {
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
    });

    it('should pause cleaning operation', async () => {
      await messageService.pauseClean(testDuid);

      expect(mockProcessor.pauseClean).toHaveBeenCalledWith(testDuid);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - pauseClean');
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.pauseClean('unknown-device')).rejects.toThrow(DeviceError);
    });
  });

  describe('resumeClean', () => {
    const testDuid = 'test-device-resume';

    beforeEach(() => {
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
    });

    it('should resume cleaning operation', async () => {
      await messageService.resumeClean(testDuid);

      expect(mockProcessor.resumeClean).toHaveBeenCalledWith(testDuid);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - resumeClean');
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.resumeClean('unknown-device')).rejects.toThrow(DeviceError);
    });
  });

  describe('stopAndGoHome', () => {
    const testDuid = 'test-device-stop';

    beforeEach(() => {
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
    });

    it('should stop cleaning and return to dock', async () => {
      await messageService.stopAndGoHome(testDuid);

      expect(mockProcessor.gotoDock).toHaveBeenCalledWith(testDuid);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - stopAndGoHome');
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.stopAndGoHome('unknown-device')).rejects.toThrow(DeviceError);
    });
  });

  describe('playSoundToLocate', () => {
    const testDuid = 'test-device-locate';

    beforeEach(() => {
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
    });

    it('should play sound to locate vacuum', async () => {
      await messageService.playSoundToLocate(testDuid);

      expect(mockProcessor.findMyRobot).toHaveBeenCalledWith(testDuid);
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
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
    });

    it('should execute custom GET request with typed response', async () => {
      mockProcessor.getCustomMessage.mockResolvedValue(mockResponse);

      const result = await messageService.customGet<{ status: string }>(testDuid, mockRequest);

      expect(result).toEqual(mockResponse);
      expect(mockProcessor.getCustomMessage).toHaveBeenCalledWith(testDuid, mockRequest);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - customSend-message', 'get_status', [], false);
    });

    it('should execute custom GET request with unknown response type', async () => {
      mockProcessor.getCustomMessage.mockResolvedValue(mockResponse);

      const result = await messageService.customGet(testDuid, mockRequest);

      expect(result).toEqual(mockResponse);
    });

    it('should handle secure request flag', async () => {
      const secureRequest = new RequestMessage({ method: 'get_status', params: [], secure: true });
      mockProcessor.getCustomMessage.mockResolvedValue(mockResponse);

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
      messageService.registerMessageProcessor(testDuid, mockProcessor as MessageProcessor);
    });

    it('should send custom command successfully', async () => {
      await messageService.customSend(testDuid, mockRequest);

      expect(mockProcessor.sendCustomMessage).toHaveBeenCalledWith(testDuid, mockRequest);
    });

    it('should throw DeviceError when processor not found', async () => {
      await expect(messageService.customSend('unknown-device', mockRequest)).rejects.toThrow(DeviceError);
    });

    it('should handle command without params', async () => {
      const simpleRequest = new RequestMessage({ method: 'app_start' });

      await messageService.customSend(testDuid, simpleRequest);

      expect(mockProcessor.sendCustomMessage).toHaveBeenCalledWith(testDuid, simpleRequest);
    });
  });

  describe('clearAll', () => {
    it('should clear all processors and MQTT devices', () => {
      const testDuid1 = 'device-1';
      const testDuid2 = 'device-2';

      messageService.registerMessageProcessor(testDuid1, mockProcessor as MessageProcessor);
      messageService.registerMessageProcessor(testDuid2, mockProcessor as MessageProcessor);
      messageService.setMqttAlwaysOn(testDuid1, true);

      messageService.clearAll();

      expect(() => messageService.getMessageProcessor(testDuid1)).toThrow(DeviceError);
      expect(() => messageService.getMessageProcessor(testDuid2)).toThrow(DeviceError);
      expect(mockLogger.debug).toHaveBeenCalledWith('MessageRoutingService - All data cleared');
    });

    it('should be safe to call multiple times', () => {
      messageService.clearAll();
      messageService.clearAll();

      expect(() => messageService.clearAll()).not.toThrow();
    });

    it('should clear empty service without errors', () => {
      const newService = new MessageRoutingService(mockLogger);
      expect(() => newService.clearAll()).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    const testDuid = 'integration-device';

    beforeEach(() => {
      messageService.registerMessageProcessor(testDuid, mockProcessor);
      messageService.setIotApi(mockIotApi);
    });

    it('should complete full cleaning workflow', async () => {
      const selectedRooms = [16, 17];
      const supportedRooms: ServiceArea.Area[] = [{ areaId: 16 } as ServiceArea.Area, { areaId: 17 } as ServiceArea.Area, { areaId: 18 } as ServiceArea.Area];

      // Start room clean
      await messageService.startClean(testDuid, selectedRooms, supportedRooms, []);
      expect(mockProcessor.startRoomClean).toHaveBeenCalledWith(testDuid, selectedRooms, 1);

      // Pause
      await messageService.pauseClean(testDuid);
      expect(mockProcessor.pauseClean).toHaveBeenCalledWith(testDuid);

      // Resume
      await messageService.resumeClean(testDuid);
      expect(mockProcessor.resumeClean).toHaveBeenCalledWith(testDuid);

      // Stop and go home
      await messageService.stopAndGoHome(testDuid);
      expect(mockProcessor.gotoDock).toHaveBeenCalledWith(testDuid);
    });

    it('should handle clean mode adjustment workflow', async () => {
      const mockCleanMode: CleanModeDTO = {
        suctionPower: 101,
        waterFlow: 202,
        distance_off: 0,
        mopRoute: 302,
      };

      mockProcessor.getCleanModeData.mockResolvedValue(mockCleanMode);

      // Get current clean mode
      const currentMode = await messageService.getCleanModeData(testDuid);
      expect(currentMode).toEqual(mockCleanMode);

      // Change clean mode
      const settings: CleanModeDTO = { suctionPower: 105, waterFlow: 203, mopRoute: 302, distance_off: 0 };
      await messageService.changeCleanMode(testDuid, settings);
      expect(mockProcessor.changeCleanMode).toHaveBeenCalledWith(testDuid, 105, 203, 302, 0);
    });

    it('should handle MQTT device workflow', async () => {
      // Set MQTT always-on
      messageService.setMqttAlwaysOn(testDuid, true);

      // Perform operations
      await messageService.pauseClean(testDuid);
      await messageService.resumeClean(testDuid);

      expect(mockProcessor.pauseClean).toHaveBeenCalled();
      expect(mockProcessor.resumeClean).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    const testDuid = 'error-device';

    beforeEach(() => {
      messageService.registerMessageProcessor(testDuid, mockProcessor);
    });

    it('should propagate MessageProcessor errors', async () => {
      const error = new Error('Communication timeout');
      mockProcessor.startClean.mockRejectedValue(error);

      await expect(messageService.startClean(testDuid, [], [], [])).rejects.toThrow('Communication timeout');
    });

    it('should throw DeviceError when routine requires iotApi but not initialized', async () => {
      const serviceWithoutApi = new MessageRoutingService(mockLogger);
      serviceWithoutApi.registerMessageProcessor(testDuid, mockProcessor);
      const supportedRoutines: ServiceArea.Area[] = [{ areaId: 1 } as ServiceArea.Area];

      await expect(serviceWithoutApi.startClean(testDuid, [1], [], supportedRoutines)).rejects.toThrow(DeviceError);
      await expect(serviceWithoutApi.startClean(testDuid, [1], [], supportedRoutines)).rejects.toThrow('IoT API must be initialized to start scene');
    });

    it('should throw meaningful errors for missing processors', async () => {
      const unknownDuid = 'non-existent-device';

      await expect(messageService.getCleanModeData(unknownDuid)).rejects.toThrow(`MessageProcessor not initialized for device ${unknownDuid}`);
      await expect(messageService.startClean(unknownDuid, [], [], [])).rejects.toThrow(`MessageProcessor not initialized for device ${unknownDuid}`);
      await expect(messageService.pauseClean(unknownDuid)).rejects.toThrow(`MessageProcessor not initialized for device ${unknownDuid}`);
    });
  });
});
