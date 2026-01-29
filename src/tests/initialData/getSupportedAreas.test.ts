import { getSupportedAreas } from '../../initialData/getSupportedAreas.js';
import { RoomMap, RoomMapping } from '../../core/application/models/index.js';
import { describe, it, expect, beforeEach, vi, test } from 'vitest';
import type { RoomDto } from '../../roborockCommunication/models/index.js';

const mockLogger = {
  debug: vi.fn(),
  error: vi.fn(),
  notice: vi.fn(),
};

describe('getSupportedAreas (legacy)', () => {
  it('returns Unknown area when vacuumRooms missing or roomMap missing', () => {
    const res = getSupportedAreas([], undefined, false, { error: vi.fn(), debug: vi.fn() } as any);
    expect(res.supportedAreas.length).toBe(1);
    expect(res.supportedAreas[0]?.areaInfo?.locationInfo?.locationName).toContain('Unknown');
  });

  test('detect duplicated areas returns duplicated sentinel', () => {
    const rooms: RoomMapping[] = [
      { id: 1, iot_name_id: '1', globalId: 1, tag: 0, iot_map_id: 0, iot_name: 'Room1' },
      { id: 1, iot_name_id: '1', globalId: 1, tag: 0, iot_map_id: 0, iot_name: 'Room1' },
    ];
    const roomMap = new RoomMap(rooms);
    const vacuumRooms = [{ id: 1, name: 'R1' }];
    const res = getSupportedAreas(vacuumRooms as any, roomMap, false, { error: vi.fn(), debug: vi.fn() } as any);
    expect(res.supportedAreas.length).toBe(1);
    expect(res.supportedAreas[0]?.areaInfo?.locationInfo?.locationName).toContain('Duplicated');
  });

  test('enableMultipleMap returns supportedMaps', () => {
    const vacuumRooms = [{ id: 1, name: 'R1' } as any];
    const roomMap = new RoomMap([{ id: 10, iot_name_id: '10', globalId: 10, tag: 0, iot_map_id: 7, iot_name: 'RoomX' }]);
    const res = getSupportedAreas(vacuumRooms as any, roomMap, true, { error: vi.fn(), debug: vi.fn() } as any, [{ id: 7, name: 'Level 7', rooms: [] }]);
    expect(res.supportedMaps.length).toBeGreaterThanOrEqual(1);
    expect(res.roomIndexMap).toBeDefined();
  });
});

