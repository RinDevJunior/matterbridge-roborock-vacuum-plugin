import { getSupportedScenes } from '../../initialData/getSupportedScenes.js';
import { describe, it, expect, vi } from 'vitest';
import { makeLogger } from '../testUtils.js';
import { asPartial } from '../helpers/testUtils.js';

describe('getSupportedScenes', () => {
  it('returns empty array and logs debug when scenes missing', () => {
    const mockLogger = makeLogger();
    const result = getSupportedScenes([], mockLogger);
    expect(result).toEqual([]);
    expect(mockLogger.debug).toHaveBeenCalledWith('No scenes found');
  });

  it('maps enabled scenes to ServiceArea.Area entries', () => {
    const mockLogger = makeLogger();
    const scenes = [
      asPartial({ id: 10, name: 'Routine A', enabled: true, param: '', type: 'auto' }),
      asPartial({ id: 0, name: 'Routine B', enabled: false, param: '', type: 'auto' }),
    ];
    const result = getSupportedScenes(scenes, mockLogger);
    expect(result.length).toBe(1);
    expect(result[0]?.areaId).toBe(5010); // 5000 + 10
    expect(result[0]?.areaInfo?.locationInfo?.locationName).toBe('Scene: Routine A');
  });
});
