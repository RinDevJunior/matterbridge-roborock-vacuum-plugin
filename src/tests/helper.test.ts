import { getRoomMapFromDevice } from '../helper';
import { RoomMap } from '../model/RoomMap';

// Mocks
// const mockLog = {
//   notice: (message: string, ...arg: unknown[]) => console.log('NOTICE:', message, ...arg),
//   error: (message: string, ...arg: unknown[]) => console.error('ERROR:', message, ...arg),
//   debug: (message: string, ...arg: unknown[]) => console.debug('DEBUG:', message, ...arg),
//   info: (message: string, ...arg: unknown[]) => console.info('INFO:', message, ...arg),
//   warn: (message: string, ...arg: unknown[]) => console.warn('WARN:', message, ...arg),
//   verbose: (message: string, ...arg: unknown[]) => console.log('VERBOSE:', message, ...arg),
// };

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

    //console.log('Result:', result);
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
});
