import { getSupportedAreas } from '../../initialData/getSupportedAreas.js';
import { RoomMap } from '../../model/RoomMap.js';
import { describe, it, expect, beforeEach, vi, test } from 'vitest';
import type { Room } from '../../roborockCommunication/models/room.js';

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
    const rooms = [
      { id: 1, iot_name_id: '1', globalId: 1, tag: 0, mapId: null, displayName: undefined },
      { id: 1, iot_name_id: '1', globalId: 1, tag: 0, mapId: null, displayName: undefined },
    ];
    const roomMap: any = { rooms };
    const vacuumRooms = [{ id: 1, name: 'R1' }];
    const res = getSupportedAreas(vacuumRooms as any, roomMap, false, { error: vi.fn(), debug: vi.fn() } as any);
    expect(res.supportedAreas.length).toBe(1);
    expect(res.supportedAreas[0]?.areaInfo?.locationInfo?.locationName).toContain('Duplicated');
  });

  test('enableMultipleMap returns supportedMaps', () => {
    const vacuumRooms = [{ id: 1, name: 'R1' } as any];
    const roomMap: any = { rooms: [{ id: 10, iot_name_id: '10', globalId: 10, tag: 0, mapId: 7, displayName: 'RoomX' }], mapInfo: [{ id: 7, name: 'Level 7' }] };
    const res = getSupportedAreas(vacuumRooms as any, roomMap, true, { error: vi.fn(), debug: vi.fn() } as any);
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
        { id: 1459587, name: 'BBB’s Room' },
        { id: 1459580, name: 'CCC’s room' },
        { id: 1458155, name: 'Dining room' },
        { id: 1457889, name: 'Bathroom' },
        { id: 1457888, name: 'Living room' },
        { id: 991195, name: 'Downstairs Bathroom' },
        { id: 991190, name: 'Garage Entryway' },
        { id: 991187, name: 'TV Room' },
        { id: 991185, name: 'Bedroom' },
        { id: 612205, name: 'DDD’s Room' },
        { id: 612204, name: 'Upstairs Bathroom' },
        { id: 612202, name: 'Hallway' },
        { id: 612200, name: 'EEE Room' },
        { id: 609148, name: 'Dining Room' },
        { id: 609146, name: 'Kitchen' },
        { id: 609145, name: 'Living Room' },
      ],
      {
        rooms: [
          { id: 16, globalId: 609146, displayName: 'Kitchen' },
          { id: 17, globalId: 1457889, displayName: 'Bathroom' },
          { id: 18, globalId: 612202, displayName: 'Hallway' },
          { id: 19, globalId: 1458155, displayName: 'Dining room' },
          { id: 20, globalId: 1457888, displayName: 'Living room' },
          { id: 21, globalId: 1459580, displayName: 'BBB’s room' },
          { id: 22, globalId: 612205, displayName: 'CCC’s Room' },
          { id: 23, globalId: 1474466, displayName: 'Outside' },
        ],
      } as RoomMap,
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
        { id: 11453409, name: 'Emile’s Room' },
        { id: 11453404, name: 'Nadia’s Room' },
        { id: 11453398, name: 'Hallway' },
        { id: 11453391, name: 'Dining room' },
        { id: 11453384, name: 'Outside' },
      ],
      {
        rooms: [
          { id: 16, globalId: 2775739, displayName: '', alternativeId: '16' },
          { id: 17, globalId: 991195, displayName: '', alternativeId: '17' },
          { id: 18, globalId: 991187, displayName: '', alternativeId: '18' },
          { id: 19, globalId: 991185, displayName: '', alternativeId: '19' },
          { id: 20, globalId: 991190, displayName: '', alternativeId: '20' },
        ],
      } as any,
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
        { id: 11453409, name: 'Emile’s Room' },
        { id: 11453404, name: 'Nadia’s Room' },
        { id: 11453398, name: 'Hallway' },
        { id: 11453391, name: 'Dining room' },
        { id: 11453384, name: 'Outside' },
      ],
      {
        rooms: [
          { id: 16, globalId: 2775739, displayName: '', alternativeId: '16' },
          { id: 17, globalId: 991195, displayName: '', alternativeId: '17' },
          { id: 18, globalId: 991187, displayName: '', alternativeId: '18' },
          { id: 19, globalId: 991185, displayName: '', alternativeId: '19' },
          { id: 20, globalId: 991190, displayName: '', alternativeId: '20' },
        ],
      } as any,
      false, // enableMultipleMap
      mockLogger as any,
    );

    expect(supportedAreas.length).toEqual(5);
  });

  it('returns default area when rooms and roomMap are empty (case 4)', () => {
    const vacuumRooms: Room[] = [
      { id: 11100845, name: 'Kitchen' },
      { id: 11100849, name: 'Study' },
      { id: 11100842, name: 'Living room' },
      { id: 11100847, name: 'Bedroom' },
      { id: 12461114, name: 'Guest bedroom' },
      { id: 12461109, name: 'Master bedroom' },
      { id: 12461111, name: 'Balcony' },
    ];
    const roomMap: RoomMap = {
      rooms: [
        { id: 16, globalId: 2775739, displayName: '', alternativeId: '161' },
        { id: 17, globalId: 991195, displayName: '', alternativeId: '171' },
        { id: 18, globalId: 991187, displayName: '', alternativeId: '181' },
        { id: 19, globalId: 991185, displayName: '', alternativeId: '191' },
        { id: 20, globalId: 991190, displayName: '', alternativeId: '201' },
      ],
    };
    const { supportedAreas } = getSupportedAreas(vacuumRooms, roomMap, false, mockLogger as any);

    expect(supportedAreas.length).toEqual(5);
  });

  it('returns default area when rooms and roomMap are empty', () => {
    const vacuumRooms: Room[] = [
      { id: 11100845, name: 'Kitchen' },
      { id: 11100849, name: 'Study' },
      { id: 11100842, name: 'Living room' },
      { id: 11100847, name: 'Bedroom' },
      { id: 11100842, name: 'Living room' },
      { id: 12461114, name: 'Guest bedroom' },
      { id: 12461109, name: 'Master bedroom' },
      { id: 12461111, name: 'Balcony' },
    ];
    const roomMap: RoomMap = {
      rooms: [
        { id: 1, globalId: 11100845, displayName: 'Kitchen', alternativeId: '114', mapId: 0 },
        { id: 2, globalId: 11100849, displayName: 'Study', alternativeId: '29', mapId: 0 },
        { id: 3, globalId: 11100842, displayName: 'Living room', alternativeId: '36', mapId: 0 },
        { id: 4, globalId: 11100847, displayName: 'Bedroom', alternativeId: '41', mapId: 0 },
        { id: 1, globalId: 11100842, displayName: 'Living room', alternativeId: '16', mapId: 1 },
        { id: 2, globalId: 12461114, displayName: 'Guest bedroom', alternativeId: '23', mapId: 1 },
        { id: 3, globalId: 12461109, displayName: 'Master bedroom', alternativeId: '32', mapId: 1 },
        { id: 4, globalId: 12461111, displayName: 'Balcony', alternativeId: '47', mapId: 1 },
      ],
      mapInfo: [
        {
          id: 0,
          name: 'First Map',
        },
        {
          id: 1,
          name: 'Second Map',
        },
      ],
    };

    const mockLogger1 = {
      debug: vi.fn(),
      notice: vi.fn(),
      error: vi.fn(),
    };
    const { supportedAreas, supportedMaps } = getSupportedAreas(vacuumRooms, roomMap, true, mockLogger1 as any);
    expect(supportedAreas.length).toEqual(8);
    expect(supportedMaps.length).toEqual(2);
  });
});
