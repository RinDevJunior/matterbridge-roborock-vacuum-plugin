import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomMap } from '../../../../core/application/models/RoomMap.js';
import { MapInfo } from '../../../../core/application/models/MapInfo.js';
import { createMockLogger, asPartial, createMockRoborockService } from '../../../helpers/testUtils.js';
import type { RoomMapping } from '../../../../core/application/models/RoomMapping.js';
import type { MapInfoPlatformContext, MapReference } from '../../../../core/application/models/RoomMap.js';
import type { Device } from '../../../../roborockCommunication/models/device.js';

function createRoomMapping(id: number, iot_map_id: number, overrides: Partial<RoomMapping> = {}): RoomMapping {
  return {
    id,
    iot_name_id: `room${id}`,
    tag: 0,
    iot_map_id,
    iot_name: `Room ${id}`,
    ...overrides,
  };
}

function createMockDevice(): Device {
  return asPartial<Device>({
    duid: 'test-duid',
    store: { homeData: { rooms: [] } },
    mapInfos: undefined,
  });
}

describe('RoomMap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('hasRooms', () => {
    it('should return true when rooms exist', () => {
      const roomMap = new RoomMap([createRoomMapping(1, 0)]);
      expect(roomMap.hasRooms).toBe(true);
    });

    it('should return false when no rooms exist', () => {
      const roomMap = new RoomMap([]);
      expect(roomMap.hasRooms).toBe(false);
    });
  });

  describe('rooms', () => {
    it('should return all room mappings', () => {
      const mappings = [createRoomMapping(1, 0), createRoomMapping(2, 0)];
      const roomMap = new RoomMap(mappings);
      expect(roomMap.rooms).toEqual(mappings);
    });
  });

  describe('getRooms', () => {
    const mapRefs: MapReference[] = [{ id: 10, name: 'First Floor' }];

    it('should filter rooms by map id when enableMultipleMap is false', () => {
      const roomMap = new RoomMap([createRoomMapping(1, 10), createRoomMapping(2, 20), createRoomMapping(3, 10)]);
      const result = roomMap.getRooms(mapRefs, false);
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.id)).toEqual([1, 3]);
    });

    it('should return all rooms when enableMultipleMap is true', () => {
      const roomMap = new RoomMap([createRoomMapping(1, 10), createRoomMapping(2, 20), createRoomMapping(3, 10)]);
      const result = roomMap.getRooms(mapRefs, true);
      expect(result).toHaveLength(3);
    });

    it('should include rooms with undefined iot_map_id when filtering', () => {
      const roomWithUndefinedMap = createRoomMapping(4, 0, { iot_map_id: undefined as unknown as number });
      const roomMap = new RoomMap([createRoomMapping(1, 10), roomWithUndefinedMap]);
      const result = roomMap.getRooms(mapRefs, false);
      expect(result.map((r) => r.id)).toContain(4);
    });

    it('should default to mapId 0 when map_info is empty', () => {
      const roomMap = new RoomMap([createRoomMapping(1, 0), createRoomMapping(2, 10)]);
      const result = roomMap.getRooms([], false);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('should default enableMultipleMap to false', () => {
      const roomMap = new RoomMap([createRoomMapping(1, 10), createRoomMapping(2, 20)]);
      const result = roomMap.getRooms(mapRefs);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe('empty', () => {
    it('should return a RoomMap with no rooms', () => {
      const roomMap = RoomMap.empty();
      expect(roomMap.hasRooms).toBe(false);
      expect(roomMap.rooms).toHaveLength(0);
    });
  });

  describe('fromMapInfo', () => {
    let context: MapInfoPlatformContext;

    beforeEach(() => {
      context = {
        roborockService: createMockRoborockService(),
        log: createMockLogger(),
      };
    });

    it('should return empty result when roborockService is undefined', async () => {
      context.roborockService = undefined;
      const device = createMockDevice();

      const result = await RoomMap.fromMapInfo(device, context);

      expect(result.activeMapId).toBe(0);
      expect(result.roomMap.hasRooms).toBe(false);
      expect(result.mapInfo).toBeInstanceOf(MapInfo);
      expect(context.log.error).toHaveBeenCalledWith('Roborock service not initialized');
    });

    it('should use mapInfo rooms when mapInfo hasRooms', async () => {
      const mapInfo = new MapInfo({
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 5,
            add_time: 0,
            length: 1,
            name: 'Home',
            bak_maps: [],
            rooms: [{ id: 1, tag: 0, iot_name_id: 'room1', iot_name: 'Living Room' }],
          },
        ],
      });
      const roomData: [number, string][] = [[1, 'room1']];
      vi.mocked(context.roborockService!.getMapInfo).mockResolvedValue(mapInfo);
      vi.mocked(context.roborockService!.getRoomMap).mockResolvedValue(roomData);
      const device = createMockDevice();

      const result = await RoomMap.fromMapInfo(device, context);

      expect(result.roomMap.hasRooms).toBe(true);
      expect(result.roomMap.rooms).toHaveLength(1);
      expect(result.mapInfo).toBe(mapInfo);
      expect(device.mapInfos).toBe(mapInfo.maps);
    });

    it('should fall back to roomData when mapInfo has no rooms', async () => {
      const mapInfo = new MapInfo({
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [{ mapFlag: 3, add_time: 0, length: 0, name: 'Home', bak_maps: [] }],
      });
      const roomData: [number, string][] = [[1, 'room1'], [2, 'room2']];
      vi.mocked(context.roborockService!.getMapInfo).mockResolvedValue(mapInfo);
      vi.mocked(context.roborockService!.getRoomMap).mockResolvedValue(roomData);
      const device = createMockDevice();

      const result = await RoomMap.fromMapInfo(device, context);

      expect(result.activeMapId).toBe(3);
      expect(result.roomMap.hasRooms).toBe(true);
      expect(result.roomMap.rooms).toHaveLength(2);
    });

    it('should set activeMapId to 0 when maps array is empty', async () => {
      const mapInfo = MapInfo.empty();
      vi.mocked(context.roborockService!.getMapInfo).mockResolvedValue(mapInfo);
      vi.mocked(context.roborockService!.getRoomMap).mockResolvedValue([]);
      const device = createMockDevice();

      const result = await RoomMap.fromMapInfo(device, context);

      expect(result.activeMapId).toBe(0);
    });
  });
});
