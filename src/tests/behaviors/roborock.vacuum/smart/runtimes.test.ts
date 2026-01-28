import { describe, it, expect } from 'vitest';
import { MopWaterFlowSmart, VacuumSuctionPowerSmart } from '../../../../behaviors/roborock.vacuum/smart/smart.js';
import { smartCleanModeConfigs } from '../../../../behaviors/roborock.vacuum/core/modeConfig.js';
import { createSmartModeResolver } from '../../../../behaviors/roborock.vacuum/core/modeResolver.js';

const smartModeResolver = createSmartModeResolver(smartCleanModeConfigs);

describe('getCurrentCleanModeSmart', () => {
  it('returns undefined if input is undefined', () => {
    expect(smartModeResolver.resolve(undefined as any)).toBeUndefined();
  });

  it('returns the correct key if an exact CleanSetting match exists', () => {
    // Exact match for 'Vac & Mop Default' (key 5)
    expect(
      smartModeResolver.resolve({
        suctionPower: VacuumSuctionPowerSmart.Balanced,
        waterFlow: MopWaterFlowSmart.Medium,
        distance_off: 0,
        mopRoute: 300,
      }),
    ).toBe(5);
  });

  it('returns 12 for MopMax', () => {
    expect(
      smartModeResolver.resolve({
        suctionPower: VacuumSuctionPowerSmart.Off,
        waterFlow: MopWaterFlowSmart.High,
        distance_off: 0,
        mopRoute: 300,
      }),
    ).toBe(32);
  });

  it('returns 16 for Vacuum Default if waterFlow is Off', () => {
    expect(
      smartModeResolver.resolve({
        suctionPower: VacuumSuctionPowerSmart.Balanced,
        waterFlow: MopWaterFlowSmart.Off,
        distance_off: 0,
        mopRoute: 300,
      }),
    ).toBe(66);
  });

  it('returns 5 for Vac & Mop Default if neither suctionPower nor waterFlow is Off', () => {
    expect(
      smartModeResolver.resolve({
        suctionPower: VacuumSuctionPowerSmart.Balanced,
        waterFlow: MopWaterFlowSmart.Medium,
        distance_off: 1,
        mopRoute: 300,
      }),
    ).toBe(5);
  });

  it('returns 5 if no match and no fallback applies', () => {
    expect(
      smartModeResolver.resolve({
        suctionPower: 999,
        waterFlow: 999,
        distance_off: 999,
        mopRoute: 999,
      }),
    ).toBe(5);
  });
});