describe('getSupportedAreas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns default area when rooms and roomMap are empty (case 1)', () => {
    const { supportedAreas } = getSupportedAreas(
      [
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
      ],
      new RoomMap([
        { id: 16, globalId: 609146, iot_name_id: '609146', tag: 0, iot_map_id: 0, iot_name: 'Kitchen' },
        { id: 17, globalId: 1457889, iot_name_id: '1457889', tag: 0, iot_map_id: 0, iot_name: 'Bathroom' },
        { id: 18, globalId: 612202, iot_name_id: '612202', tag: 0, iot_map_id: 0, iot_name: 'Hallway' },
        { id: 19, globalId: 1458155, iot_name_id: '1458155', tag: 0, iot_map_id: 0, iot_name: 'Dining room' },
        { id: 20, globalId: 1457888, iot_name_id: '1457888', tag: 0, iot_map_id: 0, iot_name: 'Living room' },
        { id: 21, globalId: 1459580, iot_name_id: '1459580', tag: 0, iot_map_id: 0, iot_name: "BBB's room" },
        { id: 22, globalId: 612205, iot_name_id: '612205', tag: 0, iot_map_id: 0, iot_name: "CCC's Room" },
        { id: 23, globalId: 1474466, iot_name_id: '1474466', tag: 0, iot_map_id: 0, iot_name: 'Outside' },
      ]),
      false, // enableMultipleMap
      mockLogger as any,
    );

    expect(supportedAreas.length).toEqual(8);
  });

  it('returns default area when rooms and roomMap are empty (case 2)', () => {
    const { supportedAreas } = getSupportedAreas(
      [
        { id: 11453731, name: 'Living room' },
        { id: 11453727, name: 'Kitchen' },
        { id: 11453415, name: 'Bathroom' },
        { id: 11453409, name: "Emile's Room" },
        { id: 11453404, name: "Nadia's Room" },
        { id: 11453398, name: 'Hallway' },
        { id: 11453391, name: 'Dining room' },
        { id: 11453384, name: 'Outside' },
      ],
      new RoomMap([
        { id: 16, globalId: 2775739, iot_name_id: '2775739', tag: 0, iot_map_id: 0, iot_name: '' },
        { id: 17, globalId: 991195, iot_name_id: '991195', tag: 0, iot_map_id: 0, iot_name: '' },
        { id: 18, globalId: 991187, iot_name_id: '991187', tag: 0, iot_map_id: 0, iot_name: '' },
        { id: 19, globalId: 991185, iot_name_id: '991185', tag: 0, iot_map_id: 0, iot_name: '' },
        { id: 20, globalId: 991190, iot_name_id: '991190', tag: 0, iot_map_id: 0, iot_name: '' },
      ]),
      false, // enableMultipleMap
      mockLogger as any,
    );

    expect(supportedAreas.length).toEqual(5);
  });

  it('returns default area when rooms and roomMap are empty (case 3)', () => {
    const { supportedAreas } = getSupportedAreas(
      [
        { id: 11453731, name: 'Living room' },
        { id: 11453727, name: 'Kitchen' },
        { id: 11453415, name: 'Bathroom' },
        { id: 11453409, name: "Emile's Room" },
        { id: 11453404, name: "Nadia's Room" },
        { id: 11453398, name: 'Hallway' },
        { id: 11453391, name: 'Dining room' },
        { id: 11453384, name: 'Outside' },
      ],
      new RoomMap([
        { id: 16, globalId: 2775739, iot_name_id: '2775739', tag: 0, iot_map_id: 0, iot_name: '' },
        { id: 17, globalId: 991195, iot_name_id: '991195', tag: 0, iot_map_id: 0, iot_name: '' },
        { id: 18, globalId: 991187, iot_name_id: '991187', tag: 0, iot_map_id: 0, iot_name: '' },
        { id: 19, globalId: 991185, iot_name_id: '991185', tag: 0, iot_map_id: 0, iot_name: '' },
        { id: 20, globalId: 991190, iot_name_id: '991190', tag: 0, iot_map_id: 0, iot_name: '' },
      ]),
      false, // enableMultipleMap
      mockLogger as any,
    );

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
      { id: 16, globalId: 2775739, iot_name_id: '2775739', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 17, globalId: 991195, iot_name_id: '991195', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 18, globalId: 991187, iot_name_id: '991187', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 19, globalId: 991185, iot_name_id: '991185', tag: 0, iot_map_id: 0, iot_name: '' },
      { id: 20, globalId: 991190, iot_name_id: '991190', tag: 0, iot_map_id: 0, iot_name: '' },
    ]);
    const { supportedAreas } = getSupportedAreas(vacuumRooms, roomMap, false, mockLogger as any);

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
      { id: 1, globalId: 11100845, iot_name_id: '11100845', tag: 14, iot_map_id: 0, iot_name: 'Kitchen' },
      { id: 2, globalId: 11100849, iot_name_id: '11100849', tag: 9, iot_map_id: 0, iot_name: 'Study' },
      { id: 3, globalId: 11100842, iot_name_id: '11100842', tag: 6, iot_map_id: 0, iot_name: 'Living room' },
      { id: 4, globalId: 11100847, iot_name_id: '11100847', tag: 1, iot_map_id: 0, iot_name: 'Bedroom' },
      { id: 1, globalId: 11100842, iot_name_id: '11100842', tag: 6, iot_map_id: 1, iot_name: 'Living room' },
      { id: 2, globalId: 12461114, iot_name_id: '12461114', tag: 3, iot_map_id: 1, iot_name: 'Guest bedroom' },
      { id: 3, globalId: 12461109, iot_name_id: '12461109', tag: 2, iot_map_id: 1, iot_name: 'Master bedroom' },
      { id: 4, globalId: 12461111, iot_name_id: '12461111', tag: 7, iot_map_id: 1, iot_name: 'Balcony' },
    ]);

    const mockLogger1 = {
      debug: vi.fn(),
      notice: vi.fn(),
      error: vi.fn(),
    };
    const { supportedAreas, supportedMaps } = getSupportedAreas(vacuumRooms, roomMap, true, mockLogger1 as any, [
      { id: 0, name: 'First Map', rooms: [] },
      { id: 1, name: 'Second Map', rooms: [] },
    ]);
    expect(supportedAreas.length).toEqual(8);
    expect(supportedMaps.length).toEqual(2);
  });
});
