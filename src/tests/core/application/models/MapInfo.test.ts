import { MapInfo } from '../../../../core/application/models/MapInfo.js';
import { MultipleMapDto } from '../../../../roborockCommunication/models/home/index.js';
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

      expect(mapInfo.maps[0].rooms[0]).toHaveProperty('iot_map_id', 10);
      expect(mapInfo.maps[1].rooms[0]).toHaveProperty('iot_map_id', 20);
      expect(mapInfo.allRooms).toHaveLength(2);
      expect(mapInfo.allRooms[0]).toHaveProperty('iot_map_id', 10);
      expect(mapInfo.allRooms[1]).toHaveProperty('iot_map_id', 20);
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

    it('real data test 1', () => {
      const multimap = {
        max_multi_map: 4,
        max_bak_map: 1,
        multi_map_count: 2,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1771060270,
            length: 9,
            name: 'First Map',
            bak_maps: [{ mapFlag: 4, add_time: 1771577723 }],
            rooms: [
              {
                id: 1,
                tag: 14,
                iot_name_id: '11100845',
                iot_name: 'Kitchen',
              },
              {
                id: 2,
                tag: 9,
                iot_name_id: '11100849',
                iot_name: 'Study',
              },
              {
                id: 3,
                tag: 6,
                iot_name_id: '11100842',
                iot_name: 'Living room',
              },
              {
                id: 4,
                tag: 1,
                iot_name_id: '11100847',
                iot_name: 'Bedroom',
              },
            ],
            furnitures: [],
          },
          {
            mapFlag: 1,
            add_time: 1771580198,
            length: 0,
            name: '',
            bak_maps: [{ mapFlag: 5, add_time: 1771579916 }],
            rooms: [
              {
                id: 1,
                tag: 2,
                iot_name_id: '12461109',
                iot_name: 'Master bedroom',
              },
              {
                id: 2,
                tag: 9,
                iot_name_id: '11100849',
                iot_name: 'Study',
              },
              {
                id: 3,
                tag: 6,
                iot_name_id: '11100842',
                iot_name: 'Living room',
              },
              {
                id: 4,
                tag: 14,
                iot_name_id: '11100845',
                iot_name: 'Kitchen',
              },
            ],
            furnitures: [],
          },
        ],
      } satisfies MultipleMapDto;

      const mapInfo = new MapInfo(multimap);

      const roomForMap0 = mapInfo.allRooms.filter((x) => x.iot_map_id === 0);
      const roomForMap1 = mapInfo.allRooms.filter((x) => x.iot_map_id === 1);

      // console.log(mapInfo.allRooms);
      expect(mapInfo.hasRooms).toBe(true);
      expect(roomForMap0.length).toEqual(4);
      expect(roomForMap1.length).toEqual(4);
    });
  });

  describe('getActiveMapId', () => {
    const multimap = {
      max_multi_map: 4,
      max_bak_map: 1,
      multi_map_count: 2,
      map_info: [
        {
          mapFlag: 0,
          add_time: 1771060270,
          length: 9,
          name: 'First Map',
          bak_maps: [{ mapFlag: 4, add_time: 1771577723 }],
          rooms: [
            { id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Kitchen' },
            { id: 2, tag: 9, iot_name_id: '11100849', iot_name: 'Study' },
            { id: 3, tag: 6, iot_name_id: '11100842', iot_name: 'Living room' },
            { id: 4, tag: 1, iot_name_id: '11100847', iot_name: 'Bedroom' },
          ],
          furnitures: [],
        },
        {
          mapFlag: 1,
          add_time: 1771580198,
          length: 4,
          name: 'abcd',
          bak_maps: [{ mapFlag: 5, add_time: 1771585501 }],
          rooms: [
            { id: 1, tag: 2, iot_name_id: '12461109', iot_name: 'Master bedroom' },
            { id: 2, tag: 9, iot_name_id: '11100849', iot_name: 'Study' },
            { id: 3, tag: 6, iot_name_id: '11100842', iot_name: 'Living room' },
            { id: 4, tag: 14, iot_name_id: '11100845', iot_name: 'Kitchen' },
          ],
          furnitures: [],
        },
      ],
    } satisfies MultipleMapDto;

    it('should return mapFlag 0 when roomData matches first map', () => {
      const mapInfo = new MapInfo(multimap);
      const roomData = [
        [1, '11100845', 14],
        [2, '11100849', 9],
        [3, '11100842', 6],
        [4, '11100847', 1],
      ] satisfies [number, string, number][];

      expect(mapInfo.getActiveMapId(roomData)).toBe(0);
    });

    it('should return mapFlag 1 when roomData matches second map', () => {
      const mapInfo = new MapInfo(multimap);
      const roomData = [
        [1, '12461109', 2],
        [2, '11100849', 9],
        [3, '11100842', 6],
        [4, '11100845', 14],
      ] satisfies [number, string, number][];

      expect(mapInfo.getActiveMapId(roomData)).toBe(1);
    });

    it('should return 0 when roomData matches no map', () => {
      const mapInfo = new MapInfo(multimap);
      const roomData = [[1, 'unknown-room', 0]] satisfies [number, string, number][];

      expect(mapInfo.getActiveMapId(roomData)).toBe(0);
    });

    it('should return 0 when roomData is empty', () => {
      const mapInfo = new MapInfo(multimap);

      expect(mapInfo.getActiveMapId([])).toBe(0);
    });
  });
});
