import { RoomMap, MapInfo } from '../core/application/models/index.js';
import { Device, RawRoomMappingData, Home, RoomDto, MultipleMapDto } from '../roborockCommunication/models/index.js';
import { DeviceModel } from '../roborockCommunication/models/deviceModel.js';
import { DeviceCategory } from '../roborockCommunication/models/deviceCategory.js';
import { UserData } from '../roborockCommunication/models/userData.js';
import { RoomEntity } from '../core/domain/entities/Room.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { asPartial, createMockLogger } from './testUtils.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { RoborockService } from '../services/roborockService.js';
import { PlatformConfigManager } from '../platform/platformConfigManager.js';
import { DeviceRegistry } from '../platform/deviceRegistry.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';

describe('PlatformRunner.getRoomMapFromDevice', () => {
  let platform: RoborockMatterbridgePlatform;
  let registry: DeviceRegistry;
  let roborockService: RoborockService;

  beforeEach(() => {
    // Mock registry with robotsMap and getRobot
    const robots = new Map<string, RoborockVacuumCleaner>();
    registry = asPartial<DeviceRegistry>({
      robotsMap: robots,
      getRobot: (duid: string) => robots.get(duid),
    });
    // Mock configManager with isMultipleMapEnabled
    const configManager = {
      get isMultipleMapEnabled() {
        return false;
      },
    };
    platform = asPartial<RoborockMatterbridgePlatform>({
      log: createMockLogger(),
      roborockService: (roborockService = asPartial<RoborockService>({
        getRoomMap: vi.fn(),
        getMapInfo: vi.fn(),
      })),
      registry: registry,
      configManager: asPartial<PlatformConfigManager>(configManager),
    });
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
      schema: [],
      specs: {
        id: 'duid1',
        firmwareVersion: '1.0',
        serialNumber: 'SN1',
        model: DeviceModel.QREVO_EDGE_5V1,
        category: DeviceCategory.VacuumCleaner,
        batteryLevel: 100,
        hasRealTimeConnection: true,
      },
      store: {
        userData,
        localKey: 'lk',
        pv: '1.0',
        model: DeviceModel.QREVO_EDGE_5V1,
        homeData: {
          id: 1,
          name: 'Test Home',
          products: [],
          devices: [],
          receivedDevices: [],
          rooms: [new RoomEntity(1, 'Kitchen'), new RoomEntity(2, 'Study'), new RoomEntity(3, 'Living room'), new RoomEntity(4, 'Bedroom')],
        } satisfies Home,
      },
      mapInfos: undefined,
    };
    const robot = asPartial<RoborockVacuumCleaner>({
      device,
    });

    registry.robotsMap.set(device.duid, robot);

    const roomData = [
      [1, '11100845', 14],
      [2, '11100849', 9],
      [3, '11100842', 6],
      [4, '11100847', 1],
    ] as Partial<RawRoomMappingData> as RawRoomMappingData;

    vi.mocked(roborockService.getRoomMap).mockResolvedValue(roomData);

    vi.mocked(roborockService.getMapInfo).mockResolvedValue(
      new MapInfo({
        max_multi_map: 1,
        max_bak_map: 1,
        multi_map_count: 1,
        map_info: [],
      }),
    );

    const { roomMap } = await RoomMap.fromMapInfo(device, platform);

    expect(roomMap).toBeInstanceOf(RoomMap);
    expect(roomMap.rooms.length).toEqual(4);
  });

  it('returns RoomMap with roomData from getMapInfo if available (case 1)', async () => {
    const homeData: Home = {
      id: 1,
      name: 'Test Home',
      products: [],
      devices: [],
      receivedDevices: [],
      rooms: [new RoomEntity(1, 'Kitchen'), new RoomEntity(2, 'Study'), new RoomEntity(3, 'Living room'), new RoomEntity(4, 'Bedroom')],
    };
    const device = asPartial<Device>({
      duid: 'duid1',
      store: asPartial<Device['store']>({ homeData }),
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

    vi.mocked(roborockService.getRoomMap).mockResolvedValue([]);
    vi.mocked(roborockService.getMapInfo).mockResolvedValue(mapInfo);

    const { roomMap } = await RoomMap.fromMapInfo(device, platform);
    expect(roomMap).toBeInstanceOf(RoomMap);
    // expect(roomMap.rooms.length).toEqual(4);

    const { roomMap: roomMap1 } = await RoomMap.fromMapInfo(device, platform);
    expect(roomMap1).toBeInstanceOf(RoomMap);
    // expect(roomMap1.rooms.length).toEqual(4);
  });

  it('returns RoomMap with empty roomData from getMapInformation if available', async () => {
    const homeData: Home = {
      id: 1,
      name: 'Test Home',
      products: [],
      devices: [],
      receivedDevices: [],
      rooms: [new RoomEntity(1, 'Kitchen'), new RoomEntity(2, 'Study'), new RoomEntity(3, 'Living room'), new RoomEntity(4, 'Bedroom')],
    };
    const device = asPartial<Device>({
      duid: 'duid1',
      store: asPartial<Device['store']>({ homeData }),
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

    vi.mocked(roborockService.getRoomMap).mockResolvedValue([]);
    vi.mocked(roborockService.getMapInfo).mockResolvedValue(mapInfo);

    const { roomMap } = await RoomMap.fromMapInfo(device, platform);
    expect(roomMap).toBeInstanceOf(RoomMap);
    // expect(roomMap.rooms.length).toEqual(0);

    const { roomMap: roomMap1 } = await RoomMap.fromMapInfo(device, platform);
    expect(roomMap1).toBeInstanceOf(RoomMap);
    // expect(roomMap1.rooms.length).toEqual(0);
  });

  it('returns RoomMap with roomData from getMapInformation if available', async () => {
    const homeData: Home = {
      id: 1,
      name: 'Test Home',
      products: [],
      devices: [],
      receivedDevices: [],
      rooms: [new RoomEntity(1, 'Kitchen'), new RoomEntity(2, 'Study'), new RoomEntity(3, 'Living room'), new RoomEntity(4, 'Bedroom')],
    };
    const device = asPartial<Device>({
      duid: 'duid1',
      store: asPartial<Device['store']>({ homeData }),
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
    ] as Partial<RawRoomMappingData> as RawRoomMappingData;

    vi.mocked(roborockService.getRoomMap).mockResolvedValue(roomData);
    vi.mocked(roborockService.getMapInfo).mockResolvedValue(mapInfo);

    const { roomMap } = await RoomMap.fromMapInfo(device, platform);
    expect(roomMap).toBeInstanceOf(RoomMap);
    // expect(roomMap.rooms.length).toEqual(4);

    const { roomMap: roomMap1 } = await RoomMap.fromMapInfo(device, platform);
    expect(roomMap1).toBeInstanceOf(RoomMap);
    // expect(roomMap1.rooms.length).toEqual(4);
  });

  it('handles undefined tag in room data from getMapInfo', async () => {
    const homeData: Home = {
      id: 1,
      name: 'Test Home',
      products: [],
      devices: [],
      receivedDevices: [],
      rooms: [new RoomEntity(16, 'Garage')],
    };
    const device = asPartial<Device>({
      duid: 'duid1',
      store: asPartial<Device['store']>({ homeData }),
    });
    const mapInfo = asPartial<MapInfo>({
      allRooms: [
        {
          id: 16,
          tag: 1,
          iot_name_id: '12231095',
          iot_name: 'Garage',
          iot_map_id: 0,
        },
      ],
      maps: [],
    });

    vi.mocked(roborockService.getRoomMap).mockResolvedValue([]);
    vi.mocked(roborockService.getMapInfo).mockResolvedValue(mapInfo);

    const { roomMap } = await RoomMap.fromMapInfo(device, platform);

    expect(roomMap).toBeDefined();
    // expect(roomMap).toBeInstanceOf(RoomMap);
    // expect(roomMap.rooms.length).toEqual(1);
    // expect(roomMap.rooms[0].alternativeId).toEqual('16'); // Should be just the id when tag is undefined
  });

  it('real test 1', async () => {
    const homeData: Home = {
      id: 1,
      name: 'Test Home',
      products: [],
      devices: [],
      receivedDevices: [],
      rooms: [
        new RoomEntity(39432524, 'Dining Room'),
        new RoomEntity(39432521, 'Living Room'),
        new RoomEntity(39432517, 'Boiler Room'),
        new RoomEntity(39432514, 'Storage Room'),
        new RoomEntity(39432512, 'Guest Toilet'),
        new RoomEntity(39431381, 'Default'),
        new RoomEntity(39431356, 'Storage room'),
        new RoomEntity(39431312, 'Dining room'),
        new RoomEntity(39431270, 'Boiler room'),
        new RoomEntity(39431236, 'Guest toilet'),
        new RoomEntity(11830052, 'Living room'),
        new RoomEntity(11830055, 'Kitchen'),
        new RoomEntity(11830066, 'Corridor'),
        new RoomEntity(11830062, 'Bathroom'),
        new RoomEntity(11830057, 'Bedroom'),
      ],
    };
    const device = asPartial<Device>({
      duid: 'duid1',
      store: asPartial<Device['store']>({ homeData }),
    });
    const mapInfo = asPartial<MapInfo>({
      allRooms: [],
      maps: [],
    });

    vi.mocked(roborockService.getMapInfo).mockResolvedValue(mapInfo);

    const roomMapData = [
      [16, '39432521', 6],
      [17, '11830055', 14],
      [18, '11830066', 8],
      [19, '39432517', 12],
      [20, '39432514', 13],
      [21, '39432512', 15],
      [22, '39432524', 13],
    ];

    vi.mocked(roborockService.getRoomMap).mockResolvedValue(roomMapData as Partial<RawRoomMappingData> as RawRoomMappingData);

    const { roomMap } = await RoomMap.fromMapInfo(device, platform);
    const expectedRoomMap = new RoomMap([
      {
        id: 16,
        iot_name_id: '39432521',
        tag: 6,
        iot_map_id: 0,
        iot_name: 'Living Room',
      },
      {
        id: 17,
        iot_name_id: '11830055',
        tag: 14,
        iot_map_id: 0,
        iot_name: 'Kitchen',
      },
      {
        id: 18,
        iot_name_id: '11830066',
        tag: 8,
        iot_map_id: 0,
        iot_name: 'Corridor',
      },
      {
        id: 19,
        iot_name_id: '39432517',
        tag: 12,
        iot_map_id: 0,
        iot_name: 'Boiler Room',
      },
      {
        id: 20,
        iot_name_id: '39432514',
        tag: 13,
        iot_map_id: 0,
        iot_name: 'Storage Room',
      },
      {
        id: 21,
        iot_name_id: '39432512',
        tag: 15,
        iot_map_id: 0,
        iot_name: 'Guest Toilet',
      },
      {
        id: 22,
        iot_name_id: '39432524',
        tag: 13,
        iot_map_id: 0,
        iot_name: 'Dining Room',
      },
    ]);

    expect(roomMap).toEqual(expectedRoomMap);
  });

  it('real test 2', async () => {
    const vacuumRooms: RoomDto[] = [
      new RoomEntity(11100845, 'Kitchen'),
      new RoomEntity(11100849, 'Study'),
      new RoomEntity(11100842, 'Living room'),
      new RoomEntity(11100847, 'Bedroom'),
      new RoomEntity(12461114, 'Guest bedroom'),
      new RoomEntity(12461109, 'Master bedroom'),
      new RoomEntity(12461111, 'Balcony'),
    ];
    const homeData: Home = {
      id: 1,
      name: 'Test Home',
      products: [],
      devices: [],
      receivedDevices: [],
      rooms: vacuumRooms,
    };
    const device = asPartial<Device>({
      duid: 'duid1',
      store: asPartial<Device['store']>({ homeData }),
    });

    const mapInfo = new MapInfo(
      asPartial<MultipleMapDto>({
        max_multi_map: 4,
        max_bak_map: 1,
        multi_map_count: 2,
        map_info: [
          {
            mapFlag: 0,
            add_time: 1753511673,
            length: 0,
            name: '',
            bak_maps: [
              {
                mapFlag: 4,
                add_time: 1753578164,
              },
            ],
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
            add_time: 1753579596,
            length: 0,
            name: '',
            bak_maps: [
              {
                mapFlag: 5,
                add_time: 1753578579,
              },
            ],
            rooms: [
              {
                id: 1,
                tag: 6,
                iot_name_id: '11100842',
                iot_name: 'Living room',
              },
              {
                id: 2,
                tag: 3,
                iot_name_id: '12461114',
                iot_name: 'Guest bedroom',
              },
              {
                id: 3,
                tag: 2,
                iot_name_id: '12461109',
                iot_name: 'Master bedroom',
              },
              {
                id: 4,
                tag: 7,
                iot_name_id: '12461111',
                iot_name: 'Balcony',
              },
            ],
            furnitures: [],
          },
        ],
      }),
    );

    vi.mocked(roborockService.getMapInfo).mockResolvedValue(mapInfo);

    const roomData = [
      [1, '11100845', 14],
      [2, '11100849', 9],
      [3, '11100842', 6],
      [4, '11100847', 1],
    ] as Partial<RawRoomMappingData> as RawRoomMappingData;

    vi.mocked(roborockService.getRoomMap).mockResolvedValue(roomData);

    const { mapInfo: mapInfoResponse, roomMap } = await RoomMap.fromMapInfo(device, platform);

    expect(mapInfoResponse).toBeInstanceOf(MapInfo);
    expect(roomMap).toBeInstanceOf(RoomMap);
    expect(roomMap.rooms.length).toEqual(8);

    // console.log('mapInfoResponse:', JSON.stringify(mapInfoResponse, null, 2));
    // console.log('roomMap:', JSON.stringify(roomMap, null, 2));
  });
});
