import { describe, it, expect } from 'vitest';
import { getCurrentCleanModeDefault } from '../../../../behaviors/roborock.vacuum/default/runtimes.js';
import { VacuumSuctionPower, MopRoute, MopWaterFlow } from '../../../../behaviors/roborock.vacuum/default/default.js';

describe('runtimes.getCurrentCleanModeDefault', () => {
  it('returns 10 when any value is Custom', () => {
    const s = { suctionPower: VacuumSuctionPower.Custom, waterFlow: MopWaterFlow.Off, mopRoute: MopRoute.Standard } as any;
    expect(getCurrentCleanModeDefault(s)).toBe(10);
  });

  it('matches exact preset from CleanSetting', () => {
    // Use a known mapping from CleanSetting: mode 5 exists as default Vac & Mop
    const s = { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, mopRoute: MopRoute.Standard } as any;
    const res = getCurrentCleanModeDefault(s);
    // should be a number (one of the preset keys)
    expect(typeof res).toBe('number');
  });

  it('returns 31 for mop default', () => {
    const s = { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, mopRoute: MopRoute.Standard } as any;
    expect(getCurrentCleanModeDefault(s)).toBe(31);
  });

  it('returns 66 for vacuum default', () => {
    const s = { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Off, mopRoute: MopRoute.Standard } as any;
    expect(getCurrentCleanModeDefault(s)).toBe(66);
  });

  it('returns 5 for vac & mop default when both on', () => {
    const s = { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, mopRoute: MopRoute.Standard } as any;
    expect(getCurrentCleanModeDefault(s)).toBe(5);
  });

  it('returns undefined for completely invalid input', () => {
    expect(getCurrentCleanModeDefault(undefined as any)).toBeUndefined();
    expect(getCurrentCleanModeDefault(null as any)).toBeUndefined();
    expect(getCurrentCleanModeDefault(123 as any)).toBeUndefined();
    expect(getCurrentCleanModeDefault('bad' as any)).toBeUndefined();
  });

  it('returns 5 if no CleanSetting match and not covered by other rules', () => {
    // Use values that do not match any CleanSetting and do not trigger custom/off/other rules
    const s = { suctionPower: 999, waterFlow: 888, mopRoute: 777 } as any;
    expect(getCurrentCleanModeDefault(s)).toBe(5);
  });
});
