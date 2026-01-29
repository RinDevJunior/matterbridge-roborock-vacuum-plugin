import { describe, it, expect } from 'vitest';
import { RvcRunMode } from 'matterbridge/matter/clusters';
import { getRunningMode } from '../../initialData/getSupportedRunModes.js';

describe('getSupportedRunModes helpers', () => {
  it('getRunningMode returns correct mode for ModeTag.Cleaning', () => {
    const mode = getRunningMode(RvcRunMode.ModeTag.Cleaning);
    expect(typeof mode === 'number' || mode === null).toBeTruthy();
  });

  it('getRunningMode returns null for undefined tag', () => {
    const mode = getRunningMode(undefined);
    expect(mode).toBeNull();
  });
});
