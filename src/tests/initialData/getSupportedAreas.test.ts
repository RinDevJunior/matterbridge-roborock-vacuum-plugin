import { getSupportedAreas } from '../../initialData/getSupportedAreas.js';
import { RoomMap, RoomMapping, MapInfo, MapEntry } from '../../core/application/models/index.js';
import { describe, it, expect, beforeEach, vi, test } from 'vitest';
import type { RoomDto } from '../../roborockCommunication/models/index.js';
import { makeLogger } from '../testUtils.js';
import { HomeEntity } from '../../core/domain/entities/Home.js';
import { RoomEntity } from '../../core/domain/entities/Room.js';

const mockLogger = makeLogger();

function createHomeEntity(vacuumRooms: RoomDto[], roomMap: RoomMap | undefined, enableMultipleMap = false, mapInfos: MapEntry[] = []): HomeEntity {
  const rooms = vacuumRooms.map((r) => new RoomEntity(r.id, r.name));
  const homeData = {
    id: 1,
    name: 'Test Home',
    products: [],
    devices: [],
    receivedDevices: [],
    rooms,
  };
  const mapDataDtos = mapInfos.map((entry) => ({
    mapFlag: entry.id,
    add_time: Date.now(),
    length: entry.rooms.length,
    name: entry.name ?? '',
    bak_maps: [],
    rooms: entry.rooms,
  }));
  const mapInfo = new MapInfo({
    max_multi_map: mapInfos.length,
    max_bak_map: 0,
    multi_map_count: mapInfos.length,
    map_info: mapDataDtos,
  });
  return new HomeEntity(1, 'Test Home', roomMap ?? RoomMap.empty(), mapInfo, enableMultipleMap);
}

describe('getSupportedAreas (legacy)', () => {
  it('returns Unknown area when vacuumRooms missing or roomMap missing', () => {
    const homeEntity = createHomeEntity([], undefined, false);
    const res = getSupportedAreas(homeEntity, makeLogger());
    expect(res.supportedAreas.length).toBe(1);
    expect(res.supportedAreas[0]?.areaInfo?.locationInfo?.locationName).toContain('Unknown');
  });

  test('detect duplicated areas returns duplicated sentinel', () => {
    const rooms: RoomMapping[] = [
      { id: 1, iot_name_id: '1', tag: 0, iot_map_id: 0, iot_name: 'Room1' },
      { id: 1, iot_name_id: '1', tag: 0, iot_map_id: 0, iot_name: 'Room1' },
    ];
    const roomMap = new RoomMap(rooms);
    const vacuumRooms: RoomDto[] = [{ id: 1, name: 'R1' }];
    const homeEntity = createHomeEntity(vacuumRooms, roomMap, false);
    const res = getSupportedAreas(homeEntity, makeLogger());
    expect(res.supportedAreas.length).toBe(1);
    expect(res.supportedAreas[0]?.areaInfo?.locationInfo?.locationName).toContain('Duplicated');
  });

  test('enableMultipleMap returns supportedMaps', () => {
    const vacuumRooms: RoomDto[] = [{ id: 1, name: 'R1' }];
    const roomMap = new RoomMap([{ id: 10, iot_name_id: '10', tag: 0, iot_map_id: 7, iot_name: 'RoomX' }]);
    const homeEntity = createHomeEntity(vacuumRooms, roomMap, true, [{ id: 7, name: 'Level 7', rooms: [] }]);
    const res = getSupportedAreas(homeEntity, makeLogger());
    expect(res.supportedMaps.length).toBeGreaterThanOrEqual(1);
    expect(res.roomIndexMap).toBeDefined();
  });
});

