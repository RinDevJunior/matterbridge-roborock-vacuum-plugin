import { MapInfo } from '../../../../core/application/models/MapInfo.js';
import { MultipleMapDto, MapDataDto, MapRoomDto } from '../../../../roborockCommunication/models/home/index.js';
import { describe, it, expect } from 'vitest';

describe('MapInfo', () => {
  describe('constructor', () => {
    it('should parse map info with rooms', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1769874960,
            length: 4,
            name: 'Home',
            bak_maps: [{ mapFlag: 4, add_time: 1768854177 }],
            rooms: [
              {
                id: 1,
                tag: 0,
                iot_name_id: 'room1',
                iot_name: 'Living Room',
              },
              {
                id: 2,
                tag: 1,
                iot_name_id: 'room2',
                iot_name: 'Kitchen',
              },
            ],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.maps).toHaveLength(1);
      expect(mapInfo.maps[0].id).toBe(0);
      expect(mapInfo.maps[0].name).toBe('Home');
      expect(mapInfo.maps[0].rooms).toHaveLength(2);
      expect(mapInfo.allRooms).toHaveLength(2);
    });

    it('should parse map info without rooms', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1769874960,
            length: 4,
            name: 'Home',
            bak_maps: [{ mapFlag: 4, add_time: 1768854177 }],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.maps).toHaveLength(1);
      expect(mapInfo.maps[0].id).toBe(0);
      expect(mapInfo.maps[0].name).toBe('Home');
      expect(mapInfo.maps[0].rooms).toHaveLength(0);
      expect(mapInfo.allRooms).toHaveLength(0);
    });

    it('should assign mapId to rooms', () => {
      const multimap = {
        max_multi_map: 2,
        max_bak_map: 1,
        multi_map_count: 2,
        map_info: [
          {
            mapFlag: 10,
            add_time: 1769874960,
            length: 4,
            name: 'First Floor',
            bak_maps: [],
            rooms: [
              {
                id: 1,
                tag: 0,
                iot_name_id: 'room1',
                iot_name: 'Living Room',
              },
            ],
          },
          {
            mapFlag: 20,
            add_time: 1769874960,
            length: 4,
            name: 'Second Floor',
            bak_maps: [],
            rooms: [
              {
                id: 2,
                tag: 0,
                iot_name_id: 'room2',
                iot_name: 'Bedroom',
              },
            ],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.maps[0].rooms[0]).toHaveProperty('mapId', 10);
      expect(mapInfo.maps[1].rooms[0]).toHaveProperty('mapId', 20);
      expect(mapInfo.allRooms).toHaveLength(2);
      expect(mapInfo.allRooms[0]).toHaveProperty('mapId', 10);
      expect(mapInfo.allRooms[1]).toHaveProperty('mapId', 20);
    });

    it('should decode URL-encoded map names', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1769874960,
            length: 4,
            name: 'My%20Home',
            bak_maps: [],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.maps[0].name).toBe('My Home');
    });

    it('should handle multiple maps', () => {
      const multimap = {
        max_multi_map: 3,
        max_bak_map: 1,
        multi_map_count: 3,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1769874960,
            length: 4,
            name: 'First',
            bak_maps: [],
          },
          {
            mapFlag: 1,
            add_time: 1769874961,
            length: 6,
            name: 'Second',
            bak_maps: [],
          },
          {
            mapFlag: 2,
            add_time: 1769874962,
            length: 5,
            name: 'Third',
            bak_maps: [],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.maps).toHaveLength(3);
      expect(mapInfo.maps[0].id).toBe(0);
      expect(mapInfo.maps[1].id).toBe(1);
      expect(mapInfo.maps[2].id).toBe(2);
    });
  });

  describe('getById', () => {
    it('should return map name for existing id', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 42,
            add_time: 1769874960,
            length: 4,
            name: 'TestMap',
            bak_maps: [],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.getById(42)).toBe('TestMap');
    });

    it('should return undefined for non-existing id', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1769874960,
            length: 4,
            name: 'Home',
            bak_maps: [],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.getById(999)).toBeUndefined();
    });
  });

  describe('getByName', () => {
    it('should return map id for existing name', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 42,
            add_time: 1769874960,
            length: 4,
            name: 'TestMap',
            bak_maps: [],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.getByName('TestMap')).toBe(42);
    });

    it('should return undefined for non-existing name', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1769874960,
            length: 4,
            name: 'Home',
            bak_maps: [],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.getByName('Unknown')).toBeUndefined();
    });

    it('should be case insensitive', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 42,
            add_time: 1769874960,
            length: 4,
            name: 'TestMap',
            bak_maps: [],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.getByName('testmap')).toBe(42);
      expect(mapInfo.getByName('TESTMAP')).toBe(42);
      expect(mapInfo.getByName('TeStMaP')).toBe(42);
    });
  });

  describe('hasRooms', () => {
    it('should return true when rooms exist', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1769874960,
            length: 4,
            name: 'Home',
            bak_maps: [],
            rooms: [
              {
                id: 1,
                tag: 0,
                iot_name_id: 'room1',
                iot_name: 'Living Room',
              },
            ],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.hasRooms).toBe(true);
    });

    it('should return false when no rooms exist', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1769874960,
            length: 4,
            name: 'Home',
            bak_maps: [],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.hasRooms).toBe(false);
    });

    it('should return false when rooms array is empty', () => {
      const multimap = {
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1769874960,
            length: 4,
            name: 'Home',
            bak_maps: [],
            rooms: [],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.hasRooms).toBe(false);
    });
  });
});
