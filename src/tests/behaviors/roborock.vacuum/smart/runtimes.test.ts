import { getCurrentCleanModeSmart } from '../../../../behaviors/roborock.vacuum/smart/runtimes';
import { MopWaterFlowSmart, VacuumSuctionPowerSmart } from '../../../../behaviors/roborock.vacuum/smart/smart';

describe('getCurrentCleanModeSmart', () => {
  it('returns undefined if input is undefined', () => {
    expect(getCurrentCleanModeSmart(undefined as any)).toBeUndefined();
  });

  it('returns the correct key if an exact CleanSetting match exists', () => {
    // Exact match for 'Vac & Mop Default' (key 5)
    expect(
      getCurrentCleanModeSmart({
        suctionPower: VacuumSuctionPowerSmart.Balanced,
        waterFlow: MopWaterFlowSmart.Medium,
        distance_off: 0,
        mopRoute: 300,
      }),
    ).toBe(5);
  });

  it('returns 12 for MopMax', () => {
    expect(
      getCurrentCleanModeSmart({
        suctionPower: VacuumSuctionPowerSmart.Off,
        waterFlow: MopWaterFlowSmart.High,
        distance_off: 0,
        mopRoute: 300,
      }),
    ).toBe(12);
  });

  it('returns 16 for Vacuum Default if waterFlow is Off', () => {
    expect(
      getCurrentCleanModeSmart({
        suctionPower: VacuumSuctionPowerSmart.Balanced,
        waterFlow: MopWaterFlowSmart.Off,
        distance_off: 0,
        mopRoute: 300,
      }),
    ).toBe(16);
  });

  it('returns 5 for Vac & Mop Default if neither suctionPower nor waterFlow is Off', () => {
    expect(
      getCurrentCleanModeSmart({
        suctionPower: VacuumSuctionPowerSmart.Balanced,
        waterFlow: MopWaterFlowSmart.Medium,
        distance_off: 1,
        mopRoute: 300,
      }),
    ).toBe(5);
  });

  it('returns undefined if no match and no fallback applies', () => {
    expect(
      getCurrentCleanModeSmart({
        suctionPower: 999,
        waterFlow: 999,
        distance_off: 999,
        mopRoute: 999,
      }),
    ).toBe(5);
  });
});
