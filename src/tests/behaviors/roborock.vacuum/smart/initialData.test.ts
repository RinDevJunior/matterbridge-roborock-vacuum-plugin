import { describe, it, expect } from 'vitest';
import { getSupportedCleanModesSmart } from '@/behaviors/roborock.vacuum/smart/initialData.js';
import { createDefaultExperimentalFeatureSetting } from '@/model/ExperimentalFeatureSetting.js';

describe('getSupportedCleanModesSmart', () => {
  it('includes modes 4 and 5 and excludes duplicates from default list', () => {
    const setting = createDefaultExperimentalFeatureSetting();
    const result = getSupportedCleanModesSmart(setting);
    const modes = result.map((r) => r.mode);
    expect(modes).toContain(4);
    expect(modes).toContain(5);
    // ensure no duplicate 4/5 from appended default list
    const occurrences4 = modes.filter((m) => m === 4).length;
    const occurrences5 = modes.filter((m) => m === 5).length;
    expect(occurrences4).toBe(1);
    expect(occurrences5).toBe(1);
  });
});
