import RoomMap from '../model/RoomMap';
import { RoborockMatterbridgePlatform } from '../platform';
import { PlatformRunner } from '../platformRunner';

describe('PlatformRunner.getRoomMapFromDevice', () => {
  let platform: any;
  let runner: PlatformRunner;

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
    runner = new PlatformRunner(platform as RoborockMatterbridgePlatform);
  });

  it('returns RoomMap with roomData from getRoomMappings if available', async () => {
    const device = {
      duid: 'duid1',
      rooms: [
        { id: 1, name: '11100845' },
        { id: 2, name: '11100849' },
        { id: 3, name: '11100842' },
        { id: 4, name: '11100847' },
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

    const result = await runner.getRoomMapFromDevice(device as any);

    expect(result).toBeInstanceOf(RoomMap);
    expect(result.rooms).toEqual(roomData);
    expect(platform.log.error).toHaveBeenCalledWith(expect.stringContaining('roomData'));
  });

  it('returns RoomMap with roomDataMap from getMapInformation if getRoomMappings is empty', async () => {
    const device = { duid: 'duid2', rooms: [{ id: 2, name: 'room2' }] };
    platform.roborockService.getRoomMappings.mockResolvedValue([]);
    const mapInfo = {
      maps: [
        {
          rooms: [
            { id: 3, name: '201' },
            { id: 4, name: '202' },
          ],
        },
      ],
    };
    platform.roborockService.getMapInformation.mockResolvedValue(mapInfo);

    const result = await runner.getRoomMapFromDevice(device as any);

    expect(result).toBeInstanceOf(RoomMap);
    expect(result.rooms.length).toEqual(mapInfo.maps[0].rooms.length);
    expect(platform.log.error).toHaveBeenCalledWith(expect.stringContaining('mapInfo'));
  });

  it('returns RoomMap with empty array if no roomData or mapInfo', async () => {
    const device = { duid: 'duid3', rooms: [{ id: 5, name: 'room5' }] };
    platform.roborockService.getRoomMappings.mockResolvedValue(undefined);
    platform.roborockService.getMapInformation.mockResolvedValue(undefined);

    const result = await runner.getRoomMapFromDevice(device as any);

    expect(result).toBeInstanceOf(RoomMap);
    expect(result.rooms).toEqual([]);
    expect(platform.log.error).toHaveBeenCalledWith(
      expect.stringContaining('------------------------------------------------------------------------------------------------------'),
    );
  });

  it('returns RoomMap with empty array if platform.roborockService is undefined', async () => {
    runner.platform.roborockService = undefined;
    const device = { duid: 'duid4', rooms: [{ id: 6, name: 'room6' }] };

    const result = await runner.getRoomMapFromDevice(device as any);

    expect(result).toBeInstanceOf(RoomMap);
    expect(result.rooms).toEqual([]);
    expect(platform.log.error).toHaveBeenCalledWith(
      expect.stringContaining('------------------------------------------------------------------------------------------------------'),
    );
  });

  it('handles device with no rooms property', async () => {
    const device = { duid: 'duid5' };
    platform.roborockService.getRoomMappings.mockResolvedValue(undefined);
    platform.roborockService.getMapInformation.mockResolvedValue(undefined);

    const result = await runner.getRoomMapFromDevice(device as any);

    expect(result).toBeInstanceOf(RoomMap);
    expect(result.rooms).toEqual([]);
  });
});