describe('getSupportedAreas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default area when rooms and roomMap are empty (case 1)', () => {
    const vacuumRooms = [
      { id: 2775739, name: 'Garage' },
      { id: 1474466, name: 'Outside' },
      { id: 1459590, name: 'AAA room' },
      { id: 1459587, name: "BBB's Room" },
      { id: 1459580, name: "CCC's room" },
      { id: 1458155, name: 'Dining room' },
      { id: 1457889, name: 'Bathroom' },
      { id: 1457888, name: 'Living room' },
      { id: 991195, name: 'Downstairs Bathroom' },
      { id: 991190, name: 'Garage Entryway' },
      { id: 991187, name: 'TV Room' },
      { id: 991185, name: 'Bedroom' },
      { id: 612205, name: "DDD's Room" },
      { id: 612204, name: 'Upstairs Bathroom' },
      { id: 612202, name: 'Hallway' },
      { id: 612200, name: 'EEE Room' },
      { id: 609148, name: 'Dining Room' },
      { id: 609146, name: 'Kitchen' },
      { id: 609145, name: 'Living Room' },
    ];
    const roomMap = new RoomMap([
      { id: 16, iot_name_id: '609146', tag: 0, iot_map_id: 0, iot_name: 'Kitchen' },
      { id: 17, iot_name_id: '1457889', tag: 0, iot_map_id: 0, iot_name: 'Bathroom' },
      { id: 18, iot_name_id: '612202', tag: 0, iot_map_id: 0, iot_name: 'Hallway' },
      { id: 19, iot_name_id: '1458155', tag: 0, iot_map_id: 0, iot_name: 'Dining room' },
      { id: 20, iot_name_id: '1457888', tag: 0, iot_map_id: 0, iot_name: 'Living room' },
      { id: 21, iot_name_id: '1459580', tag: 0, iot_map_id: 0, iot_name: "BBB's room" },
      { id: 22, iot_name_id: '612205', tag: 0, iot_map_id: 0, iot_name: "CCC's Room" },
      { id: 23, iot_name_id: '1474466', tag: 0, iot_map_id: 0, iot_name: 'Outside' },
    ]);
    const homeEntity = createHomeEntity(vacuumRooms, roomMap, false);
    const { supportedAreas } = getSupportedAreas(homeEntity, mockLogger);

    expect(supportedAreas.length).toEqual(8);
  });

  it('returns default area when rooms and roomMap are empty (case 2)', () => {
    const vacuumRooms = [
      { id: 11453731, name: 'Living room' },
      { id: 11453727, name: 'Kitchen' },
      { id: 11453415, name: 'Bathroom' },
      { id: 11453409, name: "Emile's Room" },
      { id: 11453404, name: "Nadia's Room" },
      { id: 11453398, name: 'Hallway' },
      { id: 11453391, name: 'Dining room' },
      { id: 11453384, name: 'Outside' },
    ];
    const roomMap = new RoomMap([
      { id: 16, iot_name_id: '2775739', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 17, iot_name_id: '991195', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 18, iot_name_id: '991187', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 19, iot_name_id: '991185', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 20, iot_name_id: '991190', tag: 0, iot_map_id: 0, iot_name: '' },
    ]);
    const homeEntity = createHomeEntity(vacuumRooms, roomMap, false);
    const { supportedAreas } = getSupportedAreas(homeEntity, mockLogger);

    expect(supportedAreas.length).toEqual(5);
  });

  it('returns default area when rooms and roomMap are empty (case 3)', () => {
    const vacuumRooms = [
      { id: 11453731, name: 'Living room' },
      { id: 11453727, name: 'Kitchen' },
      { id: 11453415, name: 'Bathroom' },
      { id: 11453409, name: "Emile's Room" },
      { id: 11453404, name: "Nadia's Room" },
      { id: 11453398, name: 'Hallway' },
      { id: 11453391, name: 'Dining room' },
      { id: 11453384, name: 'Outside' },
    ];
    const roomMap = new RoomMap([
      { id: 16, iot_name_id: '2775739', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 17, iot_name_id: '991195', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 18, iot_name_id: '991187', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 19, iot_name_id: '991185', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 20, iot_name_id: '991190', tag: 0, iot_map_id: 0, iot_name: '' },
    ]);
    const homeEntity = createHomeEntity(vacuumRooms, roomMap, false);
    const { supportedAreas } = getSupportedAreas(homeEntity, mockLogger);

    expect(supportedAreas.length).toEqual(5);
  });

  it('returns default area when rooms and roomMap are empty (case 4)', () => {
    const vacuumRooms: RoomDto[] = [
      { id: 11100845, name: 'Kitchen' },
      { id: 11100849, name: 'Study' },
      { id: 11100842, name: 'Living room' },
      { id: 11100847, name: 'Bedroom' },
      { id: 12461114, name: 'Guest bedroom' },
      { id: 12461109, name: 'Master bedroom' },
      { id: 12461111, name: 'Balcony' },
    ];
    const roomMap = new RoomMap([
      { id: 16, iot_name_id: '2775739', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 17, iot_name_id: '991195', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 18, iot_name_id: '991187', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 19, iot_name_id: '991185', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 20, iot_name_id: '991190', tag: 0, iot_map_id: 0, iot_name: '' },
    ]);
    const homeEntity = createHomeEntity(vacuumRooms, roomMap, false);
    const { supportedAreas } = getSupportedAreas(homeEntity, mockLogger);

    expect(supportedAreas.length).toEqual(5);
  });

  it('returns default area when rooms and roomMap are empty', () => {
    const vacuumRooms: RoomDto[] = [
      { id: 11100845, name: 'Kitchen' },
      { id: 11100849, name: 'Study' },
      { id: 11100842, name: 'Living room' },
      { id: 11100847, name: 'Bedroom' },
      { id: 11100842, name: 'Living room' },
      { id: 12461114, name: 'Guest bedroom' },
      { id: 12461109, name: 'Master bedroom' },
      { id: 12461111, name: 'Balcony' },
    ];
    const roomMap = new RoomMap([
      { id: 1, iot_name_id: '11100845', tag: 14, iot_map_id: 0, iot_name: 'Kitchen' },
      { id: 2, iot_name_id: '11100849', tag: 9, iot_map_id: 0, iot_name: 'Study' },
      { id: 3, iot_name_id: '11100842', tag: 6, iot_map_id: 0, iot_name: 'Living room' },
      { id: 4, iot_name_id: '11100847', tag: 1, iot_map_id: 0, iot_name: 'Bedroom' },
      { id: 1, iot_name_id: '11100842', tag: 6, iot_map_id: 1, iot_name: 'Living room' },
      { id: 2, iot_name_id: '12461114', tag: 3, iot_map_id: 1, iot_name: 'Guest bedroom' },
      { id: 3, iot_name_id: '12461109', tag: 2, iot_map_id: 1, iot_name: 'Master bedroom' },
      { id: 4, iot_name_id: '12461111', tag: 7, iot_map_id: 1, iot_name: 'Balcony' },
    ]);

    const homeEntity = createHomeEntity(vacuumRooms, roomMap, true, [
      { id: 0, name: 'First Map', rooms: [] },
      { id: 1, name: 'Second Map', rooms: [] },
    ]);
    const { supportedAreas, supportedMaps } = getSupportedAreas(homeEntity, makeLogger());
    expect(supportedAreas.length).toEqual(8);
    expect(supportedMaps.length).toEqual(2);
  });

  it('real test 1', () => {
    const vacuumRooms: RoomDto[] = [
      new RoomEntity(11100845, 'Kitchen'),
      new RoomEntity(11100849, 'Study'),
      new RoomEntity(11100842, 'Living room'),
      new RoomEntity(11100847, 'Bedroom'),
      new RoomEntity(12461114, 'Guest bedroom'),
      new RoomEntity(12461109, 'Master bedroom'),
      new RoomEntity(12461111, 'Balcony'),
    ];
    const roomMap = new RoomMap([
      { id: 1, iot_name_id: '11100845', tag: 14, iot_map_id: 0, iot_name: 'Kitchen' },
      { id: 2, iot_name_id: '11100849', tag: 9, iot_map_id: 0, iot_name: 'Study' },
      { id: 3, iot_name_id: '11100842', tag: 6, iot_map_id: 0, iot_name: 'Living room' },
      { id: 4, iot_name_id: '11100847', tag: 1, iot_map_id: 0, iot_name: 'Bedroom' },
      { id: 1, iot_name_id: '11100842', tag: 6, iot_map_id: 1, iot_name: 'Living room' },
      { id: 2, iot_name_id: '12461114', tag: 3, iot_map_id: 1, iot_name: 'Guest bedroom' },
      { id: 3, iot_name_id: '12461109', tag: 2, iot_map_id: 1, iot_name: 'Master bedroom' },
      { id: 4, iot_name_id: '12461111', tag: 7, iot_map_id: 1, iot_name: 'Balcony' },
    ]);

    const homeEntity = createHomeEntity(vacuumRooms, roomMap, true, [
      { id: 0, name: 'First Map', rooms: [] },
      { id: 1, name: 'Second Map', rooms: [] },
    ]);
    const { supportedAreas, supportedMaps } = getSupportedAreas(homeEntity, makeLogger());
    expect(supportedAreas.length).toEqual(8);
    expect(supportedMaps.length).toEqual(2);

    // console.log(`Supported areas: ${JSON.stringify(supportedAreas, null, 2)} `);
    // console.log(`Supported maps: ${JSON.stringify(supportedMaps, null, 2)} `);
  });
});
