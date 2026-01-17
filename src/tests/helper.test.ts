import { describe, it, test, expect, vi, beforeEach } from 'vitest';
import { getVacuumProperty, isSupportedDevice, isStatusUpdate, getRoomMap, getRoomMapFromDevice } from '../helper.js';

describe('helper utilities', () => {
  test('getVacuumProperty returns undefined with no device', () => {
    expect(getVacuumProperty(undefined as any, 'p')).toBeUndefined();
  });

  test('getVacuumProperty reads via schema id and direct property', () => {
    const device: any = {
      schema: [{ code: 'prop', id: '1' }],
      deviceStatus: { '1': '42', prop2: '7' },
    };

    expect(getVacuumProperty(device, 'prop')).toBe(42);
    expect(getVacuumProperty(device, 'prop2')).toBe(7);
  });

  test('isSupportedDevice', () => {
    expect(isSupportedDevice('roborock.vacuum.s5')).toBe(true);
    expect(isSupportedDevice('other.model')).toBe(false);
  });

  test('isStatusUpdate positive and negative', () => {
    expect(isStatusUpdate([{ msg_ver: '1' }])).toBe(true);
    expect(isStatusUpdate([])).toBe(false);
    expect(isStatusUpdate([null as any])).toBe(false);
    expect(isStatusUpdate([{}])).toBe(false);
  });

  test('getRoomMap handles missing robot and missing roborockService', async () => {
    const platform: any = { robots: new Map(), enableExperimentalFeature: undefined, log: { error: vi.fn(), info: vi.fn() } };
    const res = await getRoomMap('nope', platform);
    expect(res).toBeUndefined();
    expect(platform.log.error).toHaveBeenCalled();

    // robot present but no service
    const robot: any = { device: { duid: 'd1', rooms: [] } };
    platform.robots.set('d1', robot);
    const res2 = await getRoomMap('d1', platform);
    expect(res2).toBeUndefined();
  });

  test('getRoomMapFromDevice returns RoomMap variants (case 1)', async () => {
    const device: any = { duid: 'd2', rooms: [] };
    const platform: any = {
      enableExperimentalFeature: undefined,
      log: { debug: vi.fn(), notice: vi.fn() },
      roborockService: {
        getMapInformation: async () => ({ allRooms: [{ id: 1, iot_name_id: '1', tag: 0, mapId: 0, displayName: 'R1' }], maps: [] }),
        getRoomMappings: async () => undefined,
      },
    };

    const rmap = await getRoomMapFromDevice(device, platform);
    expect(rmap).toBeDefined();

    // when no map info but room mappings present
    const platform2: any = {
      enableExperimentalFeature: undefined,
      log: { debug: vi.fn(), notice: vi.fn() },
      roborockService: { getMapInformation: async () => undefined, getRoomMappings: async () => [[1, 1, 0]] },
    };
    const rmap2 = await getRoomMapFromDevice(device, platform2);
    expect(rmap2).toBeDefined();

    // when neither present returns empty RoomMap
    const platform3: any = {
      enableExperimentalFeature: undefined,
      log: { debug: vi.fn(), notice: vi.fn() },
      roborockService: { getMapInformation: async () => undefined, getRoomMappings: async () => undefined },
    };
    const rmap3 = await getRoomMapFromDevice(device, platform3);
    expect(rmap3).toBeDefined();
  });
});
import { getRoomMapFromDevice } from '../helper';
import { RoomMap } from '../model/RoomMap';

const mockLog = {
  notice: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  verbose: vi.fn(),
};

const mockRoborockService = {
  getRoomMappings: vi.fn(),
  getMapInformation: vi.fn(),
};

const mockPlatform = {
  log: mockLog,
  roborockService: mockRoborockService,
};

