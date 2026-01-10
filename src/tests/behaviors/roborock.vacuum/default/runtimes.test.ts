import { getCurrentCleanModeDefault } from '../../../../behaviors/roborock.vacuum/default/runtimes';
import { VacuumSuctionPower, MopRoute, MopWaterFlow } from '../../../../behaviors/roborock.vacuum/default/default';

describe('runtimes.getCurrentCleanModeDefault', () => {
  test('returns undefined for invalid input', () => {
    // @ts-expect-error Testing with invalid input
    expect(getCurrentCleanModeDefault(undefined)).toBeUndefined();
    // @ts-expect-error Testing with invalid input
    expect(getCurrentCleanModeDefault(null)).toBeUndefined();
  });

  test('returns 10 when any value is Custom', () => {
    const s = { suctionPower: VacuumSuctionPower.Custom, waterFlow: MopWaterFlow.Off, mopRoute: MopRoute.Off } as any;
    expect(getCurrentCleanModeDefault(s)).toBe(10);
  });

  test('matches exact preset from CleanSetting', () => {
    // Use a known mapping from CleanSetting: mode 5 exists as default Vac & Mop
    const s = { suctionPower: VacuumSuctionPower.Medium, waterFlow: MopWaterFlow.Medium, mopRoute: MopRoute.Default } as any;
    const res = getCurrentCleanModeDefault(s);
    // should be a number (one of the preset keys)
    expect(typeof res).toBe('number');
  });

  test('returns 31 for mop default', () => {
    const s = { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, mopRoute: MopRoute.Default } as any;
    expect(getCurrentCleanModeDefault(s)).toBe(31);
  });

  test('returns 66 for vacuum default', () => {
    const s = { suctionPower: VacuumSuctionPower.Medium, waterFlow: MopWaterFlow.Off, mopRoute: MopRoute.Default } as any;
    expect(getCurrentCleanModeDefault(s)).toBe(66);
  });

  test('returns 5 for vac & mop default when both on', () => {
    const s = { suctionPower: VacuumSuctionPower.Medium, waterFlow: MopWaterFlow.Medium, mopRoute: MopRoute.Default } as any;
    expect(getCurrentCleanModeDefault(s)).toBe(5);
  });
});
