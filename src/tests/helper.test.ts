import { getVacuumProperty, isSupportedDevice, isStatusUpdate } from '../share/helper.js';
import { MapInfo, RoomMap } from '../core/application/models/index.js';
import { describe, it, test, expect, vi, beforeEach } from 'vitest';
import { MultipleMapDto } from '../roborockCommunication/models/index.js';

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

  test('RoomMap.fromDevice handles missing robot and missing roborockService', async () => {
    const platform: any = {
      robots: new Map(),
      enableExperimentalFeature: undefined,
      log: { error: vi.fn(), info: vi.fn() },
      configManager: { isMultipleMapEnabled: false },
      registry: {
        getRobot: vi.fn(() => undefined),
        robotsMap: new Map(),
      },
    };
    const res = await RoomMap.fromDevice('nope', platform);
    expect(res).not.toBeUndefined();
    expect(platform.log.error).toHaveBeenCalled();

    // robot present but no service
    const robot: any = { device: { duid: 'd1', rooms: [] } };
    platform.robots.set('d1', robot);
    platform.registry.getRobot.mockReturnValueOnce(robot);
    const res2 = await RoomMap.fromDevice('d1', platform);
    expect(res2).not.toBeUndefined();
  });

  test('RoomMap.fromDeviceDirect returns RoomMap variants (case 1)', async () => {
    const device: any = { duid: 'd2', rooms: [] };
    const platform: any = {
      enableExperimentalFeature: undefined,
      log: { debug: vi.fn(), notice: vi.fn() },
      configManager: { isMultipleMapEnabled: false },
      roborockService: {
        getMapInfo: async () => ({ allRooms: [{ id: 1, iot_name_id: '1', tag: 0, mapId: 0, displayName: 'R1' }], maps: [] }),
        getRoomMap: async () => new RoomMap([]),
      },
    };

    const rmap = await RoomMap.fromDeviceDirect(device, platform);
    expect(rmap).toBeDefined();

    // when no map info but room mappings present
    const platform2: any = {
      enableExperimentalFeature: undefined,
      log: { debug: vi.fn(), notice: vi.fn() },
      configManager: { isMultipleMapEnabled: false },
      roborockService: {
        getMapInfo: async () =>
          new MapInfo({
            max_multi_map: 1,
            max_bak_map: 5,
            multi_map_count: 1,
            map_info: [],
          } satisfies MultipleMapDto),
        getRoomMap: async () => new RoomMap([]),
      },
    };
    const rmap2 = await RoomMap.fromDeviceDirect(device, platform2);
    expect(rmap2).toBeDefined();

    // when neither present returns empty RoomMap
    const platform3: any = {
      enableExperimentalFeature: undefined,
      log: { debug: vi.fn(), notice: vi.fn() },
      configManager: { isMultipleMapEnabled: false },
      roborockService: {
        getMapInfo: async () =>
          new MapInfo({
            max_multi_map: 1,
            max_bak_map: 5,
            multi_map_count: 1,
            map_info: [],
          } satisfies MultipleMapDto),
        getRoomMap: async () => new RoomMap([]),
      },
    };
    const rmap3 = await RoomMap.fromDeviceDirect(device, platform3);
    expect(rmap3).toBeDefined();
  });
});

const mockLog = {
  notice: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  verbose: vi.fn(),
};

const mockRoborockService = {
  getRoomMap: vi.fn(),
  getMapInfo: vi.fn(),
};

const mockPlatform = {
  log: mockLog,
  roborockService: mockRoborockService,
  configManager: { isMultipleMapEnabled: false },
};

