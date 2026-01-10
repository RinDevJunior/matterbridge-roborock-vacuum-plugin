import { getSupportedScenes } from '../../initialData/getSupportedScenes';

describe('getSupportedScenes', () => {
  it('returns empty array and logs error when scenes missing', () => {
    const mockLogger: any = { error: jest.fn(), debug: jest.fn() };
    const result = getSupportedScenes([], mockLogger);
    expect(result).toEqual([]);
    expect(mockLogger.error).toHaveBeenCalledWith('No scenes found');
  });

  it('maps enabled scenes to ServiceArea.Area entries', () => {
    const mockLogger: any = { error: jest.fn(), debug: jest.fn() };
    const scenes = [
      { id: 10, name: 'Routine A', enabled: true },
      { id: 0, name: 'Routine B', enabled: false },
    ];
    const result = getSupportedScenes(scenes as any, mockLogger);
    expect(result.length).toBe(1);
    expect(result[0].areaId).toBe(10);
    expect(result[0].areaInfo.locationInfo.locationName).toBe('Scene: Routine A');
  });
});
