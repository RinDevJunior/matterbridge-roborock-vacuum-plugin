import { getSupportedAreas } from '../../initialData/getSupportedAreas';
import { RoomMap } from '../../model/RoomMap';
import { Room } from '../../roborockCommunication/Zmodel/room';

const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
  notice: jest.fn(),
};

describe('getSupportedAreas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default area when rooms and roomMap are empty', () => {
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
      mockLogger as any,
    );

    expect(supportedAreas.length).toEqual(8);
  });

  it('returns default area when rooms and roomMap are empty', () => {
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
          { id: 16, globalId: 2775739, displayName: undefined },
          { id: 17, globalId: 991195, displayName: undefined },
          { id: 18, globalId: 991187, displayName: undefined },
          { id: 19, globalId: 991185, displayName: undefined },
          { id: 20, globalId: 991190, displayName: undefined },
        ],
      } as RoomMap,
      mockLogger as any,
    );

    expect(supportedAreas.length).toEqual(5);
  });

  it('returns default area when rooms and roomMap are empty', () => {
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
          { id: 16, globalId: 2775739, displayName: undefined },
          { id: 17, globalId: 991195, displayName: undefined },
          { id: 18, globalId: 991187, displayName: undefined },
          { id: 19, globalId: 991185, displayName: undefined },
          { id: 20, globalId: 991190, displayName: undefined },
        ],
      } as RoomMap,
      mockLogger as any,
    );

    expect(supportedAreas.length).toEqual(5);
  });

  it('returns default area when rooms and roomMap are empty', () => {
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
        { id: 16, globalId: 2775739, displayName: undefined, alternativeId: '161' },
        { id: 17, globalId: 991195, displayName: undefined, alternativeId: '171' },
        { id: 18, globalId: 991187, displayName: undefined, alternativeId: '181' },
        { id: 19, globalId: 991185, displayName: undefined, alternativeId: '191' },
        { id: 20, globalId: 991190, displayName: undefined, alternativeId: '201' },
      ],
    };
    const { supportedAreas } = getSupportedAreas(vacuumRooms, roomMap, mockLogger as any);

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
      debug: jest.fn(),
      notice: (message: string, ...args: any[]) => console.log(`DEBUG: ${message}`, ...args),
      error: (message: string, ...args: any[]) => console.log(`ERROR: ${message}`, ...args),
    };
    const { supportedAreas, supportedMaps } = getSupportedAreas(vacuumRooms, roomMap, mockLogger1 as any);
    expect(supportedAreas.length).toEqual(8);
    expect(supportedMaps.length).toEqual(2);
  });
});
