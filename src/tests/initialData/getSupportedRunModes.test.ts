import { describe, it, expect } from 'vitest';
import { RvcRunMode } from 'matterbridge/matter/clusters';
import { getRunningMode } from '../../initialData/getSupportedRunModes.js';

describe('getRunningMode', () => {
  it('returns the mode number for ModeTag.Cleaning', () => {
    const mode = getRunningMode(RvcRunMode.ModeTag.Cleaning);
    expect(mode).toBe(2);
  });

  it('returns the mode number for ModeTag.Idle', () => {
    const mode = getRunningMode(RvcRunMode.ModeTag.Idle);
    expect(mode).toBe(1);
  });

  it('returns the mode number for ModeTag.Mapping', () => {
    const mode = getRunningMode(RvcRunMode.ModeTag.Mapping);
    expect(mode).toBe(3);
  });

  it('returns null for undefined tag', () => {
    const mode = getRunningMode(undefined);
    expect(mode).toBeNull();
  });
});
