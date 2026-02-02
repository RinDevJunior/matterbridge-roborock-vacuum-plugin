import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AreaManagementService } from '../../services/areaManagementService.js';
import { RoomIndexMap } from '../../core/application/models/index.js';
import { MapInfo } from '../../initialData/getSupportedAreas.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { DeviceError } from '../../errors/index.js';
import { AnsiLogger } from 'matterbridge/logger';
import { MessageRoutingService } from '../../services/index.js';
import { RoborockIoTApi } from '../../roborockCommunication/api/iotClient.js';
import { ClientRouter } from '../../roborockCommunication/routing/clientRouter.js';
import { Scene } from '../../roborockCommunication/models/scene.js';

describe('AreaManagementService', () => {
  let areaService: AreaManagementService;
  let mockLogger: any;
  let mockIotApi: any;
  let mockMessageClient: any;
  let mockMessageRoutingService: any;

  const mockDeviceId = 'test-device-1';
  const mockAreas: ServiceArea.Area[] = [{ areaId: 0, mapId: 1 } as ServiceArea.Area, { areaId: 1, mapId: 1 } as ServiceArea.Area, { areaId: 2, mapId: 1 } as ServiceArea.Area];

  const mockRoutines: ServiceArea.Area[] = [{ areaId: 100, mapId: 1 } as ServiceArea.Area, { areaId: 101, mapId: 1 } as ServiceArea.Area];

  beforeEach(() => {
    mockLogger = createMockLogger() as Partial<AnsiLogger> as AnsiLogger;
    mockIotApi = createMockIotApi() as Partial<RoborockIoTApi> as RoborockIoTApi;
    mockMessageClient = createMockMessageClient();
    mockMessageRoutingService = {
      getRoomMap: vi.fn(),
      getMapInfo: vi.fn(),
    } satisfies Partial<MessageRoutingService>;
    areaService = new AreaManagementService(mockLogger, mockMessageRoutingService);
    areaService.setIotApi(mockIotApi);
    areaService.setMessageClient(mockMessageClient);
  });

  function createMockLogger() {
    return {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      notice: vi.fn(),
    };
  }

  function createMockIotApi() {
    return {
      getScenes: vi.fn(),
      startScene: vi.fn(),
    };
  }

  function createMockMessageClient() {
    return {
      get: vi.fn(),
      send: vi.fn(),
    };
  }

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with all dependencies', () => {
      expect(areaService).toBeDefined();
    });

    it('should initialize with logger only', () => {
      const serviceWithoutDeps = new AreaManagementService(mockLogger as AnsiLogger, undefined);
      expect(serviceWithoutDeps).toBeDefined();
    });

    it('should initialize with logger and message routing service', () => {
      const service = new AreaManagementService(mockLogger as AnsiLogger, mockMessageRoutingService as MessageRoutingService);
      expect(service).toBeDefined();
    });

    it('should set IoT API after initialization', () => {
      const service = new AreaManagementService(mockLogger as AnsiLogger, undefined);
      const newIotApi = {} as RoborockIoTApi;

      expect(() => {
        service.setIotApi(newIotApi);
      }).not.toThrow();
    });

    it('should set message client after initialization', () => {
      const service = new AreaManagementService(mockLogger as AnsiLogger, undefined);
      const newMessageClient = {} as ClientRouter;

      expect(() => {
        service.setMessageClient(newMessageClient);
      }).not.toThrow();
    });
  });

  describe('Supported Areas Management', () => {
    it('should set and get supported areas', () => {
      areaService.setSupportedAreas(mockDeviceId, mockAreas);

      const areas = areaService.getSupportedAreas(mockDeviceId);

      expect(areas).toBeDefined();
      expect(areas).toHaveLength(3);
      expect(areas).toEqual(mockAreas);
    });

    it('should return undefined for device without areas', () => {
      const areas = areaService.getSupportedAreas('unknown-device');

      expect(areas).toBeUndefined();
    });

    it('should handle empty areas array', () => {
      areaService.setSupportedAreas(mockDeviceId, []);

      const areas = areaService.getSupportedAreas(mockDeviceId);

      expect(areas).toBeDefined();
      expect(areas).toHaveLength(0);
    });

    it('should support multiple devices', () => {
      const device2 = 'test-device-2';
      const areas2: ServiceArea.Area[] = [{ areaId: 10, mapId: 2 } as ServiceArea.Area];

      areaService.setSupportedAreas(mockDeviceId, mockAreas);
      areaService.setSupportedAreas(device2, areas2);

      expect(areaService.getSupportedAreas(mockDeviceId)).toEqual(mockAreas);
      expect(areaService.getSupportedAreas(device2)).toEqual(areas2);
    });

    it('should update existing areas', () => {
      areaService.setSupportedAreas(mockDeviceId, mockAreas);

      const newAreas: ServiceArea.Area[] = [{ areaId: 99, mapId: 1 } as ServiceArea.Area];
      areaService.setSupportedAreas(mockDeviceId, newAreas);

      const areas = areaService.getSupportedAreas(mockDeviceId);
      expect(areas).toEqual(newAreas);
    });
  });

  describe('Area Index Map Management', () => {
    it('should set and get area index map', () => {
      const roomMapData = new Map<number, MapInfo>([
        [0, { roomId: 16, mapId: 1 } as MapInfo],
        [1, { roomId: 17, mapId: 1 } as MapInfo],
      ]);
      const indexMap = new RoomIndexMap(roomMapData);

      areaService.setSupportedAreaIndexMap(mockDeviceId, indexMap);

      const retrievedMap = areaService.getSupportedAreasIndexMap(mockDeviceId);

      expect(retrievedMap).toBeDefined();
      expect(retrievedMap).toBe(indexMap);
    });

    it('should return undefined for device without index map', () => {
      const indexMap = areaService.getSupportedAreasIndexMap('unknown-device');

      expect(indexMap).toBeUndefined();
    });
  });

  describe('Selected Areas Management', () => {
    it('should return empty array when no areas selected', () => {
      const selectedAreas = areaService.getSelectedAreas(mockDeviceId);

      expect(selectedAreas).toEqual([]);
    });

    it('should set selected areas with valid index map', () => {
      const roomMapData = new Map<number, MapInfo>([
        [0, { roomId: 16, mapId: 1 } as MapInfo],
        [1, { roomId: 17, mapId: 1 } as MapInfo],
        [2, { roomId: 18, mapId: 1 } as MapInfo],
      ]);
      const indexMap = new RoomIndexMap(roomMapData);

      areaService.setSupportedAreaIndexMap(mockDeviceId, indexMap);
      areaService.setSelectedAreas(mockDeviceId, [0, 1]);

      const selectedAreas = areaService.getSelectedAreas(mockDeviceId);

      expect(selectedAreas).toEqual([16, 17]);
      expect(mockLogger.debug).toHaveBeenCalledWith('AreaManagementService - setSelectedAreas', [0, 1]);
      expect(mockLogger.debug).toHaveBeenCalledWith('AreaManagementService - setSelectedAreas - roomIds', [16, 17]);
    });

    it('should handle selected areas without index map', () => {
      areaService.setSelectedAreas(mockDeviceId, [0, 1]);

      const selectedAreas = areaService.getSelectedAreas(mockDeviceId);

      expect(selectedAreas).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('No area index map found for device', mockDeviceId);
    });

    it('should filter out invalid area IDs', () => {
      const roomMapData = new Map<number, MapInfo>([
        [0, { roomId: 16, mapId: 1 } as MapInfo],
        [1, { roomId: 17, mapId: 1 } as MapInfo],
      ]);
      const indexMap = new RoomIndexMap(roomMapData);

      areaService.setSupportedAreaIndexMap(mockDeviceId, indexMap);
      areaService.setSelectedAreas(mockDeviceId, [0, 1, 999]); // 999 doesn't exist

      const selectedAreas = areaService.getSelectedAreas(mockDeviceId);

      expect(selectedAreas).toEqual([16, 17]);
    });

    it('should handle empty selection', () => {
      const roomMapData = new Map<number, MapInfo>([[0, { roomId: 16, mapId: 1 } as MapInfo]]);
      const indexMap = new RoomIndexMap(roomMapData);

      areaService.setSupportedAreaIndexMap(mockDeviceId, indexMap);
      areaService.setSelectedAreas(mockDeviceId, []);

      const selectedAreas = areaService.getSelectedAreas(mockDeviceId);

      expect(selectedAreas).toEqual([]);
    });

    it('should return empty array for unknown device', () => {
      const selectedAreas = areaService.getSelectedAreas('unknown-device');

      expect(selectedAreas).toEqual([]);
    });
  });

  describe('Supported Routines Management', () => {
    it('should set and get supported routines', () => {
      areaService.setSupportedScenes(mockDeviceId, mockRoutines);

      const routines = areaService.getSupportedRoutines(mockDeviceId);

      expect(routines).toBeDefined();
      expect(routines).toHaveLength(2);
      expect(routines).toEqual(mockRoutines);
    });

    it('should return undefined for device without routines', () => {
      const routines = areaService.getSupportedRoutines('unknown-device');

      expect(routines).toBeUndefined();
    });

    it('should handle empty routines array', () => {
      areaService.setSupportedScenes(mockDeviceId, []);

      const routines = areaService.getSupportedRoutines(mockDeviceId);

      expect(routines).toBeDefined();
      expect(routines).toHaveLength(0);
    });
  });

  describe('getMapInformation', () => {
    const mockMultipleMaps = [
      {
        max_multi_map: 4,
        max_bak_map: 1,
        multi_map_count: 2,
        map_info: [
          { mapFlag: 1, name: 'First Floor', rooms: [] },
          { mapFlag: 2, name: 'Second Floor', rooms: [] },
        ],
      },
    ];

    it('should retrieve map information successfully', async () => {
      mockMessageRoutingService.getMapInfo.mockResolvedValue(mockMultipleMaps);

      const mapInfo = await areaService.getMapInfo(mockDeviceId);

      expect(mapInfo).toBeDefined();
      expect(mockMessageRoutingService.getMapInfo).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith('AreaManagementService - getMapInfo', mockDeviceId);
    });

    it('should return undefined when no maps available', async () => {
      mockMessageRoutingService.getMapInfo.mockResolvedValue(undefined);

      const mapInfo = await areaService.getMapInfo(mockDeviceId);

      expect(mapInfo).toBeUndefined();
    });

    it('should throw DeviceError when service routing not initialized', async () => {
      const serviceWithoutClient = new AreaManagementService(mockLogger, undefined);

      await expect(serviceWithoutClient.getMapInfo(mockDeviceId)).rejects.toThrow(DeviceError);
      await expect(serviceWithoutClient.getMapInfo(mockDeviceId)).rejects.toThrow('Service routing not initialized');
    });
  });

  describe('getRoomMappings', () => {
    const mockRoomMappings = [
      [16, 1],
      [17, 2],
      [18, 3],
    ];

    it('should retrieve room mappings with non-secure request', async () => {
      mockMessageRoutingService.getRoomMap.mockImplementation((duid: string, activeMap: number, rooms: any[]) => {
        mockMessageClient.get(duid, { method: 'get_room_mapping', secure: false });
        return Promise.resolve(mockRoomMappings);
      });

      const mappings = await areaService.getRoomMap(mockDeviceId, 1);

      expect(mappings).toEqual(mockRoomMappings);
      expect(mockMessageRoutingService.getRoomMap).toHaveBeenCalledWith(mockDeviceId, 1);
    });

    it('should return undefined when message client not initialized', async () => {
      const serviceWithoutClient = new AreaManagementService(mockLogger, undefined);
      await expect(serviceWithoutClient.getRoomMap(mockDeviceId, 1)).rejects.toThrow(DeviceError);
    });

    it('should handle empty room mappings', async () => {
      mockMessageRoutingService.getRoomMap.mockResolvedValue([]);

      const mappings = await areaService.getRoomMap(mockDeviceId, 1);

      expect(mappings).toBeInstanceOf(Object);
      expect(mappings.length).toEqual(0);
    });
  });

  describe('getScenes', () => {
    const mockHomeId = 12345;
    const mockScenes: Scene[] = [{ id: 1, name: 'Morning Clean' } as Scene, { id: 2, name: 'Evening Clean' } as Scene];

    it('should retrieve scenes successfully', async () => {
      mockIotApi.getScenes.mockResolvedValue(mockScenes);

      const scenes = await areaService.getScenes(mockHomeId);

      expect(scenes).toEqual(mockScenes);
      expect(mockIotApi.getScenes).toHaveBeenCalledWith(mockHomeId);
    });

    it('should throw DeviceError when IoT API not initialized', async () => {
      const serviceWithoutApi = new AreaManagementService(mockLogger, undefined);

      await expect(serviceWithoutApi.getScenes(mockHomeId)).rejects.toThrow(DeviceError);
      await expect(serviceWithoutApi.getScenes(mockHomeId)).rejects.toThrow('IoT API not initialized');
    });

    it('should handle empty scenes array', async () => {
      mockIotApi.getScenes.mockResolvedValue([]);

      const scenes = await areaService.getScenes(mockHomeId);

      expect(scenes).toEqual([]);
    });

    it('should handle undefined scenes', async () => {
      mockIotApi.getScenes.mockResolvedValue(undefined);

      const scenes = await areaService.getScenes(mockHomeId);

      expect(scenes).toBeUndefined();
    });
  });

  describe('startScene', () => {
    const mockSceneId = 42;

    it('should start scene successfully', async () => {
      const mockResult = { success: true };
      mockIotApi.startScene.mockResolvedValue(mockResult);

      const result = await areaService.startScene(mockSceneId);

      expect(result).toEqual(mockResult);
      expect(mockIotApi.startScene).toHaveBeenCalledWith(mockSceneId);
    });

    it('should throw DeviceError when IoT API not initialized', async () => {
      const serviceWithoutApi = new AreaManagementService(mockLogger, undefined);

      await expect(serviceWithoutApi.startScene(mockSceneId)).rejects.toThrow(DeviceError);
      await expect(serviceWithoutApi.startScene(mockSceneId)).rejects.toThrow('IoT API not initialized');
    });

    it('should propagate API errors', async () => {
      const error = new Error('Scene execution failed');
      mockIotApi.startScene.mockRejectedValue(error);

      await expect(areaService.startScene(mockSceneId)).rejects.toThrow('Scene execution failed');
    });
  });

  describe('clearAll', () => {
    it('should clear all data', () => {
      // Set up some data
      areaService.setSupportedAreas(mockDeviceId, mockAreas);
      areaService.setSupportedScenes(mockDeviceId, mockRoutines);
      const roomMapData = new Map<number, MapInfo>([[0, { roomId: 16, mapId: 1 } as MapInfo]]);
      areaService.setSupportedAreaIndexMap(mockDeviceId, new RoomIndexMap(roomMapData));
      areaService.setSelectedAreas(mockDeviceId, [0]);

      // Clear all
      areaService.clearAll();

      // Verify everything is cleared
      expect(areaService.getSupportedAreas(mockDeviceId)).toBeUndefined();
      expect(areaService.getSupportedRoutines(mockDeviceId)).toBeUndefined();
      expect(areaService.getSupportedAreasIndexMap(mockDeviceId)).toBeUndefined();
      expect(areaService.getSelectedAreas(mockDeviceId)).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith('AreaManagementService - All data cleared');
    });

    it('should be safe to call multiple times', () => {
      areaService.clearAll();
      areaService.clearAll();

      expect(() => {
        areaService.clearAll();
      }).not.toThrow();
    });

    it('should clear empty service without errors', () => {
      const newService = new AreaManagementService(mockLogger, undefined);

      expect(() => {
        newService.clearAll();
      }).not.toThrow();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete area setup workflow', () => {
      // Setup areas
      areaService.setSupportedAreas(mockDeviceId, mockAreas);

      // Setup index map
      const roomMapData = new Map<number, MapInfo>([
        [0, { roomId: 16, mapId: 1 } as MapInfo],
        [1, { roomId: 17, mapId: 1 } as MapInfo],
        [2, { roomId: 18, mapId: 1 } as MapInfo],
      ]);
      areaService.setSupportedAreaIndexMap(mockDeviceId, new RoomIndexMap(roomMapData));

      // Setup routines
      areaService.setSupportedScenes(mockDeviceId, mockRoutines);

      // Select areas
      areaService.setSelectedAreas(mockDeviceId, [0, 2]);

      // Verify complete setup
      expect(areaService.getSupportedAreas(mockDeviceId)).toEqual(mockAreas);
      expect(areaService.getSupportedRoutines(mockDeviceId)).toEqual(mockRoutines);
      expect(areaService.getSelectedAreas(mockDeviceId)).toEqual([16, 18]);
    });

    it('should handle multiple devices independently', () => {
      const device1 = 'device-1';
      const device2 = 'device-2';

      const areas1: ServiceArea.Area[] = [{ areaId: 1, mapId: 1 } as ServiceArea.Area];
      const areas2: ServiceArea.Area[] = [{ areaId: 2, mapId: 2 } as ServiceArea.Area];

      areaService.setSupportedAreas(device1, areas1);
      areaService.setSupportedAreas(device2, areas2);

      expect(areaService.getSupportedAreas(device1)).toEqual(areas1);
      expect(areaService.getSupportedAreas(device2)).toEqual(areas2);
    });

    it('should handle scene workflow with IoT API', async () => {
      const homeId = 123;
      const mockScenes: Scene[] = [{ id: 1, name: 'Test' } as Scene];

      mockIotApi.getScenes.mockResolvedValue(mockScenes);
      mockIotApi.startScene.mockResolvedValue({ success: true });

      const scenes = await areaService.getScenes(homeId);
      expect(scenes).toEqual(mockScenes);

      const result = await areaService.startScene(1);
      expect(result).toEqual({ success: true });
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown device IDs gracefully', () => {
      expect(areaService.getSupportedAreas('unknown-device')).toBeUndefined();
      expect(areaService.getSelectedAreas('unknown-device')).toEqual([]);
      expect(areaService.getSupportedRoutines('unknown-device')).toBeUndefined();
    });

    it('should handle malformed area data', () => {
      const malformedAreas = [{ areaId: 1 } as ServiceArea.Area, { areaId: 2 } as ServiceArea.Area];

      expect(() => {
        areaService.setSupportedAreas(mockDeviceId, malformedAreas);
      }).not.toThrow();

      const areas = areaService.getSupportedAreas(mockDeviceId);
      expect(areas).toEqual(malformedAreas);
    });

    it('should propagate message client errors', async () => {
      const error = new Error('Network error');
      mockMessageRoutingService.getMapInfo.mockRejectedValue(error);

      await expect(areaService.getMapInfo(mockDeviceId)).rejects.toThrow('Network error');
    });

    it('should propagate IoT API errors', async () => {
      const error = new Error('API error');
      mockIotApi.getScenes.mockRejectedValue(error);

      await expect(areaService.getScenes(123)).rejects.toThrow('API error');
    });
  });
});
