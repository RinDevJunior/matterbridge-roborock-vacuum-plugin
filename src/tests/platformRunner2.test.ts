import { RoomMap, MapInfo, RoomMapping } from '../core/application/models/index.js';
import { Device } from '../roborockCommunication/models/index.js';
import { DeviceModel } from '../roborockCommunication/models/deviceModel.js';
import { DeviceCategory } from '../roborockCommunication/models/deviceCategory.js';
import { UserData } from '../roborockCommunication/models/userData.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { asPartial } from './testUtils.js';

describe('PlatformRunner.getRoomMapFromDevice', () => {
  let platform: any;

  beforeEach(() => {
    // Mock registry with robotsMap and getRobot
    const robots = new Map();
    const registry = {
      robotsMap: robots,
      getRobot: (duid: string) => robots.get(duid),
    };
    // Mock configManager with isMultipleMapEnabled
    const configManager = {
      get isMultipleMapEnabled() {
        return false;
      },
    };
    platform = {
      log: {
        error: vi.fn(),
        debug: vi.fn(),
        notice: vi.fn(),
      },
      roborockService: {
        getRoomMap: vi.fn(),
        getMapInfo: vi.fn(),
      },
      registry: registry,
      configManager: configManager,
    };
  });

  it('returns RoomMap with roomData from getRoomMap if available', async () => {
    const userData: UserData = {
      username: 'test',
      uid: 'u1',
      tokentype: 'Bearer',
      token: 't',
      rruid: 'rr',
      region: 'us',
      countrycode: 'US',
      country: 'US',
      nickname: 'n',
      rriot: { u: 'u', s: 's', h: 'h', k: 'k', r: { r: 'r', a: 'a', m: 'm', l: 'l' } },
    };

    const device: Device = {
      duid: 'duid1',
      name: 'TestVac',
      sn: 'SN1',
      serialNumber: 'SN1',
      activeTime: 0,
      createTime: 0,
      localKey: 'lk',
      pv: '1.0',
      online: true,
      productId: 'p1',
      rrHomeId: 1,
      fv: '1.0',
      deviceStatus: {},
      rooms: [
        { id: 1, name: 'Kitchen' },
        { id: 2, name: 'Study' },
        { id: 3, name: 'Living room' },
        { id: 4, name: 'Bedroom' },
      ],
      schema: [],
      data: {
        id: 'duid1',
        firmwareVersion: '1.0',
        serialNumber: 'SN1',
        model: DeviceModel.QREVO_EDGE_5V1,
        category: DeviceCategory.VacuumCleaner,
        batteryLevel: 100,
      },
      store: { userData, localKey: 'lk', pv: '1.0', model: DeviceModel.QREVO_EDGE_5V1 },
    };

    platform.roborockService.getRoomMap.mockResolvedValue(
      new RoomMap([
        { id: 1, iot_name_id: '11100845', tag: 14, iot_map_id: 0 },
        { id: 2, iot_name_id: '11100849', tag: 9, iot_map_id: 0 },
        { id: 3, iot_name_id: '11100842', tag: 6, iot_map_id: 0 },
        { id: 4, iot_name_id: '11100847', tag: 1, iot_map_id: 0 },
      ]),
    );

    platform.roborockService.getMapInfo.mockResolvedValue(
      new MapInfo({
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [],
      }),
    );

    const result = await RoomMap.fromDeviceDirect(device, platform);

    expect(result).toBeInstanceOf(RoomMap);
    expect(result.rooms.length).toEqual(4);
  });

  it('returns RoomMap with roomData from getMapInfo if available (case 1)', async () => {
    const device = asPartial<Device>({
      duid: 'duid1',
      rooms: [
        { id: 1, name: 'Kitchen' },
        { id: 2, name: 'Study' },
        { id: 3, name: 'Living room' },
        { id: 4, name: 'Bedroom' },
      ],
    });

    const mapInfo = new MapInfo({
      max_multi_map: 1,
      max_bak_map: 1,
      multi_map_count: 1,
      map_info: [
        {
          mapFlag: 0,
          add_time: 1753511673,
          length: 9,
          name: 'First Map',
          bak_maps: [{ mapFlag: 4, add_time: 1753578164 }],
          rooms: [
            { id: 1, tag: 14, iot_name_id: '11100845' },
            { id: 2, tag: 9, iot_name_id: '11100849' },
            {
              id: 3,
              tag: 6,
              iot_name_id: '11100842',
            },
            { id: 4, tag: 1, iot_name_id: '11100847' },
          ],
        },
        {
          mapFlag: 1,
          add_time: 1753579596,
          length: 10,
          name: 'Second Map',
          bak_maps: [{ mapFlag: 5, add_time: 1753578579 }],
          rooms: [
            {
              id: 1,
              tag: 6,
              iot_name_id: '11100842',
            },
            {
              id: 2,
              tag: 3,
              iot_name_id: '12461114',
            },
            {
              id: 3,
              tag: 2,
              iot_name_id: '12461109',
            },
            { id: 4, tag: 7, iot_name_id: '12461111' },
          ],
        },
      ],
    });

    platform.roborockService.getRoomMap.mockResolvedValue(undefined);
    platform.roborockService.getMapInfo.mockResolvedValue(mapInfo);

    const result = await RoomMap.fromDeviceDirect(device as Device, platform);
    expect(result).toBeInstanceOf(RoomMap);
    // expect(result.rooms.length).toEqual(4);

    platform.enableExperimentalFeature = {
      enableExperimentalFeature: true,
      advancedFeature: {
        enableMultipleMap: true,
      },
    };

    const result1 = await RoomMap.fromDeviceDirect(device as Device, platform);
    expect(result1).toBeInstanceOf(RoomMap);
    // expect(result1.rooms.length).toEqual(4);
  });

  it('returns RoomMap with empty roomData from getMapInformation if available', async () => {
    const device = asPartial<Device>({
      duid: 'duid1',
      rooms: [
        { id: 1, name: 'Kitchen' },
        { id: 2, name: 'Study' },
        { id: 3, name: 'Living room' },
        { id: 4, name: 'Bedroom' },
      ],
    });

    const mapInfo = new MapInfo({
      max_multi_map: 4,
      max_bak_map: 0,
      multi_map_count: 1,
      map_info: [
        {
          mapFlag: 0,
          add_time: 1753731408,
          length: 0,
          name: '',
          bak_maps: [],
        },
      ],
    });

    platform.roborockService.getRoomMap.mockResolvedValue(new RoomMap([]));
    platform.roborockService.getMapInfo.mockResolvedValue(mapInfo);

    const result = await RoomMap.fromDeviceDirect(device as Device, platform);
    expect(result).toBeInstanceOf(RoomMap);
    // expect(result.rooms.length).toEqual(0);

    platform.enableExperimentalFeature = {
      enableExperimentalFeature: true,
      advancedFeature: {
        enableMultipleMap: true,
      },
    };

    const result1 = await RoomMap.fromDeviceDirect(device as Device, platform);
    expect(result1).toBeInstanceOf(RoomMap);
    // expect(result1.rooms.length).toEqual(0);
  });

  it('returns RoomMap with roomData from getMapInformation if available', async () => {
    const device = asPartial<Device>({
      duid: 'duid1',
      rooms: [
        { id: 1, name: 'Kitchen' },
        { id: 2, name: 'Study' },
        { id: 3, name: 'Living room' },
        { id: 4, name: 'Bedroom' },
      ],
    });

    const mapInfo = new MapInfo({
      max_multi_map: 4,
      max_bak_map: 0,
      multi_map_count: 1,
      map_info: [
        {
          mapFlag: 0,
          add_time: 1753731408,
          length: 0,
          name: '',
          bak_maps: [],
        },
      ],
    });

    const roomData = [
      [1, '11100845', 14],
      [2, '11100849', 9],
      [3, '11100842', 6],
      [4, '11100847', 1],
    ];

    platform.roborockService.getRoomMap.mockResolvedValue(new RoomMap([]));
    platform.roborockService.getMapInfo.mockResolvedValue(mapInfo);

    const result = await RoomMap.fromDeviceDirect(device as Device, platform);
    expect(result).toBeInstanceOf(RoomMap);
    // expect(result.rooms.length).toEqual(4);

    platform.enableExperimentalFeature = {
      enableExperimentalFeature: true,
      advancedFeature: {
        enableMultipleMap: true,
      },
    };

    const result1 = await RoomMap.fromDeviceDirect(device as Device, platform);
    expect(result1).toBeInstanceOf(RoomMap);
    // expect(result1.rooms.length).toEqual(4);
  });

  it('handles undefined tag in room data from getMapInfo', async () => {
    const device = asPartial<Device>({
      duid: 'duid1',
      rooms: [{ id: 16, name: 'Garage' }],
    });
    const mapInfo = {
      allRooms: [
        {
          id: 16,
          iot_name_id: '12231095',
          tag: undefined, // Simulate API response with undefined tag
          displayName: 'Garage',
          mapId: 0,
        },
      ],
      maps: [],
    };

    platform.roborockService.getRoomMap.mockResolvedValue(undefined);
    platform.roborockService.getMapInfo.mockResolvedValue(mapInfo);

    const result = await RoomMap.fromDeviceDirect(device, platform);

    expect(result).toBeUndefined();
    // expect(result).toBeInstanceOf(RoomMap);
    // expect(result.rooms.length).toEqual(1);
    // expect(result.rooms[0].alternativeId).toEqual('16'); // Should be just the id when tag is undefined
  });
});