describe('RoomMap.fromDeviceDirect', () => {
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
    mockRoborockService.getRoomMap.mockResolvedValue(
      new RoomMap([
        {
          id: 1,
          iot_name_id: '1',
          tag: 14,
          iot_map_id: 0,
          iot_name: 'Kitchen',
        },
        {
          id: 2,
          iot_name_id: '2',
          tag: 9,
          iot_map_id: 0,
          iot_name: 'Study',
        },
        {
          id: 3,
          iot_name_id: '3',
          tag: 6,
          iot_map_id: 0,
          iot_name: 'Living room',
        },
        {
          id: 4,
          iot_name_id: '4',
          tag: 1,
          iot_map_id: 0,
          iot_name: 'Bedroom',
        },
      ]),
    );
    mockRoborockService.getMapInfo.mockResolvedValue(
      new MapInfo({
        max_multi_map: 1,
        max_bak_map: 5,
        multi_map_count: 1,
        map_info: [],
      } satisfies MultipleMapDto),
    );

    const result = await RoomMap.fromDeviceDirect(device as any, mockPlatform as any);

    expect(result).toBeInstanceOf(RoomMap);
    expect(mockRoborockService.getRoomMap).toHaveBeenCalledWith('123', 1, device.rooms);
  });

  it('returns RoomMap from getRoomMap if available (case 2)', async () => {
    const device = {
      duid: '123',
      rooms: [
        { id: 1, name: 'Kitchen' },
        { id: 2, name: 'Study' },
        { id: 3, name: 'Living room' },
        { id: 4, name: 'Bedroom' },
      ],
    };
    mockRoborockService.getRoomMap.mockResolvedValue(
      new RoomMap([
        {
          id: 1,
          iot_name_id: '1',
          tag: 14,
          iot_map_id: 0,
          iot_name: 'Kitchen',
        },
        {
          id: 2,
          iot_name_id: '2',
          tag: 9,
          iot_map_id: 0,
          iot_name: 'Study',
        },
        {
          id: 3,
          iot_name_id: '3',
          tag: 6,
          iot_map_id: 0,
          iot_name: 'Living room',
        },
        {
          id: 4,
          iot_name_id: '4',
          tag: 1,
          iot_map_id: 0,
          iot_name: 'Bedroom',
        },
      ]),
    );
    mockRoborockService.getMapInfo.mockResolvedValue(
      new MapInfo({
        max_multi_map: 1,
        max_bak_map: 5,
        multi_map_count: 1,
        map_info: [],
      } satisfies MultipleMapDto),
    );

    const result = await RoomMap.fromDeviceDirect(device as any, mockPlatform as any);

    expect(result).toBeInstanceOf(RoomMap);
    expect(mockRoborockService.getRoomMap).toHaveBeenCalledWith('123', 1, device.rooms);
  });

  it('returns RoomMap from getMapInfo if available', async () => {
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
    mockRoborockService.getRoomMap.mockResolvedValue(new RoomMap([]));
    mockRoborockService.getMapInfo.mockResolvedValue(
      new MapInfo({
        max_multi_map: 2,
        max_bak_map: 5,
        multi_map_count: 2,
        map_info: [
          {
            mapFlag: 0,
            name: 'First Map',
            add_time: 1697059200,
            length: 4,
            bak_maps: [{ mapFlag: 2, add_time: 1697145600 }],
            rooms: [
              { id: 1, globalId: 11100845, iot_name_id: '11100845', tag: 14, iot_name: 'Kitchen' },
              { id: 2, globalId: 11100849, iot_name_id: '11100849', tag: 9, iot_name: 'Study' },
              { id: 3, globalId: 11100842, iot_name_id: '11100842', tag: 6, iot_name: 'Living room' },
              { id: 4, globalId: 11100847, iot_name_id: '11100847', tag: 1, iot_name: 'Bedroom' },
            ],
          },
          {
            mapFlag: 1,
            name: 'Second Map',
            add_time: 1697145600,
            length: 5,
            bak_maps: [],
            rooms: [
              { id: 1, globalId: 12469150, iot_name_id: '12469150', tag: 13, iot_name: 'Dining room' },
              { id: 2, globalId: 12461114, iot_name_id: '12461114', tag: 3, iot_name: 'Guest bedroom' },
              { id: 3, globalId: 12461109, iot_name_id: '12461109', tag: 2, iot_name: 'Master bedroom' },
              { id: 4, globalId: 12461111, iot_name_id: '12461111', tag: 7, iot_name: 'Balcony' },
              { id: 5, globalId: 11100842, iot_name_id: '11100842', tag: 6, iot_name: 'Living room' },
            ],
          },
        ],
      } satisfies MultipleMapDto),
    );

    const result = await RoomMap.fromDeviceDirect(device as any, mockPlatform as any);
    expect(result).toBeInstanceOf(RoomMap);
    expect(mockRoborockService.getMapInfo).toHaveBeenCalledWith('123');
  });
});
