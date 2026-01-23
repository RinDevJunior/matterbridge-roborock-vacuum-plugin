import { describe, it, expect } from 'vitest';
import { CarpetCleanMode } from '../../../../src/roborockCommunication/models/messageResult.js';

describe('Zmodel messageResult', () => {
  it('exports CarpetCleanMode enum values', () => {
    expect(CarpetCleanMode.Avoid).toBe(0);
    expect(CarpetCleanMode.Ignore).toBe(2);
    expect(CarpetCleanMode.Cross).toBe(3);
    expect(CarpetCleanMode.DynamicLift).toBe(200);
  });
});
