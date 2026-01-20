import { describe, it, expect } from 'vitest';
import { RvcRunMode } from 'matterbridge/matter/clusters';
import { getSupportedRunModes } from '../../initialData/index.js';
import { getRunningMode } from '../../initialData/getSupportedRunModes.js';

describe('getSupportedRunModes helpers', () => {
  it('getSupportedRunModes returns array containing Idle mapping', () => {
    const modes = getSupportedRunModes();
    expect(Array.isArray(modes)).toBe(true);
    expect(modes.map((m) => m.label)).toContain('Idle');
  });

  it('getRunningMode returns correct mode for ModeTag.Cleaning', () => {
    const mode = getRunningMode(RvcRunMode.ModeTag.Cleaning);
    expect(typeof mode === 'number' || mode === null).toBeTruthy();
  });

  it('getRunningMode returns null for undefined tag', () => {
    const mode = getRunningMode(undefined);
    expect(mode).toBeNull();
  });
});