describe('getRoomMapFromDevice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns RoomMap from getRoomMappings if available (case 1)', async () => {
    const device = {
      duid: '123',
      rooms: [
        {
          'id': 12461114,
          'name': 'Guest bedroom',
        },
        {
          'id': 12461111,
          'name': 'Balcony',
        },
        {
          'id': 12461109,
          'name': 'Master bedroom',
        },
        {
          'id': 11100849,
          'name': 'Study',
        },
        {
          'id': 11100847,
          'name': 'Bedroom',
        },
        {
          'id': 11100845,
          'name': 'Kitchen',
        },
        {
          'id': 11100842,
          'name': 'Living room',
        },
      ],
    };
    mockRoborockService.getRoomMappings.mockResolvedValue([
      [1, '11100842', 6],
      [2, '12461114', 3],
      [3, '12461109', 2],
      [4, '12461111', 7],
    ]);
    mockRoborockService.getMapInformation.mockResolvedValue(undefined);

    const result = await getRoomMapFromDevice(device as any, mockPlatform as any);

    // console.log('Result:', result);
    expect(result).toBeInstanceOf(RoomMap);
    expect(mockRoborockService.getRoomMappings).toHaveBeenCalledWith('123');
    expect(result.rooms.length).toBeGreaterThan(0);
  });

  it('returns RoomMap from getRoomMappings if available (case 2)', async () => {
    const device = {
      duid: '123',
      rooms: [
        { id: 1, name: 'Kitchen' },
        { id: 2, name: 'Study' },
        { id: 3, name: 'Living room' },
        { id: 4, name: 'Bedroom' },
      ],
    };
    mockRoborockService.getRoomMappings.mockResolvedValue([
      [1, '11100845', 14],
      [2, '11100849', 9],
      [3, '11100842', 6],
      [4, '11100847', 1],
    ]);
    mockRoborockService.getMapInformation.mockResolvedValue(undefined);

    const result = await getRoomMapFromDevice(device as any, mockPlatform as any);

    // console.log('Result:', result);
    expect(result).toBeInstanceOf(RoomMap);
    expect(mockRoborockService.getRoomMappings).toHaveBeenCalledWith('123');
    expect(result.rooms.length).toBeGreaterThan(0);
  });

  it('returns RoomMap from getMapInformation if available', async () => {
    const device = {
      duid: '123',
      rooms: [
        { id: 11100845, name: 'Kitchen' },
        { id: 11100849, name: 'Study' },
        { id: 11100842, name: 'Living room' },
        { id: 11100847, name: 'Bedroom' },
        { id: 12469150, name: 'Dining room' },
        { id: 12461114, name: 'Guest bedroom' },
        { id: 12461109, name: 'Master bedroom' },
        { id: 12461111, name: 'Balcony' },
        { id: 11100842, name: 'Living room' },
      ],
    };
    mockRoborockService.getRoomMappings.mockResolvedValue(undefined);
    mockRoborockService.getMapInformation.mockResolvedValue({
      maps: [
        {
          id: 0,
          name: 'First Map',
          rooms: [
            { id: 1, globalId: 11100845, iot_name_id: '11100845', tag: 14, displayName: 'Kitchen', mapId: 0 },
            { id: 2, globalId: 11100849, iot_name_id: '11100849', tag: 9, displayName: 'Study', mapId: 0 },
            { id: 3, globalId: 11100842, iot_name_id: '11100842', tag: 6, displayName: 'Living room', mapId: 0 },
            { id: 4, globalId: 11100847, iot_name_id: '11100847', tag: 1, displayName: 'Bedroom', mapId: 0 },
          ],
        },
        {
          id: 1,
          name: 'Second Map',
          rooms: [
            { id: 1, globalId: 12469150, iot_name_id: '12469150', tag: 13, displayName: 'Dining room', mapId: 1 },
            { id: 2, globalId: 12461114, iot_name_id: '12461114', tag: 3, displayName: 'Guest bedroom', mapId: 1 },
            { id: 3, globalId: 12461109, iot_name_id: '12461109', tag: 2, displayName: 'Master bedroom', mapId: 1 },
            { id: 4, globalId: 12461111, iot_name_id: '12461111', tag: 7, displayName: 'Balcony', mapId: 1 },
            { id: 5, globalId: 11100842, iot_name_id: '11100842', tag: 6, displayName: 'Living room', mapId: 1 },
          ],
        },
      ],
      allRooms: [
        { id: 1, globalId: 11100845, iot_name_id: '11100845', tag: 14, displayName: 'Kitchen', mapId: 0 },
        { id: 2, globalId: 11100849, iot_name_id: '11100849', tag: 9, displayName: 'Study', mapId: 0 },
        { id: 3, globalId: 11100842, iot_name_id: '11100842', tag: 6, displayName: 'Living room', mapId: 0 },
        { id: 4, globalId: 11100847, iot_name_id: '11100847', tag: 1, displayName: 'Bedroom', mapId: 0 },
        { id: 1, globalId: 12469150, iot_name_id: '12469150', tag: 13, displayName: 'Dining room', mapId: 1 },
        { id: 2, globalId: 12461114, iot_name_id: '12461114', tag: 3, displayName: 'Guest bedroom', mapId: 1 },
        { id: 3, globalId: 12461109, iot_name_id: '12461109', tag: 2, displayName: 'Master bedroom', mapId: 1 },
        { id: 4, globalId: 12461111, iot_name_id: '12461111', tag: 7, displayName: 'Balcony', mapId: 1 },
        { id: 5, globalId: 11100842, iot_name_id: '11100842', tag: 6, displayName: 'Living room', mapId: 1 },
      ],
    });

    const result = await getRoomMapFromDevice(device as any, mockPlatform as any);
    expect(result).toBeInstanceOf(RoomMap);
    expect(mockRoborockService.getMapInformation).toHaveBeenCalledWith('123');
    expect(result.rooms.length).toBeGreaterThan(0);
  });
});
