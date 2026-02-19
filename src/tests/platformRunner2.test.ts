import { getRoomMapFromDevice } from '../helper';
import { RoomMap } from '../model/RoomMap';
import { MapInfo } from '../roborockCommunication';

describe('PlatformRunner.getRoomMapFromDevice', () => {
  let platform: any;

  beforeEach(() => {
    platform = {
      log: {
        error: jest.fn(),
        debug: jest.fn(),
        notice: jest.fn(),
      },
      roborockService: {
        getRoomMappings: jest.fn(),
        getMapInformation: jest.fn(),
      },
    };
  });

  it('returns RoomMap with roomData from getRoomMappings if available', async () => {
    const device = {
      duid: 'duid1',
      rooms: [
        { id: 1, name: 'Kitchen' },
        { id: 2, name: 'Study' },
        { id: 3, name: 'Living room' },
        { id: 4, name: 'Bedroom' },
      ],
    };
    const roomData = [
      [1, '11100845', 14],
      [2, '11100849', 9],
      [3, '11100842', 6],
      [4, '11100847', 1],
    ];

    platform.roborockService.getRoomMappings.mockResolvedValue(roomData);
    platform.roborockService.getMapInformation.mockResolvedValue(undefined);

    const result = await getRoomMapFromDevice(device as any, platform);

    expect(result).toBeInstanceOf(RoomMap);
    expect(result.rooms.length).toEqual(4);
  });

  it('returns RoomMap with roomData from getMapInformation if available', async () => {
    const device = {
      duid: 'duid1',
      rooms: [
        { id: 1, name: 'Kitchen' },
        { id: 2, name: 'Study' },
        { id: 3, name: 'Living room' },
        { id: 4, name: 'Bedroom' },
      ],
    };

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
            { id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Kitchen' },
            { id: 2, tag: 9, iot_name_id: '11100849', iot_name: 'Study' },
            {
              id: 3,
              tag: 6,
              iot_name_id: '11100842',
              iot_name: 'Living room',
            },
            { id: 4, tag: 1, iot_name_id: '11100847', iot_name: 'Bedroom' },
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
            { id: 4, tag: 7, iot_name_id: '12461111', iot_name: 'Balcony' },
          ],
        },
      ],
    });

    platform.roborockService.getRoomMappings.mockResolvedValue(undefined);
    platform.roborockService.getMapInformation.mockResolvedValue(mapInfo);

    const result = await getRoomMapFromDevice(device as any, platform);
    expect(result).toBeInstanceOf(RoomMap);
    expect(result.rooms.length).toEqual(8);
  });
});
