import { getRoomMapFromDevice } from '../helper';
import { RoomMap } from '../model/RoomMap';

const mockLog = {
  notice: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  verbose: jest.fn(),
};

const mockRoborockService = {
  getRoomMappings: jest.fn(),
  getMapInformation: jest.fn(),
};

const mockPlatform = {
  log: mockLog,
  roborockService: mockRoborockService,
};

describe('getRoomMapFromDevice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns RoomMap from getRoomMappings if available', async () => {
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

  it('returns RoomMap from getRoomMappings if available', async () => {
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
