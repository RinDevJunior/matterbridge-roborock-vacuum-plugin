import { getSupportedAreas } from '../../initialData/getSupportedAreas';
import RoomMap from '../../model/RoomMap';

const mockLogger = {
  debug: jest.fn(),
  error: jest.fn(),
};

describe('getSupportedAreas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns default area when rooms and roomMap are empty', () => {
    const result = getSupportedAreas(
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

    expect(result.length).toEqual(8);
  });

  it('returns default area when rooms and roomMap are empty', () => {
    const result = getSupportedAreas(
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

    expect(result.length).toEqual(5);
  });

  it('returns default area when rooms and roomMap are empty', () => {
    const result = getSupportedAreas(
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

    expect(result.length).toEqual(5);
  });
});
